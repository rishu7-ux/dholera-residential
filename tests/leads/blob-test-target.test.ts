import assert from "node:assert/strict";
import test from "node:test";

import { validateBlobTestTarget } from "../../lib/blob-test-target";

const now = new Date("2026-10-15T12:00:00.000Z");
const linkedProject = {
  orgId: "team_test",
  projectId: "prj_test",
  projectName: "nextjs-boilerplate",
};

function oidcToken(overrides: Record<string, unknown> = {}) {
  const claims = {
    aud: "https://vercel.com/rishu7-uxs-projects",
    environment: "development",
    exp: Math.floor(now.getTime() / 1000) + 3600,
    iss: "https://oidc.vercel.com/rishu7-uxs-projects",
    nbf: Math.floor(now.getTime() / 1000) - 60,
    owner: "rishu7-uxs-projects",
    owner_id: linkedProject.orgId,
    project: linkedProject.projectName,
    project_id: linkedProject.projectId,
    sub: "owner:rishu7-uxs-projects:project:nextjs-boilerplate:environment:development",
    ...overrides,
  };
  return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}

test("accepts a token whose embedded store ID matches the declared TEST store", () => {
  const result = validateBlobTestTarget({
    expectedStoreId: "store_TESTSTORE",
    readWriteToken: "vercel_blob_rw_teststore_randomvalue",
  });
  assert.equal(result.storeId, "store_TESTSTORE");
  assert.equal(result.authKind, "read-write-token");
});

test("accepts OIDC only for the approved store, project, owner, and non-production contexts", () => {
  const result = validateBlobTestTarget({
    expectedOwnerSlug: "rishu7-uxs-projects",
    expectedStoreId: "store_TESTSTORE",
    linkedProject,
    now,
    oidcStoreId: "store_teststore",
    oidcToken: oidcToken(),
    vercelEnvironment: "preview",
  });
  assert.equal(result.storeId, "store_TESTSTORE");
  assert.equal(result.authKind, "oidc");
});

test("rejects missing Blob credentials", () => {
  assert.throws(
    () => validateBlobTestTarget({ expectedStoreId: "store_teststore" }),
    /requires either BLOB_READ_WRITE_TOKEN or VERCEL_OIDC_TOKEN/,
  );
});

test("rejects a missing declared TEST store ID", () => {
  assert.throws(
    () => validateBlobTestTarget({
      expectedStoreId: undefined,
      readWriteToken: "vercel_blob_rw_teststore_randomvalue",
    }),
    /TEST_BLOB_STORE_ID/,
  );
});

test("rejects malformed token formats", () => {
  assert.throws(
    () => validateBlobTestTarget({
      expectedStoreId: "store_teststore",
      readWriteToken: "not-a-vercel-token",
    }),
    /supported Vercel Blob token format/,
  );
});

test("rejects a token for a different store", () => {
  assert.throws(
    () => validateBlobTestTarget({
      expectedStoreId: "store_teststore",
      readWriteToken: "vercel_blob_rw_otherstore_randomvalue",
    }),
    /does not belong to TEST_BLOB_STORE_ID/,
  );
});

test("rejects an OIDC binding for a different store", () => {
  assert.throws(
    () => validateBlobTestTarget({
      expectedOwnerSlug: "rishu7-uxs-projects",
      expectedStoreId: "store_teststore",
      linkedProject,
      now,
      oidcStoreId: "store_otherstore",
      oidcToken: oidcToken(),
    }),
    /BLOB_STORE_ID does not match TEST_BLOB_STORE_ID/,
  );
});

test("rejects a production OIDC credential", () => {
  assert.throws(
    () => validateBlobTestTarget({
      expectedOwnerSlug: "rishu7-uxs-projects",
      expectedStoreId: "store_teststore",
      linkedProject,
      now,
      oidcStoreId: "store_teststore",
      oidcToken: oidcToken({ environment: "production" }),
      vercelEnvironment: "production",
    }),
    /non-production TEST environment/,
  );
});

test("rejects a production pulled environment even with a development OIDC token", () => {
  assert.throws(
    () => validateBlobTestTarget({
      expectedOwnerSlug: "rishu7-uxs-projects",
      expectedStoreId: "store_teststore",
      linkedProject,
      now,
      oidcStoreId: "store_teststore",
      oidcToken: oidcToken(),
      vercelEnvironment: "production",
    }),
    /VERCEL_ENV must target a non-production TEST environment/,
  );
});

test("rejects OIDC credentials for a different project", () => {
  assert.throws(
    () => validateBlobTestTarget({
      expectedOwnerSlug: "rishu7-uxs-projects",
      expectedStoreId: "store_teststore",
      linkedProject,
      now,
      oidcStoreId: "store_teststore",
      oidcToken: oidcToken({ project_id: "prj_other" }),
    }),
    /does not match the approved linked TEST project/,
  );
});

test("rejects expired OIDC credentials", () => {
  assert.throws(
    () => validateBlobTestTarget({
      expectedOwnerSlug: "rishu7-uxs-projects",
      expectedStoreId: "store_teststore",
      linkedProject,
      now,
      oidcStoreId: "store_teststore",
      oidcToken: oidcToken({ exp: Math.floor(now.getTime() / 1000) - 1 }),
    }),
    /not active or is too close to expiry/,
  );
});

test("rejects ambiguous legacy and OIDC credentials", () => {
  assert.throws(
    () => validateBlobTestTarget({
      expectedStoreId: "store_teststore",
      oidcToken: oidcToken(),
      readWriteToken: "vercel_blob_rw_teststore_randomvalue",
    }),
    /ambiguous Blob authentication credentials/,
  );
});
