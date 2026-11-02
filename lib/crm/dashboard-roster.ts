type Person = {
  id: string | number;
  name?: string | null;
  role?: string | null;
  office?: unknown;
  team?: unknown;
  active?: boolean | null;
};

type Team = {
  id: string | number;
  office?: unknown;
  teamLeader?: unknown;
  salespeople?: readonly unknown[] | null;
  active?: boolean | null;
};

export function dashboardRelationshipId(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const relation = value as { id?: unknown; toHexString?: () => string };
    if (typeof relation.toHexString === "function") return relation.toHexString();
    if (relation.id !== undefined) return dashboardRelationshipId(relation.id);
  }
  return "";
}

export function dashboardTeamAuthorized(
  team: Team | null | undefined,
  leaderId: string | number,
  officeId: string | number,
): boolean {
  return Boolean(
    team?.active === true &&
      dashboardRelationshipId(team.office) === String(officeId) &&
      dashboardRelationshipId(team.teamLeader) === String(leaderId),
  );
}

export function selectDashboardRoster({
  role,
  userId,
  officeId,
  team,
  people,
}: {
  role: string | undefined;
  userId: string | number;
  officeId: string | number;
  team?: Team | null;
  people: readonly Person[];
}) {
  // Existing CMS administrators can predate the CRM role field.
  const admin = !role || role === "super-admin";
  if (!admin && role !== "team-leader") return [];
  if (role === "team-leader" && !dashboardTeamAuthorized(team, userId, officeId)) return [];

  const members = !admin
    ? new Set((team?.salespeople ?? []).map(dashboardRelationshipId).filter(Boolean))
    : null;
  return people
    .filter((person) =>
      person.role === "salesperson" &&
      dashboardRelationshipId(person.office) === String(officeId) &&
      (admin ||
        (dashboardRelationshipId(person.team) === String(team?.id) &&
          members?.has(String(person.id)) === true)),
    )
    .map((person) => ({
      id: String(person.id),
      name: person.name || "Salesperson",
      active: person.active !== false,
    }));
}
