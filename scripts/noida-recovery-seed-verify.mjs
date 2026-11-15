import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lstat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

import mongoose from "mongoose";

import { validateMongoCrmTestWriterTarget } from "../lib/mongodb-crm-test-writer-target.ts";
import { loadProtectedRecoveryManifest } from "../lib/noida-recovery-protected-manifest.ts";
import { planExactRecoveryCleanup, RECOVERY_COLLECTION, RECOVERY_INDEX, RECOVERY_MAX_RECORDS } from "../lib/noida-recovery-fixture.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, ".artifacts/noida-step-7/recovery-fixture-manifest.json");
let client;
let stage = "local-configuration";

try {
  assert.equal(process.argv.length, 2, "verification accepts no arguments");
  assert.equal(process.env.MONGODB_URI, undefined, "production fallback must remain unset");
  const envPath = resolve(root, ".env.test.local");
  const envEntry = await lstat(envPath);
  assert.ok(envEntry.isFile() && !envEntry.isSymbolicLink() && (envEntry.mode & 0o777) === 0o600,
    "TEST environment file must be a real 0600 file");
  const env = parseEnv(readFileSync(envPath, "utf8"));
  assert.equal(env.MONGODB_URI, undefined, "TEST environment file must not include production fallback");
  const target = validateMongoCrmTestWriterTarget(
    env.MONGODB_CRM_TEST_WRITER_URI, env.MONGODB_TEST_URI,
    env.MONGODB_RESTORE_TEST_URI, process.env.MONGODB_URI,
  );
  const manifest = await loadProtectedRecoveryManifest(manifestPath);
  assert.equal(target.hostname, manifest.host);
  assert.equal(target.databaseName, manifest.database);

  stage = "authentication";
  client = new mongoose.mongo.MongoClient(target.uri, { serverSelectionTimeoutMS: 15_000 });
  await client.connect();
  const status = await client.db("admin").command({ connectionStatus: 1 });
  assert.deepEqual(status.authInfo?.authenticatedUsers?.map(({ user, db }) => ({ user, db })),
    [{ user: "noida_test_writer", db: "admin" }], "unexpected authenticated writer identity");
  assert.deepEqual(status.authInfo?.authenticatedUserRoles?.map(({ role, db }) => ({ role, db })),
    [{ role: "readWrite", db: target.databaseName }], "unexpected writer role");

  stage = "fixture-verification";
  const collection = client.db(target.databaseName).collection(RECOVERY_COLLECTION);
  const actual = await collection.find({}).toArray();
  assert.equal(actual.length, RECOVERY_MAX_RECORDS, "fixture must contain exactly three records");
  assert.equal(planExactRecoveryCleanup(manifest, actual).length, RECOVERY_MAX_RECORDS,
    "fixture identity or contents mismatch");
  assert.equal(await collection.countDocuments({}), RECOVERY_MAX_RECORDS,
    "fixture count changed during verification");
  const indexes = await collection.listIndexes().toArray();
  assert.equal(indexes.length, 2, "unexpected fixture index count");
  assert.deepEqual(indexes.map(({ name, key }) => ({ name, key })).sort((a, b) => a.name.localeCompare(b.name)), [
    { name: "_id_", key: { _id: 1 } },
    { name: RECOVERY_INDEX, key: { runId: 1, ordinal: 1 } },
  ], "fixture index mismatch");
  assert.equal(indexes.find(({ name }) => name === RECOVERY_INDEX)?.unique, true,
    "fixture run index must be unique");
  console.log(JSON.stringify({ result: "PASS", mode: "READ_ONLY_SEED_VERIFICATION",
    hostname: target.hostname, database: target.databaseName, collection: RECOVERY_COLLECTION,
    runId: manifest.runId, records: RECOVERY_MAX_RECORDS, exactIds: true,
    contentsMatchManifest: true, indexesVerified: true, manifestProtected: true, databaseWrites: false }));
} catch (error) {
  const rawCode = error?.code;
  const code = typeof rawCode === "number" && Number.isSafeInteger(rawCode) ? rawCode
    : typeof rawCode === "string" && /^[A-Z0-9_]{1,40}$/.test(rawCode) ? rawCode : null;
  console.error(JSON.stringify({ result: "BLOCKED", stage, code,
    reason: "SEED_VERIFICATION_FAILED; preserve manifest and inspect locally without exposing credentials" }));
  process.exitCode = 2;
} finally {
  await client?.close();
}
