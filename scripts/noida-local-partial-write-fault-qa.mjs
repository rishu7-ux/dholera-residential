import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MongoClient, ObjectId } from "mongodb";

import { INGRESS_PAYLOAD_COLLECTIONS } from "../lib/noida-local-ingress-qa-config.mjs";
import { buildLocalFaultConfig } from "../lib/noida-local-fault-config.mjs";
import { APPROVAL_TEXT, ALLOWED_COLLECTIONS, CAPS, CASES, TARGET, URI, assertAbsentTarget, assertAttemptPlan, assertCapacity, assertExactTarget, assertExecutionGate, assertScope, digest } from "../lib/noida-local-fault-qa.mjs";
import { assertOtherDatabasesUnchanged, readOnlyFaultPreflight, snapshotOtherDatabases } from "../lib/noida-local-fault-preflight.mjs";
import { safeMongoFailure } from "../lib/noida-local-demo-target.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const EVIDENCE_ROOT = resolve(ROOT, ".artifacts/noida-local-fault-qa-20261021");
const ESTATE_COLLECTION = "estate1-enquiries";
const OMANA_COLLECTION = "omana-enquiries";
const COUNTER_KEY = "noida-shared-lead-round-robin";

if (process.argv.length === 2 || process.argv[2] === "--plan") {
  assert.deepEqual(process.argv.slice(2), process.argv.length === 2 ? [] : ["--plan"]);
  assertAttemptPlan();
  console.log(JSON.stringify({ status: "AWAITING_SEPARATE_OWNER_APPROVAL", target: TARGET, caps: CAPS, cases: CASES, approval: APPROVAL_TEXT }, null, 2));
  process.exit(0);
}

assertExecutionGate(process.argv.slice(2), process.env);
assert.equal(process.cwd(), ROOT, "Run only from the Master CMS workspace");
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

function protectedEvidenceDirectory() {
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
  const leads = [];
  const activities = [];
  let secondaryIndexes = 0;
  for (const name of names) {
    const collection = db.collection(name);
    const rows = await collection.find({}).sort({ _id: 1 }).toArray();
    const indexes = await collection.listIndexes().toArray();
    counts[name] = rows.length;
    ids[name] = rows.map((row) => String(row._id));
    documentDigests[name] = digest(rows);
    secondaryIndexes += indexes.filter((index) => !(Object.keys(index.key ?? {}).length === 1 && index.key._id === 1)).length;
    if (name === "central-leads") leads.push(...rows.map((row) => ({ id: String(row._id), key: row.idempotencyKey, legacyCollection: row.legacyCollection ?? null, legacyId: row.legacyId == null ? null : String(row.legacyId), assignedSalesperson: row.assignedSalesperson == null ? null : String(row.assignedSalesperson), assignmentSequence: row.assignmentSequence ?? null, consent: row.consent === true })));
    if (name === "crm-activities") activities.push(...rows.map((row) => ({ id: String(row._id), lead: String(row.lead), event: row.event })));
  }
  const counters = names.includes("crm-assignment-counters") ? await db.collection("crm-assignment-counters").find({}).toArray() : [];
  assert.ok(counters.length <= 1);
  return { names, counts, ids, documentDigests, leads, activities, secondaryIndexes, sequence: counters[0]?.sequence ?? 0, digest: digest({ names, counts, ids, documentDigests, leads, activities, secondaryIndexes, sequence: counters[0]?.sequence ?? 0 }) };
}

async function checkedSnapshot(attempts) {
  const snapshot = await targetSnapshot();
  assertScope(snapshot, { attempts });
  if (manifest.seed) {
    for (const name of ["crm-offices", "users"]) {
      assert.equal(snapshot.documentDigests[name], manifest.seed.snapshot.documentDigests[name], `Seed ${name} changed`);
    }
  }
  assertOtherDatabasesUnchanged(manifest.preflight.otherDatabases, await snapshotOtherDatabases(client));
  return snapshot;
}

