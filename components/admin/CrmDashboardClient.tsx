"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LuActivity,
  LuArrowRight,
  LuBuilding2,
  LuCalendarDays,
  LuChartColumn,
  LuChartPie,
  LuChevronLeft,
  LuChevronRight,
  LuDownload,
  LuFilter,
  LuLayoutDashboard,
  LuMail,
  LuMenu,
  LuSearch,
  LuTarget,
  LuUsers,
  LuUserRound,
  LuX,
} from "react-icons/lu";
import type { IconType } from "react-icons";
import type { ReportPeriod } from "../../lib/crm/report-core";
import "./crm-dashboard.css";

type Role = "super-admin" | "team-leader" | "salesperson";
type Person = { id: string; name: string; active: boolean };
type Count = { label: string; count: number };
type Summary = {
  total: number;
  converted: number;
  conversionRate: number;
  statuses: Count[];
  sources: Count[];
  salespeople: Count[];
  dailyTrend: { date: string; count: number }[];
  followUps: {
    upcoming: number;
    overdue: number;
    unscheduled: number;
    closed: number;
  };
};
type Report = {
  period: ReportPeriod;
  window: { label: string };
  summary: Summary;
  table: { headers: string[]; rows: string[][] };
};
type Filters = {
  period: ReportPeriod;
  from: string;
  to: string;
  status: string;
  source: string;
  salesperson: string;
};
type Props = {
  officeId: string;
  officeCode: "noida" | "ahmedabad";
  officeName: string;
  role: Role;
  name: string;
  roster: Person[];
  contactCount: number;
  recentActivity: {
    id: string;
    event: string;
    date: string;
    lead: string;
    actor: string;
    details: string;
  }[];
};
type Performance = { person: Person; report: Report };

const nav: { label: string; href: string; icon: IconType; roles: Role[] }[] = [
  {
    label: "Dashboard",
    href: "/admin/crm-dashboard",
    icon: LuLayoutDashboard,
    roles: ["super-admin", "team-leader", "salesperson"],
  },
  {
    label: "CRM Overview",
    href: "#crm-overview",
    icon: LuChartPie,
    roles: ["super-admin", "team-leader", "salesperson"],
  },
  {
    label: "Enquiries",
    href: "/admin/collections/central-leads?where%5BleadType%5D%5Bequals%5D=enquiry",
    icon: LuMail,
    roles: ["super-admin", "team-leader", "salesperson"],
  },
  {
    label: "Contact Messages",
    href: "/admin/collections/central-leads?where%5BleadType%5D%5Bequals%5D=contact",
    icon: LuActivity,
    roles: ["super-admin", "team-leader", "salesperson"],
  },
  {
    label: "Leads",
    href: "/admin/collections/central-leads",
    icon: LuTarget,
    roles: ["super-admin", "team-leader", "salesperson"],
  },
  {
    label: "Salespeople",
    href: "/admin/collections/users",
    icon: LuUsers,
    roles: ["super-admin", "team-leader"],
  },
  {
    label: "Teams",
    href: "/admin/collections/crm-teams",
    icon: LuUsers,
    roles: ["super-admin", "team-leader"],
  },
  {
    label: "CRM Offices",
    href: "/admin/collections/crm-offices",
    icon: LuBuilding2,
    roles: ["super-admin", "team-leader"],
  },
  {
    label: "Reports",
    href: "#crm-reports",
    icon: LuChartColumn,
    roles: ["super-admin", "team-leader", "salesperson"],
  },
];
const statusLabels: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  "follow-up": "Follow-up",
  qualified: "Qualified",
  converted: "Converted",
  lost: "Lost",
};
const chartColors = [
  "#ff6b00",
  "#ff9a4d",
  "#ffbd82",
  "#2563eb",
  "#14b8a6",
  "#94a3b8",
];
const initialFilters: Filters = {
  period: "monthly",
  from: "",
  to: "",
  status: "",
  source: "",
  salesperson: "",
};

function reportURL(
  filters: Filters,
  officeCode: "noida" | "ahmedabad",
  format: "json" | "csv" | "xlsx" | "pdf" = "json",
) {
  const query = new URLSearchParams({
    office: officeCode,
    period: filters.period,
    report: "overview",
    format,
  });
  if (filters.period === "custom") {
    query.set("from", filters.from);
    query.set("to", filters.to);
  }
  if (filters.status) query.set("status", filters.status);
  if (filters.source) query.set("source", filters.source);
  if (filters.salesperson) query.set("salesperson", filters.salesperson);
  return `/api/crm/reports?${query.toString()}`;
}

