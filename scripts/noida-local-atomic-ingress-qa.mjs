import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MongoClient, ObjectId } from "mongodb";

import { INGRESS_PAYLOAD_COLLECTIONS } from "../lib/noida-local-ingress-qa-config.mjs";
import { buildLocalAtomicConfig } from "../lib/noida-local-atomic-config.mjs";
import { APPROVAL_TEXT, ALLOWED_COLLECTIONS, CAPS, CASES, LEGACY, TARGET, URI, assertAbsentTarget, assertAttemptPlan, assertCapacity, assertExactTarget, assertExecutionGate, assertPayloadReadCollection, assertRequiredIndexes, assertScope, digest } from "../lib/noida-local-atomic-qa.mjs";
import { assertOtherDatabasesUnchanged, readOnlyAtomicPreflight, snapshotOtherDatabases } from "../lib/noida-local-atomic-preflight.mjs";
import { safeMongoFailure } from "../lib/noida-local-demo-target.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const EVIDENCE_ROOT = resolve(ROOT, ".artifacts/noida-local-atomic-qa-20261021");
const ESTATE = "estate1-enquiries";
const OMANA = "omana-enquiries";
const COUNTER_KEY = "noida-shared-lead-round-robin";

if (process.argv.length === 2 || process.argv[2] === "--plan") {
  assert.deepEqual(process.argv.slice(2), process.argv.length === 2 ? [] : ["--plan"]);
  assertAttemptPlan();
  console.log(JSON.stringify({ status: "AWAITING_SEPARATE_OWNER_APPROVAL", target: TARGET, caps: CAPS, cases: CASES, approval: APPROVAL_TEXT }, null, 2));
  process.exit(0);
}

// This guard runs before constructing a client, opening a socket or importing Payload.
assertExecutionGate(process.argv.slice(2), process.env);
assert.equal(process.cwd(), ROOT, "Run only from the Master CMS workspace");
assert.deepEqual(process.execArgv, ["--import", "tsx"], "Atomic QA execution requires the pinned TypeScript loader");
assertAttemptPlan();

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
let payload;
let mongoose;
let manifest;
let evidencePath;
let operation = "read-only preflight";

function save() {
  assert.ok(manifest && evidencePath);
  const content = `${JSON.stringify(manifest, null, 2)}\n`;
  if (!existsSync(evidencePath)) writeFileSync(evidencePath, content, { flag: "wx", mode: 0o600 });
  else {
    const next = `${evidencePath}.next`;
    writeFileSync(next, content, { flag: "wx", mode: 0o600 });
    renameSync(next, evidencePath);
  }
  const info = lstatSync(evidencePath);
  assert.ok(info.isFile() && !info.isSymbolicLink() && realpathSync(evidencePath) === evidencePath && (info.mode & 0o777) === 0o600, "Evidence file is unsafe");
}

function protectEvidence() {
  if (!existsSync(EVIDENCE_ROOT)) mkdirSync(EVIDENCE_ROOT, { mode: 0o700 });
  const info = lstatSync(EVIDENCE_ROOT);
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && realpathSync(EVIDENCE_ROOT) === EVIDENCE_ROOT && (info.mode & 0o777) === 0o700, "Evidence directory is unsafe");
  evidencePath = resolve(EVIDENCE_ROOT, `${manifest.runMarker}.json`);
  assert.ok(!existsSync(evidencePath), "Run marker already has evidence; no automatic resume");
}

