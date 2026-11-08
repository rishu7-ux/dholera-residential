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

type IngestTestHooks = {
  /** Internal integration-test fault point. Never exposed by the HTTP APIs. */
  afterRotation?: () => void;
};

export async function ingestCentralLead(input: CentralLeadInput, testHooks: IngestTestHooks = {}) {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("CRM database is unavailable");

  const idempotencyKey = input.idempotencyKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey)
    ? input.idempotencyKey
    : randomUUID();
  const existing = await db.collection("central-leads").findOne({ idempotencyKey });
  if (existing) return { id: String(existing._id), duplicate: true, assigned: Boolean(existing.assignedSalesperson) };

  const session = await mongoose.connection.startSession();
  try {
    let result: { id: string; duplicate: boolean; assigned: boolean } | undefined;
    await session.withTransaction(async () => {
      const duplicate = await db.collection("central-leads").findOne({ idempotencyKey }, { session });
      if (duplicate) {
        result = { id: String(duplicate._id), duplicate: true, assigned: Boolean(duplicate.assignedSalesperson) };
        return;
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

      const now = new Date();
      const leadId = new mongoose.Types.ObjectId();
      await db.collection("central-leads").insertOne({
        _id: leadId,
        ...input,
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
      result = { id: String(leadId), duplicate: false, assigned: Boolean(salesperson) };
    });
    if (!result) throw new Error("CRM lead transaction did not complete");
    return result;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const duplicate = await db.collection("central-leads").findOne({ idempotencyKey });
      if (duplicate) return { id: String(duplicate._id), duplicate: true, assigned: Boolean(duplicate.assignedSalesperson) };
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
