import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lstat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

import mongoose from "mongoose";

import { validateMongoRestoreTestTarget } from "../lib/mongodb-restore-test-target.ts";
import { planExactDestinationCleanup } from "../lib/noida-recovery-destination-cleanup.ts";
import { digestRecords, RECOVERY_COLLECTION, RECOVERY_MAX_RECORDS } from "../lib/noida-recovery-fixture.ts";
import { loadProtectedRecoveryManifest } from "../lib/noida-recovery-protected-manifest.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, ".artifacts/noida-step-7/recovery-fixture-manifest.json");
let stage = "local-configuration";
let client;

try {
  assert.equal(process.argv.length, 2, "restore verification accepts no arguments");
  assert.equal(process.env.MONGODB_URI, undefined, "production fallback must remain unset");
  const envPath = resolve(root, ".env.test.local");
  const envEntry = await lstat(envPath);
  assert.ok(envEntry.isFile() && !envEntry.isSymbolicLink() && (envEntry.mode & 0o777) === 0o600,
    "TEST environment file must be a real 0600 file");
  const env = parseEnv(readFileSync(envPath, "utf8"));
  assert.equal(env.MONGODB_URI, undefined, "TEST environment file must not include production fallback");
  const target = validateMongoRestoreTestTarget(env.MONGODB_RESTORE_TEST_URI);
  assert.equal(decodeURIComponent(new URL(target.uri).username), "noida_test_restore",
    "unexpected restore identity");
  const manifest = await loadProtectedRecoveryManifest(manifestPath);
  assert.equal(target.hostname, manifest.host);
  assert.notEqual(target.databaseName, manifest.database);

  stage = "authentication";
  client = new mongoose.mongo.MongoClient(target.uri, { serverSelectionTimeoutMS: 15_000 });
  await client.connect();
  const status = await client.db("admin").command({ connectionStatus: 1 });
  assert.deepEqual(status.authInfo?.authenticatedUsers?.map(({ user, db }) => ({ user, db })),
    [{ user: "noida_test_restore", db: "admin" }], "unexpected authenticated restore identity");
  assert.deepEqual(status.authInfo?.authenticatedUserRoles?.map(({ role, db }) => ({ role, db })),
    [{ role: "atlasAdmin", db: "admin" }], "unexpected restore role");

  stage = "destination-verification";
  const database = client.db(target.databaseName);
  const collections = await database.listCollections({}, { nameOnly: true }).toArray();
  assert.deepEqual(collections.map(({ name }) => name), [RECOVERY_COLLECTION],
    "destination must contain only the approved fixture collection");
  const collection = database.collection(RECOVERY_COLLECTION);
  const records = await collection.find({}).toArray();
  const indexes = await collection.listIndexes().toArray();
  const matched = planExactDestinationCleanup(manifest, RECOVERY_COLLECTION, records, indexes);
  assert.equal(matched.length, RECOVERY_MAX_RECORDS, "restored fixture is incomplete");
  assert.equal(await collection.countDocuments({}), RECOVERY_MAX_RECORDS,
    "destination fixture count changed during verification");
  assert.equal(digestRecords(matched), manifest.sha256, "restored content digest mismatch");
  console.log(JSON.stringify({ result: "PASS", mode: "READ_ONLY_RESTORE_VERIFICATION",
    host: target.hostname, database: target.databaseName, collection: RECOVERY_COLLECTION,
    runId: manifest.runId, records: RECOVERY_MAX_RECORDS, exactIds: true,
    contentSha256: manifest.sha256, indexesVerified: true,
    noUnexpectedCollections: true, databaseWrites: false }));
} catch (error) {
  const rawCode = error?.code;
  const code = typeof rawCode === "number" && Number.isSafeInteger(rawCode) ? rawCode
    : typeof rawCode === "string" && /^[A-Z0-9_]{1,40}$/.test(rawCode) ? rawCode : null;
  console.error(JSON.stringify({ result: "BLOCKED", stage, code,
    reason: "RESTORE_VERIFICATION_FAILED; do not retry or clean up without owner review" }));
  process.exitCode = 2;
} finally {
  await client?.close();
}
