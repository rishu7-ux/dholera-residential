import assert from "node:assert/strict";
import test from "node:test";

import {
  CRM_LEGACY_COLLECTIONS,
  isRunMarkedSyntheticLegacy,
  legacyCollectionForForm,
} from "./crm-legacy-fixtures.ts";

test("every Omana form type maps to its actual legacy collection", () => {
  assert.equal(legacyCollectionForForm("omana-projects", "enquiry"), "omana-enquiries");
  assert.equal(legacyCollectionForForm("omana-projects", "contact"), "omana-contact-messages");
  assert.equal(legacyCollectionForForm("omana-projects", "google-ads-enquiry"), "omana-google-ads-enquiries");
  assert.equal(legacyCollectionForForm("omana-projects", "ai-chatbot-enquiry"), "omana-enquiries");
});

test("the other four websites map both form types to their legacy collections", () => {
  for (const [website, prefix] of [
    ["dholera-estate-1", "estate1"],
    ["dholera-estate-2", "estate2"],
    ["dholeraestates", "dholera-estates"],
    ["dholeraindustrial", "industrial"],
  ]) {
    assert.equal(legacyCollectionForForm(website, "enquiry"), `${prefix}-enquiries`);
    assert.equal(legacyCollectionForForm(website, "contact"), `${prefix}-contact-messages`);
  }
  assert.equal(CRM_LEGACY_COLLECTIONS.length, 11);
  assert.throws(() => legacyCollectionForForm("unknown", "enquiry"));
});

test("cleanup accepts only records with the exact run identity and synthetic data", () => {
  const runId = "11111111-2222-4333-8444-555555555555";
  const record = {
    email: `${runId}.omana-contact@example.invalid`,
    name: "Synthetic Omana Contact",
    source: "omana-contact-page",
  };
  assert.equal(isRunMarkedSyntheticLegacy(record, runId), true);
  assert.equal(isRunMarkedSyntheticLegacy(record, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"), false);
  assert.equal(isRunMarkedSyntheticLegacy({ ...record, email: "buyer@example.com" }, runId), false);
  assert.equal(isRunMarkedSyntheticLegacy({ ...record, name: "Real Customer" }, runId), false);
  assert.equal(isRunMarkedSyntheticLegacy({ ...record, source: "" }, runId), false);
});
