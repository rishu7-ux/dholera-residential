import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { ALLOWED_COLLECTIONS, CAPS, TARGET, URI, assertCapacity, assertPayloadReadCollection, digest } from "../../lib/noida-local-atomic-qa.mjs";
import { APPROVAL_TEXT, REMAINING_CASES, SOURCE_MARKER, assertCurrentBaseline, assertEvidenceBaseline, assertNoPriorContinuation, assertResumeGate, evidencePaths, readProtectedEvidence } from "../../lib/noida-local-atomic-continuation.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const paths = evidencePaths(ROOT);
const failure = readProtectedEvidence(paths.failure);
const postflight = readProtectedEvidence(paths.postflight);

test("protected stopped-run evidence proves exactly one committed first case", () => {
  assertEvidenceBaseline(failure, postflight);
  assert.deepEqual(TARGET, { host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: "noida-crm-atomic-ingress-qa-20261021" });
  assert.equal(URI, "mongodb://127.0.0.1:27179/noida-crm-atomic-ingress-qa-20261021?replicaSet=noida_demo&directConnection=true");
  assert.equal(SOURCE_MARKER, failure.runMarker);
  assert.deepEqual(REMAINING_CASES, [
    "estate-replay", "estate-central-rejection", "estate-activity-rejection", "estate-race-a",
    "estate-race-b", "omana-legacy-rejection", "omana-success", "omana-replay",
  ]);
  assert.equal(REMAINING_CASES.length, 8);
  const mutated = structuredClone(postflight);
  mutated.otherDatabaseDigests["noida-crm-fault-injection-qa-20261021"] = "changed";
  assert.throws(() => assertEvidenceBaseline(failure, mutated));
  mutated.otherDatabaseDigests = structuredClone(postflight.otherDatabaseDigests);
  mutated.counts["central-leads"] = 2;
  assert.throws(() => assertEvidenceBaseline(failure, mutated));
  const repeated = structuredClone(failure);
  repeated.attempts.push({ name: "estate-replay" });
  assert.throws(() => assertEvidenceBaseline(repeated, postflight));
});

function syntheticBaseline() {
  const source = structuredClone(failure);
  const evidence = structuredClone(postflight);
  const indexes = Object.fromEntries(ALLOWED_COLLECTIONS.map((name) => [name, []]));
  indexes["central-leads"] = [{ key: { idempotencyKey: 1 }, unique: true }];
  indexes["crm-assignment-counters"] = [{ key: { key: 1, office: 1 }, unique: true }];
  const indexDigests = Object.fromEntries(Object.entries(indexes).map(([name, values]) => [name, digest(values)]));
  const { digest: _prior, ...schema } = source.schema;
  void _prior;
  source.schema.digest = digest({ ...schema, indexDigests });
  const first = source.attempts[0].outcome;
  const ids = Object.fromEntries(ALLOWED_COLLECTIONS.map((name) => [name, []]));
  ids["crm-offices"] = [source.seed.officeId];
  ids.users = [source.seed.salespersonId];
  ids["crm-assignment-counters"] = [source.seed.counterId];
  ids["central-leads"] = [first.centralId];
  ids["estate1-enquiries"] = [first.legacyId];
  ids["crm-activities"] = ["000000000000000000000001", "000000000000000000000002"];
  const snapshot = {
    names: ALLOWED_COLLECTIONS, counts: structuredClone(evidence.counts), ids,
    documentDigests: structuredClone(evidence.targetDocumentDigests), indexes,
    secondaryIndexes: CAPS.secondaryIndexes, sequence: 1,
    leads: [{ id: first.centralId, key: "b752533e-2422-460f-925d-e1e6ed55ae11", legacyCollection: "estate1-enquiries", legacyId: first.legacyId, assignedSalesperson: source.seed.salespersonId, assignmentSequence: 1, consent: true }],
    activities: [{ id: ids["crm-activities"][0], lead: first.centralId, event: "created" }, { id: ids["crm-activities"][1], lead: first.centralId, event: "assigned" }],
  };
  return { source, evidence, snapshot };
}

test("fresh resume baseline rejects document, index, ID, counter and activity drift", () => {
  const { source, evidence, snapshot } = syntheticBaseline();
  const first = assertCurrentBaseline(snapshot, source, evidence);
  assert.equal(first.firstCentralId, source.attempts[0].outcome.centralId);
  assert.equal(first.firstLegacyId, source.attempts[0].outcome.legacyId);
  assert.equal(first.firstActivityIds.length, 2);
  const changedDoc = structuredClone(snapshot);
  changedDoc.documentDigests["estate1-enquiries"] = "changed";
  assert.throws(() => assertCurrentBaseline(changedDoc, source, evidence));
  const changedIndex = structuredClone(snapshot);
  changedIndex.indexes["estate1-enquiries"] = [{ key: { changed: 1 } }];
  assert.throws(() => assertCurrentBaseline(changedIndex, source, evidence));
  const changedId = structuredClone(snapshot);
  changedId.ids["central-leads"] = ["000000000000000000000003"];
  assert.throws(() => assertCurrentBaseline(changedId, source, evidence));
  const changedSequence = structuredClone(snapshot);
  changedSequence.sequence = 2;
  assert.throws(() => assertCurrentBaseline(changedSequence, source, evidence));
  const missingActivity = structuredClone(snapshot);
  missingActivity.activities.pop();
  assert.throws(() => assertCurrentBaseline(missingActivity, source, evidence));
});

