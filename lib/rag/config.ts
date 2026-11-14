import "server-only";

export class RagConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RagConfigurationError";
  }
}

export type RagEnvironment = {
  openAIApiKey: string;
  qdrantUrl: string;
  qdrantApiKey: string;
  indexSecret: string;
};

function required(name: "OPENAI_API_KEY" | "QDRANT_URL" | "QDRANT_API_KEY" | "RAG_INDEX_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new RagConfigurationError(`${name} is not configured`);
  return value;
}

export function getRagEnvironment(): RagEnvironment {
  const qdrantUrl = required("QDRANT_URL");

  try {
    const parsed = new URL(qdrantUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Unsupported protocol");
  } catch {
    throw new RagConfigurationError("QDRANT_URL must be a valid HTTP(S) URL");
  }

  return {
    openAIApiKey: required("OPENAI_API_KEY"),
    qdrantUrl,
    qdrantApiKey: required("QDRANT_API_KEY"),
    indexSecret: required("RAG_INDEX_SECRET"),
  };
}
