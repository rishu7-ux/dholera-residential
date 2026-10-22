import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

import connectDB from "../mongodb";

export type CentralLeadInput = {
  name: string;
  email?: string;
  phone: string;
  website: "omana-projects" | "dholera-estate-1" | "dholera-estate-2" | "dholeraestates" | "dholeraindustrial";
  leadType: "enquiry" | "contact" | "google-ads" | "chatbot";
  source: string;
  project?: string;
  message?: string;
  budget?: string;
  page?: string;
  consent: boolean;
  idempotencyKey?: string;
  attribution?: Record<string, unknown>;
  legacyCollection?: string;
  legacyId?: string | number;
};

const NOIDA_CODE = "noida";
const COUNTER_KEY = "noida-shared-lead-round-robin";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LEGACY_COLLECTIONS: Record<CentralLeadInput["website"], Partial<Record<CentralLeadInput["leadType"], string>>> = {
  "dholera-estate-1": { enquiry: "estate1-enquiries", contact: "estate1-contact-messages" },
  "dholera-estate-2": { enquiry: "estate2-enquiries", contact: "estate2-contact-messages" },
  dholeraestates: { enquiry: "dholera-estates-enquiries", contact: "dholera-estates-contact-messages" },
  dholeraindustrial: { enquiry: "industrial-enquiries", contact: "industrial-contact-messages" },
  "omana-projects": { enquiry: "omana-enquiries", contact: "omana-contact-messages", "google-ads": "omana-google-ads-enquiries", chatbot: "omana-enquiries" },
};

export type LegacyLeadWrite = { collection: string; data: Record<string, unknown> };
type IngestResult = { id: string; duplicate: boolean; assigned: boolean; legacyId?: string };
type CrmDb = NonNullable<typeof mongoose.connection.db>;
type ExistingLead = { _id: unknown; assignedSalesperson?: unknown; legacyCollection?: unknown; legacyId?: unknown; [field: string]: unknown };

export class LeadReconciliationRequiredError extends Error {
  constructor(public readonly centralId: string, public readonly collection: string) {
    super("Central lead has no matching legacy record; manual reconciliation required");
    this.name = "LeadReconciliationRequiredError";
  }
}

export class LegacyReconciliationRequiredError extends Error {
  constructor(public readonly legacyId: string, public readonly collection: string, public readonly idempotencyKey: string | undefined) {
    super("Legacy lead has no matching central record; manual reconciliation required");
    this.name = "LegacyReconciliationRequiredError";
  }
}

export class LeadIdempotencyConflictError extends Error {
  constructor(public readonly centralId: string) {
    super("Idempotency key is already associated with a different lead submission");
    this.name = "LeadIdempotencyConflictError";
  }
}

function validateLegacyWrite(input: CentralLeadInput, legacy: LegacyLeadWrite) {
  if (!input.idempotencyKey || !UUID_PATTERN.test(input.idempotencyKey)) {
    throw new Error("Atomic legacy ingestion requires a valid idempotency key");
  }
  if (input.legacyCollection || input.legacyId) throw new Error("Atomic legacy ingestion cannot reuse a legacy link");
  if (LEGACY_COLLECTIONS[input.website]?.[input.leadType] !== legacy.collection) {
    throw new Error("Legacy collection does not match the website and lead type");
  }
  if (!legacy.data || Object.getPrototypeOf(legacy.data) !== Object.prototype) {
    throw new Error("Legacy data must be a plain object");
  }
  for (const field of ["_id", "id", "createdAt", "updatedAt", "legacyCollection", "legacyId", "assignmentSequence", "assignedSalesperson"]) {
    if (Object.hasOwn(legacy.data, field)) throw new Error(`Legacy data cannot set ${field}`);
  }
  if (legacy.data.consent === false || (legacy.data.idempotencyKey && legacy.data.idempotencyKey !== input.idempotencyKey)) {
    throw new Error("Legacy consent or idempotency key does not match the central lead");
  }
  if (legacy.data.status !== undefined && legacy.data.status !== "new") throw new Error("Atomic legacy lead must start as new");
}

