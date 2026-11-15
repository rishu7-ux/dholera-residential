import assert from "node:assert/strict";
import Module from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");

async function offlineIngest() {
  const filename = resolve(root, "lib/crm/ingest.ts");
  const built = await build({
    entryPoints: [filename], bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "offline-db", setup(context) {
      context.onResolve({ filter: /^mongoose$/ }, () => ({ path: "mongoose", namespace: "offline-stub" }));
      context.onResolve({ filter: /mongodb$/ }, () => ({ path: "connect", namespace: "offline-stub" }));
      context.onLoad({ filter: /.*/, namespace: "offline-stub" }, ({ path }) => ({
        loader: "js", contents: path === "mongoose"
          ? "export default globalThis.__concurrentMongoose;"
          : "export default async () => { globalThis.__concurrentConnections += 1; };",
      }));
    } }],
  });
  const compiled = new Module(filename);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(root);
  compiled._compile(built.outputFiles[0].text, filename);
  return compiled.exports;
}

function fixture({ missingIndex } = {}) {
  let serial = 100;
  let version = 0;
  let conflicts = 0;
  class ObjectId {
    constructor(value) { this.value = value ?? String(++serial).padStart(24, "0"); }
    toString() { return this.value; }
  }
  const office = new ObjectId("000000000000000000000001");
  let state = {
    "crm-offices": [{ _id: office, code: "noida", active: true }],
    users: Array.from({ length: 10 }, (_, i) => ({
      _id: new ObjectId(String(i + 2).padStart(24, "0")), role: "salesperson", office,
      active: true, eligibleForAssignment: true, rotationOrder: i + 1,
    })),
    "crm-assignment-counters": [{ _id: new ObjectId("000000000000000000000099"), key: "noida-shared-lead-round-robin", office, sequence: 0 }],
    "central-leads": [], "crm-activities": [], "estate1-enquiries": [],
  };
  const copy = (source) => Object.fromEntries(Object.entries(source).map(([name, records]) =>
    [name, records.map((record) => ({ ...record }))]));
  const same = (left, right) => String(left) === String(right);
  const rows = (name, session) => (session?.working ?? state)[name];
  const matches = (row, filter) => Object.entries(filter).every(([field, value]) => same(row[field], value));
  const find = (name, filter, session) => rows(name, session).find((row) => matches(row, filter)) ?? null;
  const mutate = (session) => { if (session) session.dirty = true; };
  const db = { collection(name) {
    assert.ok(name in state, `Unexpected collection ${name}`);
    return {
      listIndexes: () => ({ toArray: async () => name === "central-leads"
        ? (missingIndex === name ? [] : [{ key: { idempotencyKey: 1 }, unique: true }])
        : name === "crm-assignment-counters"
          ? (missingIndex === name ? [] : [{ key: { key: 1, office: 1 }, unique: true }])
          : [] }),
      findOne: async (filter, options = {}) => find(name, filter, options.session),
      find: (filter, options = {}) => ({ sort: () => ({ toArray: async () =>
        rows(name, options.session).filter((row) => matches(row, filter)) }) }),
      findOneAndUpdate: async (filter, update, options = {}) => {
        let row = find(name, filter, options.session);
        if (!row && options.upsert) {
          row = { ...filter, ...update.$setOnInsert, sequence: 0 };
          rows(name, options.session).push(row);
          mutate(options.session);
        }
        if (row && update.$inc?.sequence) {
          row.sequence += update.$inc.sequence;
          mutate(options.session);
        }
        return row;
      },
      insertOne: async (doc, options = {}) => {
        if (name === "central-leads" && find(name, { idempotencyKey: doc.idempotencyKey }, options.session)) {
          throw Object.assign(new Error("duplicate key"), { code: 11000 });
        }
        rows(name, options.session).push(doc);
        mutate(options.session);
      },
      insertMany: async (docs, options = {}) => {
        rows(name, options.session).push(...docs);
        mutate(options.session);
      },
    };
  } };
  const connection = { db, startSession: async () => {
    const session = {
      working: undefined, dirty: false,
      withTransaction: async (work) => {
        for (let attempt = 0; attempt < 150; attempt++) {
          const atVersion = version;
          session.working = copy(state);
          session.dirty = false;
          await work();
          await Promise.resolve();
          if (!session.dirty) return;
          if (version !== atVersion) { conflicts++; continue; }
          state = session.working;
          version++;
          return;
        }
        throw new Error("Offline transaction retry budget exhausted");
      },
      endSession: async () => {},
    };
    return session;
  } };
  globalThis.__concurrentMongoose = { connection, Types: { ObjectId } };
  globalThis.__concurrentConnections = 0;
  return { state: () => state, conflicts: () => conflicts };
}

