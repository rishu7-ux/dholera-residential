import { createProductionMongoIdentityHandler } from "@/lib/production-mongodb-identity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handler = createProductionMongoIdentityHandler(process.env);

export const POST = handler;
