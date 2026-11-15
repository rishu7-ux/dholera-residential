import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

export const RECOVERY_COLLECTION = "noida-recovery-fixture-20261017a";
export const RECOVERY_MAX_RECORDS = 3;
export const RECOVERY_INDEX = "runId_1_ordinal_1";

const PAYLOADS = ["alpha", "beta", "gamma"] as const;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type RecoveryRecord = {
  _id: string;
  kind: "synthetic-recovery";
  ordinal: number;
  payload: (typeof PAYLOADS)[number];
  runId: string;
};

export type RecoveryManifest = {
  collection: typeof RECOVERY_COLLECTION;
  database: "omana-phase5-test-2";
  host: "cluster0.zshxfui.mongodb.net";
  runId: string;
  records: RecoveryRecord[];
  sha256: string;
};

export function buildRecoveryManifest(runId: string = randomUUID()): RecoveryManifest {
  assert.match(runId, UUID_V4, "run marker must be a UUID v4");
  const records: RecoveryRecord[] = PAYLOADS.map((payload, index) => ({
    _id: `${runId}:${String(index + 1).padStart(3, "0")}`,
    kind: "synthetic-recovery",
    ordinal: index + 1,
    payload,
    runId,
  }));
  const manifest: RecoveryManifest = {
    collection: RECOVERY_COLLECTION,
    database: "omana-phase5-test-2",
    host: "cluster0.zshxfui.mongodb.net",
    runId,
    records,
    sha256: digestRecords(records),
  };
  return manifest;
}

export function digestRecords(records: RecoveryRecord[]): string {
  const canonical = records
    .map(({ _id, kind, ordinal, payload, runId }) => ({ _id, kind, ordinal, payload, runId }))
    .sort((a, b) => a._id.localeCompare(b._id));
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

export function validateRecoveryManifest(value: unknown): RecoveryManifest {
  assert.ok(value && typeof value === "object", "manifest is required");
  const input = value as RecoveryManifest;
  const expected = buildRecoveryManifest(input.runId);
  assert.deepEqual(Object.keys(input).sort(), Object.keys(expected).sort(), "unexpected manifest fields");
  assert.equal(input.host, expected.host, "manifest host mismatch");
  assert.equal(input.database, expected.database, "manifest database mismatch");
  assert.equal(input.collection, expected.collection, "manifest collection mismatch");
  assert.deepEqual(input.records, expected.records, "manifest records mismatch");
  assert.equal(input.records.length, RECOVERY_MAX_RECORDS, "fixture must contain exactly three records");
  assert.equal(input.sha256, expected.sha256, "manifest checksum mismatch");
  return expected;
}

export function planExactRecoveryCleanup(
  manifestValue: unknown,
  actualRecords: unknown[],
): RecoveryRecord[] {
  const manifest = validateRecoveryManifest(manifestValue);
  assert.ok(actualRecords.length <= RECOVERY_MAX_RECORDS, "unexpected fixture record count");
  const expectedById = new Map(manifest.records.map((record) => [record._id, record]));
  const seen = new Set<string>();
  const matched: RecoveryRecord[] = [];
  for (const value of actualRecords) {
    assert.ok(value && typeof value === "object", "invalid fixture record");
    const record = value as RecoveryRecord;
    assert.equal(typeof record._id, "string", "fixture ID must be a string");
    assert.equal(seen.has(record._id), false, "duplicate fixture ID");
    seen.add(record._id);
    const expected = expectedById.get(record._id);
    assert.ok(expected, "unrecognized fixture ID");
    assert.deepEqual(record, expected, "fixture identity or contents mismatch");
    matched.push(expected);
  }
  return matched.sort((a, b) => a._id.localeCompare(b._id));
}