async function existingResult(existing: ExistingLead, db: CrmDb, input: CentralLeadInput, legacy?: LegacyLeadWrite): Promise<IngestResult> {
  const result: IngestResult = { id: String(existing._id), duplicate: true, assigned: Boolean(existing.assignedSalesperson) };
  if (!legacy) return result;
  for (const field of ["name", "email", "phone", "website", "leadType", "source", "project"] as const) {
    if (String(existing[field] ?? "") !== String(input[field] ?? "")) throw new LeadIdempotencyConflictError(result.id);
  }
  const id = existing.legacyId;
  if (existing.legacyCollection !== legacy.collection || !id) {
    throw new LeadReconciliationRequiredError(result.id, legacy.collection);
  }
  const legacyId = String(id);
  const mongoId = /^[0-9a-f]{24}$/i.test(legacyId) ? new mongoose.Types.ObjectId(legacyId) : id;
  const matchingLegacy = await db.collection(legacy.collection).findOne({ _id: mongoId }, { projection: { _id: 1 } });
  if (!matchingLegacy) throw new LeadReconciliationRequiredError(result.id, legacy.collection);
  return { ...result, legacyId };
}

async function assertAtomicIndexes(db: CrmDb) {
  const hasUnique = async (collection: string, fields: string[]) => {
    const indexes = await db.collection(collection).listIndexes().toArray();
    return indexes.some((index) => index.unique === true && !index.sparse && !index.partialFilterExpression &&
      Object.keys(index.key).length === fields.length &&
      fields.every((field) => index.key[field] === 1));
  };
  if (!await hasUnique("central-leads", ["idempotencyKey"])) {
    throw new Error("Atomic ingress requires the unique central idempotency index");
  }
  if (!await hasUnique("crm-assignment-counters", ["key", "office"])) {
    throw new Error("Atomic ingress requires the unique assignment-counter index");
  }
}

type IngestTestHooks = {
  /** Internal integration-test fault point. Never exposed by the HTTP APIs. */
  afterRotation?: () => void;
  beforeLegacyInsert?: () => void;
  beforeLeadInsert?: () => void;
  beforeActivityInsert?: () => void;
};

export async function ingestCentralLead(input: CentralLeadInput, testHooks: IngestTestHooks = {}) {
  return ingestCentralLeadInternal(input, testHooks);
}

/** Write the legacy lead, central lead, activities, and assignment advance in one MongoDB transaction. */
export async function ingestLeadWithLegacy(input: CentralLeadInput, legacy: LegacyLeadWrite, testHooks: IngestTestHooks = {}) {
  return ingestCentralLeadInternal(input, testHooks, legacy);
}

