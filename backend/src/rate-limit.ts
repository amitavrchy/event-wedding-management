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

@Injectable()
export class RateLimit implements CanActivate, OnModuleDestroy {
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const bucket = req.path?.split("/")[2] || "api";
    const ip = req.ip || req.socket?.remoteAddress;
    const auth = bucket === "auth";
    const key = `${ip}:${auth ? "auth" : req.route?.path || bucket}`;
    const limit = auth
      ? Number(process.env.RATE_LIMIT_AUTH_PER_MINUTE || 20)
      : Number(process.env.RATE_LIMIT_PER_MINUTE || 180);
    await limiter.check(key, { limit, windowSeconds: 60 });
    return true;
  }
  async onModuleDestroy() {
    await limiter.close();
  }
}
