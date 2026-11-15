import assert from "node:assert/strict";
import { constants, lstatSync, readFileSync } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

import mongoose from "mongoose";

import { validateMongoCrmTestWriterTarget } from "../lib/mongodb-crm-test-writer-target.ts";
import {
  buildRecoveryManifest,
  planExactRecoveryCleanup,
  RECOVERY_COLLECTION,
  RECOVERY_INDEX,
  validateRecoveryManifest,
} from "../lib/noida-recovery-fixture.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = resolve(root, ".artifacts");
const directory = resolve(artifacts, "noida-step-7");
const manifestPath = resolve(directory, "recovery-fixture-manifest.json");
const args = process.argv.slice(2);
const operation = args.includes("--cleanup") ? "cleanup" : "seed";
const execute = args.includes("--execute");
let stage = "arguments";
let client;

async function requireProtectedDirectory(path) {
  const entry = await lstat(path);
  assert.ok(entry.isDirectory() && !entry.isSymbolicLink() && (entry.mode & 0o777) === 0o700,
    "artifact directory must be a real 0700 directory");
}

async function saveManifest(manifest) {
  await requireProtectedDirectory(artifacts);
  await requireProtectedDirectory(directory);
  const handle = await open(manifestPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(manifest)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function loadManifest() {
  await requireProtectedDirectory(artifacts);
  await requireProtectedDirectory(directory);
  const entry = await lstat(manifestPath);
  assert.ok(entry.isFile() && !entry.isSymbolicLink() && (entry.mode & 0o777) === 0o600,
    "manifest must be a protected regular file");
  const handle = await open(manifestPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    assert.ok(opened.isFile() && (opened.mode & 0o777) === 0o600,
      "manifest protection changed during open");
    assert.ok(opened.size < 4096, "manifest is too large");
    return validateRecoveryManifest(JSON.parse(await handle.readFile("utf8")));
  } finally {
    await handle.close();
  }
}

try {
  assert.ok(args.every((arg) => ["--seed", "--cleanup", "--execute"].includes(arg)), "unknown argument");
  assert.ok(!(args.includes("--seed") && args.includes("--cleanup")), "choose one operation");
  assert.equal(args.filter((arg) => arg === "--execute").length, execute ? 1 : 0, "duplicate execute flag");
  if (!execute) {
    const manifest = operation === "seed" ? buildRecoveryManifest() : await loadManifest();
    console.log(JSON.stringify({
      result: "PASS",
      mode: "OFFLINE_DRY_RUN",
      operation,
      host: manifest.host,
      database: manifest.database,
      collection: manifest.collection,
      runId: manifest.runId,
      maximumRecords: manifest.records.length,
      sha256: manifest.sha256,
      databaseAccess: false,
      databaseWrites: false,
    }));
  } else {
    stage = "approval";
    const approvalName = operation === "seed"
      ? "NOIDA_TEST_RECOVERY_SEED_APPROVAL"
      : "NOIDA_TEST_RECOVERY_CLEANUP_APPROVAL";
    const approvalValue = operation === "seed"
      ? "APPROVE_NOIDA_RECOVERY_SEED_3_RECORDS"
      : "APPROVE_NOIDA_RECOVERY_EXACT_ID_CLEANUP";
    assert.equal(process.env[approvalName], approvalValue, "separate owner approval gate missing");
    assert.equal(process.env.MONGODB_URI, undefined, "production fallback must remain unset");

    stage = "target";
    const envPath = resolve(root, ".env.test.local");
    const envEntry = lstatSync(envPath);
    assert.ok(envEntry.isFile() && !envEntry.isSymbolicLink() && (envEntry.mode & 0o777) === 0o600,
      "TEST environment file must be a real 0600 file");
    const env = parseEnv(readFileSync(envPath, "utf8"));
    assert.equal(env.MONGODB_URI, undefined, "TEST environment file must not include production fallback");
    const target = validateMongoCrmTestWriterTarget(
      env.MONGODB_CRM_TEST_WRITER_URI,
      env.MONGODB_TEST_URI,
      env.MONGODB_RESTORE_TEST_URI,
      process.env.MONGODB_URI,
    );
    const manifest = operation === "seed" ? buildRecoveryManifest() : await loadManifest();
    assert.equal(target.hostname, manifest.host);
    assert.equal(target.databaseName, manifest.database);
    assert.equal(manifest.records.length, 3, "fixture must contain exactly three records");
    assert.equal(new Set(manifest.records.map(({ _id }) => _id)).size, 3,
      "fixture IDs must be unique");
    stage = "authentication";
    client = new mongoose.mongo.MongoClient(target.uri, { serverSelectionTimeoutMS: 15_000 });
    await client.connect();
    const status = await client.db("admin").command({ connectionStatus: 1 });
    assert.deepEqual(status.authInfo?.authenticatedUsers?.map(({ user, db }) => ({ user, db })),
      [{ user: "noida_test_writer", db: "admin" }], "unexpected authenticated identity");
    assert.deepEqual(status.authInfo?.authenticatedUserRoles?.map(({ role, db }) => ({ role, db })),
      [{ role: "readWrite", db: target.databaseName }], "unexpected writer role");

    const db = client.db(target.databaseName);
    stage = "collection-preflight";
    const exists = await db.listCollections({ name: RECOVERY_COLLECTION }, { nameOnly: true }).hasNext();
    if (operation === "seed") {
      assert.equal(exists, false, "dedicated fixture collection already exists");
      stage = "manifest";
      await saveManifest(manifest); // Created before any database mutation for partial-failure recovery.
      stage = "seed-write";
      await db.createCollection(RECOVERY_COLLECTION);
      const collection = db.collection(RECOVERY_COLLECTION);
      await collection.createIndex({ runId: 1, ordinal: 1 }, { name: RECOVERY_INDEX, unique: true });
      for (const record of manifest.records) await collection.insertOne(record);
      stage = "seed-verification";
      const actual = await collection.find({}).toArray();
      assert.equal(planExactRecoveryCleanup(manifest, actual).length, 3);
      const indexes = await collection.listIndexes().toArray();
      assert.equal(indexes.length, 2, "unexpected fixture index count");
      assert.deepEqual(indexes.map(({ name, key }) => ({ name, key })).sort((a, b) => a.name.localeCompare(b.name)), [
        { name: "_id_", key: { _id: 1 } },
        { name: RECOVERY_INDEX, key: { runId: 1, ordinal: 1 } },
      ], "fixture index verification failed");
      assert.equal(indexes.find(({ name }) => name === RECOVERY_INDEX)?.unique, true,
        "compound fixture index must be unique");
      console.log(JSON.stringify({ result: "PASS", operation, host: target.hostname, database: target.databaseName,
        collection: RECOVERY_COLLECTION, runId: manifest.runId, recordsCreated: 3, manifestProtected: true }));
    } else {
      assert.equal(exists, true, "dedicated fixture collection is absent");
      const collection = db.collection(RECOVERY_COLLECTION);
      const actual = await collection.find({}).toArray();
      const matched = planExactRecoveryCleanup(manifest, actual); // Reject before the first delete.
      stage = "cleanup-write";
      for (const record of matched) {
        const result = await collection.deleteOne(record); // Exact ID, marker, and every expected field.
        assert.equal(result.deletedCount, 1, "exact fixture deletion failed; stop immediately");
      }
      stage = "cleanup-verification";
      assert.equal(await collection.countDocuments({}), 0, "fixture records remain after cleanup");
      console.log(JSON.stringify({ result: "PASS", operation, host: target.hostname, database: target.databaseName,
        collection: RECOVERY_COLLECTION, runId: manifest.runId, recordsDeleted: matched.length,
        recordsRemaining: 0, collectionDropped: false }));
    }
  }
} catch (error) {
  console.error(JSON.stringify({ result: "FAIL", stage, code: error?.code ?? null,
    reason: "SAFETY_CHECK_OR_OPERATION_FAILED; inspect locally without exposing credentials" }));
  process.exitCode = 1;
} finally {
  await client?.close();
}
