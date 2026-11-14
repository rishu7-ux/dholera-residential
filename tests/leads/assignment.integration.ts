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

// Load the TEST URI directly from .env.test.local. Payload and the assignment
// helper read MONGODB_URI, so replace any inherited value before importing them.
process.env.MONGODB_TEST_URI = validatedTestUri;
process.env.MONGODB_URI = isolatedTestUri;
process.env.PAYLOAD_SECRET = randomBytes(32).toString("hex");
process.env.OMANA_INGEST_SECRET = randomBytes(32).toString("hex");

const mongoose = (await import("mongoose")).default;

function mongoDatabase() {
  if (!mongoose.connection.db) throw new Error("MongoDB database handle is unavailable");
  return mongoose.connection.db;
}

await mongoose.connect(isolatedTestUri, { serverSelectionTimeoutMS: 15_000 });
await mongoDatabase().admin().command({ ping: 1 });
await mongoose.disconnect();

const { getPayload } = await import("payload");
const { default: config } = await import("../../payload.config.ts");
const { POST } = await import("../../app/api/omana-leads/route.ts");
const {
  getOrCreateSalespersonAssignment,
  withAssignmentCounterScope,
} = await import("../../lib/leads/salespersonAssignment.ts");
const payload = await getPayload({ config });

const runId = randomUUID();
const marker = `phase5-integration-${runId}`;
const testPage = `/phase-5-integration-test/${runId}`;
const assignmentCounterScope = {
  key: `omana-phase5-test-${runId}`,
  runId,
};
const salespersonInputs = [
  { name: `${marker} Salesperson 1`, email: `${runId}.sales1@example.invalid`, phone: "+10000000001" },
  { name: `${marker} Salesperson 2`, email: `${runId}.sales2@example.invalid`, phone: "+10000000002" },
  { name: `${marker} Salesperson 3`, email: `${runId}.sales3@example.invalid`, phone: "+10000000003" },
];
const createdSalespersonIds: string[] = [];
const createdLeadIds: string[] = [];
const syntheticClaimLeadIds = [`${marker}-concurrent`];
const idempotencyKeys = Array.from({ length: 5 }, () => randomUUID());
const testIdempotencyKeys = new Set(idempotencyKeys);
const salespersonEmails = salespersonInputs.map((person) => person.email);
const syntheticPhone = () => {
  const suffix = randomBytes(4).readUInt32BE(0) % 1_000_000_000;
  return `+916${String(suffix).padStart(9, "0")}`;
};
const leadPhones = Array.from({ length: 5 }, syntheticPhone);

function leadBody(index: number) {
  const leadLetter = ["A", "B", "C", "D"][index] || "E";
  return {
    type: "ai-chatbot-enquiry",
    initialIntent: "I want to buy a plot and schedule a site visit.",
    name: `Phase Five Lead ${leadLetter}`,
    email: `${runId}.lead${index + 1}@example.invalid`,
    phone: leadPhones[index] || syntheticPhone(),
    selectedProject: "Dholera Estate 3",
    selectedProjectSlug: "",
    requirement: "A plot for a future warehouse",
    plotSize: "2000 sq yd",
    budget: "INR 50 lakh",
    purchaseTimeline: "next month",
    page: testPage,
    source: "ai-chatbot",
    consent: true,
    idempotencyKey: idempotencyKeys[index],
    emailOptIn: false,
  };
}

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

async function recordCreatedLead(idempotencyKey: string) {
  const result = await payload.find({
    collection: "omana-enquiries",
    depth: 0,
    limit: 10,
    pagination: false,
    where: {
      and: [
        { idempotencyKey: { equals: idempotencyKey } },
        { source: { equals: "ai-chatbot" } },
        { page: { equals: testPage } },
      ],
    },
  });

  for (const lead of result.docs) {
    const id = String(lead.id);
    if (!createdLeadIds.includes(id)) createdLeadIds.push(id);
  }
}

async function postTestLead(body: ReturnType<typeof leadBody>) {
  testIdempotencyKeys.add(body.idempotencyKey);
  const response = await withAssignmentCounterScope(assignmentCounterScope, () =>
    POST(request(body)),
  );
  // Track a lead before any response assertion can fail. The fresh UUID,
  // source, and test page scope this lookup to records created by this run.
  await recordCreatedLead(body.idempotencyKey);
  return response;
}

