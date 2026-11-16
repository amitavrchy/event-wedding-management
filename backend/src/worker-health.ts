import { readFileSync } from "node:fs";
import { HEARTBEAT_FILE } from "./config";

/** Docker health check: the worker must have completed a run in the last three minutes. */
try {
  const last = Number(readFileSync(HEARTBEAT_FILE, "utf8"));
  process.exit(Math.floor(Date.now() / 1000) - last < 180 ? 0 : 1);
} catch {
  process.exit(1);
}
