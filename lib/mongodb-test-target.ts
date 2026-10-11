import mongoose from "mongoose";

type MongoTarget = {
  databaseName: string;
  hostname: string;
  uri: URL;
};

const EXPECTED_TEST_HOSTNAME = "cluster0.oqcardp.mongodb.net";
const EXPECTED_TEST_DATABASE = "omana-phase5-test-2";
const ROUTING_OVERRIDE_OPTIONS = new Set([
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
const AUTHENTICATION_OVERRIDE_OPTIONS = new Set([
  "authmechanism",
  "authmechanismproperties",
]);

function validateSecurityOptions(uri: URL) {
  const seenSecurityOptions = new Set<string>();
  const authSources: string[] = [];

  for (const [name, value] of uri.searchParams.entries()) {
    const normalizedName = name.toLowerCase();
    const isTLSOption =
      normalizedName.startsWith("tls") || normalizedName.startsWith("ssl");
    const isSecuritySensitive =
      normalizedName === "authsource" ||
      isTLSOption ||
      ROUTING_OVERRIDE_OPTIONS.has(normalizedName) ||
      AUTHENTICATION_OVERRIDE_OPTIONS.has(normalizedName);

    if (isSecuritySensitive && seenSecurityOptions.has(normalizedName)) {
      throw new Error("MONGODB_TEST_URI must not duplicate security-sensitive options");
    }
    if (isSecuritySensitive) seenSecurityOptions.add(normalizedName);

    if (normalizedName === "authsource") {
      authSources.push(value);
      continue;
    }

    // SRV connections enable TLS by default. An explicit true is allowed;
    // every other TLS/SSL URI option is rejected to preserve default
    // certificate and hostname verification.
    if (isTLSOption && (normalizedName !== "tls" || value !== "true")) {
      throw new Error("MONGODB_TEST_URI must not weaken or override TLS verification");
    }

    if (
      ROUTING_OVERRIDE_OPTIONS.has(normalizedName) ||
      AUTHENTICATION_OVERRIDE_OPTIONS.has(normalizedName)
    ) {
      throw new Error("MONGODB_TEST_URI must not override routing or authentication options");
    }
  }

  if (authSources.length !== 1 || authSources[0] !== "admin") {
    throw new Error("MONGODB_TEST_URI must explicitly use authSource=admin");
  }

  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error("Node.js TLS certificate verification is disabled");
  }
}

function parseMongoTestTarget(value: string): MongoTarget {
  let uri: URL;
  try {
    uri = new URL(value);
  } catch {
    throw new Error("MONGODB_TEST_URI must be a valid MongoDB URI");
  }

  if (uri.protocol !== "mongodb+srv:") {
    throw new Error("MONGODB_TEST_URI must use the mongodb+srv scheme");
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(uri.pathname.replace(/^\//, ""));
  } catch {
    throw new Error("MONGODB_TEST_URI must include a valid database name");
  }

  if (uri.hostname.toLowerCase() !== EXPECTED_TEST_HOSTNAME) {
    throw new Error("MONGODB_TEST_URI must target the approved TEST cluster");
  }

  if (databaseName !== EXPECTED_TEST_DATABASE) {
    throw new Error("MONGODB_TEST_URI must target the approved TEST database");
  }

  validateSecurityOptions(uri);

  let driverOptions: ReturnType<typeof getMongoDriverOptions>;
  try {
    driverOptions = getMongoDriverOptions(uri.toString());
  } catch {
    throw new Error("MONGODB_TEST_URI is not accepted by the installed MongoDB driver");
  }

  if (
    driverOptions.srvHost?.toLowerCase() !== EXPECTED_TEST_HOSTNAME ||
    driverOptions.dbName !== EXPECTED_TEST_DATABASE ||
    driverOptions.tls !== true ||
    driverOptions.tlsInsecure === true ||
    driverOptions.rejectUnauthorized === false ||
    typeof driverOptions.checkServerIdentity === "function"
  ) {
    throw new Error("MONGODB_TEST_URI must preserve the approved target and verified TLS");
  }

  return {
    databaseName,
    hostname: uri.hostname.toLowerCase(),
    uri,
  };
}

function getMongoDriverOptions(value: string) {
  // MongoClient's constructor parses options synchronously; network activity
  // starts only when connect() is called, which this validator never does.
  return new mongoose.mongo.MongoClient(value).options;
}

export function validateMongoTestTarget(
  testUriValue: string | undefined,
  legacyProductionUriValue?: string,
) {
  void legacyProductionUriValue;

  if (!testUriValue?.trim()) {
    throw new Error("MONGODB_TEST_URI is required; refusing to use any fallback URI");
  }

  const test = parseMongoTestTarget(testUriValue.trim());

  return {
    databaseName: test.databaseName,
    hostname: test.hostname,
    uri: test.uri.toString(),
  };
}
