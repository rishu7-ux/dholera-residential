import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

test("archive verifier accepts only a protected matching local fixture", () => {
  const root = mkdtempSync(join(tmpdir(), "noida-archive-verify-"));
  const directory = join(root, ".artifacts", "noida-step-7");
  const archive = join(directory, "mongodb-test.archive.gz");
  const checksum = `${archive}.sha256`;
  const verifier = join(root, "scripts", "noida-restore-archive-verify.mjs");
  const bytes = Buffer.from("local synthetic verifier test; no database records\n");
  const run = () => {
    const result = spawnSync(process.execPath, [verifier], { encoding: "utf8" });
    return { status: result.status, report: JSON.parse(result.stdout) };
  };

  try {
    mkdirSync(join(root, "scripts"), { mode: 0o700 });
    mkdirSync(join(root, ".artifacts"), { mode: 0o700 });
    mkdirSync(directory, { mode: 0o700 });
    copyFileSync(resolve("scripts/noida-restore-archive-verify.mjs"), verifier);
    writeFileSync(archive, bytes, { mode: 0o600 });
    writeFileSync(checksum,
      `${createHash("sha256").update(bytes).digest("hex")}  mongodb-test.archive.gz\n`,
      { mode: 0o600 });

    assert.deepEqual(run(), {
      status: 0,
      report: {
        result: "PASS",
        mode: "READ_ONLY_ARCHIVE_VERIFICATION",
        checksum: "MATCH",
        permissions: "PASS",
        encryption: "OWNER_EVIDENCE_REQUIRED",
      },
    });

    writeFileSync(archive, "tampered");
    assert.equal(run().report.result, "BLOCKED");
    writeFileSync(archive, bytes);
    chmodSync(archive, 0o644);
    assert.equal(run().report.result, "BLOCKED");
    chmodSync(archive, 0o600);
    renameSync(archive, `${archive}.real`);
    symlinkSync(`${archive}.real`, archive);
    assert.equal(run().report.result, "BLOCKED");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
