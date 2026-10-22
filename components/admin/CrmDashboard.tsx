import type { AdminViewServerProps } from "payload";
import type { Where } from "payload";
import Link from "next/link";

type CrmUser = { id: string | number; role?: string; name?: string; office?: string | number | { id?: string | number } };
type Lead = { id: string; name?: string; phone?: string; email?: string; website?: string; project?: string; source?: string; notes?: string; status?: string; nextFollowUpAt?: string; assignedSalesperson?: string | number | { id?: string | number; name?: string } | null; createdAt?: string };
type Activity = { id: string; event?: string; createdAt?: string; details?: Record<string, unknown>; lead?: { name?: string } | string | number | null; actor?: { name?: string; email?: string } | string | number | null };

export default async function CrmDashboard({ initPageResult }: AdminViewServerProps) {
  const { payload, user: rawUser } = initPageResult.req;
  const user = rawUser as CrmUser | null;
  if (!user) return <p>Sign in to access the CRM.</p>;

  const office = typeof user.office === "object" ? user.office?.id : user.office;
  const where: Where | undefined = user.role === "salesperson"
    ? { assignedSalesperson: { equals: user.id } }
    : user.role === "team-leader" && office
      ? { office: { equals: office } }
      : undefined;

  const now = new Date().toISOString();
  const [all, fresh, contacted, followUps, overdue, converted, recent] = await Promise.all([
    payload.count({ collection: "central-leads", where, overrideAccess: false, req: initPageResult.req }),
    payload.count({ collection: "central-leads", where: mergeWhere(where, { status: { equals: "new" } }), overrideAccess: false, req: initPageResult.req }),
    payload.count({ collection: "central-leads", where: mergeWhere(where, { status: { equals: "contacted" } }), overrideAccess: false, req: initPageResult.req }),
    payload.count({ collection: "central-leads", where: mergeWhere(where, { and: [{ nextFollowUpAt: { greater_than_equal: now } }, { status: { not_in: ["converted", "lost"] } }] }), overrideAccess: false, req: initPageResult.req }),
    payload.count({ collection: "central-leads", where: mergeWhere(where, { and: [{ nextFollowUpAt: { less_than: now } }, { status: { not_in: ["converted", "lost"] } }] }), overrideAccess: false, req: initPageResult.req }),
    payload.count({ collection: "central-leads", where: mergeWhere(where, { status: { equals: "converted" } }), overrideAccess: false, req: initPageResult.req }),
    payload.find({ collection: "central-leads", where, limit: 20, sort: "-createdAt", depth: 1, overrideAccess: false, req: initPageResult.req }),
  ]);
  const salespersonRows = user.role === "team-leader"
    ? await payload.find({ collection: "users", where: { and: [{ role: { equals: "salesperson" } }, { office: { equals: office } }] }, limit: 100, depth: 0, overrideAccess: false, req: initPageResult.req })
    : null;
  const salespersonTotals = salespersonRows ? await Promise.all(salespersonRows.docs.map(async (salesperson) => ({
    id: String(salesperson.id),
    name: salesperson.name || salesperson.email,
    active: salesperson.active !== false && salesperson.eligibleForAssignment !== false,
    leads: (await payload.count({ collection: "central-leads", where: mergeWhere(where, { assignedSalesperson: { equals: salesperson.id } }), overrideAccess: false, req: initPageResult.req })).totalDocs,
  }))) : [];
  const activityWhere: Where | undefined = user.role === "salesperson"
    ? { assignedSalesperson: { equals: user.id } }
    : user.role === "team-leader" && office
      ? { office: { equals: office } }
      : undefined;
  const activities = await payload.find({ collection: "crm-activities", where: activityWhere, limit: 20, sort: "-createdAt", depth: 1, overrideAccess: false, req: initPageResult.req });

  return <div className="dholera-dashboard">
    <section className="dholera-dashboard__hero"><div className="dholera-dashboard__hero-content"><div><p className="dholera-dashboard__eyebrow">NOIDA SALES CRM</p><h1>{user.role === "salesperson" ? "My Leads" : user.role === "team-leader" ? "Team Dashboard" : "CRM Oversight"}</h1><span>Signed in as {user.name || "CRM user"}. Access is enforced by role and office.</span></div><div className="dholera-dashboard__hero-total"><span>Visible Leads</span><strong>{all.totalDocs}</strong></div></div></section>
    <section className="dholera-stats-grid">
      <Card label="All Leads" value={all.totalDocs}/><Card label="New" value={fresh.totalDocs}/><Card label="Contacted" value={contacted.totalDocs}/><Card label="Pending Follow Ups" value={followUps.totalDocs}/><Card label="Overdue Follow Ups" value={overdue.totalDocs}/><Card label="Converted" value={converted.totalDocs}/>
    </section>
    {salespersonTotals.length > 0 && <section className="dholera-dashboard-section"><div className="dholera-dashboard-section__header"><div><p>NOIDA TEAM</p><h2>Salesperson Performance</h2></div></div><div className="dholera-table-wrapper"><table className="dholera-table"><thead><tr><th>Salesperson</th><th>Account</th><th>Assigned Leads</th></tr></thead><tbody>{salespersonTotals.map((person)=><tr key={person.id}><td><strong>{person.name}</strong></td><td>{person.active ? "Active" : "Inactive"}</td><td>{person.leads}</td></tr>)}</tbody></table></div></section>}
    <section className="dholera-dashboard-section"><div className="dholera-dashboard-section__header"><div><p>LATEST ACTIVITY</p><h2>Recent Leads</h2></div><Link href="/admin/collections/central-leads">View All →</Link></div><div className="dholera-table-wrapper"><table className="dholera-table"><thead><tr><th>Customer</th><th>Contact</th><th>Website / Project</th><th>Source</th><th>Status / Follow Up</th><th>Notes</th><th>Assigned To</th></tr></thead><tbody>{(recent.docs as Lead[]).map((lead)=><tr key={lead.id}><td><Link href={`/admin/collections/central-leads/${lead.id}`}><strong>{lead.name || "-"}</strong></Link></td><td>{lead.phone || "-"}<br/>{lead.email || ""}</td><td>{lead.website || "-"}<br/>{lead.project || ""}</td><td>{lead.source || "-"}</td><td>{lead.status || "new"}<br/>{lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString("en-IN") : "No follow up"}</td><td>{lead.notes || "-"}</td><td>{lead.assignedSalesperson && typeof lead.assignedSalesperson === "object" ? lead.assignedSalesperson.name || "Assigned" : lead.assignedSalesperson ? "Assigned" : "Unassigned"}</td></tr>)}</tbody></table></div></section>
    <section className="dholera-dashboard-section"><div className="dholera-dashboard-section__header"><div><p>FOLLOW UP HISTORY</p><h2>Recent Lead Activity</h2></div></div><div className="dholera-table-wrapper"><table className="dholera-table"><thead><tr><th>Lead</th><th>Event</th><th>Actor</th><th>Details</th><th>Time</th></tr></thead><tbody>{(activities.docs as Activity[]).map((item)=><tr key={item.id}><td>{item.lead && typeof item.lead === "object" ? item.lead.name || "Lead" : "Lead"}</td><td>{(item.event || "").replaceAll("-", " ")}</td><td>{item.actor && typeof item.actor === "object" ? item.actor.name || item.actor.email || "System" : "System"}</td><td>{activitySummary(item.details)}</td><td>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : "-"}</td></tr>)}</tbody></table></div></section>
  </div>;
}

function mergeWhere(base: Where | undefined, extra: Where): Where {
  return base ? { and: [base, extra] } : extra;
}
function activitySummary(details?: Record<string, unknown>) {
  if (!details) return "-";
  const parts = Object.entries(details).map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
  return parts.join(" · ") || "-";
}
function Card({ label, value }: { label: string; value: number }) { return <Link href="/admin/collections/central-leads" className="dholera-stat-card"><div className="dholera-stat-card__top"><span>{label}</span><div className="dholera-stat-dot"/></div><strong>{value}</strong><div className="dholera-stat-card__footer"><p>Noida</p><span>View →</span></div></Link>; }
