import "server-only";

import { buildRetrievalQuery } from "./conversation";
import { generateGroundedAnswer } from "./grounding";
import { retrieveKnowledge } from "./retrieval";
import { chatRequestSchema } from "./validation";
import type { z } from "zod";

export async function answerChatQuestion(input: z.infer<typeof chatRequestSchema>) {
  const chunks = await retrieveKnowledge(
    buildRetrievalQuery(input.question, input.history),
    input.site,
  );
  return generateGroundedAnswer(input.question, chunks, input.history);
}
