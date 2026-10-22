// Build-process guard only; never imported by application runtime code.
import net from "node:net";
import dns from "node:dns";
import { syncBuiltinESMExports } from "node:module";

function blocked() {
  throw new Error("NOIDA_OFFLINE_BUILD_NETWORK_BLOCKED");
}
net.Socket.prototype.connect = blocked;
for (const key of Object.keys(dns)) {
  if (key === "lookup" || key === "lookupService" || key.startsWith("resolve")) dns[key] = blocked;
}
for (const key of Object.keys(dns.promises)) {
  if (key === "lookup" || key === "lookupService" || key.startsWith("resolve")) dns.promises[key] = blocked;
}
syncBuiltinESMExports();
