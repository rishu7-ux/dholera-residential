import { isSuperAdmin, relationshipId } from "./access";

export type CrmOfficeCode = "noida" | "ahmedabad";
type User = { role?: string | null; office?: string | number | { id?: string | number } | null } | null | undefined;
type Office = { id: string | number; code?: string | null; name?: string | null; active?: boolean | null };

export function requestedCrmOffice(raw: string | null): CrmOfficeCode | null {
  if (raw === null) return null;
  if (raw === "noida" || raw === "ahmedabad") return raw;
  throw new Error("Unknown CRM office");
}

export function requestedCrmOfficeFromURL(url: URL): CrmOfficeCode | null {
  const values = url.searchParams.getAll("office");
  if (values.length > 1) throw new Error("Repeated CRM office");
  return requestedCrmOffice(values[0] ?? null);
}

/** Resolve only one active, allowed office. Relationships and data queries use its ID. */
export function selectCrmOffice<T extends Office>(user: User, offices: readonly T[], requested: CrmOfficeCode | null): T | null {
  if (!user) return null;
  const assignedId = relationshipId(user.office);
  const matches = offices.filter((office) => {
    const code = office.code?.trim().toLowerCase();
    return office.active === true && (code === "noida" || code === "ahmedabad") &&
      (isSuperAdmin(user) || assignedId === String(office.id)) &&
      (requested === null ? (isSuperAdmin(user) ? code === "noida" : true) : code === requested);
  });
  return matches.length === 1 ? matches[0] : null;
}
