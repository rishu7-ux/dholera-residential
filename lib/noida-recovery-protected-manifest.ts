import assert from "node:assert/strict";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { dirname } from "node:path";

import { validateRecoveryManifest } from "./noida-recovery-fixture";

async function requireProtectedDirectory(path: string) {
  const entry = await lstat(path);
  assert.ok(entry.isDirectory() && !entry.isSymbolicLink() && (entry.mode & 0o777) === 0o700,
    "manifest directory must be a real 0700 directory");
}

export async function loadProtectedRecoveryManifest(path: string) {
  const directory = dirname(path);
  await requireProtectedDirectory(dirname(directory));
  await requireProtectedDirectory(directory);
  const entry = await lstat(path);
  assert.ok(entry.isFile() && !entry.isSymbolicLink() && (entry.mode & 0o777) === 0o600,
    "manifest must be a protected regular file");
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    assert.ok(opened.isFile() && (opened.mode & 0o777) === 0o600 &&
      opened.dev === entry.dev && opened.ino === entry.ino,
      "manifest protection changed during open");
    assert.ok(opened.size > 0 && opened.size < 4096, "manifest size is invalid");
    return validateRecoveryManifest(JSON.parse(await handle.readFile("utf8")));
  } finally {
    await handle.close();
  }
}
