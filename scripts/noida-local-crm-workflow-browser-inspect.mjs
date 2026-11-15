import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { MongoClient } from "mongodb";

import { assertNoInheritedServices, verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";

const root = resolve(import.meta.dirname, "..");
const database = "noida-crm-workflow-qa-20261019";
const uri = `mongodb://127.0.0.1:27179/${database}?replicaSet=noida_demo&directConnection=true`;
const baseURL = "http://127.0.0.1:3101";
const evidence = resolve(root, ".artifacts/noida-local-browser-workflow-qa-20261019");
const manifestPath = resolve(root, ".artifacts/noida-local-demo-20261019/crm-noida-workflow-70c38baa-1ca2-4a70-95f9-736adf21c84e.manifest.json");
const secretPath = resolve(root, ".artifacts/noida-local-demo-20261019/crm-workflow-browser-20261019.secrets.json");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chromePort = 19225;
const mode = process.argv[2];
if (!["--inspect", "--admin-edit"].includes(mode) || process.argv.slice(3).join("|") !== "--approval=APPROVE LOCAL CRM BROWSER AND HTTP WORKFLOW QA") throw new Error("Exact browser QA mode and approval flags are required");
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

const mongo = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
try {
  await mongo.connect();
  await verifyLocalDemoServer(mongo, { requireEmpty: false });
  assert.equal(await mongo.db(database).collection("users").countDocuments({}), 4);
  assert.equal(await mongo.db(database).collection("central-leads").countDocuments({}), 2);
} finally { await mongo.close(); }

const profile = mkdtempSync(join(tmpdir(), "noida-workflow-inspect-"));
const chrome = spawn(chromePath, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking", "--no-first-run",
  "--no-default-browser-check", "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${chromePort}`,
  `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR } });
let socket;
let targetID;
let nextID = 0;
const pending = new Map();
const errors = [];
const patchStatuses = [];

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
  await new Promise((done, fail) => {
    socket.addEventListener("open", done, { once: true });
    socket.addEventListener("error", fail, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) pending.get(message.id)?.(message);
    if (message.method === "Runtime.exceptionThrown") errors.push("JavaScript exception");
    if (message.method === "Network.responseReceived" && message.params?.response?.url?.includes("/api/central-leads/")) {
      patchStatuses.push(message.params.response.status);
    }
  });
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Network.enable");
  await navigate("/admin/login");
  await waitFor("!!document.querySelector('input[type=password]')", Boolean, "login form");
  const email = await evaluate(`(() => {
    const email = document.querySelector('input[type="email"]');
    const password = document.querySelector('input[type="password"]');
    const submit = document.querySelector('button[type="submit"]');
    if (!email || !password || !submit) return false;
    const set = (element, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set(email, ${JSON.stringify(`${manifest.runMarker}-1@example.invalid`)});
    set(password, ${JSON.stringify(secrets.accountPassword)});
    submit.click();
    return true;
  })()`);
  assert.equal(email, true);
  await waitFor("location.pathname", (value) => value !== "/admin/login", "Admin login");
  await navigate(`/admin/collections/central-leads/${manifest.ids.leads[0]}`);
  await waitFor("document.querySelectorAll('input,textarea,select').length", (value) => value > 5, "lead edit form");
  const controls = await evaluate(`(() => ({
    path: location.pathname,
    fields: [...document.querySelectorAll('input,textarea,select')].map(x => ({tag:x.tagName.toLowerCase(),name:x.name||'',type:x.type||'',id:x.id||'',placeholder:x.placeholder||'',aria:x.getAttribute('aria-label')||''})),
    buttons: [...document.querySelectorAll('button')].map(x => (x.textContent||x.getAttribute('aria-label')||'').trim()).filter(Boolean).slice(0,45),
    scrollWidth: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))()`);
  const shot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const screenshot = resolve(evidence, "admin-lead-edit-inspection.png");
  writeFileSync(screenshot, Buffer.from(shot.data, "base64"), { flag: "w", mode: 0o600 });
  let edit = null;
  if (mode === "--admin-edit") {
    const note = "Synthetic browser Admin QA note";
    assert.equal(await evaluate("(() => { const field=document.querySelector('textarea[name=notes]'); if(!field) return false; field.focus(); field.select(); return true; })()"), true);
    await command("Input.insertText", { text: note });
    assert.equal(await evaluate("document.querySelector('textarea[name=notes]')?.value"), note);
    assert.equal(await evaluate("(() => { const button=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()==='Save'); if(!button) return false; button.click(); return true; })()"), true);
    await waitFor(`fetch('/api/central-leads/${manifest.ids.leads[0]}?depth=0').then(r=>r.json()).then(x=>x.notes)`, (value) => value === note, "saved Admin browser note");
    const verified = await evaluate(`fetch('/api/central-leads/${manifest.ids.leads[0]}?depth=0').then(r=>r.json()).then(x=>({id:String(x.id),notes:x.notes,status:x.status}))`);
    assert.equal(verified.id, manifest.ids.leads[0]);
    assert.equal(verified.notes, note);
    const afterShot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const afterScreenshot = resolve(evidence, "admin-lead-edit-saved.png");
    writeFileSync(afterScreenshot, Buffer.from(afterShot.data, "base64"), { flag: "w", mode: 0o600 });
    edit = { saved: true, status: verified.status, httpStatuses: patchStatuses, screenshot: afterScreenshot };
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "PASS", adminLogin: "PASS", controls: mode === "--inspect" ? controls : { path: controls.path, fieldCount: controls.fields.length }, screenshot, edit, browserErrors: 0 }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", errorClass: error?.constructor?.name || "UnknownError", message: String(error?.message || "Inspection failed").replaceAll(secrets.accountPassword, "[redacted]").slice(0, 170) }));
  process.exitCode = 1;
} finally {
  try { socket?.close(); } catch { /* Chrome will close. */ }
  if (targetID) { try { await fetch(`http://127.0.0.1:${chromePort}/json/close/${targetID}`); } catch { /* Chrome will close. */ } }
  chrome.kill("SIGTERM");
  await new Promise((done) => chrome.once("exit", done)).catch(() => undefined);
  rmSync(profile, { recursive: true, force: true });
}
