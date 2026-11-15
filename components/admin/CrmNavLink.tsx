"use client";

import Link from "next/link";
import { useAuth } from "@payloadcms/ui";
import { LuLayoutDashboard } from "react-icons/lu";
import "./crm-dashboard.css";

export default function CrmNavLink() {
  const { user } = useAuth<{ role?: string }>();
  if (
    !user ||
    (user.role &&
      !["super-admin", "team-leader", "salesperson"].includes(user.role))
  )
    return null;
  return (
    <Link href="/admin/crm-dashboard" className="crm-admin-entry">
      <LuLayoutDashboard aria-hidden="true" /> Noida Sales CRM
    </Link>
  );
}
