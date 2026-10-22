import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { mongooseAdapter } from "@payloadcms/db-mongodb";

import { INGRESS_PAYLOAD_COLLECTIONS } from "../../lib/noida-local-ingress-qa-config.mjs";
import { buildLocalAtomicConfig } from "../../lib/noida-local-atomic-config.mjs";
import { ALLOWED_COLLECTIONS, APPROVAL_TEXT, CAPS, CASES, TARGET, URI, assertAbsentTarget, assertAttemptPlan, assertCapacity, assertExactTarget, assertExecutionGate, assertPayloadReadCollection, assertRequiredIndexes, assertScope } from "../../lib/noida-local-atomic-qa.mjs";
import { assertOtherDatabasesUnchanged, assertServerMetadata, snapshotOtherDatabases } from "../../lib/noida-local-atomic-preflight.mjs";

const ROOT = resolve(import.meta.dirname, "../..");

test("atomic target, nine attempts, namespace and write caps are exact", () => {
  assert.deepEqual(TARGET, { host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: "noida-crm-atomic-ingress-qa-20261021" });
  assert.equal(URI, "mongodb://127.0.0.1:27179/noida-crm-atomic-ingress-qa-20261021?replicaSet=noida_demo&directConnection=true");
  assert.deepEqual(CAPS, { attempts: 9, central: 3, legacy: 3, activities: 6, counterAdvances: 3, namespaces: 18, secondaryIndexes: 54, offices: 1, users: 1, counters: 1 });
  assertAttemptPlan();
  assert.equal(CASES.length, 9);
  assert.equal(ALLOWED_COLLECTIONS.length, 18);
  assert.throws(() => assertExactTarget(URI.replace("127.0.0.1", "localhost")));
  assert.throws(() => assertExactTarget(URI.replace("27179", "27017")));
  assert.throws(() => assertExactTarget(URI.replace("noida_demo", "other")));
  assert.throws(() => assertExactTarget(URI.replace(TARGET.database, "noida-crm-fault-injection-qa-20261021")));
  assert.throws(() => assertExactTarget(`${URI}&tls=false`));
  assertAbsentTarget(["noida-crm-fault-injection-qa-20261021"], []);
  assert.throws(() => assertAbsentTarget([TARGET.database], []));
  assert.throws(() => assertAbsentTarget([], ["central-leads"]));
});

test("approval gate rejects missing, old and contaminated execution requests before MongoDB", () => {
  const plan = readFileSync(resolve(ROOT, "docs/noida-phase1-final-safe-release-prep-2026-10-21.md"), "utf8");
  const proposed = plan.match(/\*\*Proposed exact owner approval for the next database-backed gate[^\n]+?“([^”]+)”/)?.[1];
  const old = plan.match(/\*\*Exact owner approval for the corrected second run:\*\* “([^”]+)”/)?.[1];
  assert.equal(proposed, APPROVAL_TEXT);
  assert.notEqual(old, APPROVAL_TEXT);
  assert.throws(() => assertExecutionGate([], {}));
  assert.throws(() => assertExecutionGate(["--execute", `--approval=${old}`], { PATH: "/usr/bin:/bin:/usr/sbin" }));
  assert.throws(() => assertExecutionGate(["--execute", `--approval=${APPROVAL_TEXT}`], { PATH: "/usr/bin:/bin:/usr/sbin", MONGODB_URI: "mongodb+srv://blocked.invalid" }));
  assert.throws(() => assertExecutionGate(["--execute", `--approval=${APPROVAL_TEXT}`], { PATH: "/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin" }));
  assert.doesNotThrow(() => assertExecutionGate(["--execute", `--approval=${APPROVAL_TEXT}`], { PATH: "/usr/bin:/bin:/usr/sbin" }));
  const runner = resolve(ROOT, "scripts/noida-local-atomic-ingress-qa.mjs");
  const offlinePlan = JSON.parse(execFileSync(process.execPath, [runner, "--plan"], { cwd: ROOT, encoding: "utf8", timeout: 10000 }));
  assert.equal(offlinePlan.status, "AWAITING_SEPARATE_OWNER_APPROVAL");
  assert.deepEqual(offlinePlan.cases, CASES);
  assert.deepEqual(offlinePlan.caps, CAPS);
  const denied = spawnSync(process.execPath, [runner, "--execute"], { cwd: ROOT, encoding: "utf8", timeout: 10000 });
  assert.notEqual(denied.status, 0);
  assert.match(denied.stderr, /Exact new owner approval flag is required/);
  const inherited = spawnSync(process.execPath, [runner, "--execute", `--approval=${APPROVAL_TEXT}`], { cwd: ROOT, env: { PATH: "/usr/bin", ATLAS_URI: "blocked" }, encoding: "utf8", timeout: 10000 });
  assert.notEqual(inherited.status, 0);
  assert.match(inherited.stderr, /Inherited service or proxy configuration is forbidden/);
  const noLoader = spawnSync(process.execPath, [runner, "--execute", `--approval=${APPROVAL_TEXT}`], { cwd: ROOT, env: { PATH: "/usr/bin:/bin:/usr/sbin" }, encoding: "utf8", timeout: 10000 });
  assert.notEqual(noLoader.status, 0);
  assert.match(noLoader.stderr, /pinned TypeScript loader/);
});

