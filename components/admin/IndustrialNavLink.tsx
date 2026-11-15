"use client";

import Link from "next/link";
import { useAuth } from "@payloadcms/ui";
export default function IndustrialNavLink(){const { user } = useAuth<{ role?: string }>(); if(user?.role === "salesperson" || user?.role === "team-leader") return null; return <Link href="/admin/industrial-dashboard" style={{display:"block",margin:"0 12px 12px",padding:"10px 12px",borderRadius:"6px",background:"linear-gradient(90deg,#12568d,#4385b4)",color:"#fff",fontWeight:600,textDecoration:"none"}}>Dholera Industrial Dashboard</Link>}
