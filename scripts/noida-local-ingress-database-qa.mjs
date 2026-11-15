import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BSON, MongoClient, ObjectId } from "mongodb";

import { assertNoInheritedServices, safeMongoFailure, verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";
import { buildLocalIngressQAConfig, INGRESS_MONGO_COLLECTIONS } from "../lib/noida-local-ingress-qa-config.mjs";
import { buildCrmReport } from "../lib/crm/report-core.ts";
import { centralLeadLegacyLinkExpected, chatbotSyntheticName, sanitizedIngressHTTPDiagnostic } from "../lib/noida-local-ingress-resume.mjs";

const TARGET = Object.freeze({ host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: "noida-crm-ingress-qa-20261021" });
const URI = `mongodb://${TARGET.host}:${TARGET.port}/${TARGET.database}?replicaSet=${TARGET.replicaSet}&directConnection=true`;
const APPROVAL = "APPROVED_LOCAL_NOIDA_INGRESS_QA_20261021";
const COUNTER_KEY = "noida-shared-lead-round-robin";
const LEGACY_COLLECTIONS = [
  "omana-enquiries", "omana-contact-messages", "omana-google-ads-enquiries",
  "estate1-enquiries", "estate1-contact-messages", "estate2-enquiries", "estate2-contact-messages",
  "dholera-estates-enquiries", "dholera-estates-contact-messages", "industrial-enquiries", "industrial-contact-messages",
];
const TRACKED_COLLECTIONS = [
  "users", "crm-offices", "crm-teams", "central-leads", "crm-assignment-counters", "crm-activities", ...LEGACY_COLLECTIONS,
];
const ROUTE_ENV = Object.freeze({
  omana: "OMANA_INGEST_SECRET",
  estate1: "ESTATE1_INGEST_SECRET",
  estate2: "ESTATE2_INGEST_SECRET",
  dholeraEstates: "DHOLERA_ESTATES_INGEST_SECRET",
  industrial: "INDUSTRIAL_INGEST_SECRET",
});
const LEGACY_FORMS = [
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

const requiredArgs = ["--execute", `--approval=${APPROVAL}`];
if (process.argv.slice(2).length !== requiredArgs.length || requiredArgs.some((arg) => !process.argv.slice(2).includes(arg))) {
  throw new Error("Guarded execution flags are required for the separately approved isolated ingress QA.");
}

const inheritedKeys = Object.keys(process.env);
if (inheritedKeys.some((key) => /(?:MONGO|DATABASE|ATLAS|PROD|PRODUCTION|PAYLOAD_|BLOB_|SMTP|EMAIL|OPENAI|QDRANT|WHATSAPP|TWILIO|VERCEL|NOIDA_STAGING|INGEST_SECRET|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY)/i.test(key)) ||
  process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  throw new Error("Inherited database, production, Atlas, proxy, or external-service configuration is present; refusing to run.");
}
assertNoInheritedServices(process.env);

const parsedURI = new URL(URI);
assert.equal(parsedURI.hostname, TARGET.host);
assert.equal(Number(parsedURI.port), TARGET.port);
assert.equal(parsedURI.pathname, `/${TARGET.database}`);
assert.equal(parsedURI.username, "");
assert.equal(parsedURI.password, "");
assert.equal(parsedURI.searchParams.get("replicaSet"), TARGET.replicaSet);
assert.equal(parsedURI.searchParams.get("directConnection"), "true");

const runMarker = `noida-ingress-${randomUUID()}`;
const evidenceDirectory = resolve(process.cwd(), ".artifacts/noida-local-ingress-qa-20261021");
const manifestPath = resolve(evidenceDirectory, `${runMarker}.manifest.json`);
const previousFailureManifestPath = resolve(evidenceDirectory, "noida-ingress-a3ec5ad6-1fd0-4cc5-af78-4f273abf93cd.manifest.json");
const schemaInitManifestPath = resolve(evidenceDirectory, "noida-ingress-schema-5ec73142-e0fe-4fa6-b5f8-8ee2a85c7599.manifest.json");
const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
let payload;
let defaultMongoose;
let operation = "read-only preflight";
let manifest;
let lastHTTPDiagnostic = null;
const originalLog = console.log;
const originalError = console.error;

function protectEvidenceDirectory() {
  const parent = resolve(process.cwd(), ".artifacts");
  if (!existsSync(parent) || realpathSync(parent) !== parent || !statSync(parent).isDirectory()) {
    throw new Error("Protected artifacts parent is missing or unsafe.");
  }
  if (!existsSync(evidenceDirectory)) mkdirSync(evidenceDirectory, { mode: 0o700 });
  const info = lstatSync(evidenceDirectory);
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && (info.mode & 0o777) === 0o700);
  assert.equal(realpathSync(evidenceDirectory), evidenceDirectory);
}

function readPreviousFailureEvidence() {
  const info = lstatSync(previousFailureManifestPath);
  assert.ok(info.isFile() && !info.isSymbolicLink() && (info.mode & 0o777) === 0o600);
  assert.equal(realpathSync(previousFailureManifestPath), previousFailureManifestPath);
  const previous = JSON.parse(readFileSync(previousFailureManifestPath, "utf8"));
  assert.equal(previous.runMarker, "noida-ingress-a3ec5ad6-1fd0-4cc5-af78-4f273abf93cd");
  assert.equal(previous.status, "partial-failure");
  assert.deepEqual(previous.target, TARGET);
  assert.equal(previous.failure?.code, 26);
  assert.equal(previous.failure?.codeName, "NamespaceNotFound");
  assert.deepEqual(previous.ids, { office: null, team: null, users: [], centralLeads: [], legacy: [], activities: [], assignmentCounter: null });
  return previous;
}

function readSchemaInitializationEvidence() {
  const info = lstatSync(schemaInitManifestPath);
  assert.ok(info.isFile() && !info.isSymbolicLink() && (info.mode & 0o777) === 0o600);
  assert.equal(realpathSync(schemaInitManifestPath), schemaInitManifestPath);
  const schemaManifest = JSON.parse(readFileSync(schemaInitManifestPath, "utf8"));
  assert.equal(schemaManifest.status, "verified-schema-only");
  assert.deepEqual(schemaManifest.target, TARGET);
  assert.deepEqual(schemaManifest.after.collections, [...INGRESS_MONGO_COLLECTIONS].sort());
  assert.equal(schemaManifest.after.payloadSchemaIndexes, 53);
  assert.equal(schemaManifest.after.totalIndexesIncludingId, 69);
  assert.deepEqual(schemaManifest.after.requiredUniqueIndexes.slice().sort(), [
    "central-leads.idempotencyKey",
    "crm-offices.code",
    "crm-offices.name",
    "crm-teams.office",
    "crm-teams.teamLeader",
    "users.email",
  ]);
  assert.equal(Object.values(schemaManifest.after.documentCounts).reduce((sum, count) => sum + count, 0), 0);
  assert.equal(schemaManifest.checks.awaitedIndexes, "PASS");
  assert.equal(schemaManifest.checks.zeroDocumentsCreated, "PASS");
  assert.equal(schemaManifest.checks.otherDatabasesUnchanged, "PASS");
  return schemaManifest;
}

function saveManifest() {
  const nextPath = `${manifestPath}.next`;
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  if (!existsSync(manifestPath)) writeFileSync(manifestPath, text, { flag: "wx", mode: 0o600 });
  else {
    writeFileSync(nextPath, text, { flag: "wx", mode: 0o600 });
    renameSync(nextPath, manifestPath);
  }
  const info = lstatSync(manifestPath);
  assert.ok(info.isFile() && !info.isSymbolicLink() && (info.mode & 0o777) === 0o600);
  assert.equal(realpathSync(manifestPath), manifestPath);
}

async function idSnapshot(dbName, names) {
  const db = client.db(dbName);
  const result = {};
  for (const name of names) {
    const docs = await db.collection(name).find({}).sort({ _id: 1 }).toArray();
    const digest = createHash("sha256");
    for (const doc of docs) digest.update(BSON.serialize(doc));
    result[name] = { count: docs.length, digest: digest.digest("hex") };
  }
  return result;
}

async function collectionCounts(db) {
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name).sort();
  const counts = {};
  for (const name of names) counts[name] = await db.collection(name).countDocuments({});
  return { names, counts };
}

