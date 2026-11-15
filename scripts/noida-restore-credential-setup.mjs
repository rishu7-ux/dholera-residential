import assert from "node:assert/strict";
import { closeSync, fsyncSync, lstatSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

import { validateMongoRestoreTestTarget } from "../lib/mongodb-restore-test-target.ts";
import { validateMongoTestTarget } from "../lib/mongodb-test-target.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.test.local");
const expectedHost = "cluster0.zshxfui.mongodb.net";
const expectedSource = "omana-phase5-test-2";
const expectedDestination = "omana-phase5-restore-20261017a";

async function readHiddenPassword() {
  assert.ok(process.stdin.isTTY && process.stdin.setRawMode, "a local interactive Terminal is required");
  process.stdout.write("Enter the current RAW noida_test_restore TEST password (hidden): ");
  let value = "";
  process.stdin.setEncoding("utf8");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  try {
    return await new Promise((resolvePassword, rejectPassword) => {
      function onData(chunk) {
        const input = String(chunk);
        for (const character of input) {
          if (character === "\r" || character === "\n") {
            process.stdin.off("data", onData);
            resolvePassword(value);
            return;
          }
          if (character === "\u0003") {
            process.stdin.off("data", onData);
            rejectPassword(new Error("input cancelled"));
            return;
          }
          if (character === "\u007f" || character === "\b") {
            value = Array.from(value).slice(0, -1).join("");
          } else if (/\p{C}/u.test(character) || value.length >= 1024) {
            process.stdin.off("data", onData);
            rejectPassword(new Error("invalid input"));
            return;
          } else {
            value += character;
          }
        }
      }
      process.stdin.on("data", onData);
    });
  } finally {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write("\n");
  }
}

try {
  assert.ok(!process.env.MONGODB_URI, "production fallback must be unset");
  const fileStat = lstatSync(envPath);
  assert.ok(fileStat.isFile() && !fileStat.isSymbolicLink() && (fileStat.mode & 0o777) === 0o600);
  const original = readFileSync(envPath, "utf8");
  const env = parseEnv(original);
  assert.ok(!env.MONGODB_URI, "production URI must not be present in TEST file");
  const source = validateMongoTestTarget(env.MONGODB_TEST_URI);
  assert.equal(source.hostname, expectedHost);
  assert.equal(source.databaseName, expectedSource);
  assert.equal(decodeURIComponent(new URL(source.uri).username), "noida_test_reader");
  const writer = new URL(env.MONGODB_CRM_TEST_WRITER_URI);
  assert.equal(writer.hostname, expectedHost);
  assert.equal(decodeURIComponent(writer.pathname.slice(1)), expectedSource);
  assert.equal(decodeURIComponent(writer.username), "noida_test_writer");
  assert.equal(writer.searchParams.get("authSource"), "admin");
  assert.equal((original.match(/^MONGODB_RESTORE_TEST_URI=/gm) ?? []).length, 1);
  assert.ok(env.MONGODB_RESTORE_TEST_URI, "restore URI must exist");

  const password = await readHiddenPassword();
  assert.ok(password.length > 0 && !/\p{C}/u.test(password), "password input is invalid");
  const uri = new URL(`mongodb+srv://noida_test_restore@${expectedHost}/${expectedDestination}?retryWrites=true&w=majority&authSource=admin`);
  uri.password = password;
  const target = validateMongoRestoreTestTarget(uri.toString());
  assert.equal(decodeURIComponent(new URL(target.uri).username), "noida_test_restore");
  const updated = original.replace(/^MONGODB_RESTORE_TEST_URI=.*$/m, `MONGODB_RESTORE_TEST_URI=${target.uri}`);
  const updatedEnv = parseEnv(updated);
  for (const [key, value] of Object.entries(env)) {
    if (key !== "MONGODB_RESTORE_TEST_URI") assert.equal(updatedEnv[key], value, "other TEST credentials must remain unchanged");
  }
  const tempPath = `${envPath}.restore-setup-${process.pid}`;
  let fd;
  try {
    fd = openSync(tempPath, "wx", 0o600);
    writeFileSync(fd, updated, "utf8");
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(tempPath, envPath);
  } finally {
    if (fd !== undefined) closeSync(fd);
    try { unlinkSync(tempPath); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  assert.equal(lstatSync(envPath).mode & 0o777, 0o600);
  console.log(JSON.stringify({ result: "PASS", updated: "MONGODB_RESTORE_TEST_URI only", hostname: expectedHost, database: expectedDestination, fileMode: "0600" }));
} catch {
  console.error(JSON.stringify({ result: "FAIL", reason: "restore setup stopped before authentication; check TEST target and hidden input locally" }));
  process.exitCode = 1;
}
