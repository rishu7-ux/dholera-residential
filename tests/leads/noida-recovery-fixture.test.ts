import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  buildRecoveryManifest,
  digestRecords,
  planExactRecoveryCleanup,
  RECOVERY_COLLECTION,
  RECOVERY_MAX_RECORDS,
  validateRecoveryManifest,
} from "../../lib/noida-recovery-fixture";

const RUN_ID = "11111111-2222-4333-8444-555555555555";

test("builds exactly three synthetic records in one approved TEST source collection", () => {
  const manifest = buildRecoveryManifest(RUN_ID);
  assert.equal(manifest.host, "cluster0.zshxfui.mongodb.net");
  assert.equal(manifest.database, "omana-phase5-test-2");
  assert.equal(manifest.collection, RECOVERY_COLLECTION);
  assert.equal(manifest.records.length, RECOVERY_MAX_RECORDS);
  assert.deepEqual(manifest.records.map(({ _id }) => _id), [
    `${RUN_ID}:001`, `${RUN_ID}:002`, `${RUN_ID}:003`,
  ]);
  assert.ok(manifest.records.every(({ runId, kind }) => runId === RUN_ID && kind === "synthetic-recovery"));
  assert.match(manifest.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(validateRecoveryManifest(manifest), manifest);
});

test("generates a fresh UUID v4 marker by default", () => {
  const first = buildRecoveryManifest();
  const second = buildRecoveryManifest();
  assert.notEqual(first.runId, second.runId);
  assert.match(first.runId, /^[0-9a-f]{8}-[0-9a-f]{4}-4/);
  assert.throws(() => buildRecoveryManifest("not-a-uuid"));
});

test("digest is independent of record order and changes with content", () => {
  const manifest = buildRecoveryManifest(RUN_ID);
  assert.equal(digestRecords([...manifest.records].reverse()), manifest.sha256);
  assert.notEqual(digestRecords([{ ...manifest.records[0], payload: "beta" }, ...manifest.records.slice(1)]), manifest.sha256);
});

test("rejects changed host, database, collection, record, or checksum", () => {
  const manifest = buildRecoveryManifest(RUN_ID);
  for (const changed of [
    { ...manifest, host: "dholeraindustrial.nw37odb.mongodb.net" },
    { ...manifest, database: "production" },
    { ...manifest, collection: "leads" },
    { ...manifest, records: manifest.records.slice(0, 2) },
    { ...manifest, records: [{ ...manifest.records[0], runId: "other" }, ...manifest.records.slice(1)] },
    { ...manifest, sha256: "0".repeat(64) },
    { ...manifest, extra: "unexpected" },
  ]) assert.throws(() => validateRecoveryManifest(changed));
});

test("cleanup accepts exactly matching records, including a partial seed", () => {
  const manifest = buildRecoveryManifest(RUN_ID);
  assert.deepEqual(planExactRecoveryCleanup(manifest, [...manifest.records].reverse()), manifest.records);
  assert.deepEqual(planExactRecoveryCleanup(manifest, manifest.records.slice(0, 1)), manifest.records.slice(0, 1));
  assert.deepEqual(planExactRecoveryCleanup(manifest, []), []);
});

test("cleanup rejects altered identity, extra records, duplicates, and unexpected fields before deletion", () => {
  const manifest = buildRecoveryManifest(RUN_ID);
  const first = manifest.records[0];
  for (const records of [
    [{ ...first, runId: "different-run" }],
    [{ ...first, _id: "unrecognized" }],
    [{ ...first, payload: "gamma" }],
    [{ ...first, kind: "customer" }],
    [{ ...first, email: "customer@example.com" }],
    [first, first],
    [...manifest.records, first],
  ]) assert.throws(() => planExactRecoveryCleanup(manifest, records));
});

test("CLI defaults to offline dry-run and refuses execution without separate approval", () => {
  const script = "scripts/noida-recovery-fixture.mjs";
  const env = { ...process.env, NOIDA_TEST_RECOVERY_SEED_APPROVAL: "", NOIDA_TEST_RECOVERY_CLEANUP_APPROVAL: "" };
  const dryRun = spawnSync(process.execPath, ["--import", "tsx", script], { encoding: "utf8", env });
  assert.equal(dryRun.status, 0);
  assert.equal(JSON.parse(dryRun.stdout).mode, "OFFLINE_DRY_RUN");
  for (const operation of ["--seed", "--cleanup"]) {
    const blocked = spawnSync(process.execPath, ["--import", "tsx", script, operation, "--execute"], { encoding: "utf8", env });
    assert.equal(blocked.status, 1);
    assert.equal(JSON.parse(blocked.stderr).stage, "approval");
  }
});
