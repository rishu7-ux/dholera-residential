import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

import mongoose from "mongoose";

import { validateMongoCrmTestWriterTarget } from "../lib/mongodb-crm-test-writer-target.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = parseEnv(readFileSync(resolve(root, ".env.test.local"), "utf8"));
const target = validateMongoCrmTestWriterTarget(
  env.MONGODB_CRM_TEST_WRITER_URI,
  env.MONGODB_TEST_URI,
  env.MONGODB_RESTORE_TEST_URI,
  process.env.MONGODB_URI,
);

const client = new mongoose.mongo.MongoClient(target.uri, {
  readPreference: "primary",
  serverSelectionTimeoutMS: 15_000,
});

try {
  await client.connect();
  await client.db("admin").command({ ping: 1 });
  const status = await client.db("admin").command({ connectionStatus: 1 });
  const roles = status.authInfo?.authenticatedUserRoles ?? [];
  assert.deepEqual(
    roles.map(({ role, db }) => ({ role, database: db })),
    target.expectedAtlasRoles,
    "writer must have exactly readWrite on the approved TEST database",
  );

  console.log(JSON.stringify({
    result: "PASS",
    mode: "READ_ONLY_PREFLIGHT",
    hostname: target.hostname,
    database: target.databaseName,
    username: target.username,
    roles: target.expectedAtlasRoles,
    authentication: "PASS",
    databaseWrites: false,
  }));
} finally {
  await client.close();
}
