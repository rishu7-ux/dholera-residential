import type { PayloadRequest } from "payload";
import { isSuperAdmin, relationshipId } from "./access";
import { selectCrmOffice } from "./office-scope";

export async function handleStaffInvitation(req: PayloadRequest): Promise<Response> {
  const actor = req.user as (typeof req.user & { role?: string }) | null;
  if (!actor || actor.role !== "super-admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let inviteeId: string | undefined;
  try {
    const invitee = await req.payload.findByID({
      collection: "users",
      id: String(req.routeParams?.id ?? ""),
      req,
      overrideAccess: false,
      depth: 0,
    });
    const inviteeRole = (invitee as typeof invitee & { role?: string }).role;
    if (inviteeRole !== "salesperson" && inviteeRole !== "team-leader") {
      return Response.json({ error: "Invite unavailable" }, { status: 404 });
    }
    if (req.payload.email.name !== "noida-smtp") {
      return Response.json({ error: "Email delivery is not configured. No setup link was generated." }, { status: 503 });
    }
    inviteeId = String(invitee.id);

    // Payload stores the expiring reset token and sends it only in the email.
    // A null result means no message was sent (for example, request throttling).
    const result = await req.payload.forgotPassword({
      collection: "users",
      data: { email: invitee.email },
      req,
      overrideAccess: false,
    });
    if (!result) {
      return Response.json({ error: "Invitation delivery is unavailable. No setup confirmation was sent." }, { status: 503 });
    }
    return Response.json({ message: "If the account is eligible, a setup link has been sent." }, { status: 202 });
  } catch {
    // If token creation succeeded but delivery failed, attempt to invalidate
    // the undelivered link before reporting failure. Never log or return tokens.
    if (inviteeId) {
      try {
        await req.payload.update({
          collection: "users",
          id: inviteeId,
          data: { resetPasswordToken: null, resetPasswordExpiration: null },
          overrideAccess: true,
        });
      } catch {
        // Preserve the generic failure response if cleanup also fails.
      }
    }
    return Response.json({ error: "Invitation delivery failed. No setup confirmation was sent." }, { status: 503 });
  }
}

/** Super Admin handoff for an identity-verified staff member when SMTP is unavailable. */
export async function handleManualStaffInvitation(req: PayloadRequest): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "Pragma": "no-cache", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
  const actor = req.user as (typeof req.user & { role?: string }) | null;
  if (!isSuperAdmin(actor)) return Response.json({ error: "Forbidden" }, { status: 403, headers });
  if (!req.url) return Response.json({ error: "Request URL required" }, { status: 403, headers });
  const url = new URL(req.url);
  if (url.protocol !== "https:" || req.headers.get("origin") !== url.origin) {
    return Response.json({ error: "HTTPS same-origin request required" }, { status: 403, headers });
  }
  try {
    const invitee = await req.payload.findByID({
      collection: "users", id: String(req.routeParams?.id ?? ""), req,
      overrideAccess: false, depth: 0,
    });
    const role = (invitee as typeof invitee & { role?: string }).role;
    if (role !== "salesperson" && role !== "team-leader") {
      return Response.json({ error: "Staff account required" }, { status: 404, headers });
    }
    const officeId = relationshipId((invitee as typeof invitee & { office?: unknown }).office);
    const office = officeId ? await req.payload.find({
      collection: "crm-offices", where: { id: { equals: officeId } },
      limit: 1, depth: 0, req, overrideAccess: false,
    }) : null;
    if (!office || !selectCrmOffice(actor, office.docs, null) &&
        !selectCrmOffice(actor, office.docs, "ahmedabad")) {
      return Response.json({ error: "CRM staff account required" }, { status: 404, headers });
    }
    const token = await req.payload.forgotPassword({
      collection: "users", data: { email: invitee.email },
      disableEmail: true, req, overrideAccess: false,
    });
    if (!token) return Response.json({ error: "Setup unavailable" }, { status: 503, headers });
    const adminBase = new URL(req.payload.getAdminURL(), url.origin);
    const resetPath = req.payload.config.admin.routes.reset.replace(/^\/+/, "");
    const resetURL = new URL(`${resetPath}/${encodeURIComponent(token)}`, `${adminBase.toString().replace(/\/$/, "")}/`);
    return Response.json({ resetURL: resetURL.toString(), expiresInSeconds: 1800 }, { headers });
  } catch {
    return Response.json({ error: "Setup unavailable" }, { status: 503, headers });
  }
}
