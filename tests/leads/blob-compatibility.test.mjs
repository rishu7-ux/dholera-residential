import assert from "node:assert/strict";
import test from "node:test";

import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";

const config = () => ({
  collections: [{ slug: "media", fields: [], upload: { staticDir: "media" } }],
});

test("Blob plugin preserves local media storage without a token", () => {
  const input = config();
  const output = vercelBlobStorage({ collections: { media: true }, clientUploads: true })(input);
  assert.equal(output, input);
  assert.notEqual(output.collections[0].upload.disableLocalStorage, true);
});

test("Blob plugin wires client uploads with a synthetic token without contacting a store", () => {
  const output = vercelBlobStorage({
    collections: { media: true },
    clientUploads: true,
    token: "vercel_blob_rw_teststore_synthetic",
  })(config());
  assert.equal(output.collections[0].upload.disableLocalStorage, true);
  assert.equal(output.endpoints?.length, 1);
});

test("Blob plugin rejects malformed token format", () => {
  assert.throws(() => vercelBlobStorage({
    collections: { media: true },
    clientUploads: true,
    token: "invalid-synthetic-token",
  })(config()), /Invalid token format/);
});
