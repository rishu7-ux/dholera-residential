import assert from "node:assert/strict";
import { constants, readFileSync } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

import { validateMongoTestTarget } from "../lib/mongodb-test-target.ts";
import { loadProtectedRecoveryManifest } from "../lib/noida-recovery-protected-manifest.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = resolve(root, ".artifacts/noida-step-7");
const configPath = resolve(directory, "mongodump-source.yaml");
const archivePath = resolve(directory, "mongodb-test.archive.gz");
const checksumPath = `${archivePath}.sha256`;
const execute = process.argv.includes("--execute");
let stage = "arguments";

async function requireAbsent(path) {
  try {
    await lstat(path);
    throw new Error("backup artifact or config already exists");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

try {
  assert.deepEqual(process.argv.slice(2), execute ? ["--execute"] : [],
    "only one --execute flag is permitted");
  stage = "approval";
  if (execute) {
    assert.equal(process.env.NOIDA_TEST_RECOVERY_BACKUP_APPROVAL,
      "APPROVE_NOIDA_RECOVERY_TEST_BACKUP_ONE_COLLECTION",
      "separate backup creation approval is required");
  }
  assert.equal(process.env.MONGODB_URI, undefined, "production fallback must remain unset");
  stage = "local-configuration";
  const envPath = resolve(root, ".env.test.local");
  const envEntry = await lstat(envPath);
  assert.ok(envEntry.isFile() && !envEntry.isSymbolicLink() && (envEntry.mode & 0o777) === 0o600,
    "TEST environment file must be a real 0600 file");
  const env = parseEnv(readFileSync(envPath, "utf8"));
  assert.equal(env.MONGODB_URI, undefined, "TEST environment file must not include production fallback");
  const target = validateMongoTestTarget(env.MONGODB_TEST_URI);
  assert.equal(decodeURIComponent(new URL(target.uri).username), "noida_test_reader",
    "backup config must use the dedicated TEST reader");
  assert.equal(new URL(target.uri).password.length > 0, true, "TEST reader password is missing");
  assert.equal(/[\r\n]/.test(target.uri), false, "connection URI contains a newline");
  const manifest = await loadProtectedRecoveryManifest(resolve(directory, "recovery-fixture-manifest.json"));
  assert.equal(manifest.runId, "7bfcb927-5910-441a-84b1-0c295e0aed9e",
    "unexpected rehearsal run marker");
  assert.equal(target.hostname, manifest.host);
  assert.equal(target.databaseName, manifest.database);
  await requireAbsent(configPath);
  await requireAbsent(archivePath);
  await requireAbsent(checksumPath);
  if (!execute) {
    console.log(JSON.stringify({ result: "PASS", mode: "OFFLINE_BACKUP_CONFIG_PLAN",
      host: target.hostname, database: target.databaseName, reader: "noida_test_reader",
      configPath, archivePath, checksumPath, filesCreated: false, databaseAccess: false }));
  } else {
    stage = "config-create";
    const handle = await open(configPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
      const entry = await handle.stat();
      assert.ok(entry.isFile() && (entry.mode & 0o777) === 0o600,
        "backup config must be a protected regular file");
      await handle.writeFile(`uri: '${target.uri.replaceAll("'", "''")}'\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    console.log(JSON.stringify({ result: "PASS", mode: "PROTECTED_BACKUP_CONFIG_CREATED",
      host: target.hostname, database: target.databaseName, reader: "noida_test_reader",
      configPath, modeOctal: "0600", databaseAccess: false, archiveCreated: false }));
  }
} catch (error) {
  const rawCode = error?.code;
  const code = typeof rawCode === "number" && Number.isSafeInteger(rawCode) ? rawCode
    : typeof rawCode === "string" && /^[A-Z0-9_]{1,40}$/.test(rawCode) ? rawCode : null;
  console.error(JSON.stringify({ result: "BLOCKED", stage, code,
    reason: "BACKUP_CONFIG_STOPPED; inspect locally without exposing credentials" }));
  process.exitCode = 2;
}
