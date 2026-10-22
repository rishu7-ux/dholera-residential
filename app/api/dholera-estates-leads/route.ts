import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { ingestLeadWithLegacy } from "../../../lib/crm/ingest";

const enquiry = z.object({
  type: z.literal("enquiry"),
  name: z.string().trim().min(3).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/),
  property: z.string().trim().min(1).max(120),
  message: z.string().trim().max(500),
  source: z.enum([
    "dholeraestates-popup-form",
    "dholeraestates-side-enquiry-form",
    "dholeraestates-website",
  ]),
  consent: z.literal(true),
});

const contact = z.object({
  type: z.literal("contact"),
  name: z.string().trim().min(3).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/),
  propertyType: z.literal("dholera-estates"),
  budget: z.enum([
    "below-20-lakhs",
    "20-50-lakhs",
    "50-lakhs-1-crore",
    "above-1-crore",
  ]),
  comments: z.string().trim().max(500),
  consent: z.literal(true),
  source: z.literal("dholeraestates-contact-us-page"),
});

const schema = z.discriminatedUnion("type", [enquiry, contact]);

export async function POST(request: Request) {
  const expected = process.env.DHOLERA_ESTATES_INGEST_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || !authorization?.startsWith("Bearer ")) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const supplied = Buffer.from(authorization.slice(7));
  const expectedBytes = Buffer.from(expected);
  if (supplied.length !== expectedBytes.length || !timingSafeEqual(supplied, expectedBytes)) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ success: false, message: "Invalid submission" }, { status: 400 });

  const data = parsed.data;
  const legacyCollection = data.type === "enquiry"
    ? "dholera-estates-enquiries"
    : "dholera-estates-contact-messages";
  const legacyData = data.type === "enquiry"
    ? { name: data.name, email: data.email, phone: data.phone, property: data.property, message: data.message, source: data.source }
    : { name: data.name, email: data.email, phone: data.phone, propertyType: data.propertyType, budget: data.budget, comments: data.comments, consent: data.consent, source: data.source };
  const idempotencyKey = request.headers.get("x-idempotency-key");

  const ingress = await ingestLeadWithLegacy({
      name: data.name,
      email: data.email,
      phone: data.phone,
      website: "dholeraestates",
      leadType: data.type,
      source: data.source,
      project: data.type === "enquiry" ? data.property : data.propertyType,
      message: data.type === "enquiry" ? data.message : data.comments,
      budget: data.type === "contact" ? data.budget : undefined,
      consent: data.consent,
      idempotencyKey: idempotencyKey || undefined,
    }, { collection: legacyCollection, data: legacyData });

  if (ingress.duplicate) return Response.json({ success: true, duplicate: true }, { status: 200 });
  return Response.json({ success: true }, { status: 201 });
}