async function ingestCentralLeadInternal(input: CentralLeadInput, testHooks: IngestTestHooks, legacy?: LegacyLeadWrite): Promise<IngestResult> {
  if (input.consent !== true) throw new Error("CRM lead requires affirmative contact consent");
  if (legacy) validateLegacyWrite(input, legacy);
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("CRM database is unavailable");
  if (legacy) await assertAtomicIndexes(db);

  const idempotencyKey = input.idempotencyKey && UUID_PATTERN.test(input.idempotencyKey)
    ? input.idempotencyKey
    : randomUUID();
  const existing = await db.collection("central-leads").findOne({ idempotencyKey });
  if (existing) return existingResult(existing, db, input, legacy);

  const session = await mongoose.connection.startSession();
  try {
    let result: IngestResult | undefined;
    await session.withTransaction(async () => {
      const duplicate = await db.collection("central-leads").findOne({ idempotencyKey }, { session });
      if (duplicate) {
        result = await existingResult(duplicate, db, input, legacy);
        return;
      }

      const now = new Date();
      const legacyId = legacy ? new mongoose.Types.ObjectId() : undefined;
      if (legacy && legacyId) {
        testHooks.beforeLegacyInsert?.();
        await db.collection(legacy.collection).insertOne({
          _id: legacyId, ...Object.fromEntries(Object.entries(legacy.data).filter(([, value]) => value !== undefined)), status: "new",
          createdAt: now, updatedAt: now,
        }, { session });
      }

      // Establish the one shared Noida office lazily, so first leads remain accepted
      // before an administrator has completed staff provisioning.
      const officeResult = await db.collection("crm-offices").findOneAndUpdate(
        { code: NOIDA_CODE },
        { $setOnInsert: { _id: new mongoose.Types.ObjectId(), code: NOIDA_CODE, name: "Noida", active: true, createdAt: new Date(), updatedAt: new Date() } },
        { upsert: true, returnDocument: "after", session },
      );
      const office = officeResult;
      if (!office || office.active === false) throw new Error("Noida CRM office is inactive");

      const salespeople = await db.collection("users").find({
        role: "salesperson",
        office: office._id,
        active: true,
        eligibleForAssignment: true,
      }, { session }).sort({ rotationOrder: 1, email: 1, _id: 1 }).toArray();

      let salesperson = null;
      let sequence: number | undefined;
      if (salespeople.length > 0) {
        const counter = await db.collection("crm-assignment-counters").findOneAndUpdate(
          { key: COUNTER_KEY, office: office._id },
          { $inc: { sequence: 1 }, $setOnInsert: { createdAt: new Date() }, $set: { updatedAt: new Date() } },
          { upsert: true, returnDocument: "after", session },
        );
        sequence = Number(counter?.sequence || 1);
        salesperson = salespeople[(sequence - 1) % salespeople.length];
      }

      // Integration tests can inject a failure after the counter update and
      // before lead insertion to verify MongoDB rolls the entire unit back.
      testHooks.afterRotation?.();

      const leadId = new mongoose.Types.ObjectId();
      testHooks.beforeLeadInsert?.();
      await db.collection("central-leads").insertOne({
        _id: leadId,
        ...input,
        legacyCollection: legacy?.collection ?? input.legacyCollection,
        legacyId: legacyId ? String(legacyId) : input.legacyId,
        idempotencyKey,
        consentRecordedAt: input.consent ? now : undefined,
        consentDisclosureVersion: input.consent ? `${input.website}:${input.source}:v1` : undefined,
        office: office._id,
        team: salesperson?.team,
        assignedSalesperson: salesperson?._id,
        assignedAt: salesperson ? now : undefined,
        assignmentSequence: sequence,
        unassignedReason: salesperson ? undefined : "No active salesperson is configured for the Noida office.",
        status: "new",
        createdAt: now,
        updatedAt: now,
      }, { session });

      testHooks.beforeActivityInsert?.();
      await db.collection("crm-activities").insertMany([
        {
          _id: new mongoose.Types.ObjectId(), lead: leadId, office: office._id,
          assignedSalesperson: salesperson?._id, event: "created",
          details: { website: input.website, source: input.source }, createdAt: now, updatedAt: now,
        },
        ...(salesperson ? [{
          _id: new mongoose.Types.ObjectId(), lead: leadId, office: office._id,
          assignedSalesperson: salesperson._id, event: "assigned",
          details: { sequence, mode: "automatic-round-robin" }, createdAt: now, updatedAt: now,
        }] : []),
      ], { session });
      result = { id: String(leadId), duplicate: false, assigned: Boolean(salesperson), ...(legacyId ? { legacyId: String(legacyId) } : {}) };
    });
    if (!result) throw new Error("CRM lead transaction did not complete");
    return result;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const duplicate = await db.collection("central-leads").findOne({ idempotencyKey });
      if (duplicate) return existingResult(duplicate, db, input, legacy);
    }
    throw error;
  } finally {
    // The transaction outcome is already known here. A cleanup failure must not
    // turn a committed lead into a retryable HTTP error.
    try {
      await session.endSession();
    } catch (error) {
      console.error("CRM session cleanup failed", error);
    }
  }
}
