import assert from "node:assert/strict";
import test from "node:test";

import { resolveNoidaStagingMongoUri } from "../../lib/noida-staging-runtime";

const masterProject = "prj_BaMZLgjsftAewYTezNLEV0zG5v7A";
const fakeUri = (host: string, database: string, user: string) => {
  const uri = new URL(`mongodb+srv://${user}:unit-test-only@${host}/${database}`);
  uri.searchParams.set("authSource", "admin");
  uri.searchParams.set("tls", "true");
  return uri.toString();
};

const productionUri = fakeUri("dholera.wfgzru7.mongodb.net", "test", "unit");
const testUri = fakeUri("cluster0.zshxfui.mongodb.net", "omana-phase5-crm-stage-20261017a", "noida_stage_app");
const production = {
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_PROJECT_ID: masterProject,
  MONGODB_URI: productionUri,
};
const preview = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_PROJECT_ID: masterProject,
  NOIDA_STAGING_MODE: "1",
  NOIDA_STAGING_PROJECT_ID: masterProject,
  NOIDA_SMTP_DELIVERY_ENABLED: "0",
  MONGODB_URI: testUri,
};

test("verified Master CMS Production identity retains its MongoDB binding", () => {
  assert.equal(resolveNoidaStagingMongoUri(production), productionUri);
});

test("Preview accepts only the approved TEST identity", () => {
  assert.equal(resolveNoidaStagingMongoUri(preview), testUri);
  assert.throws(() => resolveNoidaStagingMongoUri({ ...preview, MONGODB_URI: productionUri }));
});

test("Preview fails closed when staging flags or project identity are missing", () => {
  assert.throws(() => resolveNoidaStagingMongoUri({ ...preview, NOIDA_STAGING_MODE: undefined, NOIDA_STAGING_PROJECT_ID: undefined, MONGODB_URI: productionUri }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...preview, VERCEL_PROJECT_ID: undefined, NOIDA_STAGING_MODE: undefined, NOIDA_STAGING_PROJECT_ID: undefined, MONGODB_URI: productionUri }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...preview, VERCEL_ENV: undefined, NOIDA_STAGING_MODE: undefined, NOIDA_STAGING_PROJECT_ID: undefined, MONGODB_URI: productionUri }));
});

test("Production requires its exact environment and project, without staging flags", () => {
  assert.throws(() => resolveNoidaStagingMongoUri({ ...production, VERCEL: undefined }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...production, VERCEL_ENV: "preview" }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...production, VERCEL_PROJECT_ID: "other-project" }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...production, NOIDA_STAGING_MODE: "1" }));
});