async function targetSnapshot() {
  const db = client.db(TARGET.database);
  assert.equal(db.databaseName, TARGET.database);
  const entries = await db.listCollections({}, { nameOnly: false }).toArray();
  assert.ok(entries.every((row) => row.type === "collection"), "Unexpected target view");
  const names = entries.map((row) => row.name).sort();
  const counts = {};
  const ids = {};
  const documentDigests = {};
  const indexes = {};
  const leads = [];
  const legacy = [];
  const activities = [];
  let secondaryIndexes = 0;
  for (const name of names) {
    const collection = db.collection(name);
    const rows = await collection.find({}).sort({ _id: 1 }).toArray();
    indexes[name] = await collection.listIndexes().toArray();
    counts[name] = rows.length;
    ids[name] = rows.map((row) => String(row._id));
    documentDigests[name] = digest(rows);
    secondaryIndexes += indexes[name].filter((index) => !(Object.keys(index.key ?? {}).length === 1 && index.key._id === 1)).length;
    if (name === "central-leads") leads.push(...rows.map((row) => ({ id: String(row._id), key: row.idempotencyKey, legacyCollection: row.legacyCollection ?? null, legacyId: row.legacyId == null ? null : String(row.legacyId), assignedSalesperson: row.assignedSalesperson == null ? null : String(row.assignedSalesperson), assignmentSequence: row.assignmentSequence ?? null, consent: row.consent === true, website: row.website })));
    if (LEGACY.includes(name)) legacy.push(...rows.map((row) => ({ collection: name, id: String(row._id), status: row.status })));
    if (name === "crm-activities") activities.push(...rows.map((row) => ({ id: String(row._id), lead: String(row.lead), event: row.event, assignedSalesperson: row.assignedSalesperson == null ? null : String(row.assignedSalesperson) })));
  }
  const counters = names.includes("crm-assignment-counters") ? await db.collection("crm-assignment-counters").find({}).toArray() : [];
  assert.ok(counters.length <= 1);
  const sequence = counters[0]?.sequence ?? 0;
  const summary = { names, counts, ids, documentDigests, leads, legacy, activities, secondaryIndexes, sequence };
  return { ...summary, indexes, digest: digest({ ...summary, indexDigests: Object.fromEntries(Object.entries(indexes).map(([name, values]) => [name, digest(values)])) }) };
}

function summary(snapshot) {
  const { indexes: _indexes, ...safe } = snapshot;
  void _indexes;
  return safe;
}

async function checkedSnapshot(attempts) {
  const snapshot = await targetSnapshot();
  assertScope(snapshot, attempts);
  if (manifest.seed) {
    for (const name of ["crm-offices", "users"]) assert.equal(snapshot.documentDigests[name], manifest.seed.snapshot.documentDigests[name], `Seed ${name} changed`);
  }
  assertOtherDatabasesUnchanged(manifest.preflight.otherDatabases, await snapshotOtherDatabases(client));
  return snapshot;
}

async function verifyCommitted(snapshot) {
  const { auditLeadLinks } = await import("../lib/crm/reconciliation-audit.ts");
  const audit = auditLeadLinks(snapshot.leads, snapshot.legacy);
  assert.deepEqual(audit, { centralWithoutLink: [], centralMissingLegacy: [], duplicateCentralLinks: [], orphanLegacy: [] });
  assert.equal(snapshot.leads.length, snapshot.legacy.length);
  assert.equal(snapshot.activities.length, snapshot.leads.length * 2);
  assert.equal(snapshot.sequence, snapshot.leads.length);
  assert.deepEqual(snapshot.leads.map((lead) => lead.assignmentSequence).sort((a, b) => a - b), Array.from({ length: snapshot.leads.length }, (_, index) => index + 1));
  assert.ok(snapshot.leads.every((lead) => lead.consent && lead.assignedSalesperson === manifest.seed.salespersonId));
  assert.ok(snapshot.legacy.every((record) => record.status === "new"));
  for (const lead of snapshot.leads) {
    const events = snapshot.activities.filter((activity) => activity.lead === lead.id);
    assert.deepEqual(events.map((activity) => activity.event).sort(), ["assigned", "created"]);
    assert.ok(events.every((activity) => activity.assignedSalesperson === manifest.seed.salespersonId));
    assertPayloadReadCollection("central-leads");
    assertPayloadReadCollection(lead.legacyCollection);
    assert.ok(payload.collections["central-leads"] && payload.collections[lead.legacyCollection], "Payload read collection is absent from the bounded QA config");
    operation = "read committed central lead through Payload";
    const central = await payload.findByID({ collection: "central-leads", id: lead.id, depth: 0, overrideAccess: true });
    operation = "read committed legacy lead through Payload";
    const legacy = await payload.findByID({ collection: lead.legacyCollection, id: lead.legacyId, depth: 0, overrideAccess: true });
    assert.equal(String(central.id), lead.id);
    assert.equal(central.legacyCollection, lead.legacyCollection);
    assert.equal(String(central.legacyId), lead.legacyId);
    assert.equal(String(legacy.id), lead.legacyId);
    assert.equal(legacy.status, "new");
    // crm-activities is deliberately outside the bounded Payload config; its
    // raw read-only snapshot above verifies both activity records and links.
  }
  return audit;
}

