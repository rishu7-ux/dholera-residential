import type { CollectionConfig, Field } from "payload";
import { crmContentHidden, legacyLeadAdminAccess, superAdminOnly } from "../lib/crm/access";

const privateAccess = legacyLeadAdminAccess;

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
    hidden: crmContentHidden,
    defaultColumns: [
      "name",
      "email",
      "phone",
      "selectedProject",
      "requirement",
      "page",
      "source",
      "qualification",
      "assignedSalesperson",
      "status",
      "createdAt",
    ],
  },
  access: { create: privateAccess.create, read: superAdminOnly, update: superAdminOnly, delete: superAdminOnly },
  hooks: {
    beforeChange: [
      ({ context, data, operation, originalDoc }) => {
        const relationshipId = (value: unknown) => {
          if (value && typeof value === "object" && "id" in value) {
            return String((value as { id: string | number }).id);
          }
          return value == null ? "" : String(value);
        };

        if (
          operation === "update" &&
          context.automaticAssignment !== true &&
          data.assignedSalesperson !== undefined &&
          relationshipId(data.assignedSalesperson) !==
            relationshipId(originalDoc?.assignedSalesperson)
        ) {
          data = {
            ...data,
            assignmentMode: "manual",
            assignedAt: data.assignedSalesperson
              ? new Date().toISOString()
              : undefined,
            assignmentSequence: undefined,
          };
        }

        if (
          operation === "update" &&
          context.automaticQualification !== true &&
          data.qualification !== undefined &&
          data.qualification !== originalDoc?.qualification
        ) {
          return {
            ...data,
            qualificationMode: "manual",
            qualificationReasons: [
              { reason: "Qualification manually changed by CMS staff." },
            ],
            qualificationVersion: "manual",
            qualifiedAt: new Date().toISOString(),
          };
        }

        return data;
      },
    ],
  },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "email", type: "email" },
    { name: "phone", type: "text", required: true },
    { name: "selectedProject", label: "Selected Project", type: "text" },
    { name: "selectedProjectSlug", label: "Selected Project Slug", type: "text" },
    { name: "requirement", type: "textarea" },
    { name: "plotSize", label: "Preferred Plot Size", type: "text" },
    { name: "budget", type: "text" },
    { name: "purchaseTimeline", label: "Purchase Timeline", type: "text" },
    { name: "initialIntent", label: "Initial Chat Intent", type: "textarea" },
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
        { label: "AI Chatbot", value: "ai-chatbot" },
      ],
    },
    { name: "idempotencyKey", type: "text", index: true },
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
    {
      name: "qualification",
      type: "select",
      index: true,
      options: [
        { label: "HOT", value: "hot" },
        { label: "WARM", value: "warm" },
        { label: "COLD", value: "cold" },
        { label: "NEEDS-REVIEW", value: "needs-review" },
      ],
    },
    {
      name: "qualificationReasons",
      label: "Qualification Reasons",
      type: "array",
      admin: { readOnly: true },
      fields: [{ name: "reason", type: "text", required: true }],
    },
    {
      name: "qualificationVersion",
      type: "text",
      admin: { readOnly: true },
    },
    {
      name: "qualifiedAt",
      type: "date",
      admin: { readOnly: true },
    },
    {
      name: "qualificationMode",
      label: "Qualification Mode",
      type: "select",
      admin: { readOnly: true },
      options: [
        { label: "Automatic", value: "automatic" },
        { label: "Manual Override", value: "manual" },
      ],
    },
    {
      name: "assignedSalesperson",
      label: "Assigned Salesperson",
      type: "relationship",
      relationTo: "omana-salespeople",
      index: true,
    },
    {
      name: "assignedAt",
      label: "Assigned At",
      type: "date",
      admin: { readOnly: true },
    },
    {
      name: "assignmentSequence",
      label: "Assignment Sequence",
      type: "number",
      admin: { readOnly: true },
    },
    {
      name: "assignmentMode",
      label: "Assignment Mode",
      type: "select",
      admin: { readOnly: true },
      options: [
        { label: "Automatic Round Robin", value: "automatic" },
        { label: "Manual Override", value: "manual" },
      ],
    },
    statusField,
  ],
  timestamps: true,
};

export const OmanaSalespeople: CollectionConfig = {
  slug: "omana-salespeople",
  labels: { singular: "Salesperson", plural: "Salespeople" },
  admin: {
    useAsTitle: "name",
    group: "Omana Projects",
    hidden: crmContentHidden,
    defaultColumns: ["name", "email", "phone", "active", "rotationOrder", "updatedAt"],
    description:
      "Active salespeople receive new ASK OMANA chatbot leads in rotation order.",
  },
  access: privateAccess,
  fields: [
    { name: "name", type: "text", required: true },
    { name: "email", type: "email", required: true, unique: true, index: true },
    { name: "phone", type: "text" },
    {
      name: "active",
      type: "checkbox",
      required: true,
      defaultValue: true,
      index: true,
    },
    {
      name: "rotationOrder",
      label: "Rotation Order",
      type: "number",
      required: true,
      min: 1,
      index: true,
      admin: {
        description:
          "Lower numbers are considered first. Duplicate values are resolved deterministically.",
      },
    },
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
    hidden: crmContentHidden,
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
    hidden: crmContentHidden,
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
