import assert from "node:assert/strict";
import test from "node:test";

import { createProductionMongoIdentityHandler, MASTER_CMS_PROJECT_ID } from "../lib/production-mongodb-identity.ts";

const token = "A".repeat(43);
const uri = "mongodb+srv://identity-user:never-return-this@cluster.example.mongodb.net/dholera?authSource=admin&tls=true";
const fixedNow = Date.parse("2026-11-13T10:00:00.000Z");

function environment(overrides: Record<string, string | undefined> = {}) {
  return {
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_PROJECT_ID: MASTER_CMS_PROJECT_ID,
    VERCEL_DEPLOYMENT_ID: "dpl_ProductionDeployment123",
    MONGODB_URI: uri,
    MONGODB_IDENTITY_DIAGNOSTIC_TOKEN: token,
    MONGODB_IDENTITY_DIAGNOSTIC_EXPIRES_AT: "2026-11-13T10:15:00.000Z",
    ...overrides,
  };
}

function request(options: { authorization?: string; body?: BodyInit | null } = {}) {
  return new Request("https://cms.example.invalid/api/internal/production-mongodb-identity", {
    method: "POST",
    headers: options.authorization ? { authorization: options.authorization } : undefined,
    body: options.body,
  });
}

test("returns only the active deployment target and omits credential version metadata", async () => {
  const handler = createProductionMongoIdentityHandler(environment({ MONGODB_CREDENTIAL_VERSION_ID: "vault-item:v7" }), () => fixedNow);
  const response = await handler(request({ authorization: `Bearer ${token}` }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    deploymentId: "dpl_ProductionDeployment123",
    hostname: "cluster.example.mongodb.net",
    database: "dholera",
  });
  assert.equal("credentialVersionId" in body, false);
  assert.equal(JSON.stringify(body).includes("identity-user"), false);
  assert.equal(JSON.stringify(body).includes("never-return-this"), false);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

test("never reflects token-shaped credential version metadata", async () => {
  const handler = createProductionMongoIdentityHandler(environment({ MONGODB_CREDENTIAL_VERSION_ID: token }), () => fixedNow);
  const response = await handler(request({ authorization: `Bearer ${token}` }));
  const body = await response.json();
  assert.equal("credentialVersionId" in body, false);
  assert.equal(JSON.stringify(body).includes(token), false);
});

test("defaults an absent database path to test independently of authSource", async () => {
  for (const suffix of ["", "/", "?authSource=admin&tls=true", "/?authSource=admin&tls=true"]) {
    const handler = createProductionMongoIdentityHandler(environment({
      MONGODB_URI: `mongodb+srv://fixture-user:fixture-password@cluster.example.mongodb.net${suffix}`,
    }), () => fixedNow);
    const response = await handler(request({ authorization: `Bearer ${token}` }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      deploymentId: "dpl_ProductionDeployment123",
      hostname: "cluster.example.mongodb.net",
      database: "test",
    });
  }
});

test("still rejects malformed database path encoding instead of defaulting it", async () => {
  const handler = createProductionMongoIdentityHandler(environment({
    MONGODB_URI: "mongodb+srv://cluster.example.mongodb.net/%ZZ",
  }), () => fixedNow);
  const response = await handler(request({ authorization: `Bearer ${token}` }));
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Not found" });
});

test("reports the configured TEST namespace verbatim for isolation comparison without connecting", async () => {
  const testUri = "mongodb+srv://stage-user:stage-secret@cluster0.zshxfui.mongodb.net/omana-phase5-crm-stage-20261017a?authSource=admin&tls=true";
  const handler = createProductionMongoIdentityHandler(environment({ MONGODB_URI: testUri }), () => fixedNow);
  const response = await handler(request({ authorization: `Bearer ${token}` }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.hostname, "cluster0.zshxfui.mongodb.net");
  assert.equal(body.database, "omana-phase5-crm-stage-20261017a");
  assert.equal(JSON.stringify(body).includes("stage-secret"), false);
});

test("rejects missing or incorrect authentication with the same not-found response", async () => {
  const handler = createProductionMongoIdentityHandler(environment(), () => fixedNow);
  const missing = await handler(request());
  const wrong = await handler(request({ authorization: `Bearer ${"B".repeat(43)}` }));
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), await wrong.json());
});

test("rejects non-production, wrong-project, and body-bearing requests", async () => {
  const auth = { authorization: `Bearer ${token}` };
  for (const env of [
    environment({ VERCEL_ENV: "preview" }),
    environment({ VERCEL_PROJECT_ID: "another-project" }),
  ]) {
    assert.equal((await createProductionMongoIdentityHandler(env, () => fixedNow)(request(auth))).status, 404);
  }
  assert.equal((await createProductionMongoIdentityHandler(environment(), () => fixedNow)(request({ ...auth, body: "ignored" }))).status, 404);
});

test("fails closed for malformed targets and version identifiers without reflecting input", async () => {
  const malformedSecret = "do-not-reflect-this-secret";
  const handler = createProductionMongoIdentityHandler(environment({
    MONGODB_URI: `not-a-uri-${malformedSecret}`,
    MONGODB_CREDENTIAL_VERSION_ID: "bad value",
  }), () => fixedNow);
  const response = await handler(request({ authorization: `Bearer ${token}` }));
  const text = await response.text();
  assert.equal(response.status, 404);
  assert.equal(text.includes(malformedSecret), false);
  assert.equal(text.includes("bad value"), false);
});

test("fails closed for missing, malformed, expired, and overlong diagnostic windows", async () => {
  const auth = request({ authorization: `Bearer ${token}` });
  for (const expiry of [undefined, "not-a-date", "2026-11-13T09:59:59.999Z", "2026-11-13T10:15:00.001Z"]) {
    const handler = createProductionMongoIdentityHandler(environment({ MONGODB_IDENTITY_DIAGNOSTIC_EXPIRES_AT: expiry }), () => fixedNow);
    assert.equal((await handler(auth)).status, 404);
  }
});


test("accepts zero-byte strings and streams while rejecting actual bytes", async () => {
  for (const body of ["", new ReadableStream({ start(c) { c.close(); } })]) {
    const req = new Request("https://fixture.invalid", { method: "POST", headers: {authorization: `Bearer ${token}`}, body, duplex: "half" } as RequestInit);
    assert.equal((await createProductionMongoIdentityHandler(environment(), () => fixedNow)(req)).status, 200);
  }
});

test("does not read unauthorized bodies or log credentials", async () => {
  let reads = 0;
  const req = request();
  Object.defineProperty(req, "body", {get() { reads++; throw new Error("must not read"); }});
  assert.equal((await createProductionMongoIdentityHandler(environment(), () => fixedNow)(req)).status, 404);
  assert.equal(reads, 0);
});

test("rejects stalled, errored and locked streams", async () => {
  for (const stream of [new ReadableStream(), new ReadableStream({start(c) {c.error(new Error("fixture"));}})]) {
    const req = new Request("https://fixture.invalid", {method:"POST",headers:{authorization:`Bearer ${token}`},body:stream,duplex:"half"} as RequestInit);
    assert.equal((await createProductionMongoIdentityHandler(environment(), () => fixedNow)(req)).status,404);
  }
  const locked=request({authorization:`Bearer ${token}`,body:""});
  locked.body!.getReader();
  assert.equal((await createProductionMongoIdentityHandler(environment(), () => fixedNow)(locked)).status,404);
});

test("rechecks expiry after awaiting EOF and rejects non-POST", async () => {
  let calls=0;
  const handler=createProductionMongoIdentityHandler(environment(),()=>calls++===0?fixedNow:fixedNow+900000);
  assert.equal((await handler(request({authorization:`Bearer ${token}`,body:""}))).status,404);
  assert.equal((await createProductionMongoIdentityHandler(environment(),()=>fixedNow)(new Request("https://fixture.invalid",{headers:{authorization:`Bearer ${token}`}}))).status,404);
});
