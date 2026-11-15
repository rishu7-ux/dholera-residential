import assert from "node:assert/strict";
import test from "node:test";

import { centralLeadLegacyLinkExpected, chatbotSyntheticName, sanitizedIngressHTTPDiagnostic, validateNoidaIngressResumeManifest } from "../../lib/noida-local-ingress-resume.mjs";

const target = { host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: "noida-crm-ingress-qa-20261021" };
const marker = "noida-ingress-b747931f-af85-429e-8f22-07fdb1cf4ec3";
const counts = {
  users: 12, "crm-offices": 1, "crm-teams": 1, "central-leads": 5, "crm-assignment-counters": 1,
  "crm-activities": 10, "omana-enquiries": 3, "omana-contact-messages": 1, "omana-google-ads-enquiries": 1,
  "estate1-enquiries": 0, "estate1-contact-messages": 0, "estate2-enquiries": 0, "estate2-contact-messages": 0,
  "dholera-estates-enquiries": 0, "dholera-estates-contact-messages": 0, "industrial-enquiries": 0, "industrial-contact-messages": 0,
};

function partialManifest() {
  const pending = Array.from({ length: 30 }, (_, index) => ({ index, status: "not-started" }));
  for (let index = 0; index < 5; index += 1) Object.assign(pending[index], {
    status: "verified", centralId: `central-${index}`, legacyId: `legacy-${index}`, idempotencyKey: `key-${index}`,
    assignmentSequence: index + 1, assignedSalespersonId: `sales-${index}`, email: `lead-${index}@example.invalid`,
    name: `Synthetic ${index}`, phone: "9870000000", website: "omana-projects", project: "Synthetic QA", leadType: "enquiry",
  });
  Object.assign(pending[5], { form: "ask-omana-chatbot", status: "pending", idempotencyKey: "12345678-1234-4234-8234-123456789abc" });
  return {
    schema: 1, status: "partial-failure", runMarker: marker, target,
    failure: { operation: "persist 30 approved synthetic five-website and ASK OMANA submissions", errorClass: "AssertionError" },
    expected: { users: 12, offices: 1, teams: 1, centralLeads: 30, assignmentCounters: 1, activities: 60, legacyRecords: 30 },
    ids: { office: "office", team: "team", users: Array.from({ length: 12 }, (_, i) => `user-${i}`), centralLeads: Array.from({ length: 5 }, (_, i) => `central-${i}`), legacy: Array.from({ length: 5 }, (_, i) => ({ collection: "omana-enquiries", id: `legacy-${i}` })), activities: Array.from({ length: 10 }, (_, i) => `activity-${i}`), assignmentCounter: null },
    pending, checks: { consentRejections: { status: "PASS", attempts: 42 }, concurrentDuplicateReplay: { status: "PASS" }, incrementalCounts: counts },
  };
}

test("resume gate accepts only the verified five-lead partial state and selects the remaining 25", () => {
  const plan = validateNoidaIngressResumeManifest(partialManifest(), { target, runMarker: marker });
  assert.equal(plan.remainingIndices.length, 25);
  assert.equal(plan.remainingIndices[0], 5);
  assert.equal(plan.remainingIndices.at(-1), 29);
});

test("resume gate rejects a different target, a changed existing count, or a persisted pending lead", () => {
  assert.throws(() => validateNoidaIngressResumeManifest(partialManifest(), { target: { ...target, database: "other" }, runMarker: marker }));
  const changedCounts = partialManifest();
  changedCounts.checks.incrementalCounts["central-leads"] = 6;
  assert.throws(() => validateNoidaIngressResumeManifest(changedCounts, { target, runMarker: marker }));
  const changedPending = partialManifest();
  changedPending.pending[5].status = "verified";
  assert.throws(() => validateNoidaIngressResumeManifest(changedPending, { target, runMarker: marker }));
});

test("chatbot fixture uses alphabetic characters accepted by the route name validator", () => {
  assert.equal(chatbotSyntheticName(), "Synthetic Noida Chatbot");
  assert.match(chatbotSyntheticName(), /^[\p{L}][\p{L}\p{M} .'-]*$/u);
});

test("legacy linking expectation matches the implemented Omana and other-site ingress paths", () => {
  assert.equal(centralLeadLegacyLinkExpected("omana"), false);
  for (const route of ["estate1", "estate2", "dholeraEstates", "industrial"]) assert.equal(centralLeadLegacyLinkExpected(route), true);
});

test("HTTP diagnostics retain only status and a sanitized validation code", () => {
  const result = sanitizedIngressHTTPDiagnostic({ status: 400 }, { message: "Invalid lead details", email: "person@example.invalid", password: "not-for-logs" });
  assert.deepEqual(result, { status: 400, code: "VALIDATION_REJECTED" });
  assert.deepEqual(sanitizedIngressHTTPDiagnostic({ status: 500 }, { message: "Internal error", code: "SAFE_CODE" }), { status: 500, code: "SAFE_CODE" });
});
