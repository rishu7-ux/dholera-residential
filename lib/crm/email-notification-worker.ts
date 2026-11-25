import mongoose from "mongoose";

import { assignmentEmail, assignmentSource, ASSIGNMENT_OUTBOX, crmDashboardURL, queueAssignmentNotification } from "./assignment-notification";

type Db = NonNullable<typeof mongoose.connection.db>;
type ObjectId = mongoose.Types.ObjectId;
type JobKind = "reassignment" | "reminder" | "overdue" | "team-summary";
type EmailJob = {
  _id: string;
  kind: JobKind;
  status: "queued" | "attempted" | "accepted-by-provider" | "blocked" | "uncertain";
  attempts: number;
  runAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lead?: ObjectId;
  salesperson?: ObjectId;
  dueAt?: Date;
  office?: ObjectId;
  team?: ObjectId;
  leader?: ObjectId;
  summaryDate?: string;
  windowStart?: Date;
  windowEnd?: Date;
  acceptedAt?: Date;
  failureCode?: string;
};

const HOUR = 60 * 60 * 1000;
const IST_OFFSET = 5.5 * HOUR;
const MAX_SCAN = 10_000;

const objectId = (value: unknown): ObjectId | undefined => {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "string" && /^[a-f\d]{24}$/i.test(value)) return new mongoose.Types.ObjectId(value);
  return undefined;
};
const date = (value: unknown): Date | undefined => {
  const parsed = value instanceof Date ? value : typeof value === "string" ? new Date(value) : undefined;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : undefined;
};
const sameId = (a: unknown, b: unknown) => Boolean(a && b && String(a) === String(b));
const safeName = (value: unknown, fallback: string) => typeof value === "string"
  ? value.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 100) || fallback : fallback;

/** The outbox _id is the event identity. A repeated scan cannot queue a second email. */
async function enqueue(db: Db, job: Omit<EmailJob, "status" | "attempts" | "createdAt" | "updatedAt">, now: Date) {
  try {
    await db.collection<EmailJob>(ASSIGNMENT_OUTBOX).updateOne(
      { _id: job._id },
      { $setOnInsert: { ...job, status: "queued", attempts: 0, createdAt: now, updatedAt: now } },
      { upsert: true },
    );
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
}

export function crmEmailStartAt(env: Record<string, string | undefined>): Date {
  const raw = env.CRM_EMAIL_NOTIFICATIONS_START_AT;
  if (!raw || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw)) {
    throw new Error("CRM email activation time must be an explicit UTC timestamp");
  }
  const parsed = date(raw);
  if (!parsed) throw new Error("CRM email activation time is invalid");
  return parsed;
}

export function previousIstDay(now: Date): { key: string; start: Date; end: Date } | undefined {
  const local = new Date(now.getTime() + IST_OFFSET);
  if (local.getUTCHours() < 9) return undefined;
  const end = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - IST_OFFSET);
  const start = new Date(end.getTime() - 24 * HOUR);
  return { key: new Date(start.getTime() + IST_OFFSET).toISOString().slice(0, 10), start, end };
}

