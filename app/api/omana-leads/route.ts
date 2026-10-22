import { timingSafeEqual } from "node:crypto";

import { getPayload } from "payload";
import { z } from "zod";

import config from "../../../payload.config";
import { ingestLeadWithLegacy, LegacyReconciliationRequiredError, type LegacyLeadWrite } from "../../../lib/crm/ingest";
import { qualifyLead } from "../../../lib/leads/qualification";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const MAX_BODY_CHARACTERS = 32_768;

const flexiblePhone = z.string().trim().min(7).max(22).refine((value) => {
  const digits = value.replace(/\D/g, "");
  return /^\+?[\d\s().-]{7,22}$/.test(value) && digits.length >= 7 && digits.length <= 15;
});
const indianMobile = z
  .string()
  .trim()
  .min(10)
  .max(22)
  .refine((value) => {
    const digits = value.replace(/\D/g, "");
    const nationalNumber =
      digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : digits.length === 11 && digits.startsWith("0")
          ? digits.slice(1)
          : digits;
    return /^\+?[\d\s().-]+$/.test(value) && /^[6-9]\d{9}$/.test(nationalNumber);
  })
  .transform((value) => {
    const digits = value.replace(/\D/g, "");
    const nationalNumber =
      digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : digits.length === 11 && digits.startsWith("0")
          ? digits.slice(1)
          : digits;
    return `+91${nationalNumber}`;
  });
const optionalAttribution = z.string().trim().max(500).optional().default("");
const optionalEmail = z
  .union([z.string().trim().email().max(254), z.literal("")])
  .optional()
  .default("");
