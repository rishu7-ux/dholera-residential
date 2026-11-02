import { buildConfig } from "payload";
import type { CollectionConfig } from "payload";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import {
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  UnorderedListFeature,
  lexicalEditor,
} from "@payloadcms/richtext-lexical";
import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";

import {
  Estate2ContactMessages,
  Estate2Enquiries,
} from "./collections/Estate2Leads.ts";
import { Estate2Blogs } from "./collections/Estate2Blogs.ts";
import { DholeraEstatesBlogs } from "./collections/DholeraEstatesBlogs.ts";
import { DholeraEstatesContactMessages, DholeraEstatesEnquiries } from "./collections/DholeraEstatesLeads.ts";
import { IndustrialBlogs, IndustrialContactMessages, IndustrialEnquiries } from "./collections/IndustrialCMS.ts";
import { Estate1ContactMessages, Estate1Enquiries } from "./collections/Estate1Leads.ts";
import { Estate1Blogs } from "./collections/Estate1Blogs.ts";
import { OmanaBlogs } from "./collections/OmanaBlogs.ts";
import { AIKnowledge } from "./collections/AIKnowledge.ts";
import { CentralLeads, CrmActivities, CrmOffices, CrmTeams } from "./collections/Crm.ts";
import { crmContentHidden, isSuperAdmin, legacyLeadAdminAccess, superAdminField, superAdminOnly } from "./lib/crm/access";
import { createPasswordSetupEmail } from "./lib/crm/password-setup-email";
import { getConfiguredPayloadEmailAdapter } from "./lib/crm/smtp-email-adapter";
import { handleStaffInvitation } from "./lib/crm/staff-invitation";
import { resolveNoidaStagingMongoUri } from "./lib/noida-staging-runtime";
import {
  OmanaContactMessages,
  OmanaEnquiries,
  OmanaGoogleAdsEnquiries,
  OmanaSalespeople,
} from "./collections/OmanaLeads.ts";

/* =========================================================
   USERS COLLECTION
========================================================= */

export const Users: CollectionConfig = {
  slug: "users",

  auth: {
    forgotPassword: {
      // Staff activation uses Payload's native single-use reset flow. A short
      // expiry limits the exposure window for one-time setup links.
      expiration: 30 * 60 * 1000,
      generateEmailSubject: () => "Set or reset your Omana CMS password",
      generateEmailHTML: (emailArgs) => {
        const { req, token, user } = emailArgs ?? {};
        if (!req || !token || !user) throw new Error("Password setup email context is incomplete.");
        return createPasswordSetupEmail({
          adminURL: req.payload.getAdminURL(),
          resetPath: req.payload.config.admin.routes.reset,
          token,
          displayName: String(user.name || user.email || "team member"),
        }).html;
      },
    },
  },

  endpoints: [
    {
      path: "/:id/invite",
      method: "post",
      handler: handleStaffInvitation,
    },
  ],

  admin: {
    useAsTitle: "email",
    group: "Users",
    hidden: crmContentHidden,
  },

  access: {
    create: superAdminOnly,
    read: ({ req }) => {
      if (!req.user) return false;
      const user = req.user as typeof req.user & { role?: string; office?: string | number | { id?: string | number } };
      if (!user.role || user.role === "super-admin") return true;
      if (user.role === "team-leader" && user.office) {
        const office = typeof user.office === "object" ? user.office.id : user.office;
        return { office: { equals: office } } as import("payload").Where;
      }
      return { id: { equals: user.id } } as import("payload").Where;
    },
    update: ({ req }) => {
      const user = req.user as (typeof req.user & { role?: string }) | null;
      if (!user) return false;
      return isSuperAdmin(user) || ({ id: { equals: user.id } } as import("payload").Where);
    },
    delete: superAdminOnly,
  },

  fields: [
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "salesperson",
      saveToJWT: true,
      options: [
        { label: "Super Admin", value: "super-admin" },
        { label: "Team Leader", value: "team-leader" },
        { label: "Salesperson", value: "salesperson" },
      ],
      access: { update: superAdminField },
    },
    { name: "name", type: "text", required: true },
    { name: "office", type: "relationship", relationTo: "crm-offices", saveToJWT: true, index: true, access: { update: superAdminField } },
    { name: "active", type: "checkbox", required: true, defaultValue: true, index: true, access: { update: superAdminField } },
    { name: "eligibleForAssignment", type: "checkbox", required: true, defaultValue: true, index: true, access: { update: superAdminField } },
    { name: "rotationOrder", type: "number", min: 1, index: true, access: { update: superAdminField } },
    { name: "team", type: "relationship", relationTo: "crm-teams", saveToJWT: true, index: true, access: { update: superAdminField } },
  ],
};

