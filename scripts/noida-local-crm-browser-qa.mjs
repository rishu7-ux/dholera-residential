import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { lstatSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { MongoClient } from "mongodb";
import { LOCAL_DEMO, LOCAL_DEMO_URI, verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";

const root = resolve(import.meta.dirname, "..");
const marker = "noida-local-dabf32f0-340e-47a7-8af9-e2c0c76aad9b";
const evidence = resolve(root, ".artifacts/noida-local-browser-qa-20261019");
const manifestPath = resolve(LOCAL_DEMO.directory, `crm-${marker}.manifest.json`);
const baseURL = "http://127.0.0.1:3100";
const chromePort = 19222;
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const salesperson01Only = process.argv.includes("--salesperson-01-only");

function protectedJSON(path) {
  const stat = lstatSync(path);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o777) === 0o600 && realpathSync(path) === path, "Protected fixture file is insecure");
  return JSON.parse(readFileSync(path, "utf8"));
}

const manifest = protectedJSON(manifestPath);
assert.equal(manifest.runMarker, marker);
assert.equal(manifest.status, "verified");
assert.deepEqual(manifest.target, { host: LOCAL_DEMO.host, port: LOCAL_DEMO.port, replicaSet: LOCAL_DEMO.replicaSet, database: LOCAL_DEMO.database });
const secrets = protectedJSON(manifest.secretFile);
assert.ok(secrets.accountPassword && secrets.payloadSecret);
mkdirSync(evidence, { recursive: true, mode: 0o700 });
assert.equal(lstatSync(evidence).mode & 0o077, 0);

const mongo = new MongoClient(LOCAL_DEMO_URI, { serverSelectionTimeoutMS: 5000 });
let users;
let leads;
try {
  await mongo.connect();
  await verifyLocalDemoServer(mongo, { requireEmpty: false });
  const db = mongo.db(LOCAL_DEMO.database);
  const expected = new Map([
    ["crm-offices", 1], ["users", 12], ["crm-teams", 1], ["central-leads", 30],
    ["crm-activities", 60], ["crm-assignment-counters", 1],
  ]);
  for (const [name, count] of expected) assert.equal(await db.collection(name).countDocuments({}), count, `${name} count`);
  users = await db.collection("users").find({}, { projection: { _id: 1, email: 1, role: 1, office: 1, team: 1 } }).toArray();
  leads = await db.collection("central-leads").find({}, { projection: { _id: 1, name: 1, status: 1, source: 1, createdAt: 1, office: 1, team: 1, assignedSalesperson: 1, assignmentSequence: 1 } }).sort({ assignmentSequence: 1 }).toArray();
  assert.deepEqual(leads.map((lead) => String(lead._id)).sort(), [...manifest.ids.leads].sort());
  assert.deepEqual(users.map((user) => String(user._id)).sort(), [manifest.ids.admin, manifest.ids.leader, ...manifest.ids.salespeople].sort());
  assert.equal(users.filter((user) => user.role === "super-admin").length, 1);
  assert.equal(users.filter((user) => user.role === "team-leader").length, 1);
  assert.equal(users.filter((user) => user.role === "salesperson").length, 10);
  for (let i = 0; i < leads.length; i++) {
    assert.equal(leads[i].assignmentSequence, i + 1, `assignment sequence ${i + 1}`);
    assert.equal(String(leads[i].assignedSalesperson), manifest.ids.salespeople[i % 10], `round-robin assignment ${i + 1}`);
    assert.equal(String(leads[i].office), manifest.ids.office);
    assert.equal(String(leads[i].team), manifest.ids.team);
  }
} finally {
  await mongo.close();
}

const byID = (id) => users.find((user) => String(user._id) === id);
const profile = mkdtempSync(join(tmpdir(), "noida-local-qa-chrome-"));
const chrome = spawn(chromePath, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${chromePort}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR } });
let socket;
let targetID;
let nextID = 0;
const pending = new Map();
const browserErrors = [];
const expectedDenialConsoleLogs = [];
const failingResponses = [];

