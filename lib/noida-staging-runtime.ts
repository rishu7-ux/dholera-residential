import { totalmem } from "node:os";

const STAGING_PROJECT_ID = "prj_Xs3h7xDAvKP59ohOmeWd4Ht2wxlj";
const MASTER_PREVIEW_PROJECT_ID = "prj_BaMZLgjsftAewYTezNLEV0zG5v7A";
const STAGING_PROJECT_IDS = new Set([STAGING_PROJECT_ID, MASTER_PREVIEW_PROJECT_ID]);
const STAGING_HOST = "cluster0.zshxfui.mongodb.net";
const STAGING_DATABASE = "omana-phase5-crm-stage-20261017a";
const STAGING_USERNAME = "noida_stage_app";

const ALLOWED_OPTIONS = new Set(["authsource", "retrywrites", "w", "appname", "tls"]);

type StagingEnvironment = Record<string, string | undefined>;

export function prepareNoidaLocalStagingEnvironment(env: StagingEnvironment): StagingEnvironment {
  if (env.NOIDA_LOCAL_STAGING_MODE !== "1") {
    throw new Error("Noida local staging mode must be explicitly enabled");
  }
  if (env.NODE_OPTIONS !== undefined || env.__NEXT_DEV_SERVER !== undefined || env.NEXT_PRIVATE_WORKER !== undefined) {
    throw new Error("Noida local staging launcher refuses caller-supplied worker options");
  }
  if (env.NODE_ENV !== undefined && env.NODE_ENV !== "development") {
    throw new Error("Noida local staging cannot run outside development mode");
  }
  const localEnv = { ...env, NODE_ENV: "development", NOIDA_LOCAL_STAGING_BIND: "127.0.0.1" };
  resolveNoidaStagingMongoUri(localEnv);
  return localEnv;
}

export function resolveNoidaStagingMongoUri(env: StagingEnvironment): string | undefined {
  if (env.NOIDA_DISPOSABLE_LOCAL_MODE !== undefined || env.NOIDA_DISPOSABLE_LOCAL_BIND !== undefined) {
    throw new Error("Disposable local CRM mode is excluded from the Production release");
  }
  if (env.NOIDA_LOCAL_STAGING_MODE !== undefined) {
    if (env.NOIDA_LOCAL_STAGING_MODE !== "1") {
      throw new Error("Noida local staging mode must be 1");
    }
    if (env.NODE_ENV !== "development" || env.NOIDA_LOCAL_STAGING_BIND !== "127.0.0.1") {
      throw new Error("Noida local staging requires the loopback development launcher");
    }
    if (
      Object.keys(env).some((key) => key === "VERCEL" || key.startsWith("VERCEL_")) ||
      env.NOIDA_STAGING_MODE !== undefined ||
      env.NOIDA_STAGING_PROJECT_ID !== undefined ||
      env.MONGODB_TEST_URI !== undefined
    ) {
      throw new Error("Noida local staging cannot use deployment or existing TEST settings");
    }
    if (
      env.PAYLOAD_DROP_DATABASE !== undefined ||
      env.NOIDA_ASSIGNMENT_EMAIL_ENABLED === "1" ||
      (env.NOIDA_SMTP_DELIVERY_ENABLED !== undefined && env.NOIDA_SMTP_DELIVERY_ENABLED !== "0") ||
      env.BLOB_READ_WRITE_TOKEN !== undefined ||
      env.OPENAI_API_KEY !== undefined ||
      env.QDRANT_URL !== undefined ||
      env.QDRANT_API_KEY !== undefined ||
      env.RAG_INDEX_SECRET !== undefined ||
      (env.NODE_OPTIONS !== undefined && !hasVerifiedNextDevWorkerOptions(env)) ||
      env.NODE_PATH !== undefined ||
      Object.keys(env).some((key) => key.startsWith("SMTP_") || key.endsWith("_INGEST_SECRET"))
    ) {
      throw new Error("Noida local staging has an unsafe startup setting");
    }
    if (
      !env.PAYLOAD_SECRET ||
      env.PAYLOAD_SECRET.length < 32 ||
      /[<>]/.test(env.PAYLOAD_SECRET) ||
      /^(?:placeholder|change-?me|your[-_].*|password)$/i.test(env.PAYLOAD_SECRET)
    ) {
      throw new Error("Noida local staging requires a separate strong Payload secret");
    }

    validateStagingMongoUri(env);
    const uri = new URL(env.MONGODB_URI as string);
    if (uri.searchParams.get("tls") !== "true" || /[<>]/.test(decodeURIComponent(uri.password))) {
      throw new Error("Noida local staging requires explicit TLS and a real database password");
    }
    return env.MONGODB_URI;
  }

  const mode = env.NOIDA_STAGING_MODE;
  const projectId = env.NOIDA_STAGING_PROJECT_ID;
  const deployedProjectId = env.VERCEL_PROJECT_ID;
  const masterPreview = deployedProjectId === MASTER_PREVIEW_PROJECT_ID && env.VERCEL_ENV === "preview";
  if (mode === undefined && projectId === undefined && deployedProjectId !== STAGING_PROJECT_ID && !masterPreview) {
    return env.MONGODB_URI;
  }

  if (mode !== "1" || !projectId || !STAGING_PROJECT_IDS.has(projectId)) {
    throw new Error("Noida staging project identity is missing or invalid");
  }
  if (env.VERCEL !== "1" || env.VERCEL_ENV !== "preview" || deployedProjectId !== projectId) {
    throw new Error("Noida staging requires the approved Vercel Preview project identity");
  }
  if (env.NOIDA_SMTP_DELIVERY_ENABLED !== "0") {
    throw new Error("Noida staging requires outbound SMTP delivery disabled");
  }

  validateStagingMongoUri(env);
  return env.MONGODB_URI;
}

