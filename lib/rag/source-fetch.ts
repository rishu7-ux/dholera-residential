import { cleanHtmlContent } from "./clean";
import {
  categoryForOmanaPath,
  OMANA_PUBLIC_PATHS,
  OMANA_SITE_ORIGIN,
} from "./omana-routes";
import type { IndexLogEvent, KnowledgeSource, SourceFailure } from "./types";

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 2_000;
const SOURCE_BATCH_SIZE = 5;
const MINIMUM_CONTENT_CHARACTERS = 80;

type FetchLike = typeof fetch;

export type SourceFetchOptions = {
  fetchFn?: FetchLike;
  sleep?: (milliseconds: number) => Promise<void>;
  attempts?: number;
  timeoutMs?: number;
  baseBackoffMs?: number;
  log?: (event: IndexLogEvent) => void;
  indexRunId?: string;
};

export type RequiredSourceFetchResult = {
  sources: KnowledgeSource[];
  failures: SourceFailure[];
  warnings: string[];
};

class SourceResponseError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SourceResponseError";
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function safeReason(error: unknown) {
  if (error instanceof SourceResponseError) return error.message;
  if (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) {
    return "request timed out";
  }
  if (error instanceof TypeError) return "network request failed";
  return "source request failed";
}

function isRetryable(error: unknown) {
  if (error instanceof SourceResponseError) return error.retryable;
  return (
    error instanceof TypeError ||
    (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name))
  );
}

function validateFetchConfiguration(options: SourceFetchOptions) {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseBackoffMs = options.baseBackoffMs ?? DEFAULT_BACKOFF_MS;
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) {
    throw new Error("Source fetch attempts must be between 1 and 5");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Error("Source fetch timeout must be between 1 and 60000 milliseconds");
  }
  if (!Number.isFinite(baseBackoffMs) || baseBackoffMs < 0 || baseBackoffMs > 5_000) {
    throw new Error("Source retry backoff must be between 0 and 5000 milliseconds");
  }
  return { attempts, timeoutMs, baseBackoffMs };
}

async function fetchRequiredSource(
  path: string,
  options: SourceFetchOptions,
): Promise<{ source: KnowledgeSource; attempts: number }> {
  const fetchFn = options.fetchFn ?? fetch;
  const sleep = options.sleep ?? wait;
  const configuration = validateFetchConfiguration(options);
  const expectedUrl = new URL(path, OMANA_SITE_ORIGIN);

  for (let attempt = 1; attempt <= configuration.attempts; attempt += 1) {
    try {
      const response = await fetchFn(expectedUrl, {
        cache: "no-store",
        redirect: "follow",
        headers: {
          accept: "text/html",
          "user-agent": "OmanaKnowledgeIndexer/1.1",
        },
        signal: AbortSignal.timeout(configuration.timeoutMs),
      });

      if (!response.ok) {
        const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
        throw new SourceResponseError(`HTTP ${response.status}`, retryable);
      }

      const finalUrl = new URL(response.url);
      if (finalUrl.origin !== expectedUrl.origin) {
        throw new SourceResponseError("cross-origin redirect rejected", false);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLocaleLowerCase().includes("text/html")) {
        throw new SourceResponseError("non-HTML response rejected", false);
      }

      const cleaned = cleanHtmlContent(await response.text());
      if (cleaned.content.length < MINIMUM_CONTENT_CHARACTERS) {
        throw new SourceResponseError("empty or insufficient cleaned content", false);
      }

      return {
        attempts: attempt,
        source: {
          site: "omana",
          sourceUrl: expectedUrl.toString(),
          title: cleaned.title || `Omana Projects ${path}`,
          category: categoryForOmanaPath(path),
          content: cleaned.content,
        },
      };
    } catch (error) {
      const retry = attempt < configuration.attempts && isRetryable(error);
      options.log?.({
        event: retry ? "source_retry_scheduled" : "source_fetch_failed",
        stage: "sources",
        indexRunId: options.indexRunId,
        sourceUrl: expectedUrl.toString(),
        attempt,
        retry,
        reason: safeReason(error),
      });
      if (!retry) throw Object.assign(new Error(safeReason(error)), { attempts: attempt });

      const backoffMs = Math.min(
        configuration.baseBackoffMs * 2 ** (attempt - 1),
        MAX_BACKOFF_MS,
      );
      await sleep(backoffMs);
    }
  }

  throw Object.assign(new Error("source request failed"), { attempts: configuration.attempts });
}

export async function fetchRequiredOmanaSources(
  options: SourceFetchOptions = {},
): Promise<RequiredSourceFetchResult> {
  const sources: KnowledgeSource[] = [];
  const failures: SourceFailure[] = [];
  const paths = [...OMANA_PUBLIC_PATHS];

  for (let offset = 0; offset < paths.length; offset += SOURCE_BATCH_SIZE) {
    const batch = paths.slice(offset, offset + SOURCE_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((path) => fetchRequiredSource(path, options)),
    );

    results.forEach((result, index) => {
      const path = batch[index];
      if (result.status === "fulfilled") {
        sources.push(result.value.source);
        if (result.value.attempts > 1) {
          options.log?.({
            event: "source_fetch_recovered",
            stage: "sources",
            indexRunId: options.indexRunId,
            sourceUrl: result.value.source.sourceUrl,
            attempts: result.value.attempts,
          });
        }
      } else {
        const error = result.reason as Error & { attempts?: number };
        failures.push({
          path,
          sourceUrl: new URL(path, OMANA_SITE_ORIGIN).toString(),
          attempts: error.attempts ?? (options.attempts ?? DEFAULT_ATTEMPTS),
          reason: error.message || "source request failed",
        });
      }
    });
  }

  return {
    sources,
    failures,
    warnings: failures.map((failure) => `${failure.path}: ${failure.reason}`),
  };
}

export const REQUIRED_OMANA_SOURCE_URLS = new Set(
  OMANA_PUBLIC_PATHS.map((path) => new URL(path, OMANA_SITE_ORIGIN).toString()),
);
