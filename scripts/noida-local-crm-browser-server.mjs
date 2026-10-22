import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, symlinkSync } from "node:fs";
import { resolve } from "node:path";

import { assertNoInheritedServices, LOCAL_DEMO } from "../lib/noida-local-demo-target.mjs";

const root = resolve(import.meta.dirname, "..");
const directory = resolve(root, ".artifacts/noida-local-browser-workflow-qa-20261019");
const appRoot = resolve(directory, "app");
const secretPath = resolve(LOCAL_DEMO.directory, "crm-workflow-browser-20261019.secrets.json");
const uri = "mongodb://127.0.0.1:27179/noida-crm-workflow-qa-20261019?replicaSet=noida_demo&directConnection=true";
const mode = process.argv[2];
if (!["--start", "--resume"].includes(mode) || process.argv.slice(3).join("|") !== "--approval=APPROVE LOCAL CRM BROWSER AND HTTP WORKFLOW QA") {
  throw new Error("Exact local browser QA server start and approval flags are required");
}
assertNoInheritedServices(process.env);
const secretInfo = lstatSync(secretPath);
assert.ok(secretInfo.isFile() && !secretInfo.isSymbolicLink() && (secretInfo.mode & 0o777) === 0o600 && realpathSync(secretPath) === secretPath);
const secrets = JSON.parse(readFileSync(secretPath, "utf8"));
assert.ok(typeof secrets.payloadSecret === "string" && secrets.payloadSecret.length >= 32);
assert.ok(typeof secrets.accountPassword === "string" && secrets.accountPassword.length >= 32);
assert.equal(existsSync(appRoot), mode === "--resume", "Server snapshot existence does not match requested start mode");
if (mode === "--start") mkdirSync(appRoot, { recursive: true, mode: 0o700 });
assert.equal(lstatSync(directory).mode & 0o077, 0);
assert.equal(lstatSync(appRoot).mode & 0o077, 0);
assert.equal(realpathSync(appRoot), appRoot);
if (mode === "--start") {
  for (const name of ["app", "collections", "components", "lib", "media", "models", "public", "payload.config.ts", "payload-types.ts", "next.config.ts", "postcss.config.mjs", "package.json", "tsconfig.json"]) {
    cpSync(resolve(root, name), resolve(appRoot, name), { recursive: true, force: false });
  }
  symlinkSync(resolve(root, "node_modules"), resolve(appRoot, "node_modules"), "dir");
}
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
for (const path of ["payload.config.ts", "collections/Crm.ts", "lib/crm/lead-operations.ts", "app/api/crm/reports/route.ts"]) {
  assert.equal(digest(resolve(appRoot, path)), digest(resolve(root, path)), `Current candidate snapshot mismatch: ${path}`);
}
const logPath = resolve(directory, mode === "--resume" ? "server-resume.log" : "server.log");
const logFD = openSync(logPath, "wx", 0o600);
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  USER: process.env.USER,
  TMPDIR: process.env.TMPDIR,
  LANG: process.env.LANG,
  NODE_ENV: "development",
  NEXT_TELEMETRY_DISABLED: "1",
  MONGODB_URI: uri,
  PAYLOAD_SECRET: secrets.payloadSecret,
};
const child = spawn(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-H", "127.0.0.1", "-p", "3101"], {
  cwd: appRoot,
  env,
  stdio: ["ignore", logFD, logFD],
});
console.log(JSON.stringify({ status: "STARTING", pid: child.pid, bind: "127.0.0.1:3101", database: "noida-crm-workflow-qa-20261019", snapshot: appRoot, log: logPath }));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill("SIGTERM"));
child.on("exit", (code, signal) => {
  console.log(JSON.stringify({ status: "EXITED", code, signal }));
  process.exitCode = code ?? 1;
});
