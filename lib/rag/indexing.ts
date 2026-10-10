import "server-only";

import { randomUUID } from "node:crypto";

import type { QdrantClient } from "@qdrant/js-client-rest";
import type { Payload } from "payload";

import { embedTexts } from "./embeddings";
import { withOmanaIndexLock } from "./index-lock";
import {
  createSingleFlight,
  prepareOmanaIndex,
  writePreparedOmanaIndex,
} from "./indexing-core";
import {
  deleteStaleSiteVectors,
  getQdrantClient,
  initializeQdrantCollection,
} from "./qdrant";
import { loadOmanaKnowledgeSources } from "./sources";
import type { IndexLogEvent, ReindexSummary } from "./types";

const singleFlight = createSingleFlight<ReindexSummary>();

function logIndex(event: IndexLogEvent) {
  console.info(
    JSON.stringify({
      scope: "omana_rag_index",
      timestamp: new Date().toISOString(),
      ...event,
    }),
  );
}

async function performOmanaReindex(payload: Payload, qdrant: QdrantClient) {
  const indexRunId = randomUUID();
  const indexedAt = new Date().toISOString();
  let lockAcquired = false;

  logIndex({ event: "distributed_lock_requested", stage: "lock", indexRunId });
  try {
    return await withOmanaIndexLock(payload, async () => {
      lockAcquired = true;
      logIndex({ event: "distributed_lock_acquired", stage: "lock", indexRunId });
      try {
        const prepared = await prepareOmanaIndex(
          {
            loadSources: () =>
              loadOmanaKnowledgeSources(payload, {
                indexRunId,
                log: logIndex,
              }),
            embed: (input) => embedTexts(input),
            log: logIndex,
          },
          indexRunId,
          indexedAt,
        );

        return await writePreparedOmanaIndex(prepared, {
          initializeCollection: () => initializeQdrantCollection(qdrant),
          upsert: async (collection, points) => {
            await qdrant.upsert(collection, {
              points,
              wait: true,
              ordering: "strong",
            });
          },
          deleteStale: (site, currentPointIds) =>
            deleteStaleSiteVectors(qdrant, site, currentPointIds).then(() => undefined),
          log: logIndex,
        });
      } catch (error) {
        logIndex({
          event: "indexing_failed",
          stage: "complete",
          indexRunId,
          errorName: error instanceof Error ? error.name : "UnknownError",
          message: error instanceof Error ? error.message : "Unknown indexing failure",
        });
        throw error;
      }
    });
  } finally {
    if (lockAcquired) {
      logIndex({
        event: "distributed_lock_released",
        stage: "lock",
        indexRunId,
      });
    }
  }
}

export function reindexOmana(payload: Payload, qdrant: QdrantClient = getQdrantClient()) {
  return singleFlight.run(
    () => performOmanaReindex(payload, qdrant),
    () => logIndex({ event: "concurrent_request_joined", stage: "lock" }),
  );
}
