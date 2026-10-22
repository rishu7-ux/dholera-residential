import type { Access, FieldAccess, Where } from "payload";

export type CrmRole = "super-admin" | "team-leader" | "salesperson";

type CrmUser = {
  id?: string | number;
  role?: CrmRole | string;
  office?: string | number | { id?: string | number } | null;
};

export function relationshipId(value: CrmUser["office"]) {
  if (value && typeof value === "object") return String(value.id || "");
  return value == null ? "" : String(value);
}

// Accounts created before CRM roles were introduced retain the established CMS admin role.
export const isSuperAdmin = (user: CrmUser | null | undefined) =>
  Boolean(user && (!user.role || user.role === "super-admin"));

export const authenticated: Access = ({ req }) => Boolean(req.user);

export const superAdminOnly: Access = ({ req }) => isSuperAdmin(req.user as CrmUser);
export const crmContentHidden = ({ user }: { user: CrmUser | null | undefined }) => !isSuperAdmin(user);
export const isCrmRole = (role?: string | null) => role === "team-leader" || role === "salesperson";
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

export const crmTeamRead: Access = ({ req }) => {
  const user = req.user as CrmUser | null;
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const office = relationshipId(user.office);
  return office ? ({ office: { equals: office } } as Where) : false;
};

export const crmLeadRead: Access = ({ req }) => {
  const user = req.user as CrmUser | null;
  if (!user) return false;
  if (user.role === "super-admin") return true;
  if (user.role === "team-leader") {
    const office = relationshipId(user.office);
    return office ? ({ office: { equals: office } } as Where) : false;
  }
  if (user.role === "salesperson") {
    return { assignedSalesperson: { equals: String(user.id) } } as Where;
  }
  return false;
};

export const crmLeadUpdate: Access = crmLeadRead;
export const superAdminField: FieldAccess = ({ req }) => isSuperAdmin(req.user as CrmUser);
