import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";

const workspace = resolve(import.meta.dirname, "../..");
const sites = [
  { name: "omana", directory: "omana-projects", port: 3205, secret: "OMANA_INGEST_SECRET" },
  { name: "estate1", directory: "dholera-estate-1", port: 3201, secret: "ESTATE1_INGEST_SECRET" },
  { name: "estate2", directory: "dholera-estate-2", port: 3202, secret: "ESTATE2_INGEST_SECRET" },
  { name: "estates", directory: "dholeraestates", port: 3203, secret: "DHOLERA_ESTATES_INGEST_SECRET" },
  { name: "industrial", directory: "dholeraindustrial", port: 3204, secret: "INDUSTRIAL_INGEST_SECRET" },
];
const mockPort = 3210;
const captures = [];
const mock = createServer(async (request, response) => {
  if (request.method !== "POST") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('{"docs":[],"totalDocs":0}');
    return;
  }
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16000) { response.writeHead(413); response.end(); return; }
  }
  const data = JSON.parse(body);
  captures.push({ path: request.url, authorized: request.headers.authorization === "Bearer offline-only", data });
  response.writeHead(201, { "Content-Type": "application/json" });
  response.end('{"success":true,"duplicate":false}');
});
const children = [];
const base = (site) => `http://127.0.0.1:${site.port}`;
async function waitReady(site) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${base(site)}/`, { signal: AbortSignal.timeout(3000) })).ok) return; } catch { /* compiling */ }
    await new Promise((done) => setTimeout(done, 400));
  }
  throw new Error(`${site.name} local server did not become ready`);
}
async function post(site, path, payload, expectedSource, expectedType) {
  const count = captures.length;
  const response = await fetch(`${base(site)}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-idempotency-key": crypto.randomUUID() }, body: JSON.stringify(payload),
  });
  assert.equal(response.status, 201, `${site.name} accepted the synthetic request`);
  assert.equal(captures.length, count + 1, `${site.name} forwarded exactly once`);
  const capture = captures.at(-1);
  assert.equal(capture.authorized, true);
  assert.equal(capture.data.source, expectedSource);
  assert.equal(capture.data.type, expectedType);
  assert.equal(capture.data.consent, true);
  assert.ok(capture.path?.startsWith("/api/"));
}
async function rejectNoConsent(site, path, payload) {
  const count = captures.length;
  for (const consent of [false, undefined]) {
    const body = { ...payload, consent };
    const response = await fetch(`${base(site)}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal(response.status, 400, `${site.name} rejects absent or false consent`);
    assert.equal(captures.length, count, "rejected request is not forwarded");
  }
}

try {
  await new Promise((done, fail) => { mock.once("error", fail); mock.listen(mockPort, "127.0.0.1", done); });
  for (const site of sites) {
    const directory = resolve(workspace, site.directory);
    const child = spawn(process.execPath, [resolve(directory, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(site.port)], {
      cwd: directory, stdio: "ignore", env: {
        PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
        NEXT_TELEMETRY_DISABLED: "1", PAYLOAD_CMS_URL: `http://127.0.0.1:${mockPort}`,
        [site.secret]: "offline-only",
      },
    });
    children.push(child);
  }
  await Promise.all(sites.map(waitReady));
  const [omana, estate1, estate2, estates, industrial] = sites;
  const identity = { name: "Synthetic QA Person", email: "noida-mapping@example.invalid", phone: "9876543210" };
  const omanaEnquiry = { ...identity, page: "/", project: "", source: "omana-global-drawer", consent: true };
  await post(omana, "/api/enquiries", omanaEnquiry, "omana-global-drawer", "enquiry");
  await rejectNoConsent(omana, "/api/enquiries", omanaEnquiry);
  const chat = { name: identity.name, phone: identity.phone, requirement: "Synthetic residential plot enquiry", page: "/", consent: true, idempotencyKey: crypto.randomUUID() };
  await post(omana, "/api/chat-leads", chat, "ai-chatbot", "ai-chatbot-enquiry");
  assert.equal(captures.at(-1).data.idempotencyKey, chat.idempotencyKey);
  await rejectNoConsent(omana, "/api/chat-leads", chat);
  const omanaContact = { ...identity, project: "", consent: true };
  await post(omana, "/api/contact-messages", omanaContact, "omana-contact-page", "contact");
  await rejectNoConsent(omana, "/api/contact-messages", omanaContact);

  for (const [source, expected] of [["popup", "estate1-popup-form"], ["side-enquiry", "estate1-side-enquiry-form"]]) {
    const data = { ...identity, type: "enquiry", source, message: "Synthetic QA only", consent: true };
    await post(estate1, "/api/leads", data, expected, "enquiry");
    await rejectNoConsent(estate1, "/api/leads", data);
  }
  const estate1Contact = { ...identity, type: "contact", budget: "20-50-lakhs", comments: "Synthetic QA only", consent: true };
  await post(estate1, "/api/leads", estate1Contact, "estate1-contact-us-page", "contact");
  await rejectNoConsent(estate1, "/api/leads", estate1Contact);
  for (const source of ["estate2-popup-form", "estate2-side-enquiry-form"]) {
    const data = { ...identity, source, property: "Synthetic QA property", message: "", consent: true };
    await post(estate2, "/api/enquiries", data, source, "enquiry");
    await rejectNoConsent(estate2, "/api/enquiries", data);
  }
  const estate2Contact = { ...identity, propertyType: "dholera-estate-2", budget: "20-50-lakhs", comments: "Synthetic QA only", consent: true };
  await post(estate2, "/api/contact-messages", estate2Contact, "estate2-contact-us-page", "contact");
  await rejectNoConsent(estate2, "/api/contact-messages", estate2Contact);
  for (const source of ["dholeraestates-popup-form", "dholeraestates-side-enquiry-form", "dholeraestates-website"]) {
    const data = { ...identity, source, property: "Synthetic QA property", message: "", consent: true };
    await post(estates, "/api/enquiries", data, source, "enquiry");
    await rejectNoConsent(estates, "/api/enquiries", data);
  }
  const estatesContact = { ...identity, propertyType: "dholera-estates", budget: "20-50-lakhs", comments: "Synthetic QA only", consent: true };
  await post(estates, "/api/contact-messages", estatesContact, "dholeraestates-contact-us-page", "contact");
  await rejectNoConsent(estates, "/api/contact-messages", estatesContact);
  for (const source of ["industrial-popup-form", "industrial-side-enquiry-form", "industrial-property-card"]) {
    const data = { ...identity, type: "enquiry", source, property: "Synthetic QA property", message: "", consent: true };
    await post(industrial, "/api/industrial-leads", data, source, "enquiry");
    await rejectNoConsent(industrial, "/api/industrial-leads", data);
  }
  const industrialContact = { ...identity, type: "contact", propertyType: "industrial-plot", budget: "25-50-lakhs", comments: "Synthetic QA only", consent: true, source: "industrial-contact-us-page" };
  await post(industrial, "/api/industrial-leads", industrialContact, "industrial-contact-us-page", "contact");
  await rejectNoConsent(industrial, "/api/industrial-leads", industrialContact);
  assert.equal(captures.length, 17);
  console.log(JSON.stringify({ status: "PASS", mockOnly: true, siteCount: sites.length, forwardedCases: captures.length, consentDenials: 34, masterPaths: [...new Set(captures.map((item) => item.path))].sort() }));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", errorClass: error?.constructor?.name || "UnknownError", message: String(error?.message || "mock test failed").slice(0, 180), forwardedCases: captures.length }));
  process.exitCode = 1;
} finally {
  for (const child of children) child.kill("SIGTERM");
  await Promise.all(children.map((child) => child.exitCode === null ? new Promise((done) => child.once("exit", done)) : undefined));
  await new Promise((done) => mock.close(done));
}
