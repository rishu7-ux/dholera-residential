import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

import { BlobNotFoundError, del, head, put } from "@vercel/blob";
import { validateBlobTestTarget } from "../lib/blob-test-target.ts";

const testEnv = parseEnv(readFileSync(resolve(".env.test.local"), "utf8"));
const pulledEnvPath = resolve(".env.vercel-test.local");
const pulledEnv = existsSync(pulledEnvPath)
  ? parseEnv(readFileSync(pulledEnvPath, "utf8"))
  : {};
const linkedProject = JSON.parse(
  readFileSync(resolve(".vercel/project.json"), "utf8"),
);
const target = validateBlobTestTarget({
  expectedOwnerSlug: "rishu7-uxs-projects",
  expectedStoreId: testEnv.TEST_BLOB_STORE_ID,
  linkedProject,
  oidcStoreId: pulledEnv.BLOB_STORE_ID,
  oidcToken: pulledEnv.VERCEL_OIDC_TOKEN,
  readWriteToken: testEnv.BLOB_READ_WRITE_TOKEN,
  vercelEnvironment: pulledEnv.VERCEL_ENV,
});

const body = Buffer.from(`Noida isolated TEST Blob rehearsal ${randomUUID()}\n`, "utf8");
const expectedHash = createHash("sha256").update(body).digest("hex");
const pathname = `noida-step-7-rehearsal/${randomUUID()}.txt`;
const expectedHostname = `${target.hostnameStoreId}.public.blob.vercel-storage.com`.toLowerCase();
const blobRequestOptions = () => ({
  ...target.authOptions,
  abortSignal: AbortSignal.timeout(30_000),
});

let uploadedUrl;
let deleted = false;

try {
  const uploaded = await put(pathname, body, {
    access: "public",
    addRandomSuffix: false,
    contentType: "text/plain; charset=utf-8",
    ...blobRequestOptions(),
  });
  uploadedUrl = uploaded.url;

  const uploadedUrlObject = new URL(uploaded.url);
  assert.equal(uploadedUrlObject.protocol, "https:");
  assert.equal(uploadedUrlObject.hostname, expectedHostname);
  assert.equal(uploaded.pathname, pathname);

  const metadata = await head(uploaded.url, blobRequestOptions());
  assert.equal(metadata.pathname, pathname);
  assert.equal(metadata.size, body.length);

  const readback = await fetch(uploaded.url, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(readback.status, 200);
  const received = Buffer.from(await readback.arrayBuffer());
  assert.equal(createHash("sha256").update(received).digest("hex"), expectedHash);

  await del(uploaded.url, { ...blobRequestOptions(), ifMatch: metadata.etag });
  deleted = true;

  await assert.rejects(
    () => head(uploaded.url, blobRequestOptions()),
    (error) => error instanceof BlobNotFoundError,
    "deleted TEST object must no longer exist",
  );

  console.log(JSON.stringify({
    result: "PASS",
    authentication: target.authKind,
    storeIdentity: "matched owner-declared TEST store",
    upload: "PASS",
    readback: "PASS",
    checksum: "PASS",
    conditionalDeletion: "PASS",
    cleanup: "PASS",
  }));
} finally {
  if (uploadedUrl && !deleted) {
    await del(uploadedUrl, blobRequestOptions()).catch(() => undefined);
  }
}
