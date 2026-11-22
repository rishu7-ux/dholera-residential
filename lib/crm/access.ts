import type { Access, FieldAccess, Payload, Where } from "payload";

export type CrmRole = "super-admin" | "team-leader" | "salesperson";

type CrmUser = {
  id?: string | number;
  role?: CrmRole | string | null;
  office?: string | number | { id?: string | number } | null;
  team?: string | number | { id?: string | number } | null;
};

export function relationshipId(value: unknown) {
  if (value && typeof value === "object") {
    const relation = value as { id?: unknown; toHexString?: () => string };
    if (typeof relation.toHexString === "function") return relation.toHexString();
    if (relation.id !== undefined) return relationshipId(relation.id);
    return "";
  }
  return value == null ? "" : String(value);
}

// Accounts created before CRM roles were introduced retain the established CMS admin role.
export const isSuperAdmin = (user: CrmUser | null | undefined) =>
  Boolean(user && (!user.role || user.role === "super-admin"));

/** Give new accounts explicit CRM fields without backfilling legacy CMS admins on read or update. */
export function prepareNewCrmUser(data: Record<string, unknown> | undefined) {
  const name = typeof data?.name === "string" ? data.name.trim() : "";
  if (!name) throw new Error("A name is required for a new CMS user");

  const role = data?.role == null || data.role === "" ? "salesperson" : data.role;
  if (role !== "super-admin" && role !== "team-leader" && role !== "salesperson") {
    throw new Error("Invalid CRM user role");
  }

  const active = data?.active == null ? true : data.active;
  const eligibleForAssignment = data?.eligibleForAssignment == null ? true : data.eligibleForAssignment;
  if (typeof active !== "boolean" || typeof eligibleForAssignment !== "boolean") {
    throw new Error("CRM user status must be a checkbox value");
  }

  return { ...data, name, role, active, eligibleForAssignment };
}

/** A CRM account must not become a legacy, roleless CMS administrator on update. */
export function preserveCrmUserRole(
  data: Record<string, unknown> | undefined,
  originalDoc: Record<string, unknown> | undefined,
) {
  if (originalDoc?.role && data && Object.hasOwn(data, "role") && !data.role) {
    throw new Error("An existing CRM user role cannot be cleared");
  }
  return data;
}

export const authenticated: Access = ({ req }) => Boolean(req.user);

export const superAdminOnly: Access = ({ req }) => isSuperAdmin(req.user as CrmUser);
export const crmContentHidden = ({ user }: { user: CrmUser | null | undefined }) => !isSuperAdmin(user);
export const isCrmRole = (role?: string | null) => role === "team-leader" || role === "salesperson";

export function noidaDashboardAccess(user: CrmUser | null | undefined, officeId?: string | number): "allowed" | "setup-required" | "denied" {
  if (!user) return "denied";
  if (isSuperAdmin(user)) return officeId == null ? "setup-required" : "allowed";
  if (!isCrmRole(user.role)) return "denied";
  return officeId != null && relationshipId(user.office) === String(officeId) ? "allowed" : "denied";
}
export const legacyLeadAdminAccess = {
  create: superAdminOnly,
  read: superAdminOnly,
  update: superAdminOnly,
  delete: superAdminOnly,
};

export const crmOfficeRead: Access = ({ req }) => {
  const user = req.user as CrmUser | null;
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const office = relationshipId(user.office);
  return office ? ({ id: { equals: office } } as Where) : false;
};

export async function assignedTeamScope(
  user: CrmUser,
  payload: Pick<Payload, "find">,
): Promise<{ teamId: string; where: Where } | false> {
  const office = relationshipId(user.office);
  const team = relationshipId(user.team);
  if (!user.id || user.role !== "team-leader" || !office) return false;
  const assignedTeam = await payload.find({
    collection: "crm-teams",
    where: {
      and: [
        ...(team ? [{ id: { equals: team } }] : []),
        { office: { equals: office } },
        { teamLeader: { equals: String(user.id) } },
        { active: { equals: true } },
      ],
    },
    depth: 0,
    limit: 2,
    overrideAccess: true,
  });
  if (assignedTeam.totalDocs !== 1 || assignedTeam.docs.length !== 1) return false;
  const teamId = String(assignedTeam.docs[0].id);
  return {
    teamId,
    where: { and: [
      { office: { equals: office } },
      { team: { equals: teamId } },
    ] } as Where,
  };
}

export const crmTeamRead: Access = ({ req }) => {
  const user = req.user as CrmUser | null;
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const office = relationshipId(user.office);
  const team = relationshipId(user.team);
  if (user.role !== "team-leader" || !user.id || !office) return false;
  return {
    and: [
      ...(team ? [{ id: { equals: team } }] : []),
      { office: { equals: office } },
      { teamLeader: { equals: String(user.id) } },
      { active: { equals: true } },
    ],
  } as Where;
};

export const crmUserRead: Access = async ({ req }) => {
  const user = req.user as CrmUser | null;
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (user.role === "salesperson") {
    return user.id ? ({ id: { equals: String(user.id) } } as Where) : false;
  }
  if (user.role !== "team-leader" || !user.id) return false;
  const scope = await assignedTeamScope(user, req.payload);
  if (!scope) return false;
  return {
    or: [
      { id: { equals: String(user.id) } },
      { and: [
        { role: { equals: "salesperson" } },
        scope.where,
      ] },
    ],
  } as Where;
};

export const crmLeadRead: Access = async ({ req }) => {
  const user = req.user as CrmUser | null;
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (user.role === "team-leader") {
    const scope = await assignedTeamScope(user, req.payload);
    return scope ? scope.where : false;
  }
  if (user.role === "salesperson") {
    const office = relationshipId(user.office);
    const team = relationshipId(user.team);
    return user.id && office && team ? ({ and: [
      { office: { equals: office } },
      { team: { equals: team } },
      { assignedSalesperson: { equals: String(user.id) } },
    ] } as Where) : false;
  }
  return false;
};

export const crmLeadUpdate: Access = crmLeadRead;
export const crmActivityRead: Access = async ({ req }) => {
  const user = req.user as CrmUser | null;
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (user.role === "team-leader") {
    const scope = await assignedTeamScope(user, req.payload);
    return scope ? scope.where : false;
  }
  if (user.role === "salesperson") {
    const office = relationshipId(user.office);
    const team = relationshipId(user.team);
    return user.id && office && team
      ? ({ and: [
          { office: { equals: office } },
          { team: { equals: team } },
          { assignedSalesperson: { equals: String(user.id) } },
        ] } as Where)
      : false;
  }
  return false;
};
export const superAdminField: FieldAccess = ({ req }) => isSuperAdmin(req.user as CrmUser);
