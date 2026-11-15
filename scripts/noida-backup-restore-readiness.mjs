import assert from "node:assert/strict";
import { constants, readFileSync, statSync } from "node:fs";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

import { validateMongoRestoreTestTarget } from "../lib/mongodb-restore-test-target.ts";
import { validateMongoTestTarget } from "../lib/mongodb-test-target.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = parseEnv(readFileSync(resolve(root, ".env.test.local"), "utf8"));
assert.equal(statSync(resolve(root, ".env.test.local")).mode & 0o777, 0o600, "TEST environment file must have mode 0600");

assert.equal(
  process.env.MONGODB_URI,
  undefined,
  "MONGODB_URI must remain unset during TEST backup/restore preparation",
);

const source = validateMongoTestTarget(env.MONGODB_TEST_URI, process.env.MONGODB_URI);
const issues = [];
let restoreUrl;
try {
  restoreUrl = new URL(env.MONGODB_RESTORE_TEST_URI);
} catch {
  issues.push("restore URI is missing or malformed");
}
if (restoreUrl) {
  try {
    const username = decodeURIComponent(restoreUrl.username);
    const password = decodeURIComponent(restoreUrl.password);
    if (username !== "noida_test_restore") issues.push("dedicated TEST restore username is not configured");
    if (!password || /^(?:placeholder|change-?me|your.*|restore_test_password)$/i.test(password)) {
      issues.push("dedicated TEST restore password is not configured");
    }
  } catch {
    issues.push("restore credentials must be valid URL-encoded text");
  }
}
let destination;
try {
  destination = validateMongoRestoreTestTarget(env.MONGODB_RESTORE_TEST_URI);
} catch {
  issues.push("restore URI must use the approved TEST host and exact disposable database");
}
if (destination) {
  if (source.databaseName === destination.databaseName) issues.push("source and destination databases must differ");
  if (source.hostname !== destination.hostname) issues.push("source and destination must use the same approved TEST cluster");
}

const toolsRoot = resolve(
  root,
  ".tools/mongodb-database-tools-macos-arm64-100.19.1/bin",
);
const mongodump = resolve(toolsRoot, "mongodump");
const mongorestore = resolve(toolsRoot, "mongorestore");
await Promise.all([
  access(mongodump, constants.X_OK),
  access(mongorestore, constants.X_OK),
]);

const report = {
  result: issues.length ? "BLOCKED" : "READY_FOR_READ_ONLY_DESTINATION_PREFLIGHT",
  networkAccess: false,
  databaseWrites: false,
  source: {
    hostname: source.hostname,
    database: source.databaseName,
  },
  destination: destination ? { hostname: destination.hostname, database: destination.databaseName } : null,
  issues,
  databaseTools: {
    mongodump: "100.19.1 candidate-local executable",
    mongorestore: "100.19.1 candidate-local executable",
  },
  plannedArchive: ".artifacts/noida-step-7/mongodb-test.archive.gz",
  plannedChecksum: ".artifacts/noida-step-7/mongodb-test.archive.gz.sha256",
  archiveCreated: false,
  destinationExistenceVerified: false,
  restoreApproved: false,
};

console.log(JSON.stringify(report, null, 2));

if (issues.length) {
  process.exitCode = 2;
}
