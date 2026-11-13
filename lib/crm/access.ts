import type { Access, FieldAccess, Payload, Where } from "payload";

export type CrmRole = "super-admin" | "team-leader" | "salesperson";

type CrmUser = {
  id?: string | number;
  role?: CrmRole | string;
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

async function assignedTeamScope(
  user: CrmUser,
  payload: Pick<Payload, "find">,
): Promise<Where | false> {
  const office = relationshipId(user.office);
  const team = relationshipId(user.team);
  if (!user.id || user.role !== "team-leader" || !office || !team) return false;
  const assignedTeam = await payload.find({
    collection: "crm-teams",
    where: {
      and: [
        { id: { equals: team } },
        { office: { equals: office } },
        { teamLeader: { equals: String(user.id) } },
        { active: { equals: true } },
      ],
    },
    depth: 0,
    limit: 2,
    overrideAccess: true,
  });
  if (assignedTeam.docs.length !== 1) return false;
  return {
    and: [
      { office: { equals: office } },
      { team: { equals: team } },
    ],
  } as Where;
}

export const crmTeamRead: Access = ({ req }) => {
  const user = req.user as CrmUser | null;
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const office = relationshipId(user.office);
  const team = relationshipId(user.team);
  if (user.role !== "team-leader" || !user.id || !office || !team) return false;
  return {
    and: [
      { id: { equals: team } },
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
  const team = relationshipId(user.team);
  return {
    and: [
      scope,
      {
        or: [
          { id: { equals: String(user.id) } },
          {
            and: [
              { role: { equals: "salesperson" } },
              { team: { equals: team } },
            ],
          },
        ],
      },
    ],
  } as Where;
};

export const crmLeadRead: Access = async ({ req }) => {
  const user = req.user as CrmUser | null;
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (user.role === "team-leader") {
    return assignedTeamScope(user, req.payload);
  }
  if (user.role === "salesperson") {
    return user.id ? ({ assignedSalesperson: { equals: String(user.id) } } as Where) : false;
  }
  return false;
};

export const crmLeadUpdate: Access = crmLeadRead;
export const crmActivityRead: Access = async ({ req }) => {
  const user = req.user as CrmUser | null;
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (user.role === "team-leader") return assignedTeamScope(user, req.payload);
  if (user.role === "salesperson") {
    const office = relationshipId(user.office);
    return user.id && office
      ? ({ and: [
          { office: { equals: office } },
          { assignedSalesperson: { equals: String(user.id) } },
        ] } as Where)
      : false;
  }
  return false;
};
export const superAdminField: FieldAccess = ({ req }) => isSuperAdmin(req.user as CrmUser);
