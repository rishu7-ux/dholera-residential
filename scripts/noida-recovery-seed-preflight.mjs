import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lstat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

import mongoose from "mongoose";

import { validateMongoCrmTestWriterTarget } from "../lib/mongodb-crm-test-writer-target.ts";
import { buildRecoveryManifest, RECOVERY_COLLECTION, RECOVERY_MAX_RECORDS } from "../lib/noida-recovery-fixture.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = resolve(root, ".artifacts");
const artifactDirectory = resolve(artifactRoot, "noida-step-7");
const manifestPath = resolve(artifactDirectory, "recovery-fixture-manifest.json");
let client;
let stage = "local-configuration";

try {
  assert.equal(process.argv.length, 2, "preflight accepts no arguments");
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
  const manifest = buildRecoveryManifest();
  assert.equal(target.hostname, manifest.host);
  assert.equal(target.databaseName, manifest.database);
  assert.equal(manifest.collection, RECOVERY_COLLECTION);
  assert.equal(manifest.records.length, RECOVERY_MAX_RECORDS);
  assert.equal(new Set(manifest.records.map(({ _id }) => _id)).size, RECOVERY_MAX_RECORDS,
    "fixture IDs must be unique");
  for (const directory of [artifactRoot, artifactDirectory]) {
    const entry = await lstat(directory);
    assert.ok(entry.isDirectory() && !entry.isSymbolicLink() && (entry.mode & 0o777) === 0o700,
      "manifest directory must be a real 0700 directory");
  }
  try {
    await lstat(manifestPath);
    throw new Error("protected manifest already exists; seed must stop");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  stage = "writer-authentication";
  client = new mongoose.mongo.MongoClient(target.uri, { serverSelectionTimeoutMS: 15_000 });
  await client.connect();
  const status = await client.db("admin").command({ connectionStatus: 1 });
  assert.deepEqual(status.authInfo?.authenticatedUsers?.map(({ user, db }) => ({ user, db })),
    [{ user: "noida_test_writer", db: "admin" }], "unexpected authenticated writer identity");
  assert.deepEqual(status.authInfo?.authenticatedUserRoles?.map(({ role, db }) => ({ role, db })),
    [{ role: "readWrite", db: target.databaseName }], "unexpected writer role");

  stage = "fixture-absence";
  const exists = await client.db(target.databaseName)
    .listCollections({ name: RECOVERY_COLLECTION }, { nameOnly: true }).hasNext();
  assert.equal(exists, false, "fixture collection already exists");
  console.log(JSON.stringify({ result: "PASS", mode: "READ_ONLY_SEED_PREFLIGHT",
    hostname: target.hostname, database: target.databaseName, collection: RECOVERY_COLLECTION,
    writer: "noida_test_writer@admin", role: `readWrite@${target.databaseName}`,
    fixtureAbsent: true, manifestAbsent: true, maximumRecords: RECOVERY_MAX_RECORDS,
    generatedIdsUnique: true, protectedDirectories: true, databaseWrites: false }));
} catch (error) {
  const rawCode = error?.code;
  const code = typeof rawCode === "number" && Number.isSafeInteger(rawCode) ? rawCode
    : typeof rawCode === "string" && /^[A-Z0-9_]{1,40}$/.test(rawCode) ? rawCode : null;
  console.error(JSON.stringify({ result: "BLOCKED", stage, code,
    reason: "SEED_PREFLIGHT_FAILED; inspect locally without exposing credentials" }));
  process.exitCode = 2;
} finally {
  await client?.close();
}
