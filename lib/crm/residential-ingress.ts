import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ingestLeadWithLegacy, LeadIdempotencyConflictError } from "./ingest";

const base = {
  name: z.string().trim().min(3).max(50),
  email: z.email().transform((email) => email.trim().toLowerCase()),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  consent: z.literal(true),
};

const enquirySchema = z.object({
  ...base,
  property: z.string().trim().min(1).max(120),
  message: z.string().trim().max(500),
  source: z.enum(["popup-form", "side-enquiry-form"]),
});

const contactSchema = z.object({
  ...base,
  propertyType: z.enum(["residential-plot", "sco-plot", "industrial-plot", "dholera-estates"]),
  budget: z.enum(["below-20-lakhs", "20-50-lakhs", "50-lakhs-1-crore", "above-1-crore"]),
  comments: z.string().trim().max(500),
  source: z.literal("contact-us-page"),
});

export async function handleResidentialLead(request: Request, type: "enquiry" | "contact") {
  const parsed = (type === "enquiry" ? enquirySchema : contactSchema)
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ success: false, message: "Invalid lead details or consent" }, { status: 400 });
  }

  const suppliedKey = request.headers.get("x-idempotency-key");
  if (suppliedKey && !z.uuid().safeParse(suppliedKey).success) {
    return Response.json({ success: false, message: "Invalid submission key" }, { status: 400 });
  }
  const idempotencyKey = suppliedKey || randomUUID();
  const data = parsed.data;
  const isContact = type === "contact";
  const property = "property" in data ? data.property : undefined;
  const comments = "comments" in data ? data.comments : undefined;
  const propertyType = "propertyType" in data ? data.propertyType : undefined;
  const budget = "budget" in data ? data.budget : undefined;
  const message = "message" in data ? data.message : comments;

  try {
    const result = await ingestLeadWithLegacy({
      name: data.name, email: data.email, phone: data.phone,
      website: "dholera-residential", leadType: type, source: data.source,
      project: isContact ? propertyType : property,
      message, budget, consent: data.consent, idempotencyKey,
    }, {
      collection: isContact ? "contact-messages" : "enquiries",
      data: isContact
        ? { name: data.name, email: data.email, phone: data.phone, propertyType, budget, comments, consent: true, source: data.source }
        : { name: data.name, email: data.email, phone: data.phone, property, message, source: data.source, consent: true },
    });
    return Response.json({ success: true, duplicate: result.duplicate }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof LeadIdempotencyConflictError) {
      return Response.json({ success: false, message: "Submission key conflicts with a different lead" }, { status: 409 });
    }
    console.error("Residential CRM ingestion failed");
    return Response.json({ success: false, message: "Could not save lead" }, { status: 503 });
  }
}
