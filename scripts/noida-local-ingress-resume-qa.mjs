import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BSON, MongoClient, ObjectId } from "mongodb";

import { assertNoInheritedServices, safeMongoFailure, verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";
import { buildLocalIngressQAConfig, INGRESS_MONGO_COLLECTIONS } from "../lib/noida-local-ingress-qa-config.mjs";
import { buildCrmReport } from "../lib/crm/report-core.ts";
import { centralLeadLegacyLinkExpected, chatbotSyntheticName, sanitizedIngressHTTPDiagnostic, validateNoidaIngressResumeManifest } from "../lib/noida-local-ingress-resume.mjs";

const TARGET = Object.freeze({ host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: "noida-crm-ingress-qa-20261021" });
const URI = `mongodb://${TARGET.host}:${TARGET.port}/${TARGET.database}?replicaSet=${TARGET.replicaSet}&directConnection=true`;
const APPROVAL = "APPROVE LOCAL INGRESS QA RESUME — 25 REMAINING SUBMISSIONS";
const PRIOR_RUN = "noida-ingress-b747931f-af85-429e-8f22-07fdb1cf4ec3";
const EVIDENCE_DIR = resolve(process.cwd(), ".artifacts/noida-local-ingress-qa-20261021");
const PRIOR_MANIFEST = resolve(EVIDENCE_DIR, `${PRIOR_RUN}.manifest.json`);
const SCHEMA_MANIFEST = resolve(EVIDENCE_DIR, "noida-ingress-schema-5ec73142-e0fe-4fa6-b5f8-8ee2a85c7599.manifest.json");
const RUN_MARKER = `noida-ingress-${PRIOR_RUN.slice("noida-ingress-".length)}`;
const COUNTER_KEY = "noida-shared-lead-round-robin";
const LEGACY_COLLECTIONS = ["omana-enquiries", "omana-contact-messages", "omana-google-ads-enquiries", "estate1-enquiries", "estate1-contact-messages", "estate2-enquiries", "estate2-contact-messages", "dholera-estates-enquiries", "dholera-estates-contact-messages", "industrial-enquiries", "industrial-contact-messages"];
const TRACKED = ["users", "crm-offices", "crm-teams", "central-leads", "crm-assignment-counters", "crm-activities", ...LEGACY_COLLECTIONS];
const ROUTE_ENV = { omana: "OMANA_INGEST_SECRET", estate1: "ESTATE1_INGEST_SECRET", estate2: "ESTATE2_INGEST_SECRET", dholeraEstates: "DHOLERA_ESTATES_INGEST_SECRET", industrial: "INDUSTRIAL_INGEST_SECRET" };
const FORMS = [
  { route: "omana", form: "omana-enquiry-global", legacy: "omana-enquiries", kind: "omana-enquiry", source: "omana-global-drawer" },
  { route: "omana", form: "omana-enquiry-project", legacy: "omana-enquiries", kind: "omana-enquiry", source: "omana-project-page" },
  { route: "omana", form: "omana-enquiry-website", legacy: "omana-enquiries", kind: "omana-enquiry", source: "omana-website" },
  { route: "omana", form: "omana-contact", legacy: "omana-contact-messages", kind: "omana-contact", source: "omana-contact-page" },
  { route: "omana", form: "omana-google-ads", legacy: "omana-google-ads-enquiries", kind: "omana-google", source: "google-ads-dholeraplots" },
  { route: "omana", form: "ask-omana-chatbot", legacy: "omana-enquiries", kind: "chatbot", source: "ai-chatbot" },
  { route: "estate1", form: "estate1-popup", legacy: "estate1-enquiries", kind: "estate1-enquiry", source: "estate1-popup-form" },
  { route: "estate1", form: "estate1-sidebar", legacy: "estate1-enquiries", kind: "estate1-enquiry", source: "estate1-side-enquiry-form" },
  { route: "estate1", form: "estate1-contact", legacy: "estate1-contact-messages", kind: "estate1-contact", source: "estate1-contact-us-page" },
  { route: "estate2", form: "estate2-popup", legacy: "estate2-enquiries", kind: "estate2-enquiry", source: "estate2-popup-form" },
  { route: "estate2", form: "estate2-sidebar", legacy: "estate2-enquiries", kind: "estate2-enquiry", source: "estate2-side-enquiry-form" },
  { route: "estate2", form: "estate2-contact", legacy: "estate2-contact-messages", kind: "estate2-contact", source: "estate2-contact-us-page" },
  { route: "dholeraEstates", form: "dholera-estates-popup", legacy: "dholera-estates-enquiries", kind: "dholera-enquiry", source: "dholeraestates-popup-form" },
  { route: "dholeraEstates", form: "dholera-estates-sidebar", legacy: "dholera-estates-enquiries", kind: "dholera-enquiry", source: "dholeraestates-side-enquiry-form" },
  { route: "dholeraEstates", form: "dholera-estates-website", legacy: "dholera-estates-enquiries", kind: "dholera-enquiry", source: "dholeraestates-website" },
  { route: "dholeraEstates", form: "dholera-estates-contact", legacy: "dholera-estates-contact-messages", kind: "dholera-contact", source: "dholeraestates-contact-us-page" },
  { route: "industrial", form: "industrial-popup", legacy: "industrial-enquiries", kind: "industrial-enquiry", source: "industrial-popup-form" },
  { route: "industrial", form: "industrial-sidebar", legacy: "industrial-enquiries", kind: "industrial-enquiry", source: "industrial-side-enquiry-form" },
  { route: "industrial", form: "industrial-property-card", legacy: "industrial-enquiries", kind: "industrial-enquiry", source: "industrial-property-card" },
  { route: "industrial", form: "industrial-website", legacy: "industrial-enquiries", kind: "industrial-enquiry", source: "industrial-website" },
  { route: "industrial", form: "industrial-contact", legacy: "industrial-contact-messages", kind: "industrial-contact", source: "industrial-contact-us-page" },
];
function plan() {
  const rows = [...FORMS];
  for (let i = 0; i < 3; i += 1) rows.push({ ...FORMS[6], form: `estate1-popup-cycle-${i + 2}` });
  for (let i = 0; i < 3; i += 1) rows.push({ ...FORMS[9], form: `estate2-popup-cycle-${i + 2}` });
  for (let i = 0; i < 2; i += 1) rows.push({ ...FORMS[12], form: `dholera-estates-popup-cycle-${i + 2}` });
  rows.push({ ...FORMS[16], form: "industrial-popup-cycle-2" });
  assert.equal(rows.length, 30);
  return rows;
}
const args = process.argv.slice(2);
const PREFLIGHT = args.length === 1 && args[0] === "--preflight";
const EXECUTE = args.length === 2 && args.includes("--execute") && args.includes(`--approval=${APPROVAL}`);
if (!PREFLIGHT && !EXECUTE) throw new Error("Use --preflight or the exact separate resume approval and --execute flags.");
assertNoInheritedServices(process.env);
const envKeys = Object.keys(process.env);
assert.ok(!envKeys.some((key) => /(?:MONGO|DATABASE|ATLAS|PROD|PRODUCTION|PAYLOAD_|BLOB_|SMTP|EMAIL|OPENAI|QDRANT|WHATSAPP|TWILIO|VERCEL|NOIDA_STAGING|INGEST_SECRET|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY)/i.test(key)));
assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED, "0");
assert.equal(new URL(URI).hostname, TARGET.host);
assert.equal(Number(new URL(URI).port), TARGET.port);
assert.equal(new URL(URI).pathname, `/${TARGET.database}`);
assert.equal(new URL(URI).username, "");
assert.equal(new URL(URI).password, "");

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
let payload;
let mongoose;
let resumeManifest;
let lastHTTPDiagnostic;
let operation = "read-only resume preflight";
let preflightStage = operation;
const resumeManifestPath = resolve(EVIDENCE_DIR, `${PRIOR_RUN}-resume-${randomUUID()}.manifest.json`);
const originalLog = console.log;
const originalError = console.error;

