import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";

import { assertNoInheritedServices, LOCAL_DEMO, verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";

const QA_DATABASE = "noida-crm-workflow-qa-20261019";
const QA_URI = `mongodb://127.0.0.1:27179/${QA_DATABASE}?replicaSet=noida_demo&directConnection=true`;
const APPROVAL = "APPROVE LOCAL CRM WORKFLOW QA";
const args = process.argv.slice(2);
const resumeArg = args.find((item) => item.startsWith("--resume="));
const resumeMarker = resumeArg?.slice("--resume=".length);
if ((resumeMarker && !/^noida-workflow-[0-9a-f-]{36}$/.test(resumeMarker)) ||
  !args.includes("--execute") || !args.includes(`--approval=${APPROVAL}`) ||
  args.length !== (resumeMarker ? 3 : 2) || args.some((item) => !["--execute", `--approval=${APPROVAL}`, resumeArg].includes(item))) {
  throw new Error("Exact local workflow QA execution and approval flags are required");
}
assertNoInheritedServices(process.env);
assert.equal(new URL(QA_URI).hostname, "127.0.0.1");
assert.equal(new URL(QA_URI).port, "27179");
assert.equal(new URL(QA_URI).pathname, `/${QA_DATABASE}`);
assert.equal(new URL(QA_URI).searchParams.get("replicaSet"), "noida_demo");
assert.equal(new URL(QA_URI).searchParams.get("directConnection"), "true");
assert.equal(new URL(QA_URI).username, "");
assert.equal(new URL(QA_URI).password, "");

const runMarker = resumeMarker || `noida-workflow-${randomUUID()}`;
const manifestPath = resolve(LOCAL_DEMO.directory, `crm-${runMarker}.manifest.json`);
const freshManifest = {
  schema: 1,
  runMarker,
  target: { host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: QA_DATABASE },
  status: "preflight",
  ids: { office: null, team: null, users: [], leads: [], activities: [] },
  checks: {},
};
let manifest = freshManifest;
if (resumeMarker) {
  const info = lstatSync(manifestPath);
  assert.ok(info.isFile() && !info.isSymbolicLink() && (info.mode & 0o777) === 0o600);
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.runMarker, runMarker);
  assert.equal(manifest.status, "partial-failure");
  assert.deepEqual(manifest.target, freshManifest.target);
  assert.equal(manifest.ids.users.length, 4);
  assert.equal(manifest.ids.leads.length, 2);
  assert.equal(manifest.ids.activities.length, 0);
}
const client = new MongoClient(QA_URI, { serverSelectionTimeoutMS: 5000 });
let payload;
let operation = "read-only preflight";

function saveManifest() {
  const data = `${JSON.stringify(manifest, null, 2)}\n`;
  if (!existsSync(manifestPath)) writeFileSync(manifestPath, data, { flag: "wx", mode: 0o600 });
  else {
    const next = `${manifestPath}.next`;
    writeFileSync(next, data, { flag: "wx", mode: 0o600 });
    renameSync(next, manifestPath);
  }
  const info = lstatSync(manifestPath);
  assert.ok(info.isFile() && !info.isSymbolicLink() && (info.mode & 0o777) === 0o600);
}

async function snapshotDemo() {
  const db = client.db(LOCAL_DEMO.database);
  const result = {};
  for (const collection of ["users", "central-leads", "crm-activities", "crm-assignment-counters"]) {
    const docs = await db.collection(collection).find({}).toArray();
    const digest = createHash("sha256").update(docs.map((doc) => String(doc._id)).sort().join("\n")).digest("hex");
    result[collection] = { count: docs.length, idDigest: digest };
  }
  return result;
}

async function countQa(db) {
  const counts = {};
  for (const name of ["crm-offices", "crm-teams", "users", "central-leads", "crm-activities"]) {
    counts[name] = await db.collection(name).countDocuments({});
  }
  return counts;
}

const id = (value) => String(value?.id ?? value);
const future = (days) => new Date(Date.now() + days * 86_400_000).toISOString();