const uuid = (index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
const input = (index) => ({
  name: `Synthetic lead ${index + 1}`, email: `lead${index + 1}@example.invalid`, phone: "9876543210",
  website: "dholera-estate-1", leadType: "enquiry", source: "estate1-popup-form",
  consent: true, idempotencyKey: uuid(index),
});
const legacy = (index) => ({ collection: "estate1-enquiries", data: {
  name: `Synthetic lead ${index + 1}`, email: `lead${index + 1}@example.invalid`,
  phone: "9876543210", source: "estate1-popup-form",
} });

for (const count of [10, 20, 50]) {
  test(`${count} simultaneous distinct leads commit a fair ten-person rotation`, async () => {
    const testDb = fixture();
    const { ingestLeadWithLegacy } = await offlineIngest();
    const results = await Promise.all(Array.from({ length: count }, (_, index) =>
      ingestLeadWithLegacy(input(index), legacy(index))));
    const state = testDb.state();
    assert.ok(results.every((result) => result.duplicate === false && result.assigned === true));
    assert.equal(state["central-leads"].length, count);
    assert.equal(state["estate1-enquiries"].length, count);
    assert.equal(state["crm-activities"].length, count * 2);
    assert.equal(state["crm-assignment-counters"][0].sequence, count);
    assert.deepEqual(state["central-leads"].map((lead) => lead.assignmentSequence).sort((a, b) => a - b),
      Array.from({ length: count }, (_, index) => index + 1));
    for (const person of state.users) {
      assert.equal(state["central-leads"].filter((lead) => sameId(lead.assignedSalesperson, person._id)).length, count / 10);
    }
    assert.equal(new Set(state["central-leads"].map((lead) => lead.idempotencyKey)).size, count);
    assert.ok(testDb.conflicts() > 0, "fixture must exercise transaction conflict retries");
  });
}

function sameId(left, right) { return String(left) === String(right); }

test("20 simultaneous same-key submissions commit one lead, activities and counter advance", async () => {
  const testDb = fixture();
  const { ingestLeadWithLegacy } = await offlineIngest();
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    ingestLeadWithLegacy(input(500), legacy(500))));
  const state = testDb.state();
  assert.equal(results.filter((result) => !result.duplicate).length, 1);
  assert.equal(results.filter((result) => result.duplicate).length, 19);
  assert.equal(new Set(results.map((result) => result.id)).size, 1);
  assert.equal(state["central-leads"].length, 1);
  assert.equal(state["estate1-enquiries"].length, 1);
  assert.equal(state["crm-activities"].length, 2);
  assert.equal(state["crm-assignment-counters"][0].sequence, 1);
  assert.ok(testDb.conflicts() > 0);
});

test("failed transactions roll back counter, legacy lead and activities; retry commits once", async () => {
  const testDb = fixture();
  const { ingestLeadWithLegacy } = await offlineIngest();
  for (const hook of ["afterRotation", "beforeActivityInsert"]) {
    await assert.rejects(ingestLeadWithLegacy(input(800), legacy(800), {
      [hook]: () => { throw new Error("Synthetic transaction failure"); },
    }), /Synthetic transaction failure/);
    const state = testDb.state();
    assert.equal(state["central-leads"].length, 0);
    assert.equal(state["estate1-enquiries"].length, 0);
    assert.equal(state["crm-activities"].length, 0);
    assert.equal(state["crm-assignment-counters"][0].sequence, 0);
  }
  const result = await ingestLeadWithLegacy(input(800), legacy(800));
  assert.equal(result.duplicate, false);
  assert.equal(testDb.state()["central-leads"].length, 1);
  assert.equal(testDb.state()["crm-activities"].length, 2);
  assert.equal(testDb.state()["crm-assignment-counters"][0].sequence, 1);
});

test("central-only ingress rejects a missing unique index before any write", async () => {
  for (const missingIndex of ["central-leads", "crm-assignment-counters"]) {
    const testDb = fixture({ missingIndex });
    const { ingestCentralLead } = await offlineIngest();
    await assert.rejects(ingestCentralLead(input(900)), /unique .* index/);
    assert.equal(testDb.state()["central-leads"].length, 0);
    assert.equal(testDb.state()["crm-activities"].length, 0);
    assert.equal(testDb.state()["crm-assignment-counters"][0].sequence, 0);
  }
});
