import { createHash, timingSafeEqual } from "node:crypto";

import { resolveNoidaStagingMongoUri } from "./noida-staging-runtime";

const MAX_ACCESS_WINDOW_MS = 15 * 60 * 1000;
const STAGING_PROJECT_ID = "prj_Xs3h7xDAvKP59ohOmeWd4Ht2wxlj";
const STAGING_HOST = "cluster0.zshxfui.mongodb.net";
const STAGING_DATABASE = "omana-phase5-crm-stage-20261017a";
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]{20,}$/;
const SHA256_HEX = /^[a-fA-F0-9]{64}$/;
const TOKEN = /^[A-Za-z0-9_-]{43,128}$/;

type Environment = Record<string, string | undefined>;

export type PreviewMongoDiagnosticTarget = {
  uri: string;
  hostname: string;
  database: string;
  deploymentId: string;
};

export function previewMongoDiagnosticBody(
  target: PreviewMongoDiagnosticTarget,
  result: { ping: "PASS"; connectedDatabase: string } | { ping: "FAIL"; connectedDatabase: null },
) {
  return {
    deploymentId: target.deploymentId,
    configuredMongoHostname: target.hostname,
    configuredDatabase: target.database,
    connectedDatabase: result.connectedDatabase,
    stagingMode: true,
    stagingProjectIdentity: true,
    smtpDisabled: true,
    ping: result.ping,
  };
}

export function authorizePreviewMongoDiagnostic(
  request: { url: string; authorization: string | null; hasBody: boolean },
  env: Environment,
  now = Date.now(),
): PreviewMongoDiagnosticTarget {
  const url = new URL(request.url);
  if (
    url.protocol !== "https:" || url.search !== "" || request.hasBody ||
    env.VERCEL !== "1" || env.VERCEL_ENV !== "preview" ||
    env.VERCEL_PROJECT_ID !== STAGING_PROJECT_ID ||
    env.NOIDA_STAGING_MODE !== "1" ||
    env.NOIDA_STAGING_PROJECT_ID !== STAGING_PROJECT_ID ||
    env.NOIDA_SMTP_DELIVERY_ENABLED !== "0"
  ) {
    throw new Error("Preview diagnostic request is not authorized");
  }

  const deploymentId = env.VERCEL_DEPLOYMENT_ID;
  const expiresAt = env.NOIDA_PREVIEW_DIAGNOSTIC_EXPIRES_AT;
  const expectedHash = env.NOIDA_PREVIEW_DIAGNOSTIC_TOKEN_SHA256;
  const suppliedToken = /^Bearer ([A-Za-z0-9_-]+)$/.exec(request.authorization ?? "")?.[1];
  const expiry = expiresAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(expiresAt)
    ? Date.parse(expiresAt)
    : NaN;

  if (
    !DEPLOYMENT_ID.test(deploymentId ?? "") ||
    !SHA256_HEX.test(expectedHash ?? "") ||
    !TOKEN.test(suppliedToken ?? "") ||
    !Number.isFinite(expiry) ||
    now >= expiry ||
    expiry - now > MAX_ACCESS_WINDOW_MS
  ) {
    throw new Error("Preview diagnostic request is not authorized");
  }

  const actualHash = createHash("sha256").update(suppliedToken!).digest();
  const approvedHash = Buffer.from(expectedHash!, "hex");
  if (!timingSafeEqual(actualHash, approvedHash)) {
    throw new Error("Preview diagnostic request is not authorized");
  }

  // This read-only check has no shared consumption state: a valid token can be
  // replayed until expiry. Keep Preview protection enabled and the token private.

  // This guard pins the Preview project, TEST host/database/user, TLS, and
  // NOIDA_SMTP_DELIVERY_ENABLED=0 before any MongoDB connection is opened.
  const uri = resolveNoidaStagingMongoUri(env);
  if (!uri) throw new Error("Preview diagnostic target is unavailable");
  const parsed = new URL(uri);
  const hostname = parsed.hostname.toLowerCase();
  const database = decodeURIComponent(parsed.pathname.slice(1));
  if (hostname !== STAGING_HOST || database !== STAGING_DATABASE) {
    throw new Error("Preview diagnostic target is unavailable");
  }

  return {
    uri,
    hostname,
    database,
    deploymentId: deploymentId!,
  };
}
