import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { BSON, MongoClient } from "mongodb";

import { assertNoInheritedServices, safeMongoFailure, verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";

const target = Object.freeze({ host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: "noida-crm-ingress-qa-20261021" });
const uri = `mongodb://${target.host}:${target.port}/${target.database}?replicaSet=${target.replicaSet}&directConnection=true`;
const manifestPath = resolve(process.cwd(), ".artifacts/noida-local-ingress-qa-20261021/noida-ingress-a3ec5ad6-1fd0-4cc5-af78-4f273abf93cd.manifest.json");
assertNoInheritedServices(process.env);
assert.equal(new URL(uri).hostname, target.host);
assert.equal(Number(new URL(uri).port), target.port);
assert.equal(new URL(uri).pathname, `/${target.database}`);
assert.equal(new URL(uri).username, "");
assert.equal(new URL(uri).password, "");

const manifestInfo = lstatSync(manifestPath);
assert.ok(manifestInfo.isFile() && !manifestInfo.isSymbolicLink() && (manifestInfo.mode & 0o777) === 0o600);
assert.equal(realpathSync(manifestPath), manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.status, "partial-failure");
assert.deepEqual(manifest.target, target);
assert.deepEqual(manifest.ids, { office: null, team: null, users: [], centralLeads: [], legacy: [], activities: [], assignmentCounter: null });

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
const watched = {
  demo: { database: "noida-crm-demo-20261019", collections: ["users", "central-leads", "crm-activities", "crm-assignment-counters"] },
  workflowQA: { database: "noida-crm-workflow-qa-20261019", collections: ["users", "crm-offices", "crm-teams", "central-leads", "crm-activities", "payload-preferences"] },
};

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

let operation = "verify approved loopback database and preserved evidence";
try {
  await client.connect();
  const server = await verifyLocalDemoServer(client, { requireEmpty: false });
  const hello = await client.db("admin").command({ hello: 1 });
  assert.equal(hello.me, `${target.host}:${target.port}`);
  assert.equal(hello.setName, target.replicaSet);
  assert.deepEqual(hello.hosts, [`${target.host}:${target.port}`]);

  operation = "verify failed-run target remains document-empty";
  const dbs = (await client.db("admin").command({ listDatabases: 1, nameOnly: true })).databases.map(({ name }) => name);
  let targetCollections = [];
  let targetCounts = {};
  const targetIndexes = {};
  if (dbs.includes(target.database)) {
    const db = client.db(target.database);
    targetCollections = (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name).sort();
    for (const collection of targetCollections) {
      targetCounts[collection] = await db.collection(collection).countDocuments({});
      targetIndexes[collection] = (await db.collection(collection).listIndexes().toArray()).map(({ key, unique }) => ({ key, unique: unique === true }));
    }
  }
  assert.ok(Object.values(targetCounts).every((count) => count === 0));
  const requiredUniqueIndexes = [
    ["users", "email"],
    ["crm-offices", "name"],
    ["crm-offices", "code"],
    ["crm-teams", "office"],
    ["crm-teams", "teamLeader"],
    ["central-leads", "idempotencyKey"],
  ];
  const uniqueIndexesReady = requiredUniqueIndexes.every(([collection, field]) =>
    (targetIndexes[collection] ?? []).some((index) => index.unique && Object.keys(index.key).length === 1 && index.key[field] === 1),
  );

  operation = "verify demo and workflow QA document digests remain unchanged";
  const preserved = {};
  for (const [key, value] of Object.entries(watched)) {
    const current = await snapshot(value.database, value.collections);
    assert.deepEqual(current, manifest.beforeSnapshots[key]);
    preserved[key] = Object.fromEntries(Object.entries(current).map(([collection, record]) => [collection, record.count]));
  }

  process.stdout.write(`${JSON.stringify({
    status: "PASS",
    target,
    server: { pid: server.pid, version: server.version, replicaSet: server.replicaSet },
    ingressQA: { databaseExists: dbs.includes(target.database), collections: targetCollections, documentCounts: targetCounts, indexes: targetIndexes, requiredUniqueIndexesReady: uniqueIndexesReady, syntheticIDsRecorded: 0 },
    preserved,
    manifest: { path: manifestPath, mode: "0600", status: manifest.status },
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ status: "FAIL", operation, error: safeMongoFailure(error, operation), manifest: manifestPath })}\n`);
  process.exitCode = 1;
} finally {
  await client.close();
}
