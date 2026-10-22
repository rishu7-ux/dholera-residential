export const CRM_LEGACY_COLLECTIONS = [
  "omana-enquiries",
  "omana-contact-messages",
  "omana-google-ads-enquiries",
  "estate1-enquiries",
  "estate1-contact-messages",
  "estate2-enquiries",
  "estate2-contact-messages",
  "dholera-estates-enquiries",
  "dholera-estates-contact-messages",
  "industrial-enquiries",
  "industrial-contact-messages",
] as const;

export type CrmLegacyCollection = (typeof CRM_LEGACY_COLLECTIONS)[number];

export function legacyCollectionForForm(website: string, type: string): CrmLegacyCollection {
  if (website === "omana-projects") {
    if (type === "contact") return "omana-contact-messages";
    if (type === "google-ads-enquiry") return "omana-google-ads-enquiries";
    if (type === "enquiry" || type === "ai-chatbot-enquiry") return "omana-enquiries";
  }
  if (type === "enquiry" || type === "contact") {
    const prefix = {
      "dholera-estate-1": "estate1",
      "dholera-estate-2": "estate2",
      dholeraestates: "dholera-estates",
      dholeraindustrial: "industrial",
    }[website];
    if (prefix) return `${prefix}-${type === "contact" ? "contact-messages" : "enquiries"}` as CrmLegacyCollection;
  }
  throw new Error("Unsupported synthetic form legacy collection");
}

export function isRunMarkedSyntheticLegacy(
  record: unknown,
  runId: string,
): boolean {
  if (typeof record !== "object" || record === null) return false;
  const candidate = record as Record<string, unknown>;
  const email = String(candidate.email ?? "");
  const name = String(candidate.name ?? "");
  const source = String(candidate.source ?? "");
  const prefix = `${runId}.`;
  const suffix = "@example.invalid";
  if (!email.startsWith(prefix) || !email.endsWith(suffix)) return false;
  const localMarker = email.slice(prefix.length, -suffix.length);
  return /^[a-z0-9-]+$/.test(localMarker) &&
    (name.startsWith("Synthetic ") || name.startsWith(`crm-test-${runId}`)) &&
    source.length > 0;
}
