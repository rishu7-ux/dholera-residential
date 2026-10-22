import assert from "node:assert/strict";
import test from "node:test";

// Even an accidental database call can reach only a closed loopback port.
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/noida-offline-guard?directConnection=true";
process.env.PAYLOAD_SECRET = "offline-ingress-guard-only";

const [{ POST: omana }, { POST: estate1 }, { POST: estate2 }, { POST: estates }, { POST: industrial }] = await Promise.all([
  import("../../app/api/omana-leads/route"),
  import("../../app/api/estate1-leads/route"),
  import("../../app/api/estate2-leads/route"),
  import("../../app/api/dholera-estates-leads/route"),
  import("../../app/api/industrial-leads/route"),
]);

const cases = [
  { name: "Omana", env: "OMANA_INGEST_SECRET", handler: omana },
  { name: "Estate 1", env: "ESTATE1_INGEST_SECRET", handler: estate1 },
  { name: "Estate 2", env: "ESTATE2_INGEST_SECRET", handler: estate2 },
  { name: "Dholera Estates", env: "DHOLERA_ESTATES_INGEST_SECRET", handler: estates },
  { name: "Industrial", env: "INDUSTRIAL_INGEST_SECRET", handler: industrial },
] as const;

function request(body: string, token?: string) {
  return new Request("http://127.0.0.1/ingress", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body,
  });
}

for (const { name, env, handler } of cases) {
  test(`${name} ingress rejects anonymous and malformed requests before database access`, async () => {
    const previous = process.env[env];
    const syntheticSecret = `offline-only-${name.replaceAll(" ", "-")}`;
    try {
      process.env[env] = syntheticSecret;
      assert.equal((await handler(request("{}"))).status, 401);
      assert.equal((await handler(request("{}", "incorrect-offline-token"))).status, 401);
      assert.equal((await handler(request("{}", syntheticSecret))).status, 400);
      assert.equal((await handler(request("not-json", syntheticSecret))).status, 400);
    } finally {
      if (previous === undefined) delete process.env[env];
      else process.env[env] = previous;
    }
  });
}
