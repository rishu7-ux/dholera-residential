import { z } from "zod";

import {
  CHAT_QUESTION_MAX_LENGTH,
  CHAT_QUESTION_MIN_LENGTH,
  CHAT_HISTORY_MAX_CHARACTERS,
  CHAT_HISTORY_MAX_TURNS,
  SUPPORTED_SITES,
} from "./constants";

export const chatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(CHAT_QUESTION_MAX_LENGTH),
}).strict();

export const chatRequestSchema = z
  .object({
    site: z.enum(SUPPORTED_SITES),
    question: z
      .string()
      .trim()
      .min(CHAT_QUESTION_MIN_LENGTH)
      .max(CHAT_QUESTION_MAX_LENGTH),
    history: z.array(chatTurnSchema).max(CHAT_HISTORY_MAX_TURNS).default([]),
  })
  .refine(
    ({ history }) =>
      history.reduce((total, turn) => total + turn.content.length, 0) <=
      CHAT_HISTORY_MAX_CHARACTERS,
    { message: "Conversation history is too large", path: ["history"] },
  )
  .strict();
