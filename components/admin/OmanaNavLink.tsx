"use client";

import Link from "next/link";
import { useAuth } from "@payloadcms/ui";

export default function OmanaNavLink() {
  const { user } = useAuth<{ role?: string }>();
  if (user?.role === "salesperson" || user?.role === "team-leader") return null;
  return (
    <Link
      href="/admin/omana-dashboard"
      style={{
        display: "block",
        margin: "0 12px 12px",
        padding: "10px 12px",
        borderRadius: "6px",
        background: "#711b75",
        color: "#ffffff",
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      Omana Projects Dashboard
    </Link>
  );
}
