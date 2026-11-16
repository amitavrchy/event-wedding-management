import { after, test } from "node:test";
import assert from "node:assert/strict";
import { limiter, rateBucket } from "../src/rate-limit";

after(() => limiter.close());

test("credential endpoints share the strict per-IP auth bucket", () => {
  for (const [method, path] of [
    ["POST", "/api/auth/login"],
    ["POST", "/api/auth/login/2fa"],
    ["POST", "/api/auth/register"],
    ["POST", "/api/auth/password/forgot"],
    ["POST", "/api/auth/password/reset"],
    ["POST", "/api/auth/password/change"],
    ["POST", "/api/auth/email/verify"],
    ["POST", "/api/auth/2fa/disable"],
    ["DELETE", "/api/auth/me"],
  ])
    assert.equal(rateBucket(method, path, path).name, "auth", `${method} ${path}`);
});

test("session upkeep on page loads does not consume the sign-in allowance", () => {
  for (const [method, path] of [
    ["GET", "/api/auth/me"],
    ["GET", "/api/auth/socket-token"],
    ["POST", "/api/auth/refresh"],
    ["POST", "/api/auth/logout"],
  ]) {
    const bucket = rateBucket(method, path, path);
    assert.equal(bucket.name, path, `${method} ${path}`);
    assert.ok(bucket.limit > rateBucket("POST", "/api/auth/login").limit);
  }
  assert.equal(rateBucket("GET", "/api/events", "/api/events").name, "/api/events");
  assert.equal(rateBucket("GET", undefined).name, "api");
});
