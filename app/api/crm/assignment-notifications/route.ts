import { timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";

import connectDB from "../../../../lib/mongodb";
import { crmDashboardURL, dispatchOneAssignmentNotification } from "../../../../lib/crm/assignment-notification";
import { crmEmailStartAt, dispatchOneCrmEmailJob, prepareCrmEmailJobs } from "../../../../lib/crm/email-notification-worker";
import { sendConfiguredSMTP } from "../../../../lib/crm/smtp-email-adapter";
import { getEnabledSMTPConfiguration } from "../../../../lib/crm/smtp-email-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secret || secret.length < 32 || !supplied) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  if (process.env.CRM_EMAIL_NOTIFICATIONS_ENABLED !== "1") {
    return Response.json({ status: "disabled" }, { status: 503, headers });
  }

  let dashboardURL: string;
  let smtp: NonNullable<ReturnType<typeof getEnabledSMTPConfiguration>>;
  let startAt: Date;
  try {
    dashboardURL = process.env.NOIDA_CRM_PUBLIC_URL || "";
    crmDashboardURL(dashboardURL);
    startAt = crmEmailStartAt(process.env);
    if (startAt.getTime() > Date.now()) throw new Error("CRM email activation is not yet effective");
    const configured = getEnabledSMTPConfiguration(process.env);
    if (!configured) throw new Error("SMTP delivery disabled");
    smtp = configured;
  } catch {
    return Response.json({ status: "configuration-blocked" }, { status: 503, headers });
  }

  try {
    await connectDB();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database unavailable");
    await prepareCrmEmailJobs(db, startAt);
    const send = async (message: { to: string; subject: string; html: string; text: string }) => {
      await sendConfiguredSMTP(smtp, message);
    };
    const results = { "accepted-by-provider": 0, blocked: 0, uncertain: 0 };
    const deadline = Date.now() + 35_000;
    for (let batch = 0; batch < 10 && Date.now() < deadline; batch++) {
      const statuses = await Promise.all([
        dispatchOneAssignmentNotification(db, { dashboardURL, startAt, send }),
        dispatchOneCrmEmailJob(db, { dashboardURL, send }),
      ]);
      for (const status of statuses) if (status !== "empty") results[status]++;
      if (statuses.every((status) => status === "empty")) break;
    }
    return Response.json({ status: "processed", results }, { headers });
  } catch {
    return Response.json({ status: "worker-unavailable" }, { status: 503, headers });
  }
}
