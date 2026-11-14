import { timingSafeEqual } from "node:crypto";

import { getPayload } from "payload";
import { z } from "zod";

import config from "../../../payload.config";
import { qualifyLead } from "../../../lib/leads/qualification";
import {
  currentAssignmentCounterScope,
  getOrCreateSalespersonAssignment,
} from "../../../lib/leads/salespersonAssignment";

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

async function assignChatbotLead(
  payload: Awaited<ReturnType<typeof getPayload>>,
  leadId: string | number,
) {
  try {
    const assignment = await getOrCreateSalespersonAssignment(
      payload,
      leadId,
      currentAssignmentCounterScope(),
    );
    if (!assignment) return;

    await payload.update({
      collection: "omana-enquiries",
      id: leadId,
      context: { automaticAssignment: true },
      data: {
        assignedSalesperson: assignment.salespersonId,
        assignedAt: assignment.assignedAt,
        assignmentSequence: assignment.sequence,
        assignmentMode: "automatic",
      },
    });
  } catch (error) {
    console.error("Automatic salesperson assignment failed", error);
  }
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
    const payload = await getPayload({ config });
    const data = result.data;

    if (data.type === "ai-chatbot-enquiry") {
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
        if (
          !existingLead.assignedSalesperson &&
          existingLead.assignmentMode !== "manual"
        ) {
          await assignChatbotLead(payload, existingLead.id);
        }
        return Response.json(
          { success: true, duplicate: true },
          { status: 200, headers: NO_STORE_HEADERS },
        );
      }

      const createdLead = await payload.create({
        collection: "omana-enquiries",
        data: {
          initialIntent: data.initialIntent,
          name: data.name,
          email: data.email || undefined,
          phone: normalizedPhone,
          selectedProject: data.selectedProject,
          selectedProjectSlug: data.selectedProjectSlug,
          requirement: data.requirement,
          plotSize: data.plotSize,
          budget: data.budget,
          purchaseTimeline: data.purchaseTimeline,
          message: data.requirement,
          page: data.page,
          source: data.source,
          idempotencyKey: data.idempotencyKey,
          utmSource: data.utmSource,
          utmMedium: data.utmMedium,
          utmCampaign: data.utmCampaign,
          utmTerm: data.utmTerm,
          utmContent: data.utmContent,
          gclid: data.gclid,
          gbraid: data.gbraid,
          wbraid: data.wbraid,
          referrer: data.referrer,
          consent: data.consent,
          status: "new",
        },
      });
      const qualification = qualifyLead({
        initialIntent: data.initialIntent,
        selectedProject: data.selectedProject,
        requirement: data.requirement,
        budget: data.budget,
        purchaseTimeline: data.purchaseTimeline,
      });
      await payload.update({
        collection: "omana-enquiries",
        id: createdLead.id,
        context: { automaticQualification: true },
        data: {
          qualification: qualification.qualification,
          qualificationReasons: qualification.reasons.map((reason) => ({ reason })),
          qualificationVersion: qualification.version,
          qualifiedAt: new Date().toISOString(),
          qualificationMode: "automatic",
        },
      });
      await assignChatbotLead(payload, createdLead.id);
    } else if (data.type === "enquiry") {
      await payload.create({
        collection: "omana-enquiries",
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          selectedProject: data.selectedProject,
          selectedProjectSlug: data.selectedProjectSlug,
          message: data.message,
          page: data.page,
          source: data.source,
          consent: data.consent,
          status: "new",
        },
      });
    } else if (data.type === "contact") {
      await payload.create({
        collection: "omana-contact-messages",
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          selectedProject: data.selectedProject,
          selectedProjectSlug: data.selectedProjectSlug,
          message: data.message,
          page: data.page,
          source: data.source,
          consent: data.consent,
          status: "new",
        },
      });
    } else {
      await payload.create({
        collection: "omana-google-ads-enquiries",
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          selectedProject: data.selectedProject,
          selectedProjectSlug: data.selectedProjectSlug,
          message: data.message,
          page: data.page,
          source: data.source,
          consent: data.consent,
          utmSource: data.utmSource,
          utmMedium: data.utmMedium,
          utmCampaign: data.utmCampaign,
          utmTerm: data.utmTerm,
          utmContent: data.utmContent,
          gclid: data.gclid,
          gbraid: data.gbraid,
          wbraid: data.wbraid,
          referrer: data.referrer,
          status: "new",
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
