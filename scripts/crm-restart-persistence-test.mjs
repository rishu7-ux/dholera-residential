import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import mongoose from "mongoose";
import { validateMongoTestTarget } from "../lib/mongodb-test-target.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = parseEnv(readFileSync(resolve(root, ".env.test.local"), "utf8"));
const { uri, databaseName, hostname } = validateMongoTestTarget(env.MONGODB_TEST_URI, process.env.MONGODB_URI);
const port = Number(process.env.CRM_RESTART_TEST_PORT || 3101);
const baseURL = `http://localhost:${port}`;
const secret = randomBytes(32).toString("hex");
const runID = randomUUID();
const keys = [randomUUID(), randomUUID()];
const leadIDs = [];
const legacyIDs = [];
let app;
let office;
let counterSnapshot;
let db;

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/admin/login`, { redirect: "manual" });
      if (response.status === 200) return;
    } catch {}
    if (app?.exitCode !== null && app?.exitCode !== undefined) throw new Error("Local Next application exited before becoming ready.");
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  }
  throw new Error("Local Next application did not become ready in time.");
}

async function startApp() {
  app = spawn(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-p", String(port)], {
    cwd: root,
    stdio: "ignore",
    env: {
      ...process.env,
      MONGODB_URI: uri,
      MONGODB_TEST_URI: uri,
      PAYLOAD_SECRET: randomBytes(32).toString("hex"),
      OMANA_INGEST_SECRET: secret,
    },
  });
  await waitForServer();
}

async function stopApp() {
  if (!app || app.exitCode !== null || app.signalCode !== null) return;
  const processToStop = app;
  await new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error("Local Next process did not stop cleanly after SIGINT.")), 20_000);
    processToStop.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (signal === "SIGINT" || code === 0) resolvePromise();
      else reject(new Error(`Local Next process exited unexpectedly (${signal || code}).`));
    });
    processToStop.kill("SIGINT");
  });
  app = undefined;
}

async function submit(index) {
  const name = `Synthetic Restart Persistence ${index + 1}`;
  const response = await fetch(`${baseURL}/api/omana-leads`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json", "x-idempotency-key": keys[index] },
    body: JSON.stringify({
      type: "enquiry",
      name,
      email: `${runID}.${index + 1}@example.invalid`,
      phone: `9876502${String(index).padStart(3, "0")}`,
      selectedProject: "Synthetic Noida restart test",
      selectedProjectSlug: "synthetic-noida-restart-test",
      message: "Synthetic local process-restart persistence test.",
      page: "/crm-integration-test",
      source: "omana-global-drawer",
      consent: true,
    }),
  });
  assert.equal(response.status, 201, `local synthetic ingestion ${index + 1} succeeds`);
  const result = await response.json();
  assert.equal(result.success, true);
  const central = await db.collection("central-leads").findOne({ idempotencyKey: keys[index] }, { projection: { _id: 1 } });
  assert.ok(central, "local form route created a central lead");
  leadIDs.push(String(central._id));
  const legacy = await db.collection("omana-enquiries").find({ name, page: "/crm-integration-test" }).project({ _id: 1 }).toArray();
  legacyIDs.push(...legacy.map(({ _id }) => _id));
}

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
  db = mongoose.connection.db;
  assert.ok(db);
  await db.admin().command({ ping: 1 });
  assert.equal(db.databaseName, databaseName);
  assert.equal(new URL(uri).hostname, hostname);

  office = await db.collection("crm-offices").findOne({ code: "noida", active: { $ne: false } });
  assert.ok(office, "isolated active Noida office exists");
  const users = await db.collection("users").find({ office: office._id, role: "salesperson", active: true, eligibleForAssignment: true }).sort({ rotationOrder: 1 }).toArray();
  assert.equal(users.length, 10);
  assert.ok(users.every((user) => String(user.email).endsWith(".invalid")));
  const baselineLeads = await db.collection("central-leads").find({ office: office._id }).project({ email: 1, page: 1 }).toArray();
  assert.ok(baselineLeads.length > 0 && baselineLeads.every((lead) => lead.page === "/crm-integration-test" && String(lead.email).endsWith(".invalid")));
  counterSnapshot = await db.collection("crm-assignment-counters").findOne({ office: office._id, key: "noida-shared-lead-round-robin" });
  const baselineSequence = Number(counterSnapshot?.sequence || 0);
  assert.ok(baselineSequence >= 0);

  await startApp();
  await submit(0);
  const first = await db.collection("central-leads").findOne({ idempotencyKey: keys[0] });
  assert.ok(first);
  assert.equal(Number(first.assignmentSequence), baselineSequence + 1);
  assert.equal(String(first.assignedSalesperson), String(users[baselineSequence % users.length]._id));
  await stopApp();
  await startApp();
  await submit(1);
  const second = await db.collection("central-leads").findOne({ idempotencyKey: keys[1] });
  assert.ok(second);
  assert.equal(Number(second.assignmentSequence), baselineSequence + 2, "sequence resumes durably after the Next server process restarts");
  assert.equal(String(second.assignedSalesperson), String(users[(baselineSequence + 1) % users.length]._id));
  assert.notEqual(String(first._id), String(second._id), "distinct idempotency keys remain separate leads");
  console.log(JSON.stringify({ result: "PASS", database: databaseName, appRestarts: 1, submissions: 2, assignmentSequences: [baselineSequence + 1, baselineSequence + 2], persistedAssignments: "PASS", duplicateOrSkippedTurn: false, productionUntouched: true }));
} finally {
  await stopApp();
  if (db && office) {
    const byKey = await db.collection("central-leads").find({ idempotencyKey: { $in: keys } }).project({ _id: 1 }).toArray();
    const objectIDs = [...new Set([...leadIDs, ...byKey.map(({ _id }) => String(_id))])].map((id) => new mongoose.Types.ObjectId(id));
    if (objectIDs.length) {
      await db.collection("crm-activities").deleteMany({ lead: { $in: objectIDs } });
      await db.collection("central-leads").deleteMany({ _id: { $in: objectIDs } });
    }
    if (legacyIDs.length) await db.collection("omana-enquiries").deleteMany({ _id: { $in: legacyIDs } });
    await db.collection("omana-enquiries").deleteMany({ name: /^Synthetic Restart Persistence [12]$/, page: "/crm-integration-test" });
    if (counterSnapshot) {
      await db.collection("crm-assignment-counters").replaceOne({ _id: counterSnapshot._id }, counterSnapshot);
    } else {
      await db.collection("crm-assignment-counters").deleteOne({ office: office._id, key: "noida-shared-lead-round-robin" });
    }
    assert.equal(await db.collection("central-leads").countDocuments({ idempotencyKey: { $in: keys } }), 0, "restart-test leads are removed");
    assert.equal(await db.collection("central-leads").countDocuments({ name: /^Synthetic Restart Persistence [12]$/, page: "/crm-integration-test" }), 0, "restart-test leads by test marker are removed");
    const counterAfterCleanup = await db.collection("crm-assignment-counters").findOne({ office: office._id, key: "noida-shared-lead-round-robin" });
    assert.equal(Number(counterAfterCleanup?.sequence || 0), Number(counterSnapshot?.sequence || 0), "baseline rotation counter is restored");
  }
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
