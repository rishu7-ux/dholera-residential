import assert from "node:assert/strict";
import test from "node:test";
import { assignedTeamScope, crmActivityRead, crmLeadRead } from "../../lib/crm/access";
import { selectDashboardRoster } from "../../lib/crm/dashboard-roster";
import { reportPDF, reportXLSX } from "../../lib/crm/report-export";
import { requestedCrmOffice, requestedCrmOfficeFromURL, selectCrmOffice } from "../../lib/crm/office-scope";

const offices = [
  { id: "office-noida", code: "noida", name: "Noida", active: true },
  { id: "office-ahmedabad", code: "Ahmedabad", name: "Ahmedabad", active: true },
];

test("Super Admin can select either active office, including existing capitalized Ahmedabad code", () => {
  const admin = { role: "super-admin" };
  assert.equal(selectCrmOffice(admin, offices, null)?.id, "office-noida");
  assert.equal(selectCrmOffice(admin, offices, requestedCrmOffice("ahmedabad"))?.id, "office-ahmedabad");
  assert.throws(() => requestedCrmOffice("other"));
  assert.throws(() => requestedCrmOfficeFromURL(new URL("https://crm.example.invalid/?office=noida&office=ahmedabad")));
});

test("Team Leader and salesperson cannot select the other office or an ambiguous office", () => {
  for (const role of ["team-leader", "salesperson"]) {
    const user = { role, office: "office-ahmedabad" };
    assert.equal(selectCrmOffice(user, offices, null)?.id, "office-ahmedabad");
    assert.equal(selectCrmOffice(user, offices, "noida"), null);
    assert.equal(selectCrmOffice(user, offices, "ahmedabad")?.id, "office-ahmedabad");
  }
  assert.equal(selectCrmOffice({ role: "super-admin" }, [...offices, { ...offices[1], id: "duplicate" }], "ahmedabad"), null);
  assert.equal(selectCrmOffice({ role: "super-admin" }, [{ ...offices[1], active: false }], "ahmedabad"), null);
});

test("salesperson lead and activity RBAC both require matching office, team and assigned user", async () => {
  const user = { id: "salesperson-a", role: "salesperson", office: "office-ahmedabad", team: "team-vishnu" };
  const req = { user } as never;
  const expected = { and: [
    { office: { equals: "office-ahmedabad" } },
    { team: { equals: "team-vishnu" } },
    { assignedSalesperson: { equals: "salesperson-a" } },
  ] };
  assert.deepEqual(await (crmLeadRead as (input: unknown) => unknown)({ req }), expected);
  assert.deepEqual(await (crmActivityRead as (input: unknown) => unknown)({ req }), expected);
  assert.equal(await (crmLeadRead as (input: unknown) => unknown)({ req: { user: { ...user, team: null } } }), false);
});

test("Ahmedabad Team Leader scope and roster exclude Noida records", async () => {
  const leader = { id: "leader-vishnu", role: "team-leader", office: "office-ahmedabad", team: "team-vishnu" };
  const team = { id: "team-vishnu", office: "office-ahmedabad", teamLeader: "leader-vishnu", active: true,
    salespeople: ["salesperson-a", "salesperson-noida"] };
  const payload = { find: async (query: { where: unknown }) => {
    assert.deepEqual(query.where, { and: [
      { id: { equals: "team-vishnu" } }, { office: { equals: "office-ahmedabad" } },
      { teamLeader: { equals: "leader-vishnu" } }, { active: { equals: true } },
    ] });
    return { totalDocs: 1, docs: [team] };
  } };
  const scope = await assignedTeamScope(leader, payload as never);
  assert.deepEqual(scope && scope.where, { and: [
    { office: { equals: "office-ahmedabad" } }, { team: { equals: "team-vishnu" } },
  ] });
  const roster = selectDashboardRoster({ role: "team-leader", userId: leader.id, officeId: leader.office,
    team, people: [
      { id: "salesperson-a", role: "salesperson", office: "office-ahmedabad", team: "team-vishnu", name: "A" },
      { id: "salesperson-noida", role: "salesperson", office: "office-noida", team: "team-noida", name: "N" },
    ] });
  assert.deepEqual(roster.map((person) => person.id), ["salesperson-a"]);
});

test("Ahmedabad exports carry the selected office name", () => {
  const table = { headers: ["Lead"], rows: [["Dummy"]] };
  assert.match(reportPDF(table, "Ahmedabad CRM report", "Ahmedabad").toString(), /authorized Ahmedabad CRM records/);
  assert.match(reportXLSX(table, "Ahmedabad").toString(), /Ahmedabad CRM Report/);
});
