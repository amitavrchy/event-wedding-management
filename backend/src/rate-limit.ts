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
    const key = req.ip || req.socket.remoteAddress;
    const now = Date.now();
    if (this.hits.size > 10000)
      for (const [key, value] of this.hits)
        if (value.reset < now) this.hits.delete(key);
    const hit = this.hits.get(key);
    if (!hit || hit.reset < now) {
      this.hits.set(key, { count: 1, reset: now + 60000 });
      return true;
    }
    if (++hit.count > 120)
      throw new HttpException("Too many requests. Try again in a minute.", 429);
    return true;
  }
}
