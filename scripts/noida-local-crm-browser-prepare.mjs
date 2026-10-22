import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MongoClient, ObjectId } from "mongodb";

import { assertNoInheritedServices, LOCAL_DEMO, verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";

const database = "noida-crm-workflow-qa-20261019";
const uri = `mongodb://127.0.0.1:27179/${database}?replicaSet=noida_demo&directConnection=true`;
const root = resolve(process.cwd(), ".artifacts/noida-local-demo-20261019");
const manifestPath = resolve(root, "crm-noida-workflow-70c38baa-1ca2-4a70-95f9-736adf21c84e.manifest.json");
const secretPath = resolve(root, "crm-workflow-browser-20261019.secrets.json");
if (process.argv.slice(2).join("|") !== "--execute|--approval=APPROVE LOCAL CRM BROWSER AND HTTP WORKFLOW QA") {
  throw new Error("Exact local browser QA execution and approval flags are required");
}
assertNoInheritedServices(process.env);
assert.equal(new URL(uri).hostname, "127.0.0.1");
assert.equal(new URL(uri).port, "27179");
assert.equal(new URL(uri).pathname, `/${database}`);
for (const path of [root, manifestPath]) {
  const info = lstatSync(path);
  assert.ok(!info.isSymbolicLink() && realpathSync(path) === path);
  assert.equal(info.mode & (path === root ? 0o077 : 0o777), path === root ? 0 : 0o600);
}
assert.ok(!existsSync(secretPath), "Protected browser QA credentials already exist; refusing to rotate twice");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.status, "verified");
assert.deepEqual(manifest.target, { host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database });
assert.equal(manifest.ids.users.length, 4);
assert.equal(manifest.ids.leads.length, 2);
assert.equal(manifest.ids.activities.length, 8);

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
let payload;
let operation = "read-only preflight";
try {
  await client.connect();
  await verifyLocalDemoServer(client, { requireEmpty: false });
  const qa = client.db(database);
  assert.equal(qa.databaseName, database);
  const [qaUsers, qaLeads, qaActivities, demoBefore] = await Promise.all([
    qa.collection("users").find({}).toArray(),
    qa.collection("central-leads").find({}).toArray(),
    qa.collection("crm-activities").countDocuments({}),
    Promise.all(["users", "central-leads", "crm-activities", "crm-assignment-counters"].map((name) => client.db(LOCAL_DEMO.database).collection(name).countDocuments({}))),
  ]);
  assert.deepEqual(demoBefore, [12, 30, 60, 1]);
  assert.equal(qaUsers.length, 4);
  assert.equal(qaLeads.length, 2);
  assert.equal(qaActivities, 8);
  assert.equal(await qa.collection("crm-offices").countDocuments({}), 1);
  assert.equal(await qa.collection("crm-teams").countDocuments({}), 1);
  assert.deepEqual(qaUsers.map((item) => String(item._id)).sort(), [...manifest.ids.users].sort());
  assert.deepEqual(qaLeads.map((item) => String(item._id)).sort(), [...manifest.ids.leads].sort());
  assert.ok(qaUsers.every((item) => item.email.startsWith(`${manifest.runMarker}-`) && item.email.endsWith("@example.invalid") && item.active === true));
  assert.deepEqual(manifest.ids.users.map((value) => qaUsers.find((item) => String(item._id) === value)?.role), ["super-admin", "team-leader", "salesperson", "salesperson"]);
  assert.ok(qaLeads.every((item) => item.email.startsWith(`${manifest.runMarker}-lead-`) && item.email.endsWith("@example.invalid")));
  const hashesBefore = new Map(qaUsers.map((item) => [String(item._id), String(item.hash || "")]));
  const secrets = { payloadSecret: randomBytes(48).toString("base64url"), accountPassword: randomBytes(36).toString("base64url") };
  writeFileSync(secretPath, `${JSON.stringify(secrets)}\n`, { flag: "wx", mode: 0o600 });
  assert.equal(lstatSync(secretPath).mode & 0o777, 0o600);

  process.env.MONGODB_URI = uri;
  process.env.PAYLOAD_SECRET = secrets.payloadSecret;
  process.env.NEXT_TELEMETRY_DISABLED = "1";
  operation = "initialize QA-only Payload config";
  const [{ buildConfig, getPayload }, { mongooseAdapter }, { Users }, { CrmOffices, CrmTeams, CentralLeads, CrmActivities }] = await Promise.all([
    import("payload"), import("@payloadcms/db-mongodb"), import("../payload.config.ts"), import("../collections/Crm.ts"),
  ]);
  const config = await buildConfig({
    secret: secrets.payloadSecret,
    telemetry: false,
    db: mongooseAdapter({ url: uri, connectOptions: { autoIndex: false }, ensureIndexes: true }),
    admin: { user: "users" },
    collections: [Users, CrmOffices, CrmTeams, CentralLeads, CrmActivities],
  });
  payload = await getPayload({ config });
  assert.equal(payload.db.url, uri);
  assert.equal(payload.db.connection?.db?.databaseName, database);
  await verifyLocalDemoServer(client, { requireEmpty: false });
  assert.equal(await qa.collection("payload-migrations").countDocuments({}), 0, "No migration may run");

  operation = "rotate only the four approved QA account passwords";
  for (const value of manifest.ids.users) {
    const account = qaUsers.find((item) => String(item._id) === value);
    assert.ok(account);
    await payload.update({ collection: "users", id: value, overrideAccess: true, data: { password: secrets.accountPassword } });
    const updated = await qa.collection("users").findOne({ _id: new ObjectId(value) }, { projection: { hash: 1 } });
    assert.ok(updated?.hash && String(updated.hash) !== hashesBefore.get(value), "QA password hash changed");
  }
  assert.equal(await qa.collection("users").countDocuments({}), 4);
  assert.equal(await qa.collection("central-leads").countDocuments({}), 2);
  assert.equal(await qa.collection("crm-activities").countDocuments({}), 8);
  assert.equal(await qa.collection("payload-migrations").countDocuments({}), 0);
  const demoAfter = await Promise.all(["users", "central-leads", "crm-activities", "crm-assignment-counters"].map((name) => client.db(LOCAL_DEMO.database).collection(name).countDocuments({})));
  assert.deepEqual(demoAfter, demoBefore);
  console.log(JSON.stringify({ status: "PASS", target: { host: "127.0.0.1", port: 27179, database }, rotatedAccounts: 4,
    leadCount: 2, activityCount: 8, migrations: 0, credentialFile: secretPath, credentialProtection: "0600; values never printed", demoCounts: demoAfter }));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", operation, errorClass: error?.constructor?.name || "UnknownError", mongoCode: Number.isInteger(error?.code) ? error.code : null,
    message: "Stopped without retry, deletion, or cleanup; inspect QA database and protected file" }));
  process.exitCode = 1;
} finally {
  if (payload) await payload.destroy();
  await client.close();
}