/* =========================================================
   ENQUIRIES COLLECTION
========================================================= */

const Enquiries: CollectionConfig = {
  slug: "enquiries",

  admin: {
    useAsTitle: "name",
    group: "Leads",
    hidden: crmContentHidden,

    defaultColumns: [
      "name",
      "email",
      "phone",
      "property",
      "status",
      "createdAt",
    ],
  },

  access: {
    read: legacyLeadAdminAccess.read,
    create: () => true,
    update: legacyLeadAdminAccess.update,
    delete: legacyLeadAdminAccess.delete,
  },

  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },

    {
      name: "email",
      type: "email",
      required: true,
    },

    {
      name: "phone",
      type: "text",
      required: true,
    },

    {
      name: "property",
      type: "text",
      defaultValue: "Dholera Property",
    },

    {
      name: "message",
      type: "textarea",
    },

    {
      name: "source",
      type: "text",
      defaultValue: "website",
    },

    {
      name: "consent",
      label: "Contact Consent",
      type: "checkbox",
      defaultValue: false,
    },

    {
      name: "status",
      type: "select",
      defaultValue: "new",

      options: [
        {
          label: "New",
          value: "new",
        },
        {
          label: "Contacted",
          value: "contacted",
        },
        {
          label: "Follow Up",
          value: "follow-up",
        },
        {
          label: "Qualified",
          value: "qualified",
        },
        {
          label: "Closed",
          value: "closed",
        },
      ],
    },
  ],

  timestamps: true,
};

/* =========================================================
   CONTACT MESSAGES COLLECTION
========================================================= */

const ContactMessages: CollectionConfig = {
  slug: "contact-messages",

  labels: {
    singular: "Contact Message",
    plural: "Contact Messages",
  },

  admin: {
    useAsTitle: "name",
    group: "Leads",
    hidden: crmContentHidden,

    defaultColumns: [
      "name",
      "email",
      "phone",
      "propertyType",
      "budget",
      "status",
      "createdAt",
    ],
  },

  access: {
    create: () => true,
    read: legacyLeadAdminAccess.read,
    update: legacyLeadAdminAccess.update,
    delete: legacyLeadAdminAccess.delete,
  },

  fields: [
    {
      name: "name",
      label: "Full Name",
      type: "text",
      required: true,
    },

    {
      name: "email",
      label: "Email Address",
      type: "email",
      required: true,
    },

    {
      name: "phone",
      label: "Phone Number",
      type: "text",
      required: true,
    },

    {
      name: "propertyType",
      label: "Property Type",
      type: "select",
      required: true,

      options: [
        {
          label: "Residential Plot",
          value: "residential-plot",
        },
        {
          label: "SCO Plot",
          value: "sco-plot",
        },
        {
          label: "Industrial Plot",
          value: "industrial-plot",
        },
        {
          label: "Dholera Estates",
          value: "dholera-estates",
        },
      ],
    },

    {
      name: "budget",
      label: "Budget",
      type: "select",
      required: true,

      options: [
        {
          label: "Below ₹20 Lakhs",
          value: "below-20-lakhs",
        },
        {
          label: "₹20 - ₹50 Lakhs",
          value: "20-50-lakhs",
        },
        {
          label: "₹50 Lakhs - ₹1 Crore",
          value: "50-lakhs-1-crore",
        },
        {
          label: "Above ₹1 Crore",
          value: "above-1-crore",
        },
      ],
    },

    {
      name: "comments",
      label: "Message",
      type: "textarea",
    },

    {
      name: "consent",
      label: "Marketing Consent",
      type: "checkbox",
      defaultValue: false,
    },

    {
      name: "source",
      type: "text",
      defaultValue: "contact-us-page",
    },

    {
      name: "status",
      type: "select",
      defaultValue: "new",

      options: [
        {
          label: "New",
          value: "new",
        },
        {
          label: "Contacted",
          value: "contacted",
        },
        {
          label: "Follow Up",
          value: "follow-up",
        },
        {
          label: "Qualified",
          value: "qualified",
        },
        {
          label: "Closed",
          value: "closed",
        },
      ],
    },
  ],

  timestamps: true,
};