async function trackedCounts(db) {
  const counts = {};
  for (const name of TRACKED_COLLECTIONS) counts[name] = await db.collection(name).countDocuments({});
  return counts;
}

async function uniqueIndexExists(db, collection, field) {
  const indexes = await db.collection(collection).listIndexes().toArray();
  return indexes.some((index) => index.unique === true && Object.keys(index.key ?? {}).length === 1 && index.key[field] === 1);
}

function expectedLegacyCounts(rows) {
  const counts = Object.fromEntries(LEGACY_COLLECTIONS.map((name) => [name, 0]));
  for (const row of rows) counts[row.legacy] += 1;
  return counts;
}

function expectedWebsite(route) {
  return {
    omana: "omana-projects",
    estate1: "dholera-estate-1",
    estate2: "dholera-estate-2",
    dholeraEstates: "dholeraestates",
    industrial: "dholeraindustrial",
  }[route];
}

function expectedProject(form, body) {
  if (form.route === "omana") return body.selectedProject;
  if (form.route === "estate1") return "Dholera Estate 1";
  if (form.kind === "estate2-contact") return "dholera-estate-2";
  if (form.kind === "dholera-contact") return "dholera-estates";
  if (form.kind === "industrial-contact") return "industrial-plot";
  return body.property;
}

function expectedLeadType(form, body) {
  if (form.kind === "chatbot") return "chatbot";
  if (form.kind === "omana-google") return "google-ads";
  return body.type;
}

