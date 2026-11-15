import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { lstatSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const baseURL = "http://127.0.0.1:3100";
const debugPort = 19224;
const evidence = resolve(process.cwd(), ".artifacts/noida-local-browser-qa-20261019");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profile = mkdtempSync(join(tmpdir(), "noida-crm-readonly-browser-"));
assert.equal(lstatSync(evidence).mode & 0o077, 0, "Browser evidence directory must be private");

const chrome = spawn(chromePath, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking",
  "--no-first-run", "--no-default-browser-check", "--remote-debugging-address=127.0.0.1",
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR } });

let socket;
let targetID;
let commandID = 0;
const pending = new Map();
const errors = [];
let measurements = {};

async function command(method, params = {}) {
  const id = ++commandID;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((done, fail) => {
    const timer = setTimeout(() => { pending.delete(id); fail(new Error(`Chrome timeout: ${method}`)); }, 15000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      pending.delete(id);
      if (message.error) fail(new Error(message.error.message));
      else done(message.result);
    });
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  assert.equal(result.exceptionDetails, undefined, "Browser evaluation must not throw");
  return result.result.value;
}

async function waitReady() {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    if (await evaluate("document.readyState === 'complete' && !!document.querySelector('input[type=password]')")) return;
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error("Login form did not load");
}

async function inspect(width, height, label) {
  await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await command("Page.navigate", { url: `${baseURL}/admin/login` });
  await waitReady();
  const result = await evaluate(`(() => {
    const email = document.querySelector('input[type=email]');
    const password = document.querySelector('input[type=password]');
    const submit = document.querySelector('button[type=submit]');
    if (!email || !password || !submit) return { formPresent: false };
    const emailRequired = !email.checkValidity();
    const passwordRequired = !password.checkValidity();
    email.value = 'invalid-address';
    const emailInvalid = !email.checkValidity();
    email.value = '';
    return {
      formPresent: true,
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      emailRight: Math.round(email.getBoundingClientRect().right),
      passwordRight: Math.round(password.getBoundingClientRect().right),
      submitRight: Math.round(submit.getBoundingClientRect().right),
      emailRequired, passwordRequired, emailInvalid,
      submitLabel: submit.textContent?.trim() || '',
    };
  })()`);
  const shot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const path = resolve(evidence, `readonly-login-${label}.png`);
  writeFileSync(path, Buffer.from(shot.data, "base64"), { flag: "w", mode: 0o600 });
  return { ...result, screenshot: path };
}

try {
  const deadline = Date.now() + 15000;
  let ready = false;
  while (Date.now() < deadline) {
    try { ready = (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok; } catch { /* Chrome is starting. */ }
    if (ready) break;
    await new Promise((done) => setTimeout(done, 200));
  }
  assert.equal(ready, true, "Chrome debugging is local and ready");
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  targetID = target.id;
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, fail) => {
    socket.addEventListener("open", done, { once: true });
    socket.addEventListener("error", fail, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) pending.get(message.id)?.(message);
    if (message.method === "Runtime.exceptionThrown") errors.push("Browser JavaScript exception");
    if (message.method === "Network.requestWillBeSent" && !message.params?.request?.url?.startsWith(baseURL) && !message.params?.request?.url?.startsWith("data:")) {
      errors.push("Non-local browser request blocked by QA policy");
    }
  });
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Network.enable");
  const mobile = await inspect(390, 844, "mobile");
  const desktop = await inspect(1440, 900, "desktop");
  measurements = { mobile, desktop };
  assert.ok(mobile.formPresent && desktop.formPresent);
  for (const result of [mobile, desktop]) {
    assert.equal(result.scrollWidth, result.viewport, "Login page must not overflow horizontally");
    assert.ok(result.emailRight <= result.viewport && result.passwordRight <= result.viewport && result.submitRight <= result.viewport);
    assert.ok(result.emailRequired && result.emailInvalid, "Email required and format validation must work");
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "PASS", readOnly: true, ...measurements, browserErrors: errors.length }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", ...measurements, errorClass: error?.constructor?.name || "UnknownError", message: String(error?.message || "Browser QA failed").slice(0, 160) }));
  process.exitCode = 1;
} finally {
  try { socket?.close(); } catch { /* Browser will close. */ }
  if (targetID) { try { await fetch(`http://127.0.0.1:${debugPort}/json/close/${targetID}`); } catch { /* Browser will close. */ } }
  chrome.kill("SIGTERM");
  await new Promise((done) => chrome.once("exit", done)).catch(() => undefined);
  rmSync(profile, { recursive: true, force: true });
}
