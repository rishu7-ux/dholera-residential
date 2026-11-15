import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";

import { validateMongoTestTarget } from "../lib/mongodb-test-target.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = parseEnv(readFileSync(resolve(root, ".env.test.local"), "utf8"));
const { uri } = validateMongoTestTarget(env.MONGODB_TEST_URI, process.env.MONGODB_URI);
const bundler = process.argv.includes("--turbopack") ? "--turbopack" : "--webpack";
const localEnvPath = resolve(root, ".env.local");
const localEnvironmentMask = existsSync(localEnvPath)
  ? Object.fromEntries(
      Object.keys(parseEnv(readFileSync(localEnvPath, "utf8"))).map((name) => [name, ""]),
    )
  : {};
const result = spawnSync(
  process.execPath,
  [resolve(root, "node_modules/next/dist/bin/next"), "build", bundler],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      ...localEnvironmentMask,
      MONGODB_URI: uri,
      MONGODB_TEST_URI: uri,
      PAYLOAD_SECRET: randomBytes(32).toString("hex"),
    },
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
