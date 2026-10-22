import { buildConfig } from "payload";
import { mongooseAdapter } from "@payloadcms/db-mongodb";

import { CrmOffices, CrmTeams } from "../collections/Crm";
import { assertLocalDemoUri } from "./noida-local-demo-target.mjs";

export async function buildLocalDemoPayloadConfig(uri: string, secret: string) {
  assertLocalDemoUri(uri);
  if (secret.length < 32) throw new Error("Local Payload secret is too short");
  const { Users } = await import("../payload.config");
  return buildConfig({
    secret,
    db: mongooseAdapter({ url: uri, connectOptions: { autoIndex: false }, ensureIndexes: true }),
    admin: { user: "users" },
    collections: [Users, CrmOffices, CrmTeams],
  });
}
