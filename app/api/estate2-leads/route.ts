import { timingSafeEqual } from "node:crypto";

import { getPayload } from "payload";
import { z } from "zod";

import config from "../../../payload.config";

const enquirySchema = z.object({
  type: z.literal("enquiry"),
  name: z.string().trim().min(3).max(50),
  email: z.email().transform((value) => value.toLowerCase()),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  property: z.string().trim().min(1).max(120),
  message: z.string().trim().max(500),
  source: z.enum(["estate2-popup-form", "estate2-side-enquiry-form"]),
});

const contactSchema = z.object({
  type: z.literal("contact"),
  name: z.string().trim().min(3).max(50),
  email: z.email().transform((value) => value.toLowerCase()),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  propertyType: z.literal("dholera-estate-2"),
  budget: z.enum([
    "below-20-lakhs",
    "20-50-lakhs",
    "50-lakhs-1-crore",
    "above-1-crore",
  ]),
  comments: z.string().trim().max(500),
  consent: z.literal(true),
  source: z.literal("estate2-contact-us-page"),
});

const leadSchema = z.discriminatedUnion("type", [
  enquirySchema,
  contactSchema,
]);

function isAuthorized(request: Request) {
  const secret = process.env.ESTATE2_INGEST_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || !authorization?.startsWith("Bearer ")) {
    return false;
  }

  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, message: "Invalid lead details" },
        { status: 400 },
      );
    }

    const result = leadSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { success: false, message: "Invalid lead details" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });

    if (result.data.type === "enquiry") {
      await payload.create({
        collection: "estate2-enquiries",
        data: {
          name: result.data.name,
          email: result.data.email,
          phone: result.data.phone,
          property: result.data.property,
          message: result.data.message,
          source: result.data.source,
          status: "new",
        },
      });
    } else {
      await payload.create({
        collection: "estate2-contact-messages",
        data: {
          name: result.data.name,
          email: result.data.email,
          phone: result.data.phone,
          propertyType: result.data.propertyType,
          budget: result.data.budget,
          comments: result.data.comments,
          consent: result.data.consent,
          source: result.data.source,
          status: "new",
        },
      });
    }

    return Response.json(
      { success: true, message: "Lead saved successfully" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Estate 2 lead ingestion failed", error);

    return Response.json(
      { success: false, message: "Failed to save lead" },
      { status: 500 },
    );
  }
}
