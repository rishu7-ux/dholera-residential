import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { closeSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BSON, MongoClient } from "mongodb";

import { assertNoInheritedServices, verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";
import { INGRESS_MONGO_COLLECTIONS } from "../lib/noida-local-ingress-qa-config.mjs";
import { classifyPayloadRequest, isNextDevtoolsStackLookup } from "../lib/crm/payload-request-classifier.mjs";
import { APPROVAL, assertExecutionGate, browserRequestDecision, CASES, SITES, TARGET, URI } from "../lib/noida-eight-site-browser-qa.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE = resolve(ROOT, "..");
const EVIDENCE_ROOT = resolve(ROOT, ".artifacts/noida-eight-site-browser-qa-20261021");
const BASELINE_PATH = resolve(ROOT, ".artifacts/noida-local-ingress-qa-20261021/noida-ingress-b747931f-af85-429e-8f22-07fdb1cf4ec3-resume-f47a0ba5-2c90-47d0-a8d6-e09d8538acd6.manifest.json");
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MASTER_PORT = 3100;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

if (process.argv.length === 2 || process.argv[2] === "--plan") {
  assert.deepEqual(process.argv.slice(2), process.argv.length === 2 ? [] : ["--plan"]);
  console.log(JSON.stringify({ status: "AWAITING_SEPARATE_APPROVAL", target: TARGET, baseline: { users: 12, centralLeads: 30, activities: 60 }, maximumAppend: { centralLeads: 8, legacyLeads: 8, activities: 16, counterAdvances: 8 }, cases: CASES, exactApproval: APPROVAL }, null, 2));
  process.exit(0);
}

assertExecutionGate(process.argv.slice(2), process.env);
assertNoInheritedServices(process.env);
assert.equal(process.cwd(), ROOT, "Run only from the Master CMS workspace");
const uri = new URL(URI);
assert.equal(uri.hostname, TARGET.host);
assert.equal(Number(uri.port), TARGET.port);
assert.equal(uri.pathname, `/${TARGET.database}`);
assert.equal(uri.searchParams.get("replicaSet"), TARGET.replicaSet);
assert.equal(uri.searchParams.get("directConnection"), "true");
assert.equal(uri.username + uri.password, "");

for (const path of [BASELINE_PATH, EVIDENCE_ROOT]) {
  if (path === EVIDENCE_ROOT && !existsSync(path)) mkdirSync(path, { mode: 0o700 });
  const info = lstatSync(path);
  assert.ok(!info.isSymbolicLink() && realpathSync(path) === path, "QA evidence path is unsafe");
  assert.equal(info.mode & 0o777, path === BASELINE_PATH ? 0o600 : 0o700);
}
const baselineManifest = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
assert.equal(baselineManifest.status, "verified-resume");
assert.deepEqual(baselineManifest.target, TARGET);
assert.deepEqual(baselineManifest.expected, { users: 12, offices: 1, teams: 1, centralLeads: 30, assignmentCounters: 1, activities: 60, legacyRecords: 30 });
assert.deepEqual(Object.fromEntries(["users", "centralLeads", "legacy", "activities"].map((key) => [key, baselineManifest.ids[key].length])), { users: 12, centralLeads: 30, legacy: 30, activities: 60 });

const resumeArg = process.argv[4];
let prior;
let priorPath;
if (resumeArg) {
  priorPath = resolve(resumeArg.slice("--resume=".length));
  assert.equal(basename(priorPath), "evidence.json");
  assert.equal(dirname(dirname(priorPath)), EVIDENCE_ROOT, "Resume evidence is outside the protected QA directory");
  const info = lstatSync(priorPath);
  assert.ok(info.isFile() && !info.isSymbolicLink() && realpathSync(priorPath) === priorPath && (info.mode & 0o777) === 0o600, "Resume evidence is unsafe");
  prior = JSON.parse(readFileSync(priorPath, "utf8"));
  assert.equal(prior.status, "FAIL_STOPPED");
  assert.deepEqual(prior.target, TARGET);
  assert.equal(prior.baselineManifest, BASELINE_PATH);
  assert.equal(prior.preflight?.status, "PASS");
  assert.match(prior.marker, /^noida-eight-browser-[0-9a-f-]{36}$/);
  assert.ok(Array.isArray(prior.cases) && prior.cases.length >= 1 && prior.cases.length < CASES.length);
  for (const [index, row] of prior.cases.entries()) {
    assert.deepEqual({ site: row.site, kind: row.kind, source: row.source, result: row.result }, { site: CASES[index].site, kind: CASES[index].kind, source: CASES[index].source, result: "PASS" });
    assert.equal(row.identity.email, `${prior.marker}.${index + 1}@example.invalid`);
    assert.ok(row.persisted?.centralId && row.persisted?.legacyId && row.persisted?.activityIds?.length === 2);
  }
}
const marker = prior?.marker ?? `noida-eight-browser-${randomUUID()}`;
const runRoot = resolve(EVIDENCE_ROOT, prior ? `${marker}-resume-${randomUUID()}` : marker);
mkdirSync(runRoot, { mode: 0o700 });
const evidencePath = resolve(runRoot, "evidence.json");
const manifest = { status: "PREFLIGHT", marker, target: TARGET, baselineManifest: BASELINE_PATH, resumedFrom: priorPath ?? null, cases: prior ? [...prior.cases] : [], limits: { central: 8, legacy: 8, activities: 16, counter: 8 } };
function save() { writeFileSync(evidencePath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 }); }
save();

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
let master;
let siteProcess;
let chrome;
let socket;
let chromeTarget;
let chromePort;
let chromeProfile;
let logFD;
let activeCase;
let activePhase = "none";
let activeIdentity;
let blockedRequest;
let browserPosts = [];
let blockedReads = [];
let blockedDiagnostics = [];
let nextID = 0;
const pending = new Map();
const secrets = Object.fromEntries(Object.values(SITES).map((site) => [site.secret, randomBytes(32).toString("hex")]));
const payloadSecret = randomBytes(32).toString("hex");