async function command(method, params = {}) {
  const id = ++nextID;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timeout: ${method}`)); }, 20000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      if (message.error) reject(new Error(message.error.message));
      else resolvePromise(message.result);
    });
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error("Browser JavaScript evaluation failed");
  return result.result?.value;
}

async function waitFor(expression, predicate, label) {
  const until = Date.now() + 25000;
  while (Date.now() < until) {
    if (predicate(await evaluate(expression))) return;
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`Browser timed out waiting for ${label}`);
}

async function navigate(path) {
  await command("Page.navigate", { url: `${baseURL}${path}` });
  await waitFor("document.readyState", (value) => value === "complete", path);
}

async function login(email) {
  await navigate("/admin/login");
  await waitFor("document.querySelector('input[type=password]') !== null", Boolean, "login form");
  const found = await evaluate(`(() => {
    const email = document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]');
    const password = document.querySelector('input[type="password"]');
    const submit = document.querySelector('button[type="submit"]');
    if (!email || !password || !submit) return false;
    const set = (element, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set(email, ${JSON.stringify(email)});
    set(password, ${JSON.stringify(secrets.accountPassword)});
    submit.click();
    return true;
  })()`);
  assert.equal(found, true, "Payload login form is present");
  await waitFor("location.pathname", (path) => path !== "/admin/login", "authenticated login");
}

async function screenshot(name) {
  const result = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const path = resolve(evidence, `${name}.png`);
  writeFileSync(path, Buffer.from(result.data, "base64"), { flag: "w", mode: 0o600 });
}

async function checkRole(user, label, expectedCount, expectedIDs) {
  await login(user.email);
  await navigate("/admin/crm-dashboard");
  await waitFor("document.body?.innerText || ''", (text) => text.includes("Visible Leads"), `${label} dashboard`);
  const dashboard = await evaluate("({path:location.pathname,text:document.body.innerText,links:[...document.querySelectorAll('a')].map(a=>a.getAttribute('href'))})");
  assert.equal(dashboard.path, "/admin/crm-dashboard");
  assert.ok(dashboard.text.includes(`Visible Leads\n${expectedCount}`) || new RegExp(`Visible Leads\\s+${expectedCount}\\b`).test(dashboard.text), `${label} dashboard count`);
  assert.ok(dashboard.text.includes(label === "admin" ? "CRM Oversight" : label === "team-leader" ? "Team Dashboard" : "My Leads"), `${label} dashboard title`);
  assert.ok(dashboard.text.includes("All Leads") && dashboard.text.includes("Pending Follow Ups") && dashboard.text.includes("Recent Leads"), `${label} dashboard KPI and navigation sections`);
  if (label === "team-leader") assert.ok(dashboard.text.includes("Salesperson Performance"), "Team Leader performance table");
  assert.ok(dashboard.links.some((link) => link?.includes("/admin/collections/central-leads")), `${label} lead navigation`);
  const data = await evaluate("fetch('/api/central-leads?limit=100&depth=0').then(async r=>({status:r.status,body:await r.json()})).then(({status,body})=>({status,total:body.totalDocs,ids:body.docs.map(x=>String(x.id)),assignees:[...new Set(body.docs.map(x=>String(x.assignedSalesperson?.id ?? x.assignedSalesperson)))]}))");
  assert.equal(data.status, 200, `${label} lead REST status`);
  assert.equal(data.total, expectedCount, `${label} lead visibility count`);
  assert.deepEqual(data.ids.sort(), [...expectedIDs].sort(), `${label} exact lead IDs`);
  const report = await evaluate("fetch('/api/crm/reports?period=all').then(async r=>({status:r.status,body:await r.json()})).then(({status,body})=>({status,total:body.summary?.total,rows:body.table?.rows?.length,assignees:body.summary?.salespeople?.length,statuses:body.summary?.statuses,sources:body.summary?.sources,dailyTrend:body.summary?.dailyTrend,followUps:body.summary?.followUps}))");
  assert.equal(report.status, 200, `${label} report authorization`);
  assert.equal(report.total, expectedCount, `${label} report total`);
  assert.equal(report.rows, expectedCount, `${label} report row count`);
  const expectedLeadSet = new Set(expectedIDs);
  const expectedLeads = leads.filter((lead) => expectedLeadSet.has(String(lead._id)));
  for (const row of report.statuses) assert.equal(row.count, expectedLeads.filter((lead) => lead.status === row.label).length, `${label} ${row.label} status accuracy`);
  for (const row of report.sources) assert.equal(row.count, expectedLeads.filter((lead) => (lead.source?.trim() || "Unknown") === row.label).length, `${label} ${row.label} source accuracy`);
  assert.equal(report.dailyTrend.reduce((total, row) => total + row.count, 0), expectedCount, `${label} trend accuracy`);
  assert.equal(Object.values(report.followUps).reduce((total, count) => total + count, 0), expectedCount, `${label} follow-up classification accuracy`);
  assert.equal(report.assignees, label.startsWith("salesperson") ? 1 : 10, `${label} report assignee scope`);
  const sample = expectedLeads[0];
  for (const [key, value, expected] of [
    ["status", sample.status, expectedLeads.filter((lead) => lead.status === sample.status).length],
    ["source", sample.source, expectedLeads.filter((lead) => lead.source === sample.source).length],
    ["salesperson", String(sample.assignedSalesperson), expectedLeads.filter((lead) => String(lead.assignedSalesperson) === String(sample.assignedSalesperson)).length],
  ]) {
    const filtered = await evaluate(`fetch('/api/crm/reports?period=all&${key}=${encodeURIComponent(value)}').then(async r=>({status:r.status,total:(await r.json()).summary?.total}))`);
    assert.equal(filtered.status, 200, `${label} ${key} report filter status`);
    assert.equal(filtered.total, expected, `${label} ${key} report filter count`);
  }
  for (const format of ["csv", "xlsx", "pdf"]) {
    const exported = await evaluate(`fetch('/api/crm/reports?period=all&format=${format}').then(async r=>{const b=new Uint8Array(await r.arrayBuffer());const content=new TextDecoder().decode(b);return {status:r.status,type:r.headers.get('content-type'),download:r.headers.get('content-disposition'),prefix:[...b.slice(0,8)],size:b.length,leadIDs:${JSON.stringify(leads.map((lead) => String(lead._id)))}.filter(id=>content.includes(id))}})`);
    assert.equal(exported.status, 200, `${label} ${format} export authorization`);
    assert.ok(exported.download?.includes(`.${format}`), `${label} ${format} download header`);
    assert.ok(exported.size > 100, `${label} ${format} export has content`);
    assert.deepEqual(exported.leadIDs.sort(), [...expectedIDs].sort(), `${label} ${format} export contains only authorized lead IDs`);
    if (format === "xlsx") assert.deepEqual(exported.prefix.slice(0, 2), [80, 75]);
    if (format === "pdf") assert.deepEqual(exported.prefix.slice(0, 4), [37, 80, 68, 70]);
  }
  await screenshot(label);
  return { label, dashboard: "PASS", visibleLeads: data.total, assignees: data.assignees.length, reports: "PASS", exports: "CSV/XLSX/PDF PASS" };
}

async function logout() {
  assert.equal(await evaluate("fetch('/api/users/logout',{method:'POST'}).then(r=>r.status)"), 200);
}

const results = [];
try {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`http://127.0.0.1:${chromePort}/json/version`)).ok) break; } catch {}
    await new Promise((done) => setTimeout(done, 200));
  }
  const target = await (await fetch(`http://127.0.0.1:${chromePort}/json/new?about:blank`, { method: "PUT" })).json();
  targetID = target.id;
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    socket.addEventListener("open", done, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) pending.get(message.id)?.(message);
    if (message.method === "Runtime.exceptionThrown") browserErrors.push(String(message.params?.exceptionDetails?.text ?? "exception").slice(0,160));
    if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
      const entry = String(message.params.entry.text).slice(0,160);
      if (/Failed to load resource: the server responded with a status of (401|403|404)/.test(entry)) expectedDenialConsoleLogs.push(entry);
      else browserErrors.push(entry);
    }
    if (message.method === "Network.responseReceived" && message.params?.response?.status >= 500) failingResponses.push({ status: message.params.response.status, path: new URL(message.params.response.url).pathname });
  });
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Log.enable");
  await command("Network.enable");

  const allLeadIDs = leads.map((lead) => String(lead._id));
  if (!salesperson01Only) {
    results.push(await checkRole(byID(manifest.ids.admin), "admin", 30, allLeadIDs));
    const usersAPI = await evaluate("fetch('/api/users?limit=100').then(async r=>({status:r.status,total:(await r.json()).totalDocs}))");
    assert.equal(usersAPI.status, 200);
    assert.equal(usersAPI.total, 12);
    for (const period of ["daily", "weekly", "monthly", "custom"]) {
      const firstDay = new Date(new Date(leads[0].createdAt).getTime() + 330 * 60_000).toISOString().slice(0, 10);
      const query = period === "custom" ? `period=custom&from=${firstDay}&to=${firstDay}` : `period=${period}`;
      const timed = await evaluate(`fetch('/api/crm/reports?${query}').then(async r=>({status:r.status,body:await r.json()})).then(({status,body})=>({status,period:body.period,total:body.summary?.total}))`);
      assert.equal(timed.status, 200, `${period} report status`);
      assert.equal(timed.period, period);
      assert.ok(Number.isInteger(timed.total) && timed.total >= 0 && timed.total <= 30);
    }
    for (const kind of ["status", "source", "salesperson", "follow-up", "conversion"]) {
      const grouped = await evaluate(`fetch('/api/crm/reports?period=all&report=${kind}').then(async r=>({status:r.status,body:await r.json()})).then(({status,body})=>({status,kind:body.kind,total:body.summary?.total,rows:body.table?.rows?.length}))`);
      assert.equal(grouped.status, 200, `${kind} report status`);
      assert.equal(grouped.kind, kind);
      assert.equal(grouped.total, 30);
      assert.ok(Number.isInteger(grouped.rows));
    }
    await navigate(`/admin/collections/central-leads/${allLeadIDs[0]}`);
    await waitFor("location.pathname", (path) => path.endsWith(allLeadIDs[0]), "Admin lead detail");
    await logout();

    results.push(await checkRole(byID(manifest.ids.leader), "team-leader", 30, allLeadIDs));
    assert.equal(results.at(-1).assignees, 10, "Team Leader sees all ten assignees");
    assert.equal(await evaluate(`fetch('/api/central-leads/${allLeadIDs[0]}').then(r=>r.status)`), 200);
    await logout();
  }

  for (let i = 0; i < (salesperson01Only ? 1 : 10); i++) {
    const id = manifest.ids.salespeople[i];
    const own = leads.filter((lead) => String(lead.assignedSalesperson) === id).map((lead) => String(lead._id));
    results.push(await checkRole(byID(id), `salesperson-${String(i + 1).padStart(2, "0")}`, 3, own));
    const foreign = leads.find((lead) => String(lead.assignedSalesperson) !== id);
    assert.equal(await evaluate(`fetch('/api/central-leads/${String(foreign._id)}').then(r=>r.status)`), 404, `Salesperson ${i + 1} foreign lead denial`);
    assert.equal(await evaluate(`fetch('/api/crm/reports?period=all&salesperson=${String(foreign.assignedSalesperson)}').then(r=>r.status)`), 403, `Salesperson ${i + 1} foreign report filter denial`);
    if (i === 0) {
      await navigate(`/admin/collections/central-leads/${String(foreign._id)}`);
      await waitFor("location.search", (value) => value.includes("notFound="), "foreign lead UI redirect");
      await navigate("/admin/collections/central-leads");
      await waitFor("document.body?.innerText || ''", (value) => value.includes("Leads"), "lead list navigation");
      const listControls = await evaluate("({searchInputs:[...document.querySelectorAll('input')].filter(x=>/search/i.test([x.placeholder,x.ariaLabel,x.name].join(' '))).length,filterButtons:[...document.querySelectorAll('button')].filter(x=>/filter/i.test(x.textContent||x.ariaLabel||'')).length})");
      assert.ok(listControls.searchInputs >= 1, "Lead list search control");
      assert.ok(listControls.filterButtons >= 1, "Lead list filter control");
      const ownName = leads.find((lead) => String(lead.assignedSalesperson) === id).name;
      const exactNameFilter = await evaluate(`fetch('/api/central-leads?where[name][equals]=${encodeURIComponent(ownName)}&limit=100').then(async r=>({status:r.status,total:(await r.json()).totalDocs}))`);
      assert.equal(exactNameFilter.status, 200);
      assert.equal(exactNameFilter.total, 1, "Lead list exact name filter");
      results.at(-1).nameFilter = "PASS";
      const statusFilter = await evaluate("fetch('/api/central-leads?where[status][equals]=new&limit=100').then(async r=>({status:r.status,total:(await r.json()).totalDocs}))");
      assert.equal(statusFilter.status, 200);
      assert.equal(statusFilter.total, 3, "Lead list status filter");
      results.at(-1).statusFilter = "PASS";
      await screenshot("lead-list-salesperson-01");
      const searchFocused = await evaluate("(() => { const input = document.querySelector('input[placeholder=\"Search by Name\"]'); if (!input) return false; input.focus(); return document.activeElement === input; })()");
      assert.equal(searchFocused, true, "Lead list browser search focus");
      await command("Input.insertText", { text: ownName });
      await waitFor("({value:document.querySelector('input[placeholder=\"Search by Name\"]')?.value,rows:document.querySelectorAll('tbody tr').length})", (state) => state?.value === ownName && state?.rows === 1, "lead list browser search result");
      results.at(-1).browserSearch = "PASS";
      const filterOpened = await evaluate("(() => { const button = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === 'Filters'); if (!button) return false; button.click(); return true; })()");
      assert.equal(filterOpened, true, "Lead list browser filter control");
      await waitFor("document.body?.innerText || ''", (text) => text.includes("Status"), "lead list browser filter menu");
      results.at(-1).browserFilterMenu = "PASS";
      results.at(-1).leadList = "PASS";
      results.at(-1).listControls = listControls;
    }
    await logout();
  }
  assert.equal(await evaluate("fetch('/api/central-leads?limit=100').then(r=>r.status)"), 403, "Anonymous lead list denied");
  assert.equal(await evaluate("fetch('/api/crm/reports?period=all').then(r=>r.status)"), 401, "Anonymous CRM report denied");
  assert.equal(failingResponses.length, 0, "No browser HTTP 5xx responses");
  assert.equal(browserErrors.length, 0, "No browser JavaScript errors");
  console.log(JSON.stringify({ result: "PASS", fixture: { accounts: 12, leads: 30, roundRobinCycles: 3 }, roles: results, anonymousREST: 403, browserErrors, expectedDenialConsoleLogs: expectedDenialConsoleLogs.length, http5xx: failingResponses, screenshots: salesperson01Only ? 2 : 13 }));
} catch (error) {
  console.error(JSON.stringify({ result: "FAIL", stage: results.at(-1)?.label ?? "startup", message: error.message.replaceAll(secrets.accountPassword, "[redacted]"), completedRoles: results, browserErrors, http5xx: failingResponses }));
  process.exitCode = 1;
} finally {
  try { socket?.close(); } catch {}
  if (targetID) { try { await fetch(`http://127.0.0.1:${chromePort}/json/close/${targetID}`); } catch {} }
  chrome.kill("SIGTERM");
  await new Promise((done) => chrome.once("exit", done)).catch(() => undefined);
  rmSync(profile, { recursive: true, force: true });
}
