import { CRM_LEAD_STATUSES } from "./report-core";
import { APIError } from "payload";

type LeadOperationData = Record<string, unknown>;

/** Validate only fields submitted for an update, so older overdue leads remain editable. */
export function validateLeadOperationUpdate(data: LeadOperationData, originalDoc: LeadOperationData, now = new Date()): void {
  if (Object.hasOwn(data, "status") && !CRM_LEAD_STATUSES.includes(data.status as (typeof CRM_LEAD_STATUSES)[number])) {
    throw new APIError("Invalid CRM lead status", 400);
  }
  if (Object.hasOwn(data, "notes") && data.notes != null) {
    if (typeof data.notes !== "string" || data.notes.length > 4000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(data.notes)) {
      throw new APIError("CRM lead notes must be plain text of at most 4000 characters", 400);
    }
  }
  if (!Object.hasOwn(data, "nextFollowUpAt") || data.nextFollowUpAt == null || data.nextFollowUpAt === "") return;
  const value = data.nextFollowUpAt;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new APIError("Follow-up must be an ISO date and time with a timezone", 400);
  }
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) throw new APIError("Invalid follow-up date and time", 400);
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== value.slice(0, 10)) {
    throw new APIError("Invalid follow-up date and time", 400);
  }
  const previous = originalDoc.nextFollowUpAt;
  if (value !== previous && millis <= now.getTime()) throw new APIError("New follow-up must be in the future", 400);
}
