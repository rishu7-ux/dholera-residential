import assert from "node:assert/strict";
import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";

import { ALLOWED_COLLECTIONS, TARGET, URI, assertExactTarget, assertRequiredIndexes, assertScope, digest } from "../lib/noida-local-atomic-qa.mjs";
import { assertOtherDatabasesUnchanged, assertServerMetadata, snapshotOtherDatabases } from "../lib/noida-local-atomic-preflight.mjs";
import { assertCleanEnvironment, } from "../lib/noida-local-fault-qa.mjs";
import { verifyLocalDemoServer, safeMongoFailure } from "../lib/noida-local-demo-target.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const MARKER = "noida-atomic-cef8e639-ebd2-412b-8bff-d0d7ff066a2c";
const evidencePath = resolve(ROOT, `.artifacts/noida-local-atomic-qa-20261021/${MARKER}.json`);
const postflightPath = resolve(ROOT, `.artifacts/noida-local-atomic-qa-20261021/${MARKER}.postflight.json`);
assert.deepEqual(process.argv.slice(2), ["--read-only-postflight"]);
assert.equal(process.cwd(), ROOT);
assert.deepEqual(process.execArgv, ["--import", "tsx"]);
assertCleanEnvironment(process.env);
assert.equal(process.env.PATH, "/usr/bin:/bin:/usr/sbin");
assertExactTarget(URI);
const info = lstatSync(evidencePath);
assert.ok(info.isFile() && !info.isSymbolicLink() && realpathSync(evidencePath) === evidencePath && (info.mode & 0o777) === 0o600);
const manifest = JSON.parse(readFileSync(evidencePath, "utf8"));
assert.equal(manifest.runMarker, MARKER);
assert.deepEqual(manifest.target, TARGET);
assert.equal(manifest.status, "FAIL_STOPPED");
assert.equal(manifest.attempts.length, 1);
assert.equal(manifest.attempts[0].name, "estate-success");

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
try {
  await client.connect();
  const server = await verifyLocalDemoServer(client, { requireEmpty: false });
  const admin = client.db("admin");
  const [hello, options, replica] = await Promise.all([
    admin.command({ hello: 1 }), admin.command({ getCmdLineOpts: 1 }), admin.command({ replSetGetStatus: 1 }),
  ]);
  assertServerMetadata(hello, options, replica);
  const otherDatabases = await snapshotOtherDatabases(client);
  assertOtherDatabasesUnchanged(manifest.preflight.otherDatabases, otherDatabases);

  const db = client.db(TARGET.database);
  assert.equal(db.databaseName, TARGET.database);
  const entries = await db.listCollections({}, { nameOnly: false }).toArray();
  assert.ok(entries.every((row) => row.type === "collection"));
  const names = entries.map((row) => row.name).sort();
  assert.deepEqual(names, ALLOWED_COLLECTIONS);
  const counts = {};
  const indexes = {};
  const documentDigests = {};
  const leads = [];
  const legacy = [];
  const activities = [];
  let secondaryIndexes = 0;
  for (const name of names) {
    const collection = db.collection(name);
    const rows = await collection.find({}).sort({ _id: 1 }).toArray();
    indexes[name] = await collection.listIndexes().toArray();
    counts[name] = rows.length;
    documentDigests[name] = digest(rows);
    secondaryIndexes += indexes[name].filter((index) => !(Object.keys(index.key ?? {}).length === 1 && index.key._id === 1)).length;
    if (name === "central-leads") leads.push(...rows.map((row) => ({ id: String(row._id), legacyCollection: row.legacyCollection, legacyId: row.legacyId, assignmentSequence: row.assignmentSequence, assignedSalesperson: String(row.assignedSalesperson), consent: row.consent === true })));
    if (name === "estate1-enquiries" || name === "omana-enquiries") legacy.push(...rows.map((row) => ({ collection: name, id: String(row._id) })));
    if (name === "crm-activities") activities.push(...rows.map((row) => ({ id: String(row._id), lead: String(row.lead), event: row.event })));
  }
  const counter = await db.collection("crm-assignment-counters").findOne({});
  const sequence = counter?.sequence ?? 0;
  assertScope({ names, counts, secondaryIndexes, sequence }, 1);
  assertRequiredIndexes(indexes);
  const { auditLeadLinks } = await import("../lib/crm/reconciliation-audit.ts");
  const audit = auditLeadLinks(leads, legacy);
  const oneCommitted = counts["central-leads"] === 1 && counts["estate1-enquiries"] === 1 && counts["omana-enquiries"] === 0 && counts["crm-activities"] === 2 && sequence === 1;
  const linkIntact = audit.centralWithoutLink.length === 0 && audit.centralMissingLegacy.length === 0 && audit.duplicateCentralLinks.length === 0 && audit.orphanLegacy.length === 0;
  const activityIntact = activities.length === 2 && activities.every((row) => row.lead === leads[0]?.id) && activities.map((row) => row.event).sort().join(",") === "assigned,created";
  const seedIntact = documentDigests["crm-offices"] === manifest.seed.snapshot.documentDigests["crm-offices"] && documentDigests.users === manifest.seed.snapshot.documentDigests.users;
  const manifestMatches = leads[0]?.id === manifest.attempts[0].outcome.centralId && legacy[0]?.id === manifest.attempts[0].outcome.legacyId && leads[0]?.legacyId === legacy[0]?.id;
  const result = {
    status: oneCommitted && linkIntact && activityIntact && seedIntact && manifestMatches ? "PASS_READ_ONLY_POSTFLIGHT" : "FAIL_READ_ONLY_POSTFLIGHT",
    marker: MARKER, target: TARGET, server, namespaces: names.length, secondaryIndexes, counts, sequence,
    audit, oneCommitted, linkIntact, activityIntact, seedIntact, manifestMatches,
    otherDatabaseDigests: Object.fromEntries(Object.entries(otherDatabases).map(([name, row]) => [name, row.digest])),
    targetDocumentDigests: documentDigests,
  };
  writeFileSync(postflightPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  assert.equal(result.status, "PASS_READ_ONLY_POSTFLIGHT");
  console.log(JSON.stringify({ status: result.status, evidencePath: postflightPath, counts, sequence, audit, otherDatabasesUnchanged: true }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL_STOPPED", operation: "read-only stopped-run postflight", error: safeMongoFailure(error, "read-only stopped-run postflight") }));
  process.exitCode = 1;
} finally {
  await client.close();
}
