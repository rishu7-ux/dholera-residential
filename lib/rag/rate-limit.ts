type WindowEntry = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const windows = new Map<string, WindowEntry>();

function clientIdentifier(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function consumeChatRateLimit(request: Request, now = Date.now()) {
  const key = clientIdentifier(request);
  const existing = windows.get(key);

  if (!existing && windows.size >= 10_000) {
    const oldestKey = windows.keys().next().value as string | undefined;
    if (oldestKey) windows.delete(oldestKey);
  }

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
