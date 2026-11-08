"use client";

import Link from "next/link";
import { useAuth } from "@payloadcms/ui";

export default function CrmNavLink() {
  const { user } = useAuth<{ role?: string }>();
  if (!user) return null;
  return <Link href="/admin/crm-dashboard" style={{display:"block",margin:"0 12px 12px",padding:"10px 12px",borderRadius:"6px",background:"linear-gradient(90deg,#7c2d12,#ea580c)",color:"#fff",fontWeight:700,textDecoration:"none"}}>Noida Sales CRM</Link>;
}
