import mongoose from "mongoose";

const EXPECTED_TEST_HOSTNAME = "cluster0.zshxfui.mongodb.net";
const SOURCE_TEST_DATABASE = "omana-phase5-test-2";
const EXPECTED_RESTORE_DATABASE = "omana-phase5-restore-20261017a";
const FORBIDDEN_OPTIONS = new Set([
  "authmechanism",
  "authmechanismproperties",
  "directconnection",
  "loadbalanced",
  "proxyhost",
  "proxypassword",
  "proxyport",
  "proxyusername",
  "replicaset",
  "srvmaxhosts",
  "srvservicename",
]);

export function validateMongoRestoreTestTarget(value: string | undefined) {
  if (!value?.trim()) {
    throw new Error("MONGODB_RESTORE_TEST_URI is required for restore preflight");
  }

  let uri: URL;
  try {
    uri = new URL(value.trim());
  } catch {
    throw new Error("MONGODB_RESTORE_TEST_URI must be a valid MongoDB URI");
  }

  if (uri.protocol !== "mongodb+srv:") {
    throw new Error("MONGODB_RESTORE_TEST_URI must use the mongodb+srv scheme");
  }
  if (uri.hostname.toLowerCase() !== EXPECTED_TEST_HOSTNAME) {
    throw new Error("MONGODB_RESTORE_TEST_URI must target the approved TEST cluster");
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(uri.pathname.replace(/^\//, ""));
  } catch {
    throw new Error("MONGODB_RESTORE_TEST_URI must include a valid database name");
  }
  if (databaseName === SOURCE_TEST_DATABASE || databaseName !== EXPECTED_RESTORE_DATABASE) {
    throw new Error(
      "MONGODB_RESTORE_TEST_URI must target the distinct approved disposable TEST database",
    );
  }

  const seen = new Set<string>();
  const authSources: string[] = [];
  for (const [name, optionValue] of uri.searchParams.entries()) {
    const normalizedName = name.toLowerCase();
    const isTLSOption = normalizedName.startsWith("tls") || normalizedName.startsWith("ssl");
    const isSensitive = normalizedName === "authsource" || isTLSOption || FORBIDDEN_OPTIONS.has(normalizedName);

    if (isSensitive && seen.has(normalizedName)) {
      throw new Error("MONGODB_RESTORE_TEST_URI must not duplicate security-sensitive options");
    }
    if (isSensitive) seen.add(normalizedName);

    if (normalizedName === "authsource") {
      authSources.push(optionValue);
    } else if (isTLSOption && (normalizedName !== "tls" || optionValue !== "true")) {
      throw new Error("MONGODB_RESTORE_TEST_URI must not weaken or override TLS verification");
    } else if (FORBIDDEN_OPTIONS.has(normalizedName)) {
      throw new Error("MONGODB_RESTORE_TEST_URI must not override routing or authentication options");
    }
  }

  if (authSources.length !== 1 || authSources[0] !== "admin") {
    throw new Error("MONGODB_RESTORE_TEST_URI must explicitly use authSource=admin");
  }
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error("Node.js TLS certificate verification is disabled");
  }

  let driverOptions: ReturnType<typeof getMongoDriverOptions>;
  try {
    driverOptions = getMongoDriverOptions(uri.toString());
  } catch {
    throw new Error("MONGODB_RESTORE_TEST_URI is not accepted by the installed MongoDB driver");
  }
  if (
    driverOptions.srvHost?.toLowerCase() !== EXPECTED_TEST_HOSTNAME ||
    driverOptions.dbName !== databaseName ||
    driverOptions.tls !== true ||
    driverOptions.tlsInsecure === true ||
    driverOptions.rejectUnauthorized === false ||
    typeof driverOptions.checkServerIdentity === "function"
  ) {
    throw new Error("MONGODB_RESTORE_TEST_URI must preserve the approved target and verified TLS");
  }

  return {
    databaseName,
    hostname: uri.hostname.toLowerCase(),
    uri: uri.toString(),
  };
}

function getMongoDriverOptions(value: string) {
  return new mongoose.mongo.MongoClient(value).options;
}
