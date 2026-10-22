import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { mongooseAdapter } from "@payloadcms/db-mongodb";

import { INGRESS_PAYLOAD_COLLECTIONS } from "../../lib/noida-local-ingress-qa-config.mjs";
import { buildLocalFaultConfig } from "../../lib/noida-local-fault-config.mjs";
import { ALLOWED_COLLECTIONS, APPROVAL_FLAG, APPROVAL_TEXT, CAPS, CASES, TARGET, URI, assertAbsentTarget, assertAttemptPlan, assertCapacity, assertCleanEnvironment, assertExactTarget, assertExecutionGate, assertScope } from "../../lib/noida-local-fault-qa.mjs";
import { assertOtherDatabasesUnchanged, snapshotOtherDatabases } from "../../lib/noida-local-fault-preflight.mjs";

test("fault target and schema are exact and bounded", () => {
  assert.deepEqual(TARGET, { host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: "noida-crm-fault-injection-qa-20261021" });
  assert.equal(URI, "mongodb://127.0.0.1:27179/noida-crm-fault-injection-qa-20261021?replicaSet=noida_demo&directConnection=true");
  assert.equal(ALLOWED_COLLECTIONS.length, 18);
  assert.equal(new Set(ALLOWED_COLLECTIONS).size, 18);
  assert.deepEqual(CAPS, { attempts: 11, central: 7, legacy: 7, activities: 14, counterAdvances: 7, namespaces: 18, secondaryIndexes: 54, offices: 1, users: 1, counters: 1 });
  assertAttemptPlan();
  assert.equal(CASES.length, 11);
  for (const suffix of ["?replicaSet=noida_demo", "?replicaSet=other&directConnection=true", "?replicaSet=noida_demo&directConnection=true&tls=false"]) {
    assert.throws(() => assertExactTarget(URI.slice(0, URI.indexOf("?")) + suffix));
  }
  assert.throws(() => assertExactTarget(URI.replace("127.0.0.1", "localhost")));
  assert.throws(() => assertExactTarget(URI.replace(TARGET.database, "noida-crm-ingress-qa-20261021")));
});

test("execution gate rejects missing approval and inherited services", () => {
  assert.match(APPROVAL_TEXT, /seven central leads, seven legacy leads, fourteen activities and seven counter advances/);
  const plan = readFileSync(resolve(import.meta.dirname, "../../docs/noida-phase1-final-safe-release-prep-2026-10-21.md"), "utf8");
  const consumedApproval = plan.match(/\*\*Exact owner approval for the consumed attempt:\*\* “([^”]+)”/)?.[1];
  assert.ok(consumedApproval);
  assert.equal(plan.match(/\*\*Exact owner approval for the corrected second run:\*\* “([^”]+)”/)?.[1], APPROVAL_TEXT);
  assert.notEqual(consumedApproval, APPROVAL_TEXT);
  assert.throws(() => assertExecutionGate([], {}));
  assert.throws(() => assertExecutionGate(["--execute", "--approval=wrong"], {}));
  assert.throws(() => assertExecutionGate(["--execute", `--approval=${consumedApproval}`], { PATH: "/usr/bin" }));
  assert.doesNotThrow(() => assertExecutionGate(["--execute", `--approval=${APPROVAL_FLAG}`], { PATH: "/usr/bin" }));
  for (const name of ["MONGODB_URI", "ATLAS_URI", "PAYLOAD_SECRET", "OPENAI_API_KEY", "SMTP_HOST", "HTTPS_PROXY", "NODE_OPTIONS", "DOTENV_CONFIG_PATH"]) {
    assert.throws(() => assertCleanEnvironment({ [name]: "redacted" }));
  }
});

test("real Payload adapter descriptor retains the exact target options without a connection", () => {
  const sourceConfig = { collections: INGRESS_PAYLOAD_COLLECTIONS.map((slug) => ({ slug, fields: [] })), typescript: {}, admin: {} };
  let adapterOptions;
  const config = buildLocalFaultConfig({ sourceConfig, mongooseAdapter: (options) => {
    adapterOptions = options;
    return mongooseAdapter(options);
  } });
  assert.deepEqual(config.collections.map((collection) => collection.slug), INGRESS_PAYLOAD_COLLECTIONS);
  assert.equal(adapterOptions.url, URI);
  assert.equal(adapterOptions.ensureIndexes, false);
  assert.equal(adapterOptions.connectOptions.autoIndex, false);
  assert.equal(config.db.url, undefined, "the real adapter descriptor has no runtime URL before Payload initialization");
  assert.equal(config.db.ensureIndexes, undefined, "the real adapter descriptor has no runtime index flag before Payload initialization");
  assert.equal(config.db.name, "mongoose");
  assert.equal(typeof config.db.init, "function");
  assert.equal(config.typescript.autoGenerate, false);
  assert.equal(config.admin.importMap.autoGenerate, false);
  assert.throws(() => buildLocalFaultConfig({ sourceConfig: { ...sourceConfig, collections: [] }, mongooseAdapter }));
});