function submissionBody(form, index, key) {
  const identity = {
    name: `Synthetic Noida Ingress ${String(index + 1).padStart(2, "0")}`,
    email: `${runMarker}-lead-${String(index + 1).padStart(2, "0")}@example.invalid`,
    phone: `987${String(index + 1).padStart(7, "0")}`,
  };
  switch (form.kind) {
    case "omana-enquiry":
      return { ...identity, type: "enquiry", selectedProject: "Synthetic QA Project", selectedProjectSlug: "synthetic-qa", message: "Synthetic local integration test", page: "/", source: form.source, consent: true };
    case "omana-contact":
      return { ...identity, type: "contact", selectedProject: "Synthetic QA Project", selectedProjectSlug: "synthetic-qa", message: "Synthetic local integration test", page: "/contact", source: form.source, consent: true };
    case "omana-google":
      return { ...identity, type: "google-ads-enquiry", selectedProject: "Synthetic QA Project", selectedProjectSlug: "synthetic-qa", message: "Synthetic local integration test", page: "/dholeraplots", source: form.source, consent: true, utmSource: "offline-qa", utmMedium: "test", utmCampaign: runMarker };
    case "chatbot":
      return { ...identity, name: chatbotSyntheticName(), type: "ai-chatbot-enquiry", initialIntent: "Synthetic local QA", selectedProject: "Synthetic QA Project", selectedProjectSlug: "synthetic-qa", requirement: "Synthetic ASK OMANA requirement", page: "/", source: form.source, consent: true, idempotencyKey: key };
    case "estate1-enquiry":
      return { ...identity, type: "enquiry", message: "Synthetic local integration test", source: form.source, consent: true };
    case "estate1-contact":
      return { ...identity, type: "contact", budget: "20-50-lakhs", comments: "Synthetic local integration test", source: form.source, consent: true };
    case "estate2-enquiry":
      return { ...identity, type: "enquiry", property: "Synthetic QA Property", message: "Synthetic local integration test", source: form.source, consent: true };
    case "estate2-contact":
      return { ...identity, type: "contact", propertyType: "dholera-estate-2", budget: "20-50-lakhs", comments: "Synthetic local integration test", source: form.source, consent: true };
    case "dholera-enquiry":
      return { ...identity, type: "enquiry", property: "Synthetic QA Property", message: "Synthetic local integration test", source: form.source, consent: true };
    case "dholera-contact":
      return { ...identity, type: "contact", propertyType: "dholera-estates", budget: "20-50-lakhs", comments: "Synthetic local integration test", source: form.source, consent: true };
    case "industrial-enquiry":
      return { ...identity, type: "enquiry", property: "Synthetic QA Property", message: "Synthetic local integration test", source: form.source, consent: true };
    case "industrial-contact":
      return { ...identity, type: "contact", propertyType: "industrial-plot", budget: "25-50-lakhs", comments: "Synthetic local integration test", source: form.source, consent: true };
    default:
      throw new Error("Unknown synthetic form mapping.");
  }
}

function consentVariants() {
  return LEGACY_FORMS.map((form, index) => ({
    form,
    body: submissionBody(form, 100 + index, randomUUID()),
  }));
}

