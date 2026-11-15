import { MongoClient } from "mongodb";

import { TARGET, URI, assertCleanEnvironment, assertExactTarget } from "../lib/noida-local-fault-qa.mjs";
import { assertOtherDatabasesUnchanged, readOnlyFaultPreflight, snapshotOtherDatabases } from "../lib/noida-local-fault-preflight.mjs";
import { assertAbsentTarget } from "../lib/noida-local-fault-qa.mjs";

if (process.argv.length === 2 || process.argv[2] === "--plan") {
  if (process.argv.length > 3) throw new Error("Unexpected preflight arguments");
  assertExactTarget();
  console.log(JSON.stringify({ status: "PREPARED_NOT_EXECUTED", target: TARGET, uri: URI, readOnlyChecks: ["loopback PID/listener", "hello", "serverStatus", "getCmdLineOpts", "replSetGetStatus", "target absent", "zero target collections", "other database digests"] }, null, 2));
} else {
  if (process.argv.length !== 3 || process.argv[2] !== "--preflight") {
    throw new Error("Only the explicit read-only preflight mode is allowed");
  }
  assertCleanEnvironment(process.env);
  assertExactTarget();
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  try {
    await client.connect();
    const evidence = await readOnlyFaultPreflight(client, URI);
    const after = await snapshotOtherDatabases(client);
    assertOtherDatabasesUnchanged(evidence.otherDatabases, after);
    const finalNames = (await client.db("admin").command({ listDatabases: 1, nameOnly: true })).databases.map((row) => row.name);
    const targetCollections = (await client.db(TARGET.database).listCollections({}, { nameOnly: true }).toArray()).map((row) => row.name);
    assertAbsentTarget(finalNames, targetCollections);
    console.log(JSON.stringify({ status: "PASS", target: evidence.target, server: evidence.server, targetAbsent: true, targetCollections: 0, otherDatabasesUnchanged: true, otherDatabaseNames: Object.keys(evidence.otherDatabases), otherDatabaseDigests: Object.fromEntries(Object.entries(evidence.otherDatabases).map(([name, row]) => [name, row.digest])) }, null, 2));
  } finally {
    await client.close();
  }
}
