"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@payloadcms/ui";
import { LuLayoutDashboard } from "react-icons/lu";
import "./crm-dashboard.css";

type OfficeCode = "noida" | "ahmedabad";
type OfficeRef = string | number | { id?: string | number; code?: string | null } | null;

function knownOfficeCode(value: unknown): OfficeCode | null {
  const code = typeof value === "string" ? value.trim().toLowerCase() : "";
  return code === "noida" || code === "ahmedabad" ? code : null;
}

export default function CrmNavLink() {
  const { user } = useAuth<{ role?: string; office?: OfficeRef }>();
  const office = user?.office;
  const officeId = office && typeof office === "object"
    ? String(office.id ?? "")
    : office == null ? "" : String(office);
  const embeddedCode = office && typeof office === "object" ? knownOfficeCode(office.code) : null;
  const role = user?.role;
  const [resolvedOffice, setResolvedOffice] = useState<{ id: string; code: OfficeCode } | null>(null);

  useEffect(() => {
    if (!["team-leader", "salesperson"].includes(role ?? "") || !officeId || embeddedCode) return;
    const controller = new AbortController();
    void fetch(`/api/crm-offices/${encodeURIComponent(officeId)}?depth=0`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return;
      const record = await response.json() as { id?: string | number; code?: string; active?: boolean };
      const code = knownOfficeCode(record.code);
      if (String(record.id ?? "") === officeId && record.active === true && code) {
        setResolvedOffice({ id: officeId, code });
      }
    }).catch(() => { /* The server still resolves the assigned office for the generic link. */ });
    return () => controller.abort();
  }, [role, officeId, embeddedCode]);

  if (
    !user ||
    (user.role &&
      !["super-admin", "team-leader", "salesperson"].includes(user.role))
  )
    return null;
  const isAdmin = !user.role || user.role === "super-admin";
  const officeCode = embeddedCode ?? (resolvedOffice?.id === officeId ? resolvedOffice.code : null);
  const staffLabel = officeCode === "ahmedabad" ? "Ahmedabad Sales CRM"
    : officeCode === "noida" ? "Noida Sales CRM" : "Sales CRM";
  return (
    <>
    <Link href={isAdmin ? "/admin/crm-dashboard" : officeCode ? `/admin/crm-dashboard?office=${officeCode}` : "/admin/crm-dashboard"} className="crm-admin-entry">
      <LuLayoutDashboard aria-hidden="true" /> {isAdmin ? "Noida Sales CRM" : staffLabel}
    </Link>
    {isAdmin && (
      <Link href="/admin/crm-dashboard?office=ahmedabad" className="crm-admin-entry">
        <LuLayoutDashboard aria-hidden="true" /> Ahmedabad Sales CRM
      </Link>
    )}
    </>
  );
}
