import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { authorizePreviewMongoDiagnostic, previewMongoDiagnosticBody } from "../../lib/noida-preview-mongodb-diagnostic";

const token = "a".repeat(43);
const now = Date.parse("2026-11-11T10:00:00Z");
const uri = "mongodb+srv://noida_stage_app:synthetic-password@cluster0.zshxfui.mongodb.net/omana-phase5-crm-stage-20261017a?authSource=admin&tls=true";
const env = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_PROJECT_ID: "prj_Xs3h7xDAvKP59ohOmeWd4Ht2wxlj",
  VERCEL_DEPLOYMENT_ID: "dpl_Aay9EhJxDSozcRe9hbpmQDMC4Dm9",
  NOIDA_STAGING_MODE: "1",
  NOIDA_STAGING_PROJECT_ID: "prj_Xs3h7xDAvKP59ohOmeWd4Ht2wxlj",
  NOIDA_SMTP_DELIVERY_ENABLED: "0",
  MONGODB_URI: uri,
  NOIDA_PREVIEW_DIAGNOSTIC_EXPIRES_AT: "2026-11-11T10:15:00Z",
  NOIDA_PREVIEW_DIAGNOSTIC_TOKEN_SHA256: createHash("sha256").update(token).digest("hex"),
};
const request = {
  url: "https://noida-phase1-crm-staging-example.vercel.app/api/test-mongodb",
  authorization: `Bearer ${token}`,
  hasBody: false,
};

test("accepts only the guarded TEST target during the short Preview window", () => {
  const target = authorizePreviewMongoDiagnostic(request, env, now);
  assert.equal(target.hostname, "cluster0.zshxfui.mongodb.net");
  assert.equal(target.database, "omana-phase5-crm-stage-20261017a");
  assert.equal(target.deploymentId, env.VERCEL_DEPLOYMENT_ID);
});

test("failure identifies only the configured target and no verified connection", () => {
  const target = authorizePreviewMongoDiagnostic(request, env, now);
  const failed = previewMongoDiagnosticBody(target, { ping: "FAIL", connectedDatabase: null });
  assert.equal(failed.configuredDatabase, "omana-phase5-crm-stage-20261017a");
  assert.equal(failed.connectedDatabase, null);
  assert.equal(failed.ping, "FAIL");
  assert.equal(JSON.stringify(failed).includes("synthetic-password"), false);

  const passed = previewMongoDiagnosticBody(target, { ping: "PASS", connectedDatabase: target.database });
  assert.equal(passed.connectedDatabase, target.database);
  assert.equal(passed.ping, "PASS");
});

test("rejects wrong token, expired window, non-HTTPS, query and body", () => {
  assert.throws(() => authorizePreviewMongoDiagnostic({ ...request, authorization: `Bearer ${"b".repeat(43)}` }, env, now));
  assert.throws(() => authorizePreviewMongoDiagnostic(request, env, now + 15 * 60 * 1000));
  assert.throws(() => authorizePreviewMongoDiagnostic({ ...request, url: request.url.replace("https:", "http:") }, env, now));
  assert.throws(() => authorizePreviewMongoDiagnostic({ ...request, url: `${request.url}?debug=1` }, env, now));
  assert.throws(() => authorizePreviewMongoDiagnostic({ ...request, hasBody: true }, env, now));
});

test("rejects Production, wrong project, SMTP enabled and wrong database", () => {
  for (const changed of [
    { VERCEL_ENV: "production" },
    { VERCEL_PROJECT_ID: "other" },
    { VERCEL_PROJECT_ID: "other", NOIDA_STAGING_MODE: undefined, NOIDA_STAGING_PROJECT_ID: undefined },
    { NOIDA_SMTP_DELIVERY_ENABLED: "1" },
    { MONGODB_URI: uri.replace("omana-phase5-crm-stage-20261017a", "production") },
  ]) {
    assert.throws(() => authorizePreviewMongoDiagnostic(request, { ...env, ...changed }, now));
  }
});
