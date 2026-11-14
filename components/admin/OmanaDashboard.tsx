import type { AdminViewServerProps } from "payload";

type LeadStatus = "new" | "contacted" | "follow-up" | "qualified" | "closed";

type Lead = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  selectedProject?: string | null;
  status?: LeadStatus | null;
  createdAt?: string | null;
};

type RecentSubmission = Lead & {
  collection: "omana-enquiries" | "omana-contact-messages" | "omana-google-ads-enquiries";
  type: string;
};

const leadCollections = [
  "omana-enquiries",
  "omana-contact-messages",
  "omana-google-ads-enquiries",
] as const;

const statuses: Array<{ label: string; value: LeadStatus }> = [
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Follow Up", value: "follow-up" },
  { label: "Qualified", value: "qualified" },
  { label: "Closed", value: "closed" },
];

export default async function OmanaDashboard({
  initPageResult,
}: AdminViewServerProps) {
  const { payload } = initPageResult.req;

  const [
    totalEnquiries,
    contactMessages,
    googleAdsLeads,
    totalBlogs,
    enquiryResults,
    contactResults,
    googleAdsResults,
    ...statusCounts
  ] = await Promise.all([
    payload.count({ collection: "omana-enquiries" }),
    payload.count({ collection: "omana-contact-messages" }),
    payload.count({ collection: "omana-google-ads-enquiries" }),
    payload.count({ collection: "omana-blogs" }),
    payload.find({ collection: "omana-enquiries", limit: 6, sort: "-createdAt" }),
    payload.find({ collection: "omana-contact-messages", limit: 6, sort: "-createdAt" }),
    payload.find({ collection: "omana-google-ads-enquiries", limit: 6, sort: "-createdAt" }),
    ...statuses.flatMap(({ value }) =>
      leadCollections.map((collection) =>
        payload.count({ collection, where: { status: { equals: value } } }),
      ),
    ),
  ]);

  const statusSummary = statuses.map(({ label, value }, statusIndex) => ({
    label,
    value,
    count: leadCollections.reduce(
      (total, _, collectionIndex) =>
        total + statusCounts[statusIndex * leadCollections.length + collectionIndex].totalDocs,
      0,
    ),
  }));
  const newLeads = statusSummary.find(({ value }) => value === "new")?.count || 0;

  const recentSubmissions: RecentSubmission[] = [
    ...(enquiryResults.docs as Lead[]).map((lead) => ({
      ...lead,
      collection: "omana-enquiries" as const,
      type: "Enquiry",
    })),
    ...(contactResults.docs as Lead[]).map((lead) => ({
      ...lead,
      collection: "omana-contact-messages" as const,
      type: "Contact Message",
    })),
    ...(googleAdsResults.docs as Lead[]).map((lead) => ({
      ...lead,
      collection: "omana-google-ads-enquiries" as const,
      type: "Google Ads Lead",
    })),
  ]
    .sort(
      (left, right) =>
        new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime(),
    )
    .slice(0, 10);

  const totalActivity =
    totalEnquiries.totalDocs +
    contactMessages.totalDocs +
    googleAdsLeads.totalDocs +
    totalBlogs.totalDocs;

  return (
    <div className="dholera-dashboard">
      <section className="dholera-dashboard__hero">
        <div className="dholera-dashboard__hero-content">
          <div>
            <p className="dholera-dashboard__eyebrow">OMANA PROJECTS</p>
            <h1>Omana Projects Dashboard</h1>
            <span>Manage Omana enquiries, contact messages, Google Ads leads and blogs.</span>
          </div>
          <div className="dholera-dashboard__hero-total">
            <span>Total Activity</span>
            <strong>{totalActivity}</strong>
          </div>
        </div>
      </section>

      <section className="dholera-stats-grid">
        <StatCard title="Total Omana Enquiries" value={totalEnquiries.totalDocs} href="/admin/collections/omana-enquiries" />
        <StatCard title="New Leads" value={newLeads} href="/admin/collections/omana-enquiries?where%5Bstatus%5D%5Bequals%5D=new" />
        <StatCard title="Contact Messages" value={contactMessages.totalDocs} href="/admin/collections/omana-contact-messages" />
        <StatCard title="Google Ads Leads" value={googleAdsLeads.totalDocs} href="/admin/collections/omana-google-ads-enquiries" />
        <StatCard title="Omana Blogs" value={totalBlogs.totalDocs} href="/admin/collections/omana-blogs" />
      </section>

      <StatusSummary items={statusSummary} />
      <RecentSubmissions rows={recentSubmissions} />
    </div>
  );
}

function StatCard({ title, value, href }: { title: string; value: number; href: string }) {
  return (
    <a href={href} className="dholera-stat-card">
      <div className="dholera-stat-card__top">
        <span>{title}</span>
        <div className="dholera-stat-dot" />
      </div>
      <strong>{value}</strong>
      <div className="dholera-stat-card__footer">
        <p>Omana Projects</p>
        <span>View →</span>
      </div>
    </a>
  );
}

function StatusSummary({ items }: { items: Array<{ label: string; value: LeadStatus; count: number }> }) {
  return (
    <section className="dholera-dashboard-section">
      <div className="dholera-dashboard-section__header">
        <div>
          <p>LEAD PIPELINE</p>
          <h2>Lead Status Summary</h2>
        </div>
      </div>
      <div className="dholera-stats-grid">
        {items.map((item) => (
          <div className="dholera-stat-card" key={item.value}>
            <div className="dholera-stat-card__top">
              <span>{item.label}</span>
              <div className="dholera-stat-dot" />
            </div>
            <strong>{item.count}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentSubmissions({ rows }: { rows: RecentSubmission[] }) {
  return (
    <section className="dholera-dashboard-section">
      <div className="dholera-dashboard-section__header">
        <div>
          <p>LATEST ACTIVITY</p>
          <h2>Recent Submissions</h2>
        </div>
      </div>
      <div className="dholera-table-wrapper">
        <table className="dholera-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Interested Project</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((item) => (
                <tr key={`${item.collection}-${item.id}`}>
                  <td>
                    <a href={`/admin/collections/${item.collection}/${item.id}`}>
                      <strong>{item.name || "-"}</strong>
                    </a>
                  </td>
                  <td>{item.type}</td>
                  <td>{item.email || "-"}</td>
                  <td>{item.phone || "-"}</td>
                  <td>{item.selectedProject || "-"}</td>
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
                <td colSpan={7} className="dholera-empty-state">
                  No Omana submissions found.
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
