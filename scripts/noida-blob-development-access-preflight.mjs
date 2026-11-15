import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { validateBlobTestTarget } from "../lib/blob-test-target.ts";

process.env.VERCEL_BLOB_RETRIES = "0";
const { list } = await import("@vercel/blob");

const testEnv = parseEnv(readFileSync(".env.test.local", "utf8"));
const pulledEnv = parseEnv(readFileSync(".env.vercel-test.local", "utf8"));
const linkedProject = JSON.parse(readFileSync(".vercel/project.json", "utf8"));

assert.equal(
  Boolean(testEnv.BLOB_READ_WRITE_TOKEN?.trim()),
  false,
  "BLOB_READ_WRITE_TOKEN must remain empty in .env.test.local",
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

assert.equal(target.authKind, "oidc", "only OIDC authentication is allowed");

const result = await list({
  ...target.authOptions,
  abortSignal: AbortSignal.timeout(10_000),
  limit: 1,
  prefix: "noida-step-7-rehearsal/",
});

assert.equal(result.blobs.length, 0, "rehearsal prefix must be empty before upload");
assert.equal(Boolean(result.hasMore), false, "rehearsal prefix must have no additional objects");

console.log(JSON.stringify({
  result: "PASS",
  authentication: "oidc",
  environment: "development",
  linkedProject: "nextjs-boilerplate",
  store: "noida-phase1-test-blob",
  developmentAuthorization: "PASS",
  rehearsalPrefixEmpty: true,
  secretsPrinted: false,
}));
