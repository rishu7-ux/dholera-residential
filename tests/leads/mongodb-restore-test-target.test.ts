import assert from "node:assert/strict";
import test from "node:test";

import { validateMongoRestoreTestTarget } from "../../lib/mongodb-restore-test-target";

const target = (database = "omana-phase5-restore-20261017a") =>
  `mongodb+srv://test-user:test-password@cluster0.zshxfui.mongodb.net/${database}?retryWrites=true&w=majority&authSource=admin`;

test("accepts a distinct disposable database on the approved TEST cluster", () => {
  const result = validateMongoRestoreTestTarget(target());
  assert.equal(result.hostname, "cluster0.zshxfui.mongodb.net");
  assert.equal(result.databaseName, "omana-phase5-restore-20261017a");
});

test("rejects the source TEST database as a restore destination", () => {
  assert.throws(
    () => validateMongoRestoreTestTarget(target("omana-phase5-test-2")),
    /distinct approved disposable TEST database/,
  );
});

test("rejects a database outside the disposable restore naming convention", () => {
  assert.throws(
    () => validateMongoRestoreTestTarget(target("production")),
    /distinct approved disposable TEST database/,
  );
});

test("rejects a different cluster", () => {
  assert.throws(
    () => validateMongoRestoreTestTarget(target().replace("cluster0.zshxfui.mongodb.net", "other.example.net")),
    /approved TEST cluster/,
  );
});

test("rejects weakened TLS", () => {
  assert.throws(
    () => validateMongoRestoreTestTarget(`${target()}&tlsInsecure=true`),
    /TLS verification/,
  );
});

test("rejects a missing destination URI", () => {
  assert.throws(
    () => validateMongoRestoreTestTarget(undefined),
    /MONGODB_RESTORE_TEST_URI is required/,
  );
});

test("rejects the former TEST host and another restore run name", () => {
  assert.throws(() => validateMongoRestoreTestTarget(target().replace("cluster0.zshxfui.mongodb.net", "cluster0.oqcardp.mongodb.net")), /approved TEST cluster/);
  assert.throws(() => validateMongoRestoreTestTarget(target("omana-phase5-restore-20261016a")), /distinct approved disposable TEST database/);
});