function summary(snapshot) {
  return { names: snapshot.names, counts: snapshot.counts, ids: snapshot.ids, documentDigests: snapshot.documentDigests, leads: snapshot.leads, activities: snapshot.activities, secondaryIndexes: snapshot.secondaryIndexes, sequence: snapshot.sequence, digest: snapshot.digest };
}

function delta(before, after, expected) {
  assert.equal((after.counts[ESTATE_COLLECTION] ?? 0) - (before.counts[ESTATE_COLLECTION] ?? 0), expected.estate ?? 0, "Estate legacy delta");
  assert.equal((after.counts[OMANA_COLLECTION] ?? 0) - (before.counts[OMANA_COLLECTION] ?? 0), expected.omana ?? 0, "Omana legacy delta");
  assert.equal((after.counts["central-leads"] ?? 0) - (before.counts["central-leads"] ?? 0), expected.central ?? 0, "Central lead delta");
  assert.equal((after.counts["crm-activities"] ?? 0) - (before.counts["crm-activities"] ?? 0), expected.activities ?? 0, "Activity delta");
  assert.equal(after.sequence - before.sequence, expected.counter ?? 0, "Counter delta");
  const previousActivityIds = new Set(before.activities.map((activity) => activity.id));
  const addedActivities = after.activities.filter((activity) => !previousActivityIds.has(activity.id));
  if (expected.activities === 2) {
    assert.deepEqual(addedActivities.map((activity) => activity.event).sort(), ["assigned", "created"]);
    assert.equal(new Set(addedActivities.map((activity) => activity.lead)).size, 1);
    const addedLead = after.leads.find((lead) => lead.id === addedActivities[0].lead);
    assert.ok(addedLead?.consent && addedLead.assignedSalesperson === manifest.seed.salespersonId);
  }
}

function synthetic(index) {
  return { name: `Synthetic Fault Lead ${index}`, email: `${manifest.runMarker}.${index}@example.invalid`, phone: `98765${String(index).padStart(5, "0")}` };
}

function centralInput(identity, key, legacyId) {
  return { ...identity, website: "dholera-estate-1", leadType: "enquiry", source: "estate1-popup-form", project: "Synthetic Fault Project", message: "Synthetic local fault QA", consent: true, idempotencyKey: key, legacyCollection: ESTATE_COLLECTION, legacyId };
}

function estateData(identity) {
  return { ...identity, message: "Synthetic local fault QA", source: "estate1-popup-form", status: "new" };
}

function payloadWithFault({ rejectCreate, rejectDelete } = {}) {
  return new Proxy(payload, { get(target, property, receiver) {
    if (property === "create" && rejectCreate) return async (args) => {
      if (args.collection === rejectCreate) throw new Error("Injected legacy create rejection");
      return target.create(args);
    };
    if (property === "delete" && rejectDelete) return async (args) => {
      if (args.collection === rejectDelete) throw new Error("Injected duplicate cleanup rejection");
      return target.delete(args);
    };
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  } });
}

async function estateAttempt(identity, key, { payloadOverride = payload, hooks = {}, afterCommitFault = false, barrier } = {}) {
  const { createLegacyForCentralLead } = await import("../lib/crm/legacy-ingress.ts");
  const { ingestCentralLead } = await import("../lib/crm/ingest.ts");
  return createLegacyForCentralLead({
    payload: payloadOverride,
    collection: ESTATE_COLLECTION,
    data: estateData(identity),
    idempotencyKey: key,
    ingest: async (legacyId) => {
      if (barrier) await barrier();
      const result = await ingestCentralLead(centralInput(identity, key, legacyId), hooks);
      if (afterCommitFault) throw new Error("Injected post-commit acknowledgement loss");
      return result;
    },
  });
}

function expectPartial(error, phase) {
  assert.equal(error?.name, "LegacyIngressPartialWriteError");
  assert.equal(error.phase, phase);
  assert.equal(error.collection, ESTATE_COLLECTION);
  assert.ok(error.legacyId);
  return true;
}

