import { AsyncLocalStorage } from "node:async_hooks";
import mongoose, { type Model } from "mongoose";
import type { Payload } from "payload";

import connectDB from "../mongodb";
import {
  assignLeadRoundRobin,
  type LeadAssignment,
  type RoundRobinSalesperson,
} from "./roundRobin";

const COUNTER_KEY = "omana-chatbot-salesperson-round-robin";

export type AssignmentCounterScope = {
  key: string;
  runId: string;
};

const assignmentCounterScope = new AsyncLocalStorage<AssignmentCounterScope>();

export function withAssignmentCounterScope<T>(
  scope: AssignmentCounterScope,
  callback: () => T,
): T {
  if (!scope.key.trim() || !scope.runId.trim() || scope.key === COUNTER_KEY) {
    throw new Error("Invalid isolated assignment counter scope");
  }

  return assignmentCounterScope.run(scope, callback);
}

export function currentAssignmentCounterScope() {
  return assignmentCounterScope.getStore();
}

type AssignmentCounter = {
  key: string;
  sequence: number;
  testRunId?: string;
};

type AssignmentClaim = LeadAssignment;

const counterSchema = new mongoose.Schema<AssignmentCounter>(
  {
    key: { type: String, required: true, unique: true },
    sequence: { type: Number, required: true, default: 0 },
    testRunId: { type: String },
  },
  { collection: "omana_assignment_counters", versionKey: false },
);

const claimSchema = new mongoose.Schema<AssignmentClaim>(
  {
    leadId: { type: String, required: true, unique: true },
    salespersonId: { type: String, required: true },
    salespersonName: { type: String, required: true },
    sequence: { type: Number, required: true },
    assignedAt: { type: String, required: true },
  },
  { collection: "omana_lead_assignment_claims", versionKey: false },
);

function assignmentModels() {
  const Counter =
    (mongoose.models.OmanaAssignmentCounter as Model<AssignmentCounter> | undefined) ||
    mongoose.model<AssignmentCounter>("OmanaAssignmentCounter", counterSchema);
  const Claim =
    (mongoose.models.OmanaLeadAssignmentClaim as Model<AssignmentClaim> | undefined) ||
    mongoose.model<AssignmentClaim>("OmanaLeadAssignmentClaim", claimSchema);

  return { Counter, Claim };
}

async function loadActiveSalespeople(payload: Payload) {
  const result = await payload.find({
    collection: "omana-salespeople",
    depth: 0,
    limit: 1000,
    pagination: false,
    sort: "rotationOrder",
    where: { active: { equals: true } },
  });

  return result.docs.map<RoundRobinSalesperson>((salesperson) => ({
    id: salesperson.id,
    name: salesperson.name,
    active: salesperson.active,
    rotationOrder: salesperson.rotationOrder,
  }));
}

export async function getOrCreateSalespersonAssignment(
  payload: Payload,
  leadId: string | number,
  counterScope?: AssignmentCounterScope,
) {
  await connectDB();
  const { Counter, Claim } = assignmentModels();
  await Promise.all([Counter.init(), Claim.init()]);
  const normalizedLeadId = String(leadId);
  const existing = await Claim.findOne({ leadId: normalizedLeadId }).lean();
  if (existing) return existing;

  const salespeople = await loadActiveSalespeople(payload);
  if (salespeople.length === 0) return null;

  return assignLeadRoundRobin({
    leadId: normalizedLeadId,
    salespeople,
    store: {
      async nextSequence() {
        const counter = counterScope
          ? await Counter.findOneAndUpdate(
              { key: counterScope.key, testRunId: counterScope.runId },
              {
                $inc: { sequence: 1 },
                $setOnInsert: { testRunId: counterScope.runId },
              },
              { returnDocument: "after", setDefaultsOnInsert: true, upsert: true },
            ).lean()
          : await Counter.findOneAndUpdate(
              { key: COUNTER_KEY },
              { $inc: { sequence: 1 } },
              { returnDocument: "after", setDefaultsOnInsert: true, upsert: true },
            ).lean();

        if (!counter) throw new Error("Unable to reserve salesperson assignment sequence");
        return counter.sequence;
      },
      async claim(proposed) {
        try {
          const claimed = await Claim.findOneAndUpdate(
            { leadId: normalizedLeadId },
            { $setOnInsert: proposed },
            { returnDocument: "after", setDefaultsOnInsert: true, upsert: true },
          ).lean();

          if (!claimed) throw new Error("Unable to claim salesperson assignment");
          return claimed;
        } catch (error) {
          if ((error as { code?: number }).code !== 11000) throw error;
          const winner = await Claim.findOne({ leadId: normalizedLeadId }).lean();
          if (!winner) throw error;
          return winner;
        }
      },
    },
  });
}
