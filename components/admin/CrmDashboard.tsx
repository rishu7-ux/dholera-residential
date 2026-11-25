import type { AdminViewServerProps } from "payload";
import Link from "next/link";
import CrmDashboardClient from "./CrmDashboardClient";
import { isSuperAdmin, relationshipId } from "../../lib/crm/access";
import { requestedCrmOfficeFromURL, selectCrmOffice } from "../../lib/crm/office-scope";
import { dashboardTeamAuthorized, selectDashboardRoster } from "../../lib/crm/dashboard-roster";

type CrmUser = {
  id: string | number;
  role?: string;
  name?: string | null;
  office?: string | number | { id?: string | number } | null;
  team?: string | number | { id?: string | number } | null;
};
type CrmActivity = {
  id: string | number;
  event?: string | null;
  createdAt?: string | null;
  details?: Record<string, unknown> | null;
  lead?: string | number | { id: string | number; name?: string | null } | null;
  actor?: string | number | { name?: string | null } | null;
};

export default async function CrmDashboard({
  initPageResult,
}: AdminViewServerProps) {
  const { payload, user: rawUser } = initPageResult.req;
  const user = rawUser as CrmUser | null;
  if (!user) return <p>Sign in to access the CRM.</p>;
  if (
    user.role &&
    !["super-admin", "team-leader", "salesperson"].includes(user.role)
  ) {
    return <p>CRM access denied.</p>;
  }

  let requested;
  if (!initPageResult.req.url) return <p>CRM request unavailable.</p>;
  try { requested = requestedCrmOfficeFromURL(new URL(initPageResult.req.url)); }
  catch { return <p>CRM office access denied.</p>; }
  // Collection RBAC restricts non-admins to their assigned office. All data
  // below and the report endpoint are independently scoped by the selected ID.
  const officeResult = await payload.find({
    collection: "crm-offices",
    where: { active: { equals: true } },
    limit: 100,
    depth: 0,
    overrideAccess: false,
    req: initPageResult.req,
  });
  const office = officeResult.totalDocs <= 100 ? selectCrmOffice(user, officeResult.docs, requested) : null;
  if (!office && officeResult.totalDocs <= 100 && isSuperAdmin(user) && !requested) {
    return (
      <section>
        <h1>Noida CRM setup required</h1>
        <p>Configure an active Noida office before using this dashboard.</p>
        <Link href="/admin/collections/crm-offices/create">Configure Noida office</Link>
      </section>
    );
  }
  if (!office) {
    return <p>CRM office access denied.</p>;
  }

  const teamResult = user.role === "team-leader"
    ? await payload.find({
        collection: "crm-teams",
        where: { and: [
          { office: { equals: office.id } },
          { teamLeader: { equals: user.id } },
          { active: { equals: true } },
        ] },
        limit: 2,
        depth: 0,
        overrideAccess: false,
        req: initPageResult.req,
      })
    : null;
  const team = teamResult?.docs[0] ?? null;
  if (user.role === "team-leader" &&
      (teamResult?.totalDocs !== 1 || !dashboardTeamAuthorized(team, user.id, office.id))) {
    return <p>CRM team access denied.</p>;
  }

  const people = user.role === "salesperson"
    ? null
    : await payload.find({
          collection: "users",
          where: {
            and: [
              { role: { equals: "salesperson" } },
              { office: { equals: office.id } },
              ...(team ? [{ team: { equals: team.id } }] : []),
            ],
          },
          limit: 100,
          depth: 0,
          overrideAccess: false,
          req: initPageResult.req,
        });
  const roster = selectDashboardRoster({
    role: user.role,
    userId: user.id,
    officeId: office.id,
    team,
    people: people?.docs ?? [],
  });
  const teamId = team ? String(team.id) : user.role === "salesperson" ? relationshipId(user.team) : "";
  const contactCount = (
    await payload.count({
      collection: "central-leads",
      where: {
        and: [
          { office: { equals: office.id } },
          { leadType: { equals: "contact" } },
          ...(teamId ? [{ team: { equals: teamId } }] : []),
          ...(user.role === "salesperson" ? [{ assignedSalesperson: { equals: user.id } }] : []),
        ],
      },
      overrideAccess: false,
      req: initPageResult.req,
    })
  ).totalDocs;
  const activities = await payload.find({
    collection: "crm-activities",
    where:
      user.role === "salesperson"
        ? {
            and: [
              { office: { equals: office.id } },
              { assignedSalesperson: { equals: user.id } },
            ],
          }
        : user.role === "team-leader" && team
          ? {
              and: [
                { office: { equals: office.id } },
                { team: { equals: team.id } },
              ],
            }
          : { office: { equals: office.id } },
    limit: 8,
    sort: "-createdAt",
    depth: 1,
    overrideAccess: false,
    req: initPageResult.req,
  });
  const recentActivity = (activities.docs as CrmActivity[]).map((activity) => ({
    id: String(activity.id),
    event: activity.event || "Activity",
    date: activity.createdAt || "",
    lead:
      activity.lead && typeof activity.lead === "object"
        ? activity.lead.name || "Lead"
        : "Lead",
    actor:
      activity.actor && typeof activity.actor === "object"
        ? activity.actor.name || "Team member"
        : "Team member",
    details: activity.details
      ? Object.entries(activity.details)
          .map(
            ([key, value]) =>
              `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
          )
          .join(" · ")
      : "—",
  }));

  return (
    <CrmDashboardClient
      officeId={String(office.id)}
      teamId={teamId}
      userId={String(user.id)}
      officeCode={office.code?.trim().toLowerCase() === "ahmedabad" ? "ahmedabad" : "noida"}
      officeName={office.name || (requested === "ahmedabad" ? "Ahmedabad" : "Noida")}
      role={
        user.role === "salesperson"
          ? "salesperson"
          : user.role === "team-leader"
            ? "team-leader"
            : "super-admin"
      }
      name={user.name || "CRM user"}
      roster={roster}
      contactCount={contactCount}
      recentActivity={recentActivity}
    />
  );
}
