import assert from "node:assert/strict";

import { verifyLocalDemoServer } from "./noida-local-demo-target.mjs";
import { TARGET, assertAbsentTarget, assertExactTarget, digest } from "./noida-local-atomic-qa.mjs";

const SYSTEM_DATABASES = new Set(["admin", "config", "local"]);

/** Inventory every non-system local database except the new atomic target. Reads only. */
export async function snapshotOtherDatabases(client) {
  const inventory = await client.db("admin").command({ listDatabases: 1, nameOnly: true });
  const names = inventory.databases.map((row) => row.name).filter((name) => !SYSTEM_DATABASES.has(name) && name !== TARGET.database).sort();
  const result = {};
  for (const name of names) {
    const db = client.db(name);
    const entries = await db.listCollections({}, { nameOnly: false }).toArray();
    assert.ok(entries.every((item) => item.type === "collection"), `Unexpected view in protected database ${name}`);
    const collections = {};
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const collection = db.collection(entry.name);
      const rows = await collection.find({}).sort({ _id: 1 }).toArray();
      const indexes = await collection.listIndexes().toArray();
      collections[entry.name] = { count: rows.length, documentsDigest: digest(rows), indexesDigest: digest(indexes) };
    }
    result[name] = { collections, digest: digest(collections) };
  }
  return result;
}

export function assertOtherDatabasesUnchanged(before, after) {
  assert.deepEqual(after, before, "A pre-existing local database changed during atomic QA");
}

export function assertServerMetadata(hello, options, replica) {
  assert.equal(hello.setName, TARGET.replicaSet);
  assert.equal(hello.me, `${TARGET.host}:${TARGET.port}`);
  assert.deepEqual(hello.hosts, [`${TARGET.host}:${TARGET.port}`]);
  assert.equal(hello.isWritablePrimary, true);
  assert.equal(options.parsed?.net?.bindIp, TARGET.host);
  assert.equal(Number(options.parsed?.net?.port), TARGET.port);
  assert.equal(replica.set, TARGET.replicaSet);
  assert.equal(replica.members?.length, 1);
  assert.equal(replica.members[0]?.name, `${TARGET.host}:${TARGET.port}`);
  assert.equal(replica.members[0]?.stateStr, "PRIMARY");
}

export async function readOnlyAtomicPreflight(client, uri) {
  assertExactTarget(uri);
  const server = await verifyLocalDemoServer(client, { requireEmpty: false });
  const admin = client.db("admin");
  const [hello, options, replica, inventory] = await Promise.all([
    admin.command({ hello: 1 }), admin.command({ getCmdLineOpts: 1 }),
    admin.command({ replSetGetStatus: 1 }), admin.command({ listDatabases: 1, nameOnly: true }),
  ]);
  assertServerMetadata(hello, options, replica);
  const databaseNames = inventory.databases.map((row) => row.name).sort();
  const collectionNames = (await client.db(TARGET.database).listCollections({}, { nameOnly: true }).toArray()).map((row) => row.name);
  assertAbsentTarget(databaseNames, collectionNames);
  return { target: TARGET, server, databaseNames, otherDatabases: await snapshotOtherDatabases(client), targetAbsent: true, targetCollections: 0 };
}
