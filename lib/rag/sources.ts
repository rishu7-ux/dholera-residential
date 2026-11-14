import "server-only";

import type { Payload } from "payload";

import { cleanPlainText } from "./clean";
import { OMANA_SITE_ORIGIN } from "./omana-routes";
import {
  fetchRequiredOmanaSources,
  type SourceFetchOptions,
} from "./source-fetch";
import type { KnowledgeSource, SourceFailure } from "./types";

type AIKnowledgeDocument = {
  id: string | number;
  title: string;
  site: "omana";
  category: string;
  question?: string | null;
  content: string;
  sourceUrl?: string | null;
};

type OmanaBlogDocument = {
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
};

export type SourceLoadResult = {
  sources: KnowledgeSource[];
  failures: SourceFailure[];
  warnings: string[];
  requiredSources: number;
};

async function loadCuratedKnowledge(payload: Payload): Promise<KnowledgeSource[]> {
  const result = await payload.find({
    collection: "ai-knowledge",
    depth: 0,
    limit: 1000,
    pagination: false,
    overrideAccess: true,
    where: {
      and: [{ site: { equals: "omana" } }, { published: { equals: true } }],
    },
  });

  return (result.docs as AIKnowledgeDocument[]).map((document) => ({
    site: "omana",
    sourceUrl: document.sourceUrl?.trim() || `omana://ai-knowledge/${document.id}`,
    title: document.title,
    category: document.category,
    content: cleanPlainText(
      document.question
        ? `Question: ${document.question}\n\n${document.content}`
        : document.content,
    ),
  }));
}

async function loadPublishedOmanaBlogs(payload: Payload): Promise<KnowledgeSource[]> {
  const result = await payload.find({
    collection: "omana-blogs",
    depth: 0,
    limit: 1000,
    pagination: false,
    overrideAccess: true,
    where: { status: { equals: "published" } },
  });

  return (result.docs as OmanaBlogDocument[]).map((document) => ({
    site: "omana",
    sourceUrl: new URL(`/blog/${document.slug}`, OMANA_SITE_ORIGIN).toString(),
    title: document.title,
    category: document.category || "Blog",
    content: cleanPlainText(`${document.excerpt}\n\n${document.content}`),
  }));
}

export async function loadOmanaKnowledgeSources(
  payload: Payload,
  sourceFetchOptions: SourceFetchOptions = {},
): Promise<SourceLoadResult> {
  const [publicPages, curated, blogs] = await Promise.all([
    fetchRequiredOmanaSources(sourceFetchOptions),
    loadCuratedKnowledge(payload),
    loadPublishedOmanaBlogs(payload),
  ]);

  return {
    sources: [...publicPages.sources, ...curated, ...blogs],
    failures: publicPages.failures,
    warnings: publicPages.warnings,
    requiredSources: publicPages.sources.length,
  };
}
