import { timingSafeEqual } from "node:crypto";

import { getPayload } from "payload";
import { z } from "zod";

import config from "../../../payload.config";

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
    if (result.data.type === "enquiry") {
      await payload.create({
        // Regenerate payload-types.ts with the project-supported Node runtime before deployment.
        collection: "estate1-enquiries" as never,
        data: {
          name: result.data.name,
          email: result.data.email,
          phone: result.data.phone,
          message: result.data.message,
          source: result.data.source,
          status: "new",
        } as never,
      });
    } else {
      await payload.create({
        // Regenerate payload-types.ts with the project-supported Node runtime before deployment.
        collection: "estate1-contact-messages" as never,
        data: {
          name: result.data.name,
          email: result.data.email,
          phone: result.data.phone,
          budget: result.data.budget,
          comments: result.data.comments,
          consent: result.data.consent,
          source: result.data.source,
          status: "new",
        } as never,
      });
    }

    return Response.json({ success: true, message: "Lead saved successfully" }, { status: 201 });
  } catch (error) {
    console.error("Estate 1 lead ingestion failed", error);
    return Response.json({ success: false, message: "Failed to save lead" }, { status: 500 });
  }
}
