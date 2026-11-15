import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BSON, MongoClient } from "mongodb";

import { assertNoInheritedServices, safeMongoFailure, verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";
import { buildLocalIngressQAConfig, INGRESS_MONGO_COLLECTIONS, INGRESS_PAYLOAD_COLLECTIONS } from "../lib/noida-local-ingress-qa-config.mjs";

const TARGET = Object.freeze({ host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: "noida-crm-ingress-qa-20261021" });
const URI = `mongodb://${TARGET.host}:${TARGET.port}/${TARGET.database}?replicaSet=${TARGET.replicaSet}&directConnection=true`;
const APPROVAL = "APPROVE LOCAL INGRESS QA SCHEMA INITIALIZATION";
const PRIOR_RUN = "noida-ingress-a3ec5ad6-1fd0-4cc5-af78-4f273abf93cd";
const EVIDENCE_DIR = resolve(process.cwd(), ".artifacts/noida-local-ingress-qa-20261021");
const PRIOR_MANIFEST = resolve(EVIDENCE_DIR, `${PRIOR_RUN}.manifest.json`);
const manifestPath = resolve(EVIDENCE_DIR, `noida-ingress-schema-${randomUUID()}.manifest.json`);
const EXPECTED_INITIAL_COLLECTIONS = ["central-leads", "crm-offices", "crm-teams", "users"];
const WATCHED = {
  demo: { database: "noida-crm-demo-20261019", collections: ["users", "central-leads", "crm-activities", "crm-assignment-counters"] },
  workflowQA: { database: "noida-crm-workflow-qa-20261019", collections: ["users", "crm-offices", "crm-teams", "central-leads", "crm-activities", "payload-preferences"] },
};

if (process.argv.slice(2).length !== 2 || !process.argv.slice(2).includes("--execute") || !process.argv.slice(2).includes(`--approval=${APPROVAL}`)) {
  throw new Error("Exact schema-only approval and execution flags are required.");
}
assertNoInheritedServices(process.env);
assert.equal(new URL(URI).hostname, TARGET.host);
assert.equal(Number(new URL(URI).port), TARGET.port);
assert.equal(new URL(URI).pathname, `/${TARGET.database}`);
assert.equal(new URL(URI).username, "");
assert.equal(new URL(URI).password, "");
assert.equal(new URL(URI).searchParams.get("replicaSet"), TARGET.replicaSet);
assert.equal(new URL(URI).searchParams.get("directConnection"), "true");

const evidenceInfo = lstatSync(EVIDENCE_DIR);
assert.ok(evidenceInfo.isDirectory() && !evidenceInfo.isSymbolicLink() && (evidenceInfo.mode & 0o777) === 0o700);
assert.equal(realpathSync(EVIDENCE_DIR), EVIDENCE_DIR);
const priorInfo = lstatSync(PRIOR_MANIFEST);
assert.ok(priorInfo.isFile() && !priorInfo.isSymbolicLink() && (priorInfo.mode & 0o777) === 0o600);
assert.equal(realpathSync(PRIOR_MANIFEST), PRIOR_MANIFEST);
const priorManifest = JSON.parse(readFileSync(PRIOR_MANIFEST, "utf8"));
assert.equal(priorManifest.runMarker, PRIOR_RUN);
assert.equal(priorManifest.status, "partial-failure");
assert.deepEqual(priorManifest.target, TARGET);
assert.equal(priorManifest.failure?.code, 26);
assert.equal(priorManifest.failure?.codeName, "NamespaceNotFound");
assert.deepEqual(priorManifest.ids, { office: null, team: null, users: [], centralLeads: [], legacy: [], activities: [], assignmentCounter: null });

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
let payload;
let manifest;
let operation = "read-only preflight";
let initializationStarted = false;
const originalLog = console.log;
const originalError = console.error;

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
  assert.equal(realpathSync(manifestPath), manifestPath);
}

async function collectionCounts(db, names) {
  const counts = {};
  for (const name of names) counts[name] = await db.collection(name).countDocuments({});
  return counts;
}

