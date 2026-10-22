import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

export const LOCAL_DEMO = Object.freeze({
  host: "127.0.0.1",
  port: 27179,
  replicaSet: "noida_demo",
  database: "noida-crm-demo-20261019",
  directory: resolve(process.cwd(), ".artifacts/noida-local-demo-20261019"),
});

export const LOCAL_DEMO_URI = `mongodb://${LOCAL_DEMO.host}:${LOCAL_DEMO.port}/${LOCAL_DEMO.database}?replicaSet=${LOCAL_DEMO.replicaSet}&directConnection=true`;

export const FAILED_RUN_MARKER = "noida-local-5b6502a1-7a9e-4e5c-99dd-3695c68911d8";

export const VERIFIED_EMPTY_COLLECTIONS = Object.freeze([
  "ai-knowledges", "blogs", "central-leads", "contact-messages", "crm-activities", "crm-offices", "crm-teams",
  "dholera-estates-blogs", "dholera-estates-contact-messages", "dholera-estates-enquiries", "enquiries",
  "estate1-blogs", "estate1-contact-messages", "estate1-enquiries", "estate2-blogs", "estate2-contact-messages",
  "estate2-enquiries", "industrial-blogs", "industrial-contact-messages", "industrial-enquiries", "media",
  "omana-blogs", "omana-contact-messages", "omana-enquiries", "omana-google-ads-enquiries", "omana-salespeoples",
  "payload-kvs", "payload-locked-documents", "payload-migrations", "payload-preferences", "users",
]);

export function assertLocalDemoUri(uri) {
  if (uri !== LOCAL_DEMO_URI) throw new Error("MongoDB target is not the exact approved local demo URI");
  const parsed = new URL(uri);
  if (parsed.username || parsed.password || parsed.hostname !== LOCAL_DEMO.host || Number(parsed.port) !== LOCAL_DEMO.port || parsed.pathname !== `/${LOCAL_DEMO.database}`) {
    throw new Error("MongoDB target is not the exact approved local demo identity");
  }
}

export function assertNoInheritedServices(env) {
  const forbidden = Object.keys(env).filter((key) => /^(?:MONGODB|PAYLOAD_|BLOB_|SMTP_|OPENAI_|QDRANT_|WHATSAPP_|TWILIO_|VERCEL_|NOIDA_STAGING_|.*_INGEST_SECRET)/i.test(key));
  if (forbidden.length) throw new Error(`Inherited service configuration is present: ${forbidden.sort().join(", ")}`);
}

