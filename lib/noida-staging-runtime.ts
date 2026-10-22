const STAGING_PROJECT_ID = "prj_Xs3h7xDAvKP59ohOmeWd4Ht2wxlj";
const STAGING_HOST = "cluster0.zshxfui.mongodb.net";
const STAGING_DATABASE = "omana-phase5-crm-stage-20261017a";
const STAGING_USERNAME = "noida_stage_app";

const ALLOWED_OPTIONS = new Set(["authsource", "retrywrites", "w", "appname", "tls"]);

type StagingEnvironment = Record<string, string | undefined>;

export function resolveNoidaStagingMongoUri(env: StagingEnvironment): string | undefined {
  const mode = env.NOIDA_STAGING_MODE;
  const projectId = env.NOIDA_STAGING_PROJECT_ID;
  const deployedProjectId = env.VERCEL_PROJECT_ID;
  if (mode === undefined && projectId === undefined && deployedProjectId !== STAGING_PROJECT_ID) {
    return env.MONGODB_URI;
  }

  if (mode !== "1" || projectId !== STAGING_PROJECT_ID) {
    throw new Error("Noida staging project identity is missing or invalid");
  }
  if (deployedProjectId !== undefined && deployedProjectId !== STAGING_PROJECT_ID) {
    throw new Error("Noida staging is attached to the wrong Vercel project");
  }

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
  if (!seen.has("authsource") || process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error("Noida staging MongoDB target must preserve authenticated TLS");
  }

  return env.MONGODB_URI;
}
