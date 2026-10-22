import type { CollectionConfig } from "payload";
import { crmContentHidden, superAdminOnly } from "../lib/crm/access";

export const AIKnowledge: CollectionConfig = {
  slug: "ai-knowledge",
  labels: {
    singular: "AI Knowledge",
    plural: "AI Knowledge",
  },
  admin: {
    useAsTitle: "title",
    group: "AI & Automation",
    hidden: crmContentHidden,
    defaultColumns: ["title", "site", "category", "published", "updatedAt"],
    description:
      "Curated, verified source material for the central RAG service. Draft entries are never indexed.",
  },
  access: {
    create: superAdminOnly,
    read: superAdminOnly,
    update: superAdminOnly,
    delete: superAdminOnly,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      maxLength: 240,
    },
    {
      name: "site",
      type: "select",
      required: true,
      index: true,
      options: [{ label: "Omana", value: "omana" }],
    },
    {
      name: "category",
      type: "text",
      required: true,
      defaultValue: "General",
      maxLength: 120,
    },
    {
      name: "question",
      type: "textarea",
      admin: {
        description: "Optional canonical question this content answers.",
      },
      maxLength: 1000,
    },
    {
      name: "content",
      type: "textarea",
      required: true,
      maxLength: 50000,
    },
    {
      name: "published",
      type: "checkbox",
      required: true,
      defaultValue: false,
      index: true,
    },
    {
      name: "sourceUrl",
      label: "Source URL",
      type: "text",
      maxLength: 2000,
      admin: {
        description: "Optional authoritative public URL supporting this entry.",
      },
    },
  ],
  timestamps: true,
};
