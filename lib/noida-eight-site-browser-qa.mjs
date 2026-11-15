export const TARGET = Object.freeze({
  host: "127.0.0.1", port: 27179, replicaSet: "noida_demo", database: "noida-crm-ingress-qa-20261021",
});
export const URI = `mongodb://${TARGET.host}:${TARGET.port}/${TARGET.database}?replicaSet=${TARGET.replicaSet}&directConnection=true`;
export const APPROVAL = "APPROVE NOIDA EIGHT SITE BROWSER PERSISTENCE CASES: on loopback MongoDB `127.0.0.1:27179`, replica set `noida_demo`, database `noida-crm-ingress-qa-20261021` only, preserve the existing 12 synthetic users and 30 central leads; authorize exactly one consented Contact Us and one consented Enquire Now browser submission from each of Estate 1, Estate 2, Dholera Estates and Industrial, using new `example.invalid` identities and one run marker. Permit at most eight new central leads, eight corresponding site legacy leads, sixteen created/assigned activities and eight assignment-counter advances. Permit no user/session/password changes, no cleanup/deletion, no Atlas or production access, no external notifications, and no other website/route writes. Stop and preserve evidence if any limit or target check fails.";

export const SITES = Object.freeze({
  estate1: { directory: "dholera-estate-1", port: 3212, website: "dholera-estate-1", secret: "ESTATE1_INGEST_SECRET", route: "/api/leads", cmsRoute: "/api/estate1-leads" },
  estate2: { directory: "dholera-estate-2", port: 3213, website: "dholera-estate-2", secret: "ESTATE2_INGEST_SECRET", route: null, cmsRoute: "/api/estate2-leads" },
  estates: { directory: "dholeraestates", port: 3214, website: "dholeraestates", secret: "DHOLERA_ESTATES_INGEST_SECRET", route: null, cmsRoute: "/api/dholera-estates-leads" },
  industrial: { directory: "dholeraindustrial", port: 3215, website: "dholeraindustrial", secret: "INDUSTRIAL_INGEST_SECRET", route: "/api/industrial-leads", cmsRoute: "/api/industrial-leads" },
});

export const CASES = Object.freeze([
  { site: "estate1", kind: "contact", page: "/contact-us", route: "/api/leads", source: "estate1-contact-us-page", legacy: "estate1-contact-messages" },
  { site: "estate1", kind: "enquiry", page: "/", route: "/api/leads", source: "estate1-side-enquiry-form", legacy: "estate1-enquiries" },
  { site: "estate2", kind: "contact", page: "/contact-us", route: "/api/contact-messages", source: "estate2-contact-us-page", legacy: "estate2-contact-messages" },
  { site: "estate2", kind: "enquiry", page: "/", route: "/api/enquiries", source: "estate2-side-enquiry-form", legacy: "estate2-enquiries" },
  { site: "estates", kind: "contact", page: "/contact-us", route: "/api/contact-messages", source: "dholeraestates-contact-us-page", legacy: "dholera-estates-contact-messages" },
  { site: "estates", kind: "enquiry", page: "/", route: "/api/enquiries", source: "dholeraestates-side-enquiry-form", legacy: "dholera-estates-enquiries" },
  { site: "industrial", kind: "contact", page: "/contact", route: "/api/industrial-leads", source: "industrial-contact-us-page", legacy: "industrial-contact-messages" },
  { site: "industrial", kind: "enquiry", page: "/", route: "/api/industrial-leads", source: "industrial-side-enquiry-form", legacy: "industrial-enquiries" },
]);

export function assertExecutionGate(args, env) {
  if ((args.length !== 2 && args.length !== 3) || args[0] !== "--execute" || args[1] !== `--approval=${APPROVAL}` || (args.length === 3 && !args[2].startsWith("--resume="))) {
    throw new Error("Exact separate eight-case owner approval is required before browser execution");
  }
  const forbidden = Object.keys(env).filter((key) => /(?:MONGO|DATABASE|ATLAS|PROD|PAYLOAD_|BLOB_|SMTP|EMAIL|OPENAI|QDRANT|WHATSAPP|TWILIO|VERCEL|NOIDA_STAGING|INGEST_SECRET|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY)/i.test(key));
  if (forbidden.length || env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error(`Inherited service, proxy, or TLS override configuration is forbidden: ${forbidden.sort().join(", ")}`);
  }
}

export function browserRequestDecision({ url, method, postData, headers }, testCase, phase, identity) {
  let parsed;
  try { parsed = new URL(url); } catch { return "block"; }
  const site = SITES[testCase.site];
  if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1" || Number(parsed.port) !== site.port) return "block";
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return "allow";
  if (method.toUpperCase() !== "POST" || phase !== "consented" || parsed.pathname !== testCase.route || parsed.search || parsed.username || parsed.password) return "block";
  const requestKey = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === "x-idempotency-key")?.[1];
  if (typeof requestKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) return "block";
  let data;
  try { data = JSON.parse(postData); } catch { return "block"; }
  if (data?.name !== identity.name || data?.email !== identity.email || data?.phone !== identity.phone || data?.consent !== true) return "block";
  if (testCase.site === "estate1") {
    if (data.type !== testCase.kind || (testCase.kind === "enquiry" && data.source !== "side-enquiry")) return "block";
  } else if (testCase.site === "industrial") {
    if (data.type !== testCase.kind || data.source !== testCase.source) return "block";
  } else if (testCase.kind === "enquiry" && data.source !== testCase.source) return "block";
  return "allow";
}
