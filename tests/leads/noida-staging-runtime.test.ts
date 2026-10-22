import assert from "node:assert/strict";
import test from "node:test";

import { resolveNoidaStagingMongoUri } from "../../lib/noida-staging-runtime";

const projectId = "prj_Xs3h7xDAvKP59ohOmeWd4Ht2wxlj";
const uri = "mongodb+srv://noida_stage_app:synthetic-secret@cluster0.zshxfui.mongodb.net/omana-phase5-crm-stage-20261017a?authSource=admin&retryWrites=true&w=majority";
const staging = { NOIDA_STAGING_MODE: "1", NOIDA_STAGING_PROJECT_ID: projectId, MONGODB_URI: uri };

test("accepts only the approved staging project and TEST database identity", () => {
  assert.equal(resolveNoidaStagingMongoUri(staging), uri);
  assert.equal(resolveNoidaStagingMongoUri({ ...staging, VERCEL: "1", VERCEL_PROJECT_ID: projectId }), uri);
  assert.equal(resolveNoidaStagingMongoUri({ MONGODB_URI: "existing-non-staging-value" }), "existing-non-staging-value");
});

test("rejects incomplete or invalid staging activation", () => {
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, NOIDA_STAGING_MODE: undefined }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, NOIDA_STAGING_PROJECT_ID: undefined }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, NOIDA_STAGING_PROJECT_ID: "other" }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, NOIDA_STAGING_MODE: "0" }));
  assert.throws(() => resolveNoidaStagingMongoUri({ MONGODB_URI: uri, VERCEL: "1", VERCEL_PROJECT_ID: projectId }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, VERCEL: "1", VERCEL_PROJECT_ID: "other" }));
});

test("rejects other hosts, databases, users and missing credentials", () => {
  for (const changed of [
    uri.replace("cluster0.zshxfui.mongodb.net", "cluster0.oqcardp.mongodb.net"),
    uri.replace("omana-phase5-crm-stage-20261017a", "omana-phase5-test-2"),
    uri.replace("noida_stage_app", "noida_test_restore"),
    uri.replace("synthetic-secret", ""),
  ]) assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, MONGODB_URI: changed }));
});

test("rejects routing, TLS and authentication overrides", () => {
  for (const option of [
    "&tlsInsecure=true", "&tls=false", "&authSource=other", "&directConnection=true",
    "&replicaSet=other", "&srvServiceName=other", "&authMechanism=PLAIN", "&retryWrites=false",
  ]) assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, MONGODB_URI: uri + option }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, NODE_TLS_REJECT_UNAUTHORIZED: "0" }));
});
