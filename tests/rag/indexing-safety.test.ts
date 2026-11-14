import assert from "node:assert/strict";
import test from "node:test";

import {
  createSingleFlight,
  prepareOmanaIndex,
  writePreparedOmanaIndex,
  type IndexWriteDependencies,
  type LoadedIndexSources,
} from "../../lib/rag/indexing-core.ts";
import {
  fetchRequiredOmanaSources,
  REQUIRED_OMANA_SOURCE_URLS,
} from "../../lib/rag/source-fetch.ts";
import type { EmbeddingResult, KnowledgeSource } from "../../lib/rag/types.ts";

const requiredUrls = [...REQUIRED_OMANA_SOURCE_URLS];

function htmlResponse(url: string, content = "Verified Omana project information. ".repeat(5)) {
  return {
    ok: true,
    status: 200,
    url,
    headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
    text: async () => `<html><body><main><h1>Omana Projects</h1><p>${content}</p></main></body></html>`,
  } as Response;
}

function source(url: string, content: string): KnowledgeSource {
  return {
    site: "omana",
    sourceUrl: url,
    title: "Verified Omana source",
    category: "Projects",
    content,
  };
}

function loadedSources(twoChunkSources = 17): LoadedIndexSources {
  return {
    sources: requiredUrls.map((url, index) =>
      source(url, index < twoChunkSources ? "A".repeat(3_000) : "Verified content. ".repeat(8)),
    ),
    failures: [],
    warnings: [],
    requiredSources: requiredUrls.length,
  };
}

function embeddings(count: number, promptTokens = 1_234): EmbeddingResult {
  return {
    embeddings: Array.from({ length: count }, () => Array(1536).fill(0.01)),
    usage: { promptTokens, totalTokens: promptTokens },
  };
}

function writeSpies() {
  const calls = { initialize: 0, upsert: 0, delete: 0, deletedSite: "", points: 0 };
  const dependencies: IndexWriteDependencies = {
    initializeCollection: async () => {
      calls.initialize += 1;
    },
    upsert: async (_collection, points) => {
      calls.upsert += 1;
      calls.points = points.length;
    },
    deleteStale: async (site) => {
      calls.delete += 1;
      calls.deletedSite = site;
    },
  };
  return { calls, dependencies };
}

test("all 30 required Omana sources fetch successfully", async () => {
  const result = await fetchRequiredOmanaSources({
    fetchFn: async (input) => htmlResponse(String(input)),
    sleep: async () => undefined,
  });

  assert.equal(result.sources.length, 30);
  assert.equal(result.failures.length, 0);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(new Set(result.sources.map((item) => item.sourceUrl)), REQUIRED_OMANA_SOURCE_URLS);
});

test("a transient timeout succeeds on the bounded retry", async () => {
  const retryUrl = requiredUrls[5];
  const attempts = new Map<string, number>();
  const delays: number[] = [];
  const result = await fetchRequiredOmanaSources({
    attempts: 3,
    baseBackoffMs: 10,
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
    fetchFn: async (input) => {
      const url = String(input);
      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      if (url === retryUrl && attempt === 1) throw new DOMException("timed out", "TimeoutError");
      return htmlResponse(url);
    },
  });

  assert.equal(result.sources.length, 30);
  assert.equal(result.failures.length, 0);
  assert.equal(attempts.get(retryUrl), 2);
  assert.deepEqual(delays, [10]);
});

test("a permanent source failure aborts before every Qdrant write", async () => {
  const failedUrl = requiredUrls[8];
  const fetched = await fetchRequiredOmanaSources({
    attempts: 3,
    baseBackoffMs: 0,
    sleep: async () => undefined,
    fetchFn: async (input) => {
      const url = String(input);
      if (url === failedUrl) {
        return {
          ok: false,
          status: 503,
          url,
          headers: new Headers({ "content-type": "text/html" }),
          text: async () => "",
        } as Response;
      }
      return htmlResponse(url);
    },
  });
  const { calls } = writeSpies();
  let embedCalls = 0;

  await assert.rejects(
    prepareOmanaIndex(
      {
        loadSources: async () => ({ ...fetched, requiredSources: fetched.sources.length }),
        embed: async () => {
          embedCalls += 1;
          return embeddings(0);
        },
      },
      "failed-run",
      "2026-10-10T00:00:00.000Z",
    ),
    /source preflight failed/i,
  );
  assert.equal(embedCalls, 0);
  assert.deepEqual(calls, { initialize: 0, upsert: 0, delete: 0, deletedSite: "", points: 0 });
});

test("invalid cleaned content aborts before embeddings or Qdrant writes", async () => {
  const loaded = loadedSources();
  loaded.sources[0] = source(requiredUrls[0], "too short");
  const { calls } = writeSpies();
  let embedCalls = 0;

  await assert.rejects(
    prepareOmanaIndex(
      {
        loadSources: async () => loaded,
        embed: async () => {
          embedCalls += 1;
          return embeddings(0);
        },
      },
      "invalid-content-run",
      "2026-10-10T00:00:00.000Z",
    ),
    /invalid Omana source metadata or content/i,
  );
  assert.equal(embedCalls, 0);
  assert.equal(calls.upsert + calls.delete + calls.initialize, 0);
});

test("embedding failure leaves Qdrant untouched", async () => {
  const { calls } = writeSpies();
  await assert.rejects(
    prepareOmanaIndex(
      {
        loadSources: async () => loadedSources(),
        embed: async () => {
          throw new Error("OpenAI unavailable");
        },
      },
      "embedding-failure-run",
      "2026-10-10T00:00:00.000Z",
    ),
    /OpenAI unavailable/,
  );
  assert.equal(calls.upsert + calls.delete + calls.initialize, 0);
});

test("concurrent requests share one indexing run", async () => {
  const singleFlight = createSingleFlight<number>();
  let starts = 0;
  let finish!: (value: number) => void;
  const pending = new Promise<number>((resolve) => {
    finish = resolve;
  });
  const first = singleFlight.run(async () => {
    starts += 1;
    return pending;
  });
  const second = singleFlight.run(async () => {
    starts += 1;
    return 2;
  });

  assert.strictEqual(first, second);
  assert.equal(starts, 1);
  finish(1);
  assert.equal(await second, 1);
});

test("successful indexing creates 47 valid vectors and deletes stale Omana vectors only", async () => {
  const events: string[] = [];
  const prepared = await prepareOmanaIndex(
    {
      loadSources: async () => loadedSources(17),
      embed: async (input) => embeddings(input.length, 21_290),
      log: (event) => events.push(event.event),
    },
    "successful-run",
    "2026-10-10T00:00:00.000Z",
  );
  const { calls, dependencies } = writeSpies();
  const result = await writePreparedOmanaIndex(prepared, dependencies);

  assert.equal(prepared.sources.length, 30);
  assert.equal(prepared.chunks.length, 47);
  assert.equal(prepared.points.length, 47);
  assert.ok(prepared.points.every((point) => point.vector.length === 1536));
  assert.deepEqual(result.embeddingUsage, { promptTokens: 21_290, totalTokens: 21_290 });
  assert.deepEqual(calls, {
    initialize: 1,
    upsert: 1,
    delete: 1,
    deletedSite: "omana",
    points: 47,
  });
  assert.ok(events.includes("source_preflight_completed"));
  assert.ok(events.includes("embedding_completed"));
});
