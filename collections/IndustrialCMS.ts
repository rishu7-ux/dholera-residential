import type { Access, CollectionConfig, Field } from "payload";

const authenticated: Access = ({ req }) => Boolean(req.user);
const privateAccess = { create: authenticated, read: authenticated, update: authenticated, delete: authenticated };
const status: Field = { name: "status", type: "select", defaultValue: "new", options: [
  { label: "New", value: "new" }, { label: "Contacted", value: "contacted" },
  { label: "Follow Up", value: "follow-up" }, { label: "Qualified", value: "qualified" }, { label: "Closed", value: "closed" },
] };

export const Users: CollectionConfig = {
  slug: "users", auth: true, admin: { useAsTitle: "email", group: "Users" }, fields: [],
};

export const IndustrialEnquiries: CollectionConfig = {
  slug: "industrial-enquiries",
  labels: { singular: "Industrial Enquiry", plural: "Industrial Enquiries" },
  admin: { useAsTitle: "name", group: "Industrial Leads", defaultColumns: ["name", "email", "phone", "property", "source", "status", "createdAt"] },
  access: privateAccess,
  fields: [
    { name: "name", type: "text", required: true }, { name: "email", type: "email", required: true },
    { name: "phone", type: "text", required: true }, { name: "property", type: "text", required: true, defaultValue: "Dholera Industrial Property" },
    { name: "message", type: "textarea" },
    { name: "source", type: "select", required: true, options: [
      { label: "Welcome Popup", value: "industrial-popup-form" }, { label: "Side Enquiry", value: "industrial-side-enquiry-form" },
      { label: "Property Card", value: "industrial-property-card" }, { label: "Website", value: "industrial-website" },
    ] }, status,
  ], timestamps: true,
};

export const IndustrialContactMessages: CollectionConfig = {
  slug: "industrial-contact-messages",
  labels: { singular: "Industrial Contact Message", plural: "Industrial Contact Messages" },
  admin: { useAsTitle: "name", group: "Industrial Leads", defaultColumns: ["name", "email", "phone", "propertyType", "budget", "status", "createdAt"] },
  access: privateAccess,
  fields: [
    { name: "name", type: "text", required: true }, { name: "email", type: "email", required: true }, { name: "phone", type: "text", required: true },
    { name: "propertyType", type: "select", required: true, options: [
      { label: "Industrial Plot", value: "industrial-plot" }, { label: "Logistics Plot", value: "logistics-plot" },
      { label: "Warehouse Land", value: "warehouse-land" }, { label: "Commercial Plot", value: "commercial-plot" },
    ] },
    { name: "budget", type: "select", required: true, options: [
      { label: "Below ₹25 Lakhs", value: "below-25-lakhs" }, { label: "₹25–₹50 Lakhs", value: "25-50-lakhs" },
      { label: "₹50 Lakhs–₹1 Crore", value: "50-lakhs-1-crore" }, { label: "Above ₹1 Crore", value: "above-1-crore" },
    ] },
    { name: "comments", type: "textarea" }, { name: "consent", type: "checkbox", required: true },
    { name: "source", type: "text", required: true, defaultValue: "industrial-contact-us-page" }, status,
  ], timestamps: true,
};

export const Media: CollectionConfig = {
  slug: "media", admin: { useAsTitle: "alt", group: "Industrial Content" },
  access: { read: () => true, create: authenticated, update: authenticated, delete: authenticated },
  upload: { staticDir: "media", mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  fields: [{ name: "alt", label: "Alt Text", type: "text", required: true }], timestamps: true,
};

export const IndustrialBlogs: CollectionConfig = {
  slug: "industrial-blogs",
  labels: { singular: "Industrial Blog", plural: "Industrial Blogs" },
  admin: { useAsTitle: "title", group: "Industrial Content", defaultColumns: ["title", "slug", "status", "publishedAt", "createdAt"] },
  access: { read: () => true, create: authenticated, update: authenticated, delete: authenticated },
  fields: [
    { name: "title", label: "Blog Title", type: "text", required: true },
    { name: "slug", label: "Slug", type: "text", required: true, unique: true, admin: {
      description: "URL friendly slug. Example: ridhi-966-1",
    }, hooks: { beforeValidate: [({ value, siblingData }) => {
      const source = value || siblingData?.title;
      return source ? String(source).toLowerCase().trim().replace(/\//g, "-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "") : value;
    }] } },
    { name: "excerpt", label: "Short Description", type: "textarea", required: true },
    { name: "content", label: "Blog Content", type: "textarea", required: true },
    { name: "featuredImage", label: "Featured Image", type: "upload", relationTo: "media", required: true },
    { name: "status", label: "Status", type: "select", required: true, defaultValue: "draft", options: [{ label: "Draft", value: "draft" }, { label: "Published", value: "published" }] },
    { name: "publishedAt", label: "Published Date", type: "date", admin: { date: { pickerAppearance: "dayAndTime" } } },
  ], timestamps: true,
};
