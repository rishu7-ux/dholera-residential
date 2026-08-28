import type { CollectionConfig } from "payload";

export const DholeraEstatesBlogs: CollectionConfig = {
  slug: "dholera-estates-blogs",
  labels: { singular: "Dholera Estates Blog", plural: "Dholera Estates Blogs" },
  admin: {
    useAsTitle: "blogTitle",
    group: "Dholera Estates Content",
    defaultColumns: ["blogTitle", "slug", "status", "publishedAt", "createdAt"],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "blogTitle", label: "Blog Title", type: "text", required: true },
    {
      name: "slug", label: "Slug", type: "text", required: true, unique: true,
      admin: { description: "URL friendly slug. Example: ridhi-966-1" },
      hooks: { beforeValidate: [({ value, siblingData }) => {
        const source = value || siblingData?.blogTitle;
        return source ? String(source).toLowerCase().trim().replace(/\//g, "-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "") : value;
      }] },
    },
    { name: "shortDescription", label: "Short Description", type: "textarea", required: true },
    { name: "blogContent", label: "Blog Content", type: "textarea", required: true },
    { name: "featuredImage", label: "Featured Image", type: "upload", relationTo: "media", required: true },
    { name: "status", label: "Status", type: "select", required: true, defaultValue: "draft", options: [{ label: "Draft", value: "draft" }, { label: "Published", value: "published" }] },
    { name: "publishedAt", type: "date", admin: { date: { pickerAppearance: "dayAndTime" } } },
  ],
  timestamps: true,
};
