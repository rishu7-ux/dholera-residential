import assert from "node:assert/strict";

const EXPECTED_PARTIAL_COUNTS = Object.freeze({
  users: 12,
  "crm-offices": 1,
  "crm-teams": 1,
  "central-leads": 5,
  "crm-assignment-counters": 1,
  "crm-activities": 10,
  "omana-enquiries": 3,
  "omana-contact-messages": 1,
  "omana-google-ads-enquiries": 1,
  "estate1-enquiries": 0,
  "estate1-contact-messages": 0,
  "estate2-enquiries": 0,
  "estate2-contact-messages": 0,
  "dholera-estates-enquiries": 0,
  "dholera-estates-contact-messages": 0,
  "industrial-enquiries": 0,
  "industrial-contact-messages": 0,
});

export const NOIDA_INGRESS_RESUME_SCOPE = Object.freeze({
  remainingSubmissions: 25,
  finalCentralLeads: 30,
  finalLegacyRecords: 30,
  finalActivities: 60,
  finalAssignmentSequence: 30,
});

export function validateNoidaIngressResumeManifest(manifest, { target, runMarker }) {
  assert.equal(manifest?.schema, 1, "unsupported partial-run manifest schema");
  assert.equal(manifest.status, "partial-failure", "resume requires the preserved partial-failure manifest");
  assert.equal(manifest.runMarker, runMarker, "unexpected run marker");
  assert.deepEqual(manifest.target, target, "unexpected partial-run database target");
  assert.equal(manifest.failure?.operation, "persist 30 approved synthetic five-website and ASK OMANA submissions");
  assert.equal(manifest.failure?.errorClass, "AssertionError");
  assert.deepEqual(manifest.expected, {
    users: 12,
    offices: 1,
    teams: 1,
    centralLeads: 30,
    assignmentCounters: 1,
    activities: 60,
    legacyRecords: 30,
  });
  assert.ok(manifest.ids?.office && manifest.ids?.team);
  assert.equal(manifest.ids.users.length, 12);
  assert.equal(manifest.ids.centralLeads.length, 5);
  assert.equal(manifest.ids.legacy.length, 5);
  assert.equal(manifest.ids.activities.length, 10);
  assert.equal(manifest.ids.assignmentCounter, null, "counter ID is read from the verified database during resume preflight");

  assert.equal(manifest.pending.length, 30);
  for (let index = 0; index < 5; index += 1) {
    assert.equal(manifest.pending[index].index, index);
    assert.equal(manifest.pending[index].status, "verified");
    for (const key of ["centralId", "legacyId", "idempotencyKey", "assignmentSequence", "assignedSalespersonId", "email", "name", "phone", "website", "project", "leadType"]) {
      assert.ok(manifest.pending[index][key] !== undefined && manifest.pending[index][key] !== null, `verified row ${index} is missing ${key}`);
    }
  }
  assert.equal(manifest.pending[5].index, 5);
  assert.equal(manifest.pending[5].form, "ask-omana-chatbot");
  assert.equal(manifest.pending[5].status, "pending");
  assert.match(manifest.pending[5].idempotencyKey, /^[0-9a-f-]{36}$/i);
  for (let index = 6; index < 30; index += 1) {
    assert.equal(manifest.pending[index].index, index);
    assert.equal(manifest.pending[index].status, "not-started");
    assert.equal(manifest.pending[index].centralId, undefined);
    assert.equal(manifest.pending[index].legacyId, undefined);
  }
  assert.equal(manifest.checks?.consentRejections?.status, "PASS");
  assert.equal(manifest.checks?.consentRejections?.attempts, 42);
  assert.equal(manifest.checks?.concurrentDuplicateReplay?.status, "PASS");
  assert.deepEqual(manifest.checks?.incrementalCounts, EXPECTED_PARTIAL_COUNTS);
  return { remainingIndices: Array.from({ length: 25 }, (_, offset) => offset + 5), expectedCurrentCounts: EXPECTED_PARTIAL_COUNTS };
}

export function chatbotSyntheticName() {
  return "Synthetic Noida Chatbot";
}

export function centralLeadLegacyLinkExpected(route) {
  return route !== "omana";
}

export function sanitizedIngressHTTPDiagnostic(response, body) {
  const code = typeof body?.code === "string" && /^[A-Z0-9_]{1,48}$/.test(body.code)
    ? body.code
    : response.status === 400 && body?.message === "Invalid lead details" ? "VALIDATION_REJECTED"
      : response.status === 401 ? "UNAUTHORIZED"
        : response.status === 413 ? "REQUEST_TOO_LARGE"
          : response.status >= 500 ? "SERVER_ERROR"
            : response.status === 201 ? "CREATED"
              : response.status === 200 ? "DUPLICATE_OR_OK" : "HTTP_REJECTED";
  return { status: response.status, code };
}
