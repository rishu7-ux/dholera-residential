import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lstat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

import mongoose from "mongoose";

import { validateMongoTestTarget } from "../lib/mongodb-test-target.ts";
import { loadProtectedRecoveryManifest } from "../lib/noida-recovery-protected-manifest.ts";
import { planExactRecoveryCleanup, RECOVERY_COLLECTION, RECOVERY_INDEX, RECOVERY_MAX_RECORDS } from "../lib/noida-recovery-fixture.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = resolve(root, ".artifacts/noida-step-7");
const archive = resolve(directory, "mongodb-test.archive.gz");
const checksum = `${archive}.sha256`;
const config = resolve(directory, "mongodump-source.yaml");
const sourceOnly = process.argv[2] === "--source-only";
let stage = "local-configuration";
let client;

async function requireAbsent(path) {
  try {
    await lstat(path);
    throw new Error("backup output or credential config already exists");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

try {
  assert.deepEqual(process.argv.slice(2), sourceOnly ? ["--source-only"] : [],
    "backup preflight accepts only --source-only");
  assert.equal(process.env.MONGODB_URI, undefined, "production fallback must remain unset");
  const envPath = resolve(root, ".env.test.local");
  const envEntry = await lstat(envPath);
  assert.ok(envEntry.isFile() && !envEntry.isSymbolicLink() && (envEntry.mode & 0o777) === 0o600,
    "TEST environment file must be a real 0600 file");
  const env = parseEnv(readFileSync(envPath, "utf8"));
  assert.equal(env.MONGODB_URI, undefined, "TEST environment file must not include production fallback");
  const target = validateMongoTestTarget(env.MONGODB_TEST_URI);
  assert.equal(decodeURIComponent(new URL(target.uri).username), "noida_test_reader",
    "backup must use the dedicated TEST reader");
  const manifest = await loadProtectedRecoveryManifest(resolve(directory, "recovery-fixture-manifest.json"));
  assert.equal(manifest.runId, "7bfcb927-5910-441a-84b1-0c295e0aed9e",
    "unexpected rehearsal run marker");
  assert.equal(target.hostname, manifest.host);
  assert.equal(target.databaseName, manifest.database);
  if (!sourceOnly) for (const path of [archive, checksum, config]) await requireAbsent(path);

  stage = "reader-authentication";
  client = new mongoose.mongo.MongoClient(target.uri, { serverSelectionTimeoutMS: 15_000 });
  await client.connect();
  const status = await client.db("admin").command({ connectionStatus: 1 });
  assert.deepEqual(status.authInfo?.authenticatedUsers?.map(({ user, db }) => ({ user, db })),
    [{ user: "noida_test_reader", db: "admin" }], "unexpected source reader identity");
  assert.deepEqual(status.authInfo?.authenticatedUserRoles?.map(({ role, db }) => ({ role, db })),
    [{ role: "read", db: target.databaseName }], "unexpected source reader role");

  stage = "fixture-verification";
  const collection = client.db(target.databaseName).collection(RECOVERY_COLLECTION);
  const records = await collection.find({}).toArray();
  assert.equal(records.length, RECOVERY_MAX_RECORDS, "fixture must contain exactly three records");
  assert.equal(planExactRecoveryCleanup(manifest, records).length, RECOVERY_MAX_RECORDS,
    "fixture differs from protected manifest");
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
  console.log(JSON.stringify({ result: "PASS", mode: sourceOnly ? "READ_ONLY_SOURCE_VERIFICATION" : "READ_ONLY_BACKUP_PREFLIGHT",
    host: target.hostname, database: target.databaseName, collection: RECOVERY_COLLECTION,
    reader: "noida_test_reader@admin", role: `read@${target.databaseName}`,
    runId: manifest.runId, records: RECOVERY_MAX_RECORDS, exactIds: true,
    contentsMatchManifest: true, indexesVerified: true,
    archiveAbsent: sourceOnly ? null : true, checksumAbsent: sourceOnly ? null : true,
    configAbsent: sourceOnly ? null : true, databaseWrites: false }));
} catch (error) {
  const rawCode = error?.code;
  const code = typeof rawCode === "number" && Number.isSafeInteger(rawCode) ? rawCode
    : typeof rawCode === "string" && /^[A-Z0-9_]{1,40}$/.test(rawCode) ? rawCode : null;
  console.error(JSON.stringify({ result: "BLOCKED", stage, code,
    reason: "BACKUP_PREFLIGHT_FAILED; inspect locally without exposing credentials" }));
  process.exitCode = 2;
} finally {
  await client?.close();
}
