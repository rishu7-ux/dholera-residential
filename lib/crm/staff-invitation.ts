import type { PayloadRequest } from "payload";

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