function delta(before, after, expected) {
  for (const [name, collection] of [["central", "central-leads"], ["estate", ESTATE], ["omana", OMANA], ["activities", "crm-activities"]]) {
    assert.equal((after.counts[collection] ?? 0) - (before.counts[collection] ?? 0), expected[name] ?? 0, `${name} delta`);
  }
  assert.equal(after.sequence - before.sequence, expected.counter ?? 0, "Counter delta");
  if (Object.values(expected).every((value) => value === 0)) assert.equal(after.digest, before.digest, "Rejected or replayed attempt changed target documents or indexes");
}

function identity(number) {
  return { name: `Synthetic Atomic Lead ${number}`, email: `${manifest.runMarker}.${number}@example.invalid`, phone: `98766${String(number).padStart(5, "0")}` };
}

function estateAttempt(person, key, hooks = {}) {
  return import("../lib/crm/ingest.ts").then(({ ingestLeadWithLegacy }) => ingestLeadWithLegacy({
    ...person, website: "dholera-estate-1", leadType: "enquiry", source: "estate1-popup-form",
    project: "Synthetic Atomic Project", message: "Synthetic local atomic QA", consent: true, idempotencyKey: key,
  }, { collection: ESTATE, data: { ...person, message: "Synthetic local atomic QA", source: "estate1-popup-form", status: "new" } }, hooks));
}

function omanaAttempt(person, key, hooks = {}) {
  return import("../lib/crm/ingest.ts").then(({ ingestLeadWithLegacy }) => ingestLeadWithLegacy({
    ...person, website: "omana-projects", leadType: "enquiry", source: "omana-global-drawer",
    project: "Synthetic Atomic Project", page: "/", message: "Synthetic local atomic QA", consent: true, idempotencyKey: key,
  }, { collection: OMANA, data: {
    ...person, selectedProject: "Synthetic Atomic Project", selectedProjectSlug: "synthetic-atomic",
    page: "/", message: "Synthetic local atomic QA", source: "omana-global-drawer", consent: true, status: "new",
  } }, hooks));
}

async function runCase(name, reservation, work, expected) {
  assert.equal(CASES[manifest.attempts.length], name, "Attempt order changed");
  const before = await checkedSnapshot(manifest.attempts.length);
  assertCapacity(before, { ...reservation, attempts: manifest.attempts.length + 1 });
  const row = { name, status: "STARTED", startedAt: new Date().toISOString(), before: summary(before) };
  manifest.attempts.push(row);
  save();
  operation = `atomic case ${name}`;
  row.outcome = await work();
  const after = await checkedSnapshot(manifest.attempts.length);
  delta(before, after, expected);
  row.audit = await verifyCommitted(after);
  row.after = summary(after);
  row.status = "PASS";
  row.finishedAt = new Date().toISOString();
  save();
}

async function runRace(person, key) {
  assert.deepEqual(CASES.slice(manifest.attempts.length, manifest.attempts.length + 2), ["estate-race-a", "estate-race-b"]);
  const before = await checkedSnapshot(manifest.attempts.length);
  assertCapacity(before, { attempts: manifest.attempts.length + 2, central: 2, legacy: 2, activities: 4, counterAdvances: 2 });
  const rows = ["estate-race-a", "estate-race-b"].map((name) => ({ name, status: "STARTED", startedAt: new Date().toISOString(), before: summary(before) }));
  manifest.attempts.push(...rows);
  save();
  operation = "two concurrent same-key atomic attempts";
  const results = await Promise.allSettled([estateAttempt(person, key), estateAttempt(person, key)]);
  assert.equal(results.filter((item) => item.status === "fulfilled" && item.value.duplicate === false).length, 1, "Race must have one new lead");
  assert.equal(results.filter((item) => item.status === "fulfilled" && item.value.duplicate === true).length, 1, "Race loser must be an idempotent replay");
  const after = await checkedSnapshot(manifest.attempts.length);
  delta(before, after, { estate: 1, central: 1, activities: 2, counter: 1 });
  const audit = await verifyCommitted(after);
  for (const [index, row] of rows.entries()) {
    row.outcome = results[index].value.duplicate ? "replay" : "created";
    row.audit = audit;
    row.after = summary(after);
    row.status = "PASS";
    row.finishedAt = new Date().toISOString();
  }
  save();
}

