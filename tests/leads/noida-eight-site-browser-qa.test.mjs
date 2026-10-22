import assert from "node:assert/strict";
import test from "node:test";

import { APPROVAL, assertExecutionGate, browserRequestDecision, CASES, SITES, TARGET, URI } from "../../lib/noida-eight-site-browser-qa.mjs";

test("scope is exactly eight cases on the approved local target", () => {
  assert.deepEqual(TARGET, { host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: "noida-crm-ingress-qa-20261021" });
  assert.equal(URI, "mongodb://127.0.0.1:27179/noida-crm-ingress-qa-20261021?replicaSet=noida_demo&directConnection=true");
  assert.equal(CASES.length, 8);
  for (const site of Object.keys(SITES)) assert.deepEqual(CASES.filter((item) => item.site === site).map((item) => item.kind), ["contact", "enquiry"]);
  assert.equal(new Set(CASES.map((item) => item.source)).size, 8);
  assert.ok(CASES.every((item) => !item.source.includes("omana")));
  assert.equal(CASES.find((item) => item.site === "industrial" && item.kind === "enquiry").source, "industrial-side-enquiry-form");
});

test("execution requires exact separate approval and clean inherited environment", () => {
  assert.throws(() => assertExecutionGate([], {}));
  assert.throws(() => assertExecutionGate(["--execute", "--approval=APPROVED"], {}));
  assert.throws(() => assertExecutionGate(["--execute", `--approval=${APPROVAL}`], { MONGODB_URI: "mongodb+srv://redacted" }));
  assert.throws(() => assertExecutionGate(["--execute", `--approval=${APPROVAL}`], { HTTPS_PROXY: "http://proxy.invalid" }));
  assert.doesNotThrow(() => assertExecutionGate(["--execute", `--approval=${APPROVAL}`], { PATH: "/usr/bin" }));
  assert.doesNotThrow(() => assertExecutionGate(["--execute", `--approval=${APPROVAL}`, "--resume=/protected/evidence.json"], { PATH: "/usr/bin" }));
  assert.throws(() => assertExecutionGate(["--execute", `--approval=${APPROVAL}`, "--other=unsafe"], {}));
});

test("browser guard blocks every unapproved mutation and external URL", () => {
  for (const testCase of CASES) {
    const site = SITES[testCase.site];
    const identity = { name: "Synthetic QA 1", email: "noida-browser.1@example.invalid", phone: "9876500001" };
    const body = { ...identity, consent: true, type: testCase.kind, source: testCase.site === "estate1" && testCase.kind === "enquiry" ? "side-enquiry" : testCase.source };
    const request = { url: `http://127.0.0.1:${site.port}${testCase.route}`, method: "POST", postData: JSON.stringify(body), headers: { "x-idempotency-key": "123e4567-e89b-42d3-a456-426614174000" } };
    assert.equal(browserRequestDecision(request, testCase, "no-consent", identity), "block");
    assert.equal(browserRequestDecision(request, testCase, "consented", identity), "allow");
    assert.equal(browserRequestDecision({ ...request, url: "https://example.invalid/api/leads" }, testCase, "consented", identity), "block");
    assert.equal(browserRequestDecision({ ...request, url: `http://127.0.0.1:${site.port}/api/other` }, testCase, "consented", identity), "block");
    assert.equal(browserRequestDecision({ ...request, method: "PUT" }, testCase, "consented", identity), "block");
    assert.equal(browserRequestDecision({ ...request, postData: JSON.stringify({ ...body, consent: false }) }, testCase, "consented", identity), "block");
    assert.equal(browserRequestDecision({ ...request, postData: JSON.stringify({ ...body, email: "other@example.invalid" }) }, testCase, "consented", identity), "block");
    assert.equal(browserRequestDecision({ ...request, headers: {} }, testCase, "consented", identity), "block");
  }
});
