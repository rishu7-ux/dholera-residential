import assert from "node:assert/strict";
import test from "node:test";

import { noidaDashboardAccess } from "../../lib/crm/access";
import { dashboardRelationshipId, dashboardTeamAuthorized, selectDashboardRoster } from "../../lib/crm/dashboard-roster";

test("Super Admin sees setup state until the Noida office exists", () => {
  const admin = { id: "admin", role: "super-admin" };
  assert.equal(noidaDashboardAccess(admin), "setup-required");
  assert.equal(noidaDashboardAccess(admin, "noida-office"), "allowed");
});

test("Team Leader access remains scoped to the assigned office", () => {
  const leader = { id: "leader", role: "team-leader", office: "noida-office" };
  assert.equal(noidaDashboardAccess(leader, "noida-office"), "allowed");
  assert.equal(noidaDashboardAccess(leader, "other-office"), "denied");
  assert.equal(noidaDashboardAccess({ ...leader, office: undefined }, "noida-office"), "denied");
  assert.equal(noidaDashboardAccess(leader), "denied");
});

test("Salesperson access remains scoped to the assigned office", () => {
  const salesperson = { id: "salesperson", role: "salesperson", office: { id: "noida-office" } };
  assert.equal(noidaDashboardAccess(salesperson, "noida-office"), "allowed");
  assert.equal(noidaDashboardAccess(salesperson, "other-office"), "denied");
  assert.equal(noidaDashboardAccess(salesperson), "denied");
});

test("anonymous and unsupported roles are denied", () => {
  assert.equal(noidaDashboardAccess(null, "noida-office"), "denied");
  assert.equal(noidaDashboardAccess({ id: "other", role: "visitor" }, "noida-office"), "denied");
});

test("Team Leader roster requires both team links and the assigned office", () => {
  const ids = Array.from({ length: 10 }, (_, index) => `sales-${index + 1}`);
  const team = {
    id: "noida-team", office: { id: "noida-office" },
    teamLeader: { id: "leader" }, active: true,
    salespeople: ids.map((id) => ({ id })),
  };
  const people = [
    ...ids.map((id) => ({ id, name: id, role: "salesperson", office: "noida-office", team: { id: "noida-team" }, active: true })),
    { id: "other-team", name: "Other team", role: "salesperson", office: "noida-office", team: "different-team", active: true },
    { id: "other-office", name: "Other office", role: "salesperson", office: "different-office", team: "noida-team", active: true },
  ];
  assert.equal(dashboardTeamAuthorized(team, "leader", "noida-office"), true);
  const leader = selectDashboardRoster({ role: "team-leader", userId: "leader", officeId: "noida-office", team, people });
  assert.deepEqual(leader.map(({ id }) => id), ids);
  assert.equal(leader.filter(({ active }) => active).length, 10);
  assert.deepEqual(selectDashboardRoster({ role: "salesperson", userId: ids[0], officeId: "noida-office", team, people }), []);
  assert.equal(selectDashboardRoster({ role: "super-admin", userId: "admin", officeId: "noida-office", people }).length, 11);
  assert.equal(selectDashboardRoster({ role: undefined, userId: "legacy-admin", officeId: "noida-office", people }).length, 11);
});

test("Team Leader roster fails closed for an unrelated or inactive team", () => {
  const person = { id: "sales-1", role: "salesperson", office: "noida-office", team: "noida-team" };
  const team = { id: "noida-team", office: "noida-office", teamLeader: "leader", salespeople: ["sales-1"], active: true };
  for (const invalid of [
    { ...team, teamLeader: "another-leader" },
    { ...team, office: "another-office" },
    { ...team, active: false },
  ]) {
    assert.equal(dashboardTeamAuthorized(invalid, "leader", "noida-office"), false);
    assert.deepEqual(selectDashboardRoster({ role: "team-leader", userId: "leader", officeId: "noida-office", team: invalid, people: [person] }), []);
  }
  assert.deepEqual(selectDashboardRoster({ role: "team-leader", userId: "leader", officeId: "noida-office", team: { ...team, salespeople: [] }, people: [person] }), []);
});

test("relationship normalization uses ObjectId hex rather than raw bytes", () => {
  const hex = "507f1f77bcf86cd799439011";
  assert.equal(dashboardRelationshipId({ id: Buffer.from(hex, "hex"), toHexString: () => hex }), hex);
  assert.equal(dashboardRelationshipId({ id: { id: hex } }), hex);
  assert.equal(dashboardRelationshipId(null), "");
});