async function initializeSchemaAndSeed() {
  operation = "initialize bounded atomic schema";
  const [{ getPayload }, { mongooseAdapter }, configModule, mongooseModule] = await Promise.all([
    import("payload"), import("@payloadcms/db-mongodb"), import("../payload.config.ts"), import("mongoose"),
  ]);
  const config = buildLocalAtomicConfig({ sourceConfig: await configModule.default, mongooseAdapter });
  assertExactTarget(process.env.MONGODB_URI);
  const db = client.db(TARGET.database);
  const namesBefore = (await client.db("admin").command({ listDatabases: 1, nameOnly: true })).databases.map((row) => row.name);
  const collectionsBefore = (await db.listCollections({}, { nameOnly: true }).toArray()).map((row) => row.name);
  assertAbsentTarget(namesBefore, collectionsBefore);
  mongoose = mongooseModule.default;
  payload = await getPayload({ config });
  assert.equal(payload.db.url, URI);
  assert.equal(payload.db.ensureIndexes, false);
  assert.equal(payload.db.connectOptions.autoIndex, false);
  assert.equal(payload.db.connection?.db?.databaseName, TARGET.database);
  let snapshot = await checkedSnapshot(0);
  const plannedIndexes = INGRESS_PAYLOAD_COLLECTIONS.reduce((sum, slug) => sum + payload.db.collections[slug].schema.indexes().length, 0);
  assert.equal(plannedIndexes, 53, "Payload index plan changed; stop before index creation");
  for (const name of ALLOWED_COLLECTIONS) {
    if (!snapshot.names.includes(name)) await db.createCollection(name);
    snapshot = await checkedSnapshot(0);
  }
  for (const slug of INGRESS_PAYLOAD_COLLECTIONS) {
    await payload.db.collections[slug].ensureIndexes();
    snapshot = await checkedSnapshot(0);
  }
  await db.collection("crm-assignment-counters").createIndex({ key: 1, office: 1 }, { unique: true });
  snapshot = await checkedSnapshot(0);
  assert.equal(snapshot.names.length, CAPS.namespaces);
  assert.equal(snapshot.secondaryIndexes, CAPS.secondaryIndexes);
  assert.ok(Object.values(snapshot.counts).every((count) => count === 0), "Schema created unexpected documents");
  assertRequiredIndexes(snapshot.indexes);
  manifest.schema = summary(snapshot);
  save();

  operation = "seed three synthetic records";
  const office = await payload.create({ collection: "crm-offices", overrideAccess: true, data: { name: "Noida", code: "noida", active: true } });
  snapshot = await checkedSnapshot(0);
  assert.equal(snapshot.counts["crm-offices"], 1);
  const now = new Date();
  const userId = new ObjectId();
  await db.collection("users").insertOne({ _id: userId, email: `${manifest.runMarker}.salesperson@example.invalid`, name: "Synthetic Atomic Salesperson", role: "salesperson", office: new ObjectId(String(office.id)), active: true, eligibleForAssignment: true, rotationOrder: 1, createdAt: now, updatedAt: now });
  snapshot = await checkedSnapshot(0);
  assert.equal(snapshot.counts.users, 1);
  const counterId = new ObjectId();
  await db.collection("crm-assignment-counters").insertOne({ _id: counterId, key: COUNTER_KEY, office: new ObjectId(String(office.id)), sequence: 0, createdAt: now, updatedAt: now });
  snapshot = await checkedSnapshot(0);
  assert.equal(snapshot.counts["crm-assignment-counters"], 1);
  assert.equal(snapshot.sequence, 0);
  manifest.seed = { officeId: String(office.id), salespersonId: String(userId), counterId: String(counterId), snapshot: summary(snapshot) };
  save();
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  assert.equal(mongoose.connection.db?.databaseName, TARGET.database);
  assert.equal(mongoose.connection.host, TARGET.host);
  assert.equal(mongoose.connection.port, TARGET.port);
  await verifyCommitted(await checkedSnapshot(0));
}

