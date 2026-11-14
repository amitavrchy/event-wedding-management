import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { totp, verifyTotp, base32Encode, hotp, sealSecret, openSecret } from "../src/security/totp";
import { sniff } from "../src/storage";
import { featuresFor, occasionDefaults } from "../src/features";
import { render } from "../src/notify/templates";

test("TOTP matches the RFC 6238 SHA-1 reference vectors", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  // RFC 6238 Appendix B (8 digits) truncated to the last 6 digits.
  assert.equal(totp(secret, 59 * 1000), "287082");
  assert.equal(totp(secret, 1111111109 * 1000), "081804");
  assert.equal(totp(secret, 1234567890 * 1000), "005924");
  assert.equal(hotp(Buffer.from("12345678901234567890"), 0), "755224");
  assert.ok(verifyTotp(secret, totp(secret, Date.now() - 30000)));
  assert.ok(!verifyTotp(secret, "12345"));
  assert.equal(openSecret(sealSecret(secret)), secret);
});

test("uploads are checked by their real bytes, not the declared type", () => {
  assert.equal(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniff(Buffer.from("%PDF-1.7")), "application/pdf");
  assert.equal(sniff(Buffer.from("<script>alert(1)</script>")), undefined);
});

test("each occasion shows only its own tools; hosts can add and hide extras", () => {
  const wedding = featuresFor({ eventType: "WEDDING" });
  const birthday = featuresFor({ eventType: "BIRTHDAY" });
  const corporate = featuresFor({ eventType: "CORPORATE" });
  assert.ok(wedding.includes("sides") && wedding.includes("costSplit"));
  assert.ok(!birthday.includes("sides") && !birthday.includes("seating"));
  assert.ok(!corporate.includes("gifts") && corporate.includes("checkIn"));
  for (const core of ["checklist", "budget", "guests", "vendors"]) assert.ok(birthday.includes(core));
  const custom = featuresFor({ eventType: "BIRTHDAY", enabledFeatures: ["seating"], disabledFeatures: ["gifts", "budget"] });
  assert.ok(custom.includes("seating"));
  assert.ok(!custom.includes("gifts"));
  assert.ok(custom.includes("budget"), "core tools cannot be hidden");
  assert.ok(Object.keys(occasionDefaults).length >= 13);
});

test("transactional messages render in Bangla and English", () => {
  assert.match(render("phoneOtp", "bn", { code: "123456" }).body, /১০ মিনিট/);
  assert.match(render("phoneOtp", "en", { code: "123456" }).body, /123456/);
});

// ---------------------------------------------------------------------------
// HTTP-level tests against the real Nest application.
// ---------------------------------------------------------------------------
const enabled = Boolean(process.env.TEST_DATABASE_URL);
let base = "";
let app: any;
let outbox: { channel: string; to: string; body: string }[] = [];

before(async () => {
  if (!enabled) return;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.NODE_ENV = "test";
  process.env.RATE_LIMIT_AUTH_PER_MINUTE = "10000";
  process.env.RATE_LIMIT_PER_MINUTE = "10000";
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_DIR = mkdtempSync(join(tmpdir(), "ayojon-uploads-"));
  delete process.env.REDIS_URL;
  // HTTP tests use the compiled build: Nest dependency injection needs the
  // decorator metadata that tsc emits (tsx/esbuild does not).
  // @ts-ignore -- compiled output has no type declarations
  const { createApp } = await import("../dist/main.js");
  // @ts-ignore
  const channels = await import("../dist/notify/channels.js");
  outbox = channels.consoleOutbox;
  app = await createApp(process.env.TEST_LOGS ? {} : { logger: false });
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;
});
after(async () => {
  await app?.close();
});