/** Scan bounded current CRM state; no customer email is stored in the outbox. */
export async function prepareCrmEmailJobs(db: Db, startAt: Date, now = new Date()): Promise<void> {
  const activities = await db.collection("crm-activities").find({
    event: { $in: ["assigned", "reassigned"] }, createdAt: { $gte: startAt },
  }).project({ _id: 1, lead: 1, assignedSalesperson: 1, event: 1, details: 1, createdAt: 1 })
    .sort({ createdAt: 1, _id: 1 }).limit(MAX_SCAN + 1).toArray();
  if (activities.length > MAX_SCAN) throw new Error("CRM email activity scan limit exceeded");
  for (const activity of activities) {
    await prepareAssignmentActivityJob(db, activity, now);
  }

  const dueLeads = await db.collection("central-leads").find({
    nextFollowUpAt: { $gte: startAt, $lte: new Date(now.getTime() + 24 * HOUR) },
    assignedSalesperson: { $exists: true, $ne: null },
    status: { $nin: ["converted", "lost"] },
  }).project({ _id: 1, assignedSalesperson: 1, nextFollowUpAt: 1, createdAt: 1 }).sort({ _id: 1 })
    .limit(MAX_SCAN + 1).toArray();
  if (dueLeads.length > MAX_SCAN) throw new Error("CRM email follow-up scan limit exceeded");
  for (const lead of dueLeads) {
    const salesperson = objectId(lead.assignedSalesperson);
    const dueAt = date(lead.nextFollowUpAt);
    if (!salesperson || !dueAt) continue;
    const leadCreatedAt = date(lead.createdAt);
    if (!leadCreatedAt || leadCreatedAt.getTime() < startAt.getTime()) {
      // Existing leads qualify only when the current follow-up was scheduled
      // after activation. Old future dates must not become a mail backlog.
      const scheduled = await db.collection("crm-activities").findOne({
        lead: lead._id, event: "follow-up-scheduled", createdAt: { $gte: startAt },
      }, { sort: { createdAt: -1 }, projection: { details: 1 } });
      if (!scheduled || date(scheduled.details?.to)?.getTime() !== dueAt.getTime()) continue;
    }
    const key = `${String(lead._id)}:${dueAt.toISOString()}:${String(salesperson)}`;
    if (dueAt.getTime() > now.getTime()) {
      await enqueue(db, {
        _id: `crm-email:reminder:${key}`, kind: "reminder", lead: lead._id,
        salesperson, dueAt, runAt: new Date(Math.max(startAt.getTime(), dueAt.getTime() - 24 * HOUR)),
      }, now);
    } else {
      await enqueue(db, {
        _id: `crm-email:overdue:${key}`, kind: "overdue", lead: lead._id,
        salesperson, dueAt, runAt: dueAt,
      }, now);
    }
  }

  const day = previousIstDay(now);
  if (!day || day.end.getTime() <= startAt.getTime()) return;
  const offices = await db.collection("crm-offices").find({ active: true })
    .project({ _id: 1, code: 1 }).limit(100).toArray();
  for (const office of offices) {
    if (!["noida", "ahmedabad"].includes(String(office.code || "").trim().toLowerCase())) continue;
    const teams = await db.collection("crm-teams").find({ office: office._id, active: true })
      .project({ _id: 1, teamLeader: 1 }).limit(2).toArray();
    if (teams.length !== 1) continue;
    const leader = objectId(teams[0].teamLeader);
    if (!leader) continue;
    await enqueue(db, {
      _id: `crm-email:summary:${String(office._id)}:${String(teams[0]._id)}:${day.key}`,
      kind: "team-summary", office: office._id, team: teams[0]._id, leader,
      summaryDate: day.key, windowStart: new Date(Math.max(day.start.getTime(), startAt.getTime())),
      windowEnd: day.end, runAt: now,
    }, now);
  }
}

/** Prepare one committed assignment activity; also usable for exact-ID TEST checks. */
export async function prepareAssignmentActivityJob(
  db: Db,
  activity: { _id?: unknown; lead?: unknown; assignedSalesperson?: unknown; event?: unknown; createdAt?: unknown },
  now = new Date(),
): Promise<void> {
  const lead = objectId(activity.lead);
  const salesperson = objectId(activity.assignedSalesperson);
  if (!lead || !salesperson) return;
  if (activity.event === "assigned") {
    const current = await db.collection("central-leads").findOne({ _id: lead },
      { projection: { assignedSalesperson: 1, website: 1, leadType: 1, source: 1 } });
    if (!current || !sameId(current.assignedSalesperson, salesperson)) return;
    await queueAssignmentNotification(db, {
      lead, salesperson,
      source: assignmentSource(String(current.website || ""), String(current.leadType || ""), String(current.source || "")),
      assignedAt: date(activity.createdAt) || now,
    });
  } else if (activity.event === "reassigned") {
    await enqueue(db, {
      _id: `crm-email:activity:${String(activity._id)}`,
      kind: "reassignment", lead, salesperson, runAt: date(activity.createdAt) || now,
    }, now);
  }
}

type Send = (message: { to: string; subject: string; html: string; text: string }) => Promise<unknown>;

