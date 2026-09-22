import type { Access, CollectionConfig, Field } from "payload";

const authenticated: Access = ({ req }) => Boolean(req.user);
const leadAccess = { create: authenticated, read: authenticated, update: authenticated, delete: authenticated };

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

export const Estate1Enquiries: CollectionConfig = {
  slug: "estate1-enquiries",
  labels: { singular: "Estate 1 Enquiry", plural: "Estate 1 Enquiries" },
  admin: {
    useAsTitle: "name",
    group: "Dholera Estate 1 Leads",
    defaultColumns: ["name", "email", "phone", "source", "status", "createdAt"],
  },
  access: leadAccess,
  fields: [
    { name: "name", type: "text", required: true },
    { name: "email", type: "email", required: true },
    { name: "phone", type: "text", required: true },
    { name: "message", type: "textarea" },
    {
      name: "source",
      type: "select",
      required: true,
      options: [
        { label: "Popup Form", value: "estate1-popup-form" },
        { label: "Side Enquiry Form", value: "estate1-side-enquiry-form" },
      ],
    },
    statusField,
  ],
  timestamps: true,
};

export const Estate1ContactMessages: CollectionConfig = {
  slug: "estate1-contact-messages",
  labels: { singular: "Estate 1 Contact Message", plural: "Estate 1 Contact Messages" },
  admin: {
    useAsTitle: "name",
    group: "Dholera Estate 1 Leads",
    defaultColumns: ["name", "email", "phone", "budget", "status", "createdAt"],
  },
  access: leadAccess,
  fields: [
    { name: "name", type: "text", required: true },
    { name: "email", type: "email", required: true },
    { name: "phone", type: "text", required: true },
    {
      name: "budget",
      type: "select",
      required: true,
      options: [
        { label: "Below ₹20 Lakhs", value: "below-20-lakhs" },
        { label: "₹20 - ₹50 Lakhs", value: "20-50-lakhs" },
        { label: "₹50 Lakhs - ₹1 Crore", value: "50-lakhs-1-crore" },
        { label: "Above ₹1 Crore", value: "above-1-crore" },
      ],
    },
    { name: "comments", label: "Message", type: "textarea" },
    { name: "consent", label: "Marketing Consent", type: "checkbox", required: true },
    { name: "source", type: "text", required: true, defaultValue: "estate1-contact-us-page" },
    statusField,
  ],
  timestamps: true,
};
