import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { createServer as createHTTPServer } from "node:http";
import { parseEnv } from "node:util";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";
import { validateMongoTestTarget } from "../lib/mongodb-test-target.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const harnessOnly = process.env.CRM_TEST_HARNESS_ONLY === "1";
const testEnv = parseEnv(readFileSync(resolve(root, ".env.test.local"), "utf8"));
const { uri, databaseName, hostname } = validateMongoTestTarget(testEnv.MONGODB_TEST_URI);
if (!harnessOnly) {
  const productionEnv = parseEnv(readFileSync(process.env.CRM_TEST_PRODUCTION_ENV_FILE || resolve(root, ".env.local"), "utf8"));
  const production = new URL(productionEnv.MONGODB_URI);
  if (production.hostname === hostname && production.pathname.replace(/^\//, "").split("/")[0] === databaseName) {
    throw new Error("The selected TEST database is not isolated from the configured non-test target.");
  }
}

const masterURL = "http://127.0.0.1:3100";
// Some website CMS URL helpers intentionally reject ordinary loopback hostnames
// in production. The IPv4-mapped IPv6 form still resolves only to this machine,
// while allowing the unchanged production build to exercise its server route.
const productionSiteMasterURL = "http://[::ffff:127.0.0.1]:3100";
const sites = {
  omana: { repo: "../omana-projects", port: 3211, secretKey: "OMANA_INGEST_SECRET", site: "omana-projects" },
  estate1: { repo: "../dholera-estate-1", port: 3212, secretKey: "ESTATE1_INGEST_SECRET", site: "dholera-estate-1" },
  estate2: { repo: "../dholera-estate-2", port: 3213, secretKey: "ESTATE2_INGEST_SECRET", site: "dholera-estate-2" },
  estates: { repo: "../dholeraestates", port: 3214, secretKey: "DHOLERA_ESTATES_INGEST_SECRET", site: "dholeraestates" },
  industrial: { repo: "../dholeraindustrial", port: 3215, secretKey: "INDUSTRIAL_INGEST_SECRET", site: "dholeraindustrial" },
};
const cases = [
  { site: "omana", path: "/", mode: "drawer", source: "omana-global-drawer" },
  { site: "omana", path: "/projects/samridhi-621-panchi", mode: "inline", source: "omana-project-page" },
  { site: "omana", path: "/contact", mode: "inline", source: "omana-contact-page" },
  { site: "omana", path: "/dholeraplots", mode: "inline", source: "google-ads-dholeraplots" },
  { site: "estate1", path: "/", mode: "popup", source: "estate1-popup-form" },
  { site: "estate1", path: "/", mode: "side", source: "estate1-side-enquiry-form" },
  { site: "estate1", path: "/contact-us", mode: "inline", source: "estate1-contact-us-page" },
  { site: "estate2", path: "/", mode: "popup", source: "estate2-popup-form" },
  { site: "estate2", path: "/", mode: "side", source: "estate2-side-enquiry-form" },
  { site: "estate2", path: "/contact-us", mode: "inline", source: "estate2-contact-us-page" },
  { site: "estates", path: "/", mode: "popup", source: "dholeraestates-popup-form" },
  { site: "estates", path: "/", mode: "side", source: "dholeraestates-side-enquiry-form" },
  { site: "estates", path: "/contact-us", mode: "inline", source: "dholeraestates-contact-us-page" },
  { site: "industrial", path: "/", mode: "popup", source: "industrial-popup-form" },
  // This site currently routes its global side button to the same EnquiryModal
  // component/source as its timed popup. Keep both UI entry paths explicit.
  { site: "industrial", path: "/", mode: "side", source: "industrial-popup-form" },
  { site: "industrial", path: "/contact", mode: "inline", source: "industrial-contact-us-page" },
];
const requestedWebsite = process.env.CRM_TEST_WEBSITE;
const requestedSource = process.env.CRM_TEST_SOURCE;
const requestedMode = process.env.CRM_TEST_MODE;
const siteRuntimeMode = process.env.CRM_TEST_SITE_RUNTIME === "production" ? "production" : "development";
if (requestedWebsite && !Object.hasOwn(sites, requestedWebsite)) {
  throw new Error("CRM_TEST_WEBSITE must match one of the configured local website aliases.");
}

const marker = `noida-browser-${randomUUID()}`;
const siteSecrets = Object.fromEntries(Object.values(sites).map((site) => [site.secretKey, randomBytes(32).toString("hex")]));
const profile = mkdtempSync(resolve(tmpdir(), "noida-sites-chrome-"));
const chromePath = process.env.CRM_TEST_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const debugPortServer = createServer();
await new Promise((resolvePromise, reject) => {
  debugPortServer.once("error", reject);
  debugPortServer.listen(0, "127.0.0.1", resolvePromise);
});
const chromeDebugPort = debugPortServer.address().port;
await new Promise((resolvePromise) => debugPortServer.close(resolvePromise));
const chrome = spawn(chromePath, [
  ...(process.env.CRM_TEST_VISIBLE === "1" ? [] : ["--headless=new"]), "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling",
  `--remote-debugging-port=${chromeDebugPort}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });

let master;
let siteProcess;
let controlledFormServer;
let controlledFormCount = 0;
let controlledFormPayload;
let mongoClient;
let db;
let socket;
let targetID;
let nextID = 0;
let baselineCounter;
let baselineSequence;
let masterRuntimeEnv;
const pending = new Map();
const results = [];
const browserRuntimeErrors = [];
const loadedDocuments = new Set();

async function assertPortFree(port) {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolvePromise);
  });
  await new Promise((resolvePromise) => server.close(resolvePromise));
}

async function waitForURL(url, expectedStatus = 200) {
  const deadline = Date.now() + 180_000;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      lastStatus = response.status;
      if (lastStatus === expectedStatus || (expectedStatus === 200 && lastStatus === 302)) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`Local application did not become ready (last HTTP status ${lastStatus}).`);
}

function startProcess(command, args, cwd, env) {
  return spawn(command, args, { cwd, env, stdio: "ignore" });
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGINT");
  let timer;
  await Promise.race([
    new Promise((resolvePromise) => child.once("exit", resolvePromise)),
    new Promise((resolvePromise) => { timer = setTimeout(resolvePromise, 15_000); }),
  ]);
  clearTimeout(timer);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolvePromise) => child.once("exit", resolvePromise));
  }
}

async function browserCommand(method, params = {}) {
  const id = ++nextID;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Browser command timed out: ${method}`));
    }, 25_000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      if (message.error) reject(new Error(message.error.message));
      else resolvePromise(message.result);
    });
  });
}

