import "server-only";

import OpenAI from "openai";

import { getRagEnvironment } from "./config";

let client: OpenAI | undefined;

export function getOpenAIClient() {
  if (!client) {
    client = new OpenAI({ apiKey: getRagEnvironment().openAIApiKey });
  }
  return client;
}
