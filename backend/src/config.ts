/**
 * Central runtime configuration helpers. Anything that changes behaviour by
 * environment is read here so the rules stay in one place and are testable.
 */
export const isProduction = () => process.env.NODE_ENV === "production";

/**
 * The sandbox payment provider simulates captured money. It must never run in
 * production, even if PAYMENT_MODE is left as "sandbox" in a copied .env file.
 */
export const sandboxPaymentsEnabled = () =>
  process.env.PAYMENT_MODE === "sandbox" && !isProduction();

export const paymentMode = () =>
  sandboxPaymentsEnabled() ? "sandbox" : "disabled";

export const appUrl = () =>
  (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** File the worker touches after each run; read by the container health check. */
export const HEARTBEAT_FILE = process.env.WORKER_HEARTBEAT_FILE || "/tmp/worker-heartbeat";
