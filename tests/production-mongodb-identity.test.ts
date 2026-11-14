import assert from "node:assert/strict";
import test from "node:test";

import {
  createProductionMongoIdentityHandler,
  MASTER_CMS_PROJECT_ID,
} from "../lib/production-mongodb-identity.ts";

const token = "a".repeat(43);
const env = {
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_PROJECT_ID: MASTER_CMS_PROJECT_ID,
  VERCEL_DEPLOYMENT_ID: "dpl_Abc123",
  MONGODB_IDENTITY_DIAGNOSTIC_TOKEN: token,
  MONGODB_URI:
    "mongodb+srv://private-user:private-password@cluster0.example.mongodb.net/private-db?tls=true",
};

function request(body: string, authorization = `Bearer ${token}`) {
  return new Request("https://diagnostic.example/api/internal/production-mongodb-identity", {
    method: "POST",
    headers: { authorization, "x-expected-deployment-id": "dpl_Abc123" },
    body,
  });
}

test("returns only boolean checks after authentication", async () => {
  const handler = createProductionMongoIdentityHandler(env);
  const response = await handler(request(""));

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(Object.keys(result), ["checks"]);
  assert(Object.values(result.checks).every((value) => value === true));
  assert(!JSON.stringify(result).includes("private-"));
  assert.equal(response.headers.get("cache-control"), "no-store, private, max-age=0");
});

test("reports a non-empty body and malformed URI with false booleans", async () => {
  const handler = createProductionMongoIdentityHandler({ ...env, MONGODB_URI: "malformed" });
  const response = await handler(request(" "));

  assert.equal(response.status, 200);
  const { checks } = await response.json();
  assert.equal(checks.zeroByteBody, false);
  assert.equal(checks.mongoScheme, false);
  assert.equal(checks.mongoHostname, false);
  assert.equal(checks.mongoDatabasePath, false);
  assert.equal(checks.mongoPortAbsent, false);
  assert(Object.values(checks).every((value) => typeof value === "boolean"));
});

test("keeps authorization failure generic and logs only authentication booleans", async () => {
  const handler = createProductionMongoIdentityHandler(env);
  const logs: unknown[][] = [];
  const originalInfo = console.info;
  console.info = (...args: unknown[]) => { logs.push(args); };
  let response: Response;
  try {
    response = await handler(request("", `Bearer ${"b".repeat(43)}`));
  } finally {
    console.info = originalInfo;
  }

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Not found" });
  assert.deepEqual(logs, [["mongodb-identity-auth-checks", {
    configuredTokenFormat: true,
    suppliedTokenFormat: true,
    tokenMatch: false,
  }]]);
  assert(!JSON.stringify(logs).includes(token));
  assert(!JSON.stringify(logs).includes("private-"));
});
