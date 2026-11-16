import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import { Database } from "../prisma";
import { isProduction } from "../config";

export type Client = "web" | "mobile";
export const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_DAYS: Record<Client, number> = { web: 30, mobile: 90 };
/** Two tabs refreshing at once present the same token; tolerate that briefly. */
const ROTATION_GRACE_MS = 15000;

export const ACCESS_COOKIE = "utsab_at";
export const REFRESH_COOKIE = "utsab_rt";

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function readCookie(req: { headers: Record<string, any> }, name: string) {
  const header: string | undefined = req.headers?.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}

type User = { id: string; role: string; fullName: string };

/** Short-lived cache so the guard does not hit the database on every request. */
const activeCache = new Map<string, { active: boolean; until: number }>();
export function forgetSession(id: string) {
  activeCache.delete(id);
}

@Injectable()
export class Sessions {
  constructor(
    private db: Database,
    private jwt: JwtService,
  ) {}

  accessToken(user: User, sessionId: string) {
    return this.jwt.sign(
      { sub: user.id, role: user.role, fullName: user.fullName, sid: sessionId, typ: "access" },
      { expiresIn: ACCESS_TTL_SECONDS },
    );
  }

  /** A two-minute token the browser hands to Socket.IO (cookies do not reach the socket host). */
  socketToken(identity: { sub: string; role: string; fullName: string; sid: string }) {
    return this.jwt.sign(
      { sub: identity.sub, role: identity.role, fullName: identity.fullName, sid: identity.sid, typ: "socket" },
      { expiresIn: 120 },
    );
  }

  async create(
    user: User,
    meta: { client: Client; deviceName?: string; userAgent?: string; ip?: string },
  ) {
    const secret = randomBytes(32).toString("base64url");
    const session = await this.db.session.create({
      data: {
        userId: user.id,
        refreshHash: sha256(secret),
        client: meta.client,
        deviceName: meta.deviceName?.slice(0, 100),
        userAgent: meta.userAgent?.slice(0, 300),
        ip: meta.ip,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS[meta.client] * 86400000),
      },
    });
    return {
      session,
      accessToken: this.accessToken(user, session.id),
      refreshToken: `${session.id}.${secret}`,
    };
  }

  /**
   * Rotates a refresh token. Presenting an already-rotated token outside the
   * grace window is treated as theft and revokes the session.
   */
  async refresh(refreshToken: string, ip?: string) {
    const [id, secret] = refreshToken.split(".");
    if (!id || !secret) throw new UnauthorizedException("Session expired");
    const session = await this.db.session.findUnique({ where: { id }, include: { user: true } });
    const hash = sha256(secret);
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.deletedAt)
      throw new UnauthorizedException("Session expired");
    if (session.refreshHash !== hash) {
      if (session.previousHash === hash) {
        if (session.rotatedAt && Date.now() - +session.rotatedAt < ROTATION_GRACE_MS)
          throw new ConflictException("Session was just refreshed. Retry with the latest token.");
        await this.revoke(session.id);
      }
      throw new UnauthorizedException("Session expired");
    }
    const next = randomBytes(32).toString("base64url");
    const rotated = await this.db.session.updateMany({
      where: { id, refreshHash: hash, revokedAt: null },
      data: {
        refreshHash: sha256(next),
        previousHash: hash,
        rotatedAt: new Date(),
        lastUsedAt: new Date(),
        ip,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS[session.client as Client] * 86400000),
      },
    });
    if (!rotated.count) throw new ConflictException("Session was just refreshed. Retry with the latest token.");
    return {
      user: session.user,
      session,
      accessToken: this.accessToken(session.user, session.id),
      refreshToken: `${session.id}.${next}`,
    };
  }

  async isActive(sessionId: string) {
    const cached = activeCache.get(sessionId);
    if (cached && cached.until > Date.now()) return cached.active;
    const session = await this.db.session.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true, expiresAt: true },
    });
    const active = Boolean(session && !session.revokedAt && session.expiresAt > new Date());
    if (activeCache.size > 20000) activeCache.clear();
    activeCache.set(sessionId, { active, until: Date.now() + 30000 });
    return active;
  }

  async revoke(sessionId: string) {
    await this.db.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    forgetSession(sessionId);
  }

  async revokeAll(userId: string, exceptSessionId?: string) {
    const sessions = await this.db.session.findMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      select: { id: true },
    });
    await this.db.session.updateMany({
      where: { id: { in: sessions.map((s) => s.id) } },
      data: { revokedAt: new Date() },
    });
    sessions.forEach((s) => forgetSession(s.id));
  }

  setCookies(res: any, accessToken: string, refreshToken: string, client: Client = "web") {
    const secure = isProduction();
    res.cookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_TTL_SECONDS * 1000,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/api/auth",
      maxAge: REFRESH_TTL_DAYS[client] * 86400000,
    });
  }

  clearCookies(res: any) {
    res.clearCookie(ACCESS_COOKIE, { path: "/" });
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  }
}
