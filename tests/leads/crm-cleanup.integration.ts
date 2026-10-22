import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

import { validateMongoTestTarget } from "../../lib/mongodb-test-target.ts";

const env = parseEnv(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../.env.test.local"), "utf8"));
const { uri, databaseName, hostname } = validateMongoTestTarget(env.MONGODB_TEST_URI);
const mongoose = (await import("mongoose")).default;
await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
const db = mongoose.connection.db;
assert.ok(db);
await db.admin().command({ ping: 1 });
assert.equal(db.databaseName, databaseName);
assert.equal(new URL(uri).hostname, hostname);

const testLeadFilter = { page: "/crm-integration-test", legacyCollection: "crm-integration-test" };
const testUserFilter = { email: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:leader|sales\d{2}|admin)@example\.invalid$/i };
const testTeamFilter = { name: /^crm-test-[0-9a-f-]{36}$/i };
const testLegacyLeadFilter = { name: /^crm-test-[0-9a-f-]{36} Legacy$/i, email: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.legacy@example\.invalid$/i };

try {
  const [leads, teams, users, legacyLeads] = await Promise.all([
    db.collection("central-leads").find(testLeadFilter).project({ _id: 1, office: 1 }).toArray(),
    db.collection("crm-teams").find(testTeamFilter).project({ _id: 1, office: 1 }).toArray(),
    db.collection("users").find(testUserFilter).project({ _id: 1, office: 1 }).toArray(),
    db.collection("estate1-enquiries").find(testLegacyLeadFilter).project({ _id: 1 }).toArray(),
  ]);
  const leadIds = leads.map(({ _id }) => _id);
  const teamIds = teams.map(({ _id }) => _id);
  const officeIdStrings = [...new Set([
    ...teams.map(({ office }) => String(office)),
    ...users.map(({ office }) => String(office)),
    ...leads.map(({ office }) => String(office)),
  ].filter((id) => /^[a-f0-9]{24}$/i.test(id)))];
  const officeIds = officeIdStrings.map((id) => new mongoose.Types.ObjectId(id));

  if (leadIds.length) {
    await db.collection("crm-activities").deleteMany({ lead: { $in: leadIds } });
    await db.collection("central-leads").deleteMany({ _id: { $in: leadIds } });
  }
  if (legacyLeads.length) await db.collection("estate1-enquiries").deleteMany({ _id: { $in: legacyLeads.map(({ _id }) => _id) } });
  if (teamIds.length) await db.collection("crm-teams").deleteMany({ _id: { $in: teamIds } });
  if (users.length) await db.collection("users").deleteMany({ _id: { $in: users.map(({ _id }) => _id) } });
  if (officeIds.length) {
    await db.collection("crm-assignment-counters").deleteMany({ key: "noida-shared-lead-round-robin", office: { $in: officeIds } });
    await db.collection("crm-offices").deleteMany({ _id: { $in: officeIds }, code: "noida", name: "Noida" });
  }

  const remaining = await Promise.all([
    db.collection("central-leads").countDocuments(testLeadFilter),
    db.collection("crm-teams").countDocuments(testTeamFilter),
    db.collection("users").countDocuments(testUserFilter),
    db.collection("estate1-enquiries").countDocuments(testLegacyLeadFilter),
    officeIds.length ? db.collection("crm-offices").countDocuments({ _id: { $in: officeIds } }) : Promise.resolve(0),
  ]);
  assert.deepEqual(remaining, [0, 0, 0, 0, 0], "only synthetic CRM test records were removed and no matching records remain");
  console.log(JSON.stringify({ result: "PASS", database: databaseName, host: hostname, removedLeads: leads.length, removedUsers: users.length, removedTeams: teams.length, removedLegacyLeads: legacyLeads.length, productionUntouched: true }));
} finally {
  await mongoose.disconnect();
}
