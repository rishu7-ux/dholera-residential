import { timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";

import connectDB from "../../../../lib/mongodb";
import { crmDashboardURL, dispatchOneAssignmentNotification } from "../../../../lib/crm/assignment-notification";
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
  if (process.env.NOIDA_ASSIGNMENT_EMAIL_ENABLED !== "1") {
    return Response.json({ status: "disabled" }, { status: 503, headers });
  }

  let dashboardURL: string;
  let smtp: NonNullable<ReturnType<typeof getEnabledSMTPConfiguration>>;
  try {
    dashboardURL = crmDashboardURL(process.env.NOIDA_CRM_PUBLIC_URL || "");
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
    const status = await dispatchOneAssignmentNotification(db, {
      dashboardURL,
      send: async (message) => { await sendConfiguredSMTP(smtp, message); },
    });
    return Response.json({ status }, { headers });
  } catch {
    return Response.json({ status: "worker-unavailable" }, { status: 503, headers });
  }
}
