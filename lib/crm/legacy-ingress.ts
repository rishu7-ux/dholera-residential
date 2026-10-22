import type { Payload } from "payload";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LegacyIngressResult = { duplicate: true } | { duplicate: false; legacyId: string | number };

export class LegacyIngressPartialWriteError extends Error {
  constructor(
    public readonly phase: "central-ingest" | "duplicate-cleanup",
    public readonly collection: string,
    public readonly legacyId: string | number,
    public readonly idempotencyKey: string | undefined,
    options: ErrorOptions,
  ) {
    super(`Legacy lead ${String(legacyId)} in ${collection} needs reconciliation after ${phase}`, options);
    this.name = "LegacyIngressPartialWriteError";
  }
}

/**
 * Creates a legacy form record only when the central idempotency key is new.
 * The second duplicate check handles concurrent requests; only this request's
 * newly created legacy record is removed if another request won the race.
 */
export async function createLegacyForCentralLead({
  payload,
  collection,
  data,
  idempotencyKey,
  ingest,
}: {
  payload: Payload;
  collection: string;
  data: Record<string, unknown>;
  idempotencyKey?: string | null;
  ingest: (legacyId: string | number) => Promise<{ duplicate: boolean }>;
}): Promise<LegacyIngressResult> {
  const key = idempotencyKey?.trim();
  if (key && UUID_PATTERN.test(key)) {
    const existing = await payload.find({
      collection: "central-leads",
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      where: { idempotencyKey: { equals: key } },
    });
    if (existing.docs.length > 0) return { duplicate: true };
  }

  const legacy = await payload.create({
    collection: collection as never,
    data: data as never,
  }) as unknown as { id: string | number };
  let result: { duplicate: boolean };
  try {
    result = await ingest(legacy.id);
  } catch (error) {
    // The central transaction may have failed or its commit may be uncertain.
    // Keep this exact legacy record for inspection rather than deleting a lead.
    throw new LegacyIngressPartialWriteError("central-ingest", collection, legacy.id, key, { cause: error });
  }
  if (result.duplicate) {
    try {
      await payload.delete({
        collection: collection as never,
        id: legacy.id,
        overrideAccess: true,
      });
    } catch (error) {
      throw new LegacyIngressPartialWriteError("duplicate-cleanup", collection, legacy.id, key, { cause: error });
    }
    return { duplicate: true };
  }

  return { duplicate: false, legacyId: legacy.id };
}
