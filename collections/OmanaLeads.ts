import type { Access, CollectionConfig, Field } from "payload";

const authenticated: Access = ({ req }) => Boolean(req.user);
const privateAccess = {
  create: authenticated,
  read: authenticated,
  update: authenticated,
  delete: authenticated,
};

const statusField: Field = {
  name: "status",
  type: "select",
  defaultValue: "new",
  options: [
    { label: "New", value: "new" },
    { label: "Contacted", value: "contacted" },
    { label: "Follow Up", value: "follow-up" },
    { label: "Qualified", value: "qualified" },
    { label: "Closed", value: "closed" },
  ],
};

const optionalMessageField: Field = {
  name: "message",
  label: "Message",
  type: "textarea",
};

export const OmanaEnquiries: CollectionConfig = {
  slug: "omana-enquiries",
  labels: { singular: "Omana Enquiry", plural: "Omana Enquiries" },
  admin: {
    useAsTitle: "name",
    group: "Omana Projects",
    defaultColumns: [
      "name",
      "email",
      "phone",
      "selectedProject",
      "page",
      "source",
      "status",
      "createdAt",
    ],
  },
  access: privateAccess,
  fields: [
    { name: "name", type: "text", required: true },
    { name: "email", type: "email", required: true },
    { name: "phone", type: "text", required: true },
    { name: "selectedProject", label: "Selected Project", type: "text" },
    { name: "selectedProjectSlug", label: "Selected Project Slug", type: "text" },
    optionalMessageField,
    { name: "page", label: "Source Page", type: "text", required: true },
    {
      name: "source",
      type: "select",
      required: true,
      options: [
        { label: "Global Enquiry Drawer", value: "omana-global-drawer" },
        { label: "Project Page", value: "omana-project-page" },
        { label: "Omana Website", value: "omana-website" },
      ],
    },
    { name: "consent", label: "Contact Consent", type: "checkbox", required: true },
    statusField,
  ],
  timestamps: true,
};

export const OmanaContactMessages: CollectionConfig = {
  slug: "omana-contact-messages",
  labels: {
    singular: "Contact Message",
    plural: "Contact Messages",
  },
  admin: {
    useAsTitle: "name",
    group: "Omana Projects",
    defaultColumns: [
      "name",
      "email",
      "phone",
      "selectedProject",
      "status",
      "createdAt",
    ],
  },
  access: privateAccess,
  fields: [
    { name: "name", type: "text", required: true },
    { name: "email", type: "email", required: true },
    { name: "phone", type: "text", required: true },
    { name: "selectedProject", label: "Selected Project", type: "text" },
    { name: "selectedProjectSlug", label: "Selected Project Slug", type: "text" },
    optionalMessageField,
    { name: "page", label: "Source Page", type: "text", required: true, defaultValue: "/contact" },
    { name: "source", type: "text", required: true, defaultValue: "omana-contact-page" },
    { name: "consent", label: "Contact Consent", type: "checkbox", required: true },
    statusField,
  ],
  timestamps: true,
};

export const OmanaGoogleAdsEnquiries: CollectionConfig = {
  slug: "omana-google-ads-enquiries",
  labels: {
    singular: "Google Ads Enquiry",
    plural: "Google Ads Enquiries",
  },
  admin: {
    useAsTitle: "name",
    group: "Omana Projects",
    defaultColumns: [
      "name",
      "email",
      "phone",
      "selectedProject",
      "utmCampaign",
      "gclid",
      "status",
      "createdAt",
    ],
  },
  access: privateAccess,
  fields: [
    { name: "name", type: "text", required: true },
    { name: "email", type: "email" },
    { name: "phone", type: "text", required: true },
    { name: "selectedProject", label: "Selected Project", type: "text" },
    { name: "selectedProjectSlug", label: "Selected Project Slug", type: "text" },
    optionalMessageField,
    { name: "page", label: "Source Page", type: "text", required: true, defaultValue: "/dholeraplots" },
    { name: "source", type: "text", required: true, defaultValue: "google-ads-dholeraplots" },
    { name: "utmSource", label: "UTM Source", type: "text" },
    { name: "utmMedium", label: "UTM Medium", type: "text" },
    { name: "utmCampaign", label: "UTM Campaign", type: "text" },
    { name: "utmTerm", label: "UTM Term", type: "text" },
    { name: "utmContent", label: "UTM Content", type: "text" },
    { name: "gclid", label: "Google Click ID (GCLID)", type: "text" },
    { name: "gbraid", label: "GBRAID", type: "text" },
    { name: "wbraid", label: "WBRAID", type: "text" },
    { name: "referrer", type: "text" },
    { name: "consent", label: "Contact Consent", type: "checkbox", required: true },
    statusField,
  ],
  timestamps: true,
};
