import assert from "node:assert/strict";
import test from "node:test";

import { qualifyLead } from "../../lib/leads/qualification.ts";

test("strong buyer is HOT", () => {
  const result = qualifyLead({ initialIntent: "I want to buy and arrange a site visit.", selectedProject: "Dholera Estate 3", requirement: "Residential plot for my family", budget: "INR 50 lakh", purchaseTimeline: "next month" });
  assert.equal(result.qualification, "hot");
});

test("genuine later-stage buyer is WARM", () => {
  const result = qualifyLead({ initialIntent: "I am comparing projects for a future purchase.", selectedProject: "Dholera residential projects", requirement: "Residential plot options", purchaseTimeline: "six months" });
  assert.equal(result.qualification, "warm");
});

test("explicit no-current-purchase enquiry is COLD", () => {
  const result = qualifyLead({ initialIntent: "I only need information. I am not planning to purchase currently.", selectedProject: "Dholera information", requirement: "Information only" });
  assert.equal(result.qualification, "cold");
});

test("insufficient information is NEEDS-REVIEW", () => {
  const result = qualifyLead({ initialIntent: "Please contact me.", selectedProject: "unknown", requirement: "unclear" });
  assert.equal(result.qualification, "needs-review");
});

test("missing budget does not prevent HOT when a site visit and property context are explicit", () => {
  const result = qualifyLead({ initialIntent: "Please arrange a site visit.", selectedProject: "Dholera Estate 3", requirement: "Residential plot" });
  assert.equal(result.qualification, "hot");
});

test("missing timeline with a clear requirement is WARM, not COLD", () => {
  const result = qualifyLead({ selectedProject: "Dholera projects", requirement: "I need a residential plot" });
  assert.equal(result.qualification, "warm");
});

test("missing buying details never automatically becomes COLD", () => {
  const result = qualifyLead({ selectedProject: "unknown", requirement: "unclear" });
  assert.equal(result.qualification, "needs-review");
});

test("explicit site visit intent is handled as HOT with property context", () => {
  const result = qualifyLead({ initialIntent: "I would like to schedule a site visit.", selectedProject: "Dholera Estate 3" });
  assert.equal(result.qualification, "hot");
});

test("sales contact request is HOT only with explicit buying intent and property context", () => {
  const hot = qualifyLead({ initialIntent: "I want to buy a plot. Please ask sales to call me.", selectedProject: "Dholera Estate 3" });
  const review = qualifyLead({ initialIntent: "Please call me.", selectedProject: "unknown", requirement: "unclear" });
  assert.equal(hot.qualification, "hot");
  assert.equal(review.qualification, "needs-review");
});