async function runCase(name, reservation, work, expected) {
  assert.equal(CASES[manifest.attempts.length], name, "Attempt order changed");
  const before = await checkedSnapshot(manifest.attempts.length);
  assertCapacity(before, { ...reservation, attempts: manifest.attempts.length + 1 });
  const row = { name, status: "STARTED", before: summary(before), startedAt: new Date().toISOString() };
  manifest.attempts.push(row);
  save();
  operation = `fault case ${name}`;
  row.outcome = await work();
  const after = await checkedSnapshot(manifest.attempts.length);
  delta(before, after, expected);
  row.after = summary(after);
  row.status = "PASS";
  row.finishedAt = new Date().toISOString();
  save();
  return after;
}

async function runRace(identity, key) {
  const before = await checkedSnapshot(manifest.attempts.length);
  assertCapacity(before, { attempts: manifest.attempts.length + 2, central: 2, legacy: 2, activities: 4, counterAdvances: 2 });
  assert.deepEqual(CASES.slice(manifest.attempts.length, manifest.attempts.length + 2), ["race-attempt-a", "race-attempt-b"]);
  const rows = ["race-attempt-a", "race-attempt-b"].map((name) => ({ name, status: "STARTED", before: summary(before), startedAt: new Date().toISOString() }));
  manifest.attempts.push(...rows);
  save();
  operation = "two-attempt same-key race";
  let waiting = 0;
  let release;
  const gate = new Promise((resolveGate) => { release = resolveGate; });
  const barrier = async () => {
    waiting += 1;
    if (waiting === 2) release();
    let timeout;
    try {
      await Promise.race([gate, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Race barrier timed out")), 5000); })]);
    } finally {
      clearTimeout(timeout);
    }
  };
  const attempts = await Promise.allSettled([
    estateAttempt(identity, key, { payloadOverride: payloadWithFault({ rejectDelete: ESTATE_COLLECTION }), barrier }),
    estateAttempt(identity, key, { payloadOverride: payloadWithFault({ rejectDelete: ESTATE_COLLECTION }), barrier }),
  ]);
  assert.equal(attempts.filter((item) => item.status === "fulfilled" && item.value.duplicate === false).length, 1);
  assert.equal(attempts.filter((item) => item.status === "rejected" && expectPartial(item.reason, "duplicate-cleanup")).length, 1);
  const after = await checkedSnapshot(manifest.attempts.length);
  delta(before, after, { estate: 2, central: 1, activities: 2, counter: 1 });
  assert.ok(after.leads.some((lead) => lead.key === key && lead.legacyCollection === ESTATE_COLLECTION && after.ids[ESTATE_COLLECTION].includes(lead.legacyId)));
  for (const [index, row] of rows.entries()) {
    row.status = "PASS";
    row.outcome = attempts[index].status === "fulfilled" ? "winner" : "duplicate-cleanup-error";
    row.after = summary(after);
    row.finishedAt = new Date().toISOString();
  }
  save();
}

async function initializeSchemaAndSeed() {
  operation = "initialize approved schema";
  const [{ getPayload }, { mongooseAdapter }, configModule, mongooseModule] = await Promise.all([
    import("payload"), import("@payloadcms/db-mongodb"), import("../payload.config.ts"), import("mongoose"),
  ]);
  const config = buildLocalFaultConfig({ sourceConfig: await configModule.default, mongooseAdapter });
  assertExactTarget(process.env.MONGODB_URI);
  const namesBeforePayload = (await client.db("admin").command({ listDatabases: 1, nameOnly: true })).databases.map((row) => row.name);
  const collectionsBeforePayload = (await client.db(TARGET.database).listCollections({}, { nameOnly: true }).toArray()).map((row) => row.name);
  assertAbsentTarget(namesBeforePayload, collectionsBeforePayload);
  mongoose = mongooseModule.default;
  payload = await getPayload({ config });
  assert.equal(payload.db.url, URI);
  assert.equal(payload.db.ensureIndexes, false);
  assert.equal(payload.db.connectOptions.autoIndex, false);
  assert.equal(payload.db.connection?.db?.databaseName, TARGET.database);
  let snapshot = await checkedSnapshot(0);
  assert.ok(snapshot.names.every((name) => ALLOWED_COLLECTIONS.includes(name)));
  const plannedIndexes = INGRESS_PAYLOAD_COLLECTIONS.reduce((total, slug) => total + payload.db.collections[slug].schema.indexes().length, 0);
  assert.equal(plannedIndexes, 53, "Payload schema indexes changed; stop before index creation");
  const db = client.db(TARGET.database);
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
  assert.ok(Object.values(snapshot.counts).every((count) => count === 0), "Schema setup unexpectedly created documents");
  manifest.schema = summary(snapshot);
  save();

  operation = "seed three synthetic records";
  const office = await payload.create({ collection: "crm-offices", overrideAccess: true, data: { name: "Noida", code: "noida", active: true } });
  snapshot = await checkedSnapshot(0);
  assert.equal(snapshot.counts["crm-offices"], 1);
  const now = new Date();
  const userId = new ObjectId();
  await db.collection("users").insertOne({ _id: userId, email: `${manifest.runMarker}.salesperson@example.invalid`, name: "Synthetic Fault Salesperson", role: "salesperson", office: new ObjectId(String(office.id)), active: true, eligibleForAssignment: true, rotationOrder: 1, createdAt: now, updatedAt: now });
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
}

async function execute() {
  operation = "read-only preflight";
  await client.connect();
  const preflight = await readOnlyFaultPreflight(client, URI);
  manifest = { status: "PREFLIGHT_PASS", runMarker: `noida-fault-${randomUUID()}`, target: TARGET, limits: CAPS, preflight: { server: preflight.server, databaseNames: preflight.databaseNames, otherDatabases: preflight.otherDatabases, targetAbsent: true }, attempts: [] };
  protectedEvidenceDirectory();
  save();
  process.env.NODE_ENV = "test";
  process.env.PAYLOAD_DISABLE_DEPENDENCY_CHECKER = "true";
  process.env.MONGODB_URI = URI;
  process.env.PAYLOAD_SECRET = randomBytes(48).toString("base64url");
  process.env.__NEXT_PROCESSED_ENV = "true";
  process.env.NEXT_TELEMETRY_DISABLED = "1";
  await initializeSchemaAndSeed();
  const keys = Object.fromEntries(["rotation", "central", "activity", "race", "omana", "uncertain"].map((name) => [name, randomUUID()]));

  await runCase("legacy-create-failure", { legacy: 1 }, async () => {
    await assert.rejects(estateAttempt(synthetic(1), randomUUID(), { payloadOverride: payloadWithFault({ rejectCreate: ESTATE_COLLECTION }) }), /Injected legacy create rejection/);
    return "legacy create rejected before central ingestion";
  }, {});
  await runCase("after-rotation-failure", { legacy: 1, central: 1, activities: 2, counterAdvances: 1 }, async () => {
    await assert.rejects(estateAttempt(synthetic(2), keys.rotation, { hooks: { afterRotation: () => { throw new Error("Injected after-rotation rejection"); } } }), (error) => expectPartial(error, "central-ingest"));
    return { key: keys.rotation, result: "legacy orphan; central transaction rejected" };
  }, { estate: 1 });
  await runCase("central-insert-failure", { legacy: 1, central: 1, activities: 2, counterAdvances: 1 }, async () => {
    await assert.rejects(estateAttempt(synthetic(3), keys.central, { hooks: { beforeLeadInsert: () => { throw new Error("Injected central insert rejection"); } } }), (error) => expectPartial(error, "central-ingest"));
    return { key: keys.central, result: "legacy orphan; central transaction rejected" };
  }, { estate: 1 });
  await runCase("activity-insert-failure", { legacy: 1, central: 1, activities: 2, counterAdvances: 1 }, async () => {
    await assert.rejects(estateAttempt(synthetic(4), keys.activity, { hooks: { beforeActivityInsert: () => { throw new Error("Injected activity insert rejection"); } } }), (error) => expectPartial(error, "central-ingest"));
    return { key: keys.activity, result: "legacy orphan; lead and rotation rolled back" };
  }, { estate: 1 });
  await runRace(synthetic(5), keys.race);
  await runCase("omana-legacy-failure", { central: 1, activities: 2, counterAdvances: 1 }, async () => {
    const { ingestCentralLead } = await import("../lib/crm/ingest.ts");
    const identity = synthetic(6);
    const central = await ingestCentralLead({ ...identity, website: "omana-projects", leadType: "enquiry", source: "omana-global-drawer", project: "Synthetic Fault Project", page: "/", consent: true, idempotencyKey: keys.omana });
    assert.equal(central.duplicate, false);
    await assert.rejects(payloadWithFault({ rejectCreate: OMANA_COLLECTION }).create({ collection: OMANA_COLLECTION, data: { ...identity, selectedProject: "Synthetic Fault Project", selectedProjectSlug: "synthetic-fault", page: "/", source: "omana-global-drawer", consent: true, status: "new" } }), /Injected legacy create rejection/);
    return { key: keys.omana, centralId: central.id, result: "central committed; Omana legacy rejected" };
  }, { central: 1, activities: 2, counter: 1 });
  await runCase("estate-retry", { legacy: 1, central: 1, activities: 2, counterAdvances: 1 }, async () => {
    const result = await estateAttempt(synthetic(2), keys.rotation);
    assert.equal(result.duplicate, false);
    return { key: keys.rotation, legacyId: String(result.legacyId) };
  }, { estate: 1, central: 1, activities: 2, counter: 1 });
  await runCase("omana-retry", {}, async () => {
    const { ingestCentralLead } = await import("../lib/crm/ingest.ts");
    const duplicate = await ingestCentralLead({ ...synthetic(6), website: "omana-projects", leadType: "enquiry", source: "omana-global-drawer", project: "Synthetic Fault Project", page: "/", consent: true, idempotencyKey: keys.omana });
    assert.equal(duplicate.duplicate, true);
    return { key: keys.omana, result: "central duplicate; non-chat route would skip missing legacy" };
  }, {});
  await runCase("uncertain-commit", { legacy: 1, central: 1, activities: 2, counterAdvances: 1 }, async () => {
    await assert.rejects(estateAttempt(synthetic(7), keys.uncertain, { afterCommitFault: true }), (error) => expectPartial(error, "central-ingest"));
    return { key: keys.uncertain, result: "post-commit acknowledgement lost" };
  }, { estate: 1, central: 1, activities: 2, counter: 1 });
  await runCase("uncertain-replay", {}, async () => {
    const duplicate = await estateAttempt(synthetic(7), keys.uncertain);
    assert.equal(duplicate.duplicate, true);
    return { key: keys.uncertain, result: "same key returned duplicate without new writes" };
  }, {});
  assert.equal(manifest.attempts.length, CAPS.attempts);
  const final = await checkedSnapshot(CAPS.attempts);
  assert.equal(final.counts["central-leads"], 4);
  assert.equal(final.counts[ESTATE_COLLECTION], 7);
  assert.equal(final.counts[OMANA_COLLECTION], 0);
  assert.equal(final.counts["crm-activities"], 8);
  assert.equal(final.sequence, 4);
  assert.equal(final.leads.length, 4);
  assert.deepEqual(final.leads.map((lead) => lead.assignmentSequence).sort((left, right) => left - right), [1, 2, 3, 4]);
  assert.ok(final.leads.every((lead) => lead.consent && lead.assignedSalesperson === manifest.seed.salespersonId));
  assert.equal(final.leads.filter((lead) => lead.legacyCollection === ESTATE_COLLECTION && final.ids[ESTATE_COLLECTION].includes(lead.legacyId)).length, 3);
  assert.equal(final.leads.filter((lead) => lead.key === keys.omana && lead.legacyId === null).length, 1);
  manifest.status = "PASS";
  manifest.final = summary(final);
  manifest.finishedAt = new Date().toISOString();
  save();
  return { status: "PASS", target: TARGET, attempts: manifest.attempts.length, counts: final.counts, counterSequence: final.sequence, otherDatabasesUnchanged: true, evidencePath };
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
