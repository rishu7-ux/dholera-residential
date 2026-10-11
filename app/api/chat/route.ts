import { answerChatQuestion } from "@/lib/rag/chat";
import { RagConfigurationError } from "@/lib/rag/config";
import { consumeChatRateLimit } from "@/lib/rag/rate-limit";
import { chatRequestSchema } from "@/lib/rag/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const MAX_BODY_CHARACTERS = 12_288;

export async function POST(request: Request) {
  const rateLimit = consumeChatRateLimit(request);
  if (!rateLimit.allowed) {
    return Response.json(
      { success: false, message: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          ...NO_STORE_HEADERS,
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_CHARACTERS) {
    return Response.json(
      { success: false, message: "Chat request is too large" },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_CHARACTERS) {
    return Response.json(
      { success: false, message: "Chat request is too large" },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }

  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Validation below returns the same safe response for malformed JSON.
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, message: "Invalid chat request" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const result = await answerChatQuestion(parsed.data);
    return Response.json(
      { success: true, ...result },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    const isConfigurationError = error instanceof RagConfigurationError;
    console.error(
      "Central chat request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return Response.json(
      {
        success: false,
        message: isConfigurationError
          ? "Chat service is not configured"
          : "Chat service is temporarily unavailable",
      },
      { status: isConfigurationError ? 503 : 502, headers: NO_STORE_HEADERS },
    );
  }
}
