import assert from "node:assert/strict";
import test from "node:test";

import { validateMongoTestTarget } from "../../lib/mongodb-test-target.ts";

const TEST_HOSTNAME = "cluster0.zshxfui.mongodb.net";
const TEST_DATABASE = "omana-phase5-test-2";
const dummyCredentials = "test-user:test-password";

function testUri(options = "authSource=admin") {
  return `mongodb+srv://${dummyCredentials}@${TEST_HOSTNAME}/${TEST_DATABASE}?${options}`;
}

test("accepts only the approved TEST cluster and database", () => {
  const target = validateMongoTestTarget(testUri());

  assert.equal(target.hostname, TEST_HOSTNAME);
  assert.equal(target.databaseName, TEST_DATABASE);
});

test("accepts standard non-security Atlas options and explicit secure TLS", () => {
  const target = validateMongoTestTarget(
    testUri("authSource=admin&retryWrites=true&w=majority&appName=phase5-test&tls=true"),
  );

  assert.equal(target.hostname, TEST_HOSTNAME);
  assert.equal(target.databaseName, TEST_DATABASE);
});

test("rejects another hostname", () => {
  assert.throws(() =>
    validateMongoTestTarget(
      `mongodb+srv://${dummyCredentials}@cluster0.oqcardp.mongodb.net/${TEST_DATABASE}?authSource=admin`,
    ),
  );
  assert.throws(() =>
    validateMongoTestTarget(
      `mongodb+srv://${dummyCredentials}@other.example.mongodb.net/${TEST_DATABASE}?authSource=admin`,
    ),
  );
});

test("rejects another database name", () => {
  assert.throws(() =>
    validateMongoTestTarget(
      `mongodb+srv://${dummyCredentials}@${TEST_HOSTNAME}/other-test?authSource=admin`,
    ),
  );
});

test("rejects malformed and non-SRV connection strings", () => {
  assert.throws(() => validateMongoTestTarget("not-a-mongodb-connection-string"));
  assert.throws(() =>
    validateMongoTestTarget(
      `mongodb://${dummyCredentials}@${TEST_HOSTNAME}/${TEST_DATABASE}?authSource=admin`,
    ),
  );
});

test("rejects missing and incorrect authentication sources", () => {
  assert.throws(() =>
    validateMongoTestTarget(
      `mongodb+srv://${dummyCredentials}@${TEST_HOSTNAME}/${TEST_DATABASE}`,
    ),
  );
  assert.throws(() =>
    validateMongoTestTarget(testUri("authSource=other")),
  );
});

test("requires explicit admin authentication source", () => {
  assert.throws(() =>
    validateMongoTestTarget(
      testUri("authSource=admin&AUTHsource=admin"),
    ),
  );
});

test("rejects TLS settings that disable verified TLS", () => {
  const unsafeOptions = [
    "tls=false",
    "ssl=false",
    "tlsInsecure=true",
    "tlsAllowInvalidCertificates=true",
    "tlsAllowInvalidHostnames=true",
    "sslValidate=false",
    "sslInvalidHostNameAllowed=true",
    "tlsCAFile=%2Ftmp%2Ftest-ca.pem",
  ];

  for (const option of unsafeOptions) {
    assert.throws(() => validateMongoTestTarget(testUri(`authSource=admin&${option}`)));
  }
});

test("rejects duplicate security-sensitive parameters case-insensitively", () => {
  assert.throws(() =>
    validateMongoTestTarget(testUri("authSource=admin&AUTHsource=admin")),
  );
  assert.throws(() =>
    validateMongoTestTarget(testUri("authSource=admin&tls=true&TLS=true")),
  );
});

test("rejects connection routing and authentication overrides", () => {
  assert.throws(() => validateMongoTestTarget(testUri("authSource=admin&proxyHost=localhost")));
  assert.throws(() => validateMongoTestTarget(testUri("authSource=admin&authMechanism=PLAIN")));
  assert.throws(() => validateMongoTestTarget(testUri("authSource=admin&replicaSet=other")));
});

test("rejects a missing TEST URI without a fallback", () => {
  assert.throws(() => validateMongoTestTarget(undefined));
});

test("rejects process-wide disabled TLS certificate verification", () => {
  const previousValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  try {
    assert.throws(() => validateMongoTestTarget(testUri()));
  } finally {
    if (previousValue === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousValue;
    }
  }
});
