import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";

import { EMBEDDING_MODEL, QDRANT_COLLECTION_NAME } from "../lib/rag/constants.ts";
import { prepareOmanaIndex } from "../lib/rag/indexing-core.ts";
import { fetchRequiredOmanaSources } from "../lib/rag/source-fetch.ts";
import type { IndexLogEvent } from "../lib/rag/types.ts";

function required(name: "OPENAI_API_KEY" | "QDRANT_URL" | "QDRANT_API_KEY") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is unavailable`);
  return value;
}

const events: IndexLogEvent[] = [];
const log = (event: IndexLogEvent) => events.push(event);
const openai = new OpenAI({ apiKey: required("OPENAI_API_KEY") });
const qdrant = new QdrantClient({
  url: required("QDRANT_URL"),
  apiKey: required("QDRANT_API_KEY"),
  timeout: 30_000,
});

const loaded = await fetchRequiredOmanaSources({ log, indexRunId: "dry-run" });
const prepared = await prepareOmanaIndex(
  {
    loadSources: async () => ({ ...loaded, requiredSources: loaded.sources.length }),
    embed: async (input) => {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input,
        encoding_format: "float",
      });
      return {
        embeddings: [...response.data]
          .sort((left, right) => left.index - right.index)
          .map((item) => item.embedding),
        usage: {
          promptTokens: response.usage.prompt_tokens,
          totalTokens: response.usage.total_tokens,
        },
      };
    },
    log,
  },
  "dry-run",
  new Date().toISOString(),
);

const currentPoints: Array<{ id: string | number; payload?: Record<string, unknown> | null }> = [];
let offset: string | number | undefined;
do {
  const page = await qdrant.scroll(QDRANT_COLLECTION_NAME, {
    filter: { must: [{ key: "site", match: { value: "omana" } }] },
    limit: 256,
    offset,
    with_payload: true,
    with_vector: false,
  });
  currentPoints.push(...page.points);
  offset = page.next_page_offset as string | number | undefined;
} while (offset !== undefined && offset !== null);

const currentIds = new Set(currentPoints.map((point) => String(point.id)));
const preparedIds = new Set(prepared.points.map((point) => point.id));
const inserted = [...preparedIds].filter((id) => !currentIds.has(id)).length;
const updated = [...preparedIds].filter((id) => currentIds.has(id)).length;
const deleted = [...currentIds].filter((id) => !preparedIds.has(id)).length;
const recoveredSources = events.filter((event) => event.event === "source_fetch_recovered");

console.log(
  JSON.stringify(
    {
      mode: "dry-run",
      qdrantWrites: 0,
      successfullyFetchedSources: loaded.sources.length,
      failedSources: loaded.failures,
      warnings: loaded.warnings,
      recoveredAfterRetry: recoveredSources.map((event) => ({
        sourceUrl: event.sourceUrl,
        attempts: event.attempts,
      })),
      chunks: prepared.chunks.length,
      embeddings: {
        count: prepared.points.length,
        dimensions: prepared.points[0]?.vector.length ?? 0,
        valid: prepared.points.every(
          (point) => point.vector.length === 1536 && point.vector.every(Number.isFinite),
        ),
        promptTokens: prepared.embeddingUsage.promptTokens,
        totalTokens: prepared.embeddingUsage.totalTokens,
      },
      productionBaseline: {
        omanaVectors: currentPoints.length,
        sources: new Set(
          currentPoints
            .map((point) => point.payload?.sourceUrl)
            .filter((value): value is string => typeof value === "string"),
        ).size,
      },
      expectedVectorChanges: { inserted, updated, deleted, final: prepared.points.length },
    },
    null,
    2,
  ),
);
