import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath = process.env.CRM_TEST_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const baseURL = process.env.CRM_TEST_ADMIN_URL || "http://localhost:3100";
const password = process.env.CRM_TEST_LOGIN_PASSWORD;
const salespersonEmail = process.env.CRM_TEST_SALESPERSON_EMAIL;
const teamLeaderEmail = process.env.CRM_TEST_TEAM_LEADER_EMAIL;
const superAdminEmail = process.env.CRM_TEST_SUPER_ADMIN_EMAIL;
const foreignLeadID = process.env.CRM_TEST_FOREIGN_LEAD_ID;
if (!password || !salespersonEmail || !teamLeaderEmail || !superAdminEmail || !foreignLeadID) {
  throw new Error("Synthetic browser fixture environment is incomplete.");
}

const profile = mkdtempSync(join(tmpdir(), "noida-crm-chrome-"));
const chrome = spawn(chromePath, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=9222", `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });

let socket;
let targetID;
let nextID = 0;
const pending = new Map();

async function waitForChrome() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:9222/json/version");
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Headless Chrome did not expose the local DevTools endpoint.");
}

async function command(method, params = {}) {
  const id = ++nextID;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Browser command timed out: ${method}`));
    }, 15_000);
    pending.set(id, (message) => {
      clearTimeout(timeout);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error("Browser JavaScript evaluation failed.");
  return result.result?.value;
}

async function waitFor(expression, predicate, label) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const result = await evaluate(expression);
    if (predicate(result)) return result;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  let diagnostic = "";
  try {
    diagnostic = JSON.stringify(await evaluate("({path:location.pathname,title:document.title,text:document.body?.innerText?.slice(0,240),inputs:[...document.querySelectorAll('input')].map(x=>x.type)})"));
  } catch {}
  throw new Error(`Browser timed out waiting for ${label}.${diagnostic ? ` DOM=${diagnostic}` : ""}`);
}

async function login(email) {
  await command("Page.navigate", { url: `${baseURL}/admin/login` });
  await waitFor("document.readyState", (value) => value === "complete", "Payload login page");
  await waitFor("document.querySelector('input[type=password]') !== null", Boolean, "Payload password field hydration");
  const loginState = await evaluate(`(() => {
    const email = document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]');
    const password = document.querySelector('input[type="password"]');
    const submit = document.querySelector('button[type="submit"]');
    if (!email || !password || !submit) return {
      formFound: false,
      path: location.pathname,
      inputs: [...document.querySelectorAll('input')].map((input) => ({ type: input.type, name: input.name })),
      buttons: [...document.querySelectorAll('button')].map((button) => button.textContent?.trim()).filter(Boolean),
    };
    const set = (element, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set(email, ${JSON.stringify(email)});
    set(password, ${JSON.stringify(password)});
    submit.click();
    return { formFound: true };
  })()`);
  assert.equal(loginState?.formFound, true, `Payload login form is rendered in Chrome: ${JSON.stringify(loginState)}`);
  return waitFor("location.pathname", (path) => path !== "/admin/login", "authenticated admin navigation");
}

try {
  await waitForChrome();
  const target = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
  targetID = target.id;
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    pending.get(message.id)?.(message);
  });
  await command("Page.enable");
  await command("Runtime.enable");

  await login(salespersonEmail);
  await command("Page.navigate", { url: `${baseURL}/admin/crm-dashboard` });
  await waitFor("document.body.innerText", (text) => Boolean(text && text.length > 40), "salesperson dashboard rendering");
  const salespersonDashboard = await evaluate(`({
    path: location.pathname,
    hasDashboard: /CRM|Sales|Lead/i.test(document.body.innerText),
    leadAPI: null,
  })`);
  const salespersonLeadAPI = await evaluate(`fetch('/api/central-leads?limit=100').then(async r => ({status:r.status, body:await r.json()})).then(({status,body}) => ({status,total:body.totalDocs}))`);
  assert.equal(salespersonDashboard.path, "/admin/crm-dashboard");
  assert.equal(salespersonLeadAPI.status, 200);
  assert.equal(salespersonLeadAPI.total, 3, "salesperson dashboard session receives only three personally assigned leads");
  const salespersonForeignREST = await evaluate(`fetch('/api/central-leads/${foreignLeadID}').then(r => r.status)`);
  assert.equal(salespersonForeignREST, 404, "foreign lead is denied through REST");

  await command("Page.navigate", { url: `${baseURL}/admin/collections/central-leads/${foreignLeadID}` });
  const deniedRoute = await waitFor("location.pathname + location.search", (path) => path.includes("notFound="), "cross-salesperson record redirect");
  assert.ok(deniedRoute.includes(encodeURIComponent(foreignLeadID)) || deniedRoute.includes(foreignLeadID));

  const logout = await evaluate("fetch('/api/users/logout', { method: 'POST' }).then((r) => r.status)");
  assert.equal(logout, 200, "salesperson browser session logs out cleanly");
  await login(teamLeaderEmail);
  await command("Page.navigate", { url: `${baseURL}/admin/crm-dashboard` });
  await waitFor("document.body.innerText", (text) => Boolean(text && text.length > 40), "Team Leader dashboard rendering");
  const leaderDashboard = await evaluate("fetch('/api/central-leads?limit=100').then(async r => ({status:r.status, body:await r.json()})).then(({status,body}) => ({status,total:body.totalDocs,assignees:new Set(body.docs.map(x => String(x.assignedSalesperson?.id ?? x.assignedSalesperson))).size}))");
  assert.equal(leaderDashboard.status, 200);
  assert.equal(leaderDashboard.total, 30, "Team Leader dashboard session receives the full Noida fixture set");
  assert.equal(leaderDashboard.assignees, 10, "Team Leader dashboard contains all ten salesperson assignments");
  const leaderForeignREST = await evaluate(`fetch('/api/central-leads/${foreignLeadID}').then(r => r.status)`);
  assert.equal(leaderForeignREST, 200, "Team Leader can read a team member's lead through REST");
  assert.equal(await evaluate("fetch('/api/users/logout', { method: 'POST' }).then(r => r.status)"), 200);
  const anonymousREST = await evaluate("fetch('/api/central-leads?limit=100').then(r => r.status)");
  assert.notEqual(anonymousREST, 200, "anonymous REST list is denied");

  await login(superAdminEmail);
  await command("Page.navigate", { url: `${baseURL}/admin/crm-dashboard` });
  await waitFor("document.body.innerText", (text) => Boolean(text && text.length > 40), "Super Admin dashboard rendering");
  const adminREST = await evaluate("Promise.all([fetch('/api/central-leads?limit=100').then(async r => ({status:r.status,total:(await r.json()).totalDocs})),fetch('/api/users?limit=100').then(async r => ({status:r.status,total:(await r.json()).totalDocs}))])");
  assert.equal(adminREST[0].status, 200);
  assert.equal(adminREST[0].total, 30);
  assert.equal(adminREST[1].status, 200);
  assert.ok(adminREST[1].total >= 12);
  await command("Page.navigate", { url: `${baseURL}/admin/collections/central-leads/${foreignLeadID}` });
  await waitFor("location.pathname", (path) => path.endsWith(foreignLeadID), "Super Admin direct lead URL");
  assert.equal(await evaluate(`fetch('/api/central-leads/${foreignLeadID}').then(r => r.status)`), 200);
  console.log(JSON.stringify({ result: "PASS", browser: "Chrome headless", salespersonDashboard: "PASS", salespersonDirectURLDenial: "PASS", salespersonForeignREST, teamLeaderDashboard: "PASS", teamLeaderForeignREST: leaderForeignREST, teamLeadVisibility: leaderDashboard.total, salespersonLeadVisibility: salespersonLeadAPI.total, anonymousREST, superAdminDashboard: "PASS", superAdminDirectURL: "PASS", superAdminLeadVisibility: adminREST[0].total, superAdminUserVisibility: adminREST[1].total }));
} finally {
  try { socket?.close(); } catch {}
  if (targetID) {
    try { await fetch(`http://127.0.0.1:9222/json/close/${targetID}`); } catch {}
  }
  chrome.kill("SIGTERM");
  await new Promise((resolve) => chrome.once("exit", resolve)).catch(() => undefined);
  rmSync(profile, { recursive: true, force: true });
}