function ensureProtectedDir() {
  const artifacts = resolve(process.cwd(), ".artifacts");
  assert.ok(existsSync(artifacts) && realpathSync(artifacts) === artifacts && statSync(artifacts).isDirectory());
  const info = lstatSync(EVIDENCE_DIR);
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && (info.mode & 0o777) === 0o700);
  assert.equal(realpathSync(EVIDENCE_DIR), EVIDENCE_DIR);
}
function readProtectedManifest(path) {
  const info = lstatSync(path);
  assert.ok(info.isFile() && !info.isSymbolicLink() && (info.mode & 0o777) === 0o600);
  assert.equal(realpathSync(path), path);
  return JSON.parse(readFileSync(path, "utf8"));
}
function saveResumeManifest() {
  const text = `${JSON.stringify(resumeManifest, null, 2)}\n`;
  if (!existsSync(resumeManifestPath)) writeFileSync(resumeManifestPath, text, { flag: "wx", mode: 0o600 });
  else {
    const next = `${resumeManifestPath}.next`;
    writeFileSync(next, text, { flag: "wx", mode: 0o600 });
    renameSync(next, resumeManifestPath);
  }
  const info = lstatSync(resumeManifestPath);
  assert.ok(info.isFile() && !info.isSymbolicLink() && (info.mode & 0o777) === 0o600);
}
async function snapshot(database, collections) {
  const result = {};
  for (const name of collections) {
    const docs = await client.db(database).collection(name).find({}).sort({ _id: 1 }).toArray();
    const hash = createHash("sha256");
    for (const doc of docs) hash.update(BSON.serialize(doc));
    result[name] = { count: docs.length, digest: hash.digest("hex") };
  }
  return result;
}
async function counts(db, names) {
  const result = {};
  for (const name of names) result[name] = await db.collection(name).countDocuments({});
  return result;
}
function expectedWebsite(route) { return ({ omana: "omana-projects", estate1: "dholera-estate-1", estate2: "dholera-estate-2", dholeraEstates: "dholeraestates", industrial: "dholeraindustrial" })[route]; }
function bodyFor(form, index, key) {
  const identity = { name: `Synthetic Noida Ingress ${String(index + 1).padStart(2, "0")}`, email: `${RUN_MARKER}-lead-${String(index + 1).padStart(2, "0")}@example.invalid`, phone: `987${String(index + 1).padStart(7, "0")}` };
  if (form.kind === "chatbot") return { ...identity, name: chatbotSyntheticName(), type: "ai-chatbot-enquiry", initialIntent: "Synthetic local QA", selectedProject: "Synthetic QA Project", selectedProjectSlug: "synthetic-qa", requirement: "Synthetic ASK OMANA requirement", page: "/", source: form.source, consent: true, idempotencyKey: key };
  if (form.route === "omana") {
    const type = form.kind === "omana-google" ? "google-ads-enquiry" : form.kind === "omana-contact" ? "contact" : "enquiry";
    return { ...identity, type, selectedProject: "Synthetic QA Project", selectedProjectSlug: "synthetic-qa", message: "Synthetic local integration test", page: type === "contact" ? "/contact" : type === "google-ads-enquiry" ? "/dholeraplots" : "/", source: form.source, consent: true, ...(type === "google-ads-enquiry" ? { utmSource: "offline-qa", utmMedium: "test", utmCampaign: RUN_MARKER } : {}) };
  }
  const contact = form.kind.endsWith("contact");
  if (form.route === "estate1") return contact ? { ...identity, type: "contact", budget: "20-50-lakhs", comments: "Synthetic local integration test", source: form.source, consent: true } : { ...identity, type: "enquiry", message: "Synthetic local integration test", source: form.source, consent: true };
  if (form.route === "estate2") return contact ? { ...identity, type: "contact", propertyType: "dholera-estate-2", budget: "20-50-lakhs", comments: "Synthetic local integration test", source: form.source, consent: true } : { ...identity, type: "enquiry", property: "Synthetic QA Property", message: "Synthetic local integration test", source: form.source, consent: true };
  if (form.route === "dholeraEstates") return contact ? { ...identity, type: "contact", propertyType: "dholera-estates", budget: "20-50-lakhs", comments: "Synthetic local integration test", source: form.source, consent: true } : { ...identity, type: "enquiry", property: "Synthetic QA Property", message: "Synthetic local integration test", source: form.source, consent: true };
  return contact ? { ...identity, type: "contact", propertyType: "industrial-plot", budget: "25-50-lakhs", comments: "Synthetic local integration test", source: form.source, consent: true } : { ...identity, type: "enquiry", property: "Synthetic QA Property", message: "Synthetic local integration test", source: form.source, consent: true };
}
function projectFor(form, body) {
  if (form.route === "omana") return body.selectedProject;
  if (form.route === "estate1") return "Dholera Estate 1";
  if (form.kind === "estate2-contact") return "dholera-estate-2";
  if (form.kind === "dholera-contact") return "dholera-estates";
  if (form.kind === "industrial-contact") return "industrial-plot";
  return body.property;
}
function leadTypeFor(form, body) { return form.kind === "chatbot" ? "chatbot" : form.kind === "omana-google" ? "google-ads" : body.type; }
function requestFor(route, body, key) {
  const secret = process.env[ROUTE_ENV[route]];
  const routePath = { omana: "/api/omana-leads", estate1: "/api/estate1-leads", estate2: "/api/estate2-leads", dholeraEstates: "/api/dholera-estates-leads", industrial: "/api/industrial-leads" }[route];
  return new Request(`http://127.0.0.1${routePath}`, { method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json", "x-idempotency-key": key }, body: JSON.stringify(body) });
}
async function routeHandler(route) {
  const file = { omana: "../app/api/omana-leads/route.ts", estate1: "../app/api/estate1-leads/route.ts", estate2: "../app/api/estate2-leads/route.ts", dholeraEstates: "../app/api/dholera-estates-leads/route.ts", industrial: "../app/api/industrial-leads/route.ts" }[route];
  return (await import(file)).POST;
}
async function verifiedPreflight() {
  preflightStage = "verify protected evidence and partial-manifest resume gate";
  ensureProtectedDir();
  const partial = readProtectedManifest(PRIOR_MANIFEST);
  const gate = validateNoidaIngressResumeManifest(partial, { target: TARGET, runMarker: RUN_MARKER });
  const schemaManifest = readProtectedManifest(SCHEMA_MANIFEST);
  assert.equal(schemaManifest.status, "verified-schema-only");
  assert.deepEqual(schemaManifest.target, TARGET);
  assert.equal(schemaManifest.after.payloadSchemaIndexes, 53);
  assert.equal(schemaManifest.after.totalIndexesIncludingId, 69);

  preflightStage = "verify exact local MongoDB process and replica-set identity";
  await client.connect();
  const server = await verifyLocalDemoServer(client, { requireEmpty: false });
  const hello = await client.db("admin").command({ hello: 1 });
  assert.equal(hello.me, `${TARGET.host}:${TARGET.port}`);
  assert.equal(hello.setName, TARGET.replicaSet);
  assert.deepEqual(hello.hosts, [`${TARGET.host}:${TARGET.port}`]);
  preflightStage = "verify exact collection inventory and approved partial document counts";
  const db = client.db(TARGET.database);
  const expectedNames = [...new Set([...INGRESS_MONGO_COLLECTIONS, "crm-activities", "crm-assignment-counters"])].sort();
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name).sort();
  assert.deepEqual(names, expectedNames, "only approved Payload schemas and CRM activity/counter collections may exist");
  const currentCounts = await counts(db, names);
  assert.deepEqual(Object.fromEntries(Object.entries(currentCounts).filter(([name]) => name !== "omana-salespeoples")), gate.expectedCurrentCounts);
  assert.equal(currentCounts["omana-salespeoples"], 0);

  preflightStage = "verify all 53 schema indexes, 69 physical indexes, and six unique indexes";
  let customIndexes = 0;
  let physicalIndexes = 0;
  for (const name of INGRESS_MONGO_COLLECTIONS) {
    const indexes = await db.collection(name).listIndexes().toArray();
    physicalIndexes += indexes.length;
    customIndexes += indexes.filter(({ key }) => !(Object.keys(key).length === 1 && key._id === 1)).length;
  }
  assert.equal(customIndexes, 53);
  assert.equal(physicalIndexes, 69);
  for (const [collection, field] of [["users", "email"], ["crm-offices", "name"], ["crm-offices", "code"], ["crm-teams", "office"], ["crm-teams", "teamLeader"], ["central-leads", "idempotencyKey"]]) {
    const indexes = await db.collection(collection).listIndexes().toArray();
    assert.ok(indexes.some((index) => index.unique === true && Object.keys(index.key).length === 1 && index.key[field] === 1));
  }

  preflightStage = "verify preserved office, team, and all twelve account relationships";
  const office = await db.collection("crm-offices").findOne({ _id: new ObjectId(partial.ids.office) });
  const team = await db.collection("crm-teams").findOne({ _id: new ObjectId(partial.ids.team) });
  assert.ok(office && team);
  assert.equal(office.code, "noida");
  assert.equal(String(team.office), String(office._id));
  assert.equal(String(team.teamLeader), partial.ids.users[1]);
  assert.deepEqual(team.salespeople.map(String).sort(), partial.ids.users.slice(2).sort());
  const usersById = new Map((await db.collection("users").find({ _id: { $in: partial.ids.users.map((value) => new ObjectId(value)) } }).project({ name: 1, email: 1, role: 1, office: 1, team: 1, active: 1, eligibleForAssignment: 1, rotationOrder: 1 }).toArray()).map((user) => [String(user._id), user]));
  assert.equal(usersById.size, 12);
  for (const [index, userId] of partial.ids.users.entries()) {
    const user = usersById.get(userId);
    assert.ok(user);
    assert.equal(String(user.office), String(office._id));
    assert.equal(user.role, index === 0 ? "super-admin" : index === 1 ? "team-leader" : "salesperson");
    if (index > 0) assert.equal(String(user.team), String(team._id));
    if (index > 1) assert.equal(user.rotationOrder, index - 1);
  }

  preflightStage = "verify five preserved leads, legacy mappings, and first assignments";
  const rows = partial.pending.slice(0, 5);
  const central = await db.collection("central-leads").find({ _id: { $in: rows.map((row) => new ObjectId(row.centralId)) } }).sort({ assignmentSequence: 1 }).toArray();
  assert.equal(central.length, 5);
  for (const [index, row] of rows.entries()) {
    const lead = central[index];
    assert.equal(String(lead._id), row.centralId);
    assert.equal(lead.assignmentSequence, index + 1);
    assert.equal(String(lead.assignedSalesperson), partial.ids.users[index + 2]);
    assert.equal(lead.idempotencyKey, row.idempotencyKey);
    assert.equal(lead.email, row.email);
    assert.equal(lead.source, row.source);
    assert.equal(lead.website, row.website);
    assert.equal(lead.project, row.project);
    assert.equal(lead.consent, true);
    if (centralLeadLegacyLinkExpected(row.route)) {
      assert.equal(String(lead.legacyId), row.legacyId);
      assert.equal(lead.legacyCollection, row.legacyCollection);
    } else {
      assert.equal(lead.legacyId ?? null, null);
      assert.equal(lead.legacyCollection ?? null, null);
    }
    const legacy = await db.collection(row.legacyCollection).findOne({ _id: new ObjectId(row.legacyId) });
    assert.ok(legacy);
    assert.equal(legacy.email, row.email);
    assert.equal(legacy.name, row.name);
    assert.equal(legacy.phone, row.phone);
    assert.equal(legacy.source, row.source);
  }
  preflightStage = "verify preserved activity history and assignment counter";
  const activities = await db.collection("crm-activities").find({ _id: { $in: partial.ids.activities.map((value) => new ObjectId(value)) } }).toArray();
  assert.equal(activities.length, 10);
  assert.deepEqual(activities.reduce((acc, item) => { acc[item.event] = (acc[item.event] ?? 0) + 1; return acc; }, {}), { created: 5, assigned: 5 });
  const counter = await db.collection("crm-assignment-counters").findOne({ key: COUNTER_KEY, office: office._id });
  assert.ok(counter);
  assert.equal(counter.sequence, 5);
  preflightStage = "verify demo and workflow QA databases remain unchanged";
  const beforeSnapshots = {};
  for (const [key, watched] of Object.entries({ demo: { database: "noida-crm-demo-20261019", names: ["users", "central-leads", "crm-activities", "crm-assignment-counters"] }, workflowQA: { database: "noida-crm-workflow-qa-20261019", names: ["users", "crm-offices", "crm-teams", "central-leads", "crm-activities", "payload-preferences"] } })) {
    beforeSnapshots[key] = await snapshot(watched.database, watched.names);
    assert.deepEqual(beforeSnapshots[key], partial.beforeSnapshots[key]);
  }
  return { partial, server, names, currentCounts, customIndexes, physicalIndexes, beforeSnapshots, gate, users: partial.ids.users.map((userId) => {
    const user = usersById.get(userId);
    return { id: String(user._id), name: user.name, email: user.email, role: user.role, office: String(user.office), team: user.team ? String(user.team) : undefined, eligibleForAssignment: user.eligibleForAssignment, rotationOrder: user.rotationOrder };
  }), office: { ...office, id: String(office._id) }, team: { ...team, id: String(team._id) }, rows };
}

async function runResume(preflight) {
  resumeManifest = {
    schema: 1, status: "resume-preflight-passed", runMarker: RUN_MARKER, target: TARGET,
    approvalRequired: APPROVAL, priorManifest: PRIOR_MANIFEST,
    ids: structuredClone(preflight.partial.ids), pending: structuredClone(preflight.partial.pending),
    checks: structuredClone(preflight.partial.checks), beforeSnapshots: preflight.beforeSnapshots,
    expected: preflight.partial.expected, resumedSubmissionIndices: [],
    preflight: { status: "PASS", currentCounts: preflight.currentCounts, payloadSchemaIndexes: 53, totalIndexesIncludingId: 69, existingLeadsVerified: 5 },
  };
  resumeManifest.ids.assignmentCounter = String((await client.db(TARGET.database).collection("crm-assignment-counters").findOne({ key: COUNTER_KEY }))._id);
  saveResumeManifest();

  process.env.NODE_ENV = "test";
  process.env.PAYLOAD_DISABLE_DEPENDENCY_CHECKER = "true";
  process.env.MONGODB_URI = URI;
  process.env.PAYLOAD_SECRET = randomBytes(48).toString("base64url");
  process.env.__NEXT_PROCESSED_ENV = "true";
  process.env.NEXT_TELEMETRY_DISABLED = "1";
  for (const name of Object.values(ROUTE_ENV)) process.env[name] = `local-mock-${randomBytes(32).toString("hex")}`;
  const [{ getPayload }, { mongooseAdapter }, configModule, mongooseModule, connectModule] = await Promise.all([import("payload"), import("@payloadcms/db-mongodb"), import("../payload.config.ts"), import("mongoose"), import("../lib/mongodb.ts")]);
  mongoose = mongooseModule.default;
  const sourceConfig = await configModule.default;
  const config = buildLocalIngressQAConfig({ sourceConfig, uri: URI, mongooseAdapter });
  payload = await getPayload({ config });
  assert.equal(payload.db.ensureIndexes, true);
  assert.equal(payload.db.connectOptions.autoIndex, false);
  assert.equal(payload.db.connection?.db?.databaseName, TARGET.database);
  const payloadHello = await payload.db.connection.getClient().db("admin").command({ hello: 1 });
  assert.equal(payloadHello.me, `${TARGET.host}:${TARGET.port}`);
  assert.equal(payloadHello.setName, TARGET.replicaSet);
  const ingressConnect = connectModule.default;
  await ingressConnect();
  assert.equal(mongoose.connection.host, TARGET.host);
  assert.equal(mongoose.connection.port, TARGET.port);
  assert.equal(mongoose.connection.db?.databaseName, TARGET.database);
  const ingressHello = await mongoose.connection.getClient().db("admin").command({ hello: 1 });
  assert.equal(ingressHello.me, `${TARGET.host}:${TARGET.port}`);
  assert.equal(ingressHello.setName, TARGET.replicaSet);
  const db = client.db(TARGET.database);
  const handlers = Object.fromEntries(await Promise.all(Object.keys(ROUTE_ENV).map(async (route) => [route, await routeHandler(route)])));
  const rows = preflight.rows.map((row) => ({ ...row }));
  const assignedUsers = preflight.users.slice(2);
  for (let index = 5; index < 30; index += 1) {
    const form = plan()[index];
    const pending = resumeManifest.pending[index];
    assert.ok(["pending", "not-started"].includes(pending.status), `resume refuses unexpected pending state at ${index}`);
    const key = pending.idempotencyKey || randomUUID();
    const body = bodyFor(form, index, key);
    resumeManifest.pending[index] = { ...pending, idempotencyKey: key, status: "pending" };
    resumeManifest.status = "resuming";
    saveResumeManifest();
    operation = `submit remaining synthetic form ${index + 1}`;
    const response = await handlers[form.route](requestFor(form.route, body, key));
    const responseBody = await response.json().catch(() => ({}));
    lastHTTPDiagnostic = sanitizedIngressHTTPDiagnostic(response, responseBody);
    resumeManifest.pending[index] = { ...resumeManifest.pending[index], httpResponse: lastHTTPDiagnostic };
    saveResumeManifest();
    assert.equal(response.status, 201, `${form.form} was accepted`);
    const central = await db.collection("central-leads").findOne({ idempotencyKey: key });
    assert.ok(central);
    const legacy = await db.collection(form.legacy).findOne({ email: body.email, source: form.source });
    assert.ok(legacy);
    const activityRows = await db.collection("crm-activities").find({ lead: central._id }).toArray();
    assert.equal(activityRows.length, 2);
    const row = {
      form: form.form, route: form.route, source: form.source, legacy: form.legacy, legacyCollection: form.legacy,
      name: body.name, email: body.email, phone: form.kind === "chatbot" ? `+91${body.phone.replace(/\D/g, "")}` : body.phone,
      website: expectedWebsite(form.route), project: projectFor(form, body), leadType: leadTypeFor(form, body),
      idempotencyKey: key, centralId: String(central._id), legacyId: String(legacy._id), activityIds: activityRows.map((item) => String(item._id)),
      assignmentSequence: central.assignmentSequence, assignedSalespersonId: String(central.assignedSalesperson),
    };
    assert.equal(central.assignmentSequence, index + 1);
    assert.equal(String(central.assignedSalesperson), String(assignedUsers[index % 10].id));
    rows.push(row);
    resumeManifest.ids.centralLeads.push(row.centralId);
    resumeManifest.ids.legacy.push({ collection: row.legacy, id: row.legacyId });
    resumeManifest.ids.activities.push(...row.activityIds);
    resumeManifest.pending[index] = { ...resumeManifest.pending[index], ...row, status: "verified" };
    resumeManifest.resumedSubmissionIndices.push(index);
    const actualCounts = {};
    for (const name of TRACKED) actualCounts[name] = await db.collection(name).countDocuments({});
    const expectedLegacy = Object.fromEntries(LEGACY_COLLECTIONS.map((name) => [name, rows.filter((item) => item.legacy === name).length]));
    const expectedCounts = { users: 12, "crm-offices": 1, "crm-teams": 1, "central-leads": index + 1, "crm-assignment-counters": 1, "crm-activities": (index + 1) * 2, ...expectedLegacy };
    assert.deepEqual(actualCounts, expectedCounts);
    resumeManifest.checks.incrementalCounts = actualCounts;
    saveResumeManifest();
  }

  operation = "verify duplicate replays for all five ingress routes without additional persistence";
  const dupes = [rows[5], rows[6], rows[9], rows[12], rows[16]];
  const before = {};
  for (const name of TRACKED) before[name] = await db.collection(name).countDocuments({});
  for (const row of dupes) {
    const form = plan()[rows.indexOf(row)];
    const body = bodyFor(form, rows.indexOf(row), row.idempotencyKey);
    const response = await handlers[row.route](requestFor(row.route, body, row.idempotencyKey));
    const result = await response.json().catch(() => ({}));
    lastHTTPDiagnostic = sanitizedIngressHTTPDiagnostic(response, result);
    assert.equal(response.status, 200);
    assert.equal(result.duplicate, true);
  }
  const after = {};
  for (const name of TRACKED) after[name] = await db.collection(name).countDocuments({});
  assert.deepEqual(after, before);
  resumeManifest.checks.duplicateReplays = { status: "PASS", attempts: 5, allIngressRoutes: true, countsUnchanged: true, assignmentSequenceUnchanged: true, routes: dupes.map((row) => row.route) };
  saveResumeManifest();

  operation = "verify final assignment, record mappings, activities, reports and role views";
  const central = await db.collection("central-leads").find({}).sort({ assignmentSequence: 1 }).toArray();
  assert.equal(central.length, 30);
  const salesCounts = new Map(assignedUsers.map((user) => [String(user.id), 0]));
  for (let index = 0; index < central.length; index += 1) {
    const lead = central[index];
    const row = rows[index];
    assert.equal(lead.assignmentSequence, index + 1);
    assert.equal(String(lead.assignedSalesperson), String(assignedUsers[index % 10].id));
    assert.equal(lead.source, row.source);
    assert.equal(lead.website, row.website);
    assert.equal(lead.project, row.project);
    assert.equal(lead.leadType, row.leadType);
    assert.equal(lead.email, row.email);
    assert.equal(lead.name, row.name);
    if (centralLeadLegacyLinkExpected(row.route)) assert.equal(String(lead.legacyId), row.legacyId);
    salesCounts.set(String(lead.assignedSalesperson), salesCounts.get(String(lead.assignedSalesperson)) + 1);
  }
  assert.deepEqual([...salesCounts.values()], Array(10).fill(3));
  assert.equal(await db.collection("crm-activities").countDocuments({}), 60);
  const finalActivities = await db.collection("crm-activities").find({}).toArray();
  assert.ok(finalActivities.every((activity) => central.some((lead) => String(lead._id) === String(activity.lead))));
  assert.deepEqual(finalActivities.reduce((acc, activity) => { acc[activity.event] = (acc[activity.event] ?? 0) + 1; return acc; }, {}), { created: 30, assigned: 30 });
  for (const row of rows) {
    const legacy = await db.collection(row.legacyCollection).findOne({ _id: new ObjectId(row.legacyId) });
    assert.ok(legacy);
    assert.equal(legacy.email, row.email);
    assert.equal(legacy.name, row.name);
    assert.equal(legacy.phone, row.phone);
    assert.equal(legacy.source, row.source);
  }
  assert.deepEqual(Object.fromEntries(Object.keys(ROUTE_ENV).map((route) => [route, rows.filter((row) => row.route === route).length])), {
    omana: 6, estate1: 6, estate2: 6, dholeraEstates: 6, industrial: 6,
  });
  const counter = await db.collection("crm-assignment-counters").findOne({ key: COUNTER_KEY });
  assert.equal(counter.sequence, 30);
  const allCounts = {};
  for (const name of TRACKED) allCounts[name] = await db.collection(name).countDocuments({});
  assert.equal(allCounts["central-leads"], 30);
  assert.equal(Object.entries(allCounts).filter(([name]) => LEGACY_COLLECTIONS.includes(name)).reduce((sum, [, count]) => sum + count, 0), 30);

  const users = preflight.users;
  const findFor = (user) => payload.find({ collection: "central-leads", depth: 0, limit: 100, pagination: false, user, overrideAccess: false });
  const [admin, leader, ...salesViews] = await Promise.all([findFor(users[0]), findFor(users[1]), ...users.slice(2).map(findFor)]);
  assert.equal(admin.totalDocs, 30);
  assert.equal(leader.totalDocs, 30);
  for (const [index, view] of salesViews.entries()) {
    assert.equal(view.totalDocs, 3);
    assert.ok(view.docs.every((lead) => String(lead.assignedSalesperson) === String(users[index + 2].id)));
  }
  const foreignLead = leader.docs.find((lead) => String(lead.assignedSalesperson) === String(users[3].id));
  assert.ok(foreignLead);
  await assert.rejects(() => payload.findByID({ collection: "central-leads", id: foreignLead.id, depth: 0, user: users[2], overrideAccess: false }));
  const nameMap = new Map(users.slice(2).map((user) => [String(user.id), user.name]));
  const reportOptions = { period: "all", kind: "salesperson", format: "json" };
  const window = { start: null, endExclusive: null, label: "All dates" };
  const report = (view) => buildCrmReport(view.docs, nameMap, reportOptions, window);
  assert.equal(report(admin).summary.total, 30);
  assert.equal(report(leader).summary.total, 30);
  assert.ok(report(admin).summary.salespeople.every(({ count }) => count === 3));
  for (const view of salesViews) assert.equal(report(view).summary.total, 3);
  resumeManifest.checks.roleScopedViews = { status: "PASS", admin: 30, teamLeader: 30, salespeople: Array(10).fill(3), crossSalespersonDenied: true };
  resumeManifest.checks.reportConsistency = { status: "PASS", admin: 30, teamLeader: 30, salespeople: Array(10).fill(3) };
  resumeManifest.checks.roundRobin = { status: "PASS", sequence: 30, cycles: 3, perSalesperson: Array(10).fill(3) };

  for (const [key, watched] of Object.entries({ demo: { database: "noida-crm-demo-20261019", names: ["users", "central-leads", "crm-activities", "crm-assignment-counters"] }, workflowQA: { database: "noida-crm-workflow-qa-20261019", names: ["users", "crm-offices", "crm-teams", "central-leads", "crm-activities", "payload-preferences"] } })) {
    assert.deepEqual(await snapshot(watched.database, watched.names), preflight.beforeSnapshots[key]);
  }
  resumeManifest.checks.otherDatabasesUnchanged = "PASS";
  resumeManifest.status = "verified-resume";
  saveResumeManifest();
  return { status: "PASS", target: TARGET, runMarker: RUN_MARKER, resumedSubmissions: 25, counts: allCounts, assignmentSequence: 30, leadsPerSalesperson: Array(10).fill(3), duplicateReplays: 5, priorConsentRejectionsPreserved: true, reportAndRoleViews: "PASS", manifest: resumeManifestPath };
}

let output;
let failure;
try {
  console.log = () => {};
  console.error = () => {};
  operation = "verify protected partial manifest, exact local target state, indexes, records and unrelated snapshots";
  const preflight = await verifiedPreflight();
  if (PREFLIGHT) {
    output = { status: "PASS", mode: "read-only preflight", target: TARGET, runMarker: RUN_MARKER, server: { pid: preflight.server.pid, version: preflight.server.version, replicaSet: preflight.server.replicaSet }, verifiedExistingCounts: preflight.currentCounts, schemaIndexes: preflight.customIndexes, totalIndexesIncludingId: preflight.physicalIndexes, preservedLeads: 5, alreadyPassedConsentAttempts: 42, alreadyPassedConcurrentDuplicate: true, remainingWriteScope: { submissions: 25, newCentralLeads: 25, newLegacyRecords: 25, newActivities: 50, finalCounterSequence: 30, noNewAccountsOfficeOrTeam: true }, otherDatabasesUnchanged: true };
  } else {
    output = await runResume(preflight);
  }
} catch (error) {
  if (resumeManifest) {
    resumeManifest.status = "partial-resume-failure";
    resumeManifest.failure = { ...safeMongoFailure(error, operation), ...(lastHTTPDiagnostic ? { httpResponse: lastHTTPDiagnostic } : {}) };
    try { saveResumeManifest(); } catch {}
  }
  const failureOperation = PREFLIGHT ? preflightStage : operation;
  failure = { status: "FAIL", operation: failureOperation, error: { ...safeMongoFailure(error, failureOperation), ...(lastHTTPDiagnostic ? { httpResponse: lastHTTPDiagnostic } : {}) }, resumeManifest: resumeManifest ? resumeManifestPath : null, cleanup: "not-performed" };
  process.exitCode = 1;
} finally {
  try { await payload?.destroy?.(); } catch {}
  try { await mongoose?.disconnect?.(); } catch {}
  try { await client.close(); } catch {}
  console.log = originalLog;
  console.error = originalError;
}
if (failure) process.stderr.write(`${JSON.stringify(failure)}\n`);
else process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
