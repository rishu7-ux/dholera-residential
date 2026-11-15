import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { closeSync, cpSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { MongoClient, BSON, ObjectId } from "mongodb";

import { assertNoInheritedServices, LOCAL_DEMO, verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";
import { browserGuardDisposition, classifyPayloadRequest, isApprovedInvalidFollowUpUpdate, isNextDevtoolsStackLookup, isPayloadRelationshipRead } from "../lib/crm/payload-request-classifier.mjs";
import { inspectLeadEditor, leadEditNavigation } from "../lib/crm/invalid-followup-browser-ui.mjs";

const TARGET = Object.freeze({ host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: "noida-crm-workflow-qa-20261019" });
const APPROVAL = "APPROVE LOCAL FOLLOW-UP BROWSER QA THIRD ATTEMPT — one synthetic Salesperson login/session and one invalid past follow-up attempt on an existing assigned lead in noida-crm-workflow-qa-20261019; no lead or activity writes";
const ROOT = process.cwd();
const EVIDENCE_ROOT = resolve(ROOT, ".artifacts/noida-local-browser-workflow-qa-20261019");
const FIXTURE_ROOT = LOCAL_DEMO.directory;
const MANIFEST_PATH = resolve(FIXTURE_ROOT, "crm-noida-workflow-70c38baa-1ca2-4a70-95f9-736adf21c84e.manifest.json");
const SECRET_PATH = resolve(FIXTURE_ROOT, "crm-workflow-browser-20261019.secrets.json");
const APP_SNAPSHOT = resolve(EVIDENCE_ROOT, `invalid-followup-${process.pid}`, "app");
const BASE_URL = "http://127.0.0.1:3101";
const CHROME_PORT = 19227;
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URI = `mongodb://${TARGET.host}:${TARGET.port}/${TARGET.database}?replicaSet=${TARGET.replicaSet}&directConnection=true`;
const args = process.argv.slice(2);
assert.deepEqual(args, ["--execute", `--approval=${APPROVAL}`], "Exact approved browser validation gate required");
assertNoInheritedServices(process.env);
assert.equal(new URL(URI).hostname, TARGET.host);
assert.equal(Number(new URL(URI).port), TARGET.port);
assert.equal(new URL(URI).pathname, `/${TARGET.database}`);
assert.equal(new URL(URI).username, "");
assert.equal(new URL(URI).password, "");

for (const [path, mode] of [[FIXTURE_ROOT, 0o700], [EVIDENCE_ROOT, 0o700], [MANIFEST_PATH, 0o600], [SECRET_PATH, 0o600]]) {
  const info = lstatSync(path);
  assert.ok(!info.isSymbolicLink() && realpathSync(path) === path, "Protected QA path must not be symlinked");
  assert.equal(info.mode & 0o777, mode, "Protected QA permissions changed");
}
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const secrets = JSON.parse(readFileSync(SECRET_PATH, "utf8"));
assert.equal(manifest.status, "verified");
assert.deepEqual(manifest.target, TARGET);
assert.equal(manifest.ids.users.length, 4);
assert.equal(manifest.ids.leads.length, 2);
assert.ok(typeof secrets.accountPassword === "string" && secrets.accountPassword.length >= 32);
assert.ok(typeof secrets.payloadSecret === "string" && secrets.payloadSecret.length >= 32);

const runEvidence = resolve(EVIDENCE_ROOT, `invalid-followup-${new Date().toISOString().replaceAll(":", "-")}-${process.pid}`);
mkdirSync(runEvidence, { recursive: false, mode: 0o700 });
assert.equal(lstatSync(runEvidence).mode & 0o777, 0o700);
const evidencePath = resolve(runEvidence, "invalid-followup-evidence.json");
const preflightPath = resolve(runEvidence, "preflight-evidence.json");
const logPath = resolve(runEvidence, "server.log");

function digest(value) {
  return createHash("sha256").update(BSON.EJSON.stringify(value, { relaxed: false })).digest("hex");
}
function protectedWrite(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  assert.equal(lstatSync(path).mode & 0o777, 0o600);
}
function safeFailure(error, stage) {
  const knownReason = [
    "Browser condition timed out",
    "Unexpected browser request blocked by local QA guard",
    "Payload date picker did not accept the invalid past date input",
    "Authorized Save control was unavailable",
    "Follow-up input could not be focused",
  ].find((prefix) => typeof error?.message === "string" && error.message.startsWith(prefix));
  return {
    status: "FAIL",
    stage,
    checkpoint: evidence.checkpoint || "unspecified",
    errorClass: error?.constructor?.name || "UnknownError",
    reason: knownReason || "Unexpected local QA failure; inspect protected diagnostics offline",
    code: Number.isSafeInteger(error?.code) ? error.code : null,
  };
}
function cloneWithoutSessionMetadata(user) {
  const clone = { ...user };
  for (const key of ["sessions", "updatedAt", "lastLogin"]) delete clone[key];
  return clone;
}

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
let chrome;
let socket;
let chromeTarget;
let server;
let logFD;
let chromeProfile;
let payloadSecret;
let accountPassword;
let evidence = { target: TARGET, approval: "verified", phase: "read-only preflight", status: "IN_PROGRESS" };
let before;
let loginUserID;
let leadID;
let originalFollowUp;
const pending = new Map();
const interceptionTasks = new Set();
const networkResponses = [];
const networkRequestMethods = new Map();
const browserErrors = [];
let nextCDPId = 0;
let loginRequests = 0;
let invalidUpdateRequests = 0;
let leadPatchIntercepted = 0;
let blockedRequest = null;
const blockedReads = [];
const relationshipReads = [];

async function snapshot() {
  const db = client.db(TARGET.database);
  assert.equal(db.databaseName, TARGET.database);
  const names = (await db.listCollections({}, { nameOnly: false }).toArray()).filter((item) => item.type === "collection").map((item) => item.name).sort();
  const indexes = {};
  for (const name of names) indexes[name] = (await db.collection(name).listIndexes().toArray()).map((item) => BSON.EJSON.serialize(item)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const documents = {};
  for (const name of names) documents[name] = await db.collection(name).find({}).sort({ _id: 1 }).toArray();
  const users = documents.users ?? [];
  const leads = documents["central-leads"] ?? [];
  const activities = documents["crm-activities"] ?? [];
  const collectionDigests = Object.fromEntries(Object.entries(documents).map(([name, docs]) => [name, digest(docs)]));
  const collectionCounts = Object.fromEntries(Object.entries(documents).map(([name, docs]) => [name, docs.length]));
  return {
    names,
    indexes,
    collectionDigests,
    collectionCounts,
    users,
    leads,
    activities,
    migrations: collectionCounts["payload-migrations"] ?? 0,
    digests: { leads: digest(leads), activities: digest(activities) },
    counts: { users: users.length, leads: leads.length, activities: activities.length },
  };
}

function assertNonSessionStateUnchanged(initial, current, authorizedUserID) {
  assert.deepEqual(current.names, initial.names, "Collection namespaces changed");
  assert.deepEqual(current.indexes, initial.indexes, "Collection indexes changed");
  assert.deepEqual(current.collectionCounts, initial.collectionCounts, "Collection document counts changed");
  assert.deepEqual(current.digests.leads, initial.digests.leads, "Lead records changed");
  assert.deepEqual(current.digests.activities, initial.digests.activities, "Activity records changed");
  for (const [name, currentDigest] of Object.entries(current.collectionDigests)) {
    if (name === "users") continue;
    assert.equal(currentDigest, initial.collectionDigests[name], `Unexpected write in ${name}`);
  }
  const normalizeUsers = (users) => users.map((user) => cloneWithoutSessionMetadata(user)).sort((a, b) => String(a._id).localeCompare(String(b._id)));
  assert.equal(digest(normalizeUsers(current.users)), digest(normalizeUsers(initial.users)), "Non-session account data changed");
  assert.ok(current.users.some((user) => String(user._id) === authorizedUserID), "Authorized QA account disappeared");
}

function copyAppSnapshot() {
  assert.ok(!existsSync(APP_SNAPSHOT), "Refusing to reuse an old code snapshot");
  const snapshotRoot = resolve(APP_SNAPSHOT, "..");
  mkdirSync(snapshotRoot, { recursive: true, mode: 0o700 });
  const names = ["app", "collections", "components", "lib", "media", "models", "public", "payload.config.ts", "payload-types.ts", "next.config.ts", "postcss.config.mjs", "package.json", "tsconfig.json"];
  for (const name of names) {
    const from = resolve(ROOT, name);
    if (existsSync(from)) {
      const to = resolve(APP_SNAPSHOT, name);
      cpSync(from, to, { recursive: true, errorOnExist: true, force: false });
    }
  }
  symlinkSync(resolve(ROOT, "node_modules"), resolve(APP_SNAPSHOT, "node_modules"), "dir");
  assert.equal(realpathSync(APP_SNAPSHOT), APP_SNAPSHOT);
}
async function cdp(method, params = {}) {
  const id = ++nextCDPId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => { pending.delete(id); rejectPromise(new Error("Browser command timed out")); }, 15000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      pending.delete(id);
      if (message.error) rejectPromise(new Error("Browser command failed"));
      else resolvePromise(message.result);
    });
  });
}
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error("Browser evaluation failed");
  return result.result?.value;
}
async function uiDiagnostic(expected) {
  try {
    return await evaluate(`(() => ({ ...(${inspectLeadEditor.toString()})(document, location.pathname), visibleControls: [...document.querySelectorAll('button,a,[role="button"],[role="tab"]')].filter(e => e.getClientRects().length).map(e => ({ tag: e.tagName.toLowerCase(), role: e.getAttribute('role') || '', label: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 50) })).filter(e => /^(Edit|Save|Cancel|Back)$/i.test(e.label)).slice(0, 12), expected: ${JSON.stringify(expected)} }))()`);
  } catch { return { expected, reason: "UI diagnostic unavailable" }; }
}
async function leadEditorState() {
  return evaluate(`(${inspectLeadEditor.toString()})(document, location.pathname)`);
}
async function waitFor(expression, predicate, timeout = 30000, expected = "browser condition") {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (blockedRequest) throw new Error("Unexpected browser request blocked by local QA guard");
    if (predicate(await evaluate(expression))) return;
    await new Promise((done) => setTimeout(done, 250));
  }
  evidence.uiDiagnostic = await uiDiagnostic(expected);
  throw new Error(`Browser condition timed out: ${expected}`);
}
async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([new Promise((done) => child.once("exit", done)), new Promise((done) => setTimeout(done, 10000))]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

try {
  evidence.phase = "read-only preflight";
  await client.connect();
  const serverInfo = await verifyLocalDemoServer(client, { requireEmpty: false });
  const db = client.db(TARGET.database);
  const [qaCollections, qaCounts, demoCounts] = await Promise.all([
    db.listCollections({}, { nameOnly: true }).toArray(),
    Promise.all(["users", "crm-offices", "crm-teams", "central-leads", "crm-activities", "payload-migrations"].map((name) => db.collection(name).countDocuments({}))),
    Promise.all(["users", "central-leads", "crm-activities", "crm-assignment-counters"].map((name) => client.db(LOCAL_DEMO.database).collection(name).countDocuments({}))),
  ]);
  assert.deepEqual(qaCounts, [4, 1, 1, 2, 17, 0], "QA database state differs from its approved baseline");
  assert.deepEqual(demoCounts, [12, 30, 60, 1], "Demo database changed from its verified baseline");
  const salespersonID = manifest.ids.users[2];
  const salesperson = await db.collection("users").findOne({ _id: new ObjectId(salespersonID) });
  const assignedLead = await db.collection("central-leads").findOne({ _id: new ObjectId(manifest.ids.leads[0]) });
  assert.equal(salesperson?.role, "salesperson");
  assert.equal(assignedLead?.assignedSalesperson?.toString?.() ?? String(assignedLead?.assignedSalesperson), salespersonID);
  loginUserID = salespersonID;
  leadID = String(assignedLead._id);
  originalFollowUp = assignedLead.nextFollowUpAt == null ? null : new Date(assignedLead.nextFollowUpAt).toISOString();
  payloadSecret = secrets.payloadSecret;
  accountPassword = secrets.accountPassword;
  before = await snapshot();
  evidence = {
    target: TARGET,
    server: serverInfo,
    accountRole: "salesperson",
    leadSlot: 1,
    preflight: { status: "PASS", counts: before.counts, migrations: before.migrations, collectionCount: qaCollections.length, demoCounts, leadDigest: before.digests.leads, activityDigest: before.digests.activities },
  };
  protectedWrite(preflightPath, {
    target: TARGET,
    status: "PASS",
    server: serverInfo,
    counts: before.counts,
    migrations: before.migrations,
    collectionCount: qaCollections.length,
    demoCounts,
    leadDigest: before.digests.leads,
    activityDigest: before.digests.activities,
  });

  evidence.phase = "server port preflight";
  let listeners = "";
  try {
    listeners = execFileSync("lsof", ["-nP", "-iTCP:3101", "-sTCP:LISTEN"], { encoding: "utf8" }).trim();
  } catch (error) {
    if (error?.status !== 1 || String(error?.stdout ?? "").trim()) throw error;
  }
  assert.equal(listeners, "", "A process already owns the local QA app port");
  evidence.phase = "isolated code snapshot";
  copyAppSnapshot();
  logFD = openSync(logPath, "wx", 0o600);
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    USER: process.env.USER,
    TMPDIR: process.env.TMPDIR,
    LANG: process.env.LANG,
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
    MONGODB_URI: URI,
    PAYLOAD_SECRET: payloadSecret,
  };
  server = spawn(process.execPath, [resolve(ROOT, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-H", "127.0.0.1", "-p", "3101"], { cwd: APP_SNAPSHOT, env, stdio: ["ignore", logFD, logFD] });
  closeSync(logFD);
  logFD = undefined;
  assert.ok(server.pid);
  evidence.phase = "server startup read-only verification";
  evidence.serverStarted = { pid: server.pid, bind: "127.0.0.1:3101", environment: "isolated TEST-only" };
  const readyBy = Date.now() + 90000;
  let ready = false;
  while (Date.now() < readyBy && server.exitCode === null) {
    try {
      const response = await fetch(`${BASE_URL}/admin/login`, { redirect: "manual" });
      if ([200, 307, 308].includes(response.status)) { ready = true; break; }
    } catch { /* server is still booting */ }
    await new Promise((done) => setTimeout(done, 500));
  }
  assert.equal(ready, true, "Loopback-only Payload server did not become ready");

  const afterStartup = await snapshot();
  assertNonSessionStateUnchanged(before, afterStartup, loginUserID);
  assert.deepEqual(afterStartup.users.map((user) => digest(user)), before.users.map((user) => digest(user)), "Startup changed account/session data before login");
  assert.deepEqual(afterStartup.digests, before.digests, "Startup changed leads or activities; stopping before login");
  assert.equal(afterStartup.migrations, before.migrations, "Startup wrote migration data; stopping before login");
  evidence.startupSchemaGuard = "PASS: collection names, indexes, migrations, leads, and activities unchanged";

  evidence.phase = "single synthetic QA login";
  chromeProfile = await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp(join(tmpdir(), "noida-followup-browser-")));
  chrome = spawn(CHROME_PATH, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--no-default-browser-check", "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${CHROME_PORT}`, `--user-data-dir=${chromeProfile}`, "about:blank"], { stdio: "ignore", env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR } });
  evidence.chromeProfile = "temporary loopback QA profile";
  let chromeReady = false;
  const chromeDeadline = Date.now() + 15000;
  while (Date.now() < chromeDeadline) {
    try { chromeReady = (await fetch(`http://127.0.0.1:${CHROME_PORT}/json/version`)).ok; } catch { /* Chrome is starting */ }
    if (chromeReady) break;
    await new Promise((done) => setTimeout(done, 200));
  }
  assert.equal(chromeReady, true, "Local Chrome did not start");
  chromeTarget = await (await fetch(`http://127.0.0.1:${CHROME_PORT}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(chromeTarget.webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.addEventListener("open", done, { once: true }); socket.addEventListener("error", fail, { once: true }); });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) pending.get(message.id)?.(message);
    if (message.method === "Runtime.exceptionThrown") browserErrors.push("JavaScript exception");
    if (message.method === "Fetch.requestPaused") {
      const task = (async () => {
        const { requestId, request } = message.params;
        let allowed = false;
        try {
          const parsed = new URL(request.url);
          const classified = classifyPayloadRequest(request.url, request.method, request.headers);
          const disposition = browserGuardDisposition(request.url, classified, BASE_URL);
          allowed = disposition === "local" && !classified.mutation;
          if (parsed.origin === BASE_URL && isPayloadRelationshipRead(classified)) {
            relationshipReads.push(classified);
            allowed = true;
          }
          if (parsed.origin === BASE_URL && classified.route === "/api/users/login" && classified.method === "POST" && loginRequests === 0) {
            loginRequests += 1;
            allowed = true;
          }
          if (parsed.origin === BASE_URL && classified.route === "/api/central-leads/:id" && classified.method === "PATCH" && invalidUpdateRequests === 0) {
            leadPatchIntercepted += 1;
            const body = request.postData ?? (await cdp("Fetch.getRequestPostData", { requestId })).postData;
            if (isApprovedInvalidFollowUpUpdate(classified, request.url, body, leadID, originalFollowUp)) {
              invalidUpdateRequests += 1;
              allowed = true;
            } else {
              blockedRequest ??= { route: "/api/central-leads/:id", method: "PATCH", effectiveMethod: "PATCH", reason: "lead update did not match exact invalid-date guard" };
            }
          }
          if (!allowed) {
            const denied = { route: classified.route.startsWith("/api/") ? classified.route : "non-API route", method: classified.method, effectiveMethod: classified.effectiveMethod };
            if (disposition === "block-read" || isNextDevtoolsStackLookup(request.url, classified, BASE_URL)) {
              if (blockedReads.length < 20) blockedReads.push({ ...denied, source: disposition === "block-read" ? "cross-origin" : "next-devtools-stack" });
            } else blockedRequest ??= denied;
          }
        } catch {
          blockedRequest ??= { route: "request interception", method: "UNKNOWN", effectiveMethod: "UNKNOWN" };
        }
        await cdp(allowed ? "Fetch.continueRequest" : "Fetch.failRequest", allowed ? { requestId } : { requestId, errorReason: "BlockedByClient" });
      })().catch(() => { blockedRequest ??= { route: "request interception", method: "UNKNOWN", effectiveMethod: "UNKNOWN" }; });
      interceptionTasks.add(task);
      void task.finally(() => interceptionTasks.delete(task));
    }
    if (message.method === "Network.requestWillBeSent") {
      const { requestId, request } = message.params;
      if (request?.url?.includes(`/api/central-leads/${leadID}`)) networkRequestMethods.set(requestId, request.method);
    }
    if (message.method === "Network.responseReceived") {
      const response = message.params?.response;
      if (response?.url?.includes(`/api/central-leads/${leadID}`)) networkResponses.push({ status: response.status, method: networkRequestMethods.get(message.params.requestId) || "UNKNOWN", url: "lead-update-route" });
      if (response?.url?.includes("/api/users/login")) evidence.loginHTTPStatus = response.status;
    }
  });
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Network.enable");
  await cdp("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  await cdp("Page.navigate", { url: `${BASE_URL}/admin/login` });
  await waitFor("document.readyState", (value) => value === "complete");
  await waitFor("!!document.querySelector('input[type=password]')", Boolean);
  const loginStarted = await evaluate(`(() => {
    const email=document.querySelector('input[type=email]');const password=document.querySelector('input[type=password]');const submit=document.querySelector('button[type=submit]');
    if(!email||!password||!submit)return false;
    const set=(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
    set(email,${JSON.stringify(`${manifest.runMarker}-3@example.invalid`)});set(password,${JSON.stringify(accountPassword)});submit.click();return true;
  })()`);
  assert.equal(loginStarted, true);
  await waitFor("location.pathname", (value) => value !== "/admin/login");
  const identity = await evaluate("fetch('/api/users/me').then(async r=>({status:r.status,body:await r.json()})).then(x=>({status:x.status,id:String(x.body.user?.id),role:x.body.user?.role}))");
  assert.equal(identity.status, 200);
  assert.equal(identity.id, loginUserID);
  assert.equal(identity.role, "salesperson");
  evidence.login = "PASS: one synthetic salesperson account";
  const afterLogin = await snapshot();
  assert.equal(afterLogin.users.length, before.users.length);
  assertNonSessionStateUnchanged(before, afterLogin, loginUserID);
  const changedUsers = afterLogin.users.filter((user, index) => digest(user) !== digest(before.users[index]));
  assert.ok(changedUsers.length <= 1, "Login changed more than the authorized account metadata");
  if (changedUsers.length) {
    assert.equal(String(changedUsers[0]._id), loginUserID, "Login changed a different account");
    assert.deepEqual(cloneWithoutSessionMetadata(changedUsers[0]), cloneWithoutSessionMetadata(before.users.find((user) => String(user._id) === loginUserID)), "Login changed non-session account data");
  }
  evidence.loginMetadataChanges = changedUsers.length ? ["authorized account session metadata"] : [];

  evidence.phase = "invalid follow-up browser validation";
  evidence.checkpoint = "navigate to existing lead detail view";
  await cdp("Page.navigate", { url: `${BASE_URL}/admin/collections/central-leads/${leadID}` });
  await waitFor("location.pathname", (value) => value.includes(`/admin/collections/central-leads/${leadID}`));
  await waitFor("document.readyState", (value) => value === "complete");
  evidence.checkpoint = "identify Payload lead edit form";
  const editorExpression = `(${inspectLeadEditor.toString()})(document, location.pathname)`;
  await waitFor(editorExpression, (state) => leadEditNavigation(state) !== "loading", 30000, "Save form or separate Edit control");
  const navigation = leadEditNavigation(await leadEditorState());
  evidence.editNavigation = navigation;
  if (navigation === "click-edit") {
    evidence.checkpoint = "open separate Payload Edit view";
    const editClicked = await evaluate(`(() => { const controls=[...document.querySelectorAll('button,a,[role="button"],[role="tab"]')].filter(e=>e.getClientRects().length && (e.getAttribute('aria-label')==='Edit'||e.textContent?.trim()==='Edit')); if(controls.length!==1)return false;controls[0].click();return true; })()`);
    assert.equal(editClicked, true, "Lead view did not expose one Edit action");
  }
  evidence.checkpoint = "wait for editable follow-up date input";
  await waitFor(editorExpression, (state) => state.fieldEditable, 30000, "editable #field-nextFollowUpAt input");
  const dateField = await evaluate(`(() => { const x=document.querySelector('#field-nextFollowUpAt input'); return x?{type:x.type||'',disabled:x.disabled,readOnly:x.readOnly}:null; })()`);
  assert.ok(dateField && !dateField.disabled && !dateField.readOnly, "Follow-up date input is not editable");
  evidence.checkpoint = "verify lead form navigation made no database writes";
  assertNonSessionStateUnchanged(before, await snapshot(), loginUserID);
  evidence.checkpoint = "submit one invalid follow-up date";
  const focused = await evaluate(`(() => { const x=document.querySelector('#field-nextFollowUpAt input'); if(!x || x.disabled || x.readOnly)return false;x.focus();x.select();return true; })()`);
  assert.equal(focused, true, "Follow-up input could not be focused");
  await cdp("Input.insertText", { text: "01/01/2026" });
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  const entered = await evaluate("document.querySelector('#field-nextFollowUpAt input')?.value === '01/01/2026'");
  assert.equal(entered, true, "Payload date picker did not accept the invalid past date input");
  const attempted = await evaluate(`(() => { const save=[...document.querySelectorAll('button')].find(e=>e.getClientRects().length && e.textContent?.trim()==='Save' && !e.disabled); if(!save)return false;save.click();return true; })()`);
  assert.equal(attempted, true, "Authorized Save control was unavailable");
  evidence.checkpoint = "wait for visible follow-up validation message";
  await waitFor("document.body.innerText.includes('New follow-up must be in the future') || document.body.innerText.includes('Invalid follow-up date and time')", Boolean, 30000, "visible invalid follow-up validation error");
  const visibleError = await evaluate(`(() => { const body=document.body.innerText; return ['New follow-up must be in the future','Invalid follow-up date and time'].find(x=>body.includes(x))||''; })()`);
  assert.ok(visibleError, "Clear visible follow-up validation message did not appear");
  evidence.checkpoint = "verify post-attempt lead and activity integrity";
  await Promise.allSettled([...interceptionTasks]);
  assert.equal(invalidUpdateRequests, 1, "Exactly one invalid lead update request required");
  const afterAttempt = await snapshot();
  assertNonSessionStateUnchanged(before, afterAttempt, loginUserID);
  assert.deepEqual(afterAttempt.counts, before.counts, "Invalid follow-up attempt changed lead/activity/account counts");
  const demoAfter = await Promise.all(["users", "central-leads", "crm-activities", "crm-assignment-counters"].map((name) => client.db(LOCAL_DEMO.database).collection(name).countDocuments({})));
  assert.deepEqual(demoAfter, [12, 30, 60, 1], "Demo database changed during browser check");
  const afterUsers = afterAttempt.users;
  for (const user of afterUsers) {
    const old = before.users.find((entry) => String(entry._id) === String(user._id));
    if (String(user._id) === loginUserID) assert.deepEqual(cloneWithoutSessionMetadata(user), cloneWithoutSessionMetadata(old));
    else assert.equal(digest(user), digest(old), "Browser check changed another account");
  }
  assert.ok(networkResponses.some((response) => response.status === 400), "Invalid follow-up did not receive HTTP 400");
  assert.equal(blockedRequest, null, "An unexpected or unsafe browser request was blocked");
  evidence.relationshipReads = relationshipReads;
  evidence.blockedReads = blockedReads;
  evidence.invalidUpdateRequests = invalidUpdateRequests;
  evidence.leadPatchIntercepted = leadPatchIntercepted;
  evidence.leadAPIResponses = networkResponses;
  evidence.browserExceptionCount = browserErrors.length;
  evidence.validation = { status: "PASS", visibleMessage: visibleError, dateInput: { type: dateField.type }, invalidDateAttempted: true, leadAPIResponses: networkResponses };
  evidence.finalIntegrity = { status: "PASS", leadsUnchanged: true, activitiesUnchanged: true, collectionNamesUnchanged: true, indexesUnchanged: true, migrationsUnchanged: true, demoCounts: demoAfter };
  evidence.status = "PASS";
  evidence.phase = "completed";
  protectedWrite(evidencePath, evidence);
  console.log(JSON.stringify({ status: "PASS", target: TARGET, login: "PASS", visibleValidation: visibleError, leadsUnchanged: true, activitiesUnchanged: true, accountWrites: evidence.loginMetadataChanges, protectedEvidence: evidencePath, evidenceMode: "0600" }));
} catch (error) {
  await Promise.allSettled([...interceptionTasks]);
  evidence.status = "FAIL";
  evidence.failure = safeFailure(error, evidence.phase);
  evidence.relationshipReads = relationshipReads;
  evidence.blockedReads = blockedReads;
  evidence.invalidUpdateRequests = invalidUpdateRequests;
  evidence.leadPatchIntercepted = leadPatchIntercepted;
  evidence.leadAPIResponses = networkResponses;
  evidence.browserExceptionCount = browserErrors.length;
  if (socket?.readyState === WebSocket.OPEN && !evidence.uiDiagnostic) {
    evidence.uiDiagnostic = await uiDiagnostic(evidence.checkpoint || evidence.phase);
  }
  if (blockedRequest) evidence.blockedRequest = blockedRequest;
  if (before) {
    try {
      const afterFailure = await snapshot();
      let nonSessionStateUnchanged = true;
      try { assertNonSessionStateUnchanged(before, afterFailure, loginUserID); } catch { nonSessionStateUnchanged = false; }
      evidence.failureIntegrity = { counts: afterFailure.counts, leadDigest: afterFailure.digests.leads, activityDigest: afterFailure.digests.activities, leadsUnchanged: afterFailure.digests.leads === before.digests.leads, activitiesUnchanged: afterFailure.digests.activities === before.digests.activities, nonSessionStateUnchanged };
    } catch { evidence.failureIntegrity = { status: "UNKNOWN" }; }
  }
  try { if (!existsSync(evidencePath)) protectedWrite(evidencePath, evidence); } catch { /* preserve primary failure */ }
  console.error(JSON.stringify({ status: "FAIL", phase: evidence.phase, errorClass: error?.constructor?.name || "UnknownError", code: Number.isSafeInteger(error?.code) ? error.code : null, evidence: evidencePath }));
  process.exitCode = 1;
} finally {
  try { socket?.close(); } catch { /* close below */ }
  if (chromeTarget?.id) { try { await fetch(`http://127.0.0.1:${CHROME_PORT}/json/close/${chromeTarget.id}`); } catch { /* Chrome termination follows */ } }
  await stopChild(chrome);
  await stopChild(server);
  if (chromeProfile) rmSync(chromeProfile, { recursive: true, force: true });
  if (logFD !== undefined) closeSync(logFD);
  await client.close();
}
