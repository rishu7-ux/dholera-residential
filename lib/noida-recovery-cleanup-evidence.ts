import assert from "node:assert/strict";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { dirname } from "node:path";

export type CleanupFailureEvent = {
  timestamp: string;
  stage: string;
  code: string | number | null;
  recordsDeletedBeforeStop: number;
};

export async function appendProtectedCleanupFailure(path: string, event: CleanupFailureEvent) {
  for (const directory of [dirname(dirname(path)), dirname(path)]) {
    const entry = await lstat(directory);
    assert.ok(entry.isDirectory() && !entry.isSymbolicLink() && (entry.mode & 0o777) === 0o700,
      "cleanup evidence directory must be a real 0700 directory");
  }
  const handle = await open(path, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try {
    const entry = await handle.stat();
    assert.ok(entry.isFile() && (entry.mode & 0o777) === 0o600,
      "cleanup evidence must be a protected regular file");
    await handle.writeFile(`${JSON.stringify(event)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}