test("runner plan is offline and execution fails closed without the full approval", () => {
  const runner = resolve(import.meta.dirname, "../../scripts/noida-local-partial-write-fault-qa.mjs");
  const root = resolve(import.meta.dirname, "../..");
  const plan = JSON.parse(execFileSync(process.execPath, [runner, "--plan"], { cwd: root, encoding: "utf8", timeout: 10000 }));
  assert.equal(plan.status, "AWAITING_SEPARATE_OWNER_APPROVAL");
  assert.deepEqual(plan.cases, CASES);
  assert.deepEqual(plan.caps, CAPS);
  const denied = spawnSync(process.execPath, [runner, "--execute"], { cwd: root, encoding: "utf8", timeout: 10000 });
  assert.notEqual(denied.status, 0);
  assert.match(denied.stderr, /Exact separate owner approval flag is required/);
  const unsafeEnv = spawnSync(process.execPath, [runner, "--execute", `--approval=${APPROVAL_TEXT}`], { cwd: root, env: { PATH: "/usr/bin", MONGODB_URI: "mongodb+srv://blocked.invalid" }, encoding: "utf8", timeout: 10000 });
  assert.notEqual(unsafeEnv.status, 0);
  assert.match(unsafeEnv.stderr, /Inherited service or proxy configuration is forbidden/);
});

test("absent target and every write cap fail closed", () => {
  assertAbsentTarget(["noida-crm-ingress-qa-20261021"], []);
  assert.throws(() => assertAbsentTarget([TARGET.database], []));
  assert.throws(() => assertAbsentTarget([], ["central-leads"]));
  const baseline = { names: ALLOWED_COLLECTIONS, secondaryIndexes: 54, sequence: 0, counts: { "crm-offices": 1, users: 1, "crm-assignment-counters": 1, "central-leads": 0, "estate1-enquiries": 0, "omana-enquiries": 0, "crm-activities": 0 } };
  assertScope(baseline);
  assert.throws(() => assertScope(baseline, { attempts: 12 }));
  assert.throws(() => assertScope({ ...baseline, secondaryIndexes: 55 }));
  assert.throws(() => assertScope({ ...baseline, names: [...ALLOWED_COLLECTIONS, "other"] }));
  assert.throws(() => assertScope({ ...baseline, counts: { ...baseline.counts, users: 2 } }));
  assert.throws(() => assertScope({ ...baseline, counts: { ...baseline.counts, "central-leads": 8 } }));
  assert.throws(() => assertScope({ ...baseline, counts: { ...baseline.counts, "estate1-enquiries": 4, "omana-enquiries": 4 } }));
  assert.throws(() => assertScope({ ...baseline, counts: { ...baseline.counts, "crm-activities": 15 } }));
  assert.throws(() => assertScope({ ...baseline, sequence: 8 }));
  assert.throws(() => assertScope({ ...baseline, counts: { ...baseline.counts, "estate2-enquiries": 1 } }));
  assert.throws(() => assertCapacity({ ...baseline, counts: { ...baseline.counts, "central-leads": 7 } }, { attempts: 11, central: 1 }));
});

test("other-database inventory uses reads only and detects any change", async () => {
  const calls = [];
  const client = {
    db(name) {
      calls.push(["db", name]);
      if (name === "admin") return { command: async (command) => {
        calls.push(["command", command]);
        return { databases: [{ name: "admin" }, { name: TARGET.database }, { name: "noida-crm-ingress-qa-20261021" }] };
      } };
      assert.equal(name, "noida-crm-ingress-qa-20261021");
      return {
        listCollections: () => ({ toArray: async () => [{ name: "central-leads", type: "collection" }] }),
        collection: () => ({ find: () => ({ sort: () => ({ toArray: async () => [{ _id: "synthetic", consent: true }] }) }), listIndexes: () => ({ toArray: async () => [{ key: { _id: 1 } }] }) }),
      };
    },
  };
  const before = await snapshotOtherDatabases(client);
  assert.deepEqual(Object.keys(before), ["noida-crm-ingress-qa-20261021"]);
  assert.equal(before["noida-crm-ingress-qa-20261021"].collections["central-leads"].count, 1);
  assertOtherDatabasesUnchanged(before, structuredClone(before));
  const changed = structuredClone(before);
  changed["noida-crm-ingress-qa-20261021"].collections["central-leads"].count = 2;
  assert.throws(() => assertOtherDatabasesUnchanged(before, changed));
  assert.ok(calls.every(([method]) => ["db", "command"].includes(method)), "test stub records no mutation calls");
});
