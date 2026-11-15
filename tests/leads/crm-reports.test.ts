import assert from "node:assert/strict";
import test from "node:test";
import { CentralLeads } from "../../collections/Crm";
import { buildCrmReport, parseReportOptions, reportWindow, type ReportLead } from "../../lib/crm/report-core";
import { reportCSV, reportPDF, reportXLSX } from "../../lib/crm/report-export";

const url = (query: string) => new URL(`http://127.0.0.1/api/crm/reports?${query}`);
const options = parseReportOptions(url("period=all&report=overview"));
const leads: ReportLead[] = [
  { id: "1", name: "Alpha", source: "website", status: "new", createdAt: "2026-10-18T19:00:00.000Z", nextFollowUpAt: "2026-10-20T06:00:00.000Z", assignedSalesperson: "s1" },
  { id: "2", name: "Beta", source: "chatbot", status: "converted", createdAt: "2026-10-19T03:00:00.000Z", assignedSalesperson: "s2" },
  { id: "3", name: "Gamma", source: "website", status: "follow-up", createdAt: "2026-10-19T07:00:00.000Z", nextFollowUpAt: "2026-10-19T03:00:00.000Z", assignedSalesperson: "s1" },
];

test("report dates use Asia/Kolkata calendar boundaries and validate custom ranges", () => {
  const now = new Date("2026-10-18T19:00:00.000Z");
  assert.deepEqual(reportWindow(parseReportOptions(url("period=daily")), now), {
    start: "2026-10-18T18:30:00.000Z", endExclusive: "2026-10-19T18:30:00.000Z", label: "2026-10-19",
  });
  assert.deepEqual(reportWindow(parseReportOptions(url("period=weekly")), now), {
    start: "2026-10-18T18:30:00.000Z", endExclusive: "2026-10-25T18:30:00.000Z", label: "2026-10-19 to 2026-10-25",
  });
  assert.equal(reportWindow(parseReportOptions(url("period=monthly")), now).start, "2026-09-30T18:30:00.000Z");
  assert.equal(reportWindow(parseReportOptions(url("period=custom&from=2026-10-01&to=2026-10-19")), now).endExclusive, "2026-10-19T18:30:00.000Z");
  for (const query of ["period=custom&from=2026-02-30&to=2026-03-01", "period=custom&from=2026-10-20&to=2026-10-19", "period=custom&from=2025-01-01&to=2026-12-31", "period=monthly&from=2026-10-01", "status=invalid", "format=html", "report=unknown", "period=all&period=all", "salesperson=%24where"]) {
    assert.throws(() => parseReportOptions(url(query)), query);
  }
});

test("status, source, salesperson, follow-up and conversion reports use the same authorized lead set", () => {
  const names = new Map([["s1", "Sales 01"], ["s2", "Sales 02"]]);
  const now = new Date("2026-10-19T09:00:00.000Z");
  const report = buildCrmReport(leads, names, options, reportWindow(options, now), now);
  assert.equal(report.summary.total, 3);
  assert.equal(report.summary.converted, 1);
  assert.equal(report.summary.conversionRate, 33.33);
  assert.deepEqual(report.summary.sources, [{ label: "website", count: 2 }, { label: "chatbot", count: 1 }]);
  assert.deepEqual(report.summary.salespeople, [{ label: "Sales 01", count: 2 }, { label: "Sales 02", count: 1 }]);
  assert.deepEqual(report.summary.followUps, { upcoming: 1, overdue: 1, unscheduled: 0, closed: 1 });
  assert.deepEqual(report.summary.dailyTrend, [{ date: "2026-10-19", count: 3 }]);
  assert.equal(report.table.rows.length, 3);
  const followUps = buildCrmReport(leads, names, { ...options, kind: "follow-up" }, report.window, now);
  assert.deepEqual(followUps.table.rows.map((row) => row[0]).sort(), ["1", "3"]);
  const status = buildCrmReport(leads, names, { ...options, kind: "status" }, report.window, now);
  assert.equal(status.table.rows.find((row) => row[0] === "converted")?.[1], "1");
  const conversion = buildCrmReport(leads, names, { ...options, kind: "conversion" }, report.window, now);
  assert.deepEqual(conversion.table.rows.at(-1), ["Conversion rate (%)", "33.33"]);
  const empty = buildCrmReport([], names, options, report.window, now);
  assert.equal(empty.summary.conversionRate, 0);
  assert.equal(empty.summary.total, 0);
});

test("CSV, genuine XLSX package and PDF exports contain report content safely", () => {
  const table = { headers: ["Name", "Status"], rows: [["=HYPERLINK(\"bad\")", "new"], ["A, B", "converted"]] };
  const csv = reportCSV(table).toString("utf8");
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("'="));
  assert.ok(csv.includes('"A, B"'));
  const xlsx = reportXLSX(table);
  assert.equal(xlsx.readUInt32LE(0), 0x04034b50);
  assert.ok(xlsx.includes(Buffer.from("xl/worksheets/sheet1.xml")));
  assert.ok(xlsx.includes(Buffer.from("=HYPERLINK")));
  assert.ok(xlsx.includes(Buffer.from("t=\"inlineStr\"")));
  const pdf = reportPDF(table, "Noida CRM status report");
  assert.ok(pdf.toString("ascii").startsWith("%PDF-1.4"));
  assert.ok(pdf.toString("ascii").includes("Noida CRM status report"));
  assert.ok(pdf.toString("ascii").includes("%%EOF"));
});

test("lead identity fields are admin-only while operational fields remain role-scoped", () => {
  for (const name of ["name", "email", "phone", "assignedSalesperson", "office", "team"]) {
    const field = CentralLeads.fields.find((item) => "name" in item && item.name === name);
    assert.ok(field && "access" in field && field.access?.update, `${name} has an update guard`);
    const update = field.access.update;
    assert.equal(update({ req: { user: { role: "salesperson" } } } as never), false);
    assert.equal(update({ req: { user: { role: "super-admin" } } } as never), true);
  }
  for (const name of ["status", "notes", "nextFollowUpAt"]) {
    const field = CentralLeads.fields.find((item) => "name" in item && item.name === name);
    assert.ok(field);
  }
});
