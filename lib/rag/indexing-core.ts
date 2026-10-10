import { createHash } from "node:crypto";

import { chunkKnowledgeSources } from "./chunk";
import {
  EMBEDDING_DIMENSIONS,
  QDRANT_COLLECTION_NAME,
  type SupportedSite,
} from "./constants";
import { REQUIRED_OMANA_SOURCE_URLS } from "./source-fetch";
import type {
  EmbeddingResult,
  IndexLogEvent,
  KnowledgeChunk,
  KnowledgePayload,
  KnowledgeSource,
  ReindexSummary,
  SourceFailure,
} from "./types";

const MINIMUM_CONTENT_CHARACTERS = 80;

export class IndexPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndexPreparationError";
  }
}

export type LoadedIndexSources = {
  sources: KnowledgeSource[];
  failures: SourceFailure[];
  warnings: string[];
  requiredSources: number;
};

export type IndexPoint = {
  id: string;
  vector: number[];
  payload: KnowledgePayload;
};

export type PreparedOmanaIndex = {
  indexRunId: string;
  indexedAt: string;
  sources: KnowledgeSource[];
  chunks: KnowledgeChunk[];
  points: IndexPoint[];
  embeddingUsage: EmbeddingResult["usage"];
};

export type IndexPreparationDependencies = {
  loadSources: () => Promise<LoadedIndexSources>;
  embed: (input: string[]) => Promise<EmbeddingResult>;
  log?: (event: IndexLogEvent) => void;
};

export type IndexWriteDependencies = {
  initializeCollection: () => Promise<void>;
  upsert: (collection: string, points: IndexPoint[]) => Promise<void>;
  deleteStale: (site: SupportedSite, currentPointIds: string[]) => Promise<void>;
  log?: (event: IndexLogEvent) => void;
};

export function deterministicPointId(value: string) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const normalized = hex.join("");
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

function sourceUrlIsValid(sourceUrl: string) {
  return REQUIRED_OMANA_SOURCE_URLS.has(sourceUrl);
}

export function validateOmanaSources(loaded: LoadedIndexSources) {
  if (loaded.failures.length > 0 || loaded.warnings.length > 0) {
    throw new IndexPreparationError(
      `Required Omana source preflight failed (${loaded.failures.length} failures, ${loaded.warnings.length} warnings)`,
    );
  }
  if (loaded.requiredSources !== REQUIRED_OMANA_SOURCE_URLS.size) {
    throw new IndexPreparationError(
      `Expected ${REQUIRED_OMANA_SOURCE_URLS.size} required Omana sources; received ${loaded.requiredSources}`,
    );
  }
  if (loaded.sources.length !== REQUIRED_OMANA_SOURCE_URLS.size) {
    throw new IndexPreparationError(
      `Expected exactly ${REQUIRED_OMANA_SOURCE_URLS.size} approved Omana sources; received ${loaded.sources.length}`,
    );
  }

  const sourceUrls = new Set<string>();
  for (const source of loaded.sources) {
    if (
      source.site !== "omana" ||
      !sourceUrlIsValid(source.sourceUrl) ||
      typeof source.title !== "string" ||
      source.title.trim().length === 0 ||
      typeof source.category !== "string" ||
      source.category.trim().length === 0 ||
      typeof source.content !== "string" ||
      source.content.trim().length < MINIMUM_CONTENT_CHARACTERS
    ) {
      throw new IndexPreparationError(`Invalid Omana source metadata or content: ${source.sourceUrl}`);
    }
    if (sourceUrls.has(source.sourceUrl)) {
      throw new IndexPreparationError(`Duplicate Omana source URL: ${source.sourceUrl}`);
    }
    sourceUrls.add(source.sourceUrl);
  }

  const missing = [...REQUIRED_OMANA_SOURCE_URLS].filter((url) => !sourceUrls.has(url));
  if (missing.length > 0) {
    throw new IndexPreparationError(`Missing ${missing.length} required Omana source URL(s)`);
  }
}

export function validateOmanaChunks(chunks: KnowledgeChunk[], sources: KnowledgeSource[]) {
  if (chunks.length === 0) throw new IndexPreparationError("No Omana chunks were produced");

  const knownSources = new Set(sources.map((source) => source.sourceUrl));
  const chunkIndexes = new Map<string, number[]>();
  for (const chunk of chunks) {
    const expectedHash = createHash("sha256").update(chunk.text).digest("hex");
    if (
      chunk.site !== "omana" ||
      !knownSources.has(chunk.sourceUrl) ||
      !Number.isInteger(chunk.chunkIndex) ||
      chunk.chunkIndex < 0 ||
      chunk.text.trim().length === 0 ||
      chunk.contentHash !== expectedHash
    ) {
      throw new IndexPreparationError(`Invalid chunk metadata for source: ${chunk.sourceUrl}`);
    }
    const indexes = chunkIndexes.get(chunk.sourceUrl) ?? [];
    indexes.push(chunk.chunkIndex);
    chunkIndexes.set(chunk.sourceUrl, indexes);
  }

  for (const source of sources) {
    const indexes = (chunkIndexes.get(source.sourceUrl) ?? []).sort((left, right) => left - right);
    if (indexes.length === 0 || indexes.some((value, index) => value !== index)) {
      throw new IndexPreparationError(`Invalid chunk sequence for source: ${source.sourceUrl}`);
    }
  }
}

