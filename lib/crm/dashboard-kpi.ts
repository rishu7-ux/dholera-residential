export type DashboardRole = "super-admin" | "team-leader" | "salesperson";
export type LeadKpiView = "total" | "today" | "new" | "converted" | "pending" | "overdue" | "conversion";

type Scope = {
  role: DashboardRole;
  officeId: string;
  teamId: string;
  userId: string;
};

/** Collection links are scoped for clarity; Payload RBAC independently enforces access. */
export function crmKpiCollectionURL(kind: "contacts" | "salespeople", scope: Scope): string | null {
  if (!scope.officeId || (kind === "salespeople" && scope.role === "salesperson")) return null;
  if (scope.role !== "super-admin" && !scope.teamId) return null;
  if (scope.role === "salesperson" && !scope.userId) return null;

  const query = new URLSearchParams();
  query.set("where[office][equals]", scope.officeId);
  if (scope.role !== "super-admin") query.set("where[team][equals]", scope.teamId);
  if (kind === "contacts") {
    query.set("where[leadType][equals]", "contact");
    if (scope.role === "salesperson") query.set("where[assignedSalesperson][equals]", scope.userId);
  } else {
    query.set("where[role][equals]", "salesperson");
    // The existing dashboard roster treats only explicit false as inactive.
    query.set("where[active][not_equals]", "false");
  }
  const collection = kind === "contacts" ? "central-leads" : "users";
  return `/admin/collections/${collection}?${query.toString()}`;
}

/** The overview report already contains only server-authorized office/team/person rows. */
export function leadRowsForKpi(rows: readonly string[][], view: LeadKpiView | null, now: number): string[][] {
  if (!view || view === "total" || view === "today") return [...rows];
  return rows.filter((row) => {
    const status = row[7];
    if (view === "new") return status === "new";
    if (view === "converted" || view === "conversion") return status === "converted";
    if (status === "converted" || status === "lost") return false;
    const followUpAt = Date.parse(row[10] || "");
    if (!Number.isFinite(followUpAt)) return false;
    return view === "pending" ? followUpAt >= now : followUpAt < now;
  });
}
