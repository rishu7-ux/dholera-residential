import assert from "node:assert/strict";
import { test } from "node:test";

import { buildLocalIngressQAConfig, INGRESS_MONGO_COLLECTIONS, INGRESS_PAYLOAD_COLLECTIONS } from "../../lib/noida-local-ingress-qa-config.mjs";

const uri = "mongodb://127.0.0.1:27179/noida-crm-ingress-qa-20261021?replicaSet=noida_demo&directConnection=true";

function sourceConfig() {
  return {
    collections: [...INGRESS_PAYLOAD_COLLECTIONS, "blogs", "media", "payload-migrations"].map((slug) => ({ slug })),
    db: { original: true },
    typescript: { autoGenerate: true, outputFile: "types.ts" },
    admin: { importMap: { autoGenerate: true, baseDir: "/tmp" } },
  };
}

test("ingress QA config scopes index initialization to route collections and awaits indexes", () => {
  let adapterOptions;
  const config = buildLocalIngressQAConfig({
    sourceConfig: sourceConfig(),
    uri,
    mongooseAdapter: (options) => {
      adapterOptions = options;
      return { init() {}, options };
    },
  });

  assert.deepEqual(config.collections.map(({ slug }) => slug), INGRESS_PAYLOAD_COLLECTIONS);
  assert.equal(INGRESS_MONGO_COLLECTIONS.length, 16);
  assert.ok(INGRESS_MONGO_COLLECTIONS.includes("omana-salespeoples"));
  assert.deepEqual(adapterOptions, { url: uri, connectOptions: { autoIndex: false }, ensureIndexes: true });
  assert.equal(config.typescript.autoGenerate, false);
  assert.equal(config.typescript.outputFile, "types.ts");
  assert.equal(config.admin.importMap.autoGenerate, false);
  assert.equal(config.admin.importMap.baseDir, "/tmp");
  assert.deepEqual(sourceConfig().collections.slice(-3).map(({ slug }) => slug), ["blogs", "media", "payload-migrations"]);
});

test("ingress QA config rejects a wrong MongoDB host or database", () => {
  const args = { sourceConfig: sourceConfig(), uri, mongooseAdapter: () => ({}) };
  assert.throws(() => buildLocalIngressQAConfig({ ...args, uri: uri.replace("127.0.0.1", "localhost") }));
  assert.throws(() => buildLocalIngressQAConfig({ ...args, uri: uri.replace("noida-crm-ingress-qa-20261021", "noida-crm-demo-20261019") }));
});

test("ingress QA config refuses incomplete or duplicate source collection definitions", () => {
  const missing = sourceConfig();
  missing.collections = missing.collections.filter(({ slug }) => slug !== "industrial-contact-messages");
  assert.throws(() => buildLocalIngressQAConfig({ sourceConfig: missing, uri, mongooseAdapter: () => ({}) }));

  const duplicate = sourceConfig();
  duplicate.collections.push({ slug: "users" });
  assert.throws(() => buildLocalIngressQAConfig({ sourceConfig: duplicate, uri, mongooseAdapter: () => ({}) }));
});
