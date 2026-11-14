import { createHash } from "node:crypto";

import type { KnowledgeChunk, KnowledgeSource } from "./types";

const TARGET_CHARS = 2800;
const OVERLAP_CHARS = 320;

function splitLargeBlock(block: string) {
  if (block.length <= TARGET_CHARS) return [block];

  const sentences = block.split(/(?<=[.!?])\s+/);
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > TARGET_CHARS) {
      pieces.push(current);
      current = "";
    }

    if (sentence.length > TARGET_CHARS) {
      if (current) pieces.push(current);
      current = "";
      for (let index = 0; index < sentence.length; index += TARGET_CHARS) {
        pieces.push(sentence.slice(index, index + TARGET_CHARS));
      }
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }

  if (current) pieces.push(current);
  return pieces;
}

export function chunkKnowledgeSource(source: KnowledgeSource): KnowledgeChunk[] {
  const blocks = source.content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap(splitLargeBlock);

  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    if (current && current.length + block.length + 2 > TARGET_CHARS) {
      chunks.push(current);
      const overlap = current.slice(-OVERLAP_CHARS).replace(/^\S*\s/, "");
      current = overlap ? `${overlap}\n\n${block}` : block;
    } else {
      current = current ? `${current}\n\n${block}` : block;
    }
  }

  if (current) chunks.push(current);

  return chunks.map((text, chunkIndex) => ({
    ...source,
    chunkIndex,
    contentHash: createHash("sha256").update(text).digest("hex"),
    text,
  }));
}

export function chunkKnowledgeSources(sources: KnowledgeSource[]) {
  return sources.flatMap(chunkKnowledgeSource);
}