export function validateEmbeddings(result: EmbeddingResult, expectedCount: number) {
  if (result.embeddings.length !== expectedCount) {
    throw new IndexPreparationError("Embedding count mismatch");
  }
  if (
    result.embeddings.some(
      (embedding) =>
        embedding.length !== EMBEDDING_DIMENSIONS ||
        embedding.some((value) => !Number.isFinite(value)),
    )
  ) {
    throw new IndexPreparationError("Invalid embedding dimensions or values");
  }
  if (
    !Number.isInteger(result.usage.promptTokens) ||
    result.usage.promptTokens < 0 ||
    !Number.isInteger(result.usage.totalTokens) ||
    result.usage.totalTokens < result.usage.promptTokens
  ) {
    throw new IndexPreparationError("Invalid embedding usage metadata");
  }
}

export async function prepareOmanaIndex(
  dependencies: IndexPreparationDependencies,
  indexRunId: string,
  indexedAt: string,
): Promise<PreparedOmanaIndex> {
  dependencies.log?.({ event: "source_preflight_started", stage: "sources", indexRunId });
  const loaded = await dependencies.loadSources();
  validateOmanaSources(loaded);
  dependencies.log?.({
    event: "source_preflight_completed",
    stage: "sources",
    indexRunId,
    requiredSources: loaded.requiredSources,
    totalSources: loaded.sources.length,
    warnings: loaded.warnings.length,
  });

  const chunks = chunkKnowledgeSources(loaded.sources);
  validateOmanaChunks(chunks, loaded.sources);
  dependencies.log?.({
    event: "chunk_validation_completed",
    stage: "chunks",
    indexRunId,
    chunks: chunks.length,
  });

  dependencies.log?.({
    event: "embedding_started",
    stage: "embeddings",
    indexRunId,
    chunks: chunks.length,
  });
  const embeddingResult = await dependencies.embed(chunks.map((chunk) => chunk.text));
  validateEmbeddings(embeddingResult, chunks.length);

  const points = chunks.map((chunk, index) => {
    const id = deterministicPointId(
      `${chunk.site}|${chunk.sourceUrl}|${chunk.chunkIndex}|${chunk.contentHash}`,
    );
    const payload: KnowledgePayload = {
      site: chunk.site,
      sourceUrl: chunk.sourceUrl,
      title: chunk.title,
      category: chunk.category,
      content: chunk.text,
      chunkIndex: chunk.chunkIndex,
      contentHash: chunk.contentHash,
      indexedAt,
      indexRunId,
    };
    return { id, vector: embeddingResult.embeddings[index], payload };
  });

  dependencies.log?.({
    event: "embedding_completed",
    stage: "embeddings",
    indexRunId,
    embeddings: points.length,
    promptTokens: embeddingResult.usage.promptTokens,
    totalTokens: embeddingResult.usage.totalTokens,
  });

  return {
    indexRunId,
    indexedAt,
    sources: loaded.sources,
    chunks,
    points,
    embeddingUsage: embeddingResult.usage,
  };
}

export async function writePreparedOmanaIndex(
  prepared: PreparedOmanaIndex,
  dependencies: IndexWriteDependencies,
): Promise<ReindexSummary> {
  dependencies.log?.({
    event: "qdrant_write_started",
    stage: "qdrant",
    indexRunId: prepared.indexRunId,
    points: prepared.points.length,
  });
  await dependencies.initializeCollection();
  await dependencies.upsert(QDRANT_COLLECTION_NAME, prepared.points);
  await dependencies.deleteStale(
    "omana",
    prepared.points.map((point) => point.id),
  );

  const summary: ReindexSummary = {
    site: "omana",
    sources: prepared.sources.length,
    chunks: prepared.chunks.length,
    warnings: [],
    indexRunId: prepared.indexRunId,
    embeddingUsage: prepared.embeddingUsage,
  };
  dependencies.log?.({
    event: "indexing_completed",
    stage: "complete",
    indexRunId: prepared.indexRunId,
    sources: summary.sources,
    chunks: summary.chunks,
    promptTokens: summary.embeddingUsage.promptTokens,
    totalTokens: summary.embeddingUsage.totalTokens,
  });
  return summary;
}

export function createSingleFlight<T>() {
  let current: Promise<T> | undefined;
  return {
    run(task: () => Promise<T>, onJoin?: () => void) {
      if (current) {
        onJoin?.();
        return current;
      }
      current = task().finally(() => {
        current = undefined;
      });
      return current;
    },
  };
}
