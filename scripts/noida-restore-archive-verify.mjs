import assert from "node:assert/strict";
import { createHash, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Local read-only integrity gate. The archive must reside on an approved
// encrypted volume; this script cannot establish volume encryption by itself.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = resolve(root, ".artifacts");
const directory = resolve(artifacts, "noida-step-7");
const archive = resolve(directory, "mongodb-test.archive.gz");
const checksum = `${archive}.sha256`;

async function requireMode(path, mode, kind) {
  const entry = await lstat(path);
  assert.equal(entry.isSymbolicLink(), false, `${kind} must not be a symlink`);
  assert.equal(kind === "directory" ? entry.isDirectory() : entry.isFile(), true, `${kind} has the expected type`);
  assert.equal(entry.mode & 0o777, mode, `${kind} must have mode ${mode.toString(8)}`);
}

async function openProtectedFile(path, kind) {
  await requireMode(path, 0o600, kind);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const entry = await handle.stat();
    assert.ok(entry.isFile() && (entry.mode & 0o777) === 0o600, `${kind} changed during verification`);
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}

try {
  await requireMode(artifacts, 0o700, "directory");
  await requireMode(directory, 0o700, "directory");
  const checksumHandle = await openProtectedFile(checksum, "checksum");
  let match;
  try {
    assert.ok((await checksumHandle.stat()).size <= 256, "checksum file is unexpectedly large");
    match = /^([a-f0-9]{64})  mongodb-test\.archive\.gz$/.exec((await checksumHandle.readFile("utf8")).trim());
    assert.ok(match, "checksum file must contain one SHA-256 digest for the fixed archive name");
  } finally {
    await checksumHandle.close();
  }
  const archiveHandle = await openProtectedFile(archive, "archive");
  try {
    const hash = createHash("sha256");
    for await (const chunk of archiveHandle.createReadStream({ autoClose: false })) hash.update(chunk);
    assert.ok(timingSafeEqual(hash.digest(), Buffer.from(match[1], "hex")), "archive SHA-256 mismatch");
  } finally {
    await archiveHandle.close();
  }
  console.log(JSON.stringify({ result: "PASS", mode: "READ_ONLY_ARCHIVE_VERIFICATION", checksum: "MATCH", permissions: "PASS", encryption: "OWNER_EVIDENCE_REQUIRED" }));
} catch (error) {
  console.log(JSON.stringify({ result: "BLOCKED", mode: "READ_ONLY_ARCHIVE_VERIFICATION", reason: error?.code === "ENOENT" ? "archive or checksum absent" : String(error?.message ?? "verification failed") }));
  process.exitCode = 2;
}
