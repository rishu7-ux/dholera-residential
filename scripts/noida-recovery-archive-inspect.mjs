import assert from "node:assert/strict";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";

import { loadProtectedRecoveryManifest } from "../lib/noida-recovery-protected-manifest.ts";
import { digestRecords, planExactRecoveryCleanup, RECOVERY_COLLECTION, RECOVERY_INDEX, RECOVERY_MAX_RECORDS } from "../lib/noida-recovery-fixture.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = resolve(root, ".artifacts/noida-step-7");
const archivePath = resolve(directory, "mongodb-test.archive.gz");
const terminator = 0xffffffff;
let stage = "archive-open";

function parseArchive(bytes) {
  let offset = 0;
  assert.equal(bytes.readUInt32LE(offset), 0x8199e26d, "unexpected MongoDB archive magic");
  offset += 4;
  function readDocument() {
    assert.ok(offset + 4 <= bytes.length, "truncated archive document length");
    const length = bytes.readInt32LE(offset);
    assert.ok(length >= 5 && length <= 1024 * 1024 && offset + length <= bytes.length,
      "invalid archive document length");
    const document = mongoose.mongo.BSON.deserialize(bytes.subarray(offset, offset + length));
    offset += length;
    return document;
  }
  function atTerminator() {
    return offset + 4 <= bytes.length && bytes.readUInt32LE(offset) === terminator;
  }
  function readTerminator() {
    assert.equal(atTerminator(), true, "archive segment terminator missing");
    offset += 4;
  }

  const header = readDocument();
  assert.equal(header.version, "0.1", "unexpected archive format version");
  assert.equal(header.tool_version, "100.19.1", "unexpected dump tool version");
  const metadata = [];
  while (!atTerminator()) {
    assert.ok(metadata.length < 2, "archive contains unexpected collection metadata");
    metadata.push(readDocument());
  }
  readTerminator();
  assert.equal(metadata.length, 1, "archive must contain exactly one collection");

  const records = [];
  const segmentNamespaces = new Set();
  const eofNamespaces = new Set();
  while (offset < bytes.length) {
    const namespaceHeader = readDocument();
    assert.equal(typeof namespaceHeader.db, "string", "archive namespace database missing");
    assert.equal(typeof namespaceHeader.collection, "string", "archive namespace collection missing");
    const namespace = `${namespaceHeader.db}.${namespaceHeader.collection}`;
    if (namespaceHeader.EOF === true) {
      assert.equal(eofNamespaces.has(namespace), false, "duplicate namespace EOF");
      eofNamespaces.add(namespace);
      readTerminator();
      continue;
    }
    assert.equal(namespaceHeader.EOF, false, "invalid archive namespace header");
    segmentNamespaces.add(namespace);
    while (!atTerminator()) {
      assert.ok(records.length < RECOVERY_MAX_RECORDS + 1, "archive has too many records");
      records.push(readDocument());
    }
    readTerminator();
  }
  assert.equal(offset, bytes.length, "archive has trailing data");
  return { header, metadata, records, segmentNamespaces, eofNamespaces };
}

try {
  assert.equal(process.argv.length, 2, "archive inspection accepts no arguments");
  const manifest = await loadProtectedRecoveryManifest(resolve(directory, "recovery-fixture-manifest.json"));
  const entry = await lstat(archivePath);
  assert.ok(entry.isFile() && !entry.isSymbolicLink() && (entry.mode & 0o777) === 0o600,
    "archive must be a real 0600 file");
  assert.ok(entry.size > 0 && entry.size <= 1024 * 1024, "archive size is outside the synthetic fixture limit");
  const handle = await open(archivePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  let compressed;
  try {
    const opened = await handle.stat();
    assert.ok(opened.isFile() && (opened.mode & 0o777) === 0o600 &&
      opened.dev === entry.dev && opened.ino === entry.ino, "archive protection changed during open");
    compressed = await handle.readFile();
  } finally {
    await handle.close();
  }
  stage = "archive-parse";
  const parsed = parseArchive(gunzipSync(compressed, { maxOutputLength: 1024 * 1024 }));
  const expectedNamespace = `${manifest.database}.${RECOVERY_COLLECTION}`;
  assert.equal(parsed.metadata[0].db, manifest.database, "archive metadata database mismatch");
  assert.equal(parsed.metadata[0].collection, RECOVERY_COLLECTION, "archive metadata collection mismatch");
  assert.equal(parsed.metadata[0].type, "collection", "archive must contain a regular collection");
  assert.deepEqual([...parsed.segmentNamespaces], [expectedNamespace], "unexpected archive data namespace");
  assert.deepEqual([...parsed.eofNamespaces], [expectedNamespace], "unexpected archive EOF namespace");
  const collectionMetadata = mongoose.mongo.BSON.EJSON.parse(parsed.metadata[0].metadata);
  assert.equal(collectionMetadata.collectionName, RECOVERY_COLLECTION,
    "archive collection metadata mismatch");
  assert.equal(collectionMetadata.indexes?.length, 2, "unexpected archive index count");
  const indexes = new Map(collectionMetadata.indexes.map((index) => [index.name, index]));
  assert.equal(indexes.size, 2, "duplicate archive index name");
  assert.deepEqual(indexes.get("_id_")?.key, { _id: 1 }, "archive _id index mismatch");
  assert.deepEqual(indexes.get(RECOVERY_INDEX)?.key, { runId: 1, ordinal: 1 },
    "archive run index mismatch");
  assert.equal(indexes.get(RECOVERY_INDEX)?.unique, true, "archive run index must be unique");
  assert.equal(parsed.records.length, RECOVERY_MAX_RECORDS, "archive record count mismatch");
  assert.equal(planExactRecoveryCleanup(manifest, parsed.records).length, RECOVERY_MAX_RECORDS,
    "archive record identity or content mismatch");
  assert.equal(digestRecords(parsed.records), manifest.sha256, "archive content digest mismatch");
  console.log(JSON.stringify({ result: "PASS", mode: "OFFLINE_ARCHIVE_INSPECTION",
    archiveNamespaces: [expectedNamespace], records: RECOVERY_MAX_RECORDS,
    exactIds: true, contentsMatchManifest: true, contentSha256: manifest.sha256,
    indexes: ["_id_", RECOVERY_INDEX], databaseAccess: false, databaseWrites: false }));
} catch (error) {
  const rawCode = error?.code;
  const code = typeof rawCode === "number" && Number.isSafeInteger(rawCode) ? rawCode
    : typeof rawCode === "string" && /^[A-Z0-9_]{1,40}$/.test(rawCode) ? rawCode : null;
  console.error(JSON.stringify({ result: "BLOCKED", stage, code,
    reason: "ARCHIVE_INSPECTION_FAILED; preserve archive and inspect locally without exposing credentials" }));
  process.exitCode = 2;
}
