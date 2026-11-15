import { validateMongoRestoreTestTarget } from "./mongodb-restore-test-target";
import { validateMongoTestTarget } from "./mongodb-test-target";

const EXPECTED_WRITER_USERNAME = "noida_test_writer";
const EXPECTED_READER_USERNAME = "noida_test_reader";
const PLACEHOLDER_CREDENTIAL = /^(?:test_writer_(?:username|password)|placeholder|change-?me|your[-_].*)$/i;

function decodedCredential(value: string, label: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`${label} must be valid URL-encoded text`);
  }
}

export function validateMongoCrmTestWriterTarget(
  writerValue: string | undefined,
  readerValue: string | undefined,
  restoreValue: string | undefined,
  productionValue?: string,
) {
  if (productionValue?.trim()) {
    throw new Error("MONGODB_URI must remain unset during CRM TEST integration");
  }
  if (!writerValue?.trim()) {
    throw new Error("MONGODB_CRM_TEST_WRITER_URI is required for CRM TEST integration");
  }

  const writer = validateMongoTestTarget(writerValue);
  const writerUrl = new URL(writer.uri);
  const writerUsername = decodedCredential(writerUrl.username, "Writer username");
  const writerPassword = decodedCredential(writerUrl.password, "Writer password");

  if (writerUsername !== EXPECTED_WRITER_USERNAME) {
    throw new Error("CRM TEST writer URI must use the dedicated noida_test_writer user");
  }
  if (!writerPassword || PLACEHOLDER_CREDENTIAL.test(writerPassword)) {
    throw new Error("CRM TEST writer URI must contain a non-placeholder password");
  }

  const reader = validateMongoTestTarget(readerValue, productionValue);
  const readerUrl = new URL(reader.uri);
  if (decodedCredential(readerUrl.username, "Reader username") !== EXPECTED_READER_USERNAME) {
    throw new Error("MONGODB_TEST_URI must preserve the dedicated noida_test_reader user");
  }
  if (writer.uri === reader.uri) {
    throw new Error("CRM TEST writer and reader credentials must remain separate");
  }

  const restore = validateMongoRestoreTestTarget(restoreValue);
  if (writer.uri === restore.uri) {
    throw new Error("CRM TEST writer and restore credentials must remain separate");
  }

  return {
    databaseName: writer.databaseName,
    hostname: writer.hostname,
    uri: writer.uri,
    username: writerUsername,
    expectedAtlasRoles: [{ role: "readWrite", database: writer.databaseName }],
  };
}
