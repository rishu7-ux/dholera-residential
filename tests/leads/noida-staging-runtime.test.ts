import assert from "node:assert/strict";
import { totalmem } from "node:os";
import test from "node:test";

import {
  prepareNoidaLocalStagingEnvironment,
  resolveNoidaStagingMongoUri,
} from "../../lib/noida-staging-runtime";

const projectId = "prj_Xs3h7xDAvKP59ohOmeWd4Ht2wxlj";
const uri = "mongodb+srv://noida_stage_app:synthetic-secret@cluster0.zshxfui.mongodb.net/omana-phase5-crm-stage-20261017a?authSource=admin&retryWrites=true&w=majority";
const staging = {
  NOIDA_STAGING_MODE: "1",
  NOIDA_STAGING_PROJECT_ID: projectId,
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_PROJECT_ID: projectId,
  NOIDA_SMTP_DELIVERY_ENABLED: "0",
  MONGODB_URI: uri,
};

test("accepts only the approved staging project and TEST database identity", () => {
  assert.equal(resolveNoidaStagingMongoUri(staging), uri);
  assert.equal(resolveNoidaStagingMongoUri({ MONGODB_URI: "existing-non-staging-value" }), "existing-non-staging-value");
});

test("rejects incomplete or invalid staging activation", () => {
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, NOIDA_STAGING_MODE: undefined }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, NOIDA_STAGING_PROJECT_ID: undefined }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, NOIDA_STAGING_PROJECT_ID: "other" }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, NOIDA_STAGING_MODE: "0" }));
  assert.throws(() => resolveNoidaStagingMongoUri({ MONGODB_URI: uri, VERCEL: "1", VERCEL_PROJECT_ID: projectId }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, VERCEL: "1", VERCEL_PROJECT_ID: "other" }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, VERCEL: undefined }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, VERCEL_ENV: undefined }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, VERCEL_ENV: "production" }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...staging, VERCEL_PROJECT_ID: undefined }));
});

