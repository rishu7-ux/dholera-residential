import assert from "node:assert/strict";
import test from "node:test";

import { validateMongoCrmTestWriterTarget } from "../../lib/mongodb-crm-test-writer-target";

const host = "cluster0.zshxfui.mongodb.net";
const database = "omana-phase5-test-2";
const restore = "mongodb+srv://restore-user:restore-password@cluster0.zshxfui.mongodb.net/omana-phase5-restore-20261017a?authSource=admin";
const reader = `mongodb+srv://noida_test_reader:reader-secret@${host}/${database}?authSource=admin`;
const writer = `mongodb+srv://noida_test_writer:writer-secret@${host}/${database}?retryWrites=true&w=majority&authSource=admin`;

test("accepts only the dedicated writer on the approved TEST database", () => {
  const target = validateMongoCrmTestWriterTarget(writer, reader, restore);
  assert.deepEqual(
    {
      hostname: target.hostname,
      databaseName: target.databaseName,
      username: target.username,
      expectedAtlasRoles: target.expectedAtlasRoles,
    },
    {
      hostname: host,
      databaseName: database,
      username: "noida_test_writer",
      expectedAtlasRoles: [{ role: "readWrite", database }],
    },
  );
});

test("rejects a missing writer URI or placeholder credential", () => {
  assert.throws(() => validateMongoCrmTestWriterTarget(undefined, reader, restore));
  assert.throws(() => validateMongoCrmTestWriterTarget(
    writer.replace("writer-secret", "TEST_WRITER_PASSWORD"),
    reader,
    restore,
  ));
});

test("rejects reader, restore, and unexpected usernames", () => {
  assert.throws(() => validateMongoCrmTestWriterTarget(reader, reader, restore));
  assert.throws(() => validateMongoCrmTestWriterTarget(restore, reader, restore));
  assert.throws(() => validateMongoCrmTestWriterTarget(
    writer.replace("noida_test_writer", "other-writer"),
    reader,
    restore,
  ));
});

test("rejects other hosts, databases, and insecure connection options", () => {
  assert.throws(() => validateMongoCrmTestWriterTarget(
    writer.replace(host, "other.mongodb.net"),
    reader,
    restore,
  ));
  assert.throws(() => validateMongoCrmTestWriterTarget(
    writer.replace(database, "other-database"),
    reader,
    restore,
  ));
  assert.throws(() => validateMongoCrmTestWriterTarget(
    `${writer}&tlsInsecure=true`,
    reader,
    restore,
  ));
});

test("rejects a production fallback or changed reader identity", () => {
  assert.throws(() => validateMongoCrmTestWriterTarget(writer, reader, restore, writer));
  assert.throws(() => validateMongoCrmTestWriterTarget(
    writer,
    reader.replace("noida_test_reader", "noida_test_writer"),
    restore,
  ));
});