async function getReport(
  filters: Filters,
  officeCode: "noida" | "ahmedabad",
  signal: AbortSignal,
): Promise<Report> {
  const response = await fetch(reportURL(filters, officeCode), {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      result.error || `Report request failed (${response.status})`,
    );
  }
  return response.json() as Promise<Report>;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(date)
    : "—";
}
function todayIST() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}
function pct(value: number) {
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}
function statusCount(summary: Summary, status: string) {
  return summary.statuses.find((row) => row.label === status)?.count || 0;
}

export default function CrmDashboardClient({
  officeId,
  officeCode,
  officeName,
  role,
  name,
  roster,
  contactCount,
  recentActivity,
}: Props) {
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [report, setReport] = useState<Report | null>(null);
  const [todayReport, setTodayReport] = useState<Report | null>(null);
  const [performance, setPerformance] = useState<Performance[]>([]);
  const [performanceError, setPerformanceError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [backlogMessage, setBacklogMessage] = useState("");
  const [assigningBacklog, setAssigningBacklog] = useState(false);
  const [staffUserId, setStaffUserId] = useState("");
  const [manualSetupURL, setManualSetupURL] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const dailyFilters: Filters = { ...initialFilters, period: "daily" };
    Promise.all([
      getReport(filters, officeCode, controller.signal),
      role === "super-admin"
        ? getReport(dailyFilters, officeCode, controller.signal)
        : Promise.resolve(null),
      role === "team-leader"
        ? Promise.allSettled(
            roster.map(async (person) => ({
              person,
              report: await getReport(
                { ...filters, salesperson: person.id },
                officeCode,
                controller.signal,
              ),
            })),
          )
        : Promise.resolve([]),
    ])
      .then(([main, daily, rows]) => {
        if (controller.signal.aborted) return;
        setReport(main);
        setTodayReport(daily);
        if (role === "team-leader") {
          const results = rows as PromiseSettledResult<Performance>[];
          setPerformance(
            results
              .filter(
                (row): row is PromiseFulfilledResult<Performance> =>
                  row.status === "fulfilled",
              )
              .map((row) => row.value),
          );
          setPerformanceError(results.some((row) => row.status === "rejected"));
        }
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The CRM report could not load.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [filters, role, roster, officeCode]);

  const rows = useMemo(() => {
    const source = report?.table.rows || [];
    const term = search.trim().toLocaleLowerCase();
    const matched = term
      ? source.filter((row) =>
          row.some((cell) => cell.toLocaleLowerCase().includes(term)),
        )
      : [...source];
    if (sort === "oldest") matched.reverse();
    if (sort === "name")
      matched.sort((a, b) => (a[1] || "").localeCompare(b[1] || ""));
    return matched;
  }, [report, search, sort]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 8));
  const visibleRows = rows.slice((page - 1) * 8, page * 8);
  const title =
    role === "salesperson"
      ? "My sales workspace"
      : role === "team-leader"
        ? "Team performance"
        : "Sales command center";
  const subtitle =
    role === "salesperson"
      ? "Track your leads, follow-ups and progress."
      : role === "team-leader"
        ? `An accurate view of your authorized ${officeName} office.`
        : `A clear view of ${officeName} sales activity and conversion.`;

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      draft.period === "custom" &&
      (!draft.from || !draft.to || draft.from > draft.to)
    )
      return;
    setPage(1);
    setLoading(true);
    setError("");
    setPerformanceError(false);
    setFilters({ ...draft });
  }

  async function assignBacklog() {
    if (!window.confirm(`Assign up to 20 oldest unassigned ${officeName} leads to active salespeople?`)) return;
    setAssigningBacklog(true);
    setBacklogMessage("");
    try {
      const response = await fetch("/api/crm/assign-backlog", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 20, office: officeCode }),
      });
      if (!response.ok) throw new Error("Assignment was not completed. Check staff eligibility and try again.");
      const result = await response.json() as { assigned: number; remaining: number };
      setBacklogMessage(`Assigned ${result.assigned} leads. ${result.remaining} remain unassigned.`);
      setFilters({ ...filters });
    } catch (cause) {
      setBacklogMessage(cause instanceof Error ? cause.message : "Assignment failed.");
    } finally {
      setAssigningBacklog(false);
    }
  }

  async function createManualSetupLink() {
    const id = staffUserId.trim();
    if (!id || !window.confirm("Identity verified in person? Generate a one-use staff setup link for this existing user ID?")) return;
    setManualSetupURL("");
    setBacklogMessage("");
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(id)}/invite-manual`, {
        method: "POST", credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Staff setup link could not be generated.");
      const result = await response.json() as { resetURL: string };
      setManualSetupURL(result.resetURL);
      setTimeout(() => setManualSetupURL(""), 120_000);
    } catch (cause) {
      setBacklogMessage(cause instanceof Error ? cause.message : "Staff setup failed.");
    }
  }

  return (
    <div className={`crm-shell${collapsed ? " crm-shell--collapsed" : ""}`}>
      {drawer && (
        <button
          className="crm-backdrop"
          aria-label="Close navigation"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside
        className={`crm-sidebar${drawer ? " crm-sidebar--open" : ""}`}
        aria-label="CRM navigation"
      >
        <div className="crm-brand">
          <span className="crm-brand__mark">D</span>
          <div className="crm-brand__text">
            <strong>DHOLERA</strong>
            <small>SALES CRM</small>
          </div>
          <button
            className="crm-icon-button crm-sidebar__close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          >
            <LuX />
          </button>
        </div>
        <div className="crm-sidebar__caption">WORKSPACE</div>
        <nav className="crm-nav">
          {nav
            .filter((item) => item.roles.includes(role))
            .map((item) => (
              <Link
                key={item.label}
                href={item.label === "Dashboard" ? `/admin/crm-dashboard?office=${officeCode}`
                  : item.href.startsWith("/admin/collections/central-leads")
                    ? `${item.href}${item.href.includes("?") ? "&" : "?"}where%5Boffice%5D%5Bequals%5D=${encodeURIComponent(officeId)}`
                    : item.href}
                className={`crm-nav__link${item.label === "Dashboard" ? " crm-nav__link--active" : ""}`}
                title={collapsed ? item.label : undefined}
                onClick={() => setDrawer(false)}
              >
                <item.icon aria-hidden="true" />
                <span>{item.label}</span>
                {item.label === "Dashboard" && (
                  <span className="crm-nav__active-dot" />
                )}
              </Link>
            ))}
        </nav>
        <div className="crm-sidebar__bottom">
          <div className="crm-sidebar__scope">
            <LuBuilding2 aria-hidden="true" />
            <div>
              <strong>{officeName} office</strong>
              <span>Role-scoped access</span>
            </div>
          </div>
          <button
            type="button"
            className="crm-sidebar__collapse"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <LuChevronLeft aria-hidden="true" />
            <span>Collapse menu</span>
          </button>
        </div>
      </aside>
      <div className="crm-main">
        <header className="crm-topbar">
          <div className="crm-topbar__left">
            <button
              type="button"
              className="crm-icon-button crm-mobile-menu"
              aria-label="Open navigation"
              onClick={() => setDrawer(true)}
            >
              <LuMenu />
            </button>
            <div className="crm-topbar__breadcrumb">
              Workspace <LuChevronRight aria-hidden="true" />{" "}
              <strong>Dashboard</strong>
            </div>
          </div>
          <div className="crm-topbar__user">
            <div className="crm-topbar__avatar">
              <LuUserRound aria-hidden="true" />
            </div>
            <div>
              <strong>{name}</strong>
              <span>
                {role === "super-admin"
                  ? "Master Admin"
                  : role === "team-leader"
                    ? "Team Leader"
                    : "Salesperson"}
              </span>
            </div>
          </div>
        </header>
        <main className="crm-content" id="crm-overview">
          <div className="crm-page-heading">
            <div>
              <div className="crm-eyebrow">
                <span /> {officeName.toUpperCase()} • SALES INTELLIGENCE
              </div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            <div className="crm-page-heading__badge">
              <LuCalendarDays aria-hidden="true" />{" "}
              {report?.window.label || "Selected period"}
            </div>
          </div>

          {role === "super-admin" && (
            <div>
              <button type="button" className="crm-button crm-button--secondary"
                disabled={assigningBacklog} onClick={assignBacklog}>
                {assigningBacklog ? "Assigning…" : "Assign unassigned leads (up to 20)"}
              </button>
              {backlogMessage && <p role="status">{backlogMessage}</p>}
              <div>
                <label htmlFor="crm-staff-user-id">Existing staff user ID</label>
                <input id="crm-staff-user-id" value={staffUserId} autoComplete="off"
                  onChange={(event) => setStaffUserId(event.target.value)} />
                <button type="button" className="crm-button crm-button--secondary"
                  onClick={createManualSetupLink}>Generate private setup link</button>
                {manualSetupURL && (
                  <p role="status">Hand this one-use link directly to the verified staff member within 30 minutes. Do not send it in chat or ordinary email.
                    <input aria-label="Private one-use setup link" readOnly autoComplete="off" value={manualSetupURL} />
                  </p>
                )}
              </div>
            </div>
          )}

          <form
            className="crm-filters"
            onSubmit={applyFilters}
            aria-label="Dashboard filters"
          >
            <div className="crm-filters__title">
              <LuFilter aria-hidden="true" />
              <span>Filters</span>
            </div>
            <label>
              Period
              <select
                value={draft.period}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    period: event.target.value as ReportPeriod,
                  })
                }
              >
                <option value="daily">Today</option>
                <option value="weekly">This week</option>
                <option value="monthly">This month</option>
                <option value="custom">Custom dates</option>
                <option value="all">All dates</option>
              </select>
            </label>
            {draft.period === "custom" && (
              <>
                <label>
                  From
                  <input
                    type="date"
                    required
                    value={draft.from}
                    onChange={(event) =>
                      setDraft({ ...draft, from: event.target.value })
                    }
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    required
                    min={draft.from || undefined}
                    value={draft.to}
                    onChange={(event) =>
                      setDraft({ ...draft, to: event.target.value })
                    }
                  />
                </label>
              </>
            )}
            <label>
              Status
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft({ ...draft, status: event.target.value })
                }
              >
                <option value="">All statuses</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Source
              <input
                value={draft.source}
                list="crm-source-suggestions"
                maxLength={100}
                placeholder="All sources"
                onChange={(event) =>
                  setDraft({ ...draft, source: event.target.value })
                }
              />
            </label>
            <datalist id="crm-source-suggestions">
              {report?.summary.sources.map((source) => (
                <option value={source.label} key={source.label} />
              ))}
            </datalist>
            {role !== "salesperson" && (
              <label>
                Salesperson
                <select
                  value={draft.salesperson}
                  onChange={(event) =>
                    setDraft({ ...draft, salesperson: event.target.value })
                  }
                >
                  <option value="">All salespeople</option>
                  {roster.map((person) => (
                    <option value={person.id} key={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="submit" className="crm-button crm-button--primary">
              Apply filters <LuArrowRight aria-hidden="true" />
            </button>
          </form>

          {loading ? (
            <DashboardSkeleton />
          ) : error ? (
            <div className="crm-state crm-state--error" role="alert">
              <strong>Dashboard unavailable</strong>
              <p>{error}</p>
              <button
                type="button"
                className="crm-button crm-button--secondary"
                onClick={() => {
                  setLoading(true);
                  setError("");
                  setFilters({ ...filters });
                }}
              >
                Try again
              </button>
            </div>
          ) : report ? (
            <>
              <div className="crm-section-title">
                <div>
                  <span className="crm-section-title__eyebrow">
                    AT A GLANCE
                  </span>
                  <h2>
                    {role === "team-leader"
                      ? "Your team pipeline"
                      : role === "salesperson"
                        ? "Your pipeline"
                        : "Business overview"}
                  </h2>
                </div>
                <span>
                  Selected period: {report.window.label}. Exceptions are
                  labeled.
                </span>
              </div>
              <div className="crm-kpi-grid">
                <Kpi
                  icon={LuTarget}
                  label={
                    role === "salesperson"
                      ? "My assigned leads"
                      : role === "team-leader"
                        ? "Team leads"
                        : "Total leads"
                  }
                  value={report.summary.total}
                  note="Selected period"
                />
                {role === "super-admin" && (
                  <Kpi
                    icon={LuCalendarDays}
                    label="Today's leads"
                    value={todayReport?.summary.total ?? "—"}
                    note={todayIST()}
                  />
                )}
                <Kpi
                  icon={LuActivity}
                  label="New leads"
                  value={statusCount(report.summary, "new")}
                  note="Awaiting first contact"
                />
                <Kpi
                  icon={LuTarget}
                  label="Converted leads"
                  value={report.summary.converted}
                  note="Status: converted"
                />
                <Kpi
                  icon={LuCalendarDays}
                  label="Pending follow-ups"
                  value={report.summary.followUps.upcoming}
                  note="Scheduled, not overdue"
                />
                <Kpi
                  icon={LuCalendarDays}
                  label="Overdue follow-ups"
                  value={report.summary.followUps.overdue}
                  note="Requires attention"
                  tone="urgent"
                />
                {role !== "salesperson" && (
                  <Kpi
                    icon={LuUsers}
                    label="Active salespeople"
                    value={roster.filter((person) => person.active).length}
                    note={`${officeName} office roster`}
                  />
                )}
                {role === "super-admin" && (
                  <Kpi
                    icon={LuMail}
                    label="Contact messages (all)"
                    value={contactCount}
                    note={`All dates · ${officeName}`}
                  />
                )}
                <Kpi
                  icon={LuChartPie}
                  label="Conversion rate"
                  value={pct(report.summary.conversionRate)}
                  note="Converted ÷ total leads"
                />
              </div>

              <div className="crm-section-title">
                <div>
                  <span className="crm-section-title__eyebrow">
                    PERFORMANCE
                  </span>
                  <h2>Pipeline analytics</h2>
                </div>
                <span>Based on authorized CRM records</span>
              </div>
              <div className="crm-chart-grid">
                <Donut
                  title="Lead status distribution"
                  subtitle="How leads move through the pipeline"
                  data={report.summary.statuses.map((item) => ({
                    ...item,
                    label: statusLabels[item.label] || item.label,
                  }))}
                />
                {role !== "salesperson" && (
                  <BarChart
                    title={
                      role === "team-leader"
                        ? "Salesperson assignments"
                        : "Leads by salesperson"
                    }
                    subtitle="Assigned leads in selected period"
                    data={report.summary.salespeople.slice(0, 10)}
                  />
                )}
                <Donut
                  title="Lead sources"
                  subtitle="Where enquiries originate"
                  data={report.summary.sources.slice(0, 6)}
                />
                <TrendChart
                  title={
                    role === "salesperson"
                      ? "My monthly lead trend"
                      : "Monthly lead trend"
                  }
                  subtitle="Lead creation by calendar month (IST)"
                  data={report.summary.dailyTrend}
                />
                <Donut
                  title="Follow-up progress"
                  subtitle="Open, overdue and closed"
                  data={[
                    {
                      label: "Upcoming",
                      count: report.summary.followUps.upcoming,
                    },
                    {
                      label: "Overdue",
                      count: report.summary.followUps.overdue,
                    },
                    {
                      label: "Unscheduled",
                      count: report.summary.followUps.unscheduled,
                    },
                    { label: "Closed", count: report.summary.followUps.closed },
                  ]}
                />
                <div className="crm-chart-card crm-conversion">
                  <ChartHeading
                    title="Conversion performance"
                    subtitle="Converted leads as a share of all leads"
                  />
                  <div className="crm-conversion__rate">
                    {pct(report.summary.conversionRate)}
                  </div>
                  <div className="crm-conversion__track">
                    <span
                      style={{
                        width: `${Math.min(100, Math.max(0, report.summary.conversionRate))}%`,
                      }}
                    />
                  </div>
                  <p>
                    {report.summary.converted.toLocaleString("en-IN")} converted
                    from {report.summary.total.toLocaleString("en-IN")} leads
                  </p>
                </div>
              </div>

              {role === "team-leader" && (
                <section
                  className="crm-team-section"
                  aria-labelledby="crm-team-heading"
                >
                  <div className="crm-section-title">
                    <div>
                      <span className="crm-section-title__eyebrow">
                        TEAM INSIGHTS
                      </span>
                      <h2 id="crm-team-heading">Salesperson performance</h2>
                    </div>
                    <span>{officeName} office roster</span>
                  </div>
                  <BarChart
                    title="Assigned and converted"
                    subtitle="Individual performance in selected period"
                    data={performance.map(
                      ({ person, report: personReport }) => ({
                        id: person.id,
                        label: person.name,
                        count: personReport.summary.total,
                        secondary: personReport.summary.converted,
                      }),
                    )}
                    secondaryLabel="Converted"
                  />
                  {performanceError && (
                    <p className="crm-inline-warning" role="status">
                      Some salesperson reports could not load. Incomplete rows
                      are omitted.
                    </p>
                  )}
                  <div className="crm-table-card">
                    <div className="crm-table-card__head">
                      <div>
                        <h3>Team performance report</h3>
                        <p>
                          New, converted and follow-up figures use the same
                          report period.
                        </p>
                      </div>
                    </div>
                    <div className="crm-table-scroll">
                      <table className="crm-table">
                        <thead>
                          <tr>
                            <th>Salesperson</th>
                            <th>Assigned</th>
                            <th>New</th>
                            <th>Hot</th>
                            <th>Warm</th>
                            <th>Cold</th>
                            <th>Converted</th>
                            <th>Pending</th>
                            <th>Overdue</th>
                            <th>Conversion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {performance.map(
                            ({ person, report: personReport }) => (
                              <tr key={person.id}>
                                <td>
                                  <strong>{person.name}</strong>
                                </td>
                                <td>{personReport.summary.total}</td>
                                <td>
                                  {statusCount(personReport.summary, "new")}
                                </td>
                                <td title="No hot classification in the CRM schema">
                                  —
                                </td>
                                <td title="No warm classification in the CRM schema">
                                  —
                                </td>
                                <td title="No cold classification in the CRM schema">
                                  —
                                </td>
                                <td>{personReport.summary.converted}</td>
                                <td>
                                  {personReport.summary.followUps.upcoming}
                                </td>
                                <td>
                                  {personReport.summary.followUps.overdue}
                                </td>
                                <td>
                                  {pct(personReport.summary.conversionRate)}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                    <p className="crm-table-card__footnote">
                      Hot, warm and cold are unavailable because the current
                      lead schema does not classify leads that way. Pending
                      means scheduled and not overdue.
                    </p>
                  </div>
                </section>
              )}

              <section
                className="crm-leads-section"
                aria-labelledby="crm-leads-heading"
              >
                <div className="crm-section-title">
                  <div>
                    <span className="crm-section-title__eyebrow">
                      LATEST ACTIVITY
                    </span>
                    <h2 id="crm-leads-heading">
                      {role === "salesperson" ? "My leads" : "Recent leads"}
                    </h2>
                  </div>
                  <Link
                    href="/admin/collections/central-leads"
                    className="crm-text-link"
                  >
                    Open lead workspace <LuArrowRight aria-hidden="true" />
                  </Link>
                </div>
                <div className="crm-table-card">
                  <div className="crm-table-card__head">
                    <label className="crm-search">
                      <LuSearch aria-hidden="true" />
                      <span className="crm-visually-hidden">
                        Search visible leads
                      </span>
                      <input
                        value={search}
                        onChange={(event) => {
                          setSearch(event.target.value);
                          setPage(1);
                        }}
                        placeholder="Search visible leads"
                      />
                    </label>
                    <label className="crm-sort">
                      Sort{" "}
                      <select
                        value={sort}
                        onChange={(event) => {
                          setSort(event.target.value as typeof sort);
                          setPage(1);
                        }}
                      >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="name">Name A–Z</option>
                      </select>
                    </label>
                  </div>
                  <div className="crm-table-scroll">
                    <table className="crm-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Contact</th>
                          <th>Project</th>
                          <th>Source</th>
                          <th>Status</th>
                          <th>Assigned to</th>
                          <th>Created</th>
                          <th>Follow-up</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((row) => (
                          <tr key={row[0]}>
                            <td>
                              <strong>{row[1] || "—"}</strong>
                            </td>
                            <td>
                              <span>{row[2] || "—"}</span>
                              <small>{row[3] || ""}</small>
                            </td>
                            <td>{row[5] || row[4] || "—"}</td>
                            <td>{row[6] || "—"}</td>
                            <td>
                              <span
                                className={`crm-status crm-status--${row[7] || "new"}`}
                              >
                                {statusLabels[row[7]] || row[7] || "New"}
                              </span>
                            </td>
                            <td>{row[8] || "Unassigned"}</td>
                            <td>{formatDate(row[9])}</td>
                            <td>{formatDate(row[10])}</td>
                            <td>
                              <Link
                                className="crm-table__action"
                                href={`/admin/collections/central-leads/${encodeURIComponent(row[0])}`}
                              >
                                View <LuArrowRight aria-hidden="true" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {visibleRows.length === 0 && (
                      <div className="crm-empty">
                        <LuSearch aria-hidden="true" />
                        <strong>No leads match these filters</strong>
                        <p>Try another date range, status or search.</p>
                      </div>
                    )}
                  </div>
                  <div className="crm-table-card__footer">
                    <span>
                      {rows.length
                        ? `${(page - 1) * 8 + 1}–${Math.min(page * 8, rows.length)}`
                        : "0"}{" "}
                      of {rows.length}
                    </span>
                    <div>
                      <button
                        type="button"
                        aria-label="Previous page"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                      >
                        <LuChevronLeft />
                      </button>
                      <span>
                        Page {page} of {pageCount}
                      </span>
                      <button
                        type="button"
                        aria-label="Next page"
                        disabled={page >= pageCount}
                        onClick={() => setPage(page + 1)}
                      >
                        <LuChevronRight />
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section
                className="crm-activity-section"
                aria-labelledby="crm-activity-heading"
              >
                <div className="crm-section-title">
                  <div>
                    <span className="crm-section-title__eyebrow">HISTORY</span>
                    <h2 id="crm-activity-heading">Recent lead activity</h2>
                  </div>
                  <span>Latest authorized updates · all dates</span>
                </div>
                <div className="crm-table-card">
                  {recentActivity.length ? (
                    <div className="crm-table-scroll">
                      <table className="crm-table">
                        <thead>
                          <tr>
                            <th>Lead</th>
                            <th>Activity</th>
                            <th>By</th>
                            <th>Details</th>
                            <th>When</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentActivity.map((activity) => (
                            <tr key={activity.id}>
                              <td>
                                <strong>{activity.lead}</strong>
                              </td>
                              <td>{activity.event.replaceAll("-", " ")}</td>
                              <td>{activity.actor}</td>
                              <td
                                className="crm-activity-details"
                                title={activity.details}
                              >
                                {activity.details}
                              </td>
                              <td>{formatDate(activity.date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="crm-empty">
                      <LuActivity aria-hidden="true" />
                      <strong>No recent activity</strong>
                      <p>Lead updates will appear here when available.</p>
                    </div>
                  )}
                </div>
              </section>

              <section
                className="crm-reports"
                id="crm-reports"
                aria-labelledby="crm-reports-heading"
              >
                <div className="crm-section-title">
                  <div>
                    <span className="crm-section-title__eyebrow">EXPORTS</span>
                    <h2 id="crm-reports-heading">Reports</h2>
                  </div>
                  <span>Daily, weekly, monthly and custom dates</span>
                </div>
                <div className="crm-reports__card">
                  <div>
                    <h3>Download the current report</h3>
                    <p>
                      Exports use the applied date, status, source and
                      salesperson filters. Search and table sort apply to this
                      page only.
                    </p>
                  </div>
                  <div className="crm-reports__actions">
                    <a
                      className="crm-button crm-button--secondary"
                      href={reportURL(filters, officeCode, "csv")}
                    >
                      <LuDownload aria-hidden="true" /> CSV
                    </a>
                    <a
                      className="crm-button crm-button--secondary"
                      href={reportURL(filters, officeCode, "xlsx")}
                    >
                      <LuDownload aria-hidden="true" /> Excel
                    </a>
                    <a
                      className="crm-button crm-button--secondary"
                      href={reportURL(filters, officeCode, "pdf")}
                    >
                      <LuDownload aria-hidden="true" /> PDF
                    </a>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: IconType;
  label: string;
  value: string | number;
  note: string;
  tone?: "urgent";
}) {
  return (
    <div className={`crm-kpi${tone ? ` crm-kpi--${tone}` : ""}`}>
      <div className="crm-kpi__top">
        <span>{label}</span>
        <div className="crm-kpi__icon">
          <Icon aria-hidden="true" />
        </div>
      </div>
      <strong>
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </strong>
      <small>{note}</small>
    </div>
  );
}
function ChartHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="crm-chart-card__head">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <LuChartColumn aria-hidden="true" />
    </div>
  );
}
function Donut({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: Count[];
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const nonzero = data.filter((item) => item.count > 0);
  const stops = nonzero.map((item, index) => {
    const start =
      (nonzero
        .slice(0, index)
        .reduce((sum, previous) => sum + previous.count, 0) /
        total) *
      100;
    const end = start + (item.count / total) * 100;
    return `${chartColors[index % chartColors.length]} ${start}% ${end}%`;
  });
  return (
    <div className="crm-chart-card">
      <ChartHeading title={title} subtitle={subtitle} />
      {total ? (
        <div className="crm-donut-layout">
          <div
            className="crm-donut"
            style={{ background: `conic-gradient(${stops.join(", ")})` }}
            role="img"
            aria-label={data
              .map((item) => `${item.label}: ${item.count}`)
              .join(", ")}
          >
            <div>
              <strong>{total.toLocaleString("en-IN")}</strong>
              <span>Total</span>
            </div>
          </div>
          <ul className="crm-legend">
            {data
              .filter((item) => item.count > 0)
              .map((item, index) => (
                <li key={item.label}>
                  <span
                    className="crm-legend__dot"
                    style={{
                      background: chartColors[index % chartColors.length],
                    }}
                  />
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <EmptyChart />
      )}
    </div>
  );
}
function BarChart({
  title,
  subtitle,
  data,
  secondaryLabel,
}: {
  title: string;
  subtitle: string;
  data: (Count & { id?: string; secondary?: number })[];
  secondaryLabel?: string;
}) {
  const max = Math.max(1, ...data.map((item) => item.count));
  return (
    <div className="crm-chart-card">
      <ChartHeading title={title} subtitle={subtitle} />
      {data.length ? (
        <div
          className="crm-bars"
          role="img"
          aria-label={data
            .map(
              (item) =>
                `${item.label}: ${item.count}${item.secondary == null ? "" : `, converted: ${item.secondary}`}`,
            )
            .join("; ")}
        >
          {data.map((item) => (
            <div className="crm-bars__row" key={item.id || item.label}>
              <span title={item.label}>{item.label}</span>
              <div
                className={`crm-bars__track${item.secondary != null ? " crm-bars__track--grouped" : ""}`}
              >
                <span style={{ width: `${(item.count / max) * 100}%` }} />
                {item.secondary != null && (
                  <span
                    className="crm-bars__secondary"
                    style={{ width: `${(item.secondary / max) * 100}%` }}
                  />
                )}
              </div>
              <strong>
                {item.count}
                {item.secondary != null ? ` / ${item.secondary}` : ""}
              </strong>
            </div>
          ))}
          {secondaryLabel && (
            <p className="crm-chart-note">
              Orange: assigned · Blue: {secondaryLabel.toLowerCase()}
            </p>
          )}
        </div>
      ) : (
        <EmptyChart />
      )}
    </div>
  );
}
function TrendChart({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: { date: string; count: number }[];
}) {
  if (!data.length)
    return (
      <div className="crm-chart-card">
        <ChartHeading title={title} subtitle={subtitle} />
        <EmptyChart />
      </div>
    );
  const months = [...new Set(data.map((item) => item.date.slice(0, 7)))].map(
    (month) => ({
      month,
      count: data
        .filter((item) => item.date.startsWith(month))
        .reduce((sum, item) => sum + item.count, 0),
    }),
  );
  if (months.length === 1) {
    const monthLabel = new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date(`${months[0].month}-01T00:00:00.000Z`));
    return (
      <div className="crm-chart-card">
        <ChartHeading title={title} subtitle={subtitle} />
        <div
          className="crm-trend-single"
          role="img"
          aria-label={`${monthLabel}: ${months[0].count} leads`}
        >
          <strong>{months[0].count.toLocaleString("en-IN")}</strong>
          <span>leads in {monthLabel}</span>
          <small>Only one month is included in this period</small>
        </div>
      </div>
    );
  }
  const max = Math.max(1, ...months.map((item) => item.count));
  const coordinates = months.map((item, index) => ({
    x: (index / (months.length - 1)) * 100,
    y: 88 - (item.count / max) * 70,
  }));
  const points = coordinates.map((item) => `${item.x},${item.y}`).join(" ");
  return (
    <div className="crm-chart-card">
      <ChartHeading title={title} subtitle={subtitle} />
      <div
        className="crm-trend"
        role="img"
        aria-label={months
          .map((item) => `${item.month}: ${item.count}`)
          .join("; ")}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            x1="0"
            x2="100"
            y1="88"
            y2="88"
            stroke="#e9edf3"
            strokeWidth="0.6"
          />
          <line
            x1="0"
            x2="100"
            y1="53"
            y2="53"
            stroke="#e9edf3"
            strokeWidth="0.4"
          />
          <polygon points={`0,88 ${points} 100,88`} fill="#fff0e5" />
          <polyline
            points={points}
            fill="none"
            stroke="#ff6b00"
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="crm-trend__axis">
          <span>{months[0].month}</span>
          <span>{months[months.length - 1].month}</span>
        </div>
      </div>
    </div>
  );
}
function EmptyChart() {
  return (
    <div className="crm-chart-empty">
      <LuChartPie aria-hidden="true" />
      <span>No data in this period</span>
    </div>
  );
}
function DashboardSkeleton() {
  return (
    <div aria-label="Loading CRM dashboard" role="status">
      <div className="crm-skeleton crm-skeleton--heading" />
      <div className="crm-kpi-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="crm-skeleton crm-skeleton--kpi" />
        ))}
      </div>
      <div className="crm-chart-grid">
        <div className="crm-skeleton crm-skeleton--chart" />
        <div className="crm-skeleton crm-skeleton--chart" />
      </div>
    </div>
  );
}
