import assert from "node:assert/strict";

import { validateMongoRestoreTestTarget } from "./mongodb-restore-test-target";
import { validateMongoTestTarget } from "./mongodb-test-target";
import {
  planExactRecoveryCleanup,
  RECOVERY_COLLECTION,
  RECOVERY_INDEX,
  RECOVERY_MAX_RECORDS,
  type RecoveryManifest,
  type RecoveryRecord,
} from "./noida-recovery-fixture";

const RESTORE_USER = "noida_test_restore";
const READER_USER = "noida_test_reader";
const PLACEHOLDER = /^(?:placeholder|change-?me|your.*|restore_test_password)$/i;
export const DESTINATION_CLEANUP_APPROVAL = "APPROVE_NOIDA_RECOVERY_DESTINATION_EXACT_ID_CLEANUP";

export function validateDestinationCleanupApproval(value: string | undefined, execute: boolean) {
  assert.ok(value === undefined || value === DESTINATION_CLEANUP_APPROVAL,
    "invalid destination cleanup approval value");
  if (execute) assert.equal(value, DESTINATION_CLEANUP_APPROVAL,
    "separate destination cleanup approval is required");
}

export function validateDestinationCleanupTarget(
  restoreValue: string | undefined,
  sourceValue: string | undefined,
  productionValue?: string,
) {
  assert.equal(productionValue, undefined, "production fallback must remain unset");
  const source = validateMongoTestTarget(sourceValue);
  const destination = validateMongoRestoreTestTarget(restoreValue);
  assert.equal(source.hostname, destination.hostname, "source and destination must use the approved TEST host");
  assert.notEqual(source.databaseName, destination.databaseName, "source and destination must differ");
  const sourceUrl = new URL(source.uri);
  const destinationUrl = new URL(destination.uri);
  assert.equal(decodeURIComponent(sourceUrl.username), READER_USER, "unexpected source reader identity");
  assert.equal(decodeURIComponent(destinationUrl.username), RESTORE_USER, "unexpected restore identity");
  const password = decodeURIComponent(destinationUrl.password);
  assert.ok(password && !PLACEHOLDER.test(password), "restore credential must be configured");
  return destination;
}

export type FixtureIndex = { name: string; key: Record<string, number>; unique?: boolean; [key: string]: unknown };

function validateFixtureIndex(index: FixtureIndex, expectedName: string, expectedKey: Record<string, number>) {
  assert.deepEqual(index.key, expectedKey, `destination ${expectedName} index mismatch`);
  assert.ok(Object.keys(index).every((field) => ["v", "ns", "name", "key", "unique"].includes(field)),
    `destination ${expectedName} index has unexpected options`);
}

export function planExactDestinationCleanup(
  manifest: RecoveryManifest,
  collectionName: string,
  actualRecords: unknown[],
  indexes: FixtureIndex[],
) {
  assert.equal(collectionName, RECOVERY_COLLECTION, "unexpected destination collection");
  assert.equal(actualRecords.length, RECOVERY_MAX_RECORDS, "destination must contain exactly three fixture records");
  const matched = planExactRecoveryCleanup(manifest, actualRecords);
  assert.equal(matched.length, RECOVERY_MAX_RECORDS, "destination fixture is incomplete");
  assert.equal(indexes.length, 2, "unexpected destination fixture index count");
  const byName = new Map(indexes.map((index) => [index.name, index]));
  assert.equal(byName.size, 2, "duplicate destination fixture index name");
  const idIndex = byName.get("_id_");
  const runIndex = byName.get(RECOVERY_INDEX);
  assert.ok(idIndex && runIndex, "destination fixture indexes are incomplete");
  validateFixtureIndex(idIndex, "_id_", { _id: 1 });
  assert.notEqual(idIndex.unique, false, "destination _id index must be unique");
  validateFixtureIndex(runIndex, RECOVERY_INDEX, { runId: 1, ordinal: 1 });
  assert.equal(runIndex.unique, true, "destination run index must be unique");
  return matched;
}

export async function deleteExactDestinationRecords(
  records: RecoveryRecord[],
  deleteOne: (record: RecoveryRecord) => Promise<{ deletedCount: number }>,
  onDeleted: () => void,
) {
  for (const record of records) {
    const result = await deleteOne(record);
    assert.equal(result.deletedCount, 1, "exact fixture deletion failed; stop without retry");
    onDeleted();
  }
}
