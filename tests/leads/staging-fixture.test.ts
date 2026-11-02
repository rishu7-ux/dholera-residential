import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildNoidaStagingFixture,
  NOIDA_LEAD_CAPTURE_ROUTES,
  NOIDA_STAGING_MARKER,
} from "../../lib/crm/staging-fixture";
import {
  crmLeadRead,
  crmOfficeRead,
  crmTeamRead,
  superAdminField,
  superAdminOnly,
} from "../../lib/crm/access";
import { selectRoundRobinSalesperson } from "../../lib/leads/roundRobin";

const fixture = buildNoidaStagingFixture("noida-stage-plan-20261016");
const request = (user: Record<string, unknown> | null) => ({ req: { user } }) as never;

test("minimum synthetic staging fixture contains the exact Noida roster and no customer identities", () => {
  assert.deepEqual(fixture.expected, {
    offices: 1,
    teams: 1,
    users: 12,
    salespeople: 10,
    teamLeaders: 1,
    superAdmins: 1,
    centralLeads: 10,
    assignmentCounters: 1,
    minimumActivities: 20,
  });
  assert.equal(fixture.roster.filter(({ role }) => role === "salesperson").length, 10);
  assert.equal(fixture.roster.filter(({ role }) => role === "team-leader").length, 1);
  assert.ok(fixture.roster.every(({ officialEmail }) => officialEmail.endsWith("@example.invalid")));
  assert.ok(fixture.leads.every(({ email, page, consent }) =>
    email.endsWith("@example.invalid") && page === NOIDA_STAGING_MARKER && consent));
});

test("ten planned leads complete exactly one ten-person round-robin cycle", () => {
  const salespeople = fixture.roster
    .filter(({ role }) => role === "salesperson")
    .map((person) => ({
      id: `sales-${person.assignmentOrder}`,
      name: person.fullName,
      active: person.active,
      rotationOrder: person.assignmentOrder!,
    }));
  const selected = fixture.leads.map((_, index) =>
    selectRoundRobinSalesperson(salespeople, index + 1)?.rotationOrder);
  assert.deepEqual(selected, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(fixture.duplicateReplay.expectedAdditionalDocuments, 0);
});

test("CRM access filters enforce salesperson, Team Leader, Super Admin, and anonymous scope", () => {
  assert.equal(crmLeadRead(request(null)), false);
  assert.equal(crmLeadRead(request({ id: "admin", role: "super-admin" })), true);
  assert.deepEqual(crmLeadRead(request({ id: "leader", role: "team-leader", office: "office-noida" })), {
    office: { equals: "office-noida" },
  });
  assert.deepEqual(crmLeadRead(request({ id: "sales-1", role: "salesperson", office: "office-noida" })), {
    assignedSalesperson: { equals: "sales-1" },
  });
  assert.deepEqual(crmOfficeRead(request({ role: "team-leader", office: "office-noida" })), {
    id: { equals: "office-noida" },
  });
  assert.deepEqual(crmTeamRead(request({ role: "salesperson", office: "office-noida" })), {
    office: { equals: "office-noida" },
  });
  assert.equal(superAdminOnly(request({ role: "salesperson" })), false);
  assert.equal(superAdminField(request({ role: "salesperson" })), false);
});

test("all five TEST lead routes retain authentication and central CRM ingestion wiring", () => {
  assert.equal(NOIDA_LEAD_CAPTURE_ROUTES.length, 5);
  for (const integration of NOIDA_LEAD_CAPTURE_ROUTES) {
    const source = readFileSync(resolve(integration.route), "utf8");
    assert.match(source, /ingest(?:CentralLead|LeadWithLegacy)/);
    assert.ok(source.includes(integration.secret));
    assert.ok(source.includes(integration.website));
    assert.match(source, /idempotency/i);
  }
});

test("database-backed CRM integration is approval-gated and always cleans its run", () => {
  const source = readFileSync(resolve("tests/leads/crm.integration.ts"), "utf8");
  assert.match(source, /NOIDA_TEST_DB_WRITE_APPROVAL/);
  assert.match(source, /APPROVE_NOIDA_SYNTHETIC_CRM_WRITES/);
  assert.match(source, /CRM fixtures must be cleaned after the approved integration run/);
  assert.match(source, /afterRotation/);
  assert.match(source, /failed transaction leaves no lead/);
  assert.match(source, /all records created by this synthetic run are removed from TEST/);
  assert.match(source, /finally \{\s*await cleanup\(\);/);
});
