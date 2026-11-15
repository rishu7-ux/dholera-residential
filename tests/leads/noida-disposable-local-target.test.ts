import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildNoidaDisposableLocalPlan, NOIDA_DISPOSABLE_LOCAL } from "../../lib/noida-disposable-local-target";
import { resolveNoidaStagingMongoUri } from "../../lib/noida-staging-runtime";

const uri = "mongodb://noida_local_app:synthetic-local-only-password-12345@127.0.0.1:27189/noida-crm-disposable-20261027?authSource=noida-crm-disposable-20261027&replicaSet=noida_crm_disposable&directConnection=true";
const validEnvironment = {
  NOIDA_DISPOSABLE_LOCAL_MODE: "1",
  NOIDA_DISPOSABLE_LOCAL_BIND: "127.0.0.1",
  NODE_ENV: "development",
  MONGODB_URI: uri,
  PAYLOAD_SECRET: "synthetic-payload-secret-only-for-offline-test-12345",
  NOIDA_SMTP_DELIVERY_ENABLED: "0",
};

describe("disposable localhost CRM target", () => {
  it("allows only the exact authenticated loopback target", () => {
    assert.equal(resolveNoidaStagingMongoUri(validEnvironment), uri);
    assert.deepEqual(NOIDA_DISPOSABLE_LOCAL, {
      host: "127.0.0.1",
      port: 27189,
      replicaSet: "noida_crm_disposable",
      database: "noida-crm-disposable-20261027",
      username: "noida_local_app",
      bind: "127.0.0.1",
    });
  });

  it("fails closed on Atlas, other local databases, users, ports and URI options", () => {
    for (const replacement of [
      uri.replace("127.0.0.1", "cluster0.zshxfui.mongodb.net"),
      uri.replace("noida-crm-disposable-20261027?", "omana-phase5-test-2?"),
      uri.replace("noida_local_app:", "noida_stage_app:"),
      uri.replace("synthetic-local-only-password-12345", "short"),
      uri.replace(":27189/", ":27017/"),
      `${uri}&tlsInsecure=true`,
      uri.replace("&directConnection=true", ""),
    ]) {
      assert.throws(() => resolveNoidaStagingMongoUri({ ...validEnvironment, MONGODB_URI: replacement }));
    }
  });

  it("rejects inherited deployment, service and unsafe startup settings", () => {
    const unsafe = [
      { VERCEL: "1" }, { MONGODB_TEST_URI: "unused" }, { NOIDA_LOCAL_STAGING_MODE: "1" },
      { PAYLOAD_DROP_DATABASE: "false" }, { SMTP_HOST: "example.invalid" },
      { PAYLOAD_EMAIL_FROM_ADDRESS: "test@example.invalid" }, { RAG_INDEX_SECRET: "unused" },
      { WHATSAPP_TOKEN: "unused" }, { ESTATE1_INGEST_SECRET: "unused" },
      { NOIDA_SMTP_DELIVERY_ENABLED: "1" }, { NODE_TLS_REJECT_UNAUTHORIZED: "0" },
      { PAYLOAD_SECRET: "weak" }, { NODE_ENV: "production" },
      { NOIDA_DISPOSABLE_LOCAL_BIND: "0.0.0.0" },
    ];
    for (const extra of unsafe) {
      assert.throws(() => resolveNoidaStagingMongoUri({ ...validEnvironment, ...extra }));
    }
    assert.throws(() => resolveNoidaStagingMongoUri({ ...validEnvironment, NOIDA_DISPOSABLE_LOCAL_MODE: undefined }));
  });

  it("plans eleven synthetic leads and one wraparound without I/O", () => {
    const plan = buildNoidaDisposableLocalPlan("local-qa-20261027");
    assert.deepEqual(plan.assignmentOrders, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1]);
    assert.equal(plan.fixture.roster.filter((user) => user.role === "salesperson").length, 10);
    assert.equal(plan.fixture.roster.filter((user) => user.role === "team-leader").length, 1);
    assert.equal(plan.expected.users, 12);
    assert.equal(plan.expected.centralLeads, 11);
    assert.equal(plan.duplicateReplay.expectedAdditionalDocuments, 0);
    assert.ok(plan.leads.every((lead) => lead.email.endsWith("@example.invalid")));
    assert.equal(plan.databaseConnection, false);
    assert.equal(plan.databaseWrites, false);
  });

  it("refuses bootstrap, Payload startup and CRM writes without exact approvals", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const directory = resolve(root, `.artifacts/${NOIDA_DISPOSABLE_LOCAL.database}`);
    const existedBefore = existsSync(directory);
    for (const script of [
      "noida-disposable-local-bootstrap.mjs",
      "noida-disposable-local-readonly-preflight.mjs",
      "noida-disposable-local-launch.mjs",
      "noida-disposable-local-functional-qa.mjs",
      "noida-disposable-local-run-qa.mjs",
    ]) {
      const result = spawnSync(process.execPath, ["--import", "tsx", resolve(root, "scripts", script)], {
        cwd: root, encoding: "utf8", timeout: 5000,
      });
      assert.notEqual(result.status, 0, `${script} refuses an unapproved invocation`);
    }
    assert.equal(existsSync(directory), existedBefore, "denied invocations do not create a data directory");
  });
});
