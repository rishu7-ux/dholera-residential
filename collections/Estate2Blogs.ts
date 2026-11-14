import type { CollectionConfig } from "payload";
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

export const Estate2Blogs: CollectionConfig = {
  slug: "estate2-blogs",
  labels: {
    singular: "Estate 2 Blog",
    plural: "Estate 2 Blogs",
  },
  admin: {
    useAsTitle: "title",
    group: "Dholera Estate 2 Content",
    defaultColumns: ["title", "slug", "status", "publishedAt", "createdAt"],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
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
    {
      name: "excerpt",
      label: "Short Description",
      type: "textarea",
      required: true,
    },
    { name: "content", label: "Blog Content", type: "textarea", required: true },
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
