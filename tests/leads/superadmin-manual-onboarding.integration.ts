import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

import { validateMongoTestTarget } from "../../lib/mongodb-test-target.ts";

const env = parseEnv(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../.env.test.local"), "utf8"));
const { uri: testUri, databaseName, hostname } = validateMongoTestTarget(env.MONGODB_TEST_URI);
const dbUri = new URL(testUri);
dbUri.searchParams.set("readPreference", "primary");
process.env.MONGODB_TEST_URI = testUri;
process.env.MONGODB_URI = dbUri.toString();
process.env.PAYLOAD_SECRET = randomBytes(32).toString("hex");
for (const name of ["OMANA_INGEST_SECRET", "ESTATE1_INGEST_SECRET", "ESTATE2_INGEST_SECRET", "DHOLERA_ESTATES_INGEST_SECRET", "INDUSTRIAL_INGEST_SECRET"]) {
  process.env[name] = randomBytes(32).toString("hex");
}

const mongoose = (await import("mongoose")).default;
await mongoose.connect(dbUri.toString(), { serverSelectionTimeoutMS: 15_000 });
await mongoose.connection.db?.admin().command({ ping: 1 });
assert.equal(mongoose.connection.db?.databaseName, databaseName);
assert.equal(new URL(dbUri).hostname, hostname);

const { getPayload } = await import("payload");
const { default: config } = await import("../../payload.config.ts");
const payload = await getPayload({ config });
const db = mongoose.connection.db;
assert.ok(db);
const runId = randomUUID();
const marker = `superadmin-onboarding-test-${runId}`;
const password = randomBytes(36).toString("base64url");
const userIds: string[] = [];
let teamId = "";
let officeId = "";
let ownsOffice = false;

try {
  const collision = await db.collection("users").countDocuments({ email: { $regex: `^${runId}\\.` } });
  assert.equal(collision, 0, "the synthetic email namespace is unused");

  // Bootstrap only a synthetic actor, as isolated integration fixtures do.
  const bootstrapAdmin = await payload.create({
    collection: "users",
    data: { email: `${runId}.admin@example.invalid`, password, name: `${marker} Super Admin`, role: "super-admin", active: true, eligibleForAssignment: false },
    overrideAccess: true,
  });
  userIds.push(String(bootstrapAdmin.id));
  const login = await payload.login({ collection: "users", data: { email: `${runId}.admin@example.invalid`, password } });
  assert.equal(login.user?.role, "super-admin", "synthetic Super Admin authenticates with existing Payload auth");

  // Use a uniquely identified synthetic Noida office so an existing test team
  // or counter cannot be modified or collide with this onboarding run.
  const createdOffice = await payload.create({
    collection: "crm-offices",
    data: { name: `${marker} Noida Office`, code: `noida-${runId.slice(0, 8)}`, active: true },
    user: login.user,
    overrideAccess: false,
  });
  officeId = String(createdOffice.id);
  ownsOffice = true;

  const leader = await payload.create({
    collection: "users",
    data: { email: `${runId}.leader@example.invalid`, password, name: `${marker} Team Leader`, role: "team-leader", office: officeId, active: true, eligibleForAssignment: false },
    user: login.user,
    overrideAccess: false,
  });
  userIds.push(String(leader.id));

  const salespeople = [];
  for (let order = 1; order <= 10; order += 1) {
    const person = await payload.create({
      collection: "users",
      data: {
        email: `${runId}.sales${String(order).padStart(2, "0")}@example.invalid`,
        password,
        name: `${marker} Salesperson ${String(order).padStart(2, "0")}`,
        role: "salesperson",
        office: officeId,
        active: true,
        eligibleForAssignment: false,
        rotationOrder: order,
      },
      user: login.user,
      overrideAccess: false,
    });
    userIds.push(String(person.id));
    salespeople.push(person);
  }

  const team = await payload.create({
    collection: "crm-teams",
    data: { name: marker, office: officeId, teamLeader: leader.id, salespeople: salespeople.map(({ id }) => String(id)), active: true },
    user: login.user,
    overrideAccess: false,
  });
  teamId = String(team.id);
  for (const person of salespeople) {
    await payload.update({ collection: "users", id: String(person.id), data: { team: teamId }, user: login.user, overrideAccess: false });
  }

  const logins = await Promise.all([
    payload.login({ collection: "users", data: { email: `${runId}.leader@example.invalid`, password } }),
    ...Array.from({ length: 10 }, (_, index) => payload.login({ collection: "users", data: { email: `${runId}.sales${String(index + 1).padStart(2, "0")}@example.invalid`, password } })),
  ]);
  assert.equal(logins.length, 11);
  assert.equal(logins.filter(({ user }) => user?.role === "team-leader").length, 1);
  assert.equal(logins.filter(({ user }) => user?.role === "salesperson").length, 10);
  assert.ok(logins.every(({ user }) => {
    const officeValue = (user as typeof user & { office?: string | number | { id?: string | number } } | null)?.office;
    return String(typeof officeValue === "object" && officeValue ? officeValue.id : officeValue) === officeId;
  }), "all accounts are scoped to the Noida office");
  await assert.rejects(
    () => payload.create({ collection: "users", data: { email: `${runId}.escalation@example.invalid`, password, name: marker, role: "super-admin", active: true, eligibleForAssignment: false }, user: logins[1].user, overrideAccess: false, draft: false }),
    "a salesperson cannot create or escalate user roles",
  );

  console.log(JSON.stringify({ result: "PASS", target: "isolated TEST MongoDB", adminAuthenticated: true, usersCreatedThroughPayloadAccess: 11, salespersonLogins: 10, teamLeaderLogins: 1, roleEscalationRejected: true, smtpUsed: false, secretsOrPasswordsLogged: false }));
} finally {
  if (teamId) await db.collection("crm-teams").deleteOne({ _id: new mongoose.Types.ObjectId(teamId) });
  if (userIds.length) await db.collection("users").deleteMany({ _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } });
  if (ownsOffice && officeId) {
    await db.collection("crm-assignment-counters").deleteMany({ office: new mongoose.Types.ObjectId(officeId) });
    await db.collection("crm-offices").deleteOne({ _id: new mongoose.Types.ObjectId(officeId) });
  }
  const leftovers = await db.collection("users").countDocuments({ email: { $regex: `^${runId}\\.` } });
  assert.equal(leftovers, 0, "all synthetic user records were removed");
  try {
    await payload.destroy();
  } finally {
    await mongoose.disconnect();
  }
}