function makeRequest(route, body, key) {
  const secret = process.env[ROUTE_ENV[route]];
  if (!secret) throw new Error("Synthetic local ingress secret was not initialized.");
  return new Request(`http://127.0.0.1${routePath(route)}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
      ...(key ? { "x-idempotency-key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}

function routePath(route) {
  return {
    omana: "/api/omana-leads",
    estate1: "/api/estate1-leads",
    estate2: "/api/estate2-leads",
    dholeraEstates: "/api/dholera-estates-leads",
    industrial: "/api/industrial-leads",
  }[route];
}

function acceptedFormPlan() {
  const rows = [...LEGACY_FORMS];
  const repeat = (form, count) => {
    for (let i = 0; i < count; i += 1) rows.push({ ...form, form: `${form.form}-cycle-${i + 2}` });
  };
  repeat(LEGACY_FORMS[6], 3);
  repeat(LEGACY_FORMS[9], 3);
  repeat(LEGACY_FORMS[12], 2);
  repeat(LEGACY_FORMS[16], 1);
  assert.equal(rows.length, 30);
  const perSite = Object.fromEntries(Object.keys(ROUTE_ENV).map((route) => [route, rows.filter((row) => row.route === route).length]));
  assert.deepEqual(perSite, { omana: 6, estate1: 6, estate2: 6, dholeraEstates: 6, industrial: 6 });
  assert.deepEqual(expectedLegacyCounts(rows), {
    "omana-enquiries": 4,
    "omana-contact-messages": 1,
    "omana-google-ads-enquiries": 1,
    "estate1-enquiries": 5,
    "estate1-contact-messages": 1,
    "estate2-enquiries": 5,
    "estate2-contact-messages": 1,
    "dholera-estates-enquiries": 5,
    "dholera-estates-contact-messages": 1,
    "industrial-enquiries": 5,
    "industrial-contact-messages": 1,
  });
  return rows;
}

async function findHandler(route) {
  const file = {
    omana: "../app/api/omana-leads/route.ts",
    estate1: "../app/api/estate1-leads/route.ts",
    estate2: "../app/api/estate2-leads/route.ts",
    dholeraEstates: "../app/api/dholera-estates-leads/route.ts",
    industrial: "../app/api/industrial-leads/route.ts",
  }[route];
  return (await import(file)).POST;
}

async function testConsentRejections(handlers, db) {
  operation = "reject missing and false consent before persistence";
  const before = await collectionCounts(db);
  assert.ok(Object.values(before.counts).every((count) => count === 0), "target documents must be empty before consent checks");
  let attempts = 0;
  for (const { form, body } of consentVariants()) {
    const key = randomUUID();
    for (const invalidBody of [{ ...body, consent: undefined }, { ...body, consent: false }]) {
      // JSON serialization omits undefined, producing a true missing-consent case.
      const response = await handlers[form.route](makeRequest(form.route, invalidBody, key));
      assert.equal(response.status, 400, `${form.form} rejects invalid consent`);
      attempts += 1;
    }
  }
  const after = await collectionCounts(db);
  assert.deepEqual(after, before, "consent denials do not create records, counters, or assignments");
  manifest.checks.consentRejections = { attempts, status: "PASS", documentsBefore: 0, documentsAfter: 0 };
  saveManifest();
}

async function createUsersAndTeam(payload) {
  operation = "create one approved synthetic CRM office";
  const office = await payload.create({ collection: "crm-offices", overrideAccess: true, data: {
    name: `Noida Ingress QA ${runMarker.slice(-8)}`,
    code: "noida",
    active: true,
  } });
  manifest.ids.office = String(office.id);
  saveManifest();

  operation = "create twelve approved synthetic role accounts";
  const specs = [
    { name: "Synthetic Ingress Admin", role: "super-admin", eligibleForAssignment: false },
    { name: "Synthetic Ingress Team Leader", role: "team-leader", eligibleForAssignment: false },
    ...Array.from({ length: 10 }, (_, index) => ({
      name: `Synthetic Ingress Salesperson ${String(index + 1).padStart(2, "0")}`,
      role: "salesperson",
      eligibleForAssignment: true,
      rotationOrder: index + 1,
    })),
  ];
  const users = [];
  for (const [index, spec] of specs.entries()) {
    const user = await payload.create({ collection: "users", overrideAccess: true, data: {
      ...spec,
      email: `${runMarker}-${String(index + 1).padStart(2, "0")}@example.invalid`,
      password: randomBytes(32).toString("base64url"),
      office: office.id,
      active: true,
    } });
    users.push(user);
    manifest.ids.users.push(String(user.id));
    saveManifest();
  }

  operation = "create one approved synthetic CRM team and relationships";
  const team = await payload.create({ collection: "crm-teams", overrideAccess: true, data: {
    name: `Noida Ingress QA Team ${runMarker.slice(-8)}`,
    office: office.id,
    teamLeader: users[1].id,
    salespeople: users.slice(2).map((user) => user.id),
    active: true,
  } });
  manifest.ids.team = String(team.id);
  saveManifest();
  for (const user of users.slice(1)) {
    await payload.update({ collection: "users", id: user.id, overrideAccess: true, data: { team: team.id } });
  }
  manifest.checks.accountRelationships = "PASS";
  saveManifest();
  return { office, team, users };
}

async function verifyCounts(db, rows, expectedLeads) {
  const counts = await trackedCounts(db);
  const expected = {
    users: 12,
    "crm-offices": 1,
    "crm-teams": 1,
    "central-leads": expectedLeads,
    "crm-assignment-counters": expectedLeads ? 1 : 0,
    "crm-activities": expectedLeads * 2,
    ...Object.fromEntries(LEGACY_COLLECTIONS.map((name) => [name, rows.filter((row) => row.legacy === name).length])),
  };
  assert.deepEqual(counts, expected, "only approved records were persisted");
  return counts;
}

async function readOnlyIntegrity(db, users, office, team, rows) {
  operation = "verify all synthetic lead identities and assignments";
  const central = await db.collection("central-leads").find({}).sort({ assignmentSequence: 1 }).toArray();
  assert.equal(central.length, 30);
  const salespersonIDs = users.slice(2).map((user) => String(user.id));
  for (const [index, lead] of central.entries()) {
    const row = rows[index];
    assert.equal(lead.assignmentSequence, index + 1);
    assert.equal(String(lead.assignedSalesperson), salespersonIDs[index % 10]);
    assert.equal(String(lead.office), String(office.id));
    assert.equal(lead.consent, true);
    assert.ok(lead.consentRecordedAt instanceof Date);
    assert.match(lead.email, new RegExp(`^${runMarker}-lead-\\d{2}@example\\.invalid$`));
    assert.equal(String(lead._id), row.centralId);
    assert.equal(lead.name, row.name);
    assert.equal(lead.email, row.email);
    assert.equal(lead.phone, row.phone);
    assert.equal(lead.website, row.website);
    assert.equal(lead.project, row.project);
    assert.equal(lead.source, row.source);
    assert.equal(lead.leadType, row.leadType);
    if (centralLeadLegacyLinkExpected(row.route)) {
      assert.equal(lead.legacyCollection, row.legacy);
      assert.equal(String(lead.legacyId), row.legacyId);
    } else {
      assert.equal(lead.legacyCollection ?? null, null);
      assert.equal(lead.legacyId ?? null, null);
    }
  }
  const leadIDs = central.map((lead) => String(lead._id));
  const activities = await db.collection("crm-activities").find({}).toArray();
  assert.equal(activities.length, 60);
  assert.ok(activities.every((activity) => leadIDs.includes(String(activity.lead))));
  assert.deepEqual(activities.reduce((acc, item) => { acc[item.event] = (acc[item.event] || 0) + 1; return acc; }, {}), { created: 30, assigned: 30 });
  const counter = await db.collection("crm-assignment-counters").findOne({ key: COUNTER_KEY, office: new ObjectId(String(office.id)) });
  assert.ok(counter);
  assert.equal(counter.sequence, 30);
  assert.equal(await db.collection("crm-assignment-counters").countDocuments({}), 1);
  const teamDoc = await db.collection("crm-teams").findOne({ _id: new ObjectId(String(team.id)) });
  assert.ok(teamDoc);
  assert.equal(String(teamDoc.office), String(office.id));
  assert.equal(String(teamDoc.teamLeader), String(users[1].id));
  assert.deepEqual(teamDoc.salespeople.map(String).sort(), salespersonIDs.slice().sort());
  const userCounts = await db.collection("users").aggregate([
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]).toArray();
  assert.deepEqual(Object.fromEntries(userCounts.map((item) => [item._id, item.count])), { "super-admin": 1, "team-leader": 1, salesperson: 10 });
  const legacyCounts = Object.fromEntries(LEGACY_COLLECTIONS.map((name) => [name, rows.filter((row) => row.legacy === name).length]));
  for (const [collection, expected] of Object.entries(legacyCounts)) {
    assert.equal(await db.collection(collection).countDocuments({}), expected);
  }
  for (const row of rows) {
    const legacy = await db.collection(row.legacy).findOne({ _id: new ObjectId(row.legacyId) });
    assert.ok(legacy, `${row.form} legacy document exists`);
    assert.equal(legacy.email, row.email, `${row.form} legacy email maps to central lead`);
    assert.equal(legacy.name, row.name, `${row.form} legacy name maps to central lead`);
    assert.equal(legacy.phone, row.phone, `${row.form} legacy phone maps to central lead`);
    assert.equal(legacy.source, row.source, `${row.form} legacy source is preserved`);
    assert.equal(String(legacy._id), row.legacyId);
  }
  manifest.checks.finalCounts = await verifyCounts(db, rows, 30);
  manifest.checks.roundRobin = { status: "PASS", leads: 30, cycles: 3, assignmentsPerSalesperson: 3, sequence: 30 };
  manifest.checks.activities = { status: "PASS", created: 30, assigned: 30 };
  manifest.checks.relationships = "PASS";
  saveManifest();
  return { central, activities, counter, legacyCounts };
}

async function verifyRoleViewsAndReports(payload, users) {
  operation = "verify authorized Admin, Team Leader, and salesperson CRM views and reports";
  const findFor = (user) => payload.find({
    collection: "central-leads",
    depth: 0,
    limit: 100,
    pagination: false,
    user,
    overrideAccess: false,
  });
  const [adminView, leaderView, ...salespersonViews] = await Promise.all([
    findFor(users[0]),
    findFor(users[1]),
    ...users.slice(2).map((user) => findFor(user)),
  ]);
  assert.equal(adminView.totalDocs, 30);
  assert.equal(leaderView.totalDocs, 30);
  assert.equal(salespersonViews.length, 10);
  for (const [index, view] of salespersonViews.entries()) {
    assert.equal(view.totalDocs, 3, `Sales ${String(index + 1).padStart(2, "0")} sees exactly three leads`);
    assert.ok(view.docs.every((lead) => String(lead.assignedSalesperson) === String(users[index + 2].id)));
  }

  const names = new Map(users.slice(2).map((user) => [String(user.id), user.name]));
  const window = { start: null, endExclusive: null, label: "All dates" };
  const options = { period: "all", kind: "salesperson", format: "json" };
  const reportFor = (view) => buildCrmReport(view.docs, names, options, window);
  const adminReport = reportFor(adminView);
  const leaderReport = reportFor(leaderView);
  assert.equal(adminReport.summary.total, 30);
  assert.equal(leaderReport.summary.total, 30);
  assert.equal(adminReport.table.rows.length, 10);
  assert.equal(leaderReport.table.rows.length, 10);
  assert.ok(adminReport.summary.salespeople.every((person) => person.count === 3));
  assert.ok(leaderReport.summary.salespeople.every((person) => person.count === 3));
  for (const [index, view] of salespersonViews.entries()) {
    const report = reportFor(view);
    assert.equal(report.summary.total, 3);
    assert.deepEqual(report.summary.salespeople, [{ label: users[index + 2].name, count: 3 }]);
  }
  const firstLeadForSales02 = String(leaderView.docs.find((lead) => String(lead.assignedSalesperson) === String(users[3].id)).id);
  await assert.rejects(
    () => payload.findByID({ collection: "central-leads", id: firstLeadForSales02, depth: 0, user: users[2], overrideAccess: false }),
    "one salesperson cannot read another salesperson's lead",
  );
  manifest.checks.roleScopedViews = { status: "PASS", adminLeads: 30, teamLeaderLeads: 30, salespersonLeads: Array(10).fill(3), crossSalespersonDenied: true };
  manifest.checks.reportConsistency = { status: "PASS", adminTotal: adminReport.summary.total, teamLeaderTotal: leaderReport.summary.total, salespersonTotals: Array(10).fill(3), assignedLeadTotals: adminReport.summary.salespeople.map(({ label, count }) => ({ label, count })) };
  saveManifest();
}

async function main() {
  operation = "verify local MongoDB identity, exact empty target state, and existing database snapshots";
  await client.connect();
  const server = await verifyLocalDemoServer(client, { requireEmpty: false });
  const hello = await client.db("admin").command({ hello: 1 });
  assert.equal(hello.setName, TARGET.replicaSet);
  assert.equal(hello.me, `${TARGET.host}:${TARGET.port}`);
  assert.deepEqual(hello.hosts, [`${TARGET.host}:${TARGET.port}`]);
  const databaseNames = (await client.db("admin").command({ listDatabases: 1, nameOnly: true })).databases.map((item) => item.name);
  const targetPreviouslyExists = databaseNames.includes(TARGET.database);
  let targetBeforeInitialization = { names: [], counts: {} };
  let schemaInitializationEvidence;
  if (targetPreviouslyExists) {
    readPreviousFailureEvidence();
    schemaInitializationEvidence = readSchemaInitializationEvidence();
    targetBeforeInitialization = await collectionCounts(client.db(TARGET.database));
    assert.deepEqual(targetBeforeInitialization.names, [...INGRESS_MONGO_COLLECTIONS].sort());
    assert.ok(Object.values(targetBeforeInitialization.counts).every((count) => count === 0));
    let customIndexCount = 0;
    let totalIndexCount = 0;
    for (const name of targetBeforeInitialization.names) {
      const indexes = await client.db(TARGET.database).collection(name).listIndexes().toArray();
      totalIndexCount += indexes.length;
      customIndexCount += indexes.filter(({ key }) => !(Object.keys(key).length === 1 && key._id === 1)).length;
    }
    assert.equal(customIndexCount, 53, "all approved Payload schema indexes must already be initialized");
    assert.equal(totalIndexCount, 69, "only 53 schema indexes and 16 standard _id indexes are expected");
    for (const [collection, field] of [["users", "email"], ["crm-offices", "name"], ["crm-offices", "code"], ["crm-teams", "office"], ["crm-teams", "teamLeader"], ["central-leads", "idempotencyKey"]]) {
      assert.equal(await uniqueIndexExists(client.db(TARGET.database), collection, field), true, `required unique index: ${collection}.${field}`);
    }
  }
  const demoBefore = await idSnapshot("noida-crm-demo-20261019", ["users", "central-leads", "crm-activities", "crm-assignment-counters"]);
  const workflowBefore = await idSnapshot("noida-crm-workflow-qa-20261019", ["users", "crm-offices", "crm-teams", "central-leads", "crm-activities", "payload-preferences"]);
  assert.deepEqual(Object.fromEntries(Object.entries(demoBefore).map(([name, item]) => [name, item.count])), {
    users: 12, "central-leads": 30, "crm-activities": 60, "crm-assignment-counters": 1,
  });
  assert.deepEqual(Object.fromEntries(Object.entries(workflowBefore).map(([name, item]) => [name, item.count])), {
    users: 4, "crm-offices": 1, "crm-teams": 1, "central-leads": 2, "crm-activities": 17, "payload-preferences": 2,
  });

  protectEvidenceDirectory();
  manifest = {
    schema: 1,
    runMarker,
    target: TARGET,
    status: "initializing",
    approval: "Owner approved isolated local ingress schema initialization and the bounded synthetic lead integration QA scope.",
    ids: { office: null, team: null, users: [], centralLeads: [], legacy: [], activities: [], assignmentCounter: null },
    pending: [],
    checks: {},
    beforeSnapshots: { demo: demoBefore, workflowQA: workflowBefore },
    previousFailureManifest: targetPreviouslyExists ? previousFailureManifestPath : null,
    schemaInitializationManifest: schemaInitializationEvidence ? schemaInitManifestPath : null,
    targetBeforeInitialization,
    expected: { users: 12, offices: 1, teams: 1, centralLeads: 30, assignmentCounters: 1, activities: 60, legacyRecords: 30 },
  };
  saveManifest();

  process.env.MONGODB_URI = URI;
  process.env.PAYLOAD_SECRET = randomBytes(48).toString("base64url");
  process.env.__NEXT_PROCESSED_ENV = "true";
  process.env.NEXT_TELEMETRY_DISABLED = "1";
  for (const name of Object.values(ROUTE_ENV)) process.env[name] = `local-mock-${randomBytes(32).toString("hex")}`;

  const [{ getPayload }, { mongooseAdapter }, configModule, mongooseModule, connectModule] = await Promise.all([
    import("payload"),
    import("@payloadcms/db-mongodb"),
    import("../payload.config.ts"),
    import("mongoose"),
    import("../lib/mongodb.ts"),
  ]);
  defaultMongoose = mongooseModule.default;
  const sourceConfig = await configModule.default;
  const config = buildLocalIngressQAConfig({ sourceConfig, uri: URI, mongooseAdapter });
  payload = await getPayload({ config });
  assert.equal(payload.db.ensureIndexes, true, "Payload must await QA-only schema indexes");
  assert.equal(payload.db.connectOptions.autoIndex, false, "QA indexes must be explicit and awaited");
  assert.equal(payload.db.url, URI, "Payload must target the exact loopback URI");
  assert.equal(payload.db.connection?.db?.databaseName, TARGET.database);
  const liveHello = await payload.db.connection.getClient().db("admin").command({ hello: 1 });
  assert.equal(liveHello.setName, TARGET.replicaSet);
  assert.equal(liveHello.me, `${TARGET.host}:${TARGET.port}`);
  operation = "verify central-ingress MongoDB connection before fixture writes";
  await connectModule.default();
  const ingressConnection = defaultMongoose.connection;
  assert.equal(ingressConnection.host, TARGET.host);
  assert.equal(ingressConnection.port, TARGET.port);
  assert.equal(ingressConnection.db?.databaseName, TARGET.database);
  const ingressHello = await ingressConnection.getClient().db("admin").command({ hello: 1 });
  assert.equal(ingressHello.setName, TARGET.replicaSet);
  assert.equal(ingressHello.me, `${TARGET.host}:${TARGET.port}`);
  const db = client.db(TARGET.database);
  assert.equal(db.databaseName, TARGET.database);
  const initialized = await collectionCounts(db);
  assert.deepEqual(initialized.names, [...INGRESS_MONGO_COLLECTIONS].sort(), "QA initialization must create only ingress schemas and their relationship target");
  assert.ok(Object.values(initialized.counts).every((count) => count === 0), "Payload initialization must leave all collections document-empty");
  manifest.initializedCollections = initialized.names;
  manifest.status = "preflight-passed";
  manifest.checks.targetPreinitializationState = targetPreviouslyExists ? "PASS: matched protected empty namespace state from the failed run" : "PASS: database was absent";
  manifest.checks.loopbackReplicaSet = { status: "PASS", host: TARGET.host, port: TARGET.port, replicaSet: TARGET.replicaSet, pid: server.pid };
  manifest.checks.payloadConnection = "PASS";
  manifest.checks.centralIngressConnection = "PASS";
  manifest.checks.noInheritedServiceConfiguration = "PASS";
  saveManifest();

  operation = "verify unique indexes before creating fixtures";
  for (const [collection, field] of [["central-leads", "idempotencyKey"], ["crm-offices", "code"], ["crm-offices", "name"], ["users", "email"], ["crm-teams", "office"], ["crm-teams", "teamLeader"]]) {
    assert.equal(await uniqueIndexExists(db, collection, field), true, `unique index required: ${collection}.${field}`);
  }
  let verifiedSchemaIndexes = 0;
  let verifiedPhysicalIndexes = 0;
  for (const name of initialized.names) {
    const indexes = await db.collection(name).listIndexes().toArray();
    verifiedPhysicalIndexes += indexes.length;
    verifiedSchemaIndexes += indexes.filter(({ key }) => !(Object.keys(key).length === 1 && key._id === 1)).length;
  }
  assert.equal(verifiedSchemaIndexes, 53);
  assert.equal(verifiedPhysicalIndexes, 69);
  manifest.checks.uniqueIndexes = "PASS";
  manifest.checks.schemaIndexes = { status: "PASS", payloadSchemaIndexes: verifiedSchemaIndexes, totalIndexesIncludingId: verifiedPhysicalIndexes };
  saveManifest();

  const handlers = Object.fromEntries(await Promise.all(Object.keys(ROUTE_ENV).map(async (route) => [route, await findHandler(route)])));
  await testConsentRejections(handlers, db);

  operation = "create approved office, accounts, and team";
  const { office, team, users } = await createUsersAndTeam(payload);
  assert.equal(users.length, 12);
  assert.equal((await trackedCounts(db)).users, 12);
  assert.equal((await trackedCounts(db))["crm-offices"], 1);
  assert.equal((await trackedCounts(db))["crm-teams"], 1);

  const plan = acceptedFormPlan();
  manifest.pending = plan.map((form, index) => ({
    index,
    form: form.form,
    route: form.route,
    legacyCollection: form.legacy,
    email: `${runMarker}-lead-${String(index + 1).padStart(2, "0")}@example.invalid`,
    status: "not-started",
  }));
  manifest.status = "seeding-leads";
  saveManifest();

  operation = "persist 30 approved synthetic five-website and ASK OMANA submissions";
  const createdRows = [];
  const expectedAssignments = users.slice(2).map((user) => String(user.id));
  for (const [index, form] of plan.entries()) {
    const key = randomUUID();
    const body = submissionBody(form, index, key);
    manifest.pending[index] = { ...manifest.pending[index], idempotencyKey: key, status: "pending" };
    saveManifest();
    const responses = index === 0
      ? await Promise.all([handlers[form.route](makeRequest(form.route, body, key)), handlers[form.route](makeRequest(form.route, body, key))])
      : [await handlers[form.route](makeRequest(form.route, body, key))];
    const responseBodies = await Promise.all(responses.map((response) => response.json().catch(() => ({}))));
    lastHTTPDiagnostic = sanitizedIngressHTTPDiagnostic(responses[0], responseBodies[0]);
    manifest.pending[index] = { ...manifest.pending[index], httpResponse: lastHTTPDiagnostic };
    saveManifest();
    if (index === 0) {
      assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 201], "concurrent same-key submissions produce one create and one duplicate");
      assert.equal(responseBodies.filter(({ duplicate }) => duplicate === true).length, 1);
      assert.equal(responseBodies.filter(({ duplicate }) => duplicate !== true).length, 1);
    } else {
      assert.equal(responses[0].status, 201, `${form.form} accepts a valid synthetic consented submission`);
      assert.notEqual(responseBodies[0].duplicate, true);
    }

    const central = await db.collection("central-leads").findOne({ idempotencyKey: key });
    assert.ok(central, `${form.form} created one central lead`);
    const legacy = await db.collection(form.legacy).findOne({ email: body.email, source: form.source });
    assert.ok(legacy, `${form.form} created one mapped legacy lead`);
    const activityRows = await db.collection("crm-activities").find({ lead: central._id }).toArray();
    assert.equal(activityRows.length, 2, `${form.form} created created+assigned activity rows`);
    const expectedSalesperson = expectedAssignments[index % 10];
    assert.equal(String(central.assignedSalesperson), expectedSalesperson);
    assert.equal(central.assignmentSequence, index + 1);
    assert.equal(central.consent, true);
    assert.ok(central.consentRecordedAt instanceof Date);

    const row = {
      form: form.form,
      route: form.route,
      source: form.source,
      legacy: form.legacy,
      name: body.name,
      email: body.email,
      phone: form.kind === "chatbot" ? `+91${body.phone.replace(/\D/g, "")}` : body.phone,
      website: expectedWebsite(form.route),
      project: expectedProject(form, body),
      leadType: expectedLeadType(form, body),
      idempotencyKey: key,
      centralId: String(central._id),
      legacyId: String(legacy._id),
      activityIds: activityRows.map((activity) => String(activity._id)),
      assignmentSequence: central.assignmentSequence,
      assignedSalespersonId: String(central.assignedSalesperson),
    };
    createdRows.push(row);
    manifest.ids.centralLeads.push(row.centralId);
    manifest.ids.legacy.push({ collection: row.legacy, id: row.legacyId });
    manifest.ids.activities.push(...row.activityIds);
    manifest.pending[index] = { ...manifest.pending[index], ...row, status: "verified" };
    manifest.checks.incrementalCounts = await verifyCounts(db, createdRows, index + 1);
    if (index === 0) {
      const replayCounts = await trackedCounts(db);
      assert.deepEqual(replayCounts, manifest.checks.incrementalCounts, "concurrent duplicate replay creates exactly one lead, legacy row, and two activities");
      const replayLeadCount = await db.collection("central-leads").countDocuments({ idempotencyKey: key });
      assert.equal(replayLeadCount, 1);
      manifest.checks.concurrentDuplicateReplay = { status: "PASS", submissions: 2, centralLeads: 1, legacyRecords: 1, activities: 2, assignmentSequence: 1 };
    }
    saveManifest();
  }

  operation = "verify sequential duplicate replays do not write or assign";
  const duplicateCandidates = [
    createdRows.find((row) => row.route === "omana" && row.form !== "ask-omana-chatbot"),
    ...["estate1", "estate2", "dholeraEstates", "industrial"].map((route) => createdRows.find((row) => row.route === route)),
    createdRows.find((row) => row.form === "ask-omana-chatbot"),
  ];
  assert.equal(duplicateCandidates.length, 6);
  const beforeDuplicates = await trackedCounts(db);
  for (const row of duplicateCandidates) {
    const form = plan.find((candidate) => candidate.form === row.form);
    const index = createdRows.indexOf(row);
    const body = submissionBody(form, index, row.idempotencyKey);
    const response = await handlers[row.route](makeRequest(row.route, body, row.idempotencyKey));
    const responseBody = await response.json().catch(() => ({}));
    assert.equal(response.status, 200, `${row.form} duplicate returns success without another create`);
    assert.equal(responseBody.duplicate, true);
  }
  assert.deepEqual(await trackedCounts(db), beforeDuplicates, "duplicate replays do not change any approved collection count");
  manifest.checks.duplicateReplays = { status: "PASS", attempts: duplicateCandidates.length, documentCountsUnchanged: true, assignmentSequenceUnchanged: true };
  saveManifest();

  operation = "verify final records, assignment order, activities, relationships, and collections";
  const final = await readOnlyIntegrity(db, users, office, team, createdRows);
  assert.equal(final.central.length, 30);
  manifest.ids.assignmentCounter = String(final.counter._id);
  manifest.status = "verified";
  manifest.checks.acceptedSubmissions = { status: "PASS", total: 30, perWebsite: { omana: 6, estate1: 6, estate2: 6, dholeraEstates: 6, industrial: 6 } };
  manifest.checks.syntheticIdentities = "PASS";
  saveManifest();

  await verifyRoleViewsAndReports(payload, users);

  operation = "verify the existing demo and workflow QA databases remain unchanged";
  const demoAfter = await idSnapshot("noida-crm-demo-20261019", Object.keys(demoBefore));
  const workflowAfter = await idSnapshot("noida-crm-workflow-qa-20261019", Object.keys(workflowBefore));
  assert.deepEqual(demoAfter, demoBefore);
  assert.deepEqual(workflowAfter, workflowBefore);
  manifest.checks.existingDatabasesUnchanged = "PASS";
  saveManifest();

  return {
    status: "PASS",
    target: TARGET,
    runMarker,
    counts: await trackedCounts(db),
    assignment: { sequence: 30, cycles: 3, leadsPerSalesperson: 3 },
    consentRejections: manifest.checks.consentRejections,
    duplicateReplays: manifest.checks.duplicateReplays,
    existingDatabasesUnchanged: true,
    manifest: manifestPath,
  };
}

let result;
let failure;
try {
  // Suppress Payload/route errors that may embed runtime configuration; the final report is structured and sanitized.
  console.log = () => {};
  console.error = () => {};
  result = await main();
} catch (error) {
  if (manifest) {
    manifest.status = "partial-failure";
    manifest.failure = { ...safeMongoFailure(error, operation), ...(lastHTTPDiagnostic ? { httpResponse: lastHTTPDiagnostic } : {}) };
    try { saveManifest(); } catch {}
  }
  failure = { status: "FAIL", operation, error: { ...safeMongoFailure(error, operation), ...(lastHTTPDiagnostic ? { httpResponse: lastHTTPDiagnostic } : {}) }, manifest: manifest ? manifestPath : null, cleanup: "not-performed" };
  process.exitCode = 1;
} finally {
  try { await payload?.destroy?.(); } catch {}
  try { await defaultMongoose?.disconnect?.(); } catch {}
  try { await client.close(); } catch {}
  console.log = originalLog;
  console.error = originalError;
}
if (failure) process.stderr.write(`${JSON.stringify(failure)}\n`);
else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
