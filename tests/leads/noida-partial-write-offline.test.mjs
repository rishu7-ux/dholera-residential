import assert from "node:assert/strict";
import Module from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { build } from "esbuild";

import { createLegacyForCentralLead, LegacyIngressPartialWriteError } from "../../lib/crm/legacy-ingress.ts";

const key = "b752533e-2422-460f-925d-e1e6ed55ae11";

function payloadFor(operations, { createFails = false, deleteFails = false } = {}) {
  return {
    find: async () => ({ docs: [] }),
    create: async () => {
      operations.push("legacy-create");
      if (createFails) throw new Error("legacy write failed");
      return { id: "legacy-1" };
    },
    delete: async () => {
      operations.push("legacy-delete");
      if (deleteFails) throw new Error("duplicate cleanup failed");
      return {};
    },
  };
}

function attempt(payload, ingest) {
  return createLegacyForCentralLead({ payload, collection: "estate1-enquiries", data: { name: "Synthetic" }, idempotencyKey: key, ingest });
}

test("legacy create failure never starts central ingestion", async () => {
  const operations = [];
  await assert.rejects(attempt(payloadFor(operations, { createFails: true }), async () => { operations.push("central"); }), /legacy write failed/);
  assert.deepEqual(operations, ["legacy-create"]);
});

test("central failure preserves the exact legacy record and supplies a reconciliation key", async () => {
  const operations = [];
  await assert.rejects(attempt(payloadFor(operations), async () => {
    operations.push("central");
    throw new Error("activity insert failed");
  }), (error) => {
    assert.ok(error instanceof LegacyIngressPartialWriteError);
    assert.equal(error.phase, "central-ingest");
    assert.equal(error.collection, "estate1-enquiries");
    assert.equal(error.legacyId, "legacy-1");
    assert.equal(error.idempotencyKey, key);
    assert.match(error.cause.message, /activity insert failed/);
    return true;
  });
  assert.deepEqual(operations, ["legacy-create", "central"]);
});

test("duplicate cleanup failure cannot be reported as a successful replay", async () => {
  const operations = [];
  await assert.rejects(attempt(payloadFor(operations, { deleteFails: true }), async () => ({ duplicate: true })), (error) => {
    assert.ok(error instanceof LegacyIngressPartialWriteError);
    assert.equal(error.phase, "duplicate-cleanup");
    assert.equal(error.legacyId, "legacy-1");
    return true;
  });
  assert.deepEqual(operations, ["legacy-create", "legacy-delete"]);
});

async function offlineIngest() {
  const filename = resolve(import.meta.dirname, "../../lib/crm/ingest.ts");
  const built = await build({
    entryPoints: [filename], bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "offline-db", setup(context) {
      context.onResolve({ filter: /^mongoose$/ }, () => ({ path: "mongoose", namespace: "offline-stub" }));
      context.onResolve({ filter: /mongodb$/ }, () => ({ path: "connect", namespace: "offline-stub" }));
      context.onLoad({ filter: /.*/, namespace: "offline-stub" }, ({ path }) => ({ loader: "js", contents: path === "mongoose"
        ? "export default globalThis.__offlineMongoose;"
        : "export default async () => { globalThis.__offlineConnections += 1; };" }));
    } }],
  });
  const compiled = new Module(filename);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(resolve(import.meta.dirname, "../.."));
  compiled._compile(built.outputFiles[0].text, filename);
  return compiled.exports.ingestCentralLead;
}

test("central boundary rejects nonconsent before connecting to MongoDB", async () => {
  globalThis.__offlineConnections = 0;
  const ingest = await offlineIngest();
  await assert.rejects(ingest({ consent: false }), /affirmative contact consent/);
  await assert.rejects(ingest({}), /affirmative contact consent/);
  assert.equal(globalThis.__offlineConnections, 0);
});

test("session cleanup error cannot turn a committed central lead into a failed response", async () => {
  globalThis.__offlineConnections = 0;
  let serial = 0;
  const operations = [];
  const session = {
    withTransaction: async (work) => { await work(); operations.push("commit"); },
    endSession: async () => { operations.push("cleanup"); throw new Error("cleanup failed"); },
  };
  const db = {
    collection(name) {
      if (name === "central-leads") return {
        findOne: async () => null,
        insertOne: async () => { operations.push("lead"); },
      };
      if (name === "crm-offices") return { findOneAndUpdate: async () => ({ _id: "office-1", active: true }) };
      if (name === "users") return { find: () => ({ sort: () => ({ toArray: async () => [] }) }) };
      if (name === "crm-activities") return { insertMany: async () => { operations.push("activities"); } };
      throw new Error(`unexpected collection ${name}`);
    },
  };
  globalThis.__offlineMongoose = {
    connection: { db, startSession: async () => session },
    Types: { ObjectId: class { toString() { return `offline-${++serial}`; } } },
  };
  const originalError = console.error;
  const warnings = [];
  console.error = (...args) => warnings.push(args);
  try {
    const ingest = await offlineIngest();
    const result = await ingest({ consent: true, name: "Synthetic", phone: "9876543210", website: "dholera-estate-1", leadType: "enquiry", source: "offline-test" });
    assert.equal(result.duplicate, false);
    assert.deepEqual(operations, ["lead", "activities", "commit", "cleanup"]);
    assert.equal(globalThis.__offlineConnections, 1);
    assert.equal(warnings.length, 1);
  } finally {
    console.error = originalError;
    delete globalThis.__offlineMongoose;
  }
});
