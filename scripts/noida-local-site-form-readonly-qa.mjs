import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sites = {
  omana: { port: 3205, contact: "/contact" },
  estate1: { port: 3201, contact: "/contact-us" },
  estate2: { port: 3202, contact: "/contact-us" },
  estates: { port: 3203, contact: "/contact-us" },
  industrial: { port: 3204, contact: "/contact" },
};
const selected = process.argv[2];
assert.ok(Object.hasOwn(sites, selected), "Approved local site name required");
const site = sites[selected];
const origin = `http://127.0.0.1:${site.port}`;
const profile = mkdtempSync(join(tmpdir(), `noida-${selected}-readonly-`));
const chromePort = 19320 + site.port - 3200;
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--no-sandbox", "--disable-background-networking", "--no-first-run",
  "--no-default-browser-check", "--proxy-server=http://127.0.0.1:9",
  "--proxy-bypass-list=127.0.0.1;localhost",
  "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${chromePort}`,
  `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR } });

let socket;
let nextID = 0;
const pending = new Map();
const errors = [];
async function command(method, params = {}) {
  const id = ++nextID;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((done, fail) => {
    const timeout = setTimeout(() => { pending.delete(id); fail(new Error(`Timed out: ${method}`)); }, 25000);
    pending.set(id, (result) => {
      clearTimeout(timeout);
      pending.delete(id);
      if (result.error) fail(new Error(result.error.message));
      else done(result.result);
    });
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error("Browser evaluation failed");
  return result.result?.value;
}
async function waitFor(expression, predicate, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate(await evaluate(expression))) return;
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function navigate(path) {
  await command("Page.navigate", { url: `${origin}${path}` });
  await waitFor("document.readyState", (value) => value === "complete", `${path} document`);
  await new Promise((done) => setTimeout(done, 3000));
}
const visibleForm = "[...document.querySelectorAll('form')].find(f=>f.getClientRects().length>0&&f.querySelector('input[name=name],input[autocomplete=name]'))";
async function inspect(mode) {
  await waitFor(`!!(${visibleForm})`, Boolean, `${mode} form`);
  const result = await evaluate(`(() => {const form=${visibleForm};const checkbox=form.querySelector('input[type=checkbox]');return {mode:${JSON.stringify(mode)},mounted:!!form,consentPresent:!!checkbox,consentChecked:checkbox?.checked??null,submitPresent:!!form.querySelector('button[type=submit],button:not([type]),input[type=submit]'),visible:form.getClientRects().length>0}})()`);
  assert.ok(result.mounted && result.visible && result.consentPresent && result.consentChecked === false && result.submitPresent);
  return result;
}
async function verifyConsentValidation() {
  await evaluate("(() => {window.__noidaBlockedPosts=0;const original=window.fetch.bind(window);window.fetch=(input,init={})=>{const method=String(init.method||(input instanceof Request?input.method:'GET')).toUpperCase();if(method==='POST'){window.__noidaBlockedPosts++;return Promise.resolve(Response.json({message:'Blocked by offline QA'},{status:418}));}return original(input,init)};return true})()");
  await evaluate(`(${visibleForm}).querySelector('button[type=submit],button:not([type]),input[type=submit]').click()`);
  await waitFor(`(${visibleForm})?.innerText.includes('Please agree before submitting')`, Boolean, "visible consent validation error");
  assert.equal(await evaluate("window.__noidaBlockedPosts"), 0, "invalid form never attempted POST");
}

try {
  const deadline = Date.now() + 15000;
  let ready = false;
  while (Date.now() < deadline) {
    try { ready = (await fetch(`http://127.0.0.1:${chromePort}/json/version`)).ok; } catch { /* browser starting */ }
    if (ready) break;
    await new Promise((done) => setTimeout(done, 200));
  }
  assert.equal(ready, true);
  const target = await (await fetch(`http://127.0.0.1:${chromePort}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.addEventListener("open", done, { once: true }); socket.addEventListener("error", fail, { once: true }); });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const resolvePending = pending.get(message.id);
      if (resolvePending) resolvePending(message);
    }
    if (message.method === "Runtime.exceptionThrown") errors.push("JavaScript exception");
  });
  await command("Page.enable");
  await command("Runtime.enable");
  const results = [];
  await navigate("/");
  if (selected === "omana") {
    assert.equal(await evaluate("(() => {const button=document.querySelector('button.enquiry-tab');if(!button)return false;button.click();return true})()"), true);
    results.push(await inspect("drawer"));
    assert.equal(await evaluate(`(() => {const button=document.querySelector('button[aria-label="Open Ask Omana chat"]');if(!button)return false;button.click();return true})()`), true);
    await waitFor("!!document.querySelector('form.omana-chat-composer')", Boolean, "ASK OMANA browser composer");
    await navigate(site.contact);
    results.push(await inspect("contact"));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ status: "PASS", site: selected, results, chatbotMounted: true, browserErrors: errors.length }));
  } else {
  results.push(await inspect("popup"));
  await verifyConsentValidation();
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  await waitFor(`!(${visibleForm})`, Boolean, "popup close");
  const clicked = await evaluate("(() => {const button=[...document.querySelectorAll('button')].find(b=>b.getClientRects().length>0&&(b.getAttribute('aria-label')==='Open enquiry form'||/enquire now/i.test(b.textContent||'')));if(!button)return false;button.click();return true})()");
  assert.equal(clicked, true, "side opener exists");
  results.push(await inspect("side"));
  await verifyConsentValidation();
  await navigate(site.contact);
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  results.push(await inspect("contact"));
  if (selected === "estates") {
    await navigate("/properties/dholera-estates");
    await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    await waitFor("!!document.querySelector('form.lead-form')", Boolean, "property enquiry form");
    const property = await evaluate("(() => {const form=document.querySelector('form.lead-form');const checkbox=form?.querySelector('input[name=consent]');return {mounted:!!form,consentPresent:!!checkbox,consentChecked:checkbox?.checked??null}})()");
    assert.deepEqual(property, { mounted: true, consentPresent: true, consentChecked: false });
    results.push({ mode: "property", ...property });
  }
  if (selected === "industrial") {
    await navigate("/properties");
    await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    await waitFor("[...document.querySelectorAll('button')].some(button=>button.getClientRects().length>0&&/enquire now/i.test(button.textContent||''))", Boolean, "property enquiry opener");
    await evaluate("[...document.querySelectorAll('button')].find(button=>button.getClientRects().length>0&&/enquire now/i.test(button.textContent||'')).click()");
    results.push(await inspect("property-card"));
    await verifyConsentValidation();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "PASS", site: selected, results, browserErrors: errors.length }));
  }
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", site: selected, errorClass: error?.constructor?.name || "UnknownError", message: String(error?.message || "Browser QA failed").slice(0, 160), browserErrors: errors.length }));
  process.exitCode = 1;
} finally {
  try { socket?.close(); } catch { /* browser closing */ }
  chrome.kill("SIGTERM");
  if (chrome.exitCode === null) await new Promise((done) => chrome.once("exit", done));
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
