import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { BSON } from "mongodb";

import { INGRESS_MONGO_COLLECTIONS } from "./noida-local-ingress-qa-config.mjs";

export const TARGET = Object.freeze({ host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: "noida-crm-fault-injection-qa-20261021" });
export const URI = `mongodb://${TARGET.host}:${TARGET.port}/${TARGET.database}?replicaSet=${TARGET.replicaSet}&directConnection=true`;
export const APPROVAL_TEXT = "APPROVE NOIDA LOCAL PARTIAL-WRITE FAULT INJECTION SECOND RUN AFTER OFFLINE ADAPTER FIX: permit one new guarded run only against `127.0.0.1:27179`, replica set `noida_demo`, new absent database `noida-crm-fault-injection-qa-20261021`; permit at most 18 named collection namespaces, 54 secondary indexes, one synthetic office, one synthetic Salesperson, one zeroed counter, 11 controlled attempts, seven central leads, seven legacy leads, fourteen activities and seven counter advances, solely for the scenarios and guards in `docs/noida-phase1-final-safe-release-prep-2026-10-21.md`; permit read-only preflight and postflight of other local QA databases; preserve all records and evidence; no cleanup, Atlas, production, external requests, login/session, deployment or Git push. Stop on any failed guard or unexpected write. The previous one-run approval is consumed.";
export const APPROVAL_FLAG = APPROVAL_TEXT;
export const CAPS = Object.freeze({ attempts: 11, central: 7, legacy: 7, activities: 14, counterAdvances: 7, namespaces: 18, secondaryIndexes: 54, offices: 1, users: 1, counters: 1 });
export const LEGACY = Object.freeze(["estate1-enquiries", "omana-enquiries"]);
export const ALLOWED_COLLECTIONS = Object.freeze([...INGRESS_MONGO_COLLECTIONS, "crm-activities", "crm-assignment-counters"].sort());
export const CASES = Object.freeze([
  "legacy-create-failure", "after-rotation-failure", "central-insert-failure", "activity-insert-failure",
  "race-attempt-a", "race-attempt-b", "omana-legacy-failure", "estate-retry", "omana-retry", "uncertain-commit", "uncertain-replay",
]);

export function assertExactTarget(uri = URI) {
  assert.equal(uri, URI, "Fault QA requires the exact loopback URI");
  const parsed = new URL(uri);
  assert.equal(parsed.protocol, "mongodb:");
  assert.equal(parsed.hostname, TARGET.host);
  assert.equal(Number(parsed.port), TARGET.port);
  assert.equal(parsed.pathname, `/${TARGET.database}`);
  assert.equal(parsed.username + parsed.password + parsed.hash, "");
  assert.deepEqual([...parsed.searchParams], [["replicaSet", TARGET.replicaSet], ["directConnection", "true"]]);
}

export function assertCleanEnvironment(env) {
  const forbidden = Object.keys(env).filter((name) => /(?:MONGO|DATABASE|ATLAS|PROD|PAYLOAD_|BLOB_|SMTP|EMAIL|OPENAI|QDRANT|WHATSAPP|TWILIO|VERCEL|NOIDA_STAGING|INGEST_SECRET|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NODE_OPTIONS|NODE_PATH|DOTENV)/i.test(name));
  assert.deepEqual(forbidden, [], `Inherited service or proxy configuration is forbidden: ${forbidden.sort().join(", ")}`);
  assert.notEqual(env.NODE_TLS_REJECT_UNAUTHORIZED, "0", "TLS verification override is forbidden");
}

export function assertExecutionGate(args, env) {
  assert.deepEqual(args, ["--execute", `--approval=${APPROVAL_FLAG}`], "Exact separate owner approval flag is required");
  assertCleanEnvironment(env);
  assertExactTarget();
}

export function assertAbsentTarget(databaseNames, collectionNames) {
  assert.ok(!databaseNames.includes(TARGET.database), "Fault QA target already exists; stop even if empty");
  assert.deepEqual(collectionNames, [], "Fault QA target has unexpected collections");
}

export function assertAttemptPlan(cases = CASES) {
  assert.equal(cases.length, CAPS.attempts);
  assert.deepEqual(cases, CASES);
  assert.equal(new Set(cases).size, cases.length);
}

export function assertScope(snapshot, { attempts = 0, baselineSequence = 0 } = {}) {
  assert.ok(Number.isSafeInteger(attempts) && attempts >= 0 && attempts <= CAPS.attempts, "Attempt cap exceeded");
  const names = snapshot.names ?? [];
  assert.ok(names.length <= CAPS.namespaces, "Namespace cap exceeded");
  assert.ok(names.every((name) => ALLOWED_COLLECTIONS.includes(name)), "Unexpected target collection");
  assert.ok((snapshot.secondaryIndexes ?? 0) <= CAPS.secondaryIndexes, "Secondary-index cap exceeded");
  const counts = snapshot.counts ?? {};
  assert.ok((counts["crm-offices"] ?? 0) <= CAPS.offices, "Office cap exceeded");
  assert.ok((counts.users ?? 0) <= CAPS.users, "User cap exceeded");
  assert.ok((counts["crm-assignment-counters"] ?? 0) <= CAPS.counters, "Counter-record cap exceeded");
  assert.ok((counts["central-leads"] ?? 0) <= CAPS.central, "Central lead cap exceeded");
  assert.ok(LEGACY.reduce((sum, name) => sum + (counts[name] ?? 0), 0) <= CAPS.legacy, "Legacy lead cap exceeded");
  assert.ok((counts["crm-activities"] ?? 0) <= CAPS.activities, "Activity cap exceeded");
  const documentCollections = new Set(["crm-offices", "users", "crm-assignment-counters", "central-leads", "crm-activities", ...LEGACY]);
  for (const [name, count] of Object.entries(counts)) {
    assert.ok(documentCollections.has(name) || count === 0, `Unexpected document in ${name}`);
  }
  assert.ok((snapshot.sequence ?? 0) - baselineSequence <= CAPS.counterAdvances, "Counter advance cap exceeded");
  assert.ok((snapshot.sequence ?? 0) >= baselineSequence, "Counter sequence went backwards");
}

export function assertCapacity(snapshot, future) {
  assert.ok(Number.isSafeInteger(future.attempts) && future.attempts >= 0 && future.attempts <= CAPS.attempts, "Attempt reservation exceeds cap");
  for (const name of ["central", "legacy", "activities", "counterAdvances"]) {
    assert.ok(Number.isSafeInteger(future[name] ?? 0) && (future[name] ?? 0) >= 0, `Invalid ${name} reservation`);
  }
  const counts = snapshot.counts ?? {};
  assertScope({ ...snapshot, counts: {
    ...counts,
    "central-leads": (counts["central-leads"] ?? 0) + (future.central ?? 0),
    "crm-activities": (counts["crm-activities"] ?? 0) + (future.activities ?? 0),
    "estate1-enquiries": (counts["estate1-enquiries"] ?? 0) + (future.legacy ?? 0),
  }, sequence: (snapshot.sequence ?? 0) + (future.counterAdvances ?? 0) }, { attempts: future.attempts });
}

export function digest(value) {
  return createHash("sha256").update(BSON.EJSON.stringify(value, { relaxed: false })).digest("hex");
}
