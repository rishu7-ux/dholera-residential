import assert from "node:assert/strict";
import test from "node:test";
import { CentralLeads } from "../../collections/Crm";
import { crmActivityRead, crmLeadRead, crmLeadUpdate, crmTeamRead, crmUserRead } from "../../lib/crm/access";
import { validateLeadOperationUpdate } from "../../lib/crm/lead-operations";
import { buildCrmReport, type ReportOptions } from "../../lib/crm/report-core";

const assignedTeam = {
  id: "team-a",
  office: "office-a",
  teamLeader: "leader-a",
  active: true,
};

const req = (user: object | null, team: typeof assignedTeam | null = assignedTeam) => ({
  req: {
    user,
    payload: {
      find: async () => {
        const member = user as { id?: string; role?: string; office?: string; team?: string } | null;
        const isAssignedTeam = Boolean(
          team &&
            member?.role === "team-leader" &&
            team.id === member.team &&
            team.office === member.office &&
            team.teamLeader === member.id &&
            team.active,
        );
        return { docs: isAssignedTeam ? [team] : [] };
      },
    },
  },
}) as never;

test("Super Admin sees all CRM leads while anonymous and unknown roles fail closed", async () => {
  assert.equal(await crmLeadRead(req({ id: "admin", role: "super-admin" })), true);
  assert.equal(await crmLeadUpdate(req({ id: "admin", role: "super-admin" })), true);
  assert.equal(await crmLeadRead(req(null)), false);
  assert.equal(await crmLeadUpdate(req({ id: "visitor", role: "visitor" })), false);
});

test("Salesperson reads and updates only leads assigned to their own user ID", async () => {
  const salesperson = { id: "person-1", role: "salesperson", office: "office-a", team: "team-a" };
  assert.deepEqual(await crmLeadRead(req(salesperson)), { assignedSalesperson: { equals: "person-1" } });
  assert.deepEqual(await crmLeadUpdate(req(salesperson)), { assignedSalesperson: { equals: "person-1" } });
});

test("Team Leader reads and updates only the currently assigned active team", async () => {
  const leader = { id: "leader-a", role: "team-leader", office: "office-a", team: "team-a" };
  const expected = { and: [{ office: { equals: "office-a" } }, { team: { equals: "team-a" } }] };
  assert.deepEqual(await crmLeadRead(req(leader)), expected);
  assert.deepEqual(await crmLeadUpdate(req(leader)), expected);
  assert.equal(await crmLeadRead(req({ ...leader, team: "team-b" }, null)), false, "stale team claim is denied");
  assert.equal(await crmLeadRead(req({ ...leader, office: "office-b" }, null)), false, "team assigned to another office is denied");
  assert.equal(await crmLeadRead(req({ ...leader, team: undefined })), false, "unassigned Team Leader is denied");
  assert.equal(await crmLeadRead(req(leader, { ...assignedTeam, active: false })), false, "inactive team is denied");
  assert.equal(await crmLeadRead(req(leader, { ...assignedTeam, teamLeader: "another-leader" })), false, "team reassigned to another leader is denied");
});

test("Team Leader reads only assigned team, office, and active status in related collections", async () => {
  const leader = { id: "leader-a", role: "team-leader", office: "office-a", team: "team-a" };
  const teamScope = await crmTeamRead(req(leader));
  assert.deepEqual(teamScope, {
    and: [
      { id: { equals: "team-a" } },
      { office: { equals: "office-a" } },
      { teamLeader: { equals: "leader-a" } },
      { active: { equals: true } },
    ],
  });
  assert.equal(await crmTeamRead(req({ ...leader, team: undefined })), false);
  assert.deepEqual(await crmActivityRead(req(leader)), {
    and: [{ office: { equals: "office-a" } }, { team: { equals: "team-a" } }],
  });
  assert.deepEqual(await crmUserRead(req(leader)), {
    and: [
      { and: [{ office: { equals: "office-a" } }, { team: { equals: "team-a" } }] },
      {
        or: [
          { id: { equals: "leader-a" } },
          { and: [{ role: { equals: "salesperson" } }, { team: { equals: "team-a" } }] },
        ],
      },
    ],
  });
  assert.equal(await crmTeamRead(req({ id: "person-1", role: "salesperson", office: "office-a", team: "team-a" })), false);
  assert.deepEqual(await crmUserRead(req({ id: "person-1", role: "salesperson", office: "office-a", team: "team-a" })), { id: { equals: "person-1" } });
});

