import { getRagEnvironment } from "@/lib/rag/config";
import { QDRANT_COLLECTION_NAME } from "@/lib/rag/constants";
import { isIndexingAuthorized } from "@/lib/rag/index-auth";
import { getQdrantClient } from "@/lib/rag/qdrant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function methodNotAllowed() {
  return new Response(null, {
    status: 405,
    headers: { ...NO_STORE_HEADERS, Allow: "GET" },
  });
}

function unavailable(status: 502 | 503 = 502) {
  return Response.json({ error: "Unavailable" }, { status, headers: NO_STORE_HEADERS });
}

export function HEAD() {
  return methodNotAllowed();
}

export function OPTIONS() {
  return methodNotAllowed();
}

export async function GET(request: Request) {
  let environment;

  try {
    environment = getRagEnvironment();
  } catch {
    return unavailable(503);
  }

  if (!isIndexingAuthorized(request, environment.indexSecret)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const collections = await getQdrantClient().getCollections();
    const exists = collections.collections.some(
      (collection) => collection.name === QDRANT_COLLECTION_NAME,
    );

    return Response.json({ exists }, { headers: NO_STORE_HEADERS });
  } catch {
    return unavailable();
  }
}