function hasVerifiedNextDevWorkerOptions(env: StagingEnvironment): boolean {
  // Next 16.4.1 next-dev.js adds these options when it forks its dev server.
  // The launcher rejects all incoming NODE_OPTIONS before Next starts.
  const heapMb = Math.floor(Math.floor(totalmem() / 1024 / 1024) * 0.5);
  return env.__NEXT_DEV_SERVER === "1" &&
    env.NEXT_PRIVATE_WORKER === "1" &&
    env.NODE_OPTIONS === `--max-old-space-size=${heapMb} --enable-source-maps`;
}

function validateStagingMongoUri(env: StagingEnvironment): void {
  let uri: URL;
  try {
    uri = new URL(env.MONGODB_URI ?? "");
  } catch {
    throw new Error("Noida staging MongoDB target is missing or invalid");
  }

  let username: string;
  let password: string;
  let database: string;
  try {
    username = decodeURIComponent(uri.username);
    password = decodeURIComponent(uri.password);
    database = decodeURIComponent(uri.pathname.slice(1));
  } catch {
    throw new Error("Noida staging MongoDB target has invalid encoding");
  }

  if (
    uri.protocol !== "mongodb+srv:" ||
    uri.hostname.toLowerCase() !== STAGING_HOST ||
    uri.port !== "" ||
    database !== STAGING_DATABASE ||
    username !== STAGING_USERNAME ||
    !password ||
    /^(?:placeholder|change-?me|your[-_].*|password)$/i.test(password) ||
    uri.hash !== ""
  ) {
    throw new Error("Noida staging MongoDB target does not match the approved TEST identity");
  }

  const seen = new Set<string>();
  for (const [key, value] of uri.searchParams) {
    const option = key.toLowerCase();
    if (!ALLOWED_OPTIONS.has(option) || seen.has(option)) {
      throw new Error("Noida staging MongoDB target contains an unsupported option");
    }
    seen.add(option);
    if (
      (option === "authsource" && value !== "admin") ||
      (option === "tls" && value !== "true") ||
      (option === "retrywrites" && value !== "true") ||
      (option === "w" && value !== "majority")
    ) {
      throw new Error("Noida staging MongoDB target contains an insecure option");
    }
  }
  if (!seen.has("authsource") || env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error("Noida staging MongoDB target must preserve authenticated TLS");
  }
}
