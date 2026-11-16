import { CanActivate, ExecutionContext, HttpException, Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

type Rule = { limit: number; windowSeconds: number };

/**
 * Fixed-window request limiter. Uses Redis when REDIS_URL is set so limits
 * hold across API instances; falls back to process memory otherwise.
 */
export class Limiter {
  private memory = new Map<string, { count: number; reset: number }>();
  private redis?: Redis;
  constructor() {
    if (process.env.REDIS_URL)
      this.redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false });
    this.redis?.on("error", () => undefined);
  }

  /** Returns the hit count in the current window. */
  async hit(key: string, rule: Rule): Promise<number> {
    if (this.redis?.status === "ready") {
      try {
        const redisKey = `rl:${key}`;
        const [[, count]] = (await this.redis
          .multi()
          .incr(redisKey)
          .expire(redisKey, rule.windowSeconds, "NX")
          .exec()) as [[null, number]];
        return count;
      } catch {
        // Fall through to memory if Redis is briefly unavailable.
      }
    }
    const now = Date.now();
    if (this.memory.size > 10000)
      for (const [k, v] of this.memory) if (v.reset < now) this.memory.delete(k);
    const entry = this.memory.get(key);
    if (!entry || entry.reset < now) {
      this.memory.set(key, { count: 1, reset: now + rule.windowSeconds * 1000 });
      return 1;
    }
    return ++entry.count;
  }

  async check(key: string, rule: Rule, message = "Too many requests. Try again in a minute.") {
    if ((await this.hit(key, rule)) > rule.limit) throw new HttpException(message, 429);
  }

  async close() {
    this.redis?.disconnect();
  }
}

export const limiter = new Limiter();

/**
 * Session upkeep the web client performs on page loads and tab focus. These
 * need a valid session or refresh token, so they cannot be used to guess
 * credentials and use the normal per-route limit instead of the auth limit.
 */
const SESSION_UPKEEP = new Set([
  "GET auth/me",
  "GET auth/sessions",
  "GET auth/socket-token",
  "POST auth/refresh",
  "POST auth/logout",
  "POST auth/logout-all",
  "POST auth/devices",
  "POST auth/devices/remove",
]);

/**
 * Picks the rate-limit bucket for a request path such as `/api/auth/login`.
 * Credential, verification and account-security endpoints share the strict
 * per-IP auth bucket; everything else is limited per route.
 */
export function rateBucket(method: string, path: string | undefined, routePath?: string) {
  const parts = (path || "").split("/").filter(Boolean);
  const bucket = parts[1] || "api";
  const strict = bucket === "auth" && !SESSION_UPKEEP.has(`${method.toUpperCase()} ${parts.slice(1).join("/")}`);
  return {
    name: strict ? "auth" : routePath || bucket,
    limit: strict
      ? Number(process.env.RATE_LIMIT_AUTH_PER_MINUTE || 20)
      : Number(process.env.RATE_LIMIT_PER_MINUTE || 180),
  };
}

@Injectable()
export class RateLimit implements CanActivate, OnModuleDestroy {
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const ip = req.ip || req.socket?.remoteAddress;
    const bucket = rateBucket(req.method || "GET", req.path, req.route?.path);
    await limiter.check(`${ip}:${bucket.name}`, { limit: bucket.limit, windowSeconds: 60 });
    return true;
  }
  async onModuleDestroy() {
    await limiter.close();
  }
}
