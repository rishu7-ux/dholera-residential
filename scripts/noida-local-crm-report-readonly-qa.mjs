import assert from "node:assert/strict";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { MongoClient, ObjectId } from "mongodb";

import { assertNoInheritedServices, verifyLocalDemoServer } from "../lib/noida-local-demo-target.mjs";
import { buildCrmReport } from "../lib/crm/report-core.ts";
import { reportCSV, reportPDF, reportXLSX } from "../lib/crm/report-export.ts";

const database = "noida-crm-workflow-qa-20261019";
const uri = `mongodb://127.0.0.1:27179/${database}?replicaSet=noida_demo&directConnection=true`;
const manifestPath = resolve(process.cwd(), ".artifacts/noida-local-demo-20261019/crm-noida-workflow-70c38baa-1ca2-4a70-95f9-736adf21c84e.manifest.json");
assertNoInheritedServices(process.env);
const stat = lstatSync(manifestPath);
assert.ok(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o777) === 0o600 && realpathSync(manifestPath) === manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.status, "verified");
assert.deepEqual(manifest.target, { host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database });
assert.equal(manifest.ids.users.length, 4);
assert.equal(manifest.ids.leads.length, 2);

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
  await verifyLocalDemoServer(client, { requireEmpty: false });
  const db = client.db(database);
  assert.equal(db.databaseName, database);
  const [users, leads, activities] = await Promise.all([
    db.collection("users").find({ _id: { $in: manifest.ids.users.map((value) => new ObjectId(value)) } }, { projection: { _id: 1, name: 1, role: 1, office: 1 } }).toArray(),
    db.collection("central-leads").find({ _id: { $in: manifest.ids.leads.map((value) => new ObjectId(value)) } }, { projection: { _id: 1, name: 1, phone: 1, email: 1, website: 1, project: 1, source: 1, status: 1, createdAt: 1, nextFollowUpAt: 1, assignedSalesperson: 1, office: 1 } }).toArray(),
    db.collection("crm-activities").find({}, { projection: { _id: 1, event: 1, lead: 1 } }).toArray(),
  ]);
  assert.equal(users.length, 4);
  assert.equal(leads.length, 2);
  assert.equal(activities.length, 17);
  assert.ok(activities.every((activity) => manifest.ids.leads.includes(String(activity.lead))));
  const activityEvents = Object.fromEntries(["follow-up-scheduled", "note-added", "status-changed"].map((event) => [
    event, activities.filter((activity) => activity.event === event).length,
  ]));
  assert.deepEqual(activityEvents, { "follow-up-scheduled": 4, "note-added": 7, "status-changed": 6 });
  assert.equal(await db.collection("users").countDocuments({}), 4);
  assert.equal(await db.collection("central-leads").countDocuments({}), 2);
  const orderedUsers = manifest.ids.users.map((value) => users.find((item) => String(item._id) === value));
  assert.deepEqual(orderedUsers.map((item) => item?.role), ["super-admin", "team-leader", "salesperson", "salesperson"]);
  assert.ok(leads.every((lead) => String(lead.office) === String(orderedUsers[0].office)));
  const names = new Map(users.map((item) => [String(item._id), String(item.name || "Salesperson")]));
  const ids = leads.map((item) => String(item._id));
  const options = { period: "all", kind: "overview", format: "json" };
  const window = { start: null, endExclusive: null, label: "All dates" };
  const checks = [];

  for (const [index, role] of ["Admin", "Team Leader", "Salesperson 1", "Salesperson 2"].entries()) {
    const user = orderedUsers[index];
    const authorized = index < 2 ? leads : leads.filter((lead) => String(lead.assignedSalesperson) === String(user._id));
    assert.equal(authorized.length, index < 2 ? 2 : 1);
    const input = authorized.map((lead) => ({
      id: String(lead._id), name: lead.name, phone: lead.phone, email: lead.email,
      website: lead.website, project: lead.project, source: lead.source, status: lead.status,
      createdAt: lead.createdAt.toISOString(), nextFollowUpAt: lead.nextFollowUpAt?.toISOString?.() || lead.nextFollowUpAt || null,
      assignedSalesperson: String(lead.assignedSalesperson),
    }));
    const report = buildCrmReport(input, names, options, window);
    assert.equal(report.summary.total, authorized.length);
    assert.deepEqual(report.table.rows.map((row) => row[0]).sort(), authorized.map((lead) => String(lead._id)).sort());
    const json = JSON.stringify(report);
    const csv = reportCSV(report.table).toString("utf8");
    const xlsx = reportXLSX(report.table);
    const pdf = reportPDF(report.table, "Noida CRM read-only QA");
    assert.ok(csv.startsWith("\uFEFF"));
    assert.equal(xlsx.readUInt32LE(0), 0x04034b50);
    assert.ok(pdf.toString("ascii").startsWith("%PDF-1.4"));
    for (const [format, content] of [["json", json], ["csv", csv], ["xlsx", xlsx.toString("utf8")], ["pdf", pdf.toString("utf8")]]) {
      for (const leadID of ids) assert.equal(content.includes(leadID), authorized.some((lead) => String(lead._id) === leadID), `${role} ${format} scope`);
    }
    checks.push({ role, authorizedLeads: authorized.length, json: "PASS", csv: "PASS", xlsx: "PASS", pdf: "PASS" });
  }
  console.log(JSON.stringify({ status: "PASS", readOnly: true, target: { host: "127.0.0.1", port: 27179, database }, activityCount: activities.length, activityEvents, checks, note: "Export functions validated against saved scoped records; HTTP authenticated route was not invoked" }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", errorClass: error?.constructor?.name || "UnknownError", message: String(error?.message || "Read-only report QA failed").slice(0, 160) }));
  process.exitCode = 1;
} finally {
  await client.close();
}
