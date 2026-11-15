import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { prepareNoidaLocalStagingEnvironment } from "../lib/noida-staging-runtime.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (readdirSync(root).some((name) => /^\.env(?:\.|$)/.test(name) && name !== ".env.example")) {
  throw new Error("Noida local staging requires environment injection without Next env files");
}

// Validation precedes Next startup, Payload initialization and every MongoDB connection.
const env = prepareNoidaLocalStagingEnvironment(process.env);
const child = spawn(
  process.execPath,
  [resolve(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-H", "127.0.0.1", "-p", "3101"],
  { cwd: root, env, stdio: "inherit" },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => { process.exitCode = code ?? 1; });
