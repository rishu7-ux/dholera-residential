import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

import { buildNoidaStagingFixture, NOIDA_LEAD_CAPTURE_ROUTES } from "../lib/crm/staging-fixture";
import { validateMongoTestTarget } from "../lib/mongodb-test-target";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
assert.deepEqual(process.argv.slice(2), [], "This command is dry-run only and accepts no apply/write argument.");
const env = parseEnv(readFileSync(resolve(root, ".env.test.local"), "utf8"));
const target = validateMongoTestTarget(env.MONGODB_TEST_URI, process.env.MONGODB_URI);
assert.equal(process.env.MONGODB_URI, undefined, "Production fallback MONGODB_URI must remain unset.");

const fixture = buildNoidaStagingFixture("noida-stage-plan-20261016");
console.log(JSON.stringify({
  result: "PASS",
  mode: "DRY_RUN_ONLY",
  networkAccess: false,
  databaseWrites: false,
  target: { hostname: target.hostname, database: target.databaseName },
  minimumFixture: fixture.expected,
  leadCaptureRoutes: NOIDA_LEAD_CAPTURE_ROUTES.length,
  duplicateReplay: "planned",
  syntheticIdentityDomain: "example.invalid",
  marker: fixture.leads[0]?.page,
}));
