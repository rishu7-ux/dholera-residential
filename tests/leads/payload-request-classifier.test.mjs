import assert from "node:assert/strict";
import test from "node:test";

import { browserGuardDisposition, classifyPayloadRequest, isApprovedInvalidFollowUpUpdate, isNextDevtoolsStackLookup, isPayloadRelationshipRead } from "../../lib/crm/payload-request-classifier.mjs";

test("Payload relationship POST with method override is classified as a read", () => {
  for (const route of ["users", "crm-offices", "crm-teams"]) {
    const request = classifyPayloadRequest(
      `http://127.0.0.1:3101/api/${route}?where[id][in]=synthetic-id`,
      "POST",
      { "X-Payload-HTTP-Method-Override": "GET", "Content-Type": "application/x-www-form-urlencoded" },
    );
    assert.deepEqual(request, { route: `/api/${route}`, method: "POST", effectiveMethod: "GET", mutation: false });
    assert.equal(isPayloadRelationshipRead(request), true);
  }
});

test("ordinary collection POST remains classified as a mutation", () => {
  const request = classifyPayloadRequest("/api/crm-teams", "POST", { "Content-Type": "application/json" });
  assert.deepEqual(request, { route: "/api/crm-teams", method: "POST", effectiveMethod: "POST", mutation: true });
  assert.equal(isPayloadRelationshipRead(request), false);
});

test("GET override cannot turn other POST requests into approved reads", () => {
  for (const route of ["/api/central-leads/64f000000000000000000001", "/api/users/login", "/api/other"]) {
    const request = classifyPayloadRequest(route, "POST", { "x-payload-http-method-override": "GET" });
    assert.equal(request.effectiveMethod, "POST");
    assert.equal(request.mutation, true);
    assert.equal(isPayloadRelationshipRead(request), false);
  }
});

test("guard blocks cross-origin reads without treating them as mutations", () => {
  const base = "http://127.0.0.1:3101";
  assert.equal(browserGuardDisposition(`${base}/admin`, classifyPayloadRequest(`${base}/admin`, "GET"), base), "local");
  assert.equal(browserGuardDisposition("https://example.invalid/icon.svg", classifyPayloadRequest("https://example.invalid/icon.svg", "GET"), base), "block-read");
  assert.equal(browserGuardDisposition("ws://127.0.0.1:3101/_next/webpack-hmr", classifyPayloadRequest("ws://127.0.0.1:3101/_next/webpack-hmr", "GET"), base), "block-read");
  assert.equal(browserGuardDisposition("https://example.invalid/api/other", classifyPayloadRequest("https://example.invalid/api/other", "POST"), base), "block-mutation");
});

test("only the local Next.js stack lookup is a blocked, nonfatal diagnostic POST", () => {
  const base = "http://127.0.0.1:3101";
  const lookup = `${base}/__nextjs_original-stack-frames`;
  assert.equal(isNextDevtoolsStackLookup(lookup, classifyPayloadRequest(lookup, "POST"), base), true);
  assert.equal(isNextDevtoolsStackLookup(`${base}/admin`, classifyPayloadRequest(`${base}/admin`, "POST"), base), false);
  assert.equal(isNextDevtoolsStackLookup("https://example.invalid/__nextjs_original-stack-frames", classifyPayloadRequest(lookup, "POST"), base), false);
  assert.equal(isNextDevtoolsStackLookup(lookup, classifyPayloadRequest(lookup, "GET"), base), false);
});

test("dynamic lead paths are redacted and update methods remain mutations", () => {
  assert.deepEqual(classifyPayloadRequest("/api/central-leads/64f000000000000000000001?depth=1", "PATCH"), {
    route: "/api/central-leads/:id", method: "PATCH", effectiveMethod: "PATCH", mutation: true,
  });
});

test("browser guard permits only the exact lead's invalid past follow-up update", () => {
  const id = "64f000000000000000000001";
  const route = `/api/central-leads/${id}`;
  const request = classifyPayloadRequest(route, "PATCH");
  const body = (date) => `--boundary\r\nContent-Disposition: form-data; name="_payload"\r\n\r\n${JSON.stringify({ status: "new", nextFollowUpAt: date })}\r\n--boundary--`;
  const now = new Date("2026-10-21T00:00:00.000Z");
  assert.equal(isApprovedInvalidFollowUpUpdate(request, route, body("2026-01-01T12:00:00.000Z"), id, null, now), true);
  assert.equal(isApprovedInvalidFollowUpUpdate(request, `/api/central-leads/${"2".repeat(24)}`, body("2026-01-01T12:00:00.000Z"), id, null, now), false);
  assert.equal(isApprovedInvalidFollowUpUpdate(request, route, body("2026-11-01T12:00:00.000Z"), id, null, now), false);
  assert.equal(isApprovedInvalidFollowUpUpdate(request, route, body("2026-01-01T12:00:00.000Z"), id, "2026-01-01T12:00:00.000Z", now), false);
  assert.equal(isApprovedInvalidFollowUpUpdate(request, route, body("2026-02-30T12:00:00.000Z"), id, null, now), false);
  assert.equal(isApprovedInvalidFollowUpUpdate(request, route, "", id, null, now), false);
});

test("guard recognizes the multipart Payload date update with admin query parameters", async () => {
  const id = "64f000000000000000000001";
  const url = `http://127.0.0.1:3101/api/central-leads/${id}?depth=0&fallback-locale=null`;
  const form = new FormData();
  form.append("_payload", JSON.stringify({ status: "new", nextFollowUpAt: "2026-01-01T12:00:00.000Z" }));
  const body = await new Request(url, { method: "PATCH", body: form }).text();
  assert.equal(isApprovedInvalidFollowUpUpdate(classifyPayloadRequest(url, "PATCH"), url, body, id, null, new Date("2026-10-21T00:00:00.000Z")), true);
});
