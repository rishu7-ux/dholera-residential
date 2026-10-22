import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Module from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const syntheticSecret = "offline-only-ingress-mock";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/noida-offline-ingress-mock";
process.env.PAYLOAD_SECRET = "offline-only-payload-secret";

async function handlerFor(name) {
  const filename = resolve(root, `app/api/${name}-leads/route.ts`);
  const result = await build({
    entryPoints: [filename], bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "offline-persistence-stubs", setup(context) {
      context.onResolve({ filter: /^payload$/ }, () => ({ path: "payload", namespace: "offline-stub" }));
      context.onResolve({ filter: /payload\.config$/ }, () => ({ path: "config", namespace: "offline-stub" }));
      context.onResolve({ filter: /lib\/crm\/ingest$/ }, () => ({ path: "ingest", namespace: "offline-stub" }));
      context.onLoad({ filter: /.*/, namespace: "offline-stub" }, ({ path }) => ({ loader: "js", contents:
        path === "payload" ? "export const getPayload = async () => globalThis.__noidaMockPayload;"
          : path === "config" ? "export default {};"
            : "export const ingestLeadWithLegacy = async (input, legacy) => globalThis.__noidaMockIngest(input, legacy); export class LegacyReconciliationRequiredError extends Error { constructor(legacyId, collection, idempotencyKey) { super('Legacy lead needs reconciliation'); this.name = 'LegacyReconciliationRequiredError'; this.legacyId = legacyId; this.collection = collection; this.idempotencyKey = idempotencyKey; } }",
      }));
    } }],
  });
  const compiled = new Module(filename);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(root);
  compiled._compile(result.outputFiles[0].text, filename);
  return compiled.exports.POST;
}

function syntheticRequest(body, key = randomUUID()) {
  return new Request("http://127.0.0.1/ingress", {
    method: "POST", headers: { Authorization: `Bearer ${syntheticSecret}`, "Content-Type": "application/json", "x-idempotency-key": key },
    body: JSON.stringify(body),
  });
}

