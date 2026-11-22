import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { ingestLeadWithLegacy } from "../../../lib/crm/ingest";

const enquirySchema = z.object({
  type: z.literal("enquiry"),
  name: z.string().trim().min(3).max(80),
  email: z.email().transform((value) => value.toLowerCase()),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  property: z.string().trim().min(1).max(160),
  message: z.string().trim().max(500).default(""),
  source: z.enum([
    "industrial-popup-form",
    "industrial-side-enquiry-form",
    "industrial-property-card",
    "industrial-website",
  ]),
  consent: z.literal(true),
});

const contactSchema = z.object({
  type: z.literal("contact"),
  name: z.string().trim().min(3).max(80),
  email: z.email().transform((value) => value.toLowerCase()),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  propertyType: z.enum([
    "industrial-plot",
    "logistics-plot",
    "warehouse-land",
    "commercial-plot",
  ]),
  budget: z.enum([
    "below-25-lakhs",
    "25-50-lakhs",
    "50-lakhs-1-crore",
    "above-1-crore",
  ]),
  comments: z.string().trim().max(500).default(""),
  consent: z.literal(true),
  source: z.literal("industrial-contact-us-page"),
});

const leadSchema = z.discriminatedUnion("type", [
  enquirySchema,
  contactSchema,
]);

function isAuthorized(request: Request) {
  const secret = process.env.INDUSTRIAL_INGEST_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const result = leadSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return Response.json({ success: false, message: "Invalid lead details" }, { status: 400 });
  }

  try {
    const data = result.data;

    const legacyCollection = data.type === "enquiry" ? "industrial-enquiries" : "industrial-contact-messages";
    const legacyData = data.type === "enquiry"
      ? {
          name: data.name,
          email: data.email,
          phone: data.phone,
          property: data.property,
          message: data.message,
          source: data.source,
          status: "new",
        }
      : {
          name: data.name,
          email: data.email,
          phone: data.phone,
          propertyType: data.propertyType,
          budget: data.budget,
          comments: data.comments,
          consent: data.consent,
          source: data.source,
          status: "new",
        };
    const ingress = await ingestLeadWithLegacy({
      name: data.name,
      email: data.email,
      phone: data.phone,
      website: "dholeraindustrial",
      leadType: data.type,
      source: data.source,
      project: data.type === "enquiry" ? data.property : data.propertyType,
      message: data.type === "enquiry" ? data.message : data.comments,
      budget: data.type === "contact" ? data.budget : undefined,
      consent: data.consent,
      idempotencyKey: request.headers.get("x-idempotency-key") || undefined,
    }, { collection: legacyCollection, data: legacyData });

    if (ingress.duplicate) {
      return Response.json({ success: true, duplicate: true }, { status: 200 });
    }

    return Response.json({ success: true, message: "Lead saved successfully" }, { status: 201 });
  } catch (error) {
    console.error("Industrial lead ingestion failed", error);
    return Response.json({ success: false, message: "Failed to save lead" }, { status: 500 });
  }
}
