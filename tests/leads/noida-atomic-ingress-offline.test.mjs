import assert from "node:assert/strict";
import Module from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const key = "b752533e-2422-460f-925d-e1e6ed55ae11";

async function offlineIngest() {
  const filename = resolve(root, "lib/crm/ingest.ts");
  const built = await build({
    entryPoints: [filename], bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "offline-db", setup(context) {
      context.onResolve({ filter: /^mongoose$/ }, () => ({ path: "mongoose", namespace: "offline-stub" }));
      context.onResolve({ filter: /mongodb$/ }, () => ({ path: "connect", namespace: "offline-stub" }));
      context.onLoad({ filter: /.*/, namespace: "offline-stub" }, ({ path }) => ({ loader: "js", contents: path === "mongoose"
        ? "export default globalThis.__atomicMongoose;"
        : "export default async () => { globalThis.__atomicConnections += 1; };" }));
    } }],
  });
  const compiled = new Module(filename);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(root);
  compiled._compile(built.outputFiles[0].text, filename);
  return compiled.exports;
}

function harness({ failLegacyCollection, missingIndex } = {}) {
  let serial = 10;
  class ObjectId {
    constructor(value) { this.value = value ?? String(++serial).padStart(24, "0"); }
    toString() { return this.value; }
  }
  const officeId = new ObjectId("000000000000000000000001");
  let state = {
    "crm-offices": [{ _id: officeId, code: "noida", active: true }],
    users: [{ _id: new ObjectId("000000000000000000000002"), role: "salesperson", office: officeId, active: true, eligibleForAssignment: true }],
    "crm-assignment-counters": [{ _id: new ObjectId("000000000000000000000003"), key: "noida-shared-lead-round-robin", office: officeId, sequence: 0 }],
    "central-leads": [], "crm-activities": [], "estate1-enquiries": [], "omana-enquiries": [],
  };
  const same = (left, right) => String(left) === String(right);
  const rows = (name, session) => (session?.working ?? state)[name];
  const find = (name, filter, session) => rows(name, session).find((row) => Object.entries(filter).every(([field, value]) => same(row[field], value))) ?? null;
  const db = {
    collection(name) {
      assert.ok(name in state, `Unexpected collection ${name}`);
      return {
        listIndexes: () => ({ toArray: async () => name === "central-leads"
          ? (missingIndex === name ? [] : [{ key: { idempotencyKey: 1 }, unique: true }])
          : name === "crm-assignment-counters"
            ? (missingIndex === name ? [] : [{ key: { key: 1, office: 1 }, unique: true }])
            : [] }),
        findOne: async (filter, options = {}) => find(name, filter, options.session),
        find: (_filter, options = {}) => ({ sort: () => ({ toArray: async () => rows(name, options.session) }) }),
        findOneAndUpdate: async (filter, update, options = {}) => {
          let row = find(name, filter, options.session);
          if (!row && options.upsert) {
            row = { ...filter, ...update.$setOnInsert, sequence: 0 };
            rows(name, options.session).push(row);
          }
          if (row && update.$inc?.sequence) row.sequence += update.$inc.sequence;
          return row;
        },
        insertOne: async (doc, options = {}) => {
          if (name === failLegacyCollection) throw new Error("Injected legacy insert failure");
          if (name === "central-leads" && find(name, { idempotencyKey: doc.idempotencyKey }, options.session)) {
            throw Object.assign(new Error("duplicate key"), { code: 11000 });
          }
          rows(name, options.session).push(doc);
        },
        insertMany: async (docs, options = {}) => { rows(name, options.session).push(...docs); },
      };
    },
  };
  const connection = {
    db,
    startSession: async () => {
      const session = {
        working: undefined,
        withTransaction: async (work) => {
          session.working = Object.fromEntries(Object.entries(state).map(([name, records]) => [name, records.map((record) => ({ ...record }))]));
          await work();
          state = session.working;
        },
        endSession: async () => {},
      };
      return session;
    },
  };
  globalThis.__atomicMongoose = { connection, Types: { ObjectId } };
  globalThis.__atomicConnections = 0;
  return { state: () => state, ObjectId };
}

