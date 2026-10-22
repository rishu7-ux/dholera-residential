import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

import { validateMongoCrmTestWriterTarget } from "../../lib/mongodb-crm-test-writer-target.ts";
import { CRM_LEGACY_COLLECTIONS, isRunMarkedSyntheticLegacy, legacyCollectionForForm, type CrmLegacyCollection } from "./crm-legacy-fixtures.ts";

const testEnv = parseEnv(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../.env.test.local"), "utf8"));
assert.equal(
  process.env.NOIDA_TEST_DB_WRITE_APPROVAL,
  "APPROVE_NOIDA_SYNTHETIC_CRM_WRITES",
  "Explicit one-run TEST database write approval is required",
);
assert.notEqual(
  process.env.CRM_KEEP_TEST_FIXTURES,
  "1",
  "CRM fixtures must be cleaned after the approved integration run",
);
const { uri: testUri, databaseName, hostname } = validateMongoCrmTestWriterTarget(
  testEnv.MONGODB_CRM_TEST_WRITER_URI,
  testEnv.MONGODB_TEST_URI,
  testEnv.MONGODB_RESTORE_TEST_URI,
  process.env.MONGODB_URI,
);
const mongoUri = new URL(testUri);
mongoUri.searchParams.set("readPreference", "primary");
process.env.MONGODB_TEST_URI = testUri;
process.env.MONGODB_URI = mongoUri.toString();
process.env.PAYLOAD_SECRET = randomBytes(32).toString("hex");
process.env.OMANA_INGEST_SECRET = randomBytes(32).toString("hex");
process.env.ESTATE1_INGEST_SECRET = randomBytes(32).toString("hex");
process.env.ESTATE2_INGEST_SECRET = randomBytes(32).toString("hex");
process.env.DHOLERA_ESTATES_INGEST_SECRET = randomBytes(32).toString("hex");
process.env.INDUSTRIAL_INGEST_SECRET = randomBytes(32).toString("hex");

const mongoose = (await import("mongoose")).default;
await mongoose.connect(mongoUri.toString(), { serverSelectionTimeoutMS: 15_000 });
await mongoose.connection.db?.admin().command({ ping: 1 });
assert.equal(mongoose.connection.db?.databaseName, databaseName);
assert.equal(new URL(mongoUri).hostname, hostname);

const { getPayload } = await import("payload");
const { default: config } = await import("../../payload.config.ts");
const { ingestCentralLead } = await import("../../lib/crm/ingest.ts");
const { POST: postOmanaLead } = await import("../../app/api/omana-leads/route.ts");
const { POST: postEstate1Lead } = await import("../../app/api/estate1-leads/route.ts");
const { POST: postEstate2Lead } = await import("../../app/api/estate2-leads/route.ts");
const { POST: postDholeraEstatesLead } = await import("../../app/api/dholera-estates-leads/route.ts");
const { POST: postIndustrialLead } = await import("../../app/api/industrial-leads/route.ts");
type CentralLeadInput = import("../../lib/crm/ingest.ts").CentralLeadInput;
type TestLead = CentralLeadInput & { id: string };
const payload = await getPayload({ config });
const db = mongoose.connection.db;
assert.ok(db, "Payload's isolated MongoDB connection is available");
await db.admin().command({ ping: 1 });
assert.equal(db.databaseName, databaseName);
assert.equal(new URL(mongoUri).hostname, hostname);
const runId = randomUUID();
const marker = `crm-test-${runId}`;
const createdUsers: string[] = [];
const createdLegacyIds: Array<{ collection: CrmLegacyCollection; id: string; email: string; source: string }> = [];
const createdLeadIds: string[] = [];
let officeId = "";
let teamId = "";
let testPassword = "";
let ownsOffice = false;
let ownsTeam = false;
let existingUserSnapshots: Array<Record<string, unknown>> = [];
let baselineCounter: Record<string, unknown> | null = null;
let baselineSequence = 0;

async function trackLegacyRecord(collection: CrmLegacyCollection, email: string, source: string, id?: string) {
  const filter = id ? { _id: new mongoose.Types.ObjectId(id) } : { email, source };
  const records = await db.collection(collection).find(filter).project({ _id: 1, email: 1, name: 1, source: 1 }).toArray();
  assert.equal(records.length, 1, `${collection} contains exactly one matching synthetic legacy record`);
  const record = records[0];
  assert.equal(record.email, email, `${collection} legacy email matches the submitted fixture`);
  assert.equal(record.source, source, `${collection} legacy source matches the submitted fixture`);
  assert.ok(isRunMarkedSyntheticLegacy(record, runId), `${collection} legacy record belongs to this synthetic run`);
  createdLegacyIds.push({ collection, id: String(record._id), email, source });
}

async function cleanup() {
  if (db) {
    const leadObjectIds = createdLeadIds.map((id) => new mongoose.Types.ObjectId(id));
    if (leadObjectIds.length) {
      await db.collection("crm-activities").deleteMany({ lead: { $in: leadObjectIds } });
      await db.collection("central-leads").deleteMany({ _id: { $in: leadObjectIds } });
    }
    for (const item of createdLegacyIds) {
      const filter = { _id: new mongoose.Types.ObjectId(item.id), email: item.email, source: item.source };
      const record = await db.collection(item.collection).findOne(filter);
      if (!record) continue;
      assert.ok(isRunMarkedSyntheticLegacy(record, runId), "tracked legacy record still has this run's synthetic identity");
      assert.equal((await db.collection(item.collection).deleteOne(filter)).deletedCount, 1);
    }
    // A route can create its legacy record before a later assertion fails and tracking runs.
    // Sweep only records with this run's unique email prefix, after checking each identity.
    for (const collection of CRM_LEGACY_COLLECTIONS) {
      const candidates = await db.collection(collection).find({ email: { $regex: `^${runId}\\.` } }).toArray();
      for (const record of candidates) {
        assert.ok(isRunMarkedSyntheticLegacy(record, runId), `${collection} cleanup candidate is synthetic`);
        const filter = { _id: record._id, email: record.email, source: record.source };
        assert.equal((await db.collection(collection).deleteOne(filter)).deletedCount, 1);
      }
    }
    if (ownsTeam && teamId) await db.collection("crm-teams").deleteOne({ _id: new mongoose.Types.ObjectId(teamId) });
    if (createdUsers.length) await db.collection("users").deleteMany({ _id: { $in: createdUsers.map((id) => new mongoose.Types.ObjectId(id)) } });
    if (existingUserSnapshots.length) {
      for (const user of existingUserSnapshots) {
        await db.collection("users").replaceOne({ _id: new mongoose.Types.ObjectId(String(user._id)) }, user);
      }
    }
    if (officeId && baselineCounter) {
      await db.collection("crm-assignment-counters").replaceOne({ _id: new mongoose.Types.ObjectId(String(baselineCounter._id)) }, baselineCounter);
    }
    if (ownsOffice && officeId) {
      const officeObjectId = new mongoose.Types.ObjectId(officeId);
      await db.collection("crm-assignment-counters").deleteMany({ office: officeObjectId });
      await db.collection("crm-offices").deleteOne({ _id: officeObjectId });
    }
    const leftovers = await Promise.all([
      db.collection("crm-activities").countDocuments({ lead: { $in: leadObjectIds } }),
      db.collection("central-leads").countDocuments({ _id: { $in: leadObjectIds } }),
      ownsTeam && teamId ? db.collection("crm-teams").countDocuments({ _id: new mongoose.Types.ObjectId(teamId) }) : Promise.resolve(0),
      ownsOffice && officeId ? db.collection("crm-offices").countDocuments({ _id: new mongoose.Types.ObjectId(officeId) }) : Promise.resolve(0),
      db.collection("users").countDocuments({ _id: { $in: createdUsers.map((id) => new mongoose.Types.ObjectId(id)) } }),
    ]);
    assert.deepEqual(leftovers, [0, 0, 0, 0, 0], "all records created by this synthetic run are removed from TEST");
    for (const collection of CRM_LEGACY_COLLECTIONS) {
      assert.equal(await db.collection(collection).countDocuments({ email: { $regex: `^${runId}\\.` } }), 0,
        `${collection} has zero legacy records for this run`);
    }
    if (existingUserSnapshots.length && officeId) {
      const officeObjectId = new mongoose.Types.ObjectId(officeId);
      const [retainedLeadCount, retainedCounter] = await Promise.all([
        db.collection("central-leads").countDocuments({ office: officeObjectId }),
        db.collection("crm-assignment-counters").findOne({ office: officeObjectId, key: "noida-shared-lead-round-robin" }),
      ]);
      assert.equal(retainedLeadCount, 30, "pre-existing synthetic leads are preserved");
      assert.equal(Number(retainedCounter?.sequence || 0), baselineSequence, "pre-existing rotation state is restored");
    }
  }
}

try {
  const existingOffice = await db.collection("crm-offices").findOne({ code: "noida" });
  const existingRunRecords = await Promise.all([
    db.collection("users").countDocuments({ email: { $regex: `^${runId}\\.` } }),
    db.collection("central-leads").countDocuments({ idempotencyKey: { $regex: `^${runId}` } }),
  ]);
  assert.deepEqual(existingRunRecords, [0, 0], "this run's synthetic identifiers are unique");

  const existingStaff = existingOffice
    ? await db.collection("users").find({ office: existingOffice._id, role: { $in: ["salesperson", "team-leader"] } }).sort({ role: 1, rotationOrder: 1 }).toArray()
    : [];
  const existingOfficeLeads = existingOffice
    ? await db.collection("central-leads").find({ office: existingOffice._id }).project({ email: 1, page: 1 }).toArray()
    : [];
  const existingTeam = existingOffice ? await db.collection("crm-teams").findOne({ office: existingOffice._id }) : null;
  if (existingOffice) {
    assert.equal(existingStaff.length, 11, "pre-existing Noida test office has exactly eleven synthetic staff fixtures");
    assert.ok(existingStaff.every((user) => String(user.email).endsWith(".invalid")), "all pre-existing test identities are synthetic .invalid accounts");
    assert.equal(existingStaff.filter((user) => user.role === "salesperson").length, 10);
    assert.equal(existingStaff.filter((user) => user.role === "team-leader").length, 1);
    assert.equal(existingOfficeLeads.length, 30, "pre-existing Noida test leads are isolated synthetic fixtures");
    assert.ok(existingOfficeLeads.every((lead) => lead.page === "/crm-integration-test" && String(lead.email).endsWith(".invalid")));
    assert.ok(existingTeam && String(existingTeam.name).startsWith("crm-test-"), "the test office's existing team is synthetic");
    existingUserSnapshots = existingStaff as Array<Record<string, unknown>>;
    baselineCounter = await db.collection("crm-assignment-counters").findOne({ key: "noida-shared-lead-round-robin", office: existingOffice._id });
    baselineSequence = Number(baselineCounter?.sequence || 0);
  }

  const rollbackKey = randomUUID();
  await assert.rejects(() => ingestCentralLead({
    name: `${marker} Rollback Fault`, email: `${runId}.rollback@example.invalid`, phone: "+919800000098",
    website: "omana-projects", leadType: "enquiry", source: "omana-test-rollback", project: "Synthetic",
    consent: true, idempotencyKey: rollbackKey,
  }, { afterRotation: () => { throw new Error("synthetic post-rotation database failure"); } }));
  const rolledBackCounter = await db.collection("crm-assignment-counters").findOne({ key: "noida-shared-lead-round-robin", ...(existingOffice ? { office: existingOffice._id } : {}) });
  assert.equal(Number(rolledBackCounter?.sequence || 0), baselineSequence, "a failure after sequence reservation rolls back the counter");
  assert.equal(await db.collection("central-leads").countDocuments({ idempotencyKey: rollbackKey }), 0, "failed transaction leaves no lead");

  testPassword = randomBytes(36).toString("base64url");
  let office: { id: string };
  let teamLeader: { id: string; email: string; role?: string };
  let salespeople: Array<{ id: string; email: string; role?: string }>;

  if (existingOffice && existingTeam) {
    office = await payload.findByID({ collection: "crm-offices", id: String(existingOffice._id), overrideAccess: true });
    officeId = String(office.id);
    teamId = String(existingTeam._id);
    ownsOffice = false;
    ownsTeam = false;
    const salespersonDocs = existingStaff.filter((user) => user.role === "salesperson");
    const leaderDoc = existingStaff.find((user) => user.role === "team-leader");
    assert.ok(leaderDoc);
    teamLeader = await payload.findByID({ collection: "users", id: String(leaderDoc._id), overrideAccess: true });
    salespeople = await Promise.all(salespersonDocs.map(async (user) => {
      const doc = await payload.findByID({ collection: "users", id: String(user._id), overrideAccess: true });
      await payload.update({ collection: "users", id: doc.id, data: { password: testPassword }, overrideAccess: true });
      return doc as typeof doc & { email: string; role?: string };
    }));
    await payload.update({ collection: "users", id: teamLeader.id, data: { password: testPassword }, overrideAccess: true });
  } else {
    assert.equal(await db.collection("crm-offices").countDocuments({ code: "noida" }), 0, "no existing office is present before test provisioning");
    const createdOffice = await payload.create({
      collection: "crm-offices",
      data: { name: `Noida ${marker}`, code: "noida", active: true },
      overrideAccess: true,
    });
    office = createdOffice;
    officeId = String(createdOffice.id);
    ownsOffice = true;
    await payload.update({ collection: "crm-offices", id: createdOffice.id, data: { name: "Noida" }, overrideAccess: true });

  await assert.rejects(() => payload.create({
    collection: "users",
    data: { email: `${runId}.anonymous@example.invalid`, password: testPassword, name: `${marker} Anonymous`, role: "super-admin", active: true, eligibleForAssignment: false },
    draft: false,
    overrideAccess: false,
  }));
  teamLeader = await payload.create({
    collection: "users",
    data: { email: `${runId}.leader@example.invalid`, password: testPassword, name: `${marker} Team Leader`, role: "team-leader", office: office.id, active: true, eligibleForAssignment: false },
    draft: false,
    overrideAccess: true,
  });
  createdUsers.push(String(teamLeader.id));
  salespeople = [];
  for (let index = 1; index <= 10; index += 1) {
    const person = await payload.create({
      collection: "users",
      data: {
        email: `${runId}.sales${String(index).padStart(2, "0")}@example.invalid`,
        password: testPassword,
        name: `${marker} Salesperson ${String(index).padStart(2, "0")}`,
        role: "salesperson",
        office: office.id,
        active: true,
        eligibleForAssignment: true,
        rotationOrder: index,
      },
      draft: false,
      overrideAccess: true,
    });
    createdUsers.push(String(person.id));
    salespeople.push(person as typeof person & { email: string; role?: string });
  }
  const team = await payload.create({
    collection: "crm-teams",
    data: { name: marker, office: office.id, teamLeader: teamLeader.id, salespeople: salespeople.map(({ id }) => String(id)), active: true },
    overrideAccess: true,
  });
  teamId = String(team.id);
  ownsTeam = true;
  await Promise.all(salespeople.map(({ id }) => payload.update({ collection: "users", id, data: { team: team.id }, overrideAccess: true })));
  await payload.update({ collection: "crm-teams", id: team.id, data: { salespeople: salespeople.map(({ id }) => String(id)) }, overrideAccess: true });
  }

  const submissions: TestLead[] = [];
  for (let index = 0; index < 30; index += 1) {
    const websites = ["omana-projects", "dholera-estate-1", "dholera-estate-2", "dholeraestates", "dholeraindustrial"] as const;
    const types = ["enquiry", "contact", "google-ads", "chatbot"] as const;
    const input = {
      name: `${marker} Lead ${index + 1}`,
      email: `${runId}.lead${index + 1}@example.invalid`,
      phone: `+9198765${String(index).padStart(5, "0")}`,
      website: websites[index % websites.length],
      leadType: types[index % types.length],
      source: `${websites[index % websites.length]}-synthetic-${index + 1}`,
      project: `Synthetic project ${index % 3 + 1}`,
      message: "Synthetic CRM integration test record.",
      page: "/crm-integration-test",
      consent: true,
      idempotencyKey: randomUUID(),
      legacyCollection: "crm-integration-test",
      legacyId: `${marker}-${index + 1}`,
    };
    const result = await ingestCentralLead(input);
    assert.equal(result.duplicate, false);
    submissions.push({ ...input, id: result.id });
    createdLeadIds.push(result.id);
  }

  const expected = Array.from({ length: 30 }, (_, index) => String(salespeople[(baselineSequence + index) % 10].id));
  const assigned = [];
  for (const submission of submissions) {
    const lead = await payload.findByID({ collection: "central-leads", id: submission.id, depth: 0, overrideAccess: true });
    assigned.push(String(lead.assignedSalesperson));
  }
  assert.deepEqual(assigned, expected, "30 mixed-source leads follow exact 1-to-10 rotation three times");

  const salespersonLoginUsers: Array<{ id: string; role?: string }> = [];
  for (let index = 0; index < 10; index += 1) {
    const login = await payload.login({ collection: "users", data: { email: salespeople[index].email, password: testPassword } });
    assert.ok(login.user);
    salespersonLoginUsers.push(login.user);
    assert.equal(String(login.user.id), String(salespeople[index].id), `salesperson ${index + 1} can sign in independently`);
    assert.equal(login.user.role, "salesperson");
  }
  const leaderLogin = await payload.login({ collection: "users", data: { email: teamLeader.email, password: testPassword } });
  assert.ok(leaderLogin.user);
  assert.equal(leaderLogin.user.role, "team-leader", "team leader can sign in");
  await assert.rejects(() => payload.login({ collection: "users", data: { email: salespeople[0].email, password: "incorrect-password" } }));

  const resetToken = await payload.forgotPassword({
    collection: "users",
    data: { email: salespeople[9].email },
    disableEmail: true,
    overrideAccess: true,
  });
  assert.ok(resetToken, "Payload generates a setup token without attempting to send email in this test");
  const resetState = await db.collection("users").findOne(
    { _id: new mongoose.Types.ObjectId(String(salespeople[9].id)) },
    { projection: { resetPasswordExpiration: 1 } },
  );
  const expiresAt = new Date(String(resetState?.resetPasswordExpiration)).getTime();
  const remainingLifetime = expiresAt - Date.now();
  assert.ok(remainingLifetime > 0 && remainingLifetime <= 30 * 60 * 1000, "Payload staff setup tokens expire within 30 minutes");
  const resetPassword = randomBytes(36).toString("base64url");
  const resetResult = await payload.resetPassword({
    collection: "users",
    data: { token: resetToken, password: resetPassword },
    overrideAccess: true,
  });
  assert.ok(resetResult.user, "the valid setup link sets a password once");
  await assert.rejects(() => payload.resetPassword({
    collection: "users",
    data: { token: resetToken, password: randomBytes(36).toString("base64url") },
    overrideAccess: true,
  }), "a consumed setup link cannot be replayed");

  const salespersonView = await payload.find({ collection: "central-leads", where: { and: [{ assignedSalesperson: { equals: salespeople[0].id } }, { email: { like: runId } }] }, user: salespeople[0], overrideAccess: false, limit: 100, depth: 0 });
  assert.equal(salespersonView.totalDocs, 3, "salesperson sees only personally assigned leads");
  const leaderView = await payload.find({ collection: "central-leads", where: { and: [{ office: { equals: office.id } }, { email: { like: runId } }] }, user: teamLeader, overrideAccess: false, limit: 100, depth: 0 });
  assert.equal(leaderView.totalDocs, 30, "team leader sees all ten salespeople's leads");
  const deniedForeignRecord = await payload.findByID({ collection: "central-leads", id: submissions[1].id, user: salespeople[0], overrideAccess: false, depth: 0 }).then(() => false).catch(() => true);
  assert.equal(deniedForeignRecord, true, "direct access to another salesperson's record is denied");
  await assert.rejects(() => payload.create({
    collection: "blogs",
    data: { title: `${marker} Unauthorized Blog`, slug: `${runId}-unauthorized`, excerpt: "Synthetic", content: "Synthetic", status: "draft" },
    draft: true,
    user: salespeople[0],
    overrideAccess: false,
  }), "salespeople cannot create unrelated CMS content");
  await assert.rejects(() => payload.create({
    collection: "ai-knowledge",
    data: { title: `${marker} Unauthorized Knowledge`, site: "omana", category: "Synthetic", content: "Synthetic", published: false },
    user: salespeople[0],
    overrideAccess: false,
  }), "salespeople cannot change RAG knowledge");
  const legacyLead = await payload.create({ collection: "estate1-enquiries", data: { name: `${marker} Legacy`, email: `${runId}.legacy@example.invalid`, phone: "+919800000001", source: "estate1-popup-form", status: "new" }, overrideAccess: true });
  await trackLegacyRecord("estate1-enquiries", `${runId}.legacy@example.invalid`, "estate1-popup-form", String(legacyLead.id));
  await assert.rejects(() => payload.find({ collection: "estate1-enquiries", user: salespeople[0], overrideAccess: false, limit: 1 }));
  const superAdmin = await payload.create({ collection: "users", data: { email: `${runId}.admin@example.invalid`, password: testPassword, name: `${marker} Super Admin`, role: "super-admin", active: true, eligibleForAssignment: false }, draft: false, overrideAccess: true });
  createdUsers.push(String(superAdmin.id));
  const adminView = await payload.find({ collection: "central-leads", where: { email: { like: runId } }, user: superAdmin, overrideAccess: false, limit: 100, depth: 0 });
  assert.equal(adminView.totalDocs, 30, "Super Admin retains full central lead access");
  const legacyAdminView = await payload.find({ collection: "estate1-enquiries", where: { email: { equals: `${runId}.legacy@example.invalid` } }, user: superAdmin, overrideAccess: false, limit: 10 });
  assert.equal(legacyAdminView.totalDocs, 1, "Super Admin retains legacy lead access");
  await payload.update({ collection: "users", id: salespeople[0].id, data: { role: "super-admin" }, user: salespersonLoginUsers[0], overrideAccess: false });
  const protectedUser = await payload.findByID({ collection: "users", id: salespeople[0].id, overrideAccess: true });
  assert.equal(protectedUser.role, "salesperson", "a salesperson cannot elevate their role through the Users API");

  const statusLead = await payload.update({ collection: "central-leads", id: submissions[0].id, data: { status: "contacted", notes: "Synthetic follow-up note", nextFollowUpAt: new Date(Date.now() + 86_400_000).toISOString() }, overrideAccess: true });
  assert.equal(statusLead.status, "contacted");
  assert.ok(statusLead.consentRecordedAt, "consented leads store a server-side consent timestamp");
  assert.equal(statusLead.consentDisclosureVersion, `${submissions[0].website}:${submissions[0].source}:v1`, "consent evidence is tied to the source disclosure version");
  const activityCount = await db.collection("crm-activities").countDocuments({ lead: new mongoose.Types.ObjectId(submissions[0].id) });
  assert.equal(activityCount, 5, "created, assigned, status, note, and follow-up events are retained");

  const beforeRetry = await db.collection("crm-assignment-counters").findOne({ key: "noida-shared-lead-round-robin", office: new mongoose.Types.ObjectId(officeId) });
  const duplicate = await ingestCentralLead(submissions[0]);
  assert.equal(duplicate.duplicate, true, "retries with the same request key are duplicates");
  const afterRetry = await db.collection("crm-assignment-counters").findOne({ key: "noida-shared-lead-round-robin", office: new mongoose.Types.ObjectId(officeId) });
  assert.equal(afterRetry?.sequence, beforeRetry?.sequence, "duplicate retry consumes no assignment turn");

  const samePhoneInput = { ...submissions[0] };
  delete (samePhoneInput as Partial<TestLead>).id;
  const concurrentRetryKey = randomUUID();
  const retryInput = { ...samePhoneInput, idempotencyKey: concurrentRetryKey, name: `${marker} Concurrent Duplicate` };
  const retryPair = await Promise.all([ingestCentralLead(retryInput), ingestCentralLead(retryInput)]);
  const retryWinner = retryPair.find(({ duplicate: isDuplicate }) => !isDuplicate);
  assert.ok(retryWinner, "one concurrent idempotent request creates the lead");
  assert.equal(retryPair.filter(({ duplicate: isDuplicate }) => isDuplicate).length, 1, "the concurrent retry is recognized as duplicate");
  createdLeadIds.push(retryWinner.id);

  const samePhoneNewKey = await ingestCentralLead({ ...samePhoneInput, idempotencyKey: randomUUID(), name: `${marker} Legitimate Repeat Enquiry` });
  createdLeadIds.push(samePhoneNewKey.id);
  assert.equal(samePhoneNewKey.duplicate, false, "separate enquiries with the same phone are not merged");

  const next = await payload.findByID({ collection: "central-leads", id: samePhoneNewKey.id, depth: 0, overrideAccess: true });
  assert.equal(String(next.assignedSalesperson), String(salespeople[(baselineSequence + 31) % 10].id), "rotation persists across mixed forms and duplicate requests");

  const concurrentLeads = await Promise.all(Array.from({ length: 10 }, (_, index) => {
    const concurrentInput = { ...submissions[index] };
    delete (concurrentInput as Partial<TestLead>).id;
    return ingestCentralLead({
    ...concurrentInput,
    idempotencyKey: randomUUID(),
    name: `${marker} Concurrent ${index + 1}`,
    });
  }));
  createdLeadIds.push(...concurrentLeads.map(({ id }) => id));
  assert.equal(new Set(concurrentLeads.map(({ id }) => id)).size, 10, "concurrent requests create ten unique leads");
  const concurrentAssignments = await Promise.all(concurrentLeads.map(async ({ id }) => {
    const lead = await payload.findByID({ collection: "central-leads", id, depth: 0, overrideAccess: true });
    return String(lead.assignedSalesperson);
  }));
  assert.equal(new Set(concurrentAssignments).size, 10, "concurrent round robin allocates one turn to each active salesperson");

  await payload.update({ collection: "users", id: salespeople[1].id, data: { active: false }, overrideAccess: true });
  const skipLead = await ingestCentralLead({ ...samePhoneInput, idempotencyKey: randomUUID(), name: `${marker} Inactive Skip` });
  createdLeadIds.push(skipLead.id);
  const skipped = await payload.findByID({ collection: "central-leads", id: skipLead.id, depth: 0, overrideAccess: true });
  assert.notEqual(String(skipped.assignedSalesperson), String(salespeople[1].id), "inactive salesperson is skipped");

  await Promise.all(salespeople.map(({ id }) => payload.update({ collection: "users", id, data: { active: false }, overrideAccess: true })));
  const counterBeforeFallback = await db.collection("crm-assignment-counters").findOne({ key: "noida-shared-lead-round-robin", office: new mongoose.Types.ObjectId(officeId) });
  const fallback = await ingestCentralLead({ ...samePhoneInput, idempotencyKey: randomUUID(), name: `${marker} Unassigned Fallback` });
  createdLeadIds.push(fallback.id);
  assert.equal(fallback.assigned, false, "no eligible staff results in an unassigned lead");
  const counterAfterFallback = await db.collection("crm-assignment-counters").findOne({ key: "noida-shared-lead-round-robin", office: new mongoose.Types.ObjectId(officeId) });
  assert.equal(counterAfterFallback?.sequence, counterBeforeFallback?.sequence, "unassigned fallback does not advance the rotation");

  await Promise.all(salespeople.map(({ id }) => payload.update({ collection: "users", id, data: { active: true }, overrideAccess: true })));
  const chatbotKey = randomUUID();
  const chatbotResponse = await postOmanaLead(new Request("http://localhost/api/omana-leads", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OMANA_INGEST_SECRET}`, "content-type": "application/json" },
    body: JSON.stringify({
      type: "ai-chatbot-enquiry", name: "Synthetic Consented Chatbot Enquiry", email: `${runId}.chatbot@example.invalid`,
      phone: "+919876599999", selectedProject: "Synthetic Noida project", requirement: "Synthetic test enquiry",
      page: "/crm-integration-test", source: "ai-chatbot", consent: true, idempotencyKey: chatbotKey,
    }),
  }));
  assert.equal(chatbotResponse.status, 201, "the authenticated ASK OMANA route accepts a consented synthetic chatbot lead");
  const chatbotLead = await db.collection("central-leads").findOne({ idempotencyKey: chatbotKey });
  assert.ok(chatbotLead, "ASK OMANA chatbot submission reaches the central lead collection");
  assert.equal(chatbotLead.website, "omana-projects");
  assert.equal(chatbotLead.leadType, "chatbot");
  assert.equal(chatbotLead.consent, true);
  assert.ok(chatbotLead.consentRecordedAt, "chatbot consent timestamp is recorded server-side");
  assert.equal(chatbotLead.consentDisclosureVersion, "omana-projects:ai-chatbot:v1");
  assert.equal(String(chatbotLead.assignedSalesperson), String(salespeople[(baselineSequence + 43) % 10].id), "chatbot submission uses the shared assignment sequence after 43 earlier test turns");
  createdLeadIds.push(String(chatbotLead._id));
  const chatbotLegacy = await db.collection("omana-enquiries").findOne({ idempotencyKey: chatbotKey });
  assert.ok(chatbotLegacy, "existing Omana chatbot lead collection remains populated for compatibility");
  await trackLegacyRecord("omana-enquiries", `${runId}.chatbot@example.invalid`, "ai-chatbot", String(chatbotLegacy._id));

  const websiteForms: Array<{ label: string; website: string; source: string; consent: boolean; secret: string; post: (request: Request) => Promise<Response>; body: Record<string, unknown> }> = [
    ...(["omana-global-drawer", "omana-project-page"] as const).map((source) => ({
      label: source, website: "omana-projects", source, consent: true, secret: process.env.OMANA_INGEST_SECRET!, post: postOmanaLead,
      body: { type: "enquiry", name: "Synthetic Omana Enquiry", email: `${runId}.${source}@example.invalid`, phone: "9876500101", selectedProject: "Synthetic project", selectedProjectSlug: "synthetic-project", message: "Synthetic form verification", page: source === "omana-global-drawer" ? "/" : "/projects/synthetic-project", source, consent: true },
    })),
    { label: "omana-contact-page", website: "omana-projects", source: "omana-contact-page", consent: true, secret: process.env.OMANA_INGEST_SECRET!, post: postOmanaLead, body: { type: "contact", name: "Synthetic Omana Contact", email: `${runId}.omana-contact@example.invalid`, phone: "9876500102", selectedProject: "Synthetic project", selectedProjectSlug: "synthetic-project", message: "Synthetic form verification", page: "/contact", source: "omana-contact-page", consent: true } },
    { label: "google-ads-dholeraplots", website: "omana-projects", source: "google-ads-dholeraplots", consent: true, secret: process.env.OMANA_INGEST_SECRET!, post: postOmanaLead, body: { type: "google-ads-enquiry", name: "Synthetic Ads Contact", email: `${runId}.omana-ads@example.invalid`, phone: "9876500103", selectedProject: "Synthetic project", selectedProjectSlug: "synthetic-project", page: "/dholeraplots", source: "google-ads-dholeraplots", consent: true, utmSource: "synthetic" } },
    ...(["estate1-popup-form", "estate1-side-enquiry-form"] as const).map((source) => ({ label: source, website: "dholera-estate-1", source, consent: false, secret: process.env.ESTATE1_INGEST_SECRET!, post: postEstate1Lead, body: { type: "enquiry", name: "Synthetic Estate One", email: `${runId}.${source}@example.invalid`, phone: "9876500104", message: "Synthetic form verification", source } })),
    { label: "estate1-contact-us-page", website: "dholera-estate-1", source: "estate1-contact-us-page", consent: true, secret: process.env.ESTATE1_INGEST_SECRET!, post: postEstate1Lead, body: { type: "contact", name: "Synthetic Estate One Contact", email: `${runId}.estate1-contact@example.invalid`, phone: "9876500105", budget: "below-20-lakhs", comments: "Synthetic form verification", consent: true, source: "estate1-contact-us-page" } },
    ...(["estate2-popup-form", "estate2-side-enquiry-form"] as const).map((source) => ({ label: source, website: "dholera-estate-2", source, consent: false, secret: process.env.ESTATE2_INGEST_SECRET!, post: postEstate2Lead, body: { type: "enquiry", name: "Synthetic Estate Two", email: `${runId}.${source}@example.invalid`, phone: "9876500106", property: "Synthetic Estate 2 project", message: "Synthetic form verification", source } })),
    { label: "estate2-contact-us-page", website: "dholera-estate-2", source: "estate2-contact-us-page", consent: true, secret: process.env.ESTATE2_INGEST_SECRET!, post: postEstate2Lead, body: { type: "contact", name: "Synthetic Estate Two Contact", email: `${runId}.estate2-contact@example.invalid`, phone: "9876500107", propertyType: "dholera-estate-2", budget: "below-20-lakhs", comments: "Synthetic form verification", consent: true, source: "estate2-contact-us-page" } },
    ...(["dholeraestates-popup-form", "dholeraestates-side-enquiry-form", "dholeraestates-website"] as const).map((source) => ({ label: source, website: "dholeraestates", source, consent: false, secret: process.env.DHOLERA_ESTATES_INGEST_SECRET!, post: postDholeraEstatesLead, body: { type: "enquiry", name: "Synthetic Dholera Estates", email: `${runId}.${source}@example.invalid`, phone: "9876500108", property: "Synthetic Dholera project", message: "Synthetic form verification", source } })),
    { label: "dholeraestates-contact-us-page", website: "dholeraestates", source: "dholeraestates-contact-us-page", consent: true, secret: process.env.DHOLERA_ESTATES_INGEST_SECRET!, post: postDholeraEstatesLead, body: { type: "contact", name: "Synthetic Dholera Estates Contact", email: `${runId}.estates-contact@example.invalid`, phone: "9876500109", propertyType: "dholera-estates", budget: "below-20-lakhs", comments: "Synthetic form verification", consent: true, source: "dholeraestates-contact-us-page" } },
    ...(["industrial-popup-form", "industrial-side-enquiry-form", "industrial-property-card", "industrial-website"] as const).map((source) => ({ label: source, website: "dholeraindustrial", source, consent: false, secret: process.env.INDUSTRIAL_INGEST_SECRET!, post: postIndustrialLead, body: { type: "enquiry", name: "Synthetic Industrial Enquiry", email: `${runId}.${source}@example.invalid`, phone: "9876500110", property: "Synthetic industrial project", message: "Synthetic form verification", source } })),
    { label: "industrial-contact-us-page", website: "dholeraindustrial", source: "industrial-contact-us-page", consent: true, secret: process.env.INDUSTRIAL_INGEST_SECRET!, post: postIndustrialLead, body: { type: "contact", name: "Synthetic Industrial Contact", email: `${runId}.industrial-contact@example.invalid`, phone: "9876500111", propertyType: "industrial-plot", budget: "below-25-lakhs", comments: "Synthetic form verification", consent: true, source: "industrial-contact-us-page" } },
  ];
  for (const [index, form] of websiteForms.entries()) {
    const key = randomUUID();
    const response = await form.post(new Request("http://localhost/api/website-lead-test", {
      method: "POST",
      headers: { authorization: `Bearer ${form.secret}`, "content-type": "application/json", "x-idempotency-key": key },
      body: JSON.stringify(form.body),
    }));
    assert.equal(response.status, 201, `${form.label} form route accepted its synthetic isolated submission`);
    const lead: {
      _id: { toString: () => string };
      website: string;
      source: string;
      consent: boolean;
      consentRecordedAt?: Date | string;
      consentDisclosureVersion?: string;
      assignedSalesperson?: { toString: () => string } | string;
      legacyCollection?: string;
      legacyId?: string;
    } | null = await db.collection("central-leads").findOne({ idempotencyKey: key }) as {
      _id: { toString: () => string };
      website: string;
      source: string;
      consent: boolean;
      consentRecordedAt?: Date | string;
      consentDisclosureVersion?: string;
      assignedSalesperson?: { toString: () => string } | string;
      legacyCollection?: string;
      legacyId?: string;
    } | null;
    assert.ok(lead, `${form.label} created a central lead`);
    assert.equal(lead.website, form.website, `${form.label} retained the website source`);
    assert.equal(lead.source, form.source, `${form.label} retained the form source`);
    assert.equal(lead.consent, form.consent, `${form.label} retained submitted consent behavior`);
    assert.equal(Boolean(lead.consentRecordedAt), form.consent, `${form.label} consent timestamp matches its explicit consent value`);
    assert.equal(Boolean(lead.consentDisclosureVersion), form.consent, `${form.label} disclosure version matches its explicit consent value`);
    assert.equal(String(lead.assignedSalesperson), String(salespeople[(baselineSequence + 44 + index) % 10].id), `${form.label} used the shared round-robin sequence`);
    createdLeadIds.push(String(lead._id));
    const expectedLegacyCollection = legacyCollectionForForm(form.website, String(form.body.type));
    if (lead.legacyCollection && lead.legacyId) {
      assert.equal(lead.legacyCollection, expectedLegacyCollection, `${form.label} references the expected legacy collection`);
      await trackLegacyRecord(expectedLegacyCollection, String(form.body.email), form.source, String(lead.legacyId));
    } else {
      assert.equal(form.website, "omana-projects", `${form.label} must provide central legacy metadata`);
      await trackLegacyRecord(expectedLegacyCollection, String(form.body.email), form.source);
    }
  }

  assert.equal(createdLegacyIds.length, websiteForms.length + 2, "all route, chatbot, and RBAC legacy fixtures are tracked");

  console.log(JSON.stringify({ result: "PASS", database: databaseName, host: hostname, createdTestLeads: createdLeadIds.length, syntheticSalespeople: salespeople.length, sequence: "1-10 repeated three times", duplicateRetry: "PASS", samePhoneDistinctLead: "PASS", inactiveSkip: "PASS", unassignedFallback: "PASS", chatbotConsentAndSharedAssignment: "PASS", setupTokenExpiry: "PASS (30 minutes maximum)", setupTokenReplay: "PASS (single-use)", individualWebsiteFormRoutes: websiteForms.length, productionUntouched: true }));
} finally {
  await cleanup();
  try {
    await payload.destroy();
  } finally {
    await mongoose.disconnect();
  }
}
