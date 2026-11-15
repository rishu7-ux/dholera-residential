import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { getPayload } from "payload";
import { validateMongoTestTarget } from "../lib/mongodb-test-target.ts";

const env = parseEnv(readFileSync(resolve(".env.test.local"), "utf8"));
const { uri, databaseName } = validateMongoTestTarget(env.MONGODB_TEST_URI, process.env.MONGODB_URI);
assert.equal(Boolean(process.env.BLOB_READ_WRITE_TOKEN), false, "no Blob token may be used by this TEST upload");
process.env.MONGODB_URI = uri;
process.env.MONGODB_TEST_URI = uri;
process.env.PAYLOAD_SECRET = "isolated-candidate-storage-test-secret";
const { default: config } = await import("../payload.config.ts");
const payload = await getPayload({ config });
let id;
let filename;
try {
  const data = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64");
  const media = await payload.create({
    collection: "media", overrideAccess: true,
    data: { alt: "Synthetic candidate storage compatibility test" },
    file: { data, mimetype: "image/png", name: `noida-candidate-storage-${Date.now()}.png`, size: data.length },
  });
  id = media.id;
  filename = media.filename;
  assert.ok(filename);
  assert.equal(existsSync(resolve("media", filename)), true, "TEST upload uses local media storage without a Blob token");
  const readback = await payload.findByID({ collection: "media", id, overrideAccess: true });
  assert.equal(readback.alt, "Synthetic candidate storage compatibility test");
  console.log(JSON.stringify({ result: "PASS", database: databaseName, storage: "local fallback", mediaReadback: "PASS" }));
} finally {
  if (id) await payload.delete({ collection: "media", id, overrideAccess: true });
  if (filename) assert.equal(existsSync(resolve("media", filename)), false, "synthetic TEST upload file was removed");
  await payload.destroy();
}
