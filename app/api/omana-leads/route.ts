import { timingSafeEqual } from "node:crypto";

import { getPayload } from "payload";
import { z } from "zod";

import config from "../../../payload.config";

const flexiblePhone = z.string().trim().min(7).max(22).refine((value) => {
  const digits = value.replace(/\D/g, "");
  return /^\+?[\d\s().-]{7,22}$/.test(value) && digits.length >= 7 && digits.length <= 15;
});
const optionalAttribution = z.string().trim().max(500).optional().default("");

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

const leadSchema = z.discriminatedUnion("type", [
  enquirySchema,
  contactSchema,
  googleAdsSchema,
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
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const result = leadSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return Response.json({ success: false, message: "Invalid lead details" }, { status: 400 });
  }

  try {
    const payload = await getPayload({ config });
    const data = result.data;

    if (data.type === "enquiry") {
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

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Omana lead ingestion failed", error);
    return Response.json({ success: false, message: "Failed to save lead" }, { status: 500 });
  }
}
