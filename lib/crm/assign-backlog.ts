import mongoose from "mongoose";
import connectDB from "../mongodb";
import { assertAtomicIndexes } from "./ingest";

const COUNTER_KEY = "noida-shared-lead-round-robin";

/** Assign a bounded, oldest-first batch. Each lead and counter advance commit together. */
export async function assignNoidaBacklog(limit: number, officeCode: "noida" | "ahmedabad" = "noida"): Promise<{ assigned: number; remaining: number }> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("Invalid backlog batch size");
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("CRM database is unavailable");
  await assertAtomicIndexes(db);
  const matches = (await db.collection("crm-offices").find({ active: true }).limit(100).toArray())
    .filter((office) => String(office.code || "").trim().toLowerCase() === officeCode);
  if (matches.length !== 1) throw new Error("One active CRM office is required");
  const office = matches[0];
  let assigned = 0;
  for (let i = 0; i < limit; i++) {
    const session = await mongoose.connection.startSession();
    try {
      let didAssign = false;
      await session.withTransaction(async () => {
        didAssign = false;
        const lead = await db.collection("central-leads").findOne(
          { office: office._id, assignedSalesperson: null, status: "new" },
          { sort: { createdAt: 1, _id: 1 }, session },
        );
        if (!lead) return;
        const salespeople = await db.collection("users").find({
          role: "salesperson", office: office._id, active: true, eligibleForAssignment: true,
        }, { session }).sort({ rotationOrder: 1, email: 1, _id: 1 }).toArray();
        if (!salespeople.length) throw new Error("No eligible CRM salesperson is active");
        const counter = await db.collection("crm-assignment-counters").findOneAndUpdate(
          { key: COUNTER_KEY, office: office._id },
          { $inc: { sequence: 1 }, $setOnInsert: { createdAt: new Date() }, $set: { updatedAt: new Date() } },
          { upsert: true, returnDocument: "after", session },
        );
        const sequence = Number(counter?.sequence || 1);
        const salesperson = salespeople[(sequence - 1) % salespeople.length];
        const now = new Date();
        const result = await db.collection("central-leads").updateOne(
          { _id: lead._id, assignedSalesperson: null },
          { $set: { assignedSalesperson: salesperson._id, team: salesperson.team, assignedAt: now,
            assignmentSequence: sequence, updatedAt: now }, $unset: { unassignedReason: "" } },
          { session },
        );
        if (result.modifiedCount !== 1) throw new Error("Backlog lead changed concurrently");
        await db.collection("crm-activities").insertOne({
          _id: new mongoose.Types.ObjectId(), lead: lead._id, office: office._id,
          team: salesperson.team, assignedSalesperson: salesperson._id,
          event: "assigned", details: { sequence, mode: "automatic-round-robin-backlog" },
          createdAt: now, updatedAt: now,
        }, { session });
        didAssign = true;
      });
      if (!didAssign) break;
      assigned++;
    } finally {
      await session.endSession();
    }
  }
  const remaining = await db.collection("central-leads").countDocuments({
    office: office._id, assignedSalesperson: null, status: "new",
  });
  return { assigned, remaining };
}
