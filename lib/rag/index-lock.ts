import "server-only";

import { randomUUID } from "node:crypto";

import type { Payload } from "payload";

const LOCK_COLLECTION = "rag_index_locks";
const LOCK_LEASE_MS = 10 * 60 * 1000;

type LockDocument = {
  _id: string;
  owner: string;
  expiresAt: Date;
  startedAt: Date;
};

export class IndexingBusyError extends Error {
  constructor() {
    super("An Omana indexing run is already active");
    this.name = "IndexingBusyError";
  }
}

export async function withOmanaIndexLock<T>(payload: Payload, task: () => Promise<T>) {
  const database = payload.db.connection.db;
  if (!database) throw new Error("Payload database connection is unavailable");

  const collection = database.collection<LockDocument>(LOCK_COLLECTION);
  const owner = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_LEASE_MS);

  try {
    const lock = await collection.findOneAndUpdate(
      {
        _id: "omana",
        $or: [{ expiresAt: { $lte: now } }, { owner }],
      },
      {
        $set: { owner, expiresAt, startedAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );

    if (!lock || lock.owner !== owner) throw new IndexingBusyError();
  } catch (error) {
    if (
      error instanceof IndexingBusyError ||
      (typeof error === "object" && error !== null && "code" in error && error.code === 11000)
    ) {
      throw new IndexingBusyError();
    }
    throw error;
  }

  try {
    return await task();
  } finally {
    await collection.deleteOne({ _id: "omana", owner });
  }
}
