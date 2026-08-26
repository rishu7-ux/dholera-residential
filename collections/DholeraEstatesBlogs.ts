import type { CollectionConfig } from "payload";

export const DholeraEstatesBlogs: CollectionConfig = {
  slug: "dholera-estates-blogs",
  labels: { singular: "Dholera Estates Blog", plural: "Dholera Estates Blogs" },
  admin: {
    useAsTitle: "title",
    group: "Dholera Estates Content",
    defaultColumns: ["title", "slug", "status", "publishedAt", "createdAt"],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "title", type: "text", required: true },
    {
      name: "slug", type: "text", required: true, unique: true,
      hooks: { beforeValidate: [({ value, siblingData }) => {
        const source = value || siblingData?.title;
        return source ? String(source).toLowerCase().trim().replace(/\//g, "-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "") : value;
      }] },
    },
    { name: "excerpt", type: "textarea", required: true },
    { name: "content", type: "textarea", required: true },
    { name: "featuredImage", type: "upload", relationTo: "media", required: true },
    { name: "status", type: "select", required: true, defaultValue: "draft", options: [{ label: "Draft", value: "draft" }, { label: "Published", value: "published" }] },
    { name: "publishedAt", type: "date", admin: { date: { pickerAppearance: "dayAndTime" } } },
  ],
  timestamps: true,
};