/* =========================================================
   MEDIA COLLECTION
========================================================= */

const Media: CollectionConfig = {
  slug: "media",

  admin: {
    useAsTitle: "alt",
    group: "Content",
    hidden: crmContentHidden,

    defaultColumns: [
      "alt",
      "filename",
      "mimeType",
      "createdAt",
    ],
  },

  access: {
    read: () => true,
    create: superAdminOnly,
    update: superAdminOnly,
    delete: superAdminOnly,
  },

  upload: {
    staticDir: "media",

    mimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ],
  },

  fields: [
    {
      name: "alt",
      label: "Alt Text",
      type: "text",
      required: true,
    },
  ],

  timestamps: true,
};

/* =========================================================
   BLOGS COLLECTION
========================================================= */

const Blogs: CollectionConfig = {
  slug: "blogs",

  admin: {
    useAsTitle: "title",
    group: "Content",
    hidden: crmContentHidden,

    defaultColumns: [
      "title",
      "slug",
      "status",
      "publishedAt",
      "createdAt",
    ],
  },

  access: {
    read: () => true,
    create: superAdminOnly,
    update: superAdminOnly,
    delete: superAdminOnly,
  },

  fields: [
    /* =====================================================
       BLOG TITLE
    ===================================================== */

    {
      name: "title",
      label: "Blog Title",
      type: "text",
      required: true,
    },

    /* =====================================================
       SLUG
       Ridhi 966/1
       becomes
       ridhi-966-1
    ===================================================== */

    {
      name: "slug",
      label: "Slug",
      type: "text",
      required: true,
      unique: true,

      admin: {
        description:
          "URL friendly slug. Example: ridhi-966-1",
      },

      hooks: {
        beforeValidate: [
          ({ value }) => {
            if (!value) {
              return value;
            }

            return String(value)
              .toLowerCase()
              .trim()

              /* Convert / into - */
              .replace(/\//g, "-")

              /* Convert spaces into - */
              .replace(/\s+/g, "-")

              /* Remove unwanted characters */
              .replace(/[^a-z0-9-]/g, "")

              /* Remove duplicate hyphens */
              .replace(/-+/g, "-")

              /* Remove starting / ending hyphens */
              .replace(/^-|-$/g, "");
          },
        ],
      },
    },

    /* =====================================================
       SHORT DESCRIPTION
    ===================================================== */

    {
      name: "excerpt",
      label: "Short Description",
      type: "textarea",
      required: true,
    },

    /* =====================================================
       BLOG CONTENT
    ===================================================== */

    {
      name: "content",
      label: "Blog Content",
      type: "textarea",
      required: true,
    },

    {
      name: "richContent",
      label: "Rich Blog Content",
      type: "richText",
      admin: {
        description:
          "Optional structured article content. Use H2 for major sections and H3 for subsections; the Blog Title is the page H1.",
      },
      editor: lexicalEditor({
        features: () => [
          ParagraphFeature(),
          HeadingFeature({
            enabledHeadingSizes: ["h2", "h3"],
          }),
          BoldFeature(),
          ItalicFeature(),
          OrderedListFeature(),
          UnorderedListFeature(),
          LinkFeature({
            enabledCollections: [],
          }),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
        ],
      }),
    },

    /* =====================================================
       FEATURED IMAGE
    ===================================================== */

    {
      name: "featuredImage",
      label: "Featured Image",
      type: "upload",
      relationTo: "media",
      required: true,
    },

    /* =====================================================
       STATUS
    ===================================================== */

    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      defaultValue: "draft",

      options: [
        {
          label: "Draft",
          value: "draft",
        },
        {
          label: "Published",
          value: "published",
        },
      ],
    },

    /* =====================================================
       PUBLISHED DATE
    ===================================================== */

    {
      name: "publishedAt",
      label: "Published Date",
      type: "date",

      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
      },
    },
  ],

  timestamps: true,
};