async function assertNoTestDataCollisions() {
  assert.equal(new Set(leadPhones).size, leadPhones.length, "Generated test phones collided");

  const [existingEnquiries, existingSalespeople, existingActiveSalespeople] =
    await Promise.all([
      payload.find({
        collection: "omana-enquiries",
        depth: 0,
        limit: 1,
        pagination: false,
        where: {
          or: [
            { idempotencyKey: { in: [...testIdempotencyKeys] as never[] } },
            { phone: { in: leadPhones as never[] } },
            { page: { equals: testPage } },
          ],
        },
      }),
      payload.find({
        collection: "omana-salespeople",
        depth: 0,
        limit: 1,
        pagination: false,
        where: { email: { in: salespersonEmails as never[] } },
      }),
      payload.find({
        collection: "omana-salespeople",
        depth: 0,
        limit: 1,
        pagination: false,
        where: { active: { equals: true } },
      }),
    ]);

  assert.equal(existingEnquiries.docs.length, 0, "Generated TEST enquiry data already exists");
  assert.equal(existingSalespeople.docs.length, 0, "Generated TEST salesperson emails already exist");
  assert.equal(
    existingActiveSalespeople.docs.length,
    0,
    "The TEST database must have no active salespeople before this integration test",
  );

  await mongoose.connect(isolatedTestUri, { serverSelectionTimeoutMS: 15_000 });
  try {
    const counter = await mongoDatabase()
      .collection("omana_assignment_counters")
      .findOne({ key: assignmentCounterScope.key });
    const syntheticClaim = await mongoDatabase()
      .collection("omana_lead_assignment_claims")
      .findOne({ leadId: syntheticClaimLeadIds[0] });

    assert.equal(counter, null, "The unique TEST assignment counter key already exists");
    assert.equal(syntheticClaim, null, "The synthetic TEST claim key already exists");
  } finally {
    await mongoose.disconnect();
  }
}

async function recoverCreatedRecordIds() {
  const leads = await payload.find({
    collection: "omana-enquiries",
    depth: 0,
    limit: 1000,
    pagination: false,
    where: {
      and: [
        { idempotencyKey: { in: [...testIdempotencyKeys] as never[] } },
        { source: { equals: "ai-chatbot" } },
        { page: { equals: testPage } },
      ],
    },
  });
  for (const lead of leads.docs) {
    const id = String(lead.id);
    if (!createdLeadIds.includes(id)) createdLeadIds.push(id);
  }

  const salespeople = await payload.find({
    collection: "omana-salespeople",
    depth: 0,
    limit: 1000,
    pagination: false,
    where: { email: { in: salespersonEmails as never[] } },
  });
  for (const salesperson of salespeople.docs) {
    const id = String(salesperson.id);
    if (!createdSalespersonIds.includes(id)) createdSalespersonIds.push(id);
  }
}

async function removeTestRecords() {
  const failures: string[] = [];
  try {
    await recoverCreatedRecordIds();
  } catch {
    failures.push("could not recover IDs for this run's test records");
  }

  for (const id of createdLeadIds) {
    try {
      await payload.delete({ collection: "omana-enquiries", id });
    } catch {
      failures.push("could not delete a test lead");
    }
  }
  for (const id of createdSalespersonIds) {
    try {
      await payload.delete({ collection: "omana-salespeople", id });
    } catch {
      failures.push("could not delete a test salesperson");
    }
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(isolatedTestUri, { serverSelectionTimeoutMS: 15_000 });
    }
    await mongoDatabase()
      .collection("omana_lead_assignment_claims")
      .deleteMany({ leadId: { $in: [...createdLeadIds, ...syntheticClaimLeadIds] } });
    await mongoDatabase()
      .collection("omana_assignment_counters")
      .deleteOne({
        key: assignmentCounterScope.key,
        testRunId: assignmentCounterScope.runId,
      });
  } catch {
    failures.push("could not clean up synthetic assignment claims");
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {
        failures.push("could not close the TEST MongoDB connection");
      });
    }
  }

  if (failures.length > 0) {
    throw new Error(`Test cleanup incomplete: ${failures.join("; ")}`);
  }
}

