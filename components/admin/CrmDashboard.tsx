import type { AdminViewServerProps } from "payload";
import Link from "next/link";
import CrmDashboardClient from "./CrmDashboardClient";
import { noidaDashboardAccess } from "../../lib/crm/access";
import { dashboardTeamAuthorized, selectDashboardRoster } from "../../lib/crm/dashboard-roster";

type CrmUser = {
  id: string | number;
  role?: string;
  name?: string | null;
  office?: string | number | { id?: string | number } | null;
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

  // The report endpoint independently enforces office and collection RBAC.
  // This query supplies only the authorized roster for filters and presentation.
  const officeResult = await payload.find({
    collection: "crm-offices",
    where: { code: { equals: "noida" } },
    limit: 1,
    depth: 0,
    overrideAccess: false,
    req: initPageResult.req,
  });
  const office = officeResult.docs[0];
  const officeAccess = noidaDashboardAccess(user, office?.id);
  if (officeAccess === "setup-required") {
    return (
      <section>
        <h1>Noida CRM setup required</h1>
        <p>Create the Noida office in this TEST environment before using its dashboard and reports.</p>
        <Link href="/admin/collections/crm-offices/create">Configure Noida office</Link>
      </section>
    );
  }
  if (officeAccess === "denied" || !office) {
    return <p>Noida office access denied.</p>;
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
    return <p>Noida team access denied.</p>;
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
  const contactCount =
    user.role === "salesperson"
      ? 0
      : (
          await payload.count({
            collection: "central-leads",
            where: {
              and: [
                { office: { equals: office.id } },
                { leadType: { equals: "contact" } },
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
