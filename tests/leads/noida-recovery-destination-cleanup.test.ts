import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  deleteExactDestinationRecords,
  planExactDestinationCleanup,
  type FixtureIndex,
  validateDestinationCleanupApproval,
  validateDestinationCleanupTarget,
} from "../../lib/noida-recovery-destination-cleanup";
import { appendProtectedCleanupFailure } from "../../lib/noida-recovery-cleanup-evidence";
import { buildRecoveryManifest, RECOVERY_COLLECTION, RECOVERY_INDEX } from "../../lib/noida-recovery-fixture";
import { loadProtectedRecoveryManifest } from "../../lib/noida-recovery-protected-manifest";

const HOST = "cluster0.zshxfui.mongodb.net";
const SOURCE = "omana-phase5-test-2";
const DESTINATION = "omana-phase5-restore-20261017a";
const sourceUri = `mongodb+srv://noida_test_reader:reader-test@${HOST}/${SOURCE}?authSource=admin`;
const restoreUri = `mongodb+srv://noida_test_restore:restore-test@${HOST}/${DESTINATION}?authSource=admin`;
const manifest = buildRecoveryManifest("11111111-2222-4333-8444-555555555555");
const indexes: FixtureIndex[] = [
  { name: "_id_", key: { _id: 1 } },
  { name: RECOVERY_INDEX, key: { runId: 1, ordinal: 1 }, unique: true },
];

test("destination target accepts only the dedicated restore identity and distinct approved TEST database", () => {
  const target = validateDestinationCleanupTarget(restoreUri, sourceUri);
  assert.equal(target.hostname, HOST);
  assert.equal(target.databaseName, DESTINATION);
});

test("destination target rejects production, source, former TEST host, wrong user, and TLS bypass", () => {
  for (const uri of [
    restoreUri.replace(HOST, "dholeraindustrial.nw37odb.mongodb.net"),
    restoreUri.replace(HOST, "cluster0.oqcardp.mongodb.net"),
    restoreUri.replace(DESTINATION, SOURCE),
    restoreUri.replace("noida_test_restore", "noida_test_reader"),
    `${restoreUri}&tlsInsecure=true`,
  ]) assert.throws(() => validateDestinationCleanupTarget(uri, sourceUri));
  assert.throws(() => validateDestinationCleanupTarget(restoreUri, sourceUri, sourceUri));
  assert.throws(() => validateDestinationCleanupTarget(restoreUri, undefined));
});

test("cleanup requires exact collection, all three records, and the two expected indexes", () => {
  assert.deepEqual(planExactDestinationCleanup(manifest, RECOVERY_COLLECTION,
    [...manifest.records].reverse(), indexes), manifest.records);
  const cases: Array<{ collection: string; records: unknown[]; indexList: FixtureIndex[] }> = [
    { collection: "leads", records: manifest.records, indexList: indexes },
    { collection: RECOVERY_COLLECTION, records: manifest.records.slice(0, 2), indexList: indexes },
    { collection: RECOVERY_COLLECTION, records: [...manifest.records, manifest.records[0]], indexList: indexes },
    { collection: RECOVERY_COLLECTION, records: [{ ...manifest.records[0], runId: "wrong" }, ...manifest.records.slice(1)], indexList: indexes },
    { collection: RECOVERY_COLLECTION, records: [{ ...manifest.records[0], payload: "beta" }, ...manifest.records.slice(1)], indexList: indexes },
    { collection: RECOVERY_COLLECTION, records: manifest.records, indexList: indexes.slice(0, 1) },
    { collection: RECOVERY_COLLECTION, records: manifest.records, indexList: [...indexes, { name: "extra", key: { payload: 1 } }] },
    { collection: RECOVERY_COLLECTION, records: manifest.records, indexList: [indexes[0], { ...indexes[1], unique: false }] },
    { collection: RECOVERY_COLLECTION, records: manifest.records, indexList: [indexes[0], { ...indexes[1], sparse: true }] },
    { collection: RECOVERY_COLLECTION, records: manifest.records, indexList: [{ ...indexes[0], key: { other: 1 } }, indexes[1]] },
  ];
  for (const { collection, records, indexList } of cases) {
    assert.throws(() => planExactDestinationCleanup(manifest, collection, records, indexList));
  }
});

test("a partial delete stops before the next ID and reports only completed deletions", async () => {
  let calls = 0;
  let completed = 0;
  await assert.rejects(deleteExactDestinationRecords(manifest.records,
    async () => ({ deletedCount: ++calls === 1 ? 1 : 0 }),
    () => { completed += 1; }));
  assert.equal(calls, 2);
  assert.equal(completed, 1);
});

