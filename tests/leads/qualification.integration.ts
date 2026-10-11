import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

import { validateMongoTestTarget } from "../../lib/mongodb-test-target.ts";

const testEnvPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.env.test.local",
);
const testEnvironment = parseEnv(readFileSync(testEnvPath, "utf8"));
const { databaseName, uri: validatedTestUri } = validateMongoTestTarget(
  testEnvironment.MONGODB_TEST_URI,
);
const payloadDatabaseUri = new URL(validatedTestUri);
payloadDatabaseUri.searchParams.set("readPreference", "primary");
const isolatedTestUri = payloadDatabaseUri.toString();

// Payload reads MONGODB_URI during module initialization. Refuse every
// fallback and replace any inherited value before importing Payload/config.
process.env.MONGODB_TEST_URI = validatedTestUri;
process.env.MONGODB_URI = isolatedTestUri;
process.env.PAYLOAD_SECRET = randomBytes(32).toString("hex");
process.env.OMANA_INGEST_SECRET = randomBytes(32).toString("hex");

const mongoose = (await import("mongoose")).default;
await mongoose.connect(isolatedTestUri, { serverSelectionTimeoutMS: 15_000 });
if (!mongoose.connection.db) {
  throw new Error("MongoDB TEST database handle is unavailable");
}
await mongoose.connection.db.admin().command({ ping: 1 });
await mongoose.disconnect();

const { getPayload } = await import("payload");
const { default: config } = await import("../../payload.config.ts");
const { POST } = await import("../../app/api/omana-leads/route.ts");
const payload = await getPayload({ config });

const runId = randomUUID();
const nameToken = [...randomBytes(12)]
  .map((byte) => String.fromCharCode(65 + (byte % 26)))
  .join("");
const marker = `Phase Four ${nameToken}`;

const testNames = [
  `${marker} Hot`,
  `${marker} Warm`,
  `${marker} Cold`,
  `${marker} Review`,
  `${marker} Enquiry API`,
  `${marker} Contact API`,
];

const ids = {
  hot: randomUUID(),
  warm: randomUUID(),
  cold: randomUUID(),
  review: randomUUID(),
};

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/omana-leads", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OMANA_INGEST_SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const common = {
  type: "ai-chatbot-enquiry",
  email: "",
  plotSize: "",
  page: `/phase-4-test/${runId}`,
  source: "ai-chatbot",
  consent: true,
  utmSource: "phase-4-test",
  utmMedium: "test",
  utmCampaign: "phase-4",
  utmTerm: "",
  utmContent: "",
  gclid: "",
  gbraid: "",
  wbraid: "",
  referrer: "",
};

const testCases = [
  {
    expected: "hot",
    initialIntent: "I want to buy a plot and schedule a site visit.",
    name: testNames[0],
    phone: "+12025550161",
    selectedProject: "Dholera Estate 3",
    selectedProjectSlug: "",
    requirement: "Residential plot for my family",
    budget: "INR 50 lakh",
    purchaseTimeline: "next month",
    idempotencyKey: ids.hot,
  },
  {
    expected: "warm",
    initialIntent: "I am comparing projects for a future purchase.",
    name: testNames[1],
    phone: "+12025550162",
    selectedProject: "Dholera residential projects",
    selectedProjectSlug: "",
    requirement: "Residential plot options",
    budget: "",
    purchaseTimeline: "six months",
    idempotencyKey: ids.warm,
  },
  {
    expected: "cold",
    initialIntent: "I only need information. I am not planning to purchase currently.",
    name: testNames[2],
    phone: "+12025550163",
    selectedProject: "Dholera information",
    selectedProjectSlug: "",
    requirement: "Information only",
    budget: "",
    purchaseTimeline: "",
    idempotencyKey: ids.cold,
  },
  {
    expected: "needs-review",
    initialIntent: "Please contact me.",
    name: testNames[3],
    phone: "+12025550164",
    selectedProject: "unknown",
    selectedProjectSlug: "",
    requirement: "unclear",
    budget: "",
    purchaseTimeline: "",
    idempotencyKey: ids.review,
  },
] as const;

async function removeFakeRecords() {
  await payload.delete({
    collection: "omana-enquiries",
    where: { name: { in: testNames } },
  });
  await payload.delete({
    collection: "omana-contact-messages",
    where: { name: { equals: testNames[5] } },
  });
}