const estateInput = () => ({
  name: "Synthetic", email: "synthetic@example.invalid", phone: "9876543210",
  website: "dholera-estate-1", leadType: "enquiry", source: "estate1-popup-form",
  consent: true, idempotencyKey: key,
});
const estateLegacy = () => ({ collection: "estate1-enquiries", data: { name: "Synthetic", email: "synthetic@example.invalid", phone: "9876543210", source: "estate1-popup-form" } });

test("Estate legacy, central, activities and assignment commit together; same-key replay writes nothing", async () => {
  const fixture = harness();
  const { ingestLeadWithLegacy } = await offlineIngest();
  const created = await ingestLeadWithLegacy(estateInput(), estateLegacy());
  assert.equal(created.duplicate, false);
  const committed = fixture.state();
  assert.equal(committed["estate1-enquiries"].length, 1);
  assert.equal(committed["central-leads"].length, 1);
  assert.equal(committed["crm-activities"].length, 2);
  assert.equal(committed["crm-assignment-counters"][0].sequence, 1);
  assert.equal(committed["central-leads"][0].legacyId, String(committed["estate1-enquiries"][0]._id));
  assert.equal(committed["central-leads"][0].assignedSalesperson, committed.users[0]._id);
  const replay = await ingestLeadWithLegacy(estateInput(), estateLegacy());
  assert.equal(replay.duplicate, true);
  assert.equal(replay.legacyId, created.legacyId);
  assert.equal(fixture.state()["estate1-enquiries"].length, 1);
  assert.equal(fixture.state()["central-leads"].length, 1);
  assert.equal(fixture.state()["crm-activities"].length, 2);
  assert.equal(fixture.state()["crm-assignment-counters"][0].sequence, 1);
});

test("Estate lead and activity failures roll back legacy and assignment writes", async () => {
  for (const hook of ["beforeLeadInsert", "beforeActivityInsert"]) {
    const fixture = harness();
    const { ingestLeadWithLegacy } = await offlineIngest();
    await assert.rejects(ingestLeadWithLegacy(estateInput(), estateLegacy(), { [hook]: () => { throw new Error("Injected transaction failure"); } }), /Injected transaction failure/);
    assert.equal(fixture.state()["estate1-enquiries"].length, 0, hook);
    assert.equal(fixture.state()["central-leads"].length, 0, hook);
    assert.equal(fixture.state()["crm-activities"].length, 0, hook);
    assert.equal(fixture.state()["crm-assignment-counters"][0].sequence, 0, hook);
  }
});

test("Omana central-only historical duplicate requires reconciliation without another assignment", async () => {
  const fixture = harness();
  const existingId = new fixture.ObjectId();
  const input = { ...estateInput(), website: "omana-projects", source: "omana-global-drawer" };
  fixture.state()["central-leads"].push({ _id: existingId, ...input, assignedSalesperson: fixture.state().users[0]._id });
  const { ingestLeadWithLegacy, LeadReconciliationRequiredError } = await offlineIngest();
  const legacy = { collection: "omana-enquiries", data: { name: "Synthetic", phone: "9876543210", page: "/", source: "omana-global-drawer", consent: true } };
  await assert.rejects(ingestLeadWithLegacy(input, legacy), (error) => error instanceof LeadReconciliationRequiredError && error.centralId === String(existingId));
  assert.equal(fixture.state()["omana-enquiries"].length, 0);
  assert.equal(fixture.state()["crm-assignment-counters"][0].sequence, 0);
  assert.equal(fixture.state()["crm-activities"].length, 0);
});

test("Omana legacy insertion failure commits no central lead, activity or counter advance", async () => {
  const fixture = harness({ failLegacyCollection: "omana-enquiries" });
  const { ingestLeadWithLegacy } = await offlineIngest();
  const input = { ...estateInput(), website: "omana-projects", source: "omana-global-drawer" };
  const legacy = { collection: "omana-enquiries", data: { name: "Synthetic", phone: "9876543210", page: "/", source: "omana-global-drawer", consent: true } };
  await assert.rejects(ingestLeadWithLegacy(input, legacy), /Injected legacy insert failure/);
  assert.equal(fixture.state()["omana-enquiries"].length, 0);
  assert.equal(fixture.state()["central-leads"].length, 0);
  assert.equal(fixture.state()["crm-activities"].length, 0);
  assert.equal(fixture.state()["crm-assignment-counters"][0].sequence, 0);
});