function digest(value) { return createHash("sha256").update(BSON.EJSON.stringify(value, { relaxed: false })).digest("hex"); }
async function snapshotDatabase(db) {
  const entries = await db.listCollections({}, { nameOnly: false }).toArray();
  assert.ok(entries.every((entry) => entry.type === "collection"), "Unexpected database view exists");
  const names = entries.map((entry) => entry.name).sort();
  const documents = {};
  const indexes = {};
  for (const name of names) {
    documents[name] = await db.collection(name).find({}).sort({ _id: 1 }).toArray();
    indexes[name] = await db.collection(name).listIndexes().toArray();
  }
  return { names, documents, indexes: digest(indexes), indexCount: Object.values(indexes).reduce((sum, rows) => sum + rows.length, 0), counts: Object.fromEntries(names.map((name) => [name, documents[name].length])), digests: Object.fromEntries(names.map((name) => [name, digest(documents[name])])) };
}
function baselineWithoutApprovedCases(current, completedCases) {
  if (!completedCases.length) return current;
  const documents = Object.fromEntries(Object.entries(current.documents).map(([name, rows]) => [name, [...rows]]));
  for (const row of completedCases) {
    const remove = (collection, ids) => {
      const set = new Set(ids.map(String));
      documents[collection] = documents[collection].filter((item) => !set.has(String(item._id)));
    };
    remove("central-leads", [row.persisted.centralId]);
    remove(CASES.find((item) => item.source === row.source).legacy, [row.persisted.legacyId]);
    remove("crm-activities", row.persisted.activityIds);
  }
  documents["crm-assignment-counters"] = [{ ...documents["crm-assignment-counters"][0], sequence: 30 }];
  return { ...current, documents, counts: Object.fromEntries(current.names.map((name) => [name, documents[name].length])), digests: Object.fromEntries(current.names.map((name) => [name, digest(documents[name])])) };
}
async function otherDatabaseSnapshot() {
  const names = (await client.db("admin").command({ listDatabases: 1, nameOnly: true })).databases.map((item) => item.name).filter((name) => !["admin", "config", "local", TARGET.database].includes(name)).sort();
  const snapshots = {};
  for (const name of names) {
    const state = await snapshotDatabase(client.db(name));
    snapshots[name] = { names: state.names, counts: state.counts, digests: state.digests, indexes: state.indexes };
  }
  return snapshots;
}
function assertOriginalDocuments(before, after) {
  assert.deepEqual(after.names, before.names, "Target collection inventory changed");
  assert.equal(after.indexes, before.indexes, "Target indexes changed");
  for (const name of before.names) {
    if (name === "crm-assignment-counters") continue;
    const ids = new Set(before.documents[name].map((document) => String(document._id)));
    const original = after.documents[name].filter((document) => ids.has(String(document._id)));
    assert.equal(digest(original), digest(before.documents[name]), `Existing ${name} records changed`);
  }
}
function assertExpectedDelta(before, after, completed) {
  assertOriginalDocuments(before, after);
  const expected = Object.fromEntries(before.names.map((name) => [name, before.counts[name]]));
  expected["central-leads"] += completed;
  expected["crm-activities"] += completed * 2;
  for (const testCase of CASES.slice(0, completed)) expected[testCase.legacy] += 1;
  for (const name of before.names) assert.equal(after.counts[name], expected[name], `Unexpected count in ${name}`);
  const oldCounter = before.documents["crm-assignment-counters"];
  const newCounter = after.documents["crm-assignment-counters"];
  assert.equal(oldCounter.length, 1);
  assert.equal(newCounter.length, 1);
  assert.equal(Number(newCounter[0].sequence), Number(oldCounter[0].sequence) + completed, "Assignment counter cap exceeded");
  if (!completed) assert.equal(digest(newCounter), digest(oldCounter), "Counter changed before any approved submission");
  assert.deepEqual(Object.fromEntries(Object.entries(newCounter[0]).filter(([key]) => !["sequence", "updatedAt"].includes(key))), Object.fromEntries(Object.entries(oldCounter[0]).filter(([key]) => !["sequence", "updatedAt"].includes(key))), "Counter metadata changed");
  if (completed) assert.ok(newCounter[0].updatedAt instanceof Date && newCounter[0].updatedAt >= oldCounter[0].updatedAt, "Counter update timestamp invalid");
  for (const name of before.names) {
    if (["central-leads", "crm-activities", "crm-assignment-counters", ...CASES.map((item) => item.legacy)].includes(name)) continue;
    assert.equal(after.digests[name], before.digests[name], `Unapproved ${name} write`);
  }
}
function verifyCaseDocuments(state, testCase, identity, index) {
  const central = state.documents["central-leads"].filter((item) => item.email === identity.email);
  const legacy = state.documents[testCase.legacy].filter((item) => item.email === identity.email);
  assert.equal(central.length, 1, "Exactly one central lead required");
  assert.equal(legacy.length, 1, "Exactly one matching legacy lead required");
  const lead = central[0];
  assert.equal(lead.website, SITES[testCase.site].website);
  assert.equal(lead.source, testCase.source);
  assert.equal(lead.leadType, testCase.kind);
  assert.equal(lead.consent, true);
  assert.ok(lead.consentRecordedAt instanceof Date);
  assert.equal(String(lead.assignedSalesperson), String(baselineManifest.ids.users[2 + ((30 + index) % 10)]));
  assert.equal(Number(lead.assignmentSequence), 31 + index);
  assert.equal(lead.legacyCollection, testCase.legacy);
  assert.equal(String(lead.legacyId), String(legacy[0]._id));
  assert.equal(legacy[0].source, testCase.source);
  assert.equal(legacy[0].name, identity.name);
  assert.equal(legacy[0].phone, identity.phone);
  if (testCase.kind === "contact") assert.equal(legacy[0].consent, true);
  const activities = state.documents["crm-activities"].filter((activity) => String(activity.lead) === String(lead._id));
  assert.deepEqual(activities.map((activity) => activity.event).sort(), ["assigned", "created"]);
  return { centralId: String(lead._id), legacyId: String(legacy[0]._id), activityIds: activities.map((activity) => String(activity._id)), assigneeId: String(lead.assignedSalesperson), assignmentSequence: lead.assignmentSequence, consentRecordedAt: lead.consentRecordedAt.toISOString() };
}
async function assertPortFree(port) {
  const listener = createServer();
  await new Promise((done, fail) => { listener.once("error", fail); listener.listen(port, "127.0.0.1", done); });
  await new Promise((done) => listener.close(done));
}
function copyApp(name, directory) {
  const source = resolve(WORKSPACE, directory);
  const target = resolve(runRoot, name);
  mkdirSync(target, { mode: 0o700 });
  for (const entry of ["app", "collections", "components", "lib", "media", "models", "public", "payload.config.ts", "payload-types.ts", "next.config.ts", "postcss.config.mjs", "package.json", "tsconfig.json"]) {
    const from = resolve(source, entry);
    if (existsSync(from)) cpSync(from, resolve(target, entry), { recursive: true, force: false, errorOnExist: true });
  }
  symlinkSync(resolve(source, "node_modules"), resolve(target, "node_modules"), "dir");
  assert.ok(!existsSync(resolve(target, ".env.local")) && !existsSync(resolve(target, ".env.test.local")));
  if (name === "master") {
    renameSync(resolve(target, "payload.config.ts"), resolve(target, "payload.source.config.ts"));
    writeFileSync(resolve(target, "payload.config.ts"), `// @ts-nocheck\nimport sourceConfig from "./payload.source.config";\nimport { mongooseAdapter } from "@payloadcms/db-mongodb";\nimport { buildLocalIngressQAConfig } from "./lib/noida-local-ingress-qa-config.mjs";\nconst uri = ${JSON.stringify(URI)};\nif (process.env.MONGODB_URI !== uri) throw new Error("Unexpected browser QA MongoDB target");\nexport default Promise.resolve(sourceConfig).then((source) => {\n  const scoped = buildLocalIngressQAConfig({ sourceConfig: source, uri, mongooseAdapter });\n  scoped.db = mongooseAdapter({ url: uri, connectOptions: { autoIndex: false }, ensureIndexes: false });\n  return scoped;\n});\n`, { mode: 0o600, flag: "wx" });
    // The ingress-only fixture intentionally has no blog collections. Empty
    // feeds in this temporary snapshot keep page rendering independent of
    // editorial data while the real lead forwarding routes remain intact.
    for (const route of ["estate1-blog-feed", "estate2-blog-feed", "dholera-estates-blog-feed", "industrial-blog-feed"]) {
      writeFileSync(resolve(target, "app", "api", route, "route.ts"), "export async function GET() { return Response.json({ success: true, blogs: [] }); }\n", { mode: 0o600 });
    }
  }
  return target;
}
function childEnv(extra) {
  return { PATH: process.env.PATH, HOME: process.env.HOME, USER: process.env.USER, TMPDIR: process.env.TMPDIR, LANG: process.env.LANG, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", ...extra };
}
function startNext(snapshot, port, extra, label) {
  const log = resolve(runRoot, `${label}.log`);
  logFD = openSync(log, "wx", 0o600);
  const child = spawn(process.execPath, [resolve(snapshot, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-H", "127.0.0.1", "-p", String(port)], { cwd: snapshot, env: childEnv(extra), stdio: ["ignore", logFD, logFD] });
  closeSync(logFD); logFD = undefined;
  assert.ok(child.pid);
  return child;
}
async function waitForURL(url, child) {
  const end = Date.now() + 180_000;
  while (Date.now() < end) {
    assert.equal(child.exitCode, null, "Local Next process exited during startup");
    try { const response = await fetch(url, { redirect: "manual" }); if ([200, 302, 307, 308].includes(response.status)) return; } catch { /* starting */ }
    await sleep(500);
  }
  throw new Error(`Local application did not start: ${new URL(url).pathname}`);
}
async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([new Promise((done) => child.once("exit", done)), sleep(10_000)]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}
async function cdp(method, params = {}) {
  const id = ++nextID;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((done, fail) => {
    const timer = setTimeout(() => { pending.delete(id); fail(new Error(`Browser command timed out: ${method}`)); }, 25000);
    pending.set(id, (message) => { clearTimeout(timer); pending.delete(id); if (message.error) fail(new Error(`Browser command failed: ${method}`)); else done(message.result); });
  });
}
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error("Browser evaluation failed");
  return result.result?.value;
}
async function waitFor(expression, predicate, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (blockedRequest) throw new Error(`Browser request blocked: ${blockedRequest}`);
    if (predicate(await evaluate(expression))) return;
    await sleep(250);
  }
  const state = await evaluate("({ path: location.pathname, text: document.body?.innerText?.slice(-400), forms: [...document.querySelectorAll('form')].map(f=>({visible:!!f.getClientRects().length, fields:[...f.querySelectorAll('input,select')].map(i=>({name:i.name,type:i.type}))})) })").catch(() => null);
  throw new Error(`Timed out waiting for ${label}; DOM=${JSON.stringify(state)}`);
}
async function click(selector) {
  const point = await evaluate(`(async () => {const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>n.getClientRects().length&&n.getBoundingClientRect().left<innerWidth&&n.getBoundingClientRect().right>0);if(!node)return null;node.scrollIntoView({behavior:'instant',block:'center'});await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));const r=node.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,hit:hit===node||node.contains(hit),hitTag:hit?.tagName||null,rect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right},viewport:{width:innerWidth,height:innerHeight}}})()`);
  assert.ok(point?.hit, `Visible browser control missing or obscured: ${selector}; ${JSON.stringify(point)}`);
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}
const formExpression = "[...document.querySelectorAll('form')].find(f=>{const r=f.getBoundingClientRect();return r.width>0&&r.height>0&&r.left<innerWidth&&r.right>0&&f.querySelector('input[name=name],input[autocomplete=name]')})";
async function formClick(selector) {
  const point = await evaluate(`(async () => {const form=${formExpression};const node=form?.querySelector(${JSON.stringify(selector)});if(!node)return null;node.scrollIntoView({behavior:'instant',block:'center'});await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));const r=node.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,hit:hit===node||node.contains(hit),hitTag:hit?.tagName||null,rect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right},viewport:{width:innerWidth,height:innerHeight}}})()`);
  assert.ok(point?.hit, `Active form control missing or obscured: ${selector}; ${JSON.stringify(point)}`);
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}
async function input(selector, value) {
  const found = await evaluate(`(() => {const field=(${formExpression})?.querySelector(${JSON.stringify(selector)});if(!field)return false;field.focus();field.select?.();return true})()`);
  assert.equal(found, true, `Active form field missing: ${selector}`);
  await cdp("Input.insertText", { text: value });
}
async function selectOptions() {
  const result = await evaluate(`(() => {const form=${formExpression};return [...(form?.querySelectorAll('select')||[])].map(field=>{const option=[...field.options].find(o=>!o.disabled&&o.value);if(!option)return false;Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(field,option.value);field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));return true})})()`);
  assert.ok(result.every(Boolean), "Required select has no valid option");
}
async function startChrome() {
  chromeProfile = mkdtempSync(join(tmpdir(), "noida-eight-browser-"));
  const listener = createServer();
  await new Promise((done, fail) => { listener.once("error", fail); listener.listen(0, "127.0.0.1", done); });
  chromePort = listener.address().port;
  await new Promise((done) => listener.close(done));
  chrome = spawn(CHROME_PATH, ["--headless=new", "--no-sandbox", "--disable-background-networking", "--no-first-run", "--no-default-browser-check", "--proxy-server=http://127.0.0.1:9", "--proxy-bypass-list=127.0.0.1;localhost", "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${chromePort}`, `--user-data-dir=${chromeProfile}`, "about:blank"], { stdio: "ignore", env: childEnv({}) });
  await waitForURL(`http://127.0.0.1:${chromePort}/json/version`, chrome);
  chromeTarget = await (await fetch(`http://127.0.0.1:${chromePort}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(chromeTarget.webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.addEventListener("open", done, { once: true }); socket.addEventListener("error", fail, { once: true }); });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) pending.get(message.id)?.(message);
    if (message.method === "Fetch.requestPaused") {
      const { request, requestId } = message.params;
      const priorAllowedPosts = browserPosts.filter((post) => post.allowed).length;
      const decision = activeCase && !(request.method === "POST" && priorAllowedPosts >= 1) ? browserRequestDecision(request, activeCase, activePhase, activeIdentity) : "block";
      const diagnostic = activeCase && isNextDevtoolsStackLookup(request.url, classifyPayloadRequest(request.url, request.method, request.headers), `http://127.0.0.1:${SITES[activeCase.site].port}`);
      if (request.method === "POST" && !diagnostic) browserPosts.push({ path: (() => { try { return new URL(request.url).pathname; } catch { return "invalid"; } })(), allowed: decision === "allow", requestId, idempotencyKey: Object.entries(request.headers ?? {}).find(([key]) => key.toLowerCase() === "x-idempotency-key")?.[1] ?? null });
      if (diagnostic) blockedDiagnostics.push("POST /__nextjs_original-stack-frames");
      if (decision === "block") {
        let safeTarget = "invalid URL";
        try { const url = new URL(request.url); safeTarget = `${url.protocol}//${url.host}${url.pathname}`; } catch { /* invalid URL */ }
        if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
          if (blockedReads.length < 30) blockedReads.push(`${request.method} ${safeTarget}`);
        } else if (!diagnostic && !(activePhase === "no-consent" && request.method === "POST")) {
          blockedRequest = `${request.method} ${safeTarget}`;
        }
      }
      void cdp(decision === "allow" ? "Fetch.continueRequest" : "Fetch.failRequest", decision === "allow" ? { requestId } : { requestId, errorReason: "BlockedByClient" }).catch(() => { blockedRequest = "CDP request guard failed"; });
    }
  });
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
}
async function navigate(testCase) {
  activeCase = testCase;
  activePhase = "navigation";
  blockedRequest = undefined;
  browserPosts = [];
  blockedReads = [];
  blockedDiagnostics = [];
  const site = SITES[testCase.site];
  const url = `http://127.0.0.1:${site.port}${testCase.page}`;
  const nav = await cdp("Page.navigate", { url });
  assert.ok(!nav.errorText, "Browser navigation failed");
  await waitFor("document.readyState", (value) => value === "complete", "document load", 180_000);
  await sleep(3500);
  if (testCase.site === "industrial") {
    const timedDialog = await evaluate("!!document.querySelector('[role=dialog][aria-modal=true]')");
    if (timedDialog) {
      await click('button[aria-label="Close enquiry form"]');
      await waitFor("!document.querySelector('[role=dialog][aria-modal=true]')", Boolean, "industrial timed modal close", 8000);
    }
  }
  if (testCase.kind === "enquiry") {
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(500);
    if (testCase.site === "industrial") await click('button[aria-label="Open enquiry form"]');
    else await click("button.enquiry-premium");
  } else {
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  }
  await waitFor(`!!(${formExpression})`, Boolean, "intended lead form", 15000);
  const form = await evaluate(`(() => {const f=${formExpression};return {checkbox:!!f.querySelector('input[type=checkbox]'),checked:f.querySelector('input[type=checkbox]')?.checked,inputs:[...f.querySelectorAll('input')].map(i=>({name:i.name,type:i.type}))}})()`);
  assert.equal(form.checkbox, true, "Consent checkbox missing");
  assert.equal(form.checked, false, "Consent checkbox must start unchecked");
}
async function browserCase(testCase, index) {
  activeIdentity = { name: `Synthetic Noida Browser ${index + 1}`, email: `${marker}.${index + 1}@example.invalid`, phone: `98765${String(index + 1).padStart(5, "0")}` };
  await navigate(testCase);
  await input('input[name="name"],input[autocomplete="name"]', activeIdentity.name);
  await input('input[name="email"],input[type="email"]', activeIdentity.email);
  await input('input[name="phone"],input[type="tel"]', activeIdentity.phone);
  await selectOptions();
  activePhase = "no-consent";
  await formClick('button[type="submit"],input[type="submit"]');
  const consentError = testCase.kind === "contact" ? "Please accept before submitting" : "Please agree before submitting";
  await waitFor(`(${formExpression})?.innerText.includes(${JSON.stringify(consentError)})`, Boolean, "visible missing-consent error", 8000);
  assert.equal(browserPosts.length, 0, "Missing-consent form attempted a POST");
  activePhase = "consented";
  await formClick('input[type="checkbox"]');
  await waitFor(`(${formExpression})?.querySelector('input[type="checkbox"]')?.checked`, Boolean, "affirmative consent", 3000);
  await formClick('button[type="submit"],input[type="submit"]');
  await waitFor("window.__noidaQaPosts?.some(p=>p.status===201)", Boolean, "successful website POST", 30000);
  assert.equal(browserPosts.length, 1, "Exactly one browser POST required");
  assert.equal(browserPosts[0].path, testCase.route);
  assert.equal(browserPosts[0].allowed, true);
  assert.match(browserPosts[0].idempotencyKey, /^[0-9a-f-]{36}$/i);
  const response = await evaluate("window.__noidaQaPosts?.find(p=>p.status===201)");
  assert.equal(response.path, testCase.route);
  return { ...activeIdentity, browserStatus: response.status, requestId: browserPosts[0].requestId, idempotencyKey: browserPosts[0].idempotencyKey, blockedReads, blockedDiagnostics };
}
async function installPostObserver() {
  await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {window.__noidaQaPosts=[];const original=window.fetch.bind(window);window.fetch=async(input,init={})=>{const method=String(init.method||(input instanceof Request?input.method:'GET')).toUpperCase();const response=await original(input,init);if(method==='POST')window.__noidaQaPosts.push({path:new URL(String(input instanceof Request?input.url:input),location.href).pathname,status:response.status});return response}})();` });
}

try {
  await client.connect();
  manifest.server = await verifyLocalDemoServer(client, { requireEmpty: false });
  const db = client.db(TARGET.database);
  const observed = await snapshotDatabase(db);
  const before = baselineWithoutApprovedCases(observed, prior?.cases ?? []);
  const otherBefore = await otherDatabaseSnapshot();
  if (prior) {
    assert.equal(digest(otherBefore), prior.preflight.otherDatabaseDigests, "Another database changed since the first approved case");
    for (const name of before.names) {
      if (name === "crm-assignment-counters") continue;
      assert.equal(before.digests[name], prior.preflight.digests[name], `Prior baseline ${name} changed before resume`);
    }
    assertExpectedDelta(before, observed, prior.cases.length);
    for (const [index, row] of prior.cases.entries()) {
      const persisted = verifyCaseDocuments(observed, CASES[index], row.identity, index);
      assert.equal(persisted.centralId, row.persisted.centralId);
      assert.equal(persisted.legacyId, row.persisted.legacyId);
      assert.deepEqual(persisted.activityIds.slice().sort(), row.persisted.activityIds.slice().sort());
    }
  }
  assert.equal(before.counts.users, 12);
  assert.equal(before.counts["crm-offices"], 1);
  assert.equal(before.counts["crm-teams"], 1);
  assert.equal(before.counts["central-leads"], 30);
  assert.equal(before.counts["crm-activities"], 60);
  assert.equal(before.counts["crm-assignment-counters"], 1);
  assert.deepEqual(before.names, [...INGRESS_MONGO_COLLECTIONS, "crm-activities", "crm-assignment-counters"].sort(), "QA fixture schema differs from the approved ingress-only baseline");
  // The protected schema manifest counts 16 Payload collections. The direct
  // CRM activity and assignment-counter collections each add one _id index.
  assert.equal(observed.indexCount, baselineManifest.checks.schemaIndexes.totalIndexesIncludingId + 2, "QA fixture index count changed");
  assert.equal(before.documents["crm-assignment-counters"][0].sequence, 30);
  for (const [collection, count] of Object.entries(baselineManifest.checks.incrementalCounts)) {
    assert.equal(before.counts[collection], count, `Baseline ${collection} count changed`);
  }
  for (const [key, collection] of [["office", "crm-offices"], ["team", "crm-teams"], ["assignmentCounter", "crm-assignment-counters"]]) {
    assert.equal(String(before.documents[collection][0]._id), String(baselineManifest.ids[key]), `Baseline ${collection} ID changed`);
  }
  for (const [key, collection] of [["users", "users"], ["centralLeads", "central-leads"], ["activities", "crm-activities"]]) {
    assert.deepEqual(before.documents[collection].map((document) => String(document._id)).sort(), baselineManifest.ids[key].map(String).sort(), `Baseline ${collection} IDs changed`);
  }
  for (const row of baselineManifest.ids.legacy) assert.ok(before.documents[row.collection].some((item) => String(item._id) === String(row.id)), "Baseline legacy ID missing");
  manifest.preflight = { status: "PASS", counts: before.counts, observedCounts: observed.counts, digests: before.digests, otherDatabaseDigests: digest(otherBefore) };
  save();

  for (const port of [MASTER_PORT, ...Object.values(SITES).map((site) => site.port)]) await assertPortFree(port);
  const masterSnapshot = copyApp("master", "noida-payload-3.90.2-candidate");
  master = startNext(masterSnapshot, MASTER_PORT, { MONGODB_URI: URI, PAYLOAD_SECRET: payloadSecret, ...secrets }, "master");
  await waitForURL(`http://127.0.0.1:${MASTER_PORT}/admin/login`, master);
  assertExpectedDelta(before, await snapshotDatabase(db), manifest.cases.length);
  assert.deepEqual(await otherDatabaseSnapshot(), otherBefore, "Another database changed during startup");
  await startChrome();
  await installPostObserver();

  for (const siteName of Object.keys(SITES)) {
    const site = SITES[siteName];
    const siteSnapshot = copyApp(siteName, site.directory);
    siteProcess = startNext(siteSnapshot, site.port, { PAYLOAD_CMS_URL: `http://127.0.0.1:${MASTER_PORT}`, [site.secret]: secrets[site.secret] }, siteName);
    await waitForURL(`http://127.0.0.1:${site.port}/`, siteProcess);
    for (const testCase of CASES.filter((item) => item.site === siteName && !manifest.cases.some((row) => row.source === item.source))) {
      const index = manifest.cases.length;
      const beforeCase = await snapshotDatabase(db);
      assertExpectedDelta(before, beforeCase, index);
      const identity = await browserCase(testCase, index);
      const deadline = Date.now() + 20000;
      let after;
      while (Date.now() < deadline) {
        after = await snapshotDatabase(db);
        if (after.counts["central-leads"] === 31 + index) break;
        await sleep(250);
      }
      assertExpectedDelta(before, after, index + 1);
      const persisted = verifyCaseDocuments(after, testCase, identity, index);
      assert.deepEqual(await otherDatabaseSnapshot(), otherBefore, "An unapproved database changed");
      manifest.cases.push({ site: testCase.site, kind: testCase.kind, source: testCase.source, result: "PASS", identity, persisted });
      save();
    }
    await stopChild(siteProcess);
    siteProcess = undefined;
  }
  const finalState = await snapshotDatabase(db);
  const finalOther = await otherDatabaseSnapshot();
  assertExpectedDelta(before, finalState, 8);
  assert.deepEqual(finalOther, otherBefore, "Another database changed after the final case");
  manifest.final = { counts: finalState.counts, digests: finalState.digests, otherDatabaseDigests: digest(finalOther) };
  assert.equal(manifest.cases.length, 8);
  manifest.status = "PASS";
  save();
  console.log(JSON.stringify({ status: "PASS", cases: manifest.cases.map(({ site, kind, source, result }) => ({ site, kind, source, result })), counts: manifest.final.counts, evidencePath }));
} catch (error) {
  manifest.status = "FAIL_STOPPED";
  manifest.failure = { phase: activePhase, case: activeCase?.source ?? null, message: error instanceof Error ? error.message.slice(0, 500) : "Unknown failure" };
  save();
  console.error(JSON.stringify({ status: "FAIL_STOPPED", completedCases: manifest.cases.length, evidencePath, reason: manifest.failure.message }));
  process.exitCode = 1;
} finally {
  if (siteProcess) await stopChild(siteProcess);
  if (master) await stopChild(master);
  if (socket) socket.close();
  if (chromeTarget && chromePort) await fetch(`http://127.0.0.1:${chromePort}/json/close/${chromeTarget.id}`).catch(() => undefined);
  if (chrome) await stopChild(chrome);
  if (chromeProfile) rmSync(chromeProfile, { recursive: true, force: true });
  if (logFD) closeSync(logFD);
  await client.close();
}
