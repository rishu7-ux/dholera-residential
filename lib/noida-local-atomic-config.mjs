import assert from "node:assert/strict";

import { INGRESS_PAYLOAD_COLLECTIONS } from "./noida-local-ingress-qa-config.mjs";
import { URI, assertExactTarget } from "./noida-local-atomic-qa.mjs";

export function buildLocalAtomicConfig({ sourceConfig, mongooseAdapter }) {
  assertExactTarget(URI);
  assert.ok(sourceConfig && Array.isArray(sourceConfig.collections));
  assert.equal(typeof mongooseAdapter, "function");
  const source = new Map(sourceConfig.collections.map((collection) => [collection.slug, collection]));
  assert.equal(source.size, sourceConfig.collections.length);
  const collections = INGRESS_PAYLOAD_COLLECTIONS.map((slug) => {
    const collection = source.get(slug);
    assert.ok(collection, `Missing atomic QA collection: ${slug}`);
    return collection;
  });
  const config = {
    ...sourceConfig,
    collections,
    db: mongooseAdapter({ url: URI, connectOptions: { autoIndex: false }, ensureIndexes: false }),
    typescript: { ...sourceConfig.typescript, autoGenerate: false },
    admin: { ...sourceConfig.admin, importMap: { ...sourceConfig.admin?.importMap, autoGenerate: false } },
  };
  assert.deepEqual(config.collections.map((collection) => collection.slug), INGRESS_PAYLOAD_COLLECTIONS);
  assert.equal(config.db.name, "mongoose");
  assert.equal(typeof config.db.init, "function");
  return config;
}
