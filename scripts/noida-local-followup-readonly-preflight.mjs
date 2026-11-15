import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { MongoClient, ObjectId } from "mongodb";

import { LOCAL_DEMO, verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";

const database = "noida-crm-workflow-qa-20261019";
const manifestPath = resolve(LOCAL_DEMO.directory, "crm-noida-workflow-70c38baa-1ca2-4a70-95f9-736adf21c84e.manifest.json");
const secretPath = resolve(LOCAL_DEMO.directory, "crm-workflow-browser-20261019.secrets.json");
for (const path of [manifestPath, secretPath]) {
  const stat = lstatSync(path);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && realpathSync(path) === path && (stat.mode & 0o777) === 0o600);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.status, "verified");
assert.deepEqual(manifest.target, { host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database });
assert.equal(manifest.ids.users.length, 4);
assert.equal(manifest.ids.leads.length, 2);
assert.match(manifest.runMarker, /^noida-workflow-[0-9a-f-]{36}$/);

const uri = `mongodb://127.0.0.1:27179/${database}?replicaSet=noida_demo&directConnection=true`;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
try {
  await client.connect();
  await verifyLocalDemoServer(client, { requireEmpty: false });
  const qa = client.db(database);
  const users = await qa.collection("users").find({ _id: { $in: manifest.ids.users.map((id) => new ObjectId(id)) } }).sort({ _id: 1 }).toArray();
  assert.equal(users.length, 4);
  const leads = await qa.collection("central-leads").find({ _id: { $in: manifest.ids.leads.map((id) => new ObjectId(id)) } }).sort({ _id: 1 }).toArray();
  assert.equal(leads.length, 2);
  assert.equal(await qa.collection("users").countDocuments({}), 4);
  assert.equal(await qa.collection("central-leads").countDocuments({}), 2);
  const activities = await qa.collection("crm-activities").find({ lead: { $in: leads.map((lead) => lead._id) } }).sort({ _id: 1 }).toArray();
  const digest = createHash("sha256").update(JSON.stringify({ leads, activities })).digest("hex");
  const demo = client.db(LOCAL_DEMO.database);
  const demoCounts = await Promise.all(["users", "central-leads", "crm-activities", "crm-assignment-counters"].map((name) => demo.collection(name).countDocuments({})));
  assert.deepEqual(demoCounts, [12, 30, 60, 1]);
  console.log(JSON.stringify({ status: "PASS", host: "127.0.0.1", port: 27179, database, users: users.length, leads: leads.length, activities: activities.length, recordDigest: digest, demoCounts }));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", errorClass: error?.constructor?.name || "UnknownError" }));
  process.exitCode = 1;
} finally {
  await client.close();
}