export function safeMongoFailure(error, operation, sensitiveValues = []) {
  const source = error && typeof error === "object" ? error : {};
  const code = Number.isSafeInteger(source.code) ? source.code : null;
  const codeName = typeof source.codeName === "string" && /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(source.codeName) ? source.codeName : null;
  const labels = Array.isArray(source.errorLabels) ? source.errorLabels.filter((label) => typeof label === "string" && /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(label)) : [];
  const cause = source.cause && typeof source.cause === "object" ? source.cause : {};
  const causeCode = Number.isSafeInteger(cause.code) ? cause.code : null;
  const causeCodeName = typeof cause.codeName === "string" && /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(cause.codeName) ? cause.codeName : null;
  const serverResponse = source.errorResponse && typeof source.errorResponse === "object" ? source.errorResponse : {};
  const serverCode = Number.isSafeInteger(serverResponse.code) ? serverResponse.code : null;
  const serverCodeName = typeof serverResponse.codeName === "string" && /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(serverResponse.codeName) ? serverResponse.codeName : null;
  let detail = operation === "create crm-offices office" && typeof source.message === "string" ? source.message : null;
  if (detail) {
    for (const value of sensitiveValues) {
      if (typeof value === "string" && value.length) detail = detail.split(value).join("[redacted]");
    }
    detail = detail
      .replace(/mongodb(?:\+srv)?:\/\/[^\s'"<>]+/gi, "[redacted-uri]")
      .replace(/(?:password|secret|token|credential|api[_-]?key)["']?\s*[:=]\s*["']?[^,\s'"}]+/gi, "[redacted-field]")
      .replace(/[\r\n\t]/g, " ")
      .slice(0, 280);
  }
  return { operation, errorClass: source.constructor?.name ?? "UnknownError", code, codeName, labels, causeCode, causeCodeName, serverCode, serverCodeName, detail };
}

export function validateFailedRunManifest(manifest) {
  const target = manifest?.target;
  const ids = manifest?.ids;
  if (manifest?.runMarker !== FAILED_RUN_MARKER || manifest?.status !== "partial-failure" ||
    target?.host !== LOCAL_DEMO.host || target?.port !== LOCAL_DEMO.port ||
    target?.replicaSet !== LOCAL_DEMO.replicaSet || target?.database !== LOCAL_DEMO.database ||
    ids?.office !== null || ids?.admin !== null || ids?.leader !== null || ids?.team !== null || ids?.counter !== null ||
    !Array.isArray(ids?.salespeople) || ids.salespeople.length !== 0 ||
    !Array.isArray(ids?.leads) || ids.leads.length !== 0 ||
    !Array.isArray(ids?.activities) || ids.activities.length !== 0) {
    throw new Error("Previous failed-run manifest does not prove zero CRM fixture IDs");
  }
}

export function verifyProtectedFailureManifest() {
  const path = resolve(LOCAL_DEMO.directory, `crm-${FAILED_RUN_MARKER}.manifest.json`);
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o777) !== 0o600 || realpathSync(path) !== path) {
    throw new Error("Previous failed-run manifest is missing or insecure");
  }
  validateFailedRunManifest(JSON.parse(readFileSync(path, "utf8")));
  return path;
}

export async function verifyEmptyLocalDemoDatabase(client, { requireOfficeIndexes = false } = {}) {
  const db = client.db(LOCAL_DEMO.database);
  if (db.databaseName !== LOCAL_DEMO.database) throw new Error("Connected database is not the approved local demo database");
  const entries = await db.listCollections({}, { nameOnly: false }).toArray();
  const names = entries.map((item) => item.name).sort();
  if (entries.some((item) => item.type !== "collection") ||
    names.length !== VERIFIED_EMPTY_COLLECTIONS.length ||
    names.some((name, index) => name !== VERIFIED_EMPTY_COLLECTIONS[index])) {
    throw new Error("Local demo database has an unexpected collection or view");
  }
  for (const name of names) {
    if (await db.collection(name).countDocuments({}) !== 0) {
      throw new Error(`Local demo collection ${name} contains unexpected documents`);
    }
  }
  if (requireOfficeIndexes) {
    const indexes = await db.collection("crm-offices").listIndexes().toArray();
    for (const field of ["name", "code"]) {
      if (!indexes.some((index) => index.unique === true && Object.keys(index.key ?? {}).length === 1 && index.key[field] === 1)) {
        throw new Error(`Local demo office ${field} unique index is not ready`);
      }
    }
  }
  return { database: LOCAL_DEMO.database, collectionCount: names.length, documentCount: 0 };
}

export async function verifyLocalDemoServer(client, { requireEmpty = true } = {}) {
  const dir = LOCAL_DEMO.directory;
  if (realpathSync(dir) !== dir || !statSync(dir).isDirectory() || (statSync(dir).mode & 0o077) !== 0) {
    throw new Error("Local demo directory is symlinked or accessible by others");
  }
  const pidPath = resolve(dir, "mongod.pid");
  if (realpathSync(pidPath) !== pidPath) throw new Error("MongoDB PID file is symlinked");
  const expectedPid = Number(readFileSync(pidPath, "utf8").trim());
  if (!Number.isSafeInteger(expectedPid) || expectedPid < 2) throw new Error("MongoDB PID file is invalid");

  const listeners = execFileSync("lsof", ["-nP", `-iTCP:${LOCAL_DEMO.port}`, "-sTCP:LISTEN"], { encoding: "utf8" }).trim().split("\n").slice(1);
  if (listeners.length !== 1 || !/^mongod\s+/.test(listeners[0]) || Number(listeners[0].trim().split(/\s+/)[1]) !== expectedPid || !listeners[0].endsWith(`TCP ${LOCAL_DEMO.host}:${LOCAL_DEMO.port} (LISTEN)`)) {
    throw new Error("MongoDB listener is not the approved loopback process");
  }

  const admin = client.db("admin");
  const [hello, status, databases] = await Promise.all([
    admin.command({ hello: 1 }),
    admin.command({ serverStatus: 1 }),
    admin.command({ listDatabases: 1, nameOnly: true }),
  ]);
  if (hello.setName !== LOCAL_DEMO.replicaSet || hello.isWritablePrimary !== true || hello.me !== `${LOCAL_DEMO.host}:${LOCAL_DEMO.port}` || hello.hosts?.length !== 1 || hello.hosts[0] !== hello.me || status.pid !== expectedPid) {
    throw new Error("Connected MongoDB server is not the approved local replica set");
  }
  if (requireEmpty && databases.databases.some((item) => item.name === LOCAL_DEMO.database)) {
    throw new Error("Approved demo database already exists; refusing to alter existing users or fixtures");
  }
  return { pid: expectedPid, version: status.version, replicaSet: hello.setName };
}
