import "server-only";

import type OpenAI from "openai";

import { EMBEDDING_MODEL } from "./constants";
import { getOpenAIClient } from "./openai";
import type { EmbeddingResult } from "./types";

const EMBEDDING_BATCH_SIZE = 64;

export async function embedTexts(
  input: string[],
  openai: OpenAI = getOpenAIClient(),
): Promise<EmbeddingResult> {
  if (input.length === 0) {
    return { embeddings: [], usage: { promptTokens: 0, totalTokens: 0 } };
  }

  const embeddings: number[][] = [];
  let promptTokens = 0;
  let totalTokens = 0;

  for (let offset = 0; offset < input.length; offset += EMBEDDING_BATCH_SIZE) {
    const batch = input.slice(offset, offset + EMBEDDING_BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      encoding_format: "float",
    });

    const ordered = [...response.data].sort((left, right) => left.index - right.index);
    if (ordered.length !== batch.length) throw new Error("Embedding response was incomplete");
    embeddings.push(...ordered.map((item) => item.embedding));
    promptTokens += response.usage.prompt_tokens;
    totalTokens += response.usage.total_tokens;
  }

  return { embeddings, usage: { promptTokens, totalTokens } };
}

export async function embedQuestion(question: string, openai: OpenAI = getOpenAIClient()) {
  const { embeddings } = await embedTexts([question], openai);
  const [embedding] = embeddings;
  if (!embedding) throw new Error("Question embedding was not returned");
  return embedding;
}
