import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { MongoClient, BSON } from "mongodb";

import { verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";

const database = "noida-crm-workflow-qa-20261019";
const expected = Object.freeze({
  leads: "0d3dbc49755ee177d1c14be45962648516f82c3e58434dd604f015a3875af425",
  activities: "10eaf15a71171fb65b32a55ffb3bcd3a7d47d0f1a45f091506f6609011e49b86",
});
const client = new MongoClient(`mongodb://127.0.0.1:27179/${database}?replicaSet=noida_demo&directConnection=true`, { serverSelectionTimeoutMS: 3000 });
const digest = (value) => createHash("sha256").update(BSON.EJSON.stringify(value, { relaxed: false })).digest("hex");

try {
  await client.connect();
  await verifyLocalDemoServer(client, { requireEmpty: false });
  const db = client.db(database);
  const [users, leads, activities, migrations] = await Promise.all([
    db.collection("users").countDocuments({}),
    db.collection("central-leads").find({}).sort({ _id: 1 }).toArray(),
    db.collection("crm-activities").find({}).sort({ _id: 1 }).toArray(),
    db.collection("payload-migrations").countDocuments({}),
  ]);
  assert.deepEqual([users, leads.length, activities.length, migrations], [4, 2, 17, 0]);
  const actual = { leads: digest(leads), activities: digest(activities) };
  assert.deepEqual(actual, expected, "QA lead or activity contents changed since the protected browser preflight");
  console.log(JSON.stringify({ status: "PASS", host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database, counts: { users, leads: leads.length, activities: activities.length, migrations }, digests: actual }));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", errorClass: error?.constructor?.name || "UnknownError" }));
  process.exitCode = 1;
} finally {
  await client.close();
}
