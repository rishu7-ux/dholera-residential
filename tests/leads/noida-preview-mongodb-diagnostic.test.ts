import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  authorizePreviewMongoDiagnostic,
  PreviewMongoDiagnosticGuardError,
  previewMongoDiagnosticBody,
  requestHasBodyBytes,
} from "../../lib/noida-preview-mongodb-diagnostic";

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

test("bodyless POST streams are accepted, supplied bytes are rejected", async () => {
  assert.equal(await requestHasBodyBytes(null), false);
  const empty = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
  assert.equal(await requestHasBodyBytes(empty), false);
  const supplied = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(0));
      controller.enqueue(new Uint8Array([1]));
      controller.close();
    },
  });
  assert.equal(await requestHasBodyBytes(supplied), true);
});

test("Master CMS diagnostic permits only its own protected Preview TEST identity", () => {
  const id = "prj_BaMZLgjsftAewYTezNLEV0zG5v7A";
  const candidate = { ...env, VERCEL_PROJECT_ID: id, NOIDA_STAGING_PROJECT_ID: id };
  assert.equal(authorizePreviewMongoDiagnostic(request, candidate, now).database, "omana-phase5-crm-stage-20261017a");
  for (const changed of [
    { VERCEL_ENV: "production" },
    { NOIDA_STAGING_PROJECT_ID: env.NOIDA_STAGING_PROJECT_ID },
    { NOIDA_SMTP_DELIVERY_ENABLED: "1" },
    { MONGODB_URI: uri.replace("cluster0.zshxfui.mongodb.net", "dholera.wfgzru7.mongodb.net") },
    { MONGODB_URI: uri.replace("omana-phase5-crm-stage-20261017a", "test") },
  ]) assert.throws(() => authorizePreviewMongoDiagnostic(request, { ...candidate, ...changed }, now));
});

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

test("classifies denied guards with fixed internal codes and a generic public error", () => {
  const cases = [
    ["request", { ...request, hasBody: true }, env, now],
    ["preview_identity", request, { ...env, VERCEL_ENV: "production" }, now],
    ["deployment_id", request, { ...env, VERCEL_DEPLOYMENT_ID: undefined }, now],
    ["token_configuration", request, { ...env, NOIDA_PREVIEW_DIAGNOSTIC_TOKEN_SHA256: undefined }, now],
    ["token_format", { ...request, authorization: null }, env, now],
    ["token_window", request, env, now + 15 * 60 * 1000],
    ["token_mismatch", { ...request, authorization: `Bearer ${"b".repeat(43)}` }, env, now],
    ["test_target", request, { ...env, MONGODB_URI: uri.replace("omana-phase5-crm-stage-20261017a", "wrong") }, now],
  ] as const;

  for (const [reason, candidateRequest, candidateEnv, candidateNow] of cases) {
    assert.throws(
      () => authorizePreviewMongoDiagnostic(candidateRequest, candidateEnv, candidateNow),
      (error: unknown) => {
        assert.ok(error instanceof PreviewMongoDiagnosticGuardError);
        assert.equal(error.reason, reason);
        assert.equal(error.message, "Preview diagnostic request is not authorized");
        return true;
      },
    );
  }
});
