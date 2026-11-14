import { createHash, timingSafeEqual } from "node:crypto";

export const MASTER_CMS_PROJECT_ID = "prj_BaMZLgjsftAewYTezNLEV0zG5v7A";

export type MongoIdentityEnvironment = Record<string, string | undefined>;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, private, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function response(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,}$/;
const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]+$/;

function authorizationChecks(request: Request, configuredToken: string | undefined) {
  const configuredTokenFormat = TOKEN_PATTERN.test(configuredToken ?? "");
  const suppliedToken = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  const suppliedTokenFormat = TOKEN_PATTERN.test(suppliedToken ?? "");
  let tokenMatch = false;

  if (configuredTokenFormat && suppliedTokenFormat) {
    const suppliedDigest = createHash("sha256").update(suppliedToken!).digest();
    const expectedDigest = createHash("sha256").update(configuredToken!).digest();
    tokenMatch = timingSafeEqual(suppliedDigest, expectedDigest);
  }

  return { configuredTokenFormat, suppliedTokenFormat, tokenMatch };
}

function mongoUriChecks(value: string | undefined) {
  let uri: URL;
  try {
    uri = new URL(value ?? "");
  } catch {
    return { mongoScheme: false, mongoHostname: false, mongoDatabasePath: false, mongoPortAbsent: false };
  }

  let databasePath = false;
  try {
    databasePath = decodeURIComponent(uri.pathname.slice(1)).length > 0;
  } catch {
    // Invalid encoding is reported as a false boolean only.
  }

  return {
    mongoScheme: uri.protocol === "mongodb+srv:",
    mongoHostname: uri.hostname.length > 0,
    mongoDatabasePath: databasePath,
    mongoPortAbsent: uri.port.length === 0,
  };
}

export function createProductionMongoIdentityHandler(env: MongoIdentityEnvironment) {
  return async function POST(request: Request): Promise<Response> {
    const auth = authorizationChecks(request, env.MONGODB_IDENTITY_DIAGNOSTIC_TOKEN);
    if (!auth.tokenMatch) {
      console.info("mongodb-identity-auth-checks", auth);
      return response(404, { error: "Not found" });
    }

    const contentLength = request.headers.get("content-length");
    let zeroByteBody = false;
    try {
      zeroByteBody =
        (contentLength === null || contentLength === "0") &&
        (await request.text()).length === 0;
    } catch {
      // Body read failures are reported as a false boolean only.
    }

    const checks = {
      method: request.method === "POST",
      zeroByteBody,
      ...auth,
      vercel: env.VERCEL === "1",
      productionEnvironment: env.VERCEL_ENV === "production",
      projectId: env.VERCEL_PROJECT_ID === MASTER_CMS_PROJECT_ID,
      deploymentIdFormat: DEPLOYMENT_ID_PATTERN.test(env.VERCEL_DEPLOYMENT_ID ?? ""),
      deploymentIdMatchesExpected:
        DEPLOYMENT_ID_PATTERN.test(request.headers.get("x-expected-deployment-id") ?? "") &&
        env.VERCEL_DEPLOYMENT_ID === request.headers.get("x-expected-deployment-id"),
      ...mongoUriChecks(env.MONGODB_URI),
    };
    return response(200, { checks });
  };
}
