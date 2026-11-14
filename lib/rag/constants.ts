export const SUPPORTED_SITES = ["omana"] as const;

export type SupportedSite = (typeof SUPPORTED_SITES)[number];

export const QDRANT_COLLECTION_NAME = "dholera-knowledge";
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
export const RESPONSE_MODEL = "gpt-4.1-mini";

export const CHAT_QUESTION_MIN_LENGTH = 2;
export const CHAT_QUESTION_MAX_LENGTH = 600;
export const CHAT_HISTORY_MAX_TURNS = 16;
export const CHAT_HISTORY_MAX_CHARACTERS = 8_000;
export const RETRIEVAL_LIMIT = 6;
export const RETRIEVAL_SCORE_THRESHOLD = 0.3;
export const MAX_CONTEXT_CHARACTERS = 14000;

export const UNVERIFIED_ANSWER =
  "I’m sorry, but I can’t currently verify that information from Omana Projects’ approved sources. I can help you connect with a human Omana representative for the latest confirmed details.";

export function isSupportedSite(value: unknown): value is SupportedSite {
  return typeof value === "string" && SUPPORTED_SITES.includes(value as SupportedSite);
}