async function evaluate(expression) {
  const result = await browserCommand("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error("Browser JavaScript evaluation failed.");
  return result.result?.value;
}

async function clickSelector(selector) {
  const rect = await evaluate(`(() => { const visible=(node)=>node.getClientRects().length>0; const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(visible); if(!node)return null; node.scrollIntoView({behavior:'instant',block:'center',inline:'center'}); const rect=node.getBoundingClientRect(); return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,width:rect.width,height:rect.height}; })()`);
  assert.ok(rect && rect.width > 0 && rect.height > 0, `visible control exists for ${selector}`);
  await browserCommand("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
  await browserCommand("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await browserCommand("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
}

async function clickButtonContaining(label) {
  const rect = await evaluate(`(() => { const visible=(node)=>node.getClientRects().length>0; const node=[...document.querySelectorAll('button')].find((button)=>visible(button)&&button.innerText.toLowerCase().includes(${JSON.stringify(label.toLowerCase())})); if(!node)return null; node.scrollIntoView({behavior:'instant',block:'center',inline:'center'}); const rect=node.getBoundingClientRect(); return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,width:rect.width,height:rect.height}; })()`);
  assert.ok(rect && rect.width > 0 && rect.height > 0, `visible button contains ${label}`);
  await browserCommand("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
  await browserCommand("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await browserCommand("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
}

async function clickActiveFormSubmit() {
  const target = await evaluate(`(() => {
    const visible = (node) => node.getClientRects().length > 0;
    const form = [...document.querySelectorAll('form')].find((candidate) => visible(candidate) && candidate.querySelector('input[name=name],input[autocomplete=name]'));
    const button = form?.querySelector('button[type="submit"],button:not([type]),input[type="submit"]');
    if (!button) return null;
    button.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
    const rect = button.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const right = Math.min(innerWidth, rect.right);
    const top = Math.max(0, rect.top);
    const bottom = Math.min(innerHeight, rect.bottom);
    if (right <= left || bottom <= top) return { inViewport: false, rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, viewport: { width: innerWidth, height: innerHeight } };
    const x = left + (right - left) / 2;
    const y = top + (bottom - top) / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      inViewport: true,
      hitTarget: Boolean(hit && (hit === button || button.contains(hit))),
      x,
      y,
      tag: hit?.tagName || null,
      hitClass: typeof hit?.className === 'string' ? hit.className.slice(0, 180) : '',
      stack: document.elementsFromPoint(x, y).slice(0, 5).map((node) => ({ tag: node.tagName, id: node.id, className: typeof node.className === 'string' ? node.className.slice(0, 120) : '' })),
      text: button.textContent?.trim().slice(0, 80) || '',
    };
  })()`);
  assert.ok(target?.inViewport, `active form submit is inside the viewport: ${JSON.stringify(target)}`);
  assert.ok(target.hitTarget, `active form submit is the browser hit target: ${JSON.stringify(target)}`);
  await browserCommand("Input.dispatchMouseEvent", { type: "mouseMoved", x: target.x, y: target.y });
  await browserCommand("Input.dispatchMouseEvent", { type: "mousePressed", x: target.x, y: target.y, button: "left", clickCount: 1 });
  await browserCommand("Input.dispatchMouseEvent", { type: "mouseReleased", x: target.x, y: target.y, button: "left", clickCount: 1 });
}

async function clickActiveConsent() {
  const target = await evaluate(`(async () => {
    const visible = (node) => node.getClientRects().length > 0;
    const form = [...document.querySelectorAll('form')].find((candidate) => visible(candidate) && candidate.querySelector('input[name=name],input[autocomplete=name]'));
    const checkbox = [...(form?.querySelectorAll('input[type=checkbox]') || [])].find(visible);
    if (!checkbox) return null;
    checkbox.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = checkbox.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      inViewport: x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight,
      hitTarget: Boolean(hit && (hit === checkbox || checkbox.contains(hit))),
      x,
      y,
      checked: checkbox.checked,
      tag: hit?.tagName || null,
      hitClass: typeof hit?.className === 'string' ? hit.className.slice(0, 180) : '',
      stack: document.elementsFromPoint(x, y).slice(0, 6).map((node) => ({ tag: node.tagName, id: node.id, className: typeof node.className === 'string' ? node.className.slice(0, 120) : '' })),
    };
  })()`);
  assert.ok(target?.inViewport, `active consent is inside the viewport: ${JSON.stringify(target)}`);
  assert.ok(target.hitTarget, `active consent is the browser hit target: ${JSON.stringify(target)}`);
  if (target.checked) return;
  await browserCommand("Input.dispatchMouseEvent", { type: "mouseMoved", x: target.x, y: target.y });
  await browserCommand("Input.dispatchMouseEvent", { type: "mousePressed", x: target.x, y: target.y, button: "left", clickCount: 1 });
  await browserCommand("Input.dispatchMouseEvent", { type: "mouseReleased", x: target.x, y: target.y, button: "left", clickCount: 1 });
}

const postObserverSource = `(() => { window.__noidaPostResults = []; if (window.__noidaFetchWrapped) return; window.__noidaFetchWrapped = true; const original = window.fetch.bind(window); window.fetch = async (input, init = {}) => { const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase(); const url = String(input instanceof Request ? input.url : input); const response = await original(input, init); if (method === "POST") { const body = await response.clone().text().catch(() => ""); window.__noidaPostResults.push({ url: new URL(url, location.href).pathname, status: response.status, response: body.slice(0, 180) }); } return response; }; })()`;

async function waitFor(expression, predicate, label, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await evaluate(expression);
    if (predicate(value)) return value;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  let diagnostic = "";
  try {
    diagnostic = JSON.stringify(await evaluate("({path:location.pathname,title:document.title,text:document.body?.innerText?.slice(0,220),ready:document.readyState,visibility:document.visibilityState,forms:[...document.querySelectorAll('form')].map(f=>({visible:f.getClientRects().length>0,inputs:[...f.querySelectorAll('input')].map(i=>({type:i.type,name:i.name,autocomplete:i.autocomplete}))}))})"));
  } catch {}
  throw new Error(`Timed out waiting for ${label}.${diagnostic ? ` DOM=${diagnostic}` : ""}`);
}

async function openCase(testCase, site) {
  browserRuntimeErrors.length = 0;
  await installPostObserver();
  const navigation = await browserCommand("Page.navigate", { url: `http://127.0.0.1:${site.port}${testCase.path}` });
  assert.ok(!navigation.errorText, "navigation succeeds");
  await browserCommand("Page.bringToFront");
  const loadDeadline = Date.now() + 180_000;
  while (!loadedDocuments.has(navigation.loaderId)) {
    assert.ok(Date.now() < loadDeadline, "new document completes its own load lifecycle");
    await new Promise((done) => setTimeout(done, 250));
  }
  await waitFor("location.href", (value) => value === `http://127.0.0.1:${site.port}${testCase.path}`, "target navigation committed");
  await waitFor("document.readyState", (value) => value === "complete", `${testCase.site} page load`);
  // Do not inspect React's private DOM properties: their names are unstable
  // across React releases and are not a reliable hydration contract. The
  // actual click, input, and submit behavior below is the hydration check.
  // Local Next dev servers compile route chunks on demand; wait for their
  // client hydration to settle before exercising React-bound controls.
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 4_000));
  await evaluate(postObserverSource);

  if (testCase.mode === "drawer") {
    await clickButtonContaining("enquire now");
  } else if (testCase.mode === "side") {
    await browserCommand("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await browserCommand("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    if (testCase.site === "industrial") await clickSelector('button[aria-label="Open enquiry form"]');
    else await clickButtonContaining("enquire now");
  } else if (testCase.mode === "inline") {
    // Timed global modals can legitimately overlay an inline/contact form.
    // Close them through the same keyboard interaction available to a user.
    await browserCommand("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await browserCommand("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }

  const visibleForm = await waitFor(
    "[...document.querySelectorAll('form')].some(form => form.getClientRects().length > 0 && form.querySelector('input[name=name],input[autocomplete=name]'))",
    Boolean,
    `${testCase.source} visible form`,
    15_000,
  );
  assert.equal(visibleForm, true);
  if (testCase.mode === "side") {
    await waitFor(
      `(() => {
        const form = [...document.querySelectorAll('form')].find((candidate) => candidate.getClientRects().length > 0 && candidate.querySelector('input[name=name],input[autocomplete=name]'));
        if (!form) return false;
        const rect = form.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth;
      })()`,
      Boolean,
      `${testCase.source} drawer animation`,
      5_000,
    );
  }
}

async function installPostObserver() {
  await browserCommand("Page.addScriptToEvaluateOnNewDocument", {
    source: postObserverSource,
  });
}

async function runControlledHarnessTest() {
  controlledFormServer = createHTTPServer((request, response) => {
    if (request.method === "GET" && request.url === "/controlled-form") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><body><form id="known-form"><label>Name <input name="name" required></label><label>Email <input name="email" type="email" required></label><label>Project <select name="project"><option value="">Select</option><option value="test-project">Test Project</option></select></label><label for="known-consent">I agree</label><input id="known-consent" name="consent" type="checkbox" required><button type="submit">Submit controlled test</button></form><script>document.querySelector('#known-form').addEventListener('submit', async event => { event.preventDefault(); const response = await fetch('/controlled-submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); document.body.dataset.submitStatus = String(response.status); });</script></body></html>`);
      return;
    }
    if (request.method === "POST" && request.url === "/controlled-submit") {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => { body += chunk; });
      request.on("end", () => {
        controlledFormCount += 1;
        controlledFormPayload = JSON.parse(body);
        response.writeHead(201, { "content-type": "application/json" });
        response.end('{"accepted":true}');
      });
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolvePromise, reject) => {
    controlledFormServer.once("error", reject);
    controlledFormServer.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = controlledFormServer.address();
  assert.ok(address && typeof address === "object");
  await installPostObserver();
  await browserCommand("Page.navigate", { url: `http://127.0.0.1:${address.port}/controlled-form` });
  await waitFor("document.readyState", (value) => value === "complete", "controlled harness form page");
  await evaluate(postObserverSource);
  await inputText('input[name="name"]', "Synthetic Harness QA");
  await inputText('input[name="email"]', "harness@example.invalid");
  await selectFirstOption(0);
  await clickSelector('label[for="known-consent"]');
  assert.equal(await evaluate("document.querySelector('#known-consent').checked"), true, "browser clicked the controlled consent label");
  await clickSelector('button[type="submit"]');
  const deadline = Date.now() + 5_000;
  while (controlledFormCount === 0 && Date.now() < deadline) await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  assert.equal(controlledFormCount, 1, "browser click triggered the known controlled form POST");
  assert.deepEqual(controlledFormPayload, { name: "Synthetic Harness QA", email: "harness@example.invalid", project: "test-project", consent: "on" });
  const observed = await waitFor("window.__noidaPostResults || []", (events) => events.some((event) => event.url === "/controlled-submit" && event.status === 201), "controlled POST response observation", 5_000);
  assert.ok(observed.some((event) => event.url === "/controlled-submit" && event.status === 201));
  console.log(JSON.stringify({ browserHarness: "PASS", controlledFormPostObserved: true, target: "loopback test receiver", testDatabaseWrites: false }));
}

async function inputText(selector, value) {
  const focused = await evaluate(`(() => {const visible=(node)=>node.getClientRects().length>0;const form=[...document.querySelectorAll('form')].find(f=>visible(f)&&f.querySelector('input[name=name],input[autocomplete=name]'));const field=form?.querySelector(${JSON.stringify(selector)});if(!field)return false;field.focus();field.select?.();return true})()`);
  assert.equal(focused, true, `field exists for ${selector}`);
  await browserCommand("Input.insertText", { text: value });
}

async function selectFirstOption(index) {
  const current = await evaluate(`(() => {const visible=(node)=>node.getClientRects().length>0;const form=[...document.querySelectorAll('form')].find(f=>visible(f)&&f.querySelector('input[name=name],input[autocomplete=name]'));const field=form?.querySelectorAll('select')[${index}];if(!field)return {exists:false};const option=[...field.options].find(o=>!o.disabled&&o.value);return {exists:true,selected:Boolean(field.value),hasOption:Boolean(option)}})()`);
  assert.equal(current?.exists, true, `select exists at index ${index}`);
  if (current.selected) return;
  assert.equal(current.hasOption, true, `select has a valid option at index ${index}`);
  const selected = await evaluate(`(() => {const visible=(node)=>node.getClientRects().length>0;const form=[...document.querySelectorAll('form')].find(f=>visible(f)&&f.querySelector('input[name=name],input[autocomplete=name]'));const field=form?.querySelectorAll('select')[${index}];if(!field)return '';field.scrollIntoView({behavior:'instant',block:'center'});const option=[...field.options].find(o=>!o.disabled&&o.value);if(!option)return '';Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(field,option.value);field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));return field.value})()`);
  assert.ok(selected, `browser selected a valid option at index ${index}`);
}

async function submitForm(testCase, site, caseIndex, siteRuntimeEnv) {
  // This is checked immediately before every form submission. The website
  // process was started with no inherited CMS endpoint/ingress secret.
  const siteCMSURL = siteRuntimeEnv.PAYLOAD_CMS_URL;
  const expectedSiteCMSURL = siteRuntimeMode === "production" ? productionSiteMasterURL : masterURL;
  assert.equal(siteCMSURL, expectedSiteCMSURL);
  assert.ok(["127.0.0.1", "[::ffff:7f00:1]"].includes(new URL(siteCMSURL).hostname));
  assert.equal(siteRuntimeEnv[site.secretKey], masterRuntimeEnv[site.secretKey]);
  assert.ok(siteRuntimeEnv[site.secretKey].length >= 32);
  console.log(JSON.stringify({ preflight: "PASS", website: site.site, target: "local Master CMS", testDatabase: "verified TEST only", ingestionSecretMatches: true, source: testCase.source }));

  const email = `${marker}.${caseIndex}.${testCase.source}@example.invalid`;
  const phone = `98765${String(caseIndex).padStart(5, "0")}`;
  const name = `Synthetic QA ${caseIndex}`;
  const manual = process.env.CRM_TEST_MANUAL_SOURCE === testCase.source;
  if (manual) {
    const resumeFile = resolve(root, ".noida-manual-complete");
    assert.equal(existsSync(resumeFile), false, "manual resume marker must be fresh");
    console.log(JSON.stringify({ manual: "READY", debugPort: chromeDebugPort, targetID, source: testCase.source, name, email, phone, resumeFile }));
    const deadline = Date.now() + 600_000;
    while (!existsSync(resumeFile) && Date.now() < deadline) await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    assert.ok(existsSync(resumeFile), "manual browser submission completed within ten minutes");
  } else {
  await inputText('input[name="name"],input[autocomplete="name"]', name);
  await inputText('input[name="email"],input[type="email"],input[autocomplete="email"]', email);
  await inputText('input[name="phone"],input[type="tel"],input[autocomplete="tel"]', phone);
  const selectCount = await evaluate(`(() => {const form=[...document.querySelectorAll('form')].find(f=>f.getClientRects().length>0&&f.querySelector('input[name=name],input[autocomplete=name]'));return [...(form?.querySelectorAll('select')||[])].length})()`);
  for (let index = 0; index < selectCount; index += 1) await selectFirstOption(index);
  const checkbox = await evaluate(`(() => {const visible=(node)=>node.getClientRects().length>0;const form=[...document.querySelectorAll('form')].find(f=>visible(f)&&f.querySelector('input[name=name],input[autocomplete=name]'));const node=[...(form?.querySelectorAll('input[type=checkbox]')||[])].find(visible);if(!node)return null;const r=node.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height,checked:node.checked}})()`);
  if (checkbox && !checkbox.checked) {
    await clickActiveConsent();
  }
  if (checkbox) {
    const consentChecked = await waitFor(
      `(() => {const visible=(node)=>node.getClientRects().length>0;const form=[...document.querySelectorAll('form')].find(f=>visible(f)&&f.querySelector('input[name=name],input[autocomplete=name]'));return Boolean(form?.querySelector('input[type=checkbox]')?.checked)})()`,
      Boolean,
      `${testCase.source} consent state`,
      2_000,
    );
    assert.ok(consentChecked, "browser checked the existing enquiry consent control");
  }
  const fieldState = await evaluate(`(() => {const form=[...document.querySelectorAll('form')].find(f=>f.getClientRects().length>0&&f.querySelector('input[name=name],input[autocomplete=name]'));return [...(form?.querySelectorAll('input,select')||[])].map(i=>({name:i.name,value:i.type==='checkbox'?String(i.checked):i.value}))})()`);
  assert.ok(fieldState.some((field) => field.name === "name" && field.value === name), "browser entered synthetic customer name");
  assert.ok(fieldState.some((field) => field.name === "email" && field.value === email), "browser entered synthetic customer email");
  assert.ok(fieldState.some((field) => field.name === "phone" && field.value === phone), "browser entered synthetic customer phone");

  await clickActiveFormSubmit();
  }
  const deadline = Date.now() + 20_000;
  let lead;
  while (Date.now() < deadline) {
    lead = await db.collection("central-leads").findOne({ email });
    if (lead) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  if (!lead) {
    const browserState = await evaluate("({path:location.pathname,text:document.body?.innerText?.slice(-650),posts:window.__noidaPostResults||[],scripts:[...document.scripts].map(s=>s.src).filter(Boolean),jsResources:performance.getEntriesByType('resource').filter(e=>e.name.endsWith('.js')).slice(-12).map(e=>({name:new URL(e.name).pathname,responseStatus:e.responseStatus||0})),forms:[...document.querySelectorAll('form')].map(f=>({visible:f.getClientRects().length>0,inputs:[...f.querySelectorAll('input,select,textarea')].map(i=>({name:i.name,type:i.type,value:i.type==='checkbox'?String(i.checked):i.value}))}))})");
    throw new Error(`No central lead was created for ${testCase.source}; browser state=${JSON.stringify({ ...browserState, runtimeErrors: browserRuntimeErrors.slice(-8) })}`);
  }
  assert.equal(await db.collection("central-leads").countDocuments({ email }), 1, `exactly one central lead exists for ${testCase.source}`);
  assert.equal(lead.website, site.site);
  assert.equal(lead.source, testCase.source);
  assert.equal(lead.name, name);
  assert.ok(lead.office, `central lead has a CRM office for ${testCase.source}`);
  assert.ok(lead.assignedSalesperson, `central lead has a round-robin assignee for ${testCase.source}`);
  const expectedSequence = baselineSequence + results.filter((result) => result.result === "PASS").length + 1;
  assert.equal(Number(lead.assignmentSequence), expectedSequence);
  results.push({ website: site.site, source: testCase.source, result: "PASS", sequence: Number(lead.assignmentSequence), clientValidation: "fields supplied; form accepted" });
}

async function startChrome() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${chromeDebugPort}/json/version`);
      if (response.ok) break;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  const target = await (await fetch(`http://127.0.0.1:${chromeDebugPort}/json/new?about:blank`, { method: "PUT" })).json();
  targetID = target.id;
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener("open", resolvePromise, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Page.lifecycleEvent" && message.params.name === "load") loadedDocuments.add(message.params.loaderId);
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") browserRuntimeErrors.push({ type: "log", text: message.params.entry.text.slice(0, 300) });
    if (message.method === "Fetch.requestPaused") {
      const { request, requestId } = message.params;
      const local = ["127.0.0.1", "localhost"].includes(new URL(request.url).hostname);
      const blocked = !local && !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
      void browserCommand(blocked ? "Fetch.failRequest" : "Fetch.continueRequest",
        blocked ? { requestId, errorReason: "BlockedByClient" } : { requestId });
    }
    if (message.method === "Runtime.exceptionThrown") browserRuntimeErrors.push({ type: "exception", text: String(message.params?.exceptionDetails?.text || "") });
    if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") browserRuntimeErrors.push({ type: "console", text: message.params.args?.map((item) => String(item.value || item.description || "")).join(" ").slice(0, 300) });
    pending.get(message.id)?.(message);
  });
  await browserCommand("Log.enable");
  await browserCommand("Page.enable");
  await browserCommand("Page.setLifecycleEventsEnabled", { enabled: true });
  await browserCommand("Runtime.enable");
  await browserCommand("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  await browserCommand("Page.bringToFront");
  console.log(JSON.stringify({ browserAttached: true, port: chromeDebugPort, targetID }));
}

try {
  if (harnessOnly) {
    await startChrome();
    await runControlledHarnessTest();
    console.log(JSON.stringify({ result: "PASS", mode: "offline-browser-harness", testDatabaseWrites: false }));
  } else {
  for (const port of [3100, 3211, 3212, 3213, 3214, 3215]) await assertPortFree(port);
  mongoClient = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });
  await mongoClient.connect();
  db = mongoClient.db(databaseName);
  await db.command({ ping: 1 });
  const office = await db.collection("crm-offices").findOne({ code: "noida" });
  assert.ok(office, "isolated Noida TEST office exists before the test");
  const staff = await db.collection("users").find({ office: office._id, role: { $in: ["salesperson", "team-leader"] } }).toArray();
  const leads = await db.collection("central-leads").find({ office: office._id }).toArray();
  assert.equal(leads.length, 30, "expected only the original synthetic Noida baseline before the test");
  assert.equal(staff.length, 11, "only the known synthetic Noida staff fixture is present");
  assert.ok(staff.every((user) => String(user.email).endsWith(".invalid")), "all fixture users are synthetic");
  assert.ok(leads.every((lead) => String(lead.email).endsWith(".invalid")), "all existing fixture leads are synthetic");
  assert.ok(leads.every((lead) => lead.page === "/crm-integration-test"), "all pre-existing leads are test fixtures");
  const counterFilter = { key: "noida-shared-lead-round-robin", office: office._id };
  baselineCounter = await db.collection("crm-assignment-counters").findOne(counterFilter);
  assert.ok(baselineCounter, "synthetic assignment counter exists");
  baselineSequence = Number(baselineCounter.sequence);

  masterRuntimeEnv = {
    ...process.env,
    PORT: "3100",
    MONGODB_URI: uri,
    MONGODB_TEST_URI: uri,
    PAYLOAD_SECRET: randomBytes(32).toString("hex"),
    SMTP_HOST: "",
    SMTP_PORT: "",
    SMTP_USER: "",
    SMTP_PASS: "",
    PAYLOAD_EMAIL_FROM_ADDRESS: "",
    PAYLOAD_EMAIL_FROM_NAME: "",
    SMTP_TLS_REJECT_UNAUTHORIZED: "true",
    ...siteSecrets,
  };
  master = startProcess(process.execPath, [resolve(root, "scripts/dev-test.mjs")], root, masterRuntimeEnv);
  await waitForURL(`${masterURL}/admin/login`);
  await startChrome();
  await runControlledHarnessTest();

  let browserIndex = 0;
  if (!harnessOnly) for (const [siteName, site] of Object.entries(sites).filter(([name]) => !requestedWebsite || name === requestedWebsite)) {
    const siteEnv = {
      ...process.env,
      PORT: String(site.port),
      PAYLOAD_CMS_URL: siteRuntimeMode === "production" ? productionSiteMasterURL : masterURL,
      SMTP_HOST: "",
      SMTP_PORT: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      [site.secretKey]: siteSecrets[site.secretKey],
    };
    const siteRoot = resolve(root, site.repo);
    const siteCommand = siteRuntimeMode === "production"
      ? [resolve(siteRoot, "node_modules/next/dist/bin/next"), "start", "-p", String(site.port)]
      : [resolve(siteRoot, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-p", String(site.port)];
    siteProcess = startProcess(process.execPath, siteCommand, siteRoot, siteEnv);
    await waitForURL(`http://127.0.0.1:${site.port}/`);
    for (const testCase of cases.filter((candidate) => candidate.site === siteName && (!requestedSource || candidate.source === requestedSource) && (!requestedMode || candidate.mode === requestedMode))) {
      browserIndex += 1;
      try {
        await openCase(testCase, site);
        await submitForm(testCase, site, browserIndex, siteEnv);
      } catch (error) {
        results.push({ website: site.site, source: testCase.source, result: "BLOCKED", reason: error instanceof Error ? error.message : "Browser test failed" });
      }
    }
    await stopProcess(siteProcess);
    siteProcess = undefined;
  }

  const blocked = results.some((result) => result.result !== "PASS");
  console.log(JSON.stringify({ result: blocked ? "PARTIAL" : "PASS", browser: process.env.CRM_TEST_VISIBLE === "1" ? "visible Chrome" : "headless Chrome", siteRuntimeMode, isolatedTarget: "allowlisted TEST MongoDB", localMaster: true, actualWebsiteFormSubmissions: results.filter((result) => result.result === "PASS").length, blockedForms: results.filter((result) => result.result === "BLOCKED").length, results }, null, 2));
  if (blocked) process.exitCode = 2;
  }
} catch (error) {
  console.error(JSON.stringify({ result: "FAIL", completed: results, reason: error instanceof Error ? error.message : "unknown test failure" }));
  throw error;
} finally {
  if (siteProcess) await stopProcess(siteProcess);
  if (master) await stopProcess(master);
  if (socket) socket.close();
  if (targetID) await fetch(`http://127.0.0.1:${chromeDebugPort}/json/close/${targetID}`).catch(() => undefined);
  if (chrome.exitCode === null && chrome.signalCode === null) {
    chrome.kill("SIGTERM");
    await new Promise((resolvePromise) => chrome.once("exit", resolvePromise));
  }

  if (db && baselineCounter) {
    const prefix = `${marker}.`;
    const testLeads = await db.collection("central-leads").find({ email: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` } }).toArray();
    const ids = testLeads.map((lead) => lead._id);
    if (ids.length) {
      await db.collection("crm-activities").deleteMany({ lead: { $in: ids } });
      await db.collection("central-leads").deleteMany({ _id: { $in: ids } });
    }
    const currentCounter = await db.collection("crm-assignment-counters").findOne({ _id: baselineCounter._id });
    if (currentCounter && Number(currentCounter.sequence) === baselineSequence + testLeads.length) {
      await db.collection("crm-assignment-counters").replaceOne({ _id: baselineCounter._id }, baselineCounter);
    } else if (testLeads.length) {
      console.error("Synthetic leads were removed, but counter changed outside the expected test sequence; manual isolated TEST reconciliation is required.");
      process.exitCode = 2;
    }
    const remaining = await db.collection("central-leads").countDocuments({ email: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` } });
    const restoredCounter = await db.collection("crm-assignment-counters").findOne({ _id: baselineCounter._id });
    if (remaining !== 0 || Number(restoredCounter?.sequence) !== baselineSequence) {
      console.error("Browser-test cleanup did not restore the synthetic marker/counter baseline.");
      process.exitCode = 2;
    }
  }
  if (mongoClient) await mongoClient.close();
  if (controlledFormServer) await new Promise((resolvePromise) => controlledFormServer.close(resolvePromise));
  rmSync(profile, { recursive: true, force: true });
}
