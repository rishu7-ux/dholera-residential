export const CRM_REPORT_TIME_ZONE = "Asia/Kolkata";
export const CRM_LEAD_STATUSES = ["new", "contacted", "follow-up", "qualified", "converted", "lost"] as const;
export type CrmLeadStatus = (typeof CRM_LEAD_STATUSES)[number];
export type ReportPeriod = "daily" | "weekly" | "monthly" | "custom" | "all";
export type ReportKind = "overview" | "status" | "source" | "salesperson" | "follow-up" | "conversion";
export type ReportFormat = "json" | "csv" | "xlsx" | "pdf";

export type ReportOptions = {
  period: ReportPeriod;
  kind: ReportKind;
  format: ReportFormat;
  from?: string;
  to?: string;
  status?: CrmLeadStatus;
  source?: string;
  salesperson?: string;
};

export type ReportWindow = { start: string | null; endExclusive: string | null; label: string };
export type ReportLead = {
  id: string | number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  project?: string | null;
  source?: string | null;
  status?: string | null;
  createdAt: string;
  nextFollowUpAt?: string | null;
  lastContactedAt?: string | null;
  assignedSalesperson?: string | number | { id?: string | number; name?: string | null; email?: string | null } | null;
};
export type ReportTable = { headers: string[]; rows: string[][] };

const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const periods = new Set<ReportPeriod>(["daily", "weekly", "monthly", "custom", "all"]);
const kinds = new Set<ReportKind>(["overview", "status", "source", "salesperson", "follow-up", "conversion"]);
const formats = new Set<ReportFormat>(["json", "csv", "xlsx", "pdf"]);

function calendarDay(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Date must use YYYY-MM-DD");
  const millis = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 10) !== value) throw new Error("Invalid calendar date");
  return millis;
}

function istStart(utcCalendarDay: number): string {
  return new Date(utcCalendarDay - IST_OFFSET_MS).toISOString();
}

export function parseReportOptions(url: URL): ReportOptions {
  const params = url.searchParams;
  const allowed = new Set(["period", "report", "format", "from", "to", "status", "source", "salesperson"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) throw new Error("Unknown or repeated report filter");
  }
  const period = (params.get("period") || "monthly") as ReportPeriod;
  const kind = (params.get("report") || "overview") as ReportKind;
  const format = (params.get("format") || "json") as ReportFormat;
  if (!periods.has(period) || !kinds.has(kind) || !formats.has(format)) throw new Error("Invalid report type, period or format");
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;
  if (period === "custom") {
    if (!from || !to) throw new Error("Custom reports require from and to dates");
    const span = calendarDay(to) - calendarDay(from);
    if (span < 0 || span >= 366 * DAY_MS) throw new Error("Custom report range must be at most 366 days");
  } else if (from || to) throw new Error("from/to require a custom period");
  const status = params.get("status") || undefined;
  if (status && !CRM_LEAD_STATUSES.includes(status as CrmLeadStatus)) throw new Error("Invalid lead status filter");
  const source = params.get("source")?.trim() || undefined;
  if (source && (source.length > 100 || /[\x00-\x1f]/.test(source))) throw new Error("Invalid lead source filter");
  const salesperson = params.get("salesperson") || undefined;
  if (salesperson && !/^[a-f\d]{24}$/i.test(salesperson)) throw new Error("Invalid salesperson filter");
  return { period, kind, format, from, to, status: status as CrmLeadStatus | undefined, source, salesperson };
}

export function reportWindow(options: ReportOptions, now = new Date()): ReportWindow {
  if (options.period === "all") return { start: null, endExclusive: null, label: "All dates" };
  const today = new Date(now.getTime() + IST_OFFSET_MS);
  let startDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  let endDay = startDay + DAY_MS;
  if (options.period === "weekly") {
    const dayOfWeek = (today.getUTCDay() + 6) % 7;
    startDay -= dayOfWeek * DAY_MS;
    endDay = startDay + 7 * DAY_MS;
  } else if (options.period === "monthly") {
    startDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
    endDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1);
  } else if (options.period === "custom") {
    startDay = calendarDay(options.from!);
    endDay = calendarDay(options.to!) + DAY_MS;
  }
  const first = new Date(startDay).toISOString().slice(0, 10);
  const last = new Date(endDay - DAY_MS).toISOString().slice(0, 10);
  return { start: istStart(startDay), endExclusive: istStart(endDay), label: first === last ? first : `${first} to ${last}` };
}

