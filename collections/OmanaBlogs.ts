import type { CollectionConfig } from "payload";
import { crmContentHidden, isSuperAdmin, superAdminOnly } from "../lib/crm/access";
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

async function revalidateOmanaBlogs(slug?: string, previousSlug?: string) {
  const frontendUrl = process.env.OMANA_FRONTEND_URL?.trim();
  const secret = process.env.OMANA_REVALIDATE_SECRET?.trim();
  if (!frontendUrl || !secret) return;

  try {
    const endpoint = new URL("/api/revalidate/omana-blogs", frontendUrl);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slug, previousSlug }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.error("Omana frontend cache revalidation failed", response.status);
    }
  } catch (error) {
    console.error(
      "Omana frontend cache revalidation failed",
      error instanceof Error ? error.name : "UnknownError",
    );
  }
}

export const OmanaBlogs: CollectionConfig = {
  slug: "omana-blogs",
  labels: { singular: "Omana Blog", plural: "Omana Blogs" },
  admin: {
    useAsTitle: "title",
    group: "Omana Projects",
    hidden: crmContentHidden,
    defaultColumns: ["title", "category", "slug", "status", "publishedAt", "createdAt"],
  },
  access: {
    read: ({ req }) => isSuperAdmin(req.user as { role?: string } | null)
      ? true
      : { status: { equals: "published" } },
    create: superAdminOnly,
    update: superAdminOnly,
    delete: superAdminOnly,
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc }) => {
        await revalidateOmanaBlogs(doc.slug, previousDoc?.slug);
        return doc;
      },
    ],
    afterDelete: [
      async ({ doc }) => {
        await revalidateOmanaBlogs(doc.slug);
        return doc;
      },
    ],
  },
  fields: [
    { name: "title", label: "Blog Title", type: "text", required: true },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: { description: "URL slug, for example: investing-in-dholera" },
      hooks: {
        beforeValidate: [
          ({ value, siblingData }) => {
            const source = value || siblingData?.title;
            if (!source) return value;
            return String(source)
              .toLowerCase()
              .trim()
              .replace(/\//g, "-")
              .replace(/\s+/g, "-")
              .replace(/[^a-z0-9-]/g, "")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, "");
          },
        ],
      },
    },
    { name: "category", type: "text", required: true, defaultValue: "Omana Insights" },
    { name: "excerpt", label: "Short Description", type: "textarea", required: true },
    { name: "content", label: "Plain Text Fallback", type: "textarea", required: true },
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
          HeadingFeature({ enabledHeadingSizes: ["h2", "h3"] }),
          BoldFeature(),
          ItalicFeature(),
          OrderedListFeature(),
          UnorderedListFeature(),
          LinkFeature({ enabledCollections: [] }),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
        ],
      }),
    },
    {
      name: "featuredImage",
      label: "Featured Image",
      type: "upload",
      relationTo: "media",
      required: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
    },
    {
      name: "publishedAt",
      label: "Published Date",
      type: "date",
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
  ],
  timestamps: true,
};
