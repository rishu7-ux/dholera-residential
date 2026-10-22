import assert from "node:assert/strict";
import { constants, accessSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import { ALLOWED_COLLECTIONS, CAPS, CASES, TARGET, URI, assertExactTarget, assertRequiredIndexes, assertScope, digest } from "./noida-local-atomic-qa.mjs";
import { assertCleanEnvironment } from "./noida-local-fault-qa.mjs";

export const SOURCE_MARKER = "noida-atomic-cef8e639-ebd2-412b-8bff-d0d7ff066a2c";
export const REMAINING_CASES = Object.freeze(CASES.slice(1));
export const APPROVAL_TEXT = "APPROVE NOIDA LOCAL ATOMIC LEAD CONSISTENCY QA CONTINUATION: permit one guarded continuation only against existing `127.0.0.1:27179`, replica set `noida_demo`, database `noida-crm-atomic-ingress-qa-20261021`, tied to preserved run marker `noida-atomic-cef8e639-ebd2-412b-8bff-d0d7ff066a2c`. Preserve and verify its first committed Estate lead, matching legacy lead, two activities, synthetic office and Salesperson, and counter sequence one; execute only the eight remaining cases listed in `docs/noida-phase1-final-safe-release-prep-2026-10-21.md`. Permit at most two additional central leads, two additional legacy leads, four additional created/assigned activities and two additional counter advances; cumulative maximum three central leads, three legacy leads, six activities and counter sequence three. Permit no new collection, index, office, user or counter record; retain exactly 18 named collection namespaces and 54 secondary indexes. Require a fresh read-only exact-target preflight, protected evidence and document-digest match, and read-only postflight of all other local QA databases. Preserve all existing records and evidence. No cleanup, Atlas, production, external requests, login/session/password change, credential or network change, deployment or Git push. Stop on any target, digest, index, count, link or outcome mismatch. All prior execution approvals are consumed.";

export function evidencePaths(root) {
  const base = resolve(root, ".artifacts/noida-local-atomic-qa-20261021");
  return { failure: resolve(base, `${SOURCE_MARKER}.json`), postflight: resolve(base, `${SOURCE_MARKER}.postflight.json`) };
}

export function assertNoPriorContinuation(names) {
  assert.ok(!names.some((name) => name.startsWith("noida-atomic-continuation-")), "A continuation already has evidence; a new reviewed runner and approval are required");
}

export function readProtectedEvidence(path) {
  const info = lstatSync(path);
  assert.ok(info.isFile() && !info.isSymbolicLink() && realpathSync(path) === path && (info.mode & 0o777) === 0o600, "Protected evidence file is unsafe");
  return JSON.parse(readFileSync(path, "utf8"));
}

export function assertResumeGate(args, env) {
  assert.deepEqual(args, ["--execute-continuation", `--approval=${APPROVAL_TEXT}`], "Exact new continuation approval flag is required");
  assertCleanEnvironment(env);
  assert.equal(env.PATH, "/usr/bin:/bin:/usr/sbin", "Continuation requires the trusted system PATH");
  const lsof = "/usr/sbin/lsof";
  const info = lstatSync(lsof);
  assert.ok(info.isFile() && !info.isSymbolicLink() && realpathSync(lsof) === lsof, "Trusted lsof is unavailable");
  accessSync(lsof, constants.X_OK);
  assertExactTarget(URI);
}

export function assertEvidenceBaseline(failure, postflight) {
  assert.equal(failure?.status, "FAIL_STOPPED");
  assert.equal(failure?.runMarker, SOURCE_MARKER);
  assert.deepEqual(failure?.target, TARGET);
  assert.deepEqual(failure?.limits, CAPS);
  assert.equal(failure?.preflight?.targetAbsent, true);
  assert.equal(failure?.attempts?.length, 1);
  assert.equal(failure.attempts[0].name, CASES[0]);
  assert.equal(failure.attempts[0].status, "STARTED");
  assert.ok(/^[0-9a-f]{24}$/.test(failure.attempts[0].outcome?.centralId));
  assert.ok(/^[0-9a-f]{24}$/.test(failure.attempts[0].outcome?.legacyId));
  assert.equal(failure.failure?.operation, "atomic case estate-success");
  assert.equal(postflight?.status, "PASS_READ_ONLY_POSTFLIGHT");
  assert.equal(postflight?.marker, SOURCE_MARKER);
  assert.deepEqual(postflight?.target, TARGET);
  assert.equal(postflight?.namespaces, CAPS.namespaces);
  assert.equal(postflight?.secondaryIndexes, CAPS.secondaryIndexes);
  assert.equal(postflight?.sequence, 1);
  for (const check of ["oneCommitted", "linkIntact", "activityIntact", "seedIntact", "manifestMatches"]) assert.equal(postflight[check], true);
  assert.deepEqual(postflight.audit, { centralWithoutLink: [], centralMissingLegacy: [], duplicateCentralLinks: [], orphanLegacy: [] });
  assert.equal(postflight.counts["central-leads"], 1);
  assert.equal(postflight.counts["estate1-enquiries"], 1);
  assert.equal(postflight.counts["omana-enquiries"], 0);
  assert.equal(postflight.counts["crm-activities"], 2);
  assert.equal(postflight.counts["crm-offices"], 1);
  assert.equal(postflight.counts.users, 1);
  assert.equal(postflight.counts["crm-assignment-counters"], 1);
  assert.deepEqual(Object.keys(postflight.targetDocumentDigests).sort(), ALLOWED_COLLECTIONS);
  assert.deepEqual(Object.fromEntries(Object.entries(failure.preflight.otherDatabases).map(([name, row]) => [name, row.digest])), postflight.otherDatabaseDigests);
  assert.equal(REMAINING_CASES.length, 8);
  assert.deepEqual(REMAINING_CASES, CASES.slice(1));
}

export function assertCurrentBaseline(snapshot, failure, postflight) {
  assertEvidenceBaseline(failure, postflight);
  assertScope(snapshot, 1);
  assert.deepEqual(snapshot.names, ALLOWED_COLLECTIONS);
  assert.deepEqual(snapshot.counts, postflight.counts, "Atomic target counts changed after postflight");
  assert.deepEqual(snapshot.documentDigests, postflight.targetDocumentDigests, "Atomic target documents changed after postflight");
  assert.equal(snapshot.secondaryIndexes, CAPS.secondaryIndexes);
  assertRequiredIndexes(snapshot.indexes);
  const { digest: expectedSchemaDigest, ...schema } = failure.schema;
  const indexDigests = Object.fromEntries(Object.entries(snapshot.indexes).map(([name, values]) => [name, digest(values)]));
  assert.equal(digest({ ...schema, indexDigests }), expectedSchemaDigest, "Atomic target indexes changed after initial schema setup");
  assert.deepEqual(snapshot.ids["crm-offices"], [failure.seed.officeId]);
  assert.deepEqual(snapshot.ids.users, [failure.seed.salespersonId]);
  assert.deepEqual(snapshot.ids["crm-assignment-counters"], [failure.seed.counterId]);
  assert.deepEqual(snapshot.ids["central-leads"], [failure.attempts[0].outcome.centralId]);
  assert.deepEqual(snapshot.ids["estate1-enquiries"], [failure.attempts[0].outcome.legacyId]);
  assert.equal(snapshot.sequence, 1);
  assert.equal(snapshot.leads.length, 1);
  const first = snapshot.leads[0];
  assert.equal(first.id, failure.attempts[0].outcome.centralId);
  assert.equal(first.legacyCollection, "estate1-enquiries");
  assert.equal(first.legacyId, failure.attempts[0].outcome.legacyId);
  assert.equal(first.assignedSalesperson, failure.seed.salespersonId);
  assert.equal(first.assignmentSequence, 1);
  assert.equal(first.consent, true);
  assert.match(first.key, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.deepEqual(snapshot.activities.map((row) => row.event).sort(), ["assigned", "created"]);
  assert.ok(snapshot.activities.every((row) => row.lead === first.id));
  return { firstCentralId: first.id, firstLegacyId: first.legacyId, firstKey: first.key, firstActivityIds: snapshot.activities.map((row) => row.id).sort() };
}
