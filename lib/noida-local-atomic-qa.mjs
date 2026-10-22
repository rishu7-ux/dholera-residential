import assert from "node:assert/strict";
import { constants, accessSync, lstatSync, realpathSync } from "node:fs";

import { INGRESS_MONGO_COLLECTIONS, INGRESS_PAYLOAD_COLLECTIONS } from "./noida-local-ingress-qa-config.mjs";
import { assertCleanEnvironment, digest } from "./noida-local-fault-qa.mjs";

export { digest };
export const TARGET = Object.freeze({ host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: "noida-crm-atomic-ingress-qa-20261021" });
export const URI = `mongodb://${TARGET.host}:${TARGET.port}/${TARGET.database}?replicaSet=${TARGET.replicaSet}&directConnection=true`;
export const APPROVAL_TEXT = "APPROVE NOIDA LOCAL ATOMIC LEAD CONSISTENCY QA: permit one guarded run only against `127.0.0.1:27179`, replica set `noida_demo`, new absent database `noida-crm-atomic-ingress-qa-20261021`; permit at most 18 named collection namespaces, 54 secondary indexes, one synthetic office, one synthetic Salesperson without login/session, one zeroed counter, nine controlled Estate and Omana non-chat attempts as listed in `docs/noida-phase1-final-safe-release-prep-2026-10-21.md`, three central leads, three legacy leads, six created/assigned activities and three counter advances. Permit fresh read-only target preflight, target verification and read-only preflight/postflight of all other local QA databases. Preserve all records and evidence. No cleanup, Atlas, production, external requests, credential or network changes, deployment or Git push. Stop on any target, index, count, digest or outcome mismatch. The previous fault-injection approvals are consumed.";
export const CAPS = Object.freeze({ attempts: 9, central: 3, legacy: 3, activities: 6, counterAdvances: 3, namespaces: 18, secondaryIndexes: 54, offices: 1, users: 1, counters: 1 });
export const LEGACY = Object.freeze(["estate1-enquiries", "omana-enquiries"]);
export const ALLOWED_COLLECTIONS = Object.freeze([...INGRESS_MONGO_COLLECTIONS, "crm-activities", "crm-assignment-counters"].sort());
export const CASES = Object.freeze([
  "estate-success", "estate-replay", "estate-central-rejection", "estate-activity-rejection",
  "estate-race-a", "estate-race-b", "omana-legacy-rejection", "omana-success", "omana-replay",
]);

export function assertExactTarget(uri = URI) {
  assert.equal(uri, URI, "Atomic QA requires the exact loopback URI");
  const parsed = new URL(uri);
  assert.equal(parsed.protocol, "mongodb:");
  assert.equal(parsed.hostname, TARGET.host);
  assert.equal(Number(parsed.port), TARGET.port);
  assert.equal(parsed.pathname, `/${TARGET.database}`);
  assert.equal(parsed.username + parsed.password + parsed.hash, "");
  assert.deepEqual([...parsed.searchParams], [["replicaSet", TARGET.replicaSet], ["directConnection", "true"]]);
}

export function assertExecutionGate(args, env) {
  assert.deepEqual(args, ["--execute", `--approval=${APPROVAL_TEXT}`], "Exact new owner approval flag is required");
  assertCleanEnvironment(env);
  assert.equal(env.PATH, "/usr/bin:/bin:/usr/sbin", "Atomic QA requires the trusted system PATH");
  const lsof = "/usr/sbin/lsof";
  const info = lstatSync(lsof);
  assert.ok(info.isFile() && !info.isSymbolicLink() && realpathSync(lsof) === lsof, "Trusted lsof is unavailable");
  accessSync(lsof, constants.X_OK);
  assertExactTarget();
}

export function assertAbsentTarget(databaseNames, collectionNames) {
  assert.ok(!databaseNames.includes(TARGET.database), "Atomic QA target already exists; stop even if empty");
  assert.deepEqual(collectionNames, [], "Atomic QA target has unexpected collections");
}

