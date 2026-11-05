import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from "@nestjs/common";
@Injectable()
export class RateLimit implements CanActivate {
  private hits = new Map<string, { count: number; reset: number }>();
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const bucket = req.path?.split("/")[2] || "api";
    const key = `${req.ip || req.socket.remoteAddress}:${bucket === "auth" ? "auth" : req.route?.path || bucket}`;
    const now = Date.now();
    if (this.hits.size > 10000)
      for (const [key, value] of this.hits)
        if (value.reset < now) this.hits.delete(key);
    const hit = this.hits.get(key);
    if (!hit || hit.reset < now) {
      this.hits.set(key, { count: 1, reset: now + 60000 });
      return true;
    }
    if (++hit.count > (bucket === "auth" ? 20 : 180))
      throw new HttpException("Too many requests. Try again in a minute.", 429);
    return true;
  }
}
