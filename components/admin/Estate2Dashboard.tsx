import type { AdminViewServerProps } from "payload";

type Enquiry = {
  id: string;
  name?: string | null;
  phone?: string | null;
  property?: string | null;
  source?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

type ContactMessage = {
  id: string;
  name?: string | null;
  phone?: string | null;
  budget?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

export default async function Estate2Dashboard({
  initPageResult,
}: AdminViewServerProps) {
  const { payload } = initPageResult.req;
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  ).toISOString();

  const [
    totalEnquiries,
    todayEnquiries,
    newEnquiries,
    totalContacts,
    totalBlogs,
    publishedBlogs,
    recentEnquiriesResult,
    recentContactsResult,
  ] = await Promise.all([
    payload.count({ collection: "estate2-enquiries" }),
    payload.count({
      collection: "estate2-enquiries",
      where: {
        createdAt: {
          greater_than_equal: startOfToday,
          less_than_equal: endOfToday,
        },
      },
    }),
    payload.count({
      collection: "estate2-enquiries",
      where: { status: { equals: "new" } },
    }),
    payload.count({ collection: "estate2-contact-messages" }),
    payload.count({ collection: "estate2-blogs" }),
    payload.count({
      collection: "estate2-blogs",
      where: { status: { equals: "published" } },
    }),
    payload.find({
      collection: "estate2-enquiries",
      limit: 8,
      sort: "-createdAt",
    }),
    payload.find({
      collection: "estate2-contact-messages",
      limit: 8,
      sort: "-createdAt",
    }),
  ]);

  const recentEnquiries = recentEnquiriesResult.docs as Enquiry[];
  const recentContacts = recentContactsResult.docs as ContactMessage[];
  const totalActivity =
    totalEnquiries.totalDocs + totalContacts.totalDocs + totalBlogs.totalDocs;

  return (
    <div className="dholera-dashboard">
      <section className="dholera-dashboard__hero">
        <div className="dholera-dashboard__hero-content">
          <div>
            <p className="dholera-dashboard__eyebrow">DHOLERA ESTATE 2</p>
            <h1>Estate 2 Dashboard</h1>
            <span>Manage Estate 2 leads, contact messages and blogs.</span>
          </div>
          <div className="dholera-dashboard__hero-total">
            <span>Total Activity</span>
            <strong>{totalActivity}</strong>
          </div>
        </div>
      </section>

      <section className="dholera-stats-grid">
        <StatCard
          title="Total Enquiries"
          value={totalEnquiries.totalDocs}
          href="/admin/collections/estate2-enquiries"
        />
        <StatCard
          title="Today's Enquiries"
          value={todayEnquiries.totalDocs}
          href="/admin/collections/estate2-enquiries"
        />
        <StatCard
          title="New Enquiries"
          value={newEnquiries.totalDocs}
          href="/admin/collections/estate2-enquiries"
        />
        <StatCard
          title="Contact Messages"
          value={totalContacts.totalDocs}
          href="/admin/collections/estate2-contact-messages"
        />
        <StatCard
          title="Total Blogs"
          value={totalBlogs.totalDocs}
          href="/admin/collections/estate2-blogs"
        />
        <StatCard
          title="Published Blogs"
          value={publishedBlogs.totalDocs}
          href="/admin/collections/estate2-blogs"
        />
      </section>

      <LeadTable
        title="Recent Estate 2 Enquiries"
        href="/admin/collections/estate2-enquiries"
        rows={recentEnquiries.map((item) => ({
          id: item.id,
          name: item.name,
          phone: item.phone,
          detail: item.property,
          detailLabel: "Property",
          status: item.status,
          createdAt: item.createdAt,
        }))}
      />

      <LeadTable
        title="Recent Estate 2 Contact Messages"
        href="/admin/collections/estate2-contact-messages"
        rows={recentContacts.map((item) => ({
          id: item.id,
          name: item.name,
          phone: item.phone,
          detail: formatBudget(item.budget),
          detailLabel: "Budget",
          status: item.status,
          createdAt: item.createdAt,
        }))}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  href,
}: {
  title: string;
  value: number;
  href: string;
}) {
  return (
    <a href={href} className="dholera-stat-card">
      <div className="dholera-stat-card__top">
        <span>{title}</span>
        <div className="dholera-stat-dot" />
      </div>
      <strong>{value}</strong>
      <div className="dholera-stat-card__footer">
        <p>Dholera Estate 2</p>
        <span>View →</span>
      </div>
    </a>
  );
}

type TableRow = {
  id: string;
  name?: string | null;
  phone?: string | null;
  detail?: string | null;
  detailLabel: string;
  status?: string | null;
  createdAt?: string | null;
};

function LeadTable({
  title,
  href,
  rows,
}: {
  title: string;
  href: string;
  rows: TableRow[];
}) {
  const detailLabel = rows[0]?.detailLabel || "Details";

  return (
    <section className="dholera-dashboard-section">
      <div className="dholera-dashboard-section__header">
        <div>
          <p>LATEST ACTIVITY</p>
          <h2>{title}</h2>
        </div>
        <a href={href}>View All →</a>
      </div>
      <div className="dholera-table-wrapper">
        <table className="dholera-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>{detailLabel}</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name || "-"}</strong></td>
                  <td>{item.phone || "-"}</td>
                  <td>{item.detail || "-"}</td>
                  <td>
                    <span className={`dholera-status dholera-status--${item.status || "new"}`}>
                      {(item.status || "new").replaceAll("-", " ")}
                    </span>
                  </td>
                  <td>{formatDate(item.createdAt)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="dholera-empty-state">
                  No Estate 2 submissions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatBudget(value?: string | null) {
  const labels: Record<string, string> = {
    "below-20-lakhs": "Below ₹20 Lakhs",
    "20-50-lakhs": "₹20 - ₹50 Lakhs",
    "50-lakhs-1-crore": "₹50 Lakhs - ₹1 Crore",
    "above-1-crore": "Above ₹1 Crore",
  };
  return value ? labels[value] || value : "-";
}