try {
  const [existingLeads, existingContacts, activeSalespeople] = await Promise.all([
    payload.count({
      collection: "omana-enquiries",
      where: { idempotencyKey: { in: Object.values(ids) } },
    }),
    payload.count({
      collection: "omana-contact-messages",
      where: { name: { equals: testNames[5] } },
    }),
    payload.count({
      collection: "omana-salespeople",
      where: { active: { equals: true } },
    }),
  ]);
  assert.equal(existingLeads.totalDocs, 0, "Generated TEST lead IDs already exist");
  assert.equal(existingContacts.totalDocs, 0, "Generated TEST contact already exists");
  assert.equal(
    activeSalespeople.totalDocs,
    0,
    "The TEST database must have no active salespeople during qualification integration",
  );

  for (const testCase of testCases) {
    const response = await POST(request({ ...common, ...testCase }));
    const responseBody = await response.json();
    assert.equal(response.status, 201, JSON.stringify(responseBody));
    assert.deepEqual(responseBody, { success: true, duplicate: false });
  }

  const stored = await payload.find({
    collection: "omana-enquiries",
    depth: 0,
    pagination: false,
    where: { idempotencyKey: { in: Object.values(ids) } },
  });
  assert.equal(stored.docs.length, 4);
  for (const testCase of testCases) {
    const lead = stored.docs.find((doc) => doc.idempotencyKey === testCase.idempotencyKey);
    assert.ok(lead);
    assert.equal(lead.qualification, testCase.expected);
    assert.equal(lead.qualificationMode, "automatic");
    assert.equal(lead.qualificationVersion, "ask-omana-v1");
    assert.ok(lead.qualifiedAt);
    assert.ok((lead.qualificationReasons?.length || 0) > 0);
    assert.equal(lead.source, "ai-chatbot");
  }

  const hotLead = stored.docs.find((doc) => doc.idempotencyKey === ids.hot);
  assert.ok(hotLead);
  await payload.update({
    collection: "omana-enquiries",
    id: hotLead.id,
    data: { qualification: "warm" },
  });
  const manuallyChanged = await payload.findByID({
    collection: "omana-enquiries",
    id: hotLead.id,
    depth: 0,
  });
  assert.equal(manuallyChanged.qualification, "warm");
  assert.equal(manuallyChanged.qualificationMode, "manual");
  assert.equal(manuallyChanged.qualificationVersion, "manual");

  const duplicate = await POST(request({ ...common, ...testCases[0] }));
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), { success: true, duplicate: true });
  const afterDuplicate = await payload.findByID({
    collection: "omana-enquiries",
    id: hotLead.id,
    depth: 0,
  });
  assert.equal(afterDuplicate.qualification, "warm");
  assert.equal(afterDuplicate.qualificationMode, "manual");

  const duplicateCount = await payload.count({
    collection: "omana-enquiries",
    where: { idempotencyKey: { equals: ids.hot } },
  });
  assert.equal(duplicateCount.totalDocs, 1);

  const invalid = await POST(request({
    ...common,
    ...testCases[0],
    phone: "12",
    idempotencyKey: randomUUID(),
  }));
  assert.equal(invalid.status, 400);

  const enquiry = await POST(request({
    type: "enquiry",
    name: testNames[4],
    email: `${runId}.enquiry@example.invalid`,
    phone: "+12025550165",
    selectedProject: "Test project",
    selectedProjectSlug: "test-project",
    message: "Compatibility test",
    page: `/phase-4-test/${runId}`,
    source: "omana-website",
    consent: true,
  }));
  assert.equal(enquiry.status, 201);

  const contact = await POST(request({
    type: "contact",
    name: testNames[5],
    email: `${runId}.contact@example.invalid`,
    phone: "+12025550166",
    selectedProject: "Test project",
    selectedProjectSlug: "test-project",
    message: "Compatibility test",
    page: "/contact",
    source: "omana-contact-page",
    consent: true,
  }));
  assert.equal(contact.status, 201);

  console.log(`Phase 4 integration: PASS (${databaseName})`);
  console.log("Qualifications stored: HOT, WARM, COLD, NEEDS-REVIEW");
  console.log("Duplicate created second lead: no");
  console.log("Manual override preserved after duplicate: yes");
  console.log("Invalid lead rejected: yes");
  console.log("Existing enquiry/contact APIs: PASS");
} finally {
  try {
    await removeFakeRecords();
    const remaining = await payload.count({
      collection: "omana-enquiries",
      where: { name: { in: testNames } },
    });
    const remainingContacts = await payload.count({
      collection: "omana-contact-messages",
      where: { name: { equals: testNames[5] } },
    });
    assert.equal(
      remaining.totalDocs + remainingContacts.totalDocs,
      0,
      "Qualification integration TEST records remain after cleanup",
    );
    console.log("Fake test records remaining: 0");
  } finally {
    if (payload.db.destroy) await payload.db.destroy();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => undefined);
    }
  }
}
