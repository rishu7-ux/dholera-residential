import "server-only";

import type { QdrantClient } from "@qdrant/js-client-rest";

import {
  QDRANT_COLLECTION_NAME,
  RETRIEVAL_LIMIT,
  RETRIEVAL_SCORE_THRESHOLD,
  type SupportedSite,
} from "./constants";
import { embedQuestion } from "./embeddings";
import { getQdrantClient, siteFilter } from "./qdrant";
import type { KnowledgePayload, RetrievedChunk } from "./types";

function isKnowledgePayload(value: unknown): value is KnowledgePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.site === "omana" &&
    typeof payload.sourceUrl === "string" &&
    typeof payload.title === "string" &&
    typeof payload.category === "string" &&
    typeof payload.content === "string" &&
    typeof payload.chunkIndex === "number" &&
    typeof payload.contentHash === "string" &&
    typeof payload.indexedAt === "string" &&
    typeof payload.indexRunId === "string"
  );
}

export async function retrieveKnowledge(
  question: string,
  site: SupportedSite,
  qdrant: QdrantClient = getQdrantClient(),
): Promise<RetrievedChunk[]> {
  let vector: number[];
  try {
    vector = await embedQuestion(question);
  } catch (error) {
    const classified = new Error("Chat embedding provider failed", { cause: error });
    classified.name = "RagEmbeddingError";
    throw classified;
  }
  const query = {
    query: vector,
    filter: siteFilter(site),
    limit: RETRIEVAL_LIMIT,
    score_threshold: RETRIEVAL_SCORE_THRESHOLD,
    with_payload: true as const,
    with_vector: false as const,
  };
  let result;
  try {
    result = await qdrant.query(QDRANT_COLLECTION_NAME, query);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    try {
      result = await qdrant.query(QDRANT_COLLECTION_NAME, query);
    } catch (retryError) {
      const classified = new Error("Chat vector search failed", { cause: retryError });
      classified.name = "RagVectorSearchError";
      throw classified;
    }
  }

  return result.points.flatMap((point) => {
    if (!isKnowledgePayload(point.payload) || point.payload.site !== site) return [];
    return [{ ...point.payload, score: point.score }];
  });
}