test("real Payload adapter keeps disabled automatic indexes and the exact target offline", () => {
  const sourceConfig = { collections: INGRESS_PAYLOAD_COLLECTIONS.map((slug) => ({ slug, fields: [] })), typescript: {}, admin: {} };
  let options;
  const config = buildLocalAtomicConfig({ sourceConfig, mongooseAdapter: (input) => {
    options = input;
    return mongooseAdapter(input);
  } });
  assert.deepEqual(config.collections.map((collection) => collection.slug), INGRESS_PAYLOAD_COLLECTIONS);
  assert.equal(options.url, URI);
  assert.equal(options.ensureIndexes, false);
  assert.equal(options.connectOptions.autoIndex, false);
  assert.equal(config.db.name, "mongoose");
  assert.equal(typeof config.db.init, "function");
  assert.throws(() => buildLocalAtomicConfig({ sourceConfig: { ...sourceConfig, collections: [] }, mongooseAdapter }));
});

test("every document, counter, namespace and index cap fails closed", () => {
  const counts = Object.fromEntries(ALLOWED_COLLECTIONS.map((name) => [name, 0]));
  Object.assign(counts, { "crm-offices": 1, users: 1, "crm-assignment-counters": 1, "central-leads": 3, "estate1-enquiries": 2, "omana-enquiries": 1, "crm-activities": 6 });
  const full = { names: ALLOWED_COLLECTIONS, secondaryIndexes: 54, counts, sequence: 3 };
  assertScope(full, 9);
  assert.throws(() => assertScope(full, 10));
  assert.throws(() => assertScope({ ...full, names: [...ALLOWED_COLLECTIONS, "unexpected"] }, 9));
  assert.throws(() => assertScope({ ...full, secondaryIndexes: 55 }, 9));
  assert.throws(() => assertScope({ ...full, counts: { ...counts, users: 2 } }, 9));
  assert.throws(() => assertScope({ ...full, counts: { ...counts, "central-leads": 4 } }, 9));
  assert.throws(() => assertScope({ ...full, counts: { ...counts, "estate1-enquiries": 3 } }, 9));
  assert.throws(() => assertScope({ ...full, counts: { ...counts, "crm-activities": 7 } }, 9));
  assert.throws(() => assertScope({ ...full, counts: { ...counts, "estate2-enquiries": 1 } }, 9));
  assert.throws(() => assertScope({ ...full, sequence: 4 }, 9));
  assert.throws(() => assertCapacity(full, { attempts: 9, central: 1 }));
  assert.throws(() => assertCapacity(full, { attempts: 10 }));
  assert.throws(() => assertCapacity(full, { attempts: 9, activities: -1 }));
});