export function relationshipID(value: ReportLead["assignedSalesperson"]): string {
  if (value && typeof value === "object") return String(value.id ?? "");
  return value == null ? "" : String(value);
}

function safeDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

export function buildCrmReport(
  leads: readonly ReportLead[],
  salespersonNames: ReadonlyMap<string, string>,
  options: ReportOptions,
  window: ReportWindow,
  now = new Date(),
) {
  const statusCounts = Object.fromEntries(CRM_LEAD_STATUSES.map((status) => [status, 0])) as Record<CrmLeadStatus, number>;
  const sourceCounts = new Map<string, number>();
  const salespersonCounts = new Map<string, number>();
  const trendCounts = new Map<string, number>();
  const followUps = { upcoming: 0, overdue: 0, unscheduled: 0, closed: 0 };
  const visible = [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const lead of visible) {
    const status = CRM_LEAD_STATUSES.includes(lead.status as CrmLeadStatus) ? lead.status as CrmLeadStatus : null;
    if (status) statusCounts[status]++;
    const source = lead.source?.trim() || "Unknown";
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    const id = relationshipID(lead.assignedSalesperson);
    const salesperson = id ? salespersonNames.get(id) || "Unknown salesperson" : "Unassigned";
    salespersonCounts.set(salesperson, (salespersonCounts.get(salesperson) || 0) + 1);
    const day = new Date(new Date(lead.createdAt).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
    trendCounts.set(day, (trendCounts.get(day) || 0) + 1);
    if (status === "converted" || status === "lost") followUps.closed++;
    else if (!lead.nextFollowUpAt) followUps.unscheduled++;
    else if (new Date(lead.nextFollowUpAt).getTime() < now.getTime()) followUps.overdue++;
    else followUps.upcoming++;
  }
  const sorted = (counts: Map<string, number>) => [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label, count]) => ({ label, count }));
  const converted = statusCounts.converted;
  const total = visible.length;
  const summary = {
    total,
    converted,
    conversionRate: total ? Math.round((converted / total) * 10_000) / 100 : 0,
    statuses: CRM_LEAD_STATUSES.map((label) => ({ label, count: statusCounts[label] })),
    sources: sorted(sourceCounts),
    salespeople: sorted(salespersonCounts),
    dailyTrend: [...trendCounts].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
    followUps,
  };
  let table: ReportTable;
  if (options.kind === "status") table = { headers: ["Status", "Lead count"], rows: summary.statuses.map((row) => [row.label, String(row.count)]) };
  else if (options.kind === "source") table = { headers: ["Source", "Lead count"], rows: summary.sources.map((row) => [row.label, String(row.count)]) };
  else if (options.kind === "salesperson") table = { headers: ["Salesperson", "Assigned leads"], rows: summary.salespeople.map((row) => [row.label, String(row.count)]) };
  else if (options.kind === "conversion") table = { headers: ["Metric", "Value"], rows: [["Total leads", String(total)], ["Converted leads", String(converted)], ["Conversion rate (%)", String(summary.conversionRate)]] };
  else {
    const rows = options.kind === "follow-up" ? visible.filter((lead) => Boolean(lead.nextFollowUpAt) && !["converted", "lost"].includes(lead.status || "")) : visible;
    table = {
      headers: ["Lead ID", "Name", "Phone", "Email", "Website", "Project", "Source", "Status", "Assigned to", "Created (UTC)", "Follow up (UTC)"],
      rows: rows.map((lead) => [String(lead.id), lead.name || "", lead.phone || "", lead.email || "", lead.website || "", lead.project || "", lead.source || "", lead.status || "", salespersonNames.get(relationshipID(lead.assignedSalesperson)) || "", safeDate(lead.createdAt), safeDate(lead.nextFollowUpAt)]),
    };
  }
  return { period: options.period, kind: options.kind, timeZone: CRM_REPORT_TIME_ZONE, window, summary, table };
}
