import assert from "node:assert/strict";
import { test } from "node:test";
import { assertLocalDemoUri, assertNoInheritedServices, FAILED_RUN_MARKER, LOCAL_DEMO, LOCAL_DEMO_URI, safeMongoFailure, validateFailedRunManifest, VERIFIED_EMPTY_COLLECTIONS, verifyEmptyLocalDemoDatabase } from "../../lib/noida-local-demo-target.mjs";

test("only the exact disposable loopback target is accepted", () => {
  assert.doesNotThrow(() => assertLocalDemoUri(LOCAL_DEMO_URI));
  for (const uri of [
    LOCAL_DEMO_URI.replace("127.0.0.1", "localhost"),
    LOCAL_DEMO_URI.replace("127.0.0.1", "cluster0.zshxfui.mongodb.net"),
    LOCAL_DEMO_URI.replace("27179", "27017"),
    LOCAL_DEMO_URI.replace("noida-crm-demo-20261019", "omana-phase5-test-2"),
    LOCAL_DEMO_URI.replace("noida_demo", "other"),
    `${LOCAL_DEMO_URI}&authSource=admin`,
  ]) assert.throws(() => assertLocalDemoUri(uri));
});

test("inherited remote and integration configuration is rejected", () => {
  assert.doesNotThrow(() => assertNoInheritedServices({ PATH: "/usr/bin" }));
  for (const key of ["MONGODB_URI", "MONGODB_TEST_URI", "PAYLOAD_SECRET", "PAYLOAD_DROP_DATABASE", "SMTP_HOST", "BLOB_READ_WRITE_TOKEN", "OPENAI_API_KEY", "WHATSAPP_TOKEN", "VERCEL_PROJECT_ID"]) {
    assert.throws(() => assertNoInheritedServices({ [key]: "redacted" }));
  }
});

test("failure metadata preserves operation and code without leaking messages or credentials", () => {
  const error = Object.assign(new Error("credential=secret-value mongodb+srv://hidden password:abc"), { code: 112, codeName: "WriteConflict", errorLabels: ["TransientTransactionError"] });
  const diagnostic = safeMongoFailure(error, "create crm-offices office", ["secret-value"]);
  assert.deepEqual(diagnostic, { operation: "create crm-offices office", errorClass: "Error", code: 112, codeName: "WriteConflict", labels: ["TransientTransactionError"], causeCode: null, causeCodeName: null, serverCode: null, serverCodeName: null, detail: "[redacted-field] [redacted-uri] [redacted-field]" });
  assert.equal(JSON.stringify(diagnostic).includes("secret-value"), false);
  assert.equal(JSON.stringify(diagnostic).includes("mongodb+srv://"), false);
});

test("previous failure manifest must prove the exact target and zero fixture IDs", () => {
  const manifest = {
    runMarker: FAILED_RUN_MARKER,
    status: "partial-failure",
    target: { host: LOCAL_DEMO.host, port: LOCAL_DEMO.port, replicaSet: LOCAL_DEMO.replicaSet, database: LOCAL_DEMO.database },
    ids: { office: null, admin: null, leader: null, team: null, counter: null, salespeople: [], leads: [], activities: [] },
  };
  assert.doesNotThrow(() => validateFailedRunManifest(manifest));
  assert.throws(() => validateFailedRunManifest({ ...manifest, status: "verified" }));
  assert.throws(() => validateFailedRunManifest({ ...manifest, ids: { ...manifest.ids, office: "unexpected" } }));
  assert.throws(() => validateFailedRunManifest({ ...manifest, target: { ...manifest.target, database: "other" } }));
});

function mockEmptyDemo({ names = VERIFIED_EMPTY_COLLECTIONS, nonempty = null, view = null, officeIndexes = true } = {}) {
  return {
    db(databaseName) {
      return {
        databaseName,
        listCollections() { return { toArray: async () => names.map((name) => ({ name, type: name === view ? "view" : "collection" })) }; },
        collection(name) {
          return {
            countDocuments: async () => name === nonempty ? 1 : 0,
            listIndexes: () => ({ toArray: async () => officeIndexes ? [
              { key: { name: 1 }, unique: true }, { key: { code: 1 }, unique: true },
            ] : [{ key: { _id: 1 } }] }),
          };
        },
      };
    },
  };
}

test("existing collection guard accepts only the exact empty catalog and required office indexes", async () => {
  const result = await verifyEmptyLocalDemoDatabase(mockEmptyDemo(), { requireOfficeIndexes: true });
  assert.deepEqual(result, { database: LOCAL_DEMO.database, collectionCount: 31, documentCount: 0 });
  await assert.rejects(() => verifyEmptyLocalDemoDatabase(mockEmptyDemo({ names: VERIFIED_EMPTY_COLLECTIONS.slice(1) })));
  await assert.rejects(() => verifyEmptyLocalDemoDatabase(mockEmptyDemo({ names: [...VERIFIED_EMPTY_COLLECTIONS, "unexpected"] })));
  await assert.rejects(() => verifyEmptyLocalDemoDatabase(mockEmptyDemo({ nonempty: "users" })));
  await assert.rejects(() => verifyEmptyLocalDemoDatabase(mockEmptyDemo({ view: "crm-offices" })));
  await assert.rejects(() => verifyEmptyLocalDemoDatabase(mockEmptyDemo({ officeIndexes: false }), { requireOfficeIndexes: true }));
});