async function snapshot(database, names) {
  const result = {};
  for (const name of names) {
    const docs = await client.db(database).collection(name).find({}).sort({ _id: 1 }).toArray();
    const digest = createHash("sha256");
    for (const doc of docs) digest.update(BSON.serialize(doc));
    result[name] = { count: docs.length, digest: digest.digest("hex") };
  }
  return result;
}

function indexSignature(key, unique) {
  return `${JSON.stringify(Object.entries(key).sort(([left], [right]) => left.localeCompare(right)))}:${unique ? "unique" : "plain"}`;
}

async function main() {
  operation = "verify approved loopback server and exact existing empty database state";
  await client.connect();
  const server = await verifyLocalDemoServer(client, { requireEmpty: false });
  const hello = await client.db("admin").command({ hello: 1 });
  assert.equal(hello.setName, TARGET.replicaSet);
  assert.equal(hello.me, `${TARGET.host}:${TARGET.port}`);
  assert.deepEqual(hello.hosts, [`${TARGET.host}:${TARGET.port}`]);
  const databaseNames = (await client.db("admin").command({ listDatabases: 1, nameOnly: true })).databases.map(({ name }) => name);
  assert.ok(databaseNames.includes(TARGET.database), "the expected partial QA database must exist");
  const db = client.db(TARGET.database);
  const collectionNames = (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name).sort();
  assert.deepEqual(collectionNames, EXPECTED_INITIAL_COLLECTIONS);
  assert.deepEqual(await collectionCounts(db, collectionNames), Object.fromEntries(collectionNames.map((name) => [name, 0])));
  for (const collection of collectionNames) {
    const indexes = await db.collection(collection).listIndexes().toArray();
    assert.deepEqual(indexes.map(({ key }) => key), [{ _id: 1 }], `unexpected preexisting index on ${collection}`);
  }

  const beforeSnapshots = {};
  for (const [key, value] of Object.entries(WATCHED)) {
    beforeSnapshots[key] = await snapshot(value.database, value.collections);
    assert.deepEqual(beforeSnapshots[key], priorManifest.beforeSnapshots[key]);
  }
  manifest = {
    schema: 1,
    runMarker: `noida-ingress-schema-${randomUUID()}`,
    target: TARGET,
    status: "preflight-passed",
    approval: "Owner approved only the 16 ingress collection namespaces and 53 Payload schema indexes; zero documents.",
    priorFailureManifest: PRIOR_MANIFEST,
    beforeSnapshots,
    before: { collections: collectionNames, documentCounts: Object.fromEntries(collectionNames.map((name) => [name, 0])), customIndexes: 0 },
    expected: { payloadCollections: 16, schemaIndexes: 53, requiredUniqueIndexes: 6, documentCount: 0 },
    checks: { loopback: "PASS", priorFailureEvidence: "PASS", noInheritedExternalConfiguration: "PASS", preservedDatabaseSnapshots: "PASS" },
  };
  saveManifest();

  // All following initialization writes are scoped to these 16 models and their 53 schema indexes.
  initializationStarted = true;
  operation = "initialize only ingress Payload models and await their indexes";
  process.env.NODE_ENV = "test";
  process.env.PAYLOAD_DISABLE_DEPENDENCY_CHECKER = "true";
  process.env.MONGODB_URI = URI;
  process.env.PAYLOAD_SECRET = randomBytes(48).toString("base64url");
  process.env.__NEXT_PROCESSED_ENV = "true";
  process.env.NEXT_TELEMETRY_DISABLED = "1";

  const [{ getPayload }, { mongooseAdapter }, configModule] = await Promise.all([
    import("payload"),
    import("@payloadcms/db-mongodb"),
    import("../payload.config.ts"),
  ]);
  const sourceConfig = await configModule.default;
  const config = buildLocalIngressQAConfig({ sourceConfig, uri: URI, mongooseAdapter });
  payload = await getPayload({ config });
  assert.equal(payload.db.ensureIndexes, true);
  assert.equal(payload.db.connectOptions.autoIndex, false);
  assert.equal(payload.db.url, URI);
  assert.equal(payload.db.connection?.db?.databaseName, TARGET.database);
  const liveHello = await payload.db.connection.getClient().db("admin").command({ hello: 1 });
  assert.equal(liveHello.setName, TARGET.replicaSet);
  assert.equal(liveHello.me, `${TARGET.host}:${TARGET.port}`);

  operation = "verify exact collection and schema-index inventory without creating documents";
  const afterNames = (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name).sort();
  assert.deepEqual(afterNames, [...INGRESS_MONGO_COLLECTIONS].sort());
  const modelIndexes = new Map();
  for (const slug of INGRESS_PAYLOAD_COLLECTIONS) {
    const model = payload.db.collections[slug];
    assert.ok(model, `missing QA model ${slug}`);
    const collectionName = model.collection.collectionName;
    const schemaIndexes = model.schema.indexes().map(([key, options]) => indexSignature(key, options.unique === true));
    modelIndexes.set(collectionName, schemaIndexes);
  }
  const schemaIndexCount = [...modelIndexes.values()].reduce((total, indexes) => total + indexes.length, 0);
  assert.equal(schemaIndexCount, 53);
  const actualIndexInventory = {};
  let totalIndexCount = 0;
  for (const collectionName of afterNames) {
    const actual = await db.collection(collectionName).listIndexes().toArray();
    actualIndexInventory[collectionName] = actual.map(({ key, unique }) => ({ key, unique: unique === true }));
    totalIndexCount += actual.length;
    const actualSchemaIndexes = actual.filter(({ key }) => !(Object.keys(key).length === 1 && key._id === 1)).map(({ key, unique }) => indexSignature(key, unique === true)).sort();
    assert.deepEqual(actualSchemaIndexes, modelIndexes.get(collectionName)?.slice().sort(), `schema index mismatch in ${collectionName}`);
  }
  assert.equal(totalIndexCount, 69, "53 schema indexes plus 16 standard _id indexes expected");

  const required = [["users", "email"], ["crm-offices", "name"], ["crm-offices", "code"], ["crm-teams", "office"], ["crm-teams", "teamLeader"], ["central-leads", "idempotencyKey"]];
  const requiredUniqueIndexes = required.map(([collection, field]) => {
    const matched = (actualIndexInventory[collection] ?? []).some((index) => index.unique && Object.keys(index.key).length === 1 && index.key[field] === 1);
    assert.equal(matched, true, `required unique index missing: ${collection}.${field}`);
    return `${collection}.${field}`;
  });
  const counts = await collectionCounts(db, afterNames);
  assert.ok(Object.values(counts).every((count) => count === 0), "schema initialization must create zero documents");

  operation = "verify unrelated local QA databases remain byte-for-byte unchanged";
  for (const [key, value] of Object.entries(WATCHED)) {
    assert.deepEqual(await snapshot(value.database, value.collections), beforeSnapshots[key]);
  }

  manifest.status = "verified-schema-only";
  manifest.after = { collections: afterNames, documentCounts: counts, payloadSchemaIndexes: schemaIndexCount, totalIndexesIncludingId: totalIndexCount, requiredUniqueIndexes };
  manifest.checks.awaitedIndexes = "PASS";
  manifest.checks.zeroDocumentsCreated = "PASS";
  manifest.checks.otherDatabasesUnchanged = "PASS";
  saveManifest();
  return { status: "PASS", target: TARGET, server: { pid: server.pid, version: server.version, replicaSet: server.replicaSet }, collections: afterNames.length, collectionNames: afterNames, payloadSchemaIndexes: schemaIndexCount, totalIndexesIncludingId: totalIndexCount, requiredUniqueIndexes, documentCount: Object.values(counts).reduce((sum, count) => sum + count, 0), manifest: manifestPath };
}

let result;
let failure;
try {
  console.log = () => {};
  console.error = () => {};
  result = await main();
} catch (error) {
  if (manifest) {
    manifest.status = initializationStarted ? "partial-schema-initialization-failure" : "preflight-failure";
    manifest.failure = safeMongoFailure(error, operation);
    try { saveManifest(); } catch {}
  }
  failure = { status: "FAIL", operation, error: safeMongoFailure(error, operation), manifest: manifest ? manifestPath : null, fixtureCreation: "not-run" };
  process.exitCode = 1;
} finally {
  try { await payload?.destroy?.(); } catch {}
  try { await client.close(); } catch {}
  console.log = originalLog;
  console.error = originalError;
}
if (failure) process.stderr.write(`${JSON.stringify(failure)}\n`);
else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