test("Omana runner rejection hook stops before any legacy or assignment write", async () => {
  const fixture = harness();
  const { ingestLeadWithLegacy } = await offlineIngest();
  const input = { ...estateInput(), website: "omana-projects", source: "omana-global-drawer" };
  const legacy = { collection: "omana-enquiries", data: { name: "Synthetic", phone: "9876543210", page: "/", source: "omana-global-drawer", consent: true } };
  await assert.rejects(ingestLeadWithLegacy(input, legacy, { beforeLegacyInsert: () => { throw new Error("Injected Omana legacy insert rejection"); } }), /Injected Omana legacy insert rejection/);
  assert.equal(fixture.state()["omana-enquiries"].length, 0);
  assert.equal(fixture.state()["central-leads"].length, 0);
  assert.equal(fixture.state()["crm-activities"].length, 0);
  assert.equal(fixture.state()["crm-assignment-counters"][0].sequence, 0);
});

test("concurrent same-key winner leaves the losing transaction without a legacy duplicate or counter advance", async () => {
  const fixture = harness();
  const { ingestLeadWithLegacy } = await offlineIngest();
  const winnerLegacyId = new fixture.ObjectId();
  const winnerCentralId = new fixture.ObjectId();
  const result = await ingestLeadWithLegacy(estateInput(), estateLegacy(), {
    beforeLeadInsert: () => {
      const committed = fixture.state();
      committed["estate1-enquiries"].push({ _id: winnerLegacyId, name: "Synthetic" });
      committed["central-leads"].push({
        _id: winnerCentralId, ...estateInput(), legacyCollection: "estate1-enquiries",
        legacyId: String(winnerLegacyId), assignedSalesperson: committed.users[0]._id,
      });
      committed["crm-activities"].push({ event: "created" }, { event: "assigned" });
      committed["crm-assignment-counters"][0].sequence = 1;
      throw Object.assign(new Error("concurrent unique-key winner"), { code: 11000 });
    },
  });
  assert.equal(result.duplicate, true);
  assert.equal(result.id, String(winnerCentralId));
  assert.equal(result.legacyId, String(winnerLegacyId));
  assert.equal(fixture.state()["estate1-enquiries"].length, 1);
  assert.equal(fixture.state()["central-leads"].length, 1);
  assert.equal(fixture.state()["crm-activities"].length, 2);
  assert.equal(fixture.state()["crm-assignment-counters"][0].sequence, 1);
});

test("same idempotency key with different lead identity is an auditable conflict, not a duplicate success", async () => {
  const fixture = harness();
  const { ingestLeadWithLegacy, LeadIdempotencyConflictError } = await offlineIngest();
  await ingestLeadWithLegacy(estateInput(), estateLegacy());
  await assert.rejects(ingestLeadWithLegacy({ ...estateInput(), name: "Different Person" }, estateLegacy()), (error) => error instanceof LeadIdempotencyConflictError);
  assert.equal(fixture.state()["estate1-enquiries"].length, 1);
  assert.equal(fixture.state()["central-leads"].length, 1);
  assert.equal(fixture.state()["crm-assignment-counters"][0].sequence, 1);
});

test("atomic ingestion rejects invalid key, wrong collection and nonconsent before a connection", async () => {
  harness();
  const { ingestLeadWithLegacy } = await offlineIngest();
  await assert.rejects(ingestLeadWithLegacy({ ...estateInput(), idempotencyKey: undefined }, estateLegacy()), /valid idempotency key/);
  await assert.rejects(ingestLeadWithLegacy(estateInput(), { ...estateLegacy(), collection: "omana-enquiries" }), /does not match/);
  await assert.rejects(ingestLeadWithLegacy({ ...estateInput(), consent: false }, estateLegacy()), /affirmative contact consent/);
  assert.equal(globalThis.__atomicConnections, 0);
});

test("atomic ingestion fails before any write when either uniqueness index is missing", async () => {
  for (const missingIndex of ["central-leads", "crm-assignment-counters"]) {
    const fixture = harness({ missingIndex });
    const { ingestLeadWithLegacy } = await offlineIngest();
    await assert.rejects(ingestLeadWithLegacy(estateInput(), estateLegacy()), /requires the unique/);
    assert.equal(fixture.state()["estate1-enquiries"].length, 0);
    assert.equal(fixture.state()["central-leads"].length, 0);
    assert.equal(fixture.state()["crm-assignment-counters"][0].sequence, 0);
  }
});
