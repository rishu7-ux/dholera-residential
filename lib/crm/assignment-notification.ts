import mongoose from "mongoose";

type Db = NonNullable<typeof mongoose.connection.db>;
type ClientSession = Awaited<ReturnType<typeof mongoose.connection.startSession>>;
type ObjectId = mongoose.Types.ObjectId;

export const ASSIGNMENT_OUTBOX = "crm-assignment-notifications";
export const ASSIGNMENT_SUBJECT = "New Lead Assigned | Omana CRM";

export type AssignmentJob = {
  _id: ObjectId;
  lead: ObjectId;
  salesperson: ObjectId;
  source: string;
  assignedAt: Date;
  status: "queued" | "attempted" | "accepted-by-provider" | "confirmed-delivered" | "blocked" | "uncertain";
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date;
  failureCode?: string;
};

export function assignmentSource(website: string, leadType: string, source: string): string {
  if (leadType === "chatbot") return "ASK OMANA chatbot";
  if (/meta|facebook|instagram/i.test(source)) return "Meta Ads";
  return website.replace(/[^a-z0-9 -]/gi, " ").slice(0, 80) || "Website enquiry";
}

export async function queueAssignmentNotification(
  db: Db,
  session: ClientSession,
  job: Pick<AssignmentJob, "lead" | "salesperson" | "source" | "assignedAt">,
): Promise<void> {
  await db.collection<AssignmentJob>(ASSIGNMENT_OUTBOX).insertOne({
    _id: job.lead,
    ...job,
    status: "queued",
    attempts: 0,
    createdAt: job.assignedAt,
    updatedAt: job.assignedAt,
  }, { session });
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);

export function crmDashboardURL(rawURL: string): string {
  const url = new URL(rawURL);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      url.pathname !== "/" || !url.hostname || url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
    throw new Error("CRM public URL must be an HTTPS origin");
  }
  return new URL("/admin/crm-dashboard", url).toString();
}

export function assignmentEmail(input: {
  name: string; leadId: string; source: string; assignedAt: Date; dashboardURL: string;
}): { subject: string; html: string; text: string } {
  if (!/^[a-f\d]{24}$/i.test(input.leadId)) throw new Error("Invalid lead reference");
  const name = input.name.trim().slice(0, 100) || "Salesperson";
  const source = input.source.trim().slice(0, 100) || "Website enquiry";
  const assignedAt = input.assignedAt.toISOString();
  const link = new URL(`/admin/collections/central-leads/${input.leadId}`, crmDashboardURL(input.dashboardURL)).toString();
  const text = `Hello ${name},\n\nA new customer enquiry has been assigned to you.\n\nLead Reference: ${input.leadId}\nSource: ${source}\nAssigned At: ${assignedAt}\nStatus: New\n\nPlease log in to your CRM dashboard to view customer details and follow up.\n\nView Assigned Lead: ${link}\n\nRegards,\nOmana CRM Team`;
  const html = `<div style="background:#fff7f0;padding:24px;font-family:Arial,sans-serif;color:#212121"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #f1e0d2;border-radius:12px;padding:28px"><h1 style="font-size:22px;color:#e76b18">New lead assigned</h1><p>Hello ${escapeHtml(name)},</p><p>A new customer enquiry has been assigned to you.</p><p><strong>Lead Reference:</strong> ${input.leadId}<br><strong>Source:</strong> ${escapeHtml(source)}<br><strong>Assigned At:</strong> ${assignedAt}<br><strong>Status:</strong> New</p><p>Please log in to your CRM dashboard to view customer details and follow up.</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#e76b18;color:#fff;padding:12px 18px;border-radius:7px;text-decoration:none">View Assigned Lead</a></p><p>Regards,<br>Omana CRM Team</p></div></div>`;
  return { subject: ASSIGNMENT_SUBJECT, html, text };
}

/** The SMTP handoff is at-most-once. An ambiguous failure stays uncertain for manual review. */
export async function dispatchOneAssignmentNotification(
  db: Db,
  options: { dashboardURL: string; send: (message: { to: string; subject: string; html: string; text: string }) => Promise<unknown> },
): Promise<"empty" | "blocked" | "accepted-by-provider" | "uncertain"> {
  const collection = db.collection<AssignmentJob>(ASSIGNMENT_OUTBOX);
  const job = await collection.findOne({ status: "queued" }, { sort: { createdAt: 1 } });
  if (!job) return "empty";
  const [lead, salesperson] = await Promise.all([
    db.collection("central-leads").findOne({ _id: job.lead }, { projection: { assignedSalesperson: 1 } }),
    db.collection("users").findOne({ _id: job.salesperson }, { projection: { role: 1, active: 1, email: 1, name: 1 } }),
  ]);
  if (!lead || String(lead.assignedSalesperson) !== String(job.salesperson) ||
      !salesperson || salesperson.role !== "salesperson" || salesperson.active !== true ||
      typeof salesperson.email !== "string" || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(salesperson.email)) {
    await collection.updateOne({ _id: job._id, status: "queued" },
      { $set: { status: "blocked", failureCode: "invalid-assignee", updatedAt: new Date() } });
    return "blocked";
  }
  const message = assignmentEmail({
    name: typeof salesperson.name === "string" ? salesperson.name : "Salesperson",
    leadId: String(job.lead), source: job.source, assignedAt: job.assignedAt,
    dashboardURL: options.dashboardURL,
  });
  const claimed = await collection.findOneAndUpdate({ _id: job._id, status: "queued" },
    { $set: { status: "attempted", updatedAt: new Date() }, $inc: { attempts: 1 } },
    { returnDocument: "after" });
  if (!claimed) return "empty";
  try {
    await options.send({ to: salesperson.email, ...message });
    await collection.updateOne({ _id: job._id, status: "attempted" },
      { $set: { status: "accepted-by-provider", acceptedAt: new Date(), updatedAt: new Date() } });
    return "accepted-by-provider";
  } catch {
    await collection.updateOne({ _id: job._id, status: "attempted" },
      { $set: { status: "uncertain", failureCode: "provider-attempt-failed", updatedAt: new Date() } });
    return "uncertain";
  }
}

/** Requeue only a job that was blocked before any SMTP attempt. Caller must authorize the exact ID. */
export async function requeueUnattemptedAssignmentNotification(db: Db, id: ObjectId): Promise<boolean> {
  const result = await db.collection<AssignmentJob>(ASSIGNMENT_OUTBOX).updateOne(
    { _id: id, status: "blocked", attempts: 0 },
    { $set: { status: "queued", updatedAt: new Date() }, $unset: { failureCode: "" } },
  );
  return result.modifiedCount === 1;
}
