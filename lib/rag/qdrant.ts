import "server-only";

import { QdrantClient } from "@qdrant/js-client-rest";

import {
  EMBEDDING_DIMENSIONS,
  QDRANT_COLLECTION_NAME,
  type SupportedSite,
} from "./constants";
import { getRagEnvironment } from "./config";
import { staleSiteFilter } from "./filters";

export { siteFilter, staleSiteFilter } from "./filters";

let client: QdrantClient | undefined;

export function getQdrantClient() {
  if (!client) {
    const environment = getRagEnvironment();
    client = new QdrantClient({
      url: environment.qdrantUrl,
      apiKey: environment.qdrantApiKey,
      timeout: 30_000,
    });
  }
  return client;
}

export async function initializeQdrantCollection(qdrant: QdrantClient = getQdrantClient()) {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(
    (collection) => collection.name === QDRANT_COLLECTION_NAME,
  );

  if (!exists) {
    await qdrant.createCollection(QDRANT_COLLECTION_NAME, {
      vectors: {
        size: EMBEDDING_DIMENSIONS,
        distance: "Cosine",
      },
    });
  }

  const collection = await qdrant.getCollection(QDRANT_COLLECTION_NAME);
  const payloadSchema = collection.payload_schema ?? {};

  for (const field of ["site", "sourceUrl", "contentHash", "indexRunId"] as const) {
    if (!payloadSchema[field]) {
      await qdrant.createPayloadIndex(QDRANT_COLLECTION_NAME, {
        field_name: field,
        field_schema: "keyword",
        wait: true,
      });
    }
  }
}

export async function deleteStaleSiteVectors(
  qdrant: Pick<QdrantClient, "delete">,
  site: SupportedSite,
  currentPointIds: string[],
) {
  return qdrant.delete(QDRANT_COLLECTION_NAME, {
    filter: staleSiteFilter(site, currentPointIds),
    wait: true,
    ordering: "strong",
  });
}
