import { buildNoidaStagingFixture } from "./crm/staging-fixture";

type Environment = Record<string, string | undefined>;

export const NOIDA_DISPOSABLE_LOCAL = Object.freeze({
  host: "127.0.0.1",
  port: 27189,
  replicaSet: "noida_crm_disposable",
  database: "noida-crm-disposable-20261027",
  username: "noida_local_app",
  bind: "127.0.0.1",
});

const URI_OPTIONS = new Set(["authSource", "directConnection", "replicaSet"]);

/** Validate a private, synthetic local credential before Payload can initialize. */
export function resolveNoidaDisposableLocalMongoUri(env: Environment): string {
  if (
    env.NOIDA_DISPOSABLE_LOCAL_MODE !== "1" ||
    env.NODE_ENV !== "development" ||
    env.NOIDA_DISPOSABLE_LOCAL_BIND !== NOIDA_DISPOSABLE_LOCAL.bind
  ) {
    throw new Error("Disposable CRM mode requires the explicit loopback development launcher");
  }

  const forbidden = Object.keys(env).some((key) =>
    key === "VERCEL" ||
    key.startsWith("VERCEL_") ||
    key.startsWith("SMTP_") ||
    key.startsWith("PAYLOAD_EMAIL_") ||
    key.startsWith("WHATSAPP_") ||
    key.startsWith("TWILIO_") ||
    key.startsWith("BLOB_") ||
    key.startsWith("OPENAI_") ||
    key.startsWith("QDRANT_") ||
    key.startsWith("RAG_") ||
    key.endsWith("_INGEST_SECRET") ||
    [
      "MONGODB_TEST_URI", "MONGODB_RESTORE_TEST_URI", "MONGODB_CRM_TEST_WRITER_URI",
      "NOIDA_LOCAL_STAGING_MODE", "NOIDA_STAGING_MODE", "NOIDA_STAGING_PROJECT_ID",
      "PAYLOAD_DROP_DATABASE", "NODE_OPTIONS", "NODE_PATH", "CRON_SECRET",
    ].includes(key)
  );
  if (forbidden || env.NODE_TLS_REJECT_UNAUTHORIZED === "0" || env.NOIDA_SMTP_DELIVERY_ENABLED !== "0") {
    throw new Error("Disposable CRM environment contains an external service or unsafe setting");
  }
  if (
    !env.PAYLOAD_SECRET || env.PAYLOAD_SECRET.length < 32 ||
    /[<>]/.test(env.PAYLOAD_SECRET) ||
    /^(?:placeholder|change-?me|your[-_].*|password)$/i.test(env.PAYLOAD_SECRET)
  ) {
    throw new Error("Disposable CRM requires a separate strong Payload secret");
  }

  let uri: URL;
  try {
    uri = new URL(env.MONGODB_URI ?? "");
  } catch {
    throw new Error("Disposable CRM MongoDB target is missing or invalid");
  }

  let username: string;
  let password: string;
  let database: string;
  try {
    username = decodeURIComponent(uri.username);
    password = decodeURIComponent(uri.password);
    database = decodeURIComponent(uri.pathname.slice(1));
  } catch {
    throw new Error("Disposable CRM MongoDB target has invalid encoding");
  }
  if (
    uri.protocol !== "mongodb:" ||
    uri.hostname !== NOIDA_DISPOSABLE_LOCAL.host ||
    uri.port !== String(NOIDA_DISPOSABLE_LOCAL.port) ||
    uri.host !== `${NOIDA_DISPOSABLE_LOCAL.host}:${NOIDA_DISPOSABLE_LOCAL.port}` ||
    uri.hash !== "" ||
    username !== NOIDA_DISPOSABLE_LOCAL.username ||
    password.length < 24 || /[<>]/.test(password) ||
    database !== NOIDA_DISPOSABLE_LOCAL.database
  ) {
    throw new Error("Disposable CRM MongoDB target must use the exact local identity");
  }

  const seen = new Set<string>();
  for (const [key, value] of uri.searchParams) {
    if (!URI_OPTIONS.has(key) || seen.has(key)) {
      throw new Error("Disposable CRM MongoDB target contains an unsupported option");
    }
    seen.add(key);
    if (
      (key === "authSource" && value !== NOIDA_DISPOSABLE_LOCAL.database) ||
      (key === "directConnection" && value !== "true") ||
      (key === "replicaSet" && value !== NOIDA_DISPOSABLE_LOCAL.replicaSet)
    ) {
      throw new Error("Disposable CRM MongoDB target has an unsafe option");
    }
  }
  if (seen.size !== URI_OPTIONS.size) {
    throw new Error("Disposable CRM MongoDB target is missing a required option");
  }
  return env.MONGODB_URI as string;
}

/** Offline fixture specification only; never reads an environment or opens a database. */
export function buildNoidaDisposableLocalPlan(runId: string) {
  const fixture = buildNoidaStagingFixture(runId);
  const lead11 = {
    ...fixture.leads[0]!,
    name: "Synthetic Noida Lead 11",
    email: `${runId}.lead11@example.invalid`,
    phone: "+919900000011",
    idempotencyKey: `${runId}-lead-11`,
    expectedAssignmentOrder: 1,
  };
  const leads = [...fixture.leads, lead11];
  return {
    mode: "OFFLINE_PLAN_ONLY" as const,
    target: NOIDA_DISPOSABLE_LOCAL,
    runId,
    fixture,
    leads,
    assignmentOrders: leads.map((lead) => lead.expectedAssignmentOrder),
    expected: { ...fixture.expected, centralLeads: 11, minimumActivities: 22 },
    duplicateReplay: fixture.duplicateReplay,
    databaseConnection: false,
    databaseWrites: false,
  };
}
