import { timingSafeEqual } from "node:crypto";

import { getPayload } from "payload";
import { z } from "zod";

import config from "../../../payload.config";
import { ingestCentralLead } from "../../../lib/crm/ingest";

const enquirySchema = z.object({
  type: z.literal("enquiry"),
  name: z.string().trim().min(3).max(50),
  email: z.email().transform((value) => value.toLowerCase()),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  message: z.string().trim().max(500),
  source: z.enum(["estate1-popup-form", "estate1-side-enquiry-form"]),
});

const contactSchema = z.object({
  type: z.literal("contact"),
  name: z.string().trim().min(3).max(50),
  email: z.email().transform((value) => value.toLowerCase()),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  budget: z.enum(["below-20-lakhs", "20-50-lakhs", "50-lakhs-1-crore", "above-1-crore"]),
  comments: z.string().trim().max(500),
  consent: z.literal(true),
  source: z.literal("estate1-contact-us-page"),
});

const leadSchema = z.discriminatedUnion("type", [enquirySchema, contactSchema]);

function isAuthorized(request: Request) {
  const secret = process.env.ESTATE1_INGEST_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const result = leadSchema.safeParse(await request.json().catch(() => null));
    if (!result.success) return Response.json({ success: false, message: "Invalid lead details" }, { status: 400 });

    const payload = await getPayload({ config });
    let legacyId: string | number;
    if (result.data.type === "enquiry") {
      const created = await payload.create({
        collection: "estate1-enquiries",
        data: {
          name: result.data.name,
          email: result.data.email,
          phone: result.data.phone,
          message: result.data.message,
          source: result.data.source,
          status: "new",
        },
      });
      legacyId = String(created.id);
    } else {
      const created = await payload.create({
        collection: "estate1-contact-messages",
        data: {
          name: result.data.name,
          email: result.data.email,
          phone: result.data.phone,
          budget: result.data.budget,
          comments: result.data.comments,
          consent: result.data.consent,
          source: result.data.source,
          status: "new",
        },
      });
      legacyId = String(created.id);
    }

    await ingestCentralLead({
      name: result.data.name, email: result.data.email, phone: result.data.phone,
      website: "dholera-estate-1", leadType: result.data.type,
      source: result.data.source, project: "Dholera Estate 1",
      message: result.data.type === "enquiry" ? result.data.message : result.data.comments,
      budget: result.data.type === "contact" ? result.data.budget : undefined,
      consent: result.data.type === "contact" ? result.data.consent : false,
      idempotencyKey: request.headers.get("x-idempotency-key") || undefined,
      legacyCollection: result.data.type === "enquiry" ? "estate1-enquiries" : "estate1-contact-messages",
      legacyId,
    });

    return Response.json({ success: true, message: "Lead saved successfully" }, { status: 201 });
  } catch (error) {
    console.error("Estate 1 lead ingestion failed", error);
    return Response.json({ success: false, message: "Failed to save lead" }, { status: 500 });
  }
}