test("operational update validation rejects bad status, unsafe notes and invalid follow-up schedules", () => {
  const now = new Date("2026-10-19T12:00:00.000Z");
  const original = { status: "new", notes: "", nextFollowUpAt: "2026-10-18T12:00:00.000Z" };
  const validate = (data: Record<string, unknown>) => validateLeadOperationUpdate(data, original, now);
  assert.doesNotThrow(() => validate({ status: "contacted", notes: "Called lead", nextFollowUpAt: "2026-10-20T12:00:00.000Z" }));
  assert.doesNotThrow(() => validate({ status: "qualified" }), "old overdue follow-up does not block a status update");
  assert.doesNotThrow(() => validate({ nextFollowUpAt: original.nextFollowUpAt }), "unchanged overdue follow-up remains editable");
  assert.doesNotThrow(() => validate({ nextFollowUpAt: null, notes: "" }), "a follow-up and note can be cleared");
  assert.throws(() => validate({ status: null }), (error: unknown) => {
    assert.equal((error as { status: number }).status, 400);
    assert.match((error as Error).message, /Invalid CRM lead status/);
    return true;
  }, "a submitted status cannot be missing");
  assert.throws(() => validate({ status: "invalid" }), (error: unknown) => {
    assert.match((error as Error).message, /Invalid CRM lead status/);
    assert.equal((error as { status: number }).status, 400);
    return true;
  });
  assert.throws(() => validate({ notes: "x".repeat(4001) }), /at most 4000/);
  assert.throws(() => validate({ notes: "bad\u0000note" }), /plain text/);
  for (const [nextFollowUpAt, message] of [
    ["2026-10-20", /ISO date and time/],
    ["2026-10-20T12:00:00", /ISO date and time/],
    ["not-a-date", /ISO date and time/],
    ["2026-02-30T12:00:00.000Z", /Invalid follow-up date and time/],
    ["2026-10-18T12:00:00.001Z", /New follow-up must be in the future/],
  ] as const) {
    assert.throws(() => validate({ nextFollowUpAt }), (error: unknown) => {
      assert.equal((error as { status: number }).status, 400);
      assert.match((error as Error).message, message);
      return true;
    }, `reject ${nextFollowUpAt}`);
  }
  const hook = CentralLeads.hooks?.beforeChange?.[0];
  assert.equal(typeof hook, "function");
  assert.throws(() => hook!({ operation: "update", data: { status: "invalid" }, originalDoc: original } as never), /Invalid CRM lead status/);
});

test("status, note and follow-up updates produce actor-linked activity history without a database", async () => {
  const hook = CentralLeads.hooks?.afterChange?.[0];
  assert.equal(typeof hook, "function");
  const recorded: Array<Record<string, unknown>> = [];
  const payload = { create: async (args: Record<string, unknown>) => { recorded.push(args); return { id: String(recorded.length) }; } };
  const previousDoc = { id: "lead-1", office: "office-a", assignedSalesperson: "person-1", status: "new", notes: "", nextFollowUpAt: null };
  const doc = { ...previousDoc, status: "contacted", notes: "Called the synthetic lead", nextFollowUpAt: "2026-10-20T10:00:00.000Z" };
  await hook!({ operation: "update", doc, previousDoc, req: { user: { id: "person-1" }, payload } } as never);
  assert.deepEqual(recorded.map((item) => (item.data as { event: string }).event), ["status-changed", "note-added", "follow-up-scheduled"]);
  for (const item of recorded) {
    assert.equal(item.collection, "crm-activities");
    assert.equal((item.data as { actor: string }).actor, "person-1");
    assert.equal((item.data as { lead: string }).lead, "lead-1");
    assert.equal((item.data as { office: string }).office, "office-a");
  }
  recorded.length = 0;
  await hook!({ operation: "create", doc, previousDoc, req: { user: { id: "person-1" }, payload } } as never);
  assert.equal(recorded.length, 0, "create does not manufacture update history");
  await hook!({ operation: "update", doc: { ...doc, notes: "" }, previousDoc: doc, req: { user: { id: "person-1" }, payload } } as never);
  assert.equal(recorded.length, 1);
  assert.equal((recorded[0].data as { event: string }).event, "note-added");
  assert.deepEqual((recorded[0].data as { details: object }).details, { action: "cleared", note: "" });
});

test("activity write failure is surfaced and is never silently treated as success", async () => {
  const hook = CentralLeads.hooks?.afterChange?.[0];
  assert.ok(hook);
  const doc = { id: "lead-1", office: "office-a", assignedSalesperson: "person-1", status: "contacted", notes: "" };
  await assert.rejects(
    hook({ operation: "update", doc, previousDoc: { ...doc, status: "new" }, req: { user: { id: "person-1" }, payload: { create: async () => { throw new Error("mock activity write failed"); } } } } as never),
    /mock activity write failed/,
  );
});

test("status and follow-up changes are reflected in the same report calculations", () => {
  const options: ReportOptions = { period: "all", kind: "overview", format: "json" };
  const window = { start: null, endExclusive: null, label: "All dates" };
  const now = new Date("2026-10-19T12:00:00.000Z");
  const base = { id: "lead-1", createdAt: "2026-10-18T12:00:00.000Z", status: "new", nextFollowUpAt: null, assignedSalesperson: "person-1" };
  const before = buildCrmReport([base], new Map([["person-1", "Salesperson 1"]]), options, window, now);
  const scheduled = buildCrmReport([{ ...base, status: "follow-up", nextFollowUpAt: "2026-10-20T12:00:00.000Z" }], new Map([["person-1", "Salesperson 1"]]), options, window, now);
  const converted = buildCrmReport([{ ...base, status: "converted", nextFollowUpAt: "2026-10-20T12:00:00.000Z" }], new Map([["person-1", "Salesperson 1"]]), options, window, now);
  assert.equal(before.summary.followUps.unscheduled, 1);
  assert.equal(scheduled.summary.followUps.upcoming, 1);
  assert.equal(scheduled.summary.statuses.find((item) => item.label === "follow-up")?.count, 1);
  assert.equal(converted.summary.followUps.closed, 1);
  assert.equal(converted.summary.conversionRate, 100);
});
