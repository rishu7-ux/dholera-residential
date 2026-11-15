import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { auditLeadLinks } from "../../lib/crm/reconciliation-audit.ts";

test("read-only link audit names orphan, missing and duplicate links without modifying input", () => {
  const centrals = [
    { id: "central-a", legacyCollection: "estate1-enquiries", legacyId: "legacy-a" },
    { id: "central-b", legacyCollection: "estate1-enquiries", legacyId: "missing" },
    { id: "central-c" },
    { id: "central-d", legacyCollection: "estate1-enquiries", legacyId: "legacy-a" },
  ];
  const legacy = [{ collection: "estate1-enquiries", id: "legacy-a" }, { collection: "estate1-enquiries", id: "orphan" }];
  const before = JSON.stringify({ centrals, legacy });
  const result = auditLeadLinks(centrals, legacy);
  assert.deepEqual(result, {
    centralWithoutLink: ["central-c"],
    centralMissingLegacy: ["central-b"],
    duplicateCentralLinks: ["central-d"],
    orphanLegacy: [{ collection: "estate1-enquiries", id: "orphan" }],
  });
  assert.equal(JSON.stringify({ centrals, legacy }), before);
});

const evidencePath = resolve(import.meta.dirname, "../../.artifacts/noida-local-fault-qa-20261021/noida-fault-cae7c63a-dad2-4241-959b-4e1374e42f55.json");
test("protected fault evidence confirms four Estate orphans and one Omana central without a link", { skip: !existsSync(evidencePath) }, () => {
  const manifest = JSON.parse(readFileSync(evidencePath, "utf8"));
  assert.equal(manifest.status, "PASS");
  const legacyRecords = ["estate1-enquiries", "omana-enquiries"].flatMap((collection) =>
    manifest.final.ids[collection].map((id) => ({ collection, id })));
  const gaps = auditLeadLinks(manifest.final.leads, legacyRecords);
  assert.equal(gaps.orphanLegacy.length, 4);
  assert.equal(gaps.centralWithoutLink.length, 1);
  assert.deepEqual(gaps.centralMissingLegacy, []);
  assert.deepEqual(gaps.duplicateCentralLinks, []);
});
