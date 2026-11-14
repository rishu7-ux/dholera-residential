import type { WidgetServerProps } from "payload";

/* =========================================================
   TYPES
========================================================= */

type Enquiry = {
  id: string;
  name?: string | null;
  phone?: string | null;
  property?: string | null;
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

/* =========================================================
   DASHBOARD
========================================================= */

export default async function DholeraDashboard({
  req,
}: WidgetServerProps) {
  const { payload } = req;

  /* =========================================================
     TODAY RANGE
  ========================================================= */

  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );

  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );

  /* =========================================================
     LOAD DATA DIRECTLY FROM PAYLOAD / MONGODB
  ========================================================= */

  const [
    totalLeadsResult,
    todayLeadsResult,
    newLeadsResult,
    contactMessagesResult,
    recentEnquiriesResult,
    recentContactsResult,
  ] = await Promise.all([
    /* TOTAL ENQUIRIES */

    payload.count({
      collection: "enquiries",
    }),

    /* TODAY ENQUIRIES */

    payload.count({
      collection: "enquiries",

      where: {
        createdAt: {
          greater_than_equal:
            startOfToday.toISOString(),

          less_than_equal:
            endOfToday.toISOString(),
        },
      },
    }),

    /* NEW ENQUIRIES */

    payload.count({
      collection: "enquiries",

      where: {
        status: {
          equals: "new",
        },
      },
    }),

    /* TOTAL CONTACT MESSAGES */

    payload.count({
      collection: "contact-messages",
    }),

    /* RECENT ENQUIRIES */

    payload.find({
      collection: "enquiries",
      limit: 5,
      sort: "-createdAt",
    }),

    /* RECENT CONTACT MESSAGES */

    payload.find({
      collection: "contact-messages",
      limit: 5,
      sort: "-createdAt",
    }),

  ]);

  /* =========================================================
     COUNTS
  ========================================================= */

  const totalLeads =
    totalLeadsResult.totalDocs || 0;

  const todayLeads =
    todayLeadsResult.totalDocs || 0;

  const newLeads =
    newLeadsResult.totalDocs || 0;

  const contactMessages =
    contactMessagesResult.totalDocs || 0;

  const totalActivity =
    totalLeads + contactMessages;

  /* =========================================================
     DOCUMENTS
  ========================================================= */

  const recentEnquiries =
    recentEnquiriesResult.docs as Enquiry[];

  const recentContacts =
    recentContactsResult.docs as ContactMessage[];

  /* =========================================================
     DATE FORMAT
  ========================================================= */

  const formatDate = (
    date?: string | null
  ) => {
    if (!date) {
      return "-";
    }

    return new Date(date).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="dholera-dashboard">
      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="dholera-dashboard__hero">
        <div className="dholera-dashboard__hero-content">
          <div>
            <p className="dholera-dashboard__eyebrow">
              DHOLERA ADMIN
            </p>

            <h1>
              Dashboard
            </h1>

            <span>
              Manage enquiries, contact messages
              and website content from one place.
            </span>
          </div>

          <div className="dholera-dashboard__hero-total">
            <span>
              Total Activity
            </span>

            <strong>
              {totalActivity}
            </strong>
          </div>
        </div>
      </section>

      {/* =====================================================
          STATS
      ===================================================== */}

      <section className="dholera-stats-grid">
        <StatCard
          title="Total Leads"
          value={totalLeads}
          subtitle="All property enquiries"
          href="/admin/collections/enquiries"
        />

        <StatCard
          title="Today's Leads"
          value={todayLeads}
          subtitle="Leads received today"
          href="/admin/collections/enquiries"
        />

        <StatCard
          title="New Leads"
          value={newLeads}
          subtitle="Waiting for follow-up"
          href="/admin/collections/enquiries"
        />

        <StatCard
          title="Contact Messages"
          value={contactMessages}
          subtitle="Contact form submissions"
          href="/admin/collections/contact-messages"
        />
      </section>

      {/* =====================================================
          RECENT ENQUIRIES
      ===================================================== */}

      <DashboardSection
        label="Latest Activity"
        title="Recent Enquiries"
        href="/admin/collections/enquiries"
      >
        <div className="dholera-table-wrapper">
          <table className="dholera-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Property</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {recentEnquiries.length > 0 ? (
                recentEnquiries.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.name || "-"}
                      </strong>
                    </td>

                    <td>
                      {item.phone || "-"}
                    </td>

                    <td>
                      {item.property || "-"}
                    </td>

                    <td>
                      <StatusBadge
                        status={item.status}
                      />
                    </td>

                    <td>
                      {formatDate(
                        item.createdAt
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="dholera-empty-state"
                  >
                    No enquiries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      {/* =====================================================
          RECENT CONTACT MESSAGES
      ===================================================== */}

      <DashboardSection
        label="Latest Activity"
        title="Recent Contact Messages"
        href="/admin/collections/contact-messages"
      >
        <div className="dholera-table-wrapper">
          <table className="dholera-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Budget</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {recentContacts.length > 0 ? (
                recentContacts.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.name || "-"}
                      </strong>
                    </td>

                    <td>
                      {item.phone || "-"}
                    </td>

                    <td>
                      {formatBudget(
                        item.budget
                      )}
                    </td>

                    <td>
                      <StatusBadge
                        status={item.status}
                      />
                    </td>

                    <td>
                      {formatDate(
                        item.createdAt
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="dholera-empty-state"
                  >
                    No contact messages found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DashboardSection>
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  title,
  value,
  subtitle,
  href,
}: {
  title: string;
  value: number;
  subtitle: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="dholera-stat-card"
    >
      <div className="dholera-stat-card__top">
        <span>
          {title}
        </span>

        <div className="dholera-stat-dot" />
      </div>

      <strong>
        {value}
      </strong>

      <div className="dholera-stat-card__footer">
        <p>
          {subtitle}
        </p>

        <span>
          View →
        </span>
      </div>
    </a>
  );
}

/* =========================================================
   DASHBOARD SECTION
========================================================= */

function DashboardSection({
  label,
  title,
  href,
  children,
}: {
  label: string;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dholera-dashboard-section">
      <div className="dholera-dashboard-section__header">
        <div>
          <p>
            {label}
          </p>

          <h2>
            {title}
          </h2>
        </div>

        <a href={href}>
          View All →
        </a>
      </div>

      {children}
    </section>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({
  status = "new",
}: {
  status?: string | null;
}) {
  const normalizedStatus =
    status || "new";

  return (
    <span
      className={`
        dholera-status
        dholera-status--${normalizedStatus}
      `}
    >
      {normalizedStatus.replaceAll(
        "-",
        " "
      )}
    </span>
  );
}

/* =========================================================
   BUDGET
========================================================= */

function formatBudget(
  value?: string | null
) {
  switch (value) {
    case "below-20-lakhs":
      return "Below ₹20 Lakhs";

    case "20-50-lakhs":
      return "₹20 - ₹50 Lakhs";

    case "50-lakhs-1-crore":
      return "₹50 Lakhs - ₹1 Crore";

    case "above-1-crore":
      return "Above ₹1 Crore";

    default:
      return value || "-";
  }
}
