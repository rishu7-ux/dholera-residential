import assert from "node:assert/strict";
import { lstatSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

import mongoose from "mongoose";

import {
  deleteExactDestinationRecords,
  planExactDestinationCleanup,
  validateDestinationCleanupApproval,
  validateDestinationCleanupTarget,
} from "../lib/noida-recovery-destination-cleanup.ts";
import { appendProtectedCleanupFailure } from "../lib/noida-recovery-cleanup-evidence.ts";
import { loadProtectedRecoveryManifest } from "../lib/noida-recovery-protected-manifest.ts";
import { RECOVERY_COLLECTION } from "../lib/noida-recovery-fixture.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, ".artifacts/noida-step-7/recovery-fixture-manifest.json");
const evidencePath = resolve(root, ".artifacts/noida-step-7/destination-cleanup-events.jsonl");
const args = process.argv.slice(2);
const execute = args.includes("--execute");
let stage = "arguments";
let deletedCount = 0;
let client;

try {
  assert.ok(args.every((arg) => arg === "--execute"), "only --execute is permitted");
  assert.equal(args.length, execute ? 1 : 0, "duplicate execution flag");
  stage = "approval";
  validateDestinationCleanupApproval(process.env.NOIDA_TEST_RECOVERY_DESTINATION_CLEANUP_APPROVAL, execute);
  assert.equal(process.env.MONGODB_URI, undefined, "production fallback must remain unset");

  stage = "manifest";
  const manifest = await loadProtectedRecoveryManifest(manifestPath);
  if (!execute) {
    console.log(JSON.stringify({ result: "PASS", mode: "OFFLINE_DRY_RUN", host: manifest.host,
      database: "omana-phase5-restore-20261017a", collection: RECOVERY_COLLECTION,
      runId: manifest.runId, exactIds: manifest.records.length, manifestVerified: true,
      liveRecordsVerified: false, databaseAccess: false, databaseWrites: false }));
  } else {
    stage = "target";
    const envPath = resolve(root, ".env.test.local");
    const envEntry = lstatSync(envPath);
    assert.ok(envEntry.isFile() && !envEntry.isSymbolicLink() && (envEntry.mode & 0o777) === 0o600,
      "TEST environment file must be a real 0600 file");
    const env = parseEnv(readFileSync(envPath, "utf8"));
    const target = validateDestinationCleanupTarget(
      env.MONGODB_RESTORE_TEST_URI,
      env.MONGODB_TEST_URI,
      process.env.MONGODB_URI,
    );
    assert.equal(target.hostname, manifest.host, "manifest and destination hosts must match");
    assert.notEqual(target.databaseName, manifest.database, "destination cannot be the source database");

    stage = "authentication";
    client = new mongoose.mongo.MongoClient(target.uri, { serverSelectionTimeoutMS: 15_000 });
    await client.connect();
    const status = await client.db("admin").command({ connectionStatus: 1 });
    assert.deepEqual(status.authInfo?.authenticatedUsers?.map(({ user, db }) => ({ user, db })),
      [{ user: "noida_test_restore", db: "admin" }], "unexpected authenticated user");
    assert.deepEqual(status.authInfo?.authenticatedUserRoles?.map(({ role, db }) => ({ role, db })),
      [{ role: "atlasAdmin", db: "admin" }], "unexpected restore role");

    const db = client.db(target.databaseName);
    stage = "destination-preflight";
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    assert.deepEqual(collections.map(({ name }) => name), [RECOVERY_COLLECTION],
      "destination must contain only the approved fixture collection");
    const collection = db.collection(RECOVERY_COLLECTION);
    const actualRecords = await collection.find({}).toArray();
    const indexes = await collection.listIndexes().toArray();
    const matched = planExactDestinationCleanup(manifest, RECOVERY_COLLECTION, actualRecords, indexes);

    stage = "exact-id-delete";
    await deleteExactDestinationRecords(matched,
      (record) => collection.deleteOne(record),
      () => { deletedCount += 1; });
    stage = "zero-leftover-verification";
    assert.equal(await collection.countDocuments({}), 0, "destination fixture records remain");
    console.log(JSON.stringify({ result: "PASS", operation: "DESTINATION_EXACT_ID_CLEANUP",
      hostname: target.hostname, database: target.databaseName, collection: RECOVERY_COLLECTION,
      runId: manifest.runId, recordsDeleted: deletedCount, recordsRemaining: 0,
      collectionDropped: false, manifestPreserved: true }));
  }
} catch (error) {
  const rawCode = error?.code;
  const code = typeof rawCode === "number" && Number.isSafeInteger(rawCode) ? rawCode
    : typeof rawCode === "string" && /^[A-Z0-9_]{1,40}$/.test(rawCode) ? rawCode : null;
  let evidencePreserved = false;
  if (execute && stage !== "arguments" && stage !== "approval") {
    try {
      await appendProtectedCleanupFailure(evidencePath, {
        timestamp: new Date().toISOString(), stage, code, recordsDeletedBeforeStop: deletedCount,
      });
      evidencePreserved = true;
    } catch {
      // Keep the primary failure visible even if local evidence storage fails.
    }
  }
  console.error(JSON.stringify({ result: "BLOCKED", stage, code,
    recordsDeletedBeforeStop: deletedCount, manifestPreserved: true, evidencePreserved,
    reason: "DESTINATION_CLEANUP_STOPPED; inspect locally without exposing credentials" }));
  process.exitCode = 2;
} finally {
  await client?.close();
}