async function execute() {
  // Fresh absent-target and other-database checks occur immediately before any schema work.
  await client.connect();
  const preflight = await readOnlyAtomicPreflight(client, URI);
  manifest = { status: "PREFLIGHT_PASS", runMarker: `noida-atomic-${randomUUID()}`, target: TARGET, limits: CAPS,
    preflight: { server: preflight.server, databaseNames: preflight.databaseNames, otherDatabases: preflight.otherDatabases, targetAbsent: true }, attempts: [] };
  protectEvidence();
  save();
  process.env.NODE_ENV = "test";
  process.env.PAYLOAD_DISABLE_DEPENDENCY_CHECKER = "true";
  process.env.MONGODB_URI = URI;
  process.env.PAYLOAD_SECRET = randomBytes(48).toString("base64url");
  process.env.__NEXT_PROCESSED_ENV = "true";
  process.env.NEXT_TELEMETRY_DISABLED = "1";
  await initializeSchemaAndSeed();

  const keys = Object.fromEntries(["estate", "central", "activity", "race", "omanaReject", "omana"].map((name) => [name, randomUUID()]));
  await runCase("estate-success", { central: 1, legacy: 1, activities: 2, counterAdvances: 1 }, async () => {
    const result = await estateAttempt(identity(1), keys.estate);
    assert.equal(result.duplicate, false);
    return { centralId: result.id, legacyId: result.legacyId };
  }, { estate: 1, central: 1, activities: 2, counter: 1 });
  await runCase("estate-replay", {}, async () => {
    const result = await estateAttempt(identity(1), keys.estate);
    assert.equal(result.duplicate, true);
    return { centralId: result.id, legacyId: result.legacyId, duplicate: true };
  }, {});
  await runCase("estate-central-rejection", { central: 1, legacy: 1, activities: 2, counterAdvances: 1 }, async () => {
    await assert.rejects(estateAttempt(identity(2), keys.central, { beforeLeadInsert: () => { throw new Error("Injected central insert rejection"); } }), /Injected central insert rejection/);
    return "transaction rolled back before central insert";
  }, {});
  await runCase("estate-activity-rejection", { central: 1, legacy: 1, activities: 2, counterAdvances: 1 }, async () => {
    await assert.rejects(estateAttempt(identity(3), keys.activity, { beforeActivityInsert: () => { throw new Error("Injected activity insert rejection"); } }), /Injected activity insert rejection/);
    return "transaction rolled back before activity insert";
  }, {});
  await runRace(identity(4), keys.race);
  await runCase("omana-legacy-rejection", { central: 1, legacy: 1, activities: 2, counterAdvances: 1 }, async () => {
    await assert.rejects(omanaAttempt(identity(5), keys.omanaReject, { beforeLegacyInsert: () => { throw new Error("Injected Omana legacy insert rejection"); } }), /Injected Omana legacy insert rejection/);
    return "transaction rolled back before Omana legacy insert";
  }, {});
  await runCase("omana-success", { central: 1, legacy: 1, activities: 2, counterAdvances: 1 }, async () => {
    const result = await omanaAttempt(identity(6), keys.omana);
    assert.equal(result.duplicate, false);
    return { centralId: result.id, legacyId: result.legacyId };
  }, { omana: 1, central: 1, activities: 2, counter: 1 });
  await runCase("omana-replay", {}, async () => {
    const result = await omanaAttempt(identity(6), keys.omana);
    assert.equal(result.duplicate, true);
    return { centralId: result.id, legacyId: result.legacyId, duplicate: true };
  }, {});

  assert.equal(manifest.attempts.length, CAPS.attempts);
  const final = await checkedSnapshot(CAPS.attempts);
  assert.equal(final.counts["central-leads"], 3);
  assert.equal(final.counts[ESTATE], 2);
  assert.equal(final.counts[OMANA], 1);
  assert.equal(final.counts["crm-activities"], 6);
  assert.equal(final.sequence, 3);
  manifest.audit = await verifyCommitted(final);
  manifest.final = summary(final);
  manifest.status = "PASS";
  manifest.finishedAt = new Date().toISOString();
  save();
  return { status: "PASS", target: TARGET, attempts: CAPS.attempts, counts: final.counts, counterSequence: final.sequence, otherDatabasesUnchanged: true, evidencePath };
}

let result;
let failure;
try {
  result = await execute();
} catch (error) {
  failure = { status: "FAIL_STOPPED", operation, error: safeMongoFailure(error, operation), evidencePath: evidencePath ?? null };
  if (manifest) {
    manifest.status = "FAIL_STOPPED";
    manifest.failure = failure;
    try { save(); } catch { failure.evidencePreserved = false; }
  }
  process.exitCode = 1;
} finally {
  try { await payload?.destroy?.(); } catch {}
  try { await mongoose?.disconnect?.(); } catch {}
  try { await client.close(); } catch {}
}
if (failure) process.stderr.write(`${JSON.stringify(failure)}\n`);
else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
