import assert from "node:assert/strict";
import test from "node:test";
import { crmKpiCollectionURL, leadRowsForKpi } from "../../lib/crm/dashboard-kpi";
import { endCrmSession, isCurrentCrmSession } from "../../lib/crm/dashboard-session";

const offices = [
  { officeId: "aaaaaaaaaaaaaaaaaaaaaaaa", teamId: "bbbbbbbbbbbbbbbbbbbbbbbb", userId: "cccccccccccccccccccccccc" },
  { officeId: "dddddddddddddddddddddddd", teamId: "eeeeeeeeeeeeeeeeeeeeeeee", userId: "ffffffffffffffffffffffff" },
];

test("KPI collection links keep Noida and Ahmedabad office/team/person scope", () => {
  for (const office of offices) {
    for (const role of ["super-admin", "team-leader", "salesperson"] as const) {
      const scope = { ...office, role };
      const contacts = crmKpiCollectionURL("contacts", scope);
      assert.ok(contacts);
      const contactURL = new URL(contacts, "https://cms.example.invalid");
      assert.equal(contactURL.pathname, "/admin/collections/central-leads");
      assert.equal(contactURL.searchParams.get("where[office][equals]"), office.officeId);
      assert.equal(contactURL.searchParams.get("where[leadType][equals]"), "contact");
      assert.equal(contactURL.searchParams.get("where[team][equals]"), role === "super-admin" ? null : office.teamId);
      assert.equal(contactURL.searchParams.get("where[assignedSalesperson][equals]"), role === "salesperson" ? office.userId : null);

      const salespeople = crmKpiCollectionURL("salespeople", scope);
      if (role === "salesperson") assert.equal(salespeople, null);
      else {
        assert.ok(salespeople);
        const peopleURL = new URL(salespeople, "https://cms.example.invalid");
        assert.equal(peopleURL.pathname, "/admin/collections/users");
        assert.equal(peopleURL.searchParams.get("where[office][equals]"), office.officeId);
        assert.equal(peopleURL.searchParams.get("where[team][equals]"), role === "team-leader" ? office.teamId : null);
        assert.equal(peopleURL.searchParams.get("where[role][equals]"), "salesperson");
        assert.equal(peopleURL.searchParams.get("where[active][not_equals]"), "false");
      }
    }
  }
  assert.equal(crmKpiCollectionURL("contacts", { ...offices[0], role: "salesperson", teamId: "" }), null);
});

test("lead KPI views narrow the already-authorized report rows", () => {
  const now = Date.parse("2026-11-25T10:00:00Z");
  const row = (id: string, status: string, followUp: string) => [id, "", "", "", "", "", "", status, "", "", followUp];
  const rows = [
    row("new-upcoming", "new", "2026-11-25T11:00:00Z"),
    row("new-overdue", "new", "2026-11-25T09:00:00Z"),
    row("converted", "converted", "2026-11-25T09:00:00Z"),
    row("lost", "lost", "2026-11-25T09:00:00Z"),
    row("unscheduled", "contacted", ""),
  ];
  const ids = (view: Parameters<typeof leadRowsForKpi>[1]) => leadRowsForKpi(rows, view, now).map((item) => item[0]);
  assert.deepEqual(ids("total"), rows.map((item) => item[0]));
  assert.deepEqual(ids("today"), rows.map((item) => item[0]));
  assert.deepEqual(ids("new"), ["new-upcoming", "new-overdue"]);
  assert.deepEqual(ids("converted"), ["converted"]);
  assert.deepEqual(ids("conversion"), ["converted"]);
  assert.deepEqual(ids("pending"), ["new-upcoming"]);
  assert.deepEqual(ids("overdue"), ["new-overdue"]);
});

test("logout posts to Payload and verifies the session ended", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ user: null }) };
  };
  await endCrmSession(fetcher);
  assert.deepEqual(calls.map((call) => call.url), ["/api/users/logout", "/api/users/me"]);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.credentials, "same-origin");
  assert.equal(calls[1].init.cache, "no-store");
});

test("logout fails closed when Payload rejects it or retains the session", async () => {
  await assert.rejects(endCrmSession(async () => ({ ok: false, status: 500, json: async () => ({}) })));
  let calls = 0;
  await assert.rejects(endCrmSession(async () => {
    calls++;
    return { ok: true, status: 200, json: async () => ({ user: { id: "still-signed-in" } }) };
  }));
  assert.equal(calls, 2);
});

test("browser history restores CRM data only for the same authenticated account", () => {
  assert.equal(isCurrentCrmSession({ user: { id: "123" } }, "123"), true);
  assert.equal(isCurrentCrmSession({ user: { id: "456" } }, "123"), false);
  assert.equal(isCurrentCrmSession({ user: null }, "123"), false);
  assert.equal(isCurrentCrmSession(null, "123"), false);
});
