import { createHash, timingSafeEqual } from "node:crypto";

export const MASTER_CMS_PROJECT_ID = "prj_BaMZLgjsftAewYTezNLEV0zG5v7A";
const MAX_TOKEN_LIFETIME_MS = 15 * 60 * 1000;

export type MongoIdentityEnvironment = Record<string, string | undefined>;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, private, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function response(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function authorized(request: Request, configuredToken: string | undefined): boolean {
  if (!configuredToken || !/^[A-Za-z0-9_-]{43,}$/.test(configuredToken)) return false;
  const match = /^Bearer ([A-Za-z0-9_-]{43,})$/.exec(request.headers.get("authorization") ?? "");
  if (!match) return false;
  const suppliedDigest = createHash("sha256").update(match[1]).digest();
  const expectedDigest = createHash("sha256").update(configuredToken).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}

function parseIdentity(env: MongoIdentityEnvironment): {
  deploymentId: string;
  hostname: string;
  database: string;
} | undefined {
  const deploymentId = env.VERCEL_DEPLOYMENT_ID;
  if (!deploymentId || !/^dpl_[A-Za-z0-9]+$/.test(deploymentId)) return undefined;

  let uri: URL;
  try {
    uri = new URL(env.MONGODB_URI ?? "");
  } catch {
    return undefined;
  }

  let database: string;
  try {
    // Match the MongoDB driver's default when no database path is supplied.
    // authSource selects the authentication database, not this namespace.
    database = decodeURIComponent(uri.pathname.slice(1)) || "test";
  } catch {
    return undefined;
  }

  if (uri.protocol !== "mongodb+srv:" || !uri.hostname || !database || uri.port) return undefined;

  return {
    deploymentId,
    hostname: uri.hostname.toLowerCase(),
    database,
  };
}

// Next.js Node POST requests carry a stream even when no bytes were sent.
// Read only until EOF or the first nonempty chunk, with a bounded deadline.
async function hasZeroByteBody(request: Request): Promise<boolean> {
  if (request.body === null) return true;
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try { reader = request.body.getReader(); } catch { return false; }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        for (let count = 0; count < 8; count++) {
          const { done, value } = await reader.read();
          if (done) return true;
          if (value.byteLength > 0) return false;
        }
        return false;
      })(),
      new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), 1000); }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

export function createProductionMongoIdentityHandler(env: MongoIdentityEnvironment, now: () => number = Date.now) {
  return async function POST(request: Request): Promise<Response> {
    const expiry = env.MONGODB_IDENTITY_DIAGNOSTIC_EXPIRES_AT;
    const expiresAt = expiry && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expiry)
      ? Date.parse(expiry)
      : NaN;
    const remainingMs = expiresAt - now();
    if (
      env.VERCEL !== "1" ||
      env.VERCEL_ENV !== "production" ||
      env.VERCEL_PROJECT_ID !== MASTER_CMS_PROJECT_ID ||
      !Number.isFinite(remainingMs) ||
      remainingMs <= 0 ||
      remainingMs > MAX_TOKEN_LIFETIME_MS ||
      request.method !== "POST" ||
      (request.headers.get("content-length") !== null && request.headers.get("content-length") !== "0") ||
      !authorized(request, env.MONGODB_IDENTITY_DIAGNOSTIC_TOKEN)
    ) {
      return response(404, { error: "Not found" });
    }

    if (!(await hasZeroByteBody(request)) || now() >= expiresAt) {
      return response(404, { error: "Not found" });
    }

    const identity = parseIdentity(env);
    if (!identity) return response(404, { error: "Not found" });
    return response(200, identity);
  };
}