const chatbotName = z
  .string()
  .trim()
  .min(2)
  .max(150)
  .regex(/^[\p{L}][\p{L}\p{M} .'-]*$/u);

const enquirySchema = z.object({
  type: z.literal("enquiry"),
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: flexiblePhone,
  selectedProject: z.string().trim().max(160),
  selectedProjectSlug: z.string().trim().max(160),
  message: z.string().trim().max(5000).optional().default(""),
  page: z.string().trim().startsWith("/").max(240),
  source: z.enum(["omana-global-drawer", "omana-project-page", "omana-website"]),
  consent: z.literal(true),
});

const contactSchema = z.object({
  type: z.literal("contact"),
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: flexiblePhone,
  selectedProject: z.string().trim().max(160),
  selectedProjectSlug: z.string().trim().max(160),
  message: z.string().trim().max(5000).optional().default(""),
  page: z.literal("/contact"),
  source: z.literal("omana-contact-page"),
  consent: z.literal(true),
});

const googleAdsSchema = z.object({
  type: z.literal("google-ads-enquiry"),
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().optional(),
  phone: flexiblePhone,
  selectedProject: z.string().trim().max(160),
  selectedProjectSlug: z.string().trim().max(160),
  message: z.string().trim().max(5000).optional().default(""),
  page: z.literal("/dholeraplots"),
  source: z.literal("google-ads-dholeraplots"),
  consent: z.literal(true),
  utmSource: optionalAttribution,
  utmMedium: optionalAttribution,
  utmCampaign: optionalAttribution,
  utmTerm: optionalAttribution,
  utmContent: optionalAttribution,
  gclid: optionalAttribution,
  gbraid: optionalAttribution,
  wbraid: optionalAttribution,
  referrer: z.string().trim().max(1000).optional().default(""),
});

const chatbotEnquirySchema = z.object({
  type: z.literal("ai-chatbot-enquiry"),
  initialIntent: z.string().trim().max(2000).optional().default(""),
  name: chatbotName,
  email: optionalEmail,
  phone: indianMobile,
  selectedProject: z.string().trim().min(2).max(160),
  selectedProjectSlug: z.string().trim().max(160).optional().default(""),
  requirement: z.string().trim().min(2).max(2000),
  plotSize: z.string().trim().max(160).optional().default(""),
  budget: z.string().trim().max(160).optional().default(""),
  purchaseTimeline: z.string().trim().max(160).optional().default(""),
  page: z.string().trim().startsWith("/").max(240),
  source: z.literal("ai-chatbot"),
  consent: z.literal(true),
  idempotencyKey: z.string().trim().uuid(),
  utmSource: optionalAttribution,
  utmMedium: optionalAttribution,
  utmCampaign: optionalAttribution,
  utmTerm: optionalAttribution,
  utmContent: optionalAttribution,
  gclid: optionalAttribution,
  gbraid: optionalAttribution,
  wbraid: optionalAttribution,
  referrer: z.string().trim().max(1000).optional().default(""),
});

const leadSchema = z.discriminatedUnion("type", [
  enquirySchema,
  contactSchema,
  googleAdsSchema,
  chatbotEnquirySchema,
]);

function isAuthorized(request: Request) {
  const secret = process.env.OMANA_INGEST_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json(
      { success: false, message: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_CHARACTERS) {
    return Response.json(
      { success: false, message: "Lead request is too large" },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_CHARACTERS) {
    return Response.json(
      { success: false, message: "Lead request is too large" },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }

  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Validation below returns the same safe response for malformed JSON.
  }

  const result = leadSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { success: false, message: "Invalid lead details" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const data = result.data;

    const centralInput = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      website: "omana-projects" as const,
      leadType:
        data.type === "ai-chatbot-enquiry"
          ? "chatbot" as const
          : data.type === "google-ads-enquiry"
            ? "google-ads" as const
            : data.type,
      source: data.source,
      project: data.selectedProject,
      message: data.type === "ai-chatbot-enquiry" ? data.requirement : data.message,
      budget: data.type === "ai-chatbot-enquiry" ? data.budget : undefined,
      page: data.page,
      consent: data.consent,
      idempotencyKey:
        data.type === "ai-chatbot-enquiry"
          ? data.idempotencyKey
          : request.headers.get("x-idempotency-key") || undefined,
      attribution:
        data.type === "ai-chatbot-enquiry" || data.type === "google-ads-enquiry"
          ? {
              utmSource: data.utmSource,
              utmMedium: data.utmMedium,
              utmCampaign: data.utmCampaign,
              utmTerm: data.utmTerm,
              utmContent: data.utmContent,
              gclid: data.gclid,
              gbraid: data.gbraid,
              wbraid: data.wbraid,
              referrer: data.referrer,
            }
          : undefined,
    };

    if (data.type === "ai-chatbot-enquiry") {
      const payload = await getPayload({ config });
      const normalizedPhone = data.phone;
      const existingSubmission = await payload.find({
        collection: "omana-enquiries",
        depth: 0,
        limit: 1,
        pagination: false,
        where: {
          or: [
            { idempotencyKey: { equals: data.idempotencyKey } },
            {
              and: [
                { source: { equals: "ai-chatbot" } },
                { phone: { equals: normalizedPhone } },
                {
                  createdAt: {
                    greater_than: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                  },
                },
              ],
            },
          ],
        },
      });

      if (existingSubmission.docs.length > 0) {
        const existingLead = existingSubmission.docs[0];
        if (!existingLead.idempotencyKey) throw new LegacyReconciliationRequiredError(String(existingLead.id), "omana-enquiries", undefined);
        const centralForExisting = await payload.find({
          collection: "central-leads",
          depth: 0,
          limit: 1,
          pagination: false,
          overrideAccess: true,
          where: { and: [
            { idempotencyKey: { equals: existingLead.idempotencyKey } },
            { website: { equals: "omana-projects" } },
            { source: { equals: "ai-chatbot" } },
          ] },
        });
        const linkedCentral = centralForExisting.docs[0];
        if (
          !linkedCentral ||
          linkedCentral.legacyCollection !== "omana-enquiries" ||
          String(linkedCentral.legacyId ?? "") !== String(existingLead.id)
        ) throw new LegacyReconciliationRequiredError(String(existingLead.id), "omana-enquiries", existingLead.idempotencyKey);
        if (
          !existingLead.qualification &&
          existingLead.qualificationMode !== "manual"
        ) {
          const qualification = qualifyLead({
            initialIntent: existingLead.initialIntent,
            selectedProject: existingLead.selectedProject,
            requirement: existingLead.requirement,
            budget: existingLead.budget,
            purchaseTimeline: existingLead.purchaseTimeline,
          });
          await payload.update({
            collection: "omana-enquiries",
            id: existingLead.id,
            context: { automaticQualification: true },
            data: {
              qualification: qualification.qualification,
              qualificationReasons: qualification.reasons.map((reason) => ({ reason })),
              qualificationVersion: qualification.version,
              qualifiedAt: new Date().toISOString(),
              qualificationMode: "automatic",
            },
          });
        }
        return Response.json(
          { success: true, duplicate: true },
          { status: 200, headers: NO_STORE_HEADERS },
        );
      }
    }

    let legacy: LegacyLeadWrite;
    if (data.type === "ai-chatbot-enquiry") {
      legacy = { collection: "omana-enquiries", data: {
        initialIntent: data.initialIntent, name: data.name, email: data.email || undefined,
        phone: data.phone, selectedProject: data.selectedProject,
        selectedProjectSlug: data.selectedProjectSlug, requirement: data.requirement,
        plotSize: data.plotSize, budget: data.budget, purchaseTimeline: data.purchaseTimeline,
        message: data.requirement, page: data.page, source: data.source,
        idempotencyKey: data.idempotencyKey, utmSource: data.utmSource,
        utmMedium: data.utmMedium, utmCampaign: data.utmCampaign,
        utmTerm: data.utmTerm, utmContent: data.utmContent,
        gclid: data.gclid, gbraid: data.gbraid, wbraid: data.wbraid,
        referrer: data.referrer, consent: data.consent,
      } };
    } else if (data.type === "enquiry") {
      legacy = { collection: "omana-enquiries", data: {
        name: data.name, email: data.email, phone: data.phone,
        selectedProject: data.selectedProject, selectedProjectSlug: data.selectedProjectSlug,
        message: data.message, page: data.page, source: data.source, consent: data.consent,
      } };
    } else if (data.type === "contact") {
      legacy = { collection: "omana-contact-messages", data: {
        name: data.name, email: data.email, phone: data.phone,
        selectedProject: data.selectedProject, selectedProjectSlug: data.selectedProjectSlug,
        message: data.message, page: data.page, source: data.source, consent: data.consent,
      } };
    } else {
      legacy = { collection: "omana-google-ads-enquiries", data: {
        name: data.name, email: data.email, phone: data.phone,
        selectedProject: data.selectedProject, selectedProjectSlug: data.selectedProjectSlug,
        message: data.message, page: data.page, source: data.source, consent: data.consent,
        utmSource: data.utmSource, utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign, utmTerm: data.utmTerm,
        utmContent: data.utmContent, gclid: data.gclid,
        gbraid: data.gbraid, wbraid: data.wbraid,
        referrer: data.referrer,
      } };
    }

    const saved = await ingestLeadWithLegacy(centralInput, legacy);
    if (saved.duplicate) {
      return Response.json(
        { success: true, duplicate: true },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (data.type === "ai-chatbot-enquiry") {
      if (!saved.legacyId) throw new Error("Committed chatbot lead has no legacy ID");
      const payload = await getPayload({ config });
      const qualification = qualifyLead({
        initialIntent: data.initialIntent,
        selectedProject: data.selectedProject,
        requirement: data.requirement,
        budget: data.budget,
        purchaseTimeline: data.purchaseTimeline,
      });
      await payload.update({
        collection: "omana-enquiries",
        id: saved.legacyId,
        context: { automaticQualification: true },
        data: {
          qualification: qualification.qualification,
          qualificationReasons: qualification.reasons.map((reason) => ({ reason })),
          qualificationVersion: qualification.version,
          qualifiedAt: new Date().toISOString(),
          qualificationMode: "automatic",
        },
      });
    }

    return Response.json(
      { success: true, duplicate: false },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("Omana lead ingestion failed", error);
    return Response.json(
      { success: false, message: "Failed to save lead" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