test("continuation reservations retain the original cumulative caps", () => {
  const counts = structuredClone(postflight.counts);
  const baseline = { names: ALLOWED_COLLECTIONS, secondaryIndexes: 54, counts, sequence: 1 };
  assertCapacity(baseline, { attempts: 6, central: 2, legacy: 2, activities: 4, counterAdvances: 2 });
  assert.throws(() => assertCapacity(baseline, { attempts: 6, central: 3, legacy: 2, activities: 4, counterAdvances: 2 }));
  assert.throws(() => assertCapacity(baseline, { attempts: 10 }));
  const afterRace = { ...baseline, counts: { ...counts, "central-leads": 2, "estate1-enquiries": 2, "crm-activities": 4 }, sequence: 2 };
  assertCapacity(afterRace, { attempts: 8, central: 1, legacy: 1, activities: 2, counterAdvances: 1 });
  const final = { ...baseline, counts: { ...counts, "central-leads": 3, "estate1-enquiries": 2, "omana-enquiries": 1, "crm-activities": 6 }, sequence: 3 };
  assert.throws(() => assertCapacity(final, { attempts: 9, central: 1 }));
});

test("a prior continuation manifest or interrupted replacement consumes the one-run gate", () => {
  assert.doesNotThrow(() => assertNoPriorContinuation([`${SOURCE_MARKER}.json`, `${SOURCE_MARKER}.postflight.json`]));
  assert.throws(() => assertNoPriorContinuation(["noida-atomic-continuation-123.json"]));
  assert.throws(() => assertNoPriorContinuation(["noida-atomic-continuation-123.json.next"]));
  const runner = readFileSync(resolve(ROOT, "scripts/noida-local-atomic-continuation-qa.mjs"), "utf8");
  assert.match(runner, /runMarker: `noida-atomic-continuation-\$\{SOURCE_MARKER\}`/);
});

test("continuation plan and execution gate stay offline without fresh approval", () => {
  const runner = resolve(ROOT, "scripts/noida-local-atomic-continuation-qa.mjs");
  const releasePlan = readFileSync(resolve(ROOT, "docs/noida-phase1-final-safe-release-prep-2026-10-21.md"), "utf8");
  assert.ok(releasePlan.includes(APPROVAL_TEXT), "Documented owner approval differs from the guarded runner");
  const plan = JSON.parse(execFileSync(process.execPath, [runner, "--plan"], { cwd: ROOT, encoding: "utf8", timeout: 10000 }));
  assert.equal(plan.status, "AWAITING_NEW_OWNER_APPROVAL");
  assert.deepEqual(plan.cases, REMAINING_CASES);
  assert.equal(plan.approval, APPROVAL_TEXT);
  assert.deepEqual(plan.additionalCaps, { central: 2, legacy: 2, activities: 4, counterAdvances: 2 });
  assert.throws(() => assertResumeGate([], {}));
  assert.throws(() => assertResumeGate(["--execute-continuation", "--approval=old"], { PATH: "/usr/bin:/bin:/usr/sbin" }));
  assert.throws(() => assertResumeGate(["--execute-continuation", `--approval=${APPROVAL_TEXT}`], { PATH: "/usr/bin:/bin:/usr/sbin", MONGODB_URI: "forbidden" }));
  assert.doesNotThrow(() => assertResumeGate(["--execute-continuation", `--approval=${APPROVAL_TEXT}`], { PATH: "/usr/bin:/bin:/usr/sbin" }));
  const denied = spawnSync(process.execPath, [runner, "--execute-continuation"], { cwd: ROOT, encoding: "utf8", timeout: 10000 });
  assert.notEqual(denied.status, 0);
  assert.match(denied.stderr, /Exact new continuation approval flag is required/);
  const noLoader = spawnSync(process.execPath, [runner, "--execute-continuation", `--approval=${APPROVAL_TEXT}`], { cwd: ROOT, env: { PATH: "/usr/bin:/bin:/usr/sbin" }, encoding: "utf8", timeout: 10000 });
  assert.notEqual(noLoader.status, 0);
  assert.match(noLoader.stderr, /pinned TypeScript loader/);
});

test("first creation and schema or seed writes are absent from continuation runner", () => {
  const runner = readFileSync(resolve(ROOT, "scripts/noida-local-atomic-continuation-qa.mjs"), "utf8");
  assert.doesNotMatch(runner, /runCase\("estate-success"/);
  assert.doesNotMatch(runner, /createCollection\(|createIndex\(|payload\.create\(|\.insertOne\(|\.insertMany\(/);
  assert.doesNotMatch(runner, /payload\.findByID\(\{ collection: "crm-activities"/);
  assertPayloadReadCollection("central-leads");
  assertPayloadReadCollection("estate1-enquiries");
  assertPayloadReadCollection("omana-enquiries");
  assert.throws(() => assertPayloadReadCollection("crm-activities"));
});