test("all five Master ingresses pass validated legacy and central data to one atomic write", async () => {
  const identity = { name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210" };
  const cases = [
    { name: "omana", env: "OMANA_INGEST_SECRET", website: "omana-projects", source: "omana-global-drawer", legacy: "omana-enquiries", data: { ...identity, type: "enquiry", selectedProject: "Synthetic Test Project", selectedProjectSlug: "synthetic-test", page: "/", message: "Synthetic enquiry", source: "omana-global-drawer", consent: true } },
    { name: "estate1", env: "ESTATE1_INGEST_SECRET", website: "dholera-estate-1", source: "estate1-popup-form", legacy: "estate1-enquiries", data: { ...identity, type: "enquiry", message: "Synthetic enquiry", source: "estate1-popup-form", consent: true } },
    { name: "estate2", env: "ESTATE2_INGEST_SECRET", website: "dholera-estate-2", source: "estate2-popup-form", legacy: "estate2-enquiries", data: { ...identity, type: "enquiry", property: "Synthetic QA property", message: "", source: "estate2-popup-form", consent: true } },
    { name: "dholera-estates", env: "DHOLERA_ESTATES_INGEST_SECRET", website: "dholeraestates", source: "dholeraestates-popup-form", legacy: "dholera-estates-enquiries", data: { ...identity, type: "enquiry", property: "Synthetic QA property", message: "", source: "dholeraestates-popup-form", consent: true } },
    { name: "industrial", env: "INDUSTRIAL_INGEST_SECRET", website: "dholeraindustrial", source: "industrial-popup-form", legacy: "industrial-enquiries", data: { ...identity, type: "enquiry", property: "Synthetic QA property", message: "", source: "industrial-popup-form", consent: true } },
  ];
  for (const item of cases) {
    process.env[item.env] = syntheticSecret;
    const handler = await handlerFor(item.name);
    const ingests = [];
    globalThis.__noidaMockPayload = {
      find: async () => ({ docs: [] }),
      create: async () => { throw new Error("Unexpected direct legacy create"); },
      delete: async () => { throw new Error("Unexpected direct legacy delete"); },
    };
    globalThis.__noidaMockIngest = async (input, legacy) => { ingests.push({ input, legacy }); return { id: `central-${item.name}`, legacyId: `synthetic-${item.name}`, duplicate: false }; };
    const response = await handler(syntheticRequest(item.data));
    assert.equal(response.status, 201, `${item.name} accepted valid synthetic lead`);
    assert.equal(ingests.length, 1);
    assert.equal(ingests[0].input.website, item.website);
    assert.equal(ingests[0].input.source, item.source);
    assert.equal(ingests[0].input.consent, true);
    assert.equal(ingests[0].input.leadType, "enquiry");
    assert.equal(ingests[0].legacy.collection, item.legacy);
    assert.equal(ingests[0].legacy.data.name, identity.name);
    const denied = await handler(syntheticRequest({ ...item.data, consent: false }));
    assert.equal(denied.status, 400);
    assert.equal(ingests.length, 1);
    delete process.env[item.env];
  }
});

test("all four non-Omana ingresses reject omitted consent before persistence", async () => {
  const cases = ["estate1", "estate2", "dholera-estates", "industrial"];
  const bodies = {
    estate1: { name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", type: "enquiry", message: "Synthetic enquiry", source: "estate1-popup-form" },
    estate2: { name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", type: "enquiry", property: "Synthetic QA property", message: "", source: "estate2-popup-form" },
    "dholera-estates": { name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", type: "enquiry", property: "Synthetic QA property", message: "", source: "dholeraestates-popup-form" },
    industrial: { name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", type: "enquiry", property: "Synthetic QA property", message: "", source: "industrial-popup-form" },
  };
  for (const name of cases) {
    const env = `${name === "dholera-estates" ? "DHOLERA_ESTATES" : name.toUpperCase()}_INGEST_SECRET`;
    process.env[env] = syntheticSecret;
    const handler = await handlerFor(name);
    const writes = [];
    globalThis.__noidaMockPayload = {
      find: async () => { writes.push("find"); return { docs: [] }; },
      create: async (args) => { writes.push({ create: args }); return { id: "unexpected" }; },
      delete: async (args) => { writes.push({ delete: args }); return {}; },
    };
    globalThis.__noidaMockIngest = async (input) => { writes.push({ ingest: input }); return { duplicate: false }; };
    const response = await handler(syntheticRequest(bodies[name]));
    assert.equal(response.status, 400, `${name} rejects missing consent`);
    assert.deepEqual(writes, [], `${name} does no persistence without consent`);
    delete process.env[env];
  }
});

test("all website form variants reject missing or false consent before persistence", async () => {
  const variants = [
    { route: "omana", env: "OMANA_INGEST_SECRET", data: { type: "enquiry", name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", selectedProject: "Synthetic Test Project", selectedProjectSlug: "synthetic-test", page: "/", source: "omana-global-drawer" } },
    { route: "omana", env: "OMANA_INGEST_SECRET", data: { type: "contact", name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", selectedProject: "Synthetic Test Project", selectedProjectSlug: "synthetic-test", page: "/contact", source: "omana-contact-page" } },
    { route: "omana", env: "OMANA_INGEST_SECRET", data: { type: "google-ads-enquiry", name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", selectedProject: "Synthetic Test Project", selectedProjectSlug: "synthetic-test", page: "/dholeraplots", source: "google-ads-dholeraplots" } },
    { route: "omana", env: "OMANA_INGEST_SECRET", data: { type: "ai-chatbot-enquiry", name: "Synthetic QA Person", phone: "9876543210", selectedProject: "Synthetic Test Project", selectedProjectSlug: "synthetic-test", requirement: "Synthetic test requirement", page: "/", source: "ai-chatbot", idempotencyKey: randomUUID() } },
    { route: "estate1", env: "ESTATE1_INGEST_SECRET", data: { type: "enquiry", name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", message: "Synthetic enquiry", source: "estate1-popup-form" } },
    { route: "estate1", env: "ESTATE1_INGEST_SECRET", data: { type: "contact", name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", budget: "20-50-lakhs", comments: "Synthetic enquiry", source: "estate1-contact-us-page" } },
    { route: "estate2", env: "ESTATE2_INGEST_SECRET", data: { type: "enquiry", name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", property: "Synthetic QA property", message: "", source: "estate2-popup-form" } },
    { route: "estate2", env: "ESTATE2_INGEST_SECRET", data: { type: "contact", name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", propertyType: "dholera-estate-2", budget: "20-50-lakhs", comments: "Synthetic enquiry", source: "estate2-contact-us-page" } },
    { route: "dholera-estates", env: "DHOLERA_ESTATES_INGEST_SECRET", data: { type: "enquiry", name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", property: "Synthetic QA property", message: "", source: "dholeraestates-popup-form" } },
    { route: "dholera-estates", env: "DHOLERA_ESTATES_INGEST_SECRET", data: { type: "contact", name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", propertyType: "dholera-estates", budget: "20-50-lakhs", comments: "Synthetic enquiry", source: "dholeraestates-contact-us-page" } },
    { route: "industrial", env: "INDUSTRIAL_INGEST_SECRET", data: { type: "enquiry", name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", property: "Synthetic QA property", message: "", source: "industrial-popup-form" } },
    { route: "industrial", env: "INDUSTRIAL_INGEST_SECRET", data: { type: "contact", name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210", propertyType: "industrial-plot", budget: "25-50-lakhs", comments: "Synthetic enquiry", source: "industrial-contact-us-page" } },
  ];

  for (const variant of variants) {
    process.env[variant.env] = syntheticSecret;
    const handler = await handlerFor(variant.route);
    const operations = [];
    globalThis.__noidaMockPayload = {
      find: async () => { operations.push("find"); return { docs: [] }; },
      create: async (args) => { operations.push({ create: args }); return { id: "unexpected" }; },
      delete: async (args) => { operations.push({ delete: args }); return {}; },
    };
    globalThis.__noidaMockIngest = async (input) => { operations.push({ ingest: input }); return { duplicate: false }; };

    for (const data of [variant.data, { ...variant.data, consent: false }]) {
      const response = await handler(syntheticRequest(data));
      assert.equal(response.status, 400, `${variant.route} ${variant.data.type} rejects missing/false consent`);
    }
    assert.deepEqual(operations, [], `${variant.route} ${variant.data.type} performs no reads or writes`);
    delete process.env[variant.env];
  }
});

test("same-key replays go through the atomic duplicate guard", async () => {
  const cases = ["estate1", "estate2", "dholera-estates", "industrial"];
  const body = {
    name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210",
    type: "enquiry", message: "Synthetic enquiry", property: "Synthetic QA property", consent: true,
  };
  const sources = {
    estate1: "estate1-popup-form", estate2: "estate2-popup-form",
    "dholera-estates": "dholeraestates-popup-form", industrial: "industrial-popup-form",
  };
  for (const name of cases) {
    const env = `${name === "dholera-estates" ? "DHOLERA_ESTATES" : name.toUpperCase()}_INGEST_SECRET`;
    process.env[env] = syntheticSecret;
    const handler = await handlerFor(name);
    let centralCalls = 0;
    globalThis.__noidaMockPayload = {
      create: async () => { throw new Error("Unexpected direct legacy create"); },
      delete: async () => { throw new Error("Unexpected direct legacy delete"); },
    };
    globalThis.__noidaMockIngest = async () => { centralCalls += 1; return { duplicate: true }; };
    const response = await handler(syntheticRequest({ ...body, source: sources[name] }));
    assert.equal(response.status, 200, `${name} duplicate is a successful idempotent response`);
    assert.deepEqual(await response.json(), { success: true, duplicate: true });
    assert.equal(centralCalls, 1, `${name} invokes the atomic duplicate guard once`);
    delete process.env[env];
  }
});

test("ASK OMANA non-chat duplicate result skips all legacy writes", async () => {
  process.env.OMANA_INGEST_SECRET = syntheticSecret;
  const handler = await handlerFor("omana");
  const writes = [];
  let centralCalls = 0;
  globalThis.__noidaMockPayload = {
    find: async () => ({ docs: [] }),
    create: async (args) => { writes.push({ create: args }); return { id: "unexpected-legacy" }; },
    update: async (args) => { writes.push({ update: args }); return {}; },
    delete: async (args) => { writes.push({ delete: args }); return {}; },
  };
  globalThis.__noidaMockIngest = async () => { centralCalls += 1; return { duplicate: true }; };
  const response = await handler(syntheticRequest({
    type: "enquiry", name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210",
    selectedProject: "Synthetic Test Project", selectedProjectSlug: "synthetic-test", page: "/",
    source: "omana-global-drawer", consent: true,
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, duplicate: true });
  assert.deepEqual(writes, []);
  assert.equal(centralCalls, 1);
  delete process.env.OMANA_INGEST_SECRET;
});

test("ASK OMANA cannot acknowledge a central-only duplicate as fully saved", async () => {
  process.env.OMANA_INGEST_SECRET = syntheticSecret;
  const handler = await handlerFor("omana");
  globalThis.__noidaMockIngest = async () => { throw new Error("Central lead needs reconciliation"); };
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await handler(syntheticRequest({
      type: "enquiry", name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210",
      selectedProject: "Synthetic Test Project", selectedProjectSlug: "synthetic-test", page: "/",
      source: "omana-global-drawer", consent: true,
    }));
    assert.equal(response.status, 500);
    assert.equal((await response.json()).success, false);
  } finally {
    console.error = originalError;
    delete process.env.OMANA_INGEST_SECRET;
  }
});

test("concurrent same-key replay has no direct legacy create or delete", async () => {
  process.env.ESTATE1_INGEST_SECRET = syntheticSecret;
  const handler = await handlerFor("estate1");
  globalThis.__noidaMockPayload = {
    create: async () => { throw new Error("Unexpected direct legacy create"); },
    delete: async () => { throw new Error("Unexpected direct legacy delete"); },
  };
  globalThis.__noidaMockIngest = async () => ({ duplicate: true });
  const response = await handler(syntheticRequest({
    name: "Synthetic QA Person", email: "ingress@example.invalid", phone: "9876543210",
    type: "enquiry", message: "Synthetic enquiry", source: "estate1-popup-form", consent: true,
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, duplicate: true });
  delete process.env.ESTATE1_INGEST_SECRET;
});

test("ASK OMANA phone duplicate cannot consume a new central assignment", async () => {
  process.env.OMANA_INGEST_SECRET = syntheticSecret;
  const handler = await handlerFor("omana");
  const writes = [];
  const existingKey = randomUUID();
  globalThis.__noidaMockPayload = {
    find: async (args) => ({ docs: args.collection === "omana-enquiries"
      ? [{ id: "previous-synthetic-lead", idempotencyKey: existingKey, qualification: "hot" }]
      : [{ id: "previous-synthetic-central", idempotencyKey: existingKey, legacyCollection: "omana-enquiries", legacyId: "previous-synthetic-lead" }] }),
    create: async (args) => { writes.push(args); return { id: "unexpected" }; },
    update: async (args) => { writes.push(args); return {}; },
  };
  globalThis.__noidaMockIngest = async (input) => { writes.push({ central: input }); return { duplicate: false }; };
  const request = syntheticRequest({
    type: "ai-chatbot-enquiry", initialIntent: "plot enquiry", name: "Synthetic QA Person",
    phone: "9876543210", selectedProject: "Synthetic Test Project", selectedProjectSlug: "synthetic-test",
    requirement: "Synthetic plot enquiry", page: "/", source: "ai-chatbot", consent: true,
    idempotencyKey: randomUUID(),
  });
  const response = await handler(request);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).duplicate, true);
  assert.deepEqual(writes, [], "an existing chatbot lead must not consume a new assignment or write again");
  delete process.env.OMANA_INGEST_SECRET;
});

test("ASK OMANA does not acknowledge a legacy-only chatbot duplicate", async () => {
  process.env.OMANA_INGEST_SECRET = syntheticSecret;
  const handler = await handlerFor("omana");
  const writes = [];
  globalThis.__noidaMockPayload = {
    find: async (args) => ({ docs: args.collection === "omana-enquiries"
      ? [{ id: "legacy-only", idempotencyKey: randomUUID(), qualification: "hot" }]
      : [] }),
    update: async (args) => { writes.push(args); return {}; },
  };
  globalThis.__noidaMockIngest = async () => { writes.push("atomic-ingest"); return { duplicate: true }; };
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => { logged.push(args); };
  try {
    const response = await handler(syntheticRequest({
      type: "ai-chatbot-enquiry", initialIntent: "plot enquiry", name: "Synthetic QA Person",
      phone: "9876543210", selectedProject: "Synthetic Test Project", selectedProjectSlug: "synthetic-test",
      requirement: "Synthetic plot enquiry", page: "/", source: "ai-chatbot", consent: true,
      idempotencyKey: randomUUID(),
    }));
    assert.equal(response.status, 500);
    assert.deepEqual(writes, []);
    assert.equal(logged[0]?.[1]?.name, "LegacyReconciliationRequiredError");
    assert.equal(logged[0]?.[1]?.legacyId, "legacy-only");
  } finally {
    console.error = originalError;
    delete process.env.OMANA_INGEST_SECRET;
  }
});

test("ASK OMANA does not acknowledge a chatbot duplicate linked to another legacy lead", async () => {
  process.env.OMANA_INGEST_SECRET = syntheticSecret;
  const handler = await handlerFor("omana");
  const writes = [];
  const existingKey = randomUUID();
  globalThis.__noidaMockPayload = {
    find: async (args) => ({ docs: args.collection === "omana-enquiries"
      ? [{ id: "original-legacy", idempotencyKey: existingKey, qualification: "hot" }]
      : [{ id: "central-lead", idempotencyKey: existingKey, legacyCollection: "omana-enquiries", legacyId: "different-legacy" }] }),
    update: async (args) => { writes.push(args); return {}; },
  };
  globalThis.__noidaMockIngest = async () => { writes.push("atomic-ingest"); return { duplicate: true }; };
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => { logged.push(args); };
  try {
    const response = await handler(syntheticRequest({
      type: "ai-chatbot-enquiry", initialIntent: "plot enquiry", name: "Synthetic QA Person",
      phone: "9876543210", selectedProject: "Synthetic Test Project", selectedProjectSlug: "synthetic-test",
      requirement: "Synthetic plot enquiry", page: "/", source: "ai-chatbot", consent: true,
      idempotencyKey: randomUUID(),
    }));
    assert.equal(response.status, 500);
    assert.deepEqual(writes, []);
    assert.equal(logged[0]?.[1]?.name, "LegacyReconciliationRequiredError");
    assert.equal(logged[0]?.[1]?.legacyId, "original-legacy");
  } finally {
    console.error = originalError;
    delete process.env.OMANA_INGEST_SECRET;
  }
});

test("a new ASK OMANA lead retains central mapping and qualification", async () => {
  process.env.OMANA_INGEST_SECRET = syntheticSecret;
  const handler = await handlerFor("omana");
  const updates = [];
  const ingests = [];
  globalThis.__noidaMockPayload = {
    find: async () => ({ docs: [] }),
    create: async () => { throw new Error("Unexpected direct legacy create"); },
    update: async (args) => { updates.push(args); return {}; },
  };
  globalThis.__noidaMockIngest = async (input, legacy) => { ingests.push({ input, legacy }); return { id: "new-synthetic-central-lead", legacyId: "new-synthetic-chat-lead", duplicate: false }; };
  const key = randomUUID();
  const response = await handler(syntheticRequest({
    type: "ai-chatbot-enquiry", initialIntent: "plot enquiry", name: "Synthetic QA Person",
    phone: "9876543210", selectedProject: "Synthetic Test Project", selectedProjectSlug: "synthetic-test",
    requirement: "Synthetic plot enquiry", page: "/", source: "ai-chatbot", consent: true,
    idempotencyKey: key,
  }));
  assert.equal(response.status, 201);
  assert.equal(ingests.length, 1);
  assert.equal(ingests[0].input.leadType, "chatbot");
  assert.equal(ingests[0].input.idempotencyKey, key);
  assert.equal(ingests[0].legacy.collection, "omana-enquiries");
  assert.equal(ingests[0].legacy.data.idempotencyKey, key);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].id, "new-synthetic-chat-lead");
  delete process.env.OMANA_INGEST_SECRET;
});