/** Claims before SMTP; attempted/uncertain jobs are never retried automatically. */
export async function dispatchOneCrmEmailJob(
  db: Db, options: { dashboardURL: string; send: Send; now?: Date },
): Promise<"empty" | "blocked" | "accepted-by-provider" | "uncertain"> {
  const now = options.now || new Date();
  const jobs = db.collection<EmailJob>(ASSIGNMENT_OUTBOX);
  const job = await jobs.findOneAndUpdate(
    { status: "queued", kind: { $in: ["reassignment", "reminder", "overdue", "team-summary"] }, runAt: { $lte: now } },
    { $set: { status: "attempted", updatedAt: now }, $inc: { attempts: 1 } },
    { sort: { runAt: 1, _id: 1 }, returnDocument: "after" },
  );
  if (!job) return "empty";
  const blocked = async (code: string) => {
    await jobs.updateOne({ _id: job._id, status: "attempted" },
      { $set: { status: "blocked", failureCode: code, updatedAt: new Date() } });
    return "blocked" as const;
  };

  let message: { to: string; subject: string; html: string; text: string };
  try {
    if (job.kind === "team-summary") {
      const [team, leader, office] = await Promise.all([
        db.collection("crm-teams").findOne({ _id: job.team }, { projection: { active: 1, office: 1, teamLeader: 1 } }),
        db.collection("users").findOne({ _id: job.leader }, { projection: { role: 1, active: 1, office: 1, team: 1, email: 1, name: 1 } }),
        db.collection("crm-offices").findOne({ _id: job.office }, { projection: { active: 1, name: 1, code: 1 } }),
      ]);
      if (!team || team.active !== true || !leader || leader.role !== "team-leader" || leader.active !== true ||
        !office || office.active !== true || !sameId(team.office, job.office) ||
        !sameId(team.teamLeader, job.leader) || !sameId(leader.office, job.office) ||
        !sameId(leader.team, job.team) || !validEmail(leader.email) ||
        !job.windowStart || !job.windowEnd || !job.summaryDate) return blocked("invalid-team-summary-recipient");
      const scope = { office: job.office, team: job.team };
      const [created, assigned, overdue] = await Promise.all([
        db.collection("central-leads").countDocuments({ ...scope, createdAt: { $gte: job.windowStart, $lt: job.windowEnd } }),
        db.collection("central-leads").countDocuments({ ...scope, assignedAt: { $gte: job.windowStart, $lt: job.windowEnd } }),
        db.collection("central-leads").countDocuments({ ...scope, nextFollowUpAt: { $lt: now }, status: { $nin: ["converted", "lost"] } }),
      ]);
      const officeName = safeName(office.name, String(office.code || "CRM office"));
      const text = `${officeName} CRM summary for ${job.summaryDate}\nNew leads: ${created}\nAssignments: ${assigned}\nOverdue follow-ups: ${overdue}\n\nView your team dashboard: ${crmDashboardURL(options.dashboardURL)}?office=${encodeURIComponent(String(office.code || "").trim().toLowerCase())}`;
      message = {
        to: leader.email, subject: `Daily ${officeName} CRM summary | ${job.summaryDate}`, text,
        html: `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`,
      };
    } else {
      const [lead, salesperson] = await Promise.all([
        db.collection("central-leads").findOne({ _id: job.lead }, { projection: { name: 1, phone: 1, email: 1, project: 1, message: 1, website: 1, leadType: 1, source: 1, status: 1, office: 1, team: 1, assignedSalesperson: 1, nextFollowUpAt: 1, assignedAt: 1 } }),
        db.collection("users").findOne({ _id: job.salesperson }, { projection: { role: 1, active: 1, office: 1, team: 1, email: 1, name: 1 } }),
      ]);
      if (!lead || !salesperson || salesperson.role !== "salesperson" || salesperson.active !== true ||
        !sameId(lead.assignedSalesperson, job.salesperson) || !sameId(lead.office, salesperson.office) ||
        !sameId(lead.team, salesperson.team) || !validEmail(salesperson.email)) return blocked("invalid-current-assignee");
      const dueAt = date(lead.nextFollowUpAt);
      if (job.kind === "reminder" || job.kind === "overdue") {
        if (!dueAt || !job.dueAt || dueAt.getTime() !== job.dueAt.getTime() ||
          ["converted", "lost"].includes(String(lead.status)) ||
          (job.kind === "reminder" && now.getTime() >= dueAt.getTime()) ||
          (job.kind === "overdue" && now.getTime() < dueAt.getTime())) return blocked("stale-follow-up");
      }
      const kind = job.kind === "reassignment" ? "reassigned" : job.kind;
      message = {
        to: salesperson.email,
        ...assignmentEmail({
          name: safeName(salesperson.name, "Salesperson"), leadId: String(lead._id),
          source: assignmentSource(String(lead.website || ""), String(lead.leadType || ""), String(lead.source || "")),
          assignedAt: date(lead.assignedAt) || job.createdAt, dashboardURL: options.dashboardURL,
          kind, dueAt: job.dueAt,
          customer: { name: lead.name, phone: lead.phone, email: lead.email, project: lead.project, message: lead.message },
        }),
      };
    }
  } catch {
    return blocked("message-preparation-failed");
  }

  try {
    await options.send(message);
    await jobs.updateOne({ _id: job._id, status: "attempted" },
      { $set: { status: "accepted-by-provider", acceptedAt: new Date(), updatedAt: new Date() } });
    return "accepted-by-provider";
  } catch {
    await jobs.updateOne({ _id: job._id, status: "attempted" },
      { $set: { status: "uncertain", failureCode: "provider-attempt-failed", updatedAt: new Date() } });
    return "uncertain";
  }
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}
