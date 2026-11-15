import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

import mongoose from "mongoose";
import { validateMongoTestTarget } from "../lib/mongodb-test-target.ts";

const env = parseEnv(readFileSync(resolve(".env.test.local"), "utf8"));
const { uri, databaseName } = validateMongoTestTarget(env.MONGODB_TEST_URI, process.env.MONGODB_URI);
const collectionName = `noida-backup-rehearsal-${randomUUID().replaceAll("-", "")}`;
let created = false;

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
try {
  const db = mongoose.connection.db;
  assert.ok(db);
  assert.equal(db.databaseName, databaseName);
  assert.equal(await db.listCollections({ name: collectionName }).hasNext(), false);

  await db.createCollection(collectionName);
  created = true;
  const collection = db.collection(collectionName);
  const original = { marker: "disposable TEST backup rehearsal", value: 42 };
  const inserted = await collection.insertOne(original);
  const stored = await collection.findOne({ _id: inserted.insertedId });
  assert.ok(stored);
  const backup = mongoose.mongo.BSON.serialize(stored);
  assert.ok(backup.length > 0);

  assert.equal((await collection.deleteOne({ _id: inserted.insertedId })).deletedCount, 1);
  assert.equal(await collection.countDocuments(), 0);
  await collection.insertOne(mongoose.mongo.BSON.deserialize(backup));
  const restored = await collection.findOne({ _id: inserted.insertedId });
  assert.deepEqual(restored, stored);
  assert.equal(await collection.countDocuments(), 1);
  console.log(JSON.stringify({ result: "PASS", database: databaseName, scope: "one disposable TEST collection", bsonBackup: "PASS", restoreReadback: "PASS" }));
} finally {
  if (created) await mongoose.connection.db.collection(collectionName).drop();
  await mongoose.disconnect();
}
