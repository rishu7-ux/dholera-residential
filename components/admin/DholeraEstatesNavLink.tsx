"use client";

import Link from "next/link";
import { useAuth } from "@payloadcms/ui";
export default function DholeraEstatesNavLink(){const { user } = useAuth<{ role?: string }>(); if(user?.role === "salesperson" || user?.role === "team-leader") return null; return <Link href="/admin/dholera-estates-dashboard" style={{display:"block",margin:"0 12px 12px",padding:"10px 12px",borderRadius:"6px",background:"linear-gradient(90deg,#173f6d,#2f65a7)",color:"#fff",fontWeight:600,textDecoration:"none"}}>Dholera Estates Dashboard</Link>}
