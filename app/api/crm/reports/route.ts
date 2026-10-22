import { getPayload, type Where } from "payload";
import config from "../../../../payload.config";
import { buildCrmReport, parseReportOptions, reportWindow, type ReportLead } from "../../../../lib/crm/report-core";
import { reportCSV, reportPDF, reportXLSX } from "../../../../lib/crm/report-export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const commonHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie, Authorization",
  "X-Content-Type-Options": "nosniff",
};

function fail(status: number, error: string) {
  return Response.json({ error }, { status, headers: commonHeaders });
}

export async function GET(request: Request) {
  let options;
  try {
    options = parseReportOptions(new URL(request.url));
  } catch (error) {
    return fail(400, error instanceof Error ? error.message : "Invalid report request");
  }

  try {
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return fail(401, "Authentication required");
    if (!["super-admin", "team-leader", "salesperson"].includes(String(user.role))) return fail(403, "CRM access denied");
    if (user.role === "salesperson" && options.salesperson && options.salesperson !== String(user.id)) return fail(403, "Salesperson filter denied");

    const officeResult = await payload.find({
      collection: "crm-offices",
      where: { code: { equals: "noida" } },
      depth: 0,
      limit: 1,
      user,
      overrideAccess: false,
    });
    const office = officeResult.docs[0];
    if (!office) return fail(403, "Noida office access denied");

    const window = reportWindow(options);
    const predicates: Where[] = [{ office: { equals: office.id } }];
    if (window.start) predicates.push({ createdAt: { greater_than_equal: window.start } });
    if (window.endExclusive) predicates.push({ createdAt: { less_than: window.endExclusive } });
    if (options.status) predicates.push({ status: { equals: options.status } });
    if (options.source) predicates.push({ source: { equals: options.source } });
    if (options.salesperson) predicates.push({ assignedSalesperson: { equals: options.salesperson } });
    const where: Where = { and: predicates };

    const leads: ReportLead[] = [];
    for (let page = 1; ; page++) {
      const batch = await payload.find({
        collection: "central-leads",
        where,
        sort: "-createdAt",
        page,
        limit: 250,
        depth: 0,
        user,
        overrideAccess: false,
      });
      if (batch.totalDocs > 10_000) return fail(422, "Report exceeds the 10,000-lead export limit; narrow the date range");
      leads.push(...batch.docs as ReportLead[]);
      if (!batch.hasNextPage) break;
    }

    const names = new Map<string, string>();
    for (let page = 1; ; page++) {
      const batch = await payload.find({
        collection: "users",
        where: { office: { equals: office.id } },
        page,
        limit: 250,
        depth: 0,
        user,
        overrideAccess: false,
      });
      for (const person of batch.docs) names.set(String(person.id), person.name || person.email || "Salesperson");
      if (!batch.hasNextPage) break;
    }
    const report = buildCrmReport(leads, names, options, window);
    if (options.format === "json") return Response.json(report, { headers: commonHeaders });

    const bytes = options.format === "csv" ? reportCSV(report.table)
      : options.format === "xlsx" ? reportXLSX(report.table)
        : reportPDF(report.table, `Noida CRM ${options.kind} report - ${window.label}`);
    const mediaType = options.format === "csv" ? "text/csv; charset=utf-8"
      : options.format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf";
    return new Response(new Blob([Uint8Array.from(bytes)]), {
      headers: {
        ...commonHeaders,
        "Content-Type": mediaType,
        "Content-Disposition": `attachment; filename="noida-crm-${options.kind}-${options.period}.${options.format}"`,
      },
    });
  } catch {
    return fail(500, "CRM report could not be generated");
  }
}