type Jar = Map<string, string>;
async function call(path: string, init: { method?: string; body?: unknown; token?: string; jar?: Jar; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...init.headers };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.jar?.size) headers.Cookie = [...init.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const response = await fetch(`${base}/${path}`, {
    method: init.method || (init.body ? "POST" : "GET"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (init.jar)
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const [name, ...rest] = pair.split("=");
      const value = rest.join("=");
      if (value) init.jar.set(name, value);
      else init.jar.delete(name);
    }
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}
async function poll<T>(fn: () => T | undefined, ms = 10000): Promise<T> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const value = fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("Timed out waiting");
}
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const codeFor = (to: string) =>
  poll(() => {
    const message = [...outbox].reverse().find((m) => m.to === to && /\b\d{6}\b/.test(m.body));
    return message?.body.match(/\b(\d{6})\b/)?.[1];
  });

test("mobile sessions: refresh rotates, reuse of an old token revokes the session", { skip: !enabled }, async () => {
  const email = `mobile-${unique()}@test.local`;
  const registered = await call("auth/register", {
    body: { email, password: "a-strong-password", fullName: "Mobile User", client: "mobile", deviceName: "Pixel" },
  });
  assert.equal(registered.status, 201);
  assert.ok(registered.data.accessToken && registered.data.refreshToken);
  assert.equal(registered.data.user.emailVerified, false);

  const me = await call("auth/me", { token: registered.data.accessToken });
  assert.equal(me.data.email, email);

  const first = await call("auth/refresh", { body: { refreshToken: registered.data.refreshToken } });
  assert.equal(first.status, 200);
  assert.notEqual(first.data.refreshToken, registered.data.refreshToken);

  // A replay within the grace window asks the client to retry, without revoking.
  const replay = await call("auth/refresh", { body: { refreshToken: registered.data.refreshToken } });
  assert.equal(replay.status, 409);
  assert.equal((await call("auth/me", { token: first.data.accessToken })).status, 200);

  const second = await call("auth/refresh", { body: { refreshToken: first.data.refreshToken } });
  assert.equal(second.status, 200);

  const logout = await call("auth/logout", { body: { refreshToken: second.data.refreshToken } });
  assert.equal(logout.status, 200);
  const afterLogout = await call("auth/refresh", { body: { refreshToken: second.data.refreshToken } });
  assert.equal(afterLogout.status, 401);
});

test("web sessions use httpOnly cookies and require the client header for writes", { skip: !enabled }, async () => {
  const jar: Jar = new Map();
  const email = `web-${unique()}@test.local`;
  const registered = await call("auth/register", { jar, body: { email, password: "a-strong-password", fullName: "Web User" } });
  assert.equal(registered.status, 201);
  assert.equal(registered.data.accessToken, undefined, "web never receives tokens in the body");
  assert.ok(jar.get("utsab_at") && jar.get("utsab_rt"));
  assert.equal((await call("auth/me", { jar })).status, 200);

  const noHeader = await call("events", { jar, body: { title: "Cookie event", budgetMinor: 1000, guestCapacity: 10 } });
  assert.equal(noHeader.status, 403, "cookie-authenticated writes need the client header (CSRF)");
  const created = await call("events", {
    jar,
    headers: { "x-ayojon-client": "web" },
    body: { title: "Cookie event", eventType: "BIRTHDAY", budgetMinor: 1000, guestCapacity: 10 },
  });
  assert.equal(created.status, 201);
  assert.ok(created.data.features.includes("gifts"));
  assert.ok(!created.data.features.includes("sides"));

  const refreshed = await call("auth/refresh", { jar, body: {} });
  assert.equal(refreshed.status, 200);
  assert.equal(refreshed.data.user.email, email);

  const socket = await call("auth/socket-token", { jar });
  assert.ok(socket.data.token);

  await call("auth/logout", { jar, body: {} });
  assert.equal((await call("auth/me", { jar })).status, 401);
});

test("email verification, password reset and lockout", { skip: !enabled }, async () => {
  const email = `verify-${unique()}@test.local`;
  const registered = await call("auth/register", {
    body: { email, password: "first-password-1", fullName: "Verify Me", client: "mobile" },
  });
  const token = registered.data.accessToken;
  const code = await codeFor(email);
  assert.equal((await call("auth/email/verify", { token, body: { code: "000000" === code ? "111111" : "000000" } })).status, 400);
  const verified = await call("auth/email/verify", { token, body: { code } });
  assert.equal(verified.status, 200);
  assert.equal(verified.data.emailVerified, true);

  // Forgot password never reveals whether an account exists.
  const missing = await call("auth/password/forgot", { body: { email: `nobody-${unique()}@test.local` } });
  assert.equal(missing.status, 200);
  outbox.length = 0;
  assert.equal((await call("auth/password/forgot", { body: { email } })).status, 200);
  const resetMail = await poll(() => outbox.find((m) => m.to === email && m.body.includes("reset-password?token=")));
  const resetToken = resetMail.body.match(/token=([\w-]+)/)![1];
  assert.equal((await call("auth/password/reset", { body: { token: resetToken, password: "second-password-2" } })).status, 200);
  assert.equal((await call("auth/password/reset", { body: { token: resetToken, password: "third-password-3" } })).status, 400);
  // Reset signs out every device.
  assert.equal((await call("auth/me", { token })).status, 401);

  for (let i = 0; i < 5; i++)
    assert.equal((await call("auth/login", { body: { email, password: "wrong-password!" } })).status, 401);
  const locked = await call("auth/login", { body: { email, password: "second-password-2" } });
  assert.equal(locked.status, 429);
});

test("two-factor sign-in with an authenticator app", { skip: !enabled }, async () => {
  const email = `totp-${unique()}@test.local`;
  const password = "totp-password-1";
  const registered = await call("auth/register", { body: { email, password, fullName: "Two Factor", client: "mobile" } });
  const token = registered.data.accessToken;
  const setup = await call("auth/2fa/setup", { token, body: {} });
  assert.match(setup.data.otpauthUrl, /^otpauth:\/\/totp\/Ayojon/);
  const enabled2fa = await call("auth/2fa/enable", { token, body: { code: totp(setup.data.secret) } });
  assert.equal(enabled2fa.data.twoFactorEnabled, true);

  const login = await call("auth/login", { body: { email, password, client: "mobile" } });
  assert.equal(login.data.twoFactorRequired, true);
  assert.equal(login.data.accessToken, undefined);
  const wrong = await call("auth/login/2fa", { body: { challenge: login.data.challenge, code: "000000" } });
  assert.equal(wrong.status, 401);
  const ok = await call("auth/login/2fa", { body: { challenge: login.data.challenge, code: totp(setup.data.secret) } });
  assert.equal(ok.status, 200);
  assert.ok(ok.data.accessToken);
});

test("phone verification by SMS code and account deletion", { skip: !enabled }, async () => {
  const email = `phone-${unique()}@test.local`;
  const registered = await call("auth/register", { body: { email, password: "phone-password-1", fullName: "Phone User", client: "mobile" } });
  const token = registered.data.accessToken;
  const number = `017${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  const started = await call("auth/phone/start", { token, body: { phone: number } });
  assert.equal(started.status, 200);
  assert.equal(started.data.phone, `+880${number.slice(1)}`);
  const code = await codeFor(started.data.phone);
  const verified = await call("auth/phone/verify", { token, body: { code } });
  assert.equal(verified.data.phoneVerified, true);

  assert.equal((await call("auth/devices", { token, body: { platform: "android", token: "x".repeat(40) } })).status, 200);
  assert.equal((await call("auth/me", { token, method: "DELETE", body: { password: "wrong" } })).status, 401);
  assert.equal((await call("auth/me", { token, method: "DELETE", body: { password: "phone-password-1" } })).status, 200);
  assert.equal((await call("auth/login", { body: { email, password: "phone-password-1" } })).status, 401);
});

test("uploads: allowed types only, verified by content, owner-scoped", { skip: !enabled }, async () => {
  const registered = await call("auth/register", {
    body: { email: `upload-${unique()}@test.local`, password: "upload-password-1", fullName: "Uploader", client: "mobile" },
  });
  const token = registered.data.accessToken;
  assert.equal((await call("uploads", { token, body: { purpose: "VENDOR_PORTFOLIO", contentType: "text/html", sizeBytes: 10 } })).status, 400);
  assert.equal((await call("uploads", { token, body: { purpose: "AVATAR", contentType: "image/png", sizeBytes: 50 * 1024 * 1024 } })).status, 400);

  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
  const slot = await call("uploads", { token, body: { purpose: "VENDOR_PORTFOLIO", contentType: "image/png", sizeBytes: png.length } });
  assert.equal(slot.status, 201);
  await fetch(`${base.replace(/\/api$/, "")}${slot.data.upload.url}`, { method: "PUT", body: png, headers: { "Content-Type": "image/png" } });
  const done = await call(`uploads/${slot.data.id}/complete`, { token, body: {} });
  assert.equal(done.data.status, "READY");
  assert.match(done.data.url, /\/api\/uploads\/files\/public\//);

  // A file that claims to be an image but is not is rejected and removed.
  const fake = await call("uploads", { token, body: { purpose: "VENDOR_PORTFOLIO", contentType: "image/jpeg", sizeBytes: 20 } });
  await fetch(`${base.replace(/\/api$/, "")}${fake.data.upload.url}`, { method: "PUT", body: "<svg onload=alert(1)>", headers: { "Content-Type": "image/jpeg" } });
  assert.equal((await call(`uploads/${fake.data.id}/complete`, { token, body: {} })).status, 400);

  const other = await call("auth/register", {
    body: { email: `upload2-${unique()}@test.local`, password: "upload-password-1", fullName: "Other", client: "mobile" },
  });
  assert.equal((await call(`uploads/${slot.data.id}/complete`, { token: other.data.accessToken, body: {} })).status, 404);
});

test("sandbox payments are refused in production", async () => {
  const { sandboxPaymentsEnabled } = await import("../src/config");
  const previous = { mode: process.env.PAYMENT_MODE, env: process.env.NODE_ENV };
  try {
    process.env.PAYMENT_MODE = "sandbox";
    process.env.NODE_ENV = "production";
    assert.equal(sandboxPaymentsEnabled(), false);
    process.env.NODE_ENV = "test";
    assert.equal(sandboxPaymentsEnabled(), true);
  } finally {
    process.env.PAYMENT_MODE = previous.mode;
    process.env.NODE_ENV = previous.env;
  }
});
