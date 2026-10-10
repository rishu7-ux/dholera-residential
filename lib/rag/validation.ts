import { z } from "zod";

import {
  CHAT_QUESTION_MAX_LENGTH,
  CHAT_QUESTION_MIN_LENGTH,
  SUPPORTED_SITES,
} from "./constants";

export const chatRequestSchema = z
  .object({
    site: z.enum(SUPPORTED_SITES),
    question: z
      .string()
      .trim()
      .min(CHAT_QUESTION_MIN_LENGTH)
      .max(CHAT_QUESTION_MAX_LENGTH),
  })
  .strict();