export function assertAttemptPlan(cases = CASES) {
  assert.deepEqual(cases, CASES);
  assert.equal(cases.length, CAPS.attempts);
  assert.equal(new Set(cases).size, cases.length);
  assert.equal(ALLOWED_COLLECTIONS.length, CAPS.namespaces);
  assert.equal(new Set(ALLOWED_COLLECTIONS).size, CAPS.namespaces);
}

export function assertScope(snapshot, attempts = 0) {
  assert.ok(Number.isSafeInteger(attempts) && attempts >= 0 && attempts <= CAPS.attempts, "Attempt cap exceeded");
  const names = snapshot.names ?? [];
  assert.ok(names.length <= CAPS.namespaces && new Set(names).size === names.length, "Namespace cap exceeded");
  assert.ok(names.every((name) => ALLOWED_COLLECTIONS.includes(name)), "Unexpected target collection");
  assert.ok(Number.isSafeInteger(snapshot.secondaryIndexes ?? 0) && (snapshot.secondaryIndexes ?? 0) <= CAPS.secondaryIndexes, "Secondary-index cap exceeded");
  const counts = snapshot.counts ?? {};
  for (const [name, count] of Object.entries(counts)) {
    assert.ok(names.includes(name) && Number.isSafeInteger(count) && count >= 0, `Invalid target count for ${name}`);
  }
  for (const [name, cap] of [["crm-offices", CAPS.offices], ["users", CAPS.users], ["crm-assignment-counters", CAPS.counters], ["central-leads", CAPS.central], ["crm-activities", CAPS.activities]]) {
    assert.ok((counts[name] ?? 0) <= cap, `${name} record cap exceeded`);
  }
  assert.ok(LEGACY.reduce((sum, name) => sum + (counts[name] ?? 0), 0) <= CAPS.legacy, "Legacy lead cap exceeded");
  const populated = new Set(["crm-offices", "users", "crm-assignment-counters", "central-leads", "crm-activities", ...LEGACY]);
  for (const [name, count] of Object.entries(counts)) assert.ok(populated.has(name) || count === 0, `Unexpected document in ${name}`);
  assert.ok(Number.isSafeInteger(snapshot.sequence ?? 0) && (snapshot.sequence ?? 0) >= 0 && (snapshot.sequence ?? 0) <= CAPS.counterAdvances, "Counter advance cap exceeded");
}

export function assertCapacity(snapshot, reservation) {
  assert.ok(Number.isSafeInteger(reservation.attempts) && reservation.attempts >= 0 && reservation.attempts <= CAPS.attempts, "Attempt reservation exceeds cap");
  for (const name of ["central", "legacy", "activities", "counterAdvances"]) {
    assert.ok(Number.isSafeInteger(reservation[name] ?? 0) && (reservation[name] ?? 0) >= 0, `Invalid ${name} reservation`);
  }
  const counts = { ...snapshot.counts };
  counts["central-leads"] = (counts["central-leads"] ?? 0) + (reservation.central ?? 0);
  counts["crm-activities"] = (counts["crm-activities"] ?? 0) + (reservation.activities ?? 0);
  counts["estate1-enquiries"] = (counts["estate1-enquiries"] ?? 0) + (reservation.legacy ?? 0);
  assertScope({ ...snapshot, counts, sequence: (snapshot.sequence ?? 0) + (reservation.counterAdvances ?? 0) }, reservation.attempts);
}

export function assertRequiredIndexes(indexes) {
  const hasFullUnique = (name, fields) => (indexes[name] ?? []).some((index) => index.unique === true && !index.sparse && !index.partialFilterExpression &&
    Object.keys(index.key ?? {}).length === fields.length && fields.every((field) => index.key[field] === 1));
  assert.ok(hasFullUnique("central-leads", ["idempotencyKey"]), "Central idempotency index missing");
  assert.ok(hasFullUnique("crm-assignment-counters", ["key", "office"]), "Assignment counter index missing");
}

export function assertPayloadReadCollection(collection) {
  assert.ok(INGRESS_PAYLOAD_COLLECTIONS.includes(collection), `Payload QA read collection is not registered: ${collection}`);
}