let cleanupEnabled = false;
try {
  await assertNoTestDataCollisions();
  cleanupEnabled = true;
  const rotationOrders = [1, 2, 3];

  for (const [index, input] of salespersonInputs.entries()) {
    const salesperson = await payload.create({
      collection: "omana-salespeople",
      data: { ...input, active: true, rotationOrder: rotationOrders[index] },
    });
    createdSalespersonIds.push(String(salesperson.id));
  }

  const salespersonById = new Map(
    salespersonInputs.map((input, index) => [createdSalespersonIds[index], input.name]),
  );
  const activeRoster = await payload.find({
    collection: "omana-salespeople",
    depth: 0,
    limit: 1000,
    pagination: false,
    where: { active: { equals: true } },
  });
  assert.equal(
    activeRoster.docs.length,
    3,
    JSON.stringify({
      activeRoster: activeRoster.docs.map((person) => ({ id: person.id, name: person.name })),
      createdSalespersonIds,
    }),
  );

  for (let index = 0; index < 4; index += 1) {
    const response = await postTestLead(leadBody(index));
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.deepEqual(body, { success: true, duplicate: false });
  }

  const stored = await payload.find({
    collection: "omana-enquiries",
    depth: 0,
    pagination: false,
    where: {
      and: [
        { idempotencyKey: { in: idempotencyKeys as never[] } },
        { source: { equals: "ai-chatbot" } },
        { page: { equals: testPage } },
      ],
    },
  });
  assert.equal(stored.docs.length, 4);
  for (const lead of stored.docs) {
    const id = String(lead.id);
    if (!createdLeadIds.includes(id)) createdLeadIds.push(id);
  }
  const idempotencyKeyIndex = (value: string | null | undefined) =>
    idempotencyKeys.findIndex((key) => key === value);
  const assignedNames = stored.docs
    .sort((left, right) => idempotencyKeyIndex(left.idempotencyKey) - idempotencyKeyIndex(right.idempotencyKey))
    .map((lead) => salespersonById.get(String(lead.assignedSalesperson)));
  assert.deepEqual(
    assignedNames,
    salespersonInputs.map((input) => input.name).concat(salespersonInputs[0].name),
    JSON.stringify({
      assigned: stored.docs.map((lead) => lead.assignedSalesperson),
      expectedIds: createdSalespersonIds,
    }),
  );

  const duplicate = await postTestLead(leadBody(0));
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), { success: true, duplicate: true });
  const afterDuplicate = await payload.findByID({ collection: "omana-enquiries", id: createdLeadIds[0], depth: 0 });
  assert.equal(afterDuplicate.assignedSalesperson, createdSalespersonIds[0]);

  await payload.update({ collection: "omana-salespeople", id: createdSalespersonIds[1], data: { active: false } });
  const inactiveIdempotencyKey = idempotencyKeys[4]!;
  const inactiveLeadResponse = await postTestLead({
    ...leadBody(3),
    idempotencyKey: inactiveIdempotencyKey,
    name: "Phase Five Inactive Check",
    phone: leadPhones[4],
  });
  assert.equal(inactiveLeadResponse.status, 201);
  const inactiveLead = await payload.find({
    collection: "omana-enquiries",
    depth: 0,
    pagination: false,
    where: {
      and: [
        { idempotencyKey: { equals: inactiveIdempotencyKey } },
        { source: { equals: "ai-chatbot" } },
        { page: { equals: testPage } },
      ],
    },
  });
  assert.equal(inactiveLead.docs.length, 1);
  assert.notEqual(String(inactiveLead.docs[0].assignedSalesperson), createdSalespersonIds[1]);

  await payload.update({ collection: "omana-enquiries", id: createdLeadIds[0], data: { assignedSalesperson: createdSalespersonIds[2] } });
  const manualDuplicate = await postTestLead(leadBody(0));
  assert.equal(manualDuplicate.status, 200);
  const manualLead = await payload.findByID({ collection: "omana-enquiries", id: createdLeadIds[0], depth: 0 });
  assert.equal(String(manualLead.assignedSalesperson), createdSalespersonIds[2]);
  assert.equal(manualLead.assignmentMode, "manual");

  const concurrent = await withAssignmentCounterScope(assignmentCounterScope, () =>
    Promise.all(
      Array.from({ length: 10 }, () =>
        getOrCreateSalespersonAssignment(
          payload,
          syntheticClaimLeadIds[0],
          assignmentCounterScope,
        ),
      ),
    ),
  );
  assert.ok(concurrent.every((assignment) => assignment?.salespersonId === concurrent[0]?.salespersonId));
  assert.ok(concurrent.every((assignment) => assignment?.sequence === concurrent[0]?.sequence));

  console.log(JSON.stringify({ databaseName, roundRobin: "1 -> 2 -> 3 -> 1", duplicate: "PASS", inactive: "PASS", manualOverride: "PASS", concurrency: "PASS" }));
} finally {
  try {
    if (cleanupEnabled) {
      let cleanupFailure: Error | undefined;
      try {
        await removeTestRecords();
      } catch {
        cleanupFailure = new Error("Test cleanup was incomplete; inspect only the isolated TEST database");
      }

      const remainingLeads = await payload.count({
        collection: "omana-enquiries",
        where: {
          and: [
            { idempotencyKey: { in: [...testIdempotencyKeys] as never[] } },
            { source: { equals: "ai-chatbot" } },
            { page: { equals: testPage } },
          ],
        },
      });
      const remainingSalespeople = await payload.count({
        collection: "omana-salespeople",
        where: { email: { in: salespersonEmails as never[] } },
      });

      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(isolatedTestUri, { serverSelectionTimeoutMS: 15_000 });
      }
      const remainingClaims = await mongoDatabase()
        .collection("omana_lead_assignment_claims")
        .countDocuments({ leadId: { $in: [...createdLeadIds, ...syntheticClaimLeadIds] } });
      const remainingCounters = await mongoDatabase()
        .collection("omana_assignment_counters")
        .countDocuments({ key: assignmentCounterScope.key });

      assert.equal(remainingLeads.totalDocs, 0, "Test leads remain in the TEST database");
      assert.equal(remainingSalespeople.totalDocs, 0, "Test salespeople remain in the TEST database");
      assert.equal(remainingClaims, 0, "Synthetic assignment claims remain in the TEST database");
      assert.equal(remainingCounters, 0, "The run-specific assignment counter remains in the TEST database");
      assert.equal(cleanupFailure, undefined, cleanupFailure?.message);
      console.log(JSON.stringify({ testRecordsRemaining: 0, productionUntouched: true }));
    }
  } finally {
    if (payload.db.destroy) await payload.db.destroy();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => undefined);
    }
  }
}