test("full unique lead and counter indexes are mandatory", () => {
  const valid = { "central-leads": [{ key: { idempotencyKey: 1 }, unique: true }], "crm-assignment-counters": [{ key: { key: 1, office: 1 }, unique: true }] };
  assertRequiredIndexes(valid);
  assert.throws(() => assertRequiredIndexes({ ...valid, "central-leads": [] }));
  assert.throws(() => assertRequiredIndexes({ ...valid, "crm-assignment-counters": [{ key: { key: 1, office: 1 }, unique: true, partialFilterExpression: { key: { $exists: true } } }] }));
  assert.throws(() => assertRequiredIndexes({ ...valid, "central-leads": [{ key: { idempotencyKey: 1 }, unique: false }] }));
});

test("Payload verification rejects the raw-only activity collection", () => {
  assertPayloadReadCollection("central-leads");
  assertPayloadReadCollection("estate1-enquiries");
  assertPayloadReadCollection("omana-enquiries");
  assert.throws(() => assertPayloadReadCollection("crm-activities"), /not registered/);
  const runner = readFileSync(resolve(ROOT, "scripts/noida-local-atomic-ingress-qa.mjs"), "utf8");
  assert.doesNotMatch(runner, /payload\.findByID\(\{ collection: "crm-activities"/);
});

test("fresh preflight rejects a wrong listener, replica set or writable role", () => {
  const hello = { setName: TARGET.replicaSet, me: `${TARGET.host}:${TARGET.port}`, hosts: [`${TARGET.host}:${TARGET.port}`], isWritablePrimary: true };
  const options = { parsed: { net: { bindIp: TARGET.host, port: TARGET.port } } };
  const replica = { set: TARGET.replicaSet, members: [{ name: `${TARGET.host}:${TARGET.port}`, stateStr: "PRIMARY" }] };
  assertServerMetadata(hello, options, replica);
  assert.throws(() => assertServerMetadata({ ...hello, me: "127.0.0.1:27017" }, options, replica));
  assert.throws(() => assertServerMetadata(hello, { parsed: { net: { bindIp: "0.0.0.0", port: TARGET.port } } }, replica));
  assert.throws(() => assertServerMetadata({ ...hello, isWritablePrimary: false }, options, replica));
  assert.throws(() => assertServerMetadata(hello, options, { ...replica, set: "other" }));
});

test("other-database digests use read-only calls and catch any change", async () => {
  const calls = [];
  const client = { db(name) {
    calls.push(["db", name]);
    if (name === "admin") return { command: async (command) => {
      calls.push(["command", command]);
      return { databases: [{ name: "admin" }, { name: TARGET.database }, { name: "noida-crm-fault-injection-qa-20261021" }] };
    } };
    assert.equal(name, "noida-crm-fault-injection-qa-20261021");
    return {
      listCollections: () => ({ toArray: async () => [{ name: "central-leads", type: "collection" }] }),
      collection: () => ({ find: () => ({ sort: () => ({ toArray: async () => [{ _id: "synthetic" }] }) }), listIndexes: () => ({ toArray: async () => [{ key: { _id: 1 } }] }) }),
    };
  } };
  const before = await snapshotOtherDatabases(client);
  assert.deepEqual(Object.keys(before), ["noida-crm-fault-injection-qa-20261021"]);
  assertOtherDatabasesUnchanged(before, structuredClone(before));
  const changed = structuredClone(before);
  changed["noida-crm-fault-injection-qa-20261021"].collections["central-leads"].count = 2;
  assert.throws(() => assertOtherDatabasesUnchanged(before, changed));
  assert.ok(calls.every(([method]) => ["db", "command"].includes(method)));
});
