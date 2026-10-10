import type { SupportedSite } from "./constants";

export type KnowledgeSource = {
  site: SupportedSite;
  sourceUrl: string;
  title: string;
  category: string;
  content: string;
};

export type KnowledgeChunk = KnowledgeSource & {
  chunkIndex: number;
  contentHash: string;
  text: string;
};

export type KnowledgePayload = {
  site: SupportedSite;
  sourceUrl: string;
  title: string;
  category: string;
  content: string;
  chunkIndex: number;
  contentHash: string;
  indexedAt: string;
  indexRunId: string;
};

export type RetrievedChunk = KnowledgePayload & {
  score: number;
};

export type ChatAnswer = {
  answer: string;
  sources: Array<{
    title: string;
    sourceUrl: string;
  }>;
  grounded: boolean;
};

export type ReindexSummary = {
  site: SupportedSite;
  sources: number;
  chunks: number;
  warnings: string[];
  indexRunId: string;
  embeddingUsage: {
    promptTokens: number;
    totalTokens: number;
  };
};

export type EmbeddingResult = {
  embeddings: number[][];
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
};

export type SourceFailure = {
  path: string;
  sourceUrl: string;
  attempts: number;
  reason: string;
};

export type IndexLogEvent = {
  event: string;
  stage: "lock" | "sources" | "chunks" | "embeddings" | "qdrant" | "complete";
  indexRunId?: string;
  [key: string]: unknown;
};
