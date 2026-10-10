import "server-only";

import { generateGroundedAnswer } from "./grounding";
import { retrieveKnowledge } from "./retrieval";
import { chatRequestSchema } from "./validation";
import type { z } from "zod";

export async function answerChatQuestion(input: z.infer<typeof chatRequestSchema>) {
  const chunks = await retrieveKnowledge(input.question, input.site);
  return generateGroundedAnswer(input.question, chunks);
}
