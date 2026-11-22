import { getPayload } from "payload";
import config from "../../../../payload.config";
import { isSuperAdmin } from "../../../../lib/crm/access";
import { assignNoidaBacklog } from "../../../../lib/crm/assign-backlog";
import { requestedCrmOffice } from "../../../../lib/crm/office-scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "Same-origin request required" }, { status: 403, headers });
  }
  try {
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401, headers });
    if (!isSuperAdmin(user)) return Response.json({ error: "Super Admin required" }, { status: 403, headers });
    const body = await request.json().catch(() => null);
    if (!body || body.limit !== 20) return Response.json({ error: "A batch of 20 must be confirmed" }, { status: 400, headers });
    let office;
    try { office = requestedCrmOffice(body.office ?? null) || "noida"; }
    catch { return Response.json({ error: "Invalid office" }, { status: 400, headers }); }
    return Response.json(await assignNoidaBacklog(20, office), { headers });
  } catch {
    return Response.json({ error: "Backlog assignment did not complete" }, { status: 503, headers });
  }
}