test("a thrown deletion error stops without attempting later IDs", async () => {
  let calls = 0;
  let completed = 0;
  await assert.rejects(deleteExactDestinationRecords(manifest.records,
    async () => {
      calls += 1;
      if (calls === 2) throw new Error("simulated network failure");
      return { deletedCount: 1 };
    },
    () => { completed += 1; }));
  assert.equal(calls, 2);
  assert.equal(completed, 1);
});

test("approval must be exact and is required only with the execution flag", () => {
  assert.doesNotThrow(() => validateDestinationCleanupApproval(undefined, false));
  assert.throws(() => validateDestinationCleanupApproval(undefined, true));
  assert.throws(() => validateDestinationCleanupApproval("INVALID", false));
  assert.throws(() => validateDestinationCleanupApproval("INVALID", true));
});

test("protected manifest loader rejects missing, insecure, symlinked, and changed manifests", async () => {
  const root = mkdtempSync(join(tmpdir(), "noida-destination-manifest-"));
  const parent = join(root, ".artifacts");
  const directory = join(parent, "noida-step-7");
  const path = join(directory, "recovery-fixture-manifest.json");
  try {
    mkdirSync(parent, { mode: 0o700 });
    mkdirSync(directory, { mode: 0o700 });
    await assert.rejects(loadProtectedRecoveryManifest(path));
    writeFileSync(path, JSON.stringify(manifest), { mode: 0o600 });
    assert.deepEqual(await loadProtectedRecoveryManifest(path), manifest);
    chmodSync(path, 0o644);
    await assert.rejects(loadProtectedRecoveryManifest(path));
    chmodSync(path, 0o600);
    unlinkSync(path);
    const elsewhere = join(directory, "real-manifest.json");
    writeFileSync(elsewhere, JSON.stringify(manifest), { mode: 0o600 });
    symlinkSync(elsewhere, path);
    await assert.rejects(loadProtectedRecoveryManifest(path));
    unlinkSync(path);
    writeFileSync(path, JSON.stringify({ ...manifest, database: "production" }), { mode: 0o600 });
    await assert.rejects(loadProtectedRecoveryManifest(path));
    chmodSync(directory, 0o755);
    await assert.rejects(loadProtectedRecoveryManifest(path));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("failure evidence is appended only to a protected real file", async () => {
  const root = mkdtempSync(join(tmpdir(), "noida-destination-evidence-"));
  const parent = join(root, ".artifacts");
  const directory = join(parent, "noida-step-7");
  const path = join(directory, "destination-cleanup-events.jsonl");
  const event = { timestamp: "2026-10-17T00:00:00.000Z", stage: "exact-id-delete", code: null,
    recordsDeletedBeforeStop: 1 };
  try {
    mkdirSync(parent, { mode: 0o700 });
    mkdirSync(directory, { mode: 0o700 });
    await appendProtectedCleanupFailure(path, event);
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8").trim()), event);
    chmodSync(path, 0o644);
    await assert.rejects(appendProtectedCleanupFailure(path, event));
    unlinkSync(path);
    const elsewhere = join(directory, "elsewhere.jsonl");
    writeFileSync(elsewhere, "", { mode: 0o600 });
    symlinkSync(elsewhere, path);
    await assert.rejects(appendProtectedCleanupFailure(path, event));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI defaults to offline manifest preflight and rejects absent or invalid approval before connection", () => {
  const script = "scripts/noida-recovery-destination-cleanup.mjs";
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.NOIDA_TEST_RECOVERY_DESTINATION_CLEANUP_APPROVAL;
  delete env.MONGODB_URI;
  const dryRun = spawnSync(process.execPath, ["--import", "tsx", script], { encoding: "utf8", env });
  const manifestExists = existsSync(".artifacts/noida-step-7/recovery-fixture-manifest.json");
  assert.equal(dryRun.status, manifestExists ? 0 : 2);
  if (manifestExists) {
    assert.equal(JSON.parse(dryRun.stdout).mode, "OFFLINE_DRY_RUN");
  } else {
    assert.equal(JSON.parse(dryRun.stderr).stage, "manifest");
  }
  const execute = spawnSync(process.execPath, ["--import", "tsx", script, "--execute"], { encoding: "utf8", env });
  assert.equal(execute.status, 2);
  assert.equal(JSON.parse(execute.stderr).stage, "approval");
  const invalid = spawnSync(process.execPath, ["--import", "tsx", script], {
    encoding: "utf8", env: { ...env, NOIDA_TEST_RECOVERY_DESTINATION_CLEANUP_APPROVAL: "INVALID" },
  });
  assert.equal(invalid.status, 2);
  assert.equal(JSON.parse(invalid.stderr).stage, "approval");
});
