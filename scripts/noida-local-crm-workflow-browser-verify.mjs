import assert from "node:assert/strict";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";

import { assertNoInheritedServices, LOCAL_DEMO, verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";

const database = "noida-crm-workflow-qa-20261019";
const uri = `mongodb://127.0.0.1:27179/${database}?replicaSet=noida_demo&directConnection=true`;
const manifestPath = resolve(LOCAL_DEMO.directory, "crm-noida-workflow-70c38baa-1ca2-4a70-95f9-736adf21c84e.manifest.json");
assertNoInheritedServices(process.env);
const info = lstatSync(manifestPath);
assert.ok(info.isFile() && !info.isSymbolicLink() && realpathSync(manifestPath) === manifestPath && (info.mode & 0o777) === 0o600);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.status, "verified");
assert.deepEqual(manifest.target, { host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database });

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
  await verifyLocalDemoServer(client, { requireEmpty: false });
  const qa = client.db(database);
  const collectionNames = (await qa.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name).sort();
  const collectionCounts = Object.fromEntries(await Promise.all(collectionNames.map(async (name) => [name, await qa.collection(name).countDocuments({})])));
  const nonemptyCollections = Object.fromEntries(Object.entries(collectionCounts).filter(([, count]) => count > 0));
  const unexpectedNames = Object.keys(nonemptyCollections).filter((name) => !["users", "crm-offices", "crm-teams", "central-leads", "crm-activities", "crm-assignment-counters", "payload-preferences"].includes(name));
  assert.deepEqual(unexpectedNames, []);
  const preferences = await qa.collection("payload-preferences").find({}, { projection: { user: 1, key: 1 } }).toArray();
  assert.equal(preferences.length, 2);
  const preferenceMetadata = preferences.map((item) => ({ key: item.key, relationTo: item.user?.relationTo, approvedAccountSlot: manifest.ids.users.indexOf(String(item.user?.value)) + 1 }));
  assert.ok(preferenceMetadata.every((item) => item.relationTo === "users" && item.approvedAccountSlot > 0 && item.key === "collection-central-leads"));
  const [users, leads, activities, offices, teams, migrations, demoCounts] = await Promise.all([
    qa.collection("users").find({}, { projection: { role: 1, email: 1, sessions: 1 } }).toArray(),
    qa.collection("central-leads").find({}, { projection: { email: 1, status: 1, notes: 1, nextFollowUpAt: 1 } }).toArray(),
    qa.collection("crm-activities").find({}, { projection: { event: 1, lead: 1 } }).toArray(),
    qa.collection("crm-offices").countDocuments({}),
    qa.collection("crm-teams").countDocuments({}),
    qa.collection("payload-migrations").countDocuments({}),
    Promise.all(["users", "central-leads", "crm-activities", "crm-assignment-counters"].map((name) => client.db(LOCAL_DEMO.database).collection(name).countDocuments({}))),
  ]);
  assert.deepEqual(users.map((item) => String(item._id)).sort(), [...manifest.ids.users].sort());
  assert.deepEqual(leads.map((item) => String(item._id)).sort(), [...manifest.ids.leads].sort());
  assert.deepEqual(manifest.ids.users.map((id) => users.find((item) => String(item._id) === id)?.role), ["super-admin", "team-leader", "salesperson", "salesperson"]);
  assert.ok(users.every((item) => item.email.startsWith(`${manifest.runMarker}-`) && item.email.endsWith("@example.invalid")));
  assert.equal(offices, 1);
  assert.equal(teams, 1);
  assert.equal(migrations, 0);
  assert.deepEqual(demoCounts, [12, 30, 60, 1]);
  assert.equal(activities.length, 17);
  assert.ok(activities.every((item) => manifest.ids.leads.includes(String(item.lead))));
  const expected = [
    { status: "follow-up", notes: "Synthetic HTTP Salesperson 1 QA note" },
    { status: "qualified", notes: "Synthetic HTTP Salesperson 2 QA note" },
  ];
  for (let index = 0; index < 2; index++) {
    const lead = leads.find((item) => String(item._id) === manifest.ids.leads[index]);
    assert.equal(lead.email, `${manifest.runMarker}-lead-${index + 1}@example.invalid`);
    assert.equal(lead.status, expected[index].status);
    assert.equal(lead.notes, expected[index].notes);
    assert.ok(lead.nextFollowUpAt && !Number.isNaN(new Date(lead.nextFollowUpAt).valueOf()));
  }
  const events = Object.fromEntries([...new Set(activities.map((item) => item.event))].sort().map((name) => [name, activities.filter((item) => item.event === name).length]));
  console.log(JSON.stringify({ status: "PASS", target: { host: "127.0.0.1", port: 27179, database }, qaCounts: { users: users.length, offices, teams, leads: leads.length, activities: activities.length, migrations }, nonemptyCollections, preferenceMetadata, leadStatuses: leads.map((item) => ({ slot: manifest.ids.leads.indexOf(String(item._id)) + 1, status: item.status, followUpSaved: Boolean(item.nextFollowUpAt) })).sort((a, b) => a.slot - b.slot), events, demoCounts }));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", operation: "read-only final integrity", errorClass: error?.constructor?.name || "UnknownError" }));
  process.exitCode = 1;
} finally {
  await client.close();
}