try {
  await client.connect();
  await verifyLocalDemoServer(client, { requireEmpty: false });
  const databaseNames = (await client.db("admin").command({ listDatabases: 1, nameOnly: true })).databases.map((item) => item.name);
  assert.equal(databaseNames.includes(QA_DATABASE), Boolean(resumeMarker), "QA database existence does not match the requested run mode");
  const demoBefore = await snapshotDemo();
  assert.equal(demoBefore.users.count, 12);
  assert.equal(demoBefore["central-leads"].count, 30);
  assert.equal(demoBefore["crm-activities"].count, 60);
  if (!resumeMarker) saveManifest();

  process.env.MONGODB_URI = QA_URI;
  process.env.PAYLOAD_SECRET = randomBytes(48).toString("base64url");
  process.env.NEXT_TELEMETRY_DISABLED = "1";

  operation = "initialize isolated Payload QA schema";
  const [{ buildConfig, getPayload }, { mongooseAdapter }, { Users }, { CentralLeads, CrmActivities, CrmOffices, CrmTeams }, { buildCrmReport }] = await Promise.all([
    import("payload"),
    import("@payloadcms/db-mongodb"),
    import("../payload.config.ts"),
    import("../collections/Crm.ts"),
    import("../lib/crm/report-core.ts"),
  ]);
  const qaLeads = {
    ...CentralLeads,
    hooks: {
      ...CentralLeads.hooks,
      afterChange: [
        ...CentralLeads.hooks.afterChange,
        ({ doc }) => {
          if (doc.notes === `rollback-probe:${runMarker}`) throw new Error("Synthetic transaction rollback probe");
          return doc;
        },
      ],
    },
  };
  const config = await buildConfig({
    secret: process.env.PAYLOAD_SECRET,
    telemetry: false,
    db: mongooseAdapter({ url: QA_URI, connectOptions: { autoIndex: false }, ensureIndexes: true }),
    admin: { user: "users" },
    collections: [Users, CrmOffices, CrmTeams, qaLeads, CrmActivities],
  });
  assert.equal(process.env.MONGODB_URI, QA_URI);
  payload = await getPayload({ config });
  assert.equal(payload.db.url, QA_URI);
  assert.equal(payload.db.connection?.db?.databaseName, QA_DATABASE);
  await verifyLocalDemoServer(client, { requireEmpty: false });
  const db = client.db(QA_DATABASE);
  assert.equal(db.databaseName, QA_DATABASE);
  assert.deepEqual(await countQa(db), resumeMarker
    ? { "crm-offices": 1, "crm-teams": 1, users: 4, "central-leads": 2, "crm-activities": 0 }
    : { "crm-offices": 0, "crm-teams": 0, users: 0, "central-leads": 0, "crm-activities": 0 });

  let office, team, users, leads;
  if (resumeMarker) {
    operation = "verify and load this run's existing synthetic fixtures";
    office = await payload.findByID({ collection: "crm-offices", id: manifest.ids.office, overrideAccess: true, depth: 0 });
    team = await payload.findByID({ collection: "crm-teams", id: manifest.ids.team, overrideAccess: true, depth: 0 });
    users = await Promise.all(manifest.ids.users.map((userID) => payload.findByID({ collection: "users", id: userID, overrideAccess: true, depth: 0 })));
    leads = await Promise.all(manifest.ids.leads.map((leadID) => payload.findByID({ collection: "central-leads", id: leadID, overrideAccess: true, depth: 0 })));
    assert.equal(office.code, "noida");
    assert.equal(id(team.office), id(office));
    assert.deepEqual(users.map((item) => item.role), ["super-admin", "team-leader", "salesperson", "salesperson"]);
    assert.ok(users.every((item) => item.email.startsWith(`${runMarker}-`) && item.email.endsWith("@example.invalid") && id(item.office) === id(office)));
    assert.ok(leads.every((item) => item.email.startsWith(`${runMarker}-lead-`) && item.email.endsWith("@example.invalid") && id(item.office) === id(office) && item.status === "new"));
  } else {
  operation = "create the one approved synthetic office";
  office = await payload.create({ collection: "crm-offices", overrideAccess: true, data: { name: "Noida Workflow QA", code: "noida", active: true } });
  manifest.ids.office = id(office);
  saveManifest();

  operation = "create four approved synthetic role accounts";
  const specs = [
    { role: "super-admin", name: "Workflow QA Admin", eligibleForAssignment: false },
    { role: "team-leader", name: "Workflow QA Leader", eligibleForAssignment: false },
    { role: "salesperson", name: "Workflow QA Salesperson 1", eligibleForAssignment: true, rotationOrder: 1 },
    { role: "salesperson", name: "Workflow QA Salesperson 2", eligibleForAssignment: true, rotationOrder: 2 },
  ];
  users = [];
  for (let index = 0; index < specs.length; index++) {
    const spec = specs[index];
    const user = await payload.create({ collection: "users", overrideAccess: true, data: {
      ...spec,
      office: office.id,
      active: true,
      email: `${runMarker}-${index + 1}@example.invalid`,
      password: randomBytes(32).toString("base64url"),
    } });
    users.push(user);
    manifest.ids.users.push(id(user));
    saveManifest();
  }
  operation = "create the one approved synthetic team and relationships";
  team = await payload.create({ collection: "crm-teams", overrideAccess: true, data: {
    name: "Noida Workflow QA Team", office: office.id, teamLeader: users[1].id,
    salespeople: [users[2].id, users[3].id], active: true,
  } });
  manifest.ids.team = id(team);
  saveManifest();
  for (const user of users.slice(1)) {
    await payload.update({ collection: "users", id: user.id, overrideAccess: true, data: { team: team.id } });
  }

  operation = "create two approved synthetic leads";
  leads = [];
  for (let index = 0; index < 2; index++) {
    const lead = await payload.create({ collection: "central-leads", overrideAccess: true, data: {
      name: `Workflow QA Lead ${index + 1}`,
      email: `${runMarker}-lead-${index + 1}@example.invalid`,
      phone: `+91990000990${index + 1}`,
      website: "omana-projects", leadType: "enquiry", source: "local-workflow-qa",
      project: "Synthetic QA project", message: "Synthetic workflow QA only", consent: true,
      idempotencyKey: randomUUID(), office: office.id, team: team.id,
      assignedSalesperson: users[index + 2].id, status: "new",
    } });
    leads.push(lead);
    manifest.ids.leads.push(id(lead));
    saveManifest();
  }
  assert.deepEqual(await countQa(db), { "crm-offices": 1, "crm-teams": 1, users: 4, "central-leads": 2, "crm-activities": 0 });
  }
  const [admin, leader, salesperson1, salesperson2] = users;
  const [leadA, leadB] = leads;

  operation = "verify role-scoped reads and denied writes";
  async function visible(user) {
    const result = await payload.find({ collection: "central-leads", user, overrideAccess: false, depth: 0, limit: 10 });
    return result.docs.map((item) => id(item)).sort();
  }
  operation = "verify Admin lead visibility";
  assert.deepEqual(await visible(admin), [id(leadA), id(leadB)].sort());
  operation = "verify Team Leader lead visibility";
  assert.deepEqual(await visible(leader), [id(leadA), id(leadB)].sort());
  operation = "verify Salesperson 1 lead visibility";
  assert.deepEqual(await visible(salesperson1), [id(leadA)]);
  operation = "verify Salesperson 2 lead visibility";
  assert.deepEqual(await visible(salesperson2), [id(leadB)]);
  operation = "verify anonymous lead access denied";
  await assert.rejects(() => visible(null));
  operation = "verify cross-assignment and anonymous writes denied";
  await assert.rejects(() => payload.update({ collection: "central-leads", id: leadB.id, user: salesperson1, overrideAccess: false, data: { status: "lost" } }));
  await assert.rejects(() => payload.update({ collection: "central-leads", id: leadA.id, user: null, overrideAccess: false, data: { status: "lost" } }));
  assert.equal((await countQa(db))["crm-activities"], 0);
  manifest.checks.roleAccess = "PASS";
  saveManifest();

  operation = "save authorized status, note and follow-up updates";
  const firstFollowUp = future(2);
  const secondFollowUp = future(3);
  await payload.update({ collection: "central-leads", id: leadA.id, user: admin, overrideAccess: false,
    data: { status: "contacted", notes: "Synthetic QA contact note", nextFollowUpAt: firstFollowUp } });
  await payload.update({ collection: "central-leads", id: leadB.id, user: leader, overrideAccess: false,
    data: { status: "follow-up", notes: "Synthetic QA leader note", nextFollowUpAt: secondFollowUp } });
  await payload.update({ collection: "central-leads", id: leadA.id, user: salesperson1, overrideAccess: false,
    data: { notes: "" } });
  await payload.update({ collection: "central-leads", id: leadB.id, user: salesperson2, overrideAccess: false,
    data: { status: "qualified" } });

  const activities = await db.collection("crm-activities").find({}).sort({ createdAt: 1, _id: 1 }).toArray();
  assert.equal(activities.length, 8);
  assert.deepEqual(activities.reduce((result, row) => { result[row.event] = (result[row.event] || 0) + 1; return result; }, {}), {
    "status-changed": 3, "note-added": 3, "follow-up-scheduled": 2,
  });
  assert.ok(activities.some((row) => row.event === "note-added" && row.details?.action === "cleared" && String(row.actor) === id(salesperson1)));
  assert.ok(activities.every((row) => [id(admin), id(leader), id(salesperson1), id(salesperson2)].includes(String(row.actor))));
  manifest.ids.activities = activities.map((row) => String(row._id));
  manifest.checks.activityPersistence = "PASS";
  saveManifest();

  operation = "verify rejected validation and transactional rollback";
  const beforeRollback = await payload.findByID({ collection: "central-leads", id: leadA.id, user: admin, overrideAccess: false, depth: 0 });
  const beforeActivityCount = await db.collection("crm-activities").countDocuments({});
  await assert.rejects(() => payload.update({ collection: "central-leads", id: leadA.id, user: salesperson1, overrideAccess: false,
    data: { nextFollowUpAt: "2026-02-30T10:00:00.000Z" } }));
  await assert.rejects(() => payload.update({ collection: "central-leads", id: leadA.id, user: salesperson1, overrideAccess: false,
    data: { notes: `rollback-probe:${runMarker}` } }), /Synthetic transaction rollback probe/);
  const afterRollback = await payload.findByID({ collection: "central-leads", id: leadA.id, user: admin, overrideAccess: false, depth: 0 });
  assert.equal(afterRollback.notes, beforeRollback.notes);
  assert.equal(afterRollback.status, beforeRollback.status);
  assert.equal(afterRollback.nextFollowUpAt, beforeRollback.nextFollowUpAt);
  assert.equal(await db.collection("crm-activities").countDocuments({}), beforeActivityCount);
  manifest.checks.rollback = "PASS";
  saveManifest();

  operation = "verify saved report consistency and role scope";
  const reportOptions = { period: "all", kind: "overview", format: "json" };
  const window = { start: null, endExclusive: null, label: "All dates" };
  const salespersonNames = new Map([[id(salesperson1), "Salesperson 1"], [id(salesperson2), "Salesperson 2"]]);
  async function reportFor(user) {
    const docs = await payload.find({ collection: "central-leads", user, overrideAccess: false, depth: 0, limit: 10 });
    return buildCrmReport(docs.docs, salespersonNames, reportOptions, window);
  }
  const adminReport = await reportFor(admin);
  const leaderReport = await reportFor(leader);
  const salesperson1Report = await reportFor(salesperson1);
  const salesperson2Report = await reportFor(salesperson2);
  assert.equal(adminReport.summary.total, 2);
  assert.deepEqual(adminReport.summary, leaderReport.summary);
  assert.equal(adminReport.summary.statuses.find((row) => row.label === "contacted")?.count, 1);
  assert.equal(adminReport.summary.statuses.find((row) => row.label === "qualified")?.count, 1);
  assert.equal(adminReport.summary.followUps.upcoming, 2);
  assert.equal(salesperson1Report.summary.total, 1);
  assert.equal(salesperson2Report.summary.total, 1);
  assert.equal(salesperson1Report.summary.statuses.find((row) => row.label === "contacted")?.count, 1);
  assert.equal(salesperson2Report.summary.statuses.find((row) => row.label === "qualified")?.count, 1);
  manifest.checks.reportConsistency = "PASS";

  operation = "final read-only integrity verification";
  assert.deepEqual(await countQa(db), { "crm-offices": 1, "crm-teams": 1, users: 4, "central-leads": 2, "crm-activities": 8 });
  assert.deepEqual(await snapshotDemo(), demoBefore, "existing local demo IDs and counts remain unchanged");
  manifest.checks.demoIntegrity = "PASS";
  manifest.status = "verified";
  manifest.verifiedAt = new Date().toISOString();
  saveManifest();
  console.log(JSON.stringify({ status: "PASS", target: manifest.target, checks: manifest.checks,
    counts: await countQa(db), demoCounts: Object.fromEntries(Object.entries(demoBefore).map(([key, item]) => [key, item.count])),
    evidence: manifestPath, protection: "0600; no credentials printed" }, null, 2));
} catch (error) {
  manifest.status = "partial-failure";
  manifest.failedOperation = operation;
  manifest.errorClass = error?.constructor?.name || "UnknownError";
  manifest.mongoCode = Number.isInteger(error?.code) ? error.code : null;
  try { if (existsSync(manifestPath)) saveManifest(); } catch { /* Retain prior evidence. */ }
  console.error(JSON.stringify({ status: "FAIL", operation, errorClass: manifest.errorClass, mongoCode: manifest.mongoCode,
    message: "Stopped without retry, deletion, or cleanup; protected evidence retained" }));
  process.exitCode = 1;
} finally {
  if (payload) await payload.destroy();
  await client.close();
}
