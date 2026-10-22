import assert from "node:assert/strict";

const TARGET = Object.freeze({ host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: "noida-crm-ingress-qa-20261021" });

export const INGRESS_PAYLOAD_COLLECTIONS = Object.freeze([
  "users",
  "crm-offices",
  "crm-teams",
  "central-leads",
  "omana-salespeople",
  "omana-enquiries",
  "omana-contact-messages",
  "omana-google-ads-enquiries",
  "estate1-enquiries",
  "estate1-contact-messages",
  "estate2-enquiries",
  "estate2-contact-messages",
  "dholera-estates-enquiries",
  "dholera-estates-contact-messages",
  "industrial-enquiries",
  "industrial-contact-messages",
]);
export const INGRESS_MONGO_COLLECTIONS = Object.freeze(
  INGRESS_PAYLOAD_COLLECTIONS.map((slug) => slug === "omana-salespeople" ? "omana-salespeoples" : slug),
);

const EXPECTED_URI = `mongodb://${TARGET.host}:${TARGET.port}/${TARGET.database}?replicaSet=${TARGET.replicaSet}&directConnection=true`;

/** Build a process-local Payload config for ingress QA without altering payload.config.ts. */
export function buildLocalIngressQAConfig({ sourceConfig, uri, mongooseAdapter }) {
  assert.equal(uri, EXPECTED_URI, "QA config only accepts the approved loopback database URI");
  assert.equal(new URL(uri).username, "");
  assert.equal(new URL(uri).password, "");
  assert.ok(sourceConfig && Array.isArray(sourceConfig.collections));
  assert.equal(typeof mongooseAdapter, "function");

  const sourceBySlug = new Map(sourceConfig.collections.map((collection) => [collection.slug, collection]));
  assert.equal(sourceBySlug.size, sourceConfig.collections.length, "source Payload collection slugs must be unique");
  for (const slug of INGRESS_PAYLOAD_COLLECTIONS) assert.ok(sourceBySlug.has(slug), `required ingress collection missing from Payload config: ${slug}`);

  const relationTargets = new Set();
  const visitFields = (fields = []) => {
    for (const field of fields) {
      if (field.relationTo) {
        for (const target of Array.isArray(field.relationTo) ? field.relationTo : [field.relationTo]) relationTargets.add(target);
      }
      if (field.fields) visitFields(field.fields);
      for (const tab of field.tabs ?? []) visitFields(tab.fields);
      for (const block of field.blocks ?? []) visitFields(block.fields);
    }
  };
  const allowed = new Set(INGRESS_PAYLOAD_COLLECTIONS);
  for (const slug of INGRESS_PAYLOAD_COLLECTIONS) visitFields(sourceBySlug.get(slug).fields);
  for (const target of relationTargets) assert.ok(allowed.has(target), `ingress config is missing relation target: ${target}`);

  const config = {
    ...sourceConfig,
    collections: INGRESS_PAYLOAD_COLLECTIONS.map((slug) => sourceBySlug.get(slug)),
    db: mongooseAdapter({
      url: uri,
      connectOptions: { autoIndex: false },
      ensureIndexes: true,
    }),
    typescript: { ...sourceConfig.typescript, autoGenerate: false },
    admin: {
      ...sourceConfig.admin,
      importMap: { ...sourceConfig.admin?.importMap, autoGenerate: false },
    },
  };

  assert.deepEqual(config.collections.map((collection) => collection.slug), INGRESS_PAYLOAD_COLLECTIONS);
  assert.equal(typeof config.db.init, "function");
  assert.equal(config.typescript.autoGenerate, false);
  assert.equal(config.admin.importMap.autoGenerate, false);
  return config;
}
