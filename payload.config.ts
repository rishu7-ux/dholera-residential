import { buildConfig } from "payload";
import type { CollectionConfig } from "payload";
import { mongooseAdapter } from "@payloadcms/db-mongodb";

import {
  Estate2ContactMessages,
  Estate2Enquiries,
} from "./collections/Estate2Leads.ts";
import { Estate2Blogs } from "./collections/Estate2Blogs.ts";

/* =========================================================
   USERS COLLECTION
========================================================= */

const Users: CollectionConfig = {
  slug: "users",

  auth: true,

  admin: {
    useAsTitle: "email",
    group: "Users",
  },

  fields: [],
};

/* =========================================================
   ENQUIRIES COLLECTION
========================================================= */

const Enquiries: CollectionConfig = {
  slug: "enquiries",

  admin: {
    useAsTitle: "name",
    group: "Leads",

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
    read: ({ req }) => Boolean(req.user),
    create: () => true,
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
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
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
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

    defaultColumns: [
      "alt",
      "filename",
      "mimeType",
      "createdAt",
    ],
  },

  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
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
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
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
  secret: process.env.PAYLOAD_SECRET || "",

  /* =====================================================
     MONGODB
  ===================================================== */

  db: mongooseAdapter({
    url: process.env.MONGODB_URI || "",
  }),

  /* =====================================================
     ADMIN
  ===================================================== */

  admin: {
    user: Users.slug,

    components: {
      beforeNavLinks: [
        "/components/admin/Estate2NavLink.tsx#default",
      ],
      views: {
        estate2Dashboard: {
          Component:
            "/components/admin/Estate2Dashboard.tsx#default",
          path: "/estate-2-dashboard",
          exact: true,
          meta: {
            title: "Dholera Estate 2 Dashboard",
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
    Enquiries,
    ContactMessages,
    Estate2Enquiries,
    Estate2ContactMessages,
    Estate2Blogs,
    Media,
    Blogs,
  ],
});