/* =========================================================
   PAYLOAD CONFIG
========================================================= */

export default buildConfig({
  email: getConfiguredPayloadEmailAdapter(process.env),
  secret: process.env.PAYLOAD_SECRET || "",
  telemetry: false,

  /* =====================================================
     MONGODB
  ===================================================== */

  db: mongooseAdapter({
    url: resolveNoidaStagingMongoUri(process.env) || "",
    ...(process.env.NOIDA_LOCAL_STAGING_MODE === "1"
      ? { connectOptions: { autoIndex: false }, ensureIndexes: false }
      : {}),
  }),

  /* =====================================================
     ADMIN
  ===================================================== */

  admin: {
    user: Users.slug,

    components: {
      beforeNavLinks: [
        "/components/admin/CrmNavLink.tsx#default",
        "/components/admin/ResidentialNavLink.tsx#default",
        "/components/admin/OmanaNavLink.tsx#default",
        "/components/admin/Estate2NavLink.tsx#default",
        "/components/admin/DholeraEstatesNavLink.tsx#default",
        "/components/admin/IndustrialNavLink.tsx#default",
      ],
      views: {
        crmDashboard: {
          Component: "/components/admin/CrmDashboard.tsx#default",
          path: "/crm-dashboard",
          exact: true,
          meta: { title: "Noida Sales CRM" },
        },
        residentialDashboard: {
          Component:
            "/components/admin/ResidentialDashboard.tsx#default",
          path: "/residential-dashboard",
          exact: true,
          meta: {
            title: "Dholera Residential Dashboard",
          },
        },
        omanaDashboard: {
          Component:
            "/components/admin/OmanaDashboard.tsx#default",
          path: "/omana-dashboard",
          exact: true,
          meta: {
            title: "Omana Projects Dashboard",
          },
        },
        estate2Dashboard: {
          Component:
            "/components/admin/Estate2Dashboard.tsx#default",
          path: "/estate-2-dashboard",
          exact: true,
          meta: {
            title: "Dholera Estate 2 Dashboard",
          },
        },
        dholeraEstatesDashboard: {
          Component:
            "/components/admin/DholeraEstatesDashboard.tsx#default",
          path: "/dholera-estates-dashboard",
          exact: true,
          meta: {
            title: "Dholera Estates Dashboard",
          },
        },
        industrialDashboard: {
          Component:
            "/components/admin/IndustrialDashboard.tsx#default",
          path: "/industrial-dashboard",
          exact: true,
          meta: {
            title: "Dholera Industrial Dashboard",
          },
        },
      },
    },

    /* =====================================================
       CUSTOM DHOLERA DASHBOARD
    ===================================================== */

    dashboard: {
      widgets: [
        {
          slug: "dholera-dashboard",

          Component:
            "/components/admin/DholeraDashboard.tsx#default",

          minWidth: "full",
          maxWidth: "full",
        },
      ],

      defaultLayout: () => [
        {
          widgetSlug: "dholera-dashboard",
          width: "full",
        },
      ],
    },
  },

  /* =====================================================
     COLLECTIONS
  ===================================================== */

  collections: [
    Users,
    CrmOffices,
    CrmTeams,
    CentralLeads,
    CrmActivities,
    Enquiries,
    ContactMessages,
    Estate1Enquiries,
    Estate1ContactMessages,
    Estate1Blogs,
    Estate2Enquiries,
    Estate2ContactMessages,
    Estate2Blogs,
    DholeraEstatesBlogs,
    DholeraEstatesEnquiries,
    DholeraEstatesContactMessages,
    IndustrialEnquiries,
    IndustrialContactMessages,
    IndustrialBlogs,
    OmanaEnquiries,
    OmanaContactMessages,
    OmanaGoogleAdsEnquiries,
    OmanaSalespeople,
    OmanaBlogs,
    AIKnowledge,
    Media,
    Blogs,
  ],

  plugins: [
    vercelBlobStorage({
      clientUploads: true,
      collections: {
        media: true,
      },
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }),
  ],
});
