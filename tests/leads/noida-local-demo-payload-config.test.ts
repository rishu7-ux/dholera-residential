import assert from "node:assert/strict";
import { test } from "node:test";

import { LOCAL_DEMO_URI } from "../../lib/noida-local-demo-target.mjs";
import { buildLocalDemoPayloadConfig } from "../../lib/noida-local-demo-payload-config";

test("local Payload config contains only CRM fixture collections and awaits office indexes", async () => {
  process.env.MONGODB_URI = LOCAL_DEMO_URI;
  process.env.PAYLOAD_SECRET = "offline-local-payload-config-test-secret-32-bytes";
  const config = await buildLocalDemoPayloadConfig(LOCAL_DEMO_URI, process.env.PAYLOAD_SECRET);
  assert.deepEqual(config.collections.map((item) => item.slug), [
    "users", "crm-offices", "crm-teams", "payload-kv", "payload-locked-documents", "payload-preferences", "payload-migrations",
  ]);
  const fakePayload = { config, collections: Object.fromEntries(config.collections.map((item) => [item.slug, { config: item }])) };
  assert.ok(config.db.init);
  const adapter = config.db.init({ payload: fakePayload as never });
  const localAdapter = adapter as unknown as {
    ensureIndexes: boolean;
    connectOptions?: { autoIndex?: boolean };
    collections: Record<string, { schema: { indexes: () => Array<[Record<string, number>, { unique?: boolean }]> } }>;
    init: () => Promise<void>;
  };
  await localAdapter.init();
  assert.equal(localAdapter.ensureIndexes, true);
  assert.equal(localAdapter.connectOptions?.autoIndex, false);
  const indexes = localAdapter.collections["crm-offices"].schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.name === 1 && options.unique === true));
  assert.ok(indexes.some(([fields, options]) => fields.code === 1 && options.unique === true));
});
