import { randomBytes, randomUUID } from "node:crypto";
import { closeSync, existsSync, fstatSync, openSync, renameSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";

import { assertLocalDemoUri, assertNoInheritedServices, LOCAL_DEMO, LOCAL_DEMO_URI, safeMongoFailure, verifyEmptyLocalDemoDatabase, verifyLocalDemoServer, verifyProtectedFailureManifest } from "../lib/noida-local-demo-target.mjs";

const APPROVAL = "APPROVE LOCAL CRM FIXTURE RETRY";
const execute = process.argv.includes("--execute");
const approvalArg = process.argv.find((arg) => arg.startsWith("--approval="));
if (process.argv.slice(2).some((arg) => !["--execute"].includes(arg) && !arg.startsWith("--approval="))) throw new Error("Unsupported argument");
if (execute && approvalArg !== `--approval=${APPROVAL}`) throw new Error("Exact local fixture owner approval flag is required");
if (!execute && approvalArg) throw new Error("Approval flag is only valid with --execute");

const writeTargets = ["crm-offices: 1", "users: 12", "crm-teams: 1", "central-leads: 30", "crm-activities: 60", "crm-assignment-counters: 1", "Payload initialization: indexes and empty support collections in this database only"];
if (!execute) {
  console.log(JSON.stringify({ mode: "offline-dry-run", host: LOCAL_DEMO.host, port: LOCAL_DEMO.port, replicaSet: LOCAL_DEMO.replicaSet, database: LOCAL_DEMO.database, precondition: "exact previously initialized collection inventory, all documents absent, protected failed-run manifest", writeTargets, cleanup: "none; future cleanup must match only saved run IDs", integrations: "disabled" }, null, 2));
  process.exit(0);
}

assertNoInheritedServices(process.env);
assertLocalDemoUri(LOCAL_DEMO_URI);

const client = new mongoose.mongo.MongoClient(LOCAL_DEMO_URI, { serverSelectionTimeoutMS: 5000 });
let payload;
let manifestPath;
let stage = "preflight";
let operation = "read-only preflight";
let sensitiveValues = [];
const runMarker = `noida-local-${randomUUID()}`;
const manifest = {
  schema: 1,
  runMarker,
  target: { host: LOCAL_DEMO.host, port: LOCAL_DEMO.port, replicaSet: LOCAL_DEMO.replicaSet, database: LOCAL_DEMO.database },
  status: "initializing",
  ids: { office: null, admin: null, leader: null, salespeople: [], team: null, leads: [], activities: [], counter: null },
  expected: { offices: 1, users: 12, teams: 1, leads: 30, activities: 60, counters: 1 },
  createdAt: new Date().toISOString(),
};

function saveManifest() {
  const next = `${manifestPath}.next`;
  writeFileSync(next, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  renameSync(next, manifestPath);
  if ((statSync(manifestPath).mode & 0o777) !== 0o600) throw new Error("Protected run manifest has wrong permissions");
}

function id(value) { return String(value?.id ?? value); }

try {
  await client.connect();
  const server = await verifyLocalDemoServer(client, { requireEmpty: false });
  verifyProtectedFailureManifest();
  await verifyEmptyLocalDemoDatabase(client);
  const db = client.db(LOCAL_DEMO.database);

  const secretPath = resolve(LOCAL_DEMO.directory, `crm-${runMarker}.secrets.json`);
  manifestPath = resolve(LOCAL_DEMO.directory, `crm-${runMarker}.manifest.json`);
  if (existsSync(secretPath) || existsSync(manifestPath)) throw new Error("Run evidence already exists");
  const secrets = { payloadSecret: randomBytes(48).toString("base64url"), accountPassword: randomBytes(32).toString("base64url") };
  sensitiveValues = [secrets.payloadSecret, secrets.accountPassword];
  const secretFd = openSync(secretPath, "wx", 0o600);
  try {
    writeFileSync(secretFd, `${JSON.stringify(secrets)}\n`);
    if ((fstatSync(secretFd).mode & 0o777) !== 0o600) throw new Error("Protected local credentials have wrong permissions");
  } finally { closeSync(secretFd); }
  manifest.secretFile = secretPath;
  manifest.server = server;
  saveManifest();

  process.env.MONGODB_URI = LOCAL_DEMO_URI;
  process.env.PAYLOAD_SECRET = secrets.payloadSecret;
  process.env.NEXT_TELEMETRY_DISABLED = "1";

  stage = "payload initialization";
  operation = "initialize minimal local Payload schema";
  const { getPayload } = await import("payload");
  const { buildLocalDemoPayloadConfig } = await import("../lib/noida-local-demo-payload-config.ts");
  const { resolveNoidaStagingMongoUri } = await import("../lib/noida-staging-runtime.ts");
  if (resolveNoidaStagingMongoUri(process.env) !== LOCAL_DEMO_URI) throw new Error("Payload database configuration is not the local target");
  const config = await buildLocalDemoPayloadConfig(LOCAL_DEMO_URI, secrets.payloadSecret);
  payload = await getPayload({ config });
  await verifyLocalDemoServer(client, { requireEmpty: false });
  await verifyEmptyLocalDemoDatabase(client, { requireOfficeIndexes: true });

  stage = "fixture account creation";
  operation = "create crm-offices office";
  const { buildNoidaStagingFixture } = await import("../lib/crm/staging-fixture.ts");
  const fixture = buildNoidaStagingFixture(runMarker);
  const office = await payload.create({ collection: "crm-offices", overrideAccess: true, data: fixture.office });
  manifest.ids.office = id(office);
  saveManifest();
  operation = "verify first crm-offices office and indexes";
  const officeRecord = await db.collection("crm-offices").findOne({ _id: new mongoose.Types.ObjectId(manifest.ids.office) });
  const officeIndexes = await db.collection("crm-offices").listIndexes().toArray();
  if (!officeRecord || officeRecord.name !== "Noida" || officeRecord.code !== "noida" || officeRecord.active !== true ||
    await db.collection("crm-offices").countDocuments({}) !== 1 ||
    ["name", "code"].some((field) => !officeIndexes.some((index) => index.unique === true && Object.keys(index.key ?? {}).length === 1 && index.key[field] === 1))) {
    throw new Error("First local CRM office or its required unique indexes failed verification");
  }

  operation = "create users admin";
  const admin = await payload.create({ collection: "users", overrideAccess: true, data: { ...fixture.superAdmin, password: secrets.accountPassword, office: office.id, eligibleForAssignment: false } });
  manifest.ids.admin = id(admin);
  saveManifest();
  const leaderSpec = fixture.roster.find((row) => row.role === "team-leader");
  operation = "create users team leader";
  const leader = await payload.create({ collection: "users", overrideAccess: true, data: { email: leaderSpec.officialEmail, name: leaderSpec.fullName, role: leaderSpec.role, active: true, office: office.id, eligibleForAssignment: false, password: secrets.accountPassword } });
  manifest.ids.leader = id(leader);
  saveManifest();
  const salespeople = [];
  for (const row of fixture.roster.filter((item) => item.role === "salesperson")) {
    operation = `create users salesperson ${row.assignmentOrder}`;
    const user = await payload.create({ collection: "users", overrideAccess: true, data: { email: row.officialEmail, name: row.fullName, role: row.role, active: true, office: office.id, eligibleForAssignment: true, rotationOrder: row.assignmentOrder, password: secrets.accountPassword } });
    salespeople.push(user);
    manifest.ids.salespeople.push(id(user));
    saveManifest();
  }
  operation = "create crm-teams team";
  const team = await payload.create({ collection: "crm-teams", overrideAccess: true, data: { name: fixture.team.name, office: office.id, teamLeader: leader.id, salespeople: salespeople.map((user) => user.id), active: true } });
  manifest.ids.team = id(team);
  saveManifest();
  for (const user of [leader, ...salespeople]) {
    operation = "update new staff team relationship";
    await payload.update({ collection: "users", id: user.id, overrideAccess: true, data: { team: team.id } });
  }

  stage = "synthetic lead creation";
  await mongoose.connect(LOCAL_DEMO_URI, { serverSelectionTimeoutMS: 5000 });
  if (mongoose.connection.db?.databaseName !== LOCAL_DEMO.database || mongoose.connection.host !== LOCAL_DEMO.host || mongoose.connection.port !== LOCAL_DEMO.port) throw new Error("CRM lead connection is not the local target");
  const { ingestCentralLead } = await import("../lib/crm/ingest.ts");
  for (let index = 0; index < 30; index++) {
    operation = `ingest synthetic central lead ${index + 1}`;
    const template = fixture.leads[index % fixture.leads.length];
    const number = String(index + 1).padStart(2, "0");
    const result = await ingestCentralLead({
      name: `Synthetic Noida Lead ${number}`,
      email: `${runMarker}.lead${number}@example.invalid`,
      phone: `+91990000${String(index + 1).padStart(4, "0")}`,
      website: template.website,
      leadType: template.leadType,
      source: template.source,
      project: "Synthetic Noida project",
      message: "Synthetic TEST fixture; no real customer data.",
      page: "/crm-integration-test",
      consent: true,
      idempotencyKey: randomUUID(),
    });
    if (result.duplicate || !result.assigned) throw new Error("Synthetic lead was not uniquely assigned");
    manifest.ids.leads.push(result.id);
    saveManifest();
  }

  stage = "read-only verification";
  const officeId = new mongoose.Types.ObjectId(manifest.ids.office);
  const teamId = new mongoose.Types.ObjectId(manifest.ids.team);
  const users = await db.collection("users").find({ office: officeId }).toArray();
  const teams = await db.collection("crm-teams").find({ office: officeId }).toArray();
  const leads = await db.collection("central-leads").find({ office: officeId }).sort({ assignmentSequence: 1 }).toArray();
  const activities = await db.collection("crm-activities").find({ lead: { $in: leads.map((lead) => lead._id) } }).toArray();
  const counters = await db.collection("crm-assignment-counters").find({ office: officeId }).toArray();
  const salesIds = manifest.ids.salespeople;
  const relationMatches = users.length === 12 && users.every((user) => user.email.endsWith("@example.invalid") && String(user.office) === manifest.ids.office)
    && users.filter((user) => user.role === "super-admin").length === 1
    && users.filter((user) => user.role === "team-leader").length === 1
    && users.filter((user) => user.role === "salesperson").length === 10
    && users.filter((user) => user.role !== "super-admin").every((user) => String(user.team) === manifest.ids.team)
    && teams.length === 1 && String(teams[0].teamLeader) === manifest.ids.leader && teams[0].salespeople.length === 10
    && salesIds.every((saleId, index) => users.some((user) => String(user._id) === saleId && user.rotationOrder === index + 1 && user.eligibleForAssignment === true))
    && String(teams[0]._id) === String(teamId);
  const leadMatches = leads.length === 30 && leads.every((lead, index) => lead.assignmentSequence === index + 1
    && String(lead.assignedSalesperson) === salesIds[index % 10]
    && String(lead.team) === manifest.ids.team
    && lead.email.endsWith("@example.invalid")
    && lead.page === "/crm-integration-test");
  if (!relationMatches || !leadMatches || activities.length !== 60 || counters.length !== 1 || counters[0].sequence !== 30) throw new Error("Fixture count, relationship, or round-robin verification failed");
  manifest.ids.activities = activities.map((item) => String(item._id));
  manifest.ids.counter = String(counters[0]._id);
  manifest.status = "verified";
  manifest.verifiedAt = new Date().toISOString();
  saveManifest();
  console.log(JSON.stringify({ status: "PASS", runMarker, target: manifest.target, counts: { offices: 1, users: users.length, teams: teams.length, leads: leads.length, activities: activities.length, counters: counters.length }, roundRobin: "three complete 1–10 cycles verified", manifestPath, secretPath, protection: "directory 0700; manifest and secret 0600; no secrets printed" }, null, 2));
} catch (error) {
  const diagnostic = safeMongoFailure(error, operation, sensitiveValues);
  if (manifestPath && existsSync(manifestPath)) {
    manifest.status = "partial-failure";
    manifest.failedStage = stage;
    manifest.diagnostic = diagnostic;
    try { saveManifest(); } catch { /* Preserve existing evidence if update fails. */ }
  }
  const publicDiagnostic = { ...diagnostic };
  delete publicDiagnostic.detail;
  console.error(JSON.stringify({ status: "FAIL", stage, runMarker, manifestPath: manifestPath ?? null, diagnostic: publicDiagnostic, message: "Stopped without retry or cleanup; inspect protected manifest and local logs" }));
  process.exitCode = 1;
} finally {
  if (payload) await payload.destroy();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  await client.close();
}
