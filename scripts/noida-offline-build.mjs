import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const projects = new Set([
  "noida-payload-3.90.2-candidate", "omana-projects", "dholera-estate-1",
  "dholera-estate-2", "dholeraestates", "dholeraindustrial",
]);
const project = process.argv[2];
assert.ok(projects.has(project), "An exact approved local project name is required");
const bundler = process.argv[3] ?? "--webpack";
assert.ok(["--webpack", "--turbopack"].includes(bundler) && process.argv.length <= 4, "Only a supported local build bundler is allowed");
const root = resolve(import.meta.dirname, "../..", project);
const guard = resolve(import.meta.dirname, "noida-offline-build-network.mjs");
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_ENV: "production",
  // @next/env honors this flag: do not import local/production credentials.
  __NEXT_PROCESSED_ENV: "true",
  NEXT_TELEMETRY_DISABLED: "1",
  PAYLOAD_SECRET: randomBytes(32).toString("hex"),
  MONGODB_URI: "mongodb://127.0.0.1:1/noida_offline_build?serverSelectionTimeoutMS=500",
  PAYLOAD_CMS_URL: "http://127.0.0.1:1",
};
// The native Turbopack worker uses its own socket channel. Webpack can use
// the stronger in-process socket guard; both modes receive only local targets.
if (bundler === "--webpack") env.NODE_OPTIONS = `--import=${guard}`;
// Fail closed if the installed Next env loader starts importing .env files.
const probe = spawnSync(process.execPath, ["--input-type=module", "-e", `
  import { createRequire } from "node:module";
  const require = createRequire(${JSON.stringify(pathToFileURL(resolve(root, "package.json")).href)});
  require("@next/env").loadEnvConfig(process.cwd());
  const allowed = new Set(${JSON.stringify([...Object.keys(env), "__CF_USER_TEXT_ENCODING"])});
  const unexpected = Object.keys(process.env).filter(key => !allowed.has(key));
  if (unexpected.length) process.exit(2);
`], { cwd: root, env, stdio: "ignore" });
assert.equal(probe.status, 0, "Offline environment isolation probe failed");
console.log(JSON.stringify({ project, mode: `production-${bundler.slice(2)}`, services: "loopback-only", credentials: "not-loaded" }));
const result = spawnSync(process.execPath, [
  resolve(root, "node_modules/next/dist/bin/next"), "build", bundler,
], { cwd: root, env, stdio: "inherit" });
if (result.error) throw new Error("Offline build process could not start");
process.exitCode = result.status ?? 1;
