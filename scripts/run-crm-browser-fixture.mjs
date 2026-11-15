import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";
import { validateMongoTestTarget } from "../lib/mongodb-test-target.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = parseEnv(readFileSync(resolve(root, ".env.test.local"), "utf8"));
const { uri, databaseName, hostname } = validateMongoTestTarget(env.MONGODB_TEST_URI, process.env.MONGODB_URI);
const runPassword = process.env.CRM_TEST_LOGIN_PASSWORD;
let payload;
let child;
let snapshots = [];

process.env.MONGODB_URI = uri;
process.env.MONGODB_TEST_URI = uri;
process.env.PAYLOAD_SECRET = "isolated-browser-fixture-secret-32-bytes-minimum";

try {
  if (!runPassword || runPassword.length < 16) throw new Error("Provide a temporary CRM_TEST_LOGIN_PASSWORD of at least 16 characters.");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
  const db = mongoose.connection.db;
  if (!db || db.databaseName !== databaseName || new URL(uri).hostname !== hostname) {
    throw new Error("TEST database identity could not be verified.");
  }
  await db.admin().command({ ping: 1 });

  const office = await db.collection("crm-offices").findOne({ code: "noida" });
  if (!office) throw new Error("Expected isolated Noida fixture was not found.");
  const users = await db.collection("users").find({ office: office._id, role: { $in: ["salesperson", "team-leader"] } }).toArray();
  const admins = await db.collection("users").find({ role: "super-admin" }).toArray();
  const team = await db.collection("crm-teams").findOne({ office: office._id });
  const leads = await db.collection("central-leads").find({ office: office._id }).project({ _id: 1, email: 1, page: 1, assignedSalesperson: 1 }).toArray();

  const salespeople = users.filter((user) => user.role === "salesperson").sort((a, b) => a.rotationOrder - b.rotationOrder);
  const leaders = users.filter((user) => user.role === "team-leader");
  const syntheticOnly = users.length === 11
    && users.every((user) => typeof user.email === "string" && user.email.endsWith(".invalid"))
    && salespeople.length === 10
    && leaders.length === 1
    && admins.length === 1
    && admins[0].active === true
    && typeof admins[0].email === "string" && admins[0].email.endsWith(".invalid")
    && salespeople.every((user, index) => user.active === true && user.eligibleForAssignment === true && user.rotationOrder === index + 1)
    && team?.name.startsWith("crm-test-") === true
    && leads.length === 30
    && leads.every((lead) => lead.page === "/crm-integration-test" && String(lead.email).endsWith(".invalid"));
  if (!syntheticOnly) throw new Error("Existing office fixtures failed synthetic-only verification; no account changes made.");

  const { getPayload } = await import("payload");
  const { default: config } = await import("../payload.config.ts");
  payload = await getPayload({ config });
  snapshots = [...users, ...admins];
  for (const user of snapshots) {
    await payload.update({ collection: "users", id: String(user._id), data: { password: runPassword }, overrideAccess: true });
  }

  const foreignLead = leads.find((lead) => String(lead.assignedSalesperson) === String(salespeople[1]._id));
  if (!foreignLead) throw new Error("Synthetic foreign salesperson lead was not found.");
  console.log(JSON.stringify({
    fixture: "verified-synthetic-only",
    database: databaseName,
    host: hostname,
    localURL: "http://localhost:3100/admin",
    salespersonEmail: salespeople[0].email,
    teamLeaderEmail: leaders[0].email,
    superAdminEmail: admins[0].email,
    foreignLeadId: String(foreignLead._id),
    stopInstruction: "Press Ctrl-C to stop the local server and restore synthetic account documents.",
  }));

  child = spawn(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-p", "3100"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, MONGODB_URI: uri, MONGODB_TEST_URI: uri, PAYLOAD_SECRET: process.env.PAYLOAD_SECRET },
  });

  await new Promise((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolvePromise({ code, signal }));
    process.once("SIGINT", () => child?.kill("SIGINT"));
    process.once("SIGTERM", () => child?.kill("SIGTERM"));
  });
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolvePromise) => child.once("exit", resolvePromise));
  }
  if (payload && snapshots.length) {
    const db = mongoose.connection.db;
    if (!db) throw new Error("TEST connection disappeared before account restoration.");
    for (const user of snapshots) {
      await db.collection("users").replaceOne({ _id: user._id }, user);
    }
  }
  if (payload) await payload.destroy();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
