import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { MongoClient } from "mongodb";

import { assertNoInheritedServices, LOCAL_DEMO, verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";

const root = resolve(import.meta.dirname, "..");
const database = "noida-crm-workflow-qa-20261019";
const uri = `mongodb://127.0.0.1:27179/${database}?replicaSet=noida_demo&directConnection=true`;
const baseURL = "http://127.0.0.1:3101";
const evidence = resolve(root, ".artifacts/noida-local-browser-workflow-qa-20261019");
const manifestPath = resolve(LOCAL_DEMO.directory, "crm-noida-workflow-70c38baa-1ca2-4a70-95f9-736adf21c84e.manifest.json");
const secretPath = resolve(LOCAL_DEMO.directory, "crm-workflow-browser-20261019.secrets.json");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chromePort = 19226;
if (process.argv.slice(2).join("|") !== "--execute|--approval=APPROVE LOCAL CRM BROWSER AND HTTP WORKFLOW QA") throw new Error("Exact browser and HTTP QA execution and approval flags are required");
assertNoInheritedServices(process.env);
for (const path of [manifestPath, secretPath]) {
  const info = lstatSync(path);
  assert.ok(info.isFile() && !info.isSymbolicLink() && realpathSync(path) === path && (info.mode & 0o777) === 0o600);
}
assert.equal(lstatSync(evidence).mode & 0o077, 0);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const secrets = JSON.parse(readFileSync(secretPath, "utf8"));
assert.equal(manifest.status, "verified");
assert.deepEqual(manifest.target, { host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database });
assert.equal(manifest.ids.users.length, 4);
assert.equal(manifest.ids.leads.length, 2);
assert.ok(secrets.accountPassword && secrets.payloadSecret);
const [leadA, leadB] = manifest.ids.leads;
const [adminID, leaderID, salesperson1ID, salesperson2ID] = manifest.ids.users;

const mongo = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
let beforeDemo;
try {
  await mongo.connect();
  await verifyLocalDemoServer(mongo, { requireEmpty: false });
  const qa = mongo.db(database);
  assert.equal(await qa.collection("users").countDocuments({}), 4);
  assert.equal(await qa.collection("central-leads").countDocuments({}), 2);
  assert.equal(await qa.collection("crm-activities").countDocuments({}), 9, "Admin browser edit must be the only new activity before this run");
  const first = await qa.collection("central-leads").findOne({ email: `${manifest.runMarker}-lead-1@example.invalid` });
  assert.equal(String(first?._id), leadA);
  assert.equal(first?.notes, "Synthetic browser Admin QA note");
  beforeDemo = await Promise.all(["users", "central-leads", "crm-activities", "crm-assignment-counters"].map((name) => mongo.db(LOCAL_DEMO.database).collection(name).countDocuments({})));
  assert.deepEqual(beforeDemo, [12, 30, 60, 1]);
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", stage: "read-only preflight", errorClass: error?.constructor?.name || "UnknownError" }));
  await mongo.close();
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), "noida-workflow-browser-qa-"));
const chrome = spawn(chromePath, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking", "--no-first-run",
  "--no-default-browser-check", "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${chromePort}`,
  `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR } });
let socket;
let targetID;
let nextID = 0;
let stage = "Chrome startup";
const pending = new Map();
const browserErrors = [];
const results = [];

async function command(method, params = {}) {
  const id = ++nextID;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((done, fail) => {
    const timer = setTimeout(() => { pending.delete(id); fail(new Error(`Browser command timeout: ${method}`)); }, 20000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      pending.delete(id);
      if (message.error) fail(new Error(message.error.message));
      else done(message.result);
    });
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error("Browser JavaScript evaluation failed");
  return result.result?.value;
}
async function waitFor(expression, predicate, label) {
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    if (predicate(await evaluate(expression))) return;
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`Browser timeout: ${label}`);
}
async function navigate(path) {
  await command("Page.navigate", { url: `${baseURL}${path}` });
  await waitFor("document.readyState", (value) => value === "complete", path);
}
async function login(index, expectedID) {
  await navigate("/admin/login");
  await waitFor("!!document.querySelector('input[type=password]')", Boolean, "login form");
  assert.equal(await evaluate(`(() => {
    const email=document.querySelector('input[type=email]');const password=document.querySelector('input[type=password]');const submit=document.querySelector('button[type=submit]');
    if(!email||!password||!submit)return false;
    const set=(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
    set(email,${JSON.stringify(`${manifest.runMarker}-${index + 1}@example.invalid`)});set(password,${JSON.stringify(secrets.accountPassword)});submit.click();return true;
  })()`), true);
  await waitFor("location.pathname", (value) => value !== "/admin/login", "authenticated login");
  const identity = await evaluate("fetch('/api/users/me').then(async r=>({status:r.status,body:await r.json()})).then(x=>({status:x.status,id:String(x.body.user?.id),role:x.body.user?.role}))");
  assert.equal(identity.status, 200);
  assert.equal(identity.id, expectedID);
  return identity.role;
}
async function logout() {
  const code = await evaluate("fetch('/api/users/logout',{method:'POST'}).then(r=>r.status)");
  assert.equal(code, 200);
}
async function getLeads() {
  return evaluate("fetch('/api/central-leads?limit=10&depth=0').then(async r=>({status:r.status,body:await r.json()})).then(x=>({status:x.status,total:x.body.totalDocs,docs:x.body.docs?.map(d=>({id:String(d.id),status:d.status,notes:d.notes||'',nextFollowUpAt:d.nextFollowUpAt||null,assignedSalesperson:String(d.assignedSalesperson?.id??d.assignedSalesperson)}))}))");
}
async function patchLead(id, data) {
  return evaluate(`fetch('/api/central-leads/${id}',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(data)})}).then(async r=>({status:r.status,body:await r.json()})).then(x=>({status:x.status,id:String(x.body.doc?.id??x.body.id??''),error:x.body.errors?.[0]?.message||x.body.message||''}))`);
}
async function checkReports(label, expectedIDs) {
  const leads = await getLeads();
  assert.equal(leads.status, 200);
  assert.equal(leads.total, expectedIDs.length);
  assert.deepEqual(leads.docs.map((row) => row.id).sort(), [...expectedIDs].sort());
  const json = await evaluate("fetch('/api/crm/reports?period=all&format=json').then(async r=>({status:r.status,body:await r.json()})).then(x=>({status:x.status,total:x.body.summary?.total,ids:x.body.table?.rows?.map(row=>row[0]),statuses:x.body.summary?.statuses,followUps:x.body.summary?.followUps}))");
  assert.equal(json.status, 200);
  assert.equal(json.total, expectedIDs.length);
  assert.deepEqual(json.ids.sort(), [...expectedIDs].sort());
  for (const row of json.statuses) assert.equal(row.count, leads.docs.filter((item) => item.status === row.label).length, `${label} status ${row.label}`);
  assert.equal(Object.values(json.followUps).reduce((total, value) => total + value, 0), expectedIDs.length);
  for (const format of ["csv", "xlsx", "pdf"]) {
    const exported = await evaluate(`fetch('/api/crm/reports?period=all&format=${format}').then(async r=>{const bytes=new Uint8Array(await r.arrayBuffer());const text=new TextDecoder().decode(bytes);return {status:r.status,type:r.headers.get('content-type'),download:r.headers.get('content-disposition'),prefix:[...bytes.slice(0,4)],size:bytes.length,ids:${JSON.stringify([leadA, leadB])}.filter(id=>text.includes(id))}})`);
    assert.equal(exported.status, 200, `${label} ${format} status`);
    assert.ok(exported.download?.includes(`.${format}`));
    assert.ok(exported.size > 100);
    assert.deepEqual(exported.ids.sort(), [...expectedIDs].sort(), `${label} ${format} authorized content`);
    if (format === "xlsx") assert.deepEqual(exported.prefix.slice(0, 2), [80, 75]);
    if (format === "pdf") assert.deepEqual(exported.prefix, [37, 80, 68, 70]);
  }
  return { label, visibleLeads: leads.total, json: "PASS", csv: "PASS", xlsx: "PASS", pdf: "PASS" };
}
async function screenshot(name) {
  const shot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const path = resolve(evidence, `${name}.png`);
  writeFileSync(path, Buffer.from(shot.data, "base64"), { flag: "w", mode: 0o600 });
  return path;
}

try {
  const deadline = Date.now() + 15000;
  let ready = false;
  while (Date.now() < deadline) {
    try { ready = (await fetch(`http://127.0.0.1:${chromePort}/json/version`)).ok; } catch { /* Chrome is starting. */ }
    if (ready) break;
    await new Promise((done) => setTimeout(done, 200));
  }
  assert.equal(ready, true);
  const target = await (await fetch(`http://127.0.0.1:${chromePort}/json/new?about:blank`, { method: "PUT" })).json();
  targetID = target.id;
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.addEventListener("open", done, { once: true }); socket.addEventListener("error", fail, { once: true }); });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) pending.get(message.id)?.(message);
    if (message.method === "Runtime.exceptionThrown") browserErrors.push("JavaScript exception");
  });
  await command("Page.enable");
  await command("Runtime.enable");

  stage = "Admin login and exports";
  assert.equal(await login(0, adminID), "super-admin");
  results.push(await checkReports("Admin", [leadA, leadB]));
  await logout();

  stage = "Team Leader login, update and exports";
  assert.equal(await login(1, leaderID), "team-leader");
  const leaderUpdate = await patchLead(leadB, { status: "follow-up", notes: "Synthetic HTTP Team Leader QA note", nextFollowUpAt: new Date(Date.now() + 4 * 86_400_000).toISOString() });
  assert.equal(leaderUpdate.status, 200);
  results.push(await checkReports("Team Leader", [leadA, leadB]));
  await logout();

  stage = "Salesperson 1 login, update, denial and exports";
  assert.equal(await login(2, salesperson1ID), "salesperson");
  const person1Update = await patchLead(leadA, { status: "follow-up", notes: "Synthetic HTTP Salesperson 1 QA note", nextFollowUpAt: new Date(Date.now() + 5 * 86_400_000).toISOString() });
  assert.equal(person1Update.status, 200);
  const denied1 = await patchLead(leadB, { status: "lost" });
  assert.ok([403, 404].includes(denied1.status), "Cross-assignment update denied");
  assert.equal(await evaluate(`fetch('/api/crm/reports?period=all&salesperson=${salesperson2ID}').then(r=>r.status)`), 403);
  results.push(await checkReports("Salesperson 1", [leadA]));
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate(`/admin/collections/central-leads/${leadA}`);
  await waitFor("!!document.querySelector('textarea[name=notes]')", Boolean, "mobile assigned lead edit form");
  const mobile = await evaluate("({viewport:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,notesVisible:!!document.querySelector('textarea[name=notes]'),saveVisible:[...document.querySelectorAll('button')].some(x=>x.textContent?.trim()==='Save')})");
  assert.ok(mobile.notesVisible && mobile.saveVisible);
  const mobileScreenshot = await screenshot("salesperson-1-mobile-lead-edit");
  await command("Emulation.clearDeviceMetricsOverride");
  await logout();

  stage = "Salesperson 2 login, update, denial and exports";
  assert.equal(await login(3, salesperson2ID), "salesperson");
  const person2Update = await patchLead(leadB, { status: "qualified", notes: "Synthetic HTTP Salesperson 2 QA note" });
  assert.equal(person2Update.status, 200);
  const denied2 = await patchLead(leadA, { status: "lost" });
  assert.ok([403, 404].includes(denied2.status));
  const invalidDate = await patchLead(leadB, { nextFollowUpAt: "2026-02-30T10:00:00.000Z" });
  assert.equal(invalidDate.status, 400);
  results.push(await checkReports("Salesperson 2", [leadB]));
  await logout();

  stage = "anonymous denial and final persistence";
  assert.equal(await evaluate("fetch('/api/crm/reports?period=all').then(r=>r.status)"), 401);
  assert.equal(await evaluate("fetch('/api/central-leads?limit=10').then(r=>r.status)"), 403);
  assert.deepEqual(browserErrors, []);
  const qa = mongo.db(database);
  const [users, leads, activities, migrationCount, demoAfter] = await Promise.all([
    qa.collection("users").countDocuments({}), qa.collection("central-leads").countDocuments({}),
    qa.collection("crm-activities").find({}).toArray(), qa.collection("payload-migrations").countDocuments({}),
    Promise.all(["users", "central-leads", "crm-activities", "crm-assignment-counters"].map((name) => mongo.db(LOCAL_DEMO.database).collection(name).countDocuments({}))),
  ]);
  assert.equal(users, 4);
  assert.equal(leads, 2);
  assert.equal(migrationCount, 0);
  assert.deepEqual(demoAfter, beforeDemo);
  assert.ok(activities.length >= 17, "Authorized updates created expected activity history");
  assert.ok(activities.every((item) => [leadA, leadB].includes(String(item.lead))));
  assert.ok(activities.filter((item) => item.event === "status-changed").length >= 5);
  console.log(JSON.stringify({ status: "PASS", target: { host: "127.0.0.1", port: 27179, database }, results,
    mobile, mobileScreenshot, deniedUpdates: [denied1.status, denied2.status], invalidFollowUpStatus: invalidDate.status,
    qaCounts: { users, leads, activities: activities.length }, migrations: migrationCount, demoCounts: demoAfter, browserErrors: 0 }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", stage, errorClass: error?.constructor?.name || "UnknownError",
    message: String(error?.message || "Browser QA failed").replaceAll(secrets.accountPassword, "[redacted]").slice(0, 180), completedRoles: results }));
  process.exitCode = 1;
} finally {
  try { socket?.close(); } catch { /* Chrome will close. */ }
  if (targetID) { try { await fetch(`http://127.0.0.1:${chromePort}/json/close/${targetID}`); } catch { /* Chrome will close. */ } }
  chrome.kill("SIGTERM");
  await new Promise((done) => chrome.once("exit", done)).catch(() => undefined);
  rmSync(profile, { recursive: true, force: true });
  await mongo.close();
}
