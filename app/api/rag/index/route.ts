import { getPayload } from "payload";
import { z } from "zod";

import { getRagEnvironment, RagConfigurationError } from "@/lib/rag/config";
import { isIndexingAuthorized } from "@/lib/rag/index-auth";
import { IndexingBusyError } from "@/lib/rag/index-lock";
import { reindexOmana } from "@/lib/rag/indexing";
import config from "@/payload.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ site: z.literal("omana") }).strict();
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const MAX_BODY_CHARACTERS = 1_024;

export async function POST(request: Request) {
  let environment;
  try {
    environment = getRagEnvironment();
  } catch (error) {
    console.error(
      "RAG indexing configuration failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return Response.json(
      { success: false, message: "Indexing service is not configured" },
      { status: error instanceof RagConfigurationError ? 503 : 500, headers: NO_STORE_HEADERS },
    );
  }

  if (!isIndexingAuthorized(request, environment.indexSecret)) {
    return Response.json(
      { success: false, message: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_CHARACTERS) {
    return Response.json(
      { success: false, message: "Indexing request is too large" },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_CHARACTERS) {
    return Response.json(
      { success: false, message: "Indexing request is too large" },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }

  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Validation below returns the same safe response for malformed JSON.
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, message: "Invalid indexing request" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const payload = await getPayload({ config });
    const result = await reindexOmana(payload);
    return Response.json(
      { success: true, result },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error(
      "Omana knowledge indexing failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return Response.json(
      {
        success: false,
        message:
          error instanceof IndexingBusyError
            ? "An indexing run is already active"
            : "Indexing failed; existing knowledge was preserved",
      },
      { status: error instanceof IndexingBusyError ? 409 : 502, headers: NO_STORE_HEADERS },
    );
  }
}