test("Preview staging requires outbound SMTP delivery explicitly disabled", () => {
  for (const setting of [undefined, "1", "invalid"]) {
    assert.throws(() => resolveNoidaStagingMongoUri({
      ...staging,
      NOIDA_SMTP_DELIVERY_ENABLED: setting,
    }));
  }
  assert.equal(resolveNoidaStagingMongoUri(staging), uri);
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

const localUri = `${uri}&tls=true`;
const local = {
  NOIDA_LOCAL_STAGING_MODE: "1",
  NOIDA_LOCAL_STAGING_BIND: "127.0.0.1",
  NODE_ENV: "development",
  MONGODB_URI: localUri,
  PAYLOAD_SECRET: "synthetic-local-payload-secret-with-32-chars",
};

test("local launcher prepares a loopback-only, development staging environment", () => {
  const input = { ...local, NODE_ENV: undefined, NOIDA_LOCAL_STAGING_BIND: undefined };
  const prepared = prepareNoidaLocalStagingEnvironment(input);
  assert.equal(prepared.NODE_ENV, "development");
  assert.equal(prepared.NOIDA_LOCAL_STAGING_BIND, "127.0.0.1");
  assert.equal(resolveNoidaStagingMongoUri(prepared), localUri);
  assert.equal(input.NOIDA_LOCAL_STAGING_BIND, undefined);
});

test("local staging accepts only Next's exact internal development-worker options", () => {
  const heapMb = Math.floor(Math.floor(totalmem() / 1024 / 1024) * 0.5);
  const internal = {
    ...local,
    __NEXT_DEV_SERVER: "1",
    NEXT_PRIVATE_WORKER: "1",
    NODE_OPTIONS: `--max-old-space-size=${heapMb} --enable-source-maps`,
  };
  assert.equal(resolveNoidaStagingMongoUri(internal), localUri);
  assert.throws(() => prepareNoidaLocalStagingEnvironment(internal));

  for (const changed of [
    { NODE_OPTIONS: "--require synthetic-module" },
    { NODE_OPTIONS: `${internal.NODE_OPTIONS} --require synthetic-module` },
    { NODE_OPTIONS: `${internal.NODE_OPTIONS} --import synthetic-module` },
    { NODE_OPTIONS: `${internal.NODE_OPTIONS} --inspect=0.0.0.0:9229` },
    { NODE_OPTIONS: "--enable-source-maps" },
    { NODE_OPTIONS: `--max-old-space-size=${heapMb + 1} --enable-source-maps` },
    { __NEXT_DEV_SERVER: undefined },
    { NEXT_PRIVATE_WORKER: undefined },
    { NEXT_PRIVATE_WORKER: "0" },
    { SMTP_HOST: "mail.example.invalid" },
    { NOIDA_ASSIGNMENT_EMAIL_ENABLED: "1" },
    { MONGODB_URI: localUri.replace("cluster0.zshxfui.mongodb.net", "cluster0.other.mongodb.net") },
  ]) assert.throws(() => resolveNoidaStagingMongoUri({ ...internal, ...changed }));
  assert.throws(() => resolveNoidaStagingMongoUri({ ...local, NODE_OPTIONS: internal.NODE_OPTIONS }));
});

test("local staging rejects missing mode, production runtime and absent launcher identity", () => {
  for (const changed of [
    { NOIDA_LOCAL_STAGING_MODE: undefined },
    { NOIDA_LOCAL_STAGING_MODE: "0" },
    { NODE_ENV: "production" },
  ]) assert.throws(() => prepareNoidaLocalStagingEnvironment({ ...local, ...changed }));
  for (const changed of [
    { NODE_ENV: undefined },
    { NOIDA_LOCAL_STAGING_BIND: undefined },
    { NOIDA_LOCAL_STAGING_BIND: "0.0.0.0" },
  ]) assert.throws(() => resolveNoidaStagingMongoUri({ ...local, ...changed }));
});

test("local staging rejects Vercel identity, existing TEST URI and unsafe startup settings", () => {
  for (const changed of [
    { VERCEL: "1" },
    { VERCEL_ENV: "preview" },
    { VERCEL_PROJECT_ID: projectId },
    { NOIDA_STAGING_MODE: "1" },
    { NOIDA_STAGING_PROJECT_ID: projectId },
    { MONGODB_TEST_URI: "synthetic-other-target" },
    { PAYLOAD_DROP_DATABASE: "true" },
    { PAYLOAD_DROP_DATABASE: "false" },
    { NOIDA_SMTP_DELIVERY_ENABLED: "1" },
    { NOIDA_SMTP_DELIVERY_ENABLED: "invalid" },
    { SMTP_HOST: "mail.example.invalid" },
    { BLOB_READ_WRITE_TOKEN: "synthetic-blob-token" },
    { OPENAI_API_KEY: "synthetic-openai-key" },
    { QDRANT_URL: "https://example.invalid" },
    { OMANA_INGEST_SECRET: "synthetic-ingest-secret" },
    { NODE_OPTIONS: "--require synthetic-module" },
  ]) assert.throws(() => resolveNoidaStagingMongoUri({ ...local, ...changed }));
});

test("local staging rejects missing secret and wrong or insecure MongoDB targets", () => {
  for (const changed of [
    { PAYLOAD_SECRET: undefined },
    { PAYLOAD_SECRET: "short" },
    { PAYLOAD_SECRET: "<UNIQUE_LOCAL_STAGING_SECRET_AT_LEAST_32_CHARACTERS>" },
    { MONGODB_URI: undefined },
    { MONGODB_URI: localUri.replace("synthetic-secret", "<URL_ENCODED_STAGE_PASSWORD>") },
    { MONGODB_URI: localUri.replace("cluster0.zshxfui.mongodb.net", "cluster0.other.mongodb.net") },
    { MONGODB_URI: localUri.replace("omana-phase5-crm-stage-20261017a", "omana-phase5-test-2") },
    { MONGODB_URI: localUri.replace("noida_stage_app", "noida_test_writer") },
    { MONGODB_URI: localUri.replace("&tls=true", "") },
    { MONGODB_URI: localUri.replace("&tls=true", "&tls=false") },
    { MONGODB_URI: `${localUri}&tlsInsecure=true` },
    { MONGODB_URI: `${localUri}&authSource=other` },
    { MONGODB_URI: `${localUri}&directConnection=true` },
    { NODE_TLS_REJECT_UNAUTHORIZED: "0" },
  ]) assert.throws(() => resolveNoidaStagingMongoUri({ ...local, ...changed }));
});
