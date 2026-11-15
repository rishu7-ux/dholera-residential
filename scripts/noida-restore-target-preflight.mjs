import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

import mongoose from "mongoose";
import { validateMongoRestoreTestTarget } from "../lib/mongodb-restore-test-target.ts";
import { validateMongoTestTarget } from "../lib/mongodb-test-target.ts";

const env = parseEnv(readFileSync(resolve(".env.test.local"), "utf8"));
assert.equal(process.env.MONGODB_URI, undefined, "production fallback must be unset");
const source = validateMongoTestTarget(env.MONGODB_TEST_URI);
const destination = validateMongoRestoreTestTarget(env.MONGODB_RESTORE_TEST_URI);

assert.notEqual(destination.databaseName, source.databaseName);
assert.equal(destination.hostname, source.hostname);
assert.equal(decodeURIComponent(new URL(destination.uri).username), "noida_test_restore");

const client = new mongoose.mongo.MongoClient(destination.uri, {
  serverSelectionTimeoutMS: 15_000,
});
let stage = "authentication";
try {
  await client.connect();
  const authInfo = (await client.db("admin").command({ connectionStatus: 1 })).authInfo;
  assert.deepEqual(authInfo?.authenticatedUsers?.map(({ user, db }) => ({ user, db })),
    [{ user: "noida_test_restore", db: "admin" }], "connected identity must be the dedicated TEST restore user");
  const roles = authInfo?.authenticatedUserRoles ?? [];
  assert.deepEqual(roles.map(({ role, db }) => ({ role, db })), [{ role: "atlasAdmin", db: "admin" }],
    "dedicated restore user must have only the documented Atlas restore role");
  stage = "destination-absence";
  const databases = await client.db("admin").admin().listDatabases({ nameOnly: true, authorizedDatabases: false });
  if (databases.databases.some(({ name }) => name === destination.databaseName)) {
    throw new Error("DESTINATION_ALREADY_EXISTS");
  }
  stage = "destination-collections";
  const existingCollections = await client
    .db(destination.databaseName)
    .listCollections({}, { nameOnly: true })
    .toArray();
  assert.equal(
    existingCollections.length,
    0,
    "restore destination must be a new empty database",
  );
  console.log(JSON.stringify({
    result: "PASS",
    hostname: destination.hostname,
    username: "noida_test_restore",
    source: source.databaseName,
    destination: destination.databaseName,
    destinationEmpty: true,
    destinationAbsent: true,
    restoreRole: "atlasAdmin@admin",
    clusterRestriction: "owner-confirmed in Atlas; not proven by connectionStatus",
    tlsVerification: "enabled",
  }));
} catch (error) {
  console.log(JSON.stringify({
    result: "FAIL",
    stage,
    code: error?.code ?? null,
    reason: error?.message === "DESTINATION_ALREADY_EXISTS"
      ? "DESTINATION_ALREADY_EXISTS"
      : "READ_ONLY_PREFLIGHT_FAILED",
  }));
  process.exitCode = 1;
} finally {
  await client.close();
}
