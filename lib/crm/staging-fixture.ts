import { validateNoidaStaffRoster, type NoidaStaffRosterRow } from "./roster";

export const NOIDA_STAGING_MARKER = "/crm-integration-test";

export const NOIDA_LEAD_CAPTURE_ROUTES = [
  { route: "app/api/omana-leads/route.ts", secret: "OMANA_INGEST_SECRET", website: "omana-projects" },
  { route: "app/api/estate1-leads/route.ts", secret: "ESTATE1_INGEST_SECRET", website: "dholera-estate-1" },
  { route: "app/api/estate2-leads/route.ts", secret: "ESTATE2_INGEST_SECRET", website: "dholera-estate-2" },
  { route: "app/api/dholera-estates-leads/route.ts", secret: "DHOLERA_ESTATES_INGEST_SECRET", website: "dholeraestates" },
  { route: "app/api/industrial-leads/route.ts", secret: "INDUSTRIAL_INGEST_SECRET", website: "dholeraindustrial" },
] as const;

export function buildNoidaStagingFixture(runId: string) {
  if (!/^[a-z0-9][a-z0-9-]{5,63}$/.test(runId)) {
    throw new Error("Synthetic run ID must contain 6-64 lowercase letters, digits, or hyphens.");
  }

  const salespeople: NoidaStaffRosterRow[] = Array.from({ length: 10 }, (_, index) => ({
    fullName: `Synthetic Noida Salesperson ${String(index + 1).padStart(2, "0")}`,
    officialEmail: `${runId}.sales${String(index + 1).padStart(2, "0")}@example.invalid`,
    role: "salesperson",
    office: "noida",
    assignmentOrder: index + 1,
    active: true,
    existingUserReference: null,
  }));
  const teamLeader: NoidaStaffRosterRow = {
    fullName: "Synthetic Noida Team Leader",
    officialEmail: `${runId}.leader@example.invalid`,
    role: "team-leader",
    office: "noida",
    assignmentOrder: null,
    active: true,
    existingUserReference: null,
  };
  const roster = [...salespeople, teamLeader];
  const rosterResult = validateNoidaStaffRoster(roster);
  if (!rosterResult.valid) throw new Error(rosterResult.errors.join(" "));

  const leads = Array.from({ length: 10 }, (_, index) => {
    const source = NOIDA_LEAD_CAPTURE_ROUTES[index % NOIDA_LEAD_CAPTURE_ROUTES.length];
    return {
      name: `Synthetic Noida Lead ${String(index + 1).padStart(2, "0")}`,
      email: `${runId}.lead${String(index + 1).padStart(2, "0")}@example.invalid`,
      phone: `+91990000${String(index + 1).padStart(4, "0")}`,
      website: source.website,
      leadType: index === 0 ? "chatbot" : "enquiry",
      source: `synthetic-${source.website}`,
      project: "Synthetic Noida project",
      message: "Synthetic TEST fixture; no real customer data.",
      page: NOIDA_STAGING_MARKER,
      consent: true,
      idempotencyKey: `${runId}-lead-${String(index + 1).padStart(2, "0")}`,
      expectedAssignmentOrder: index + 1,
    };
  });

  return {
    runId,
    passwordSource: "CRM_TEST_LOGIN_PASSWORD",
    office: { name: "Noida", code: "noida", active: true },
    team: { name: `crm-test-${runId}`, active: true },
    superAdmin: {
      name: "Synthetic Noida Super Admin",
      email: `${runId}.admin@example.invalid`,
      role: "super-admin" as const,
      active: true,
    },
    roster,
    leads,
    duplicateReplay: { idempotencyKey: leads[0]!.idempotencyKey, expectedAdditionalDocuments: 0 },
    expected: {
      offices: 1,
      teams: 1,
      users: 12,
      salespeople: 10,
      teamLeaders: 1,
      superAdmins: 1,
      centralLeads: 10,
      assignmentCounters: 1,
      minimumActivities: 20,
    },
  };
}
