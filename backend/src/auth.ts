import {
  BadRequestException,
  Body,
  CanActivate,
  ConflictException,
  Controller,
  Delete,
  ExecutionContext,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { randomBytes, randomInt } from "node:crypto";
import { Database } from "./prisma";
import { parse, z } from "./validation";
import { ACCESS_COOKIE, Client, REFRESH_COOKIE, Sessions, readCookie, sha256 } from "./security/sessions";
import { newTotpSecret, openSecret, otpauthUrl, sealSecret, verifyTotp } from "./security/totp";
import { Notifier } from "./notify/notifier";
import { link, render } from "./notify/templates";
import { disconnectUser } from "./realtime";

export type Identity = { sub: string; role: string; fullName: string; sid?: string; exp?: number };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
/** Header the web client sends with cookie-authenticated writes (blocks CSRF). */
export const CLIENT_HEADER = "x-ayojon-client";

/**
 * Accepts `Authorization: Bearer <access token>` (mobile, API clients) or the
 * httpOnly access cookie (web). Revoked sessions are rejected within 30 seconds.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private sessions: Sessions,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const bearer = req.headers.authorization?.replace(/^Bearer /, "");
    const token = bearer || readCookie(req, ACCESS_COOKIE);
    if (!token) throw new UnauthorizedException("Please sign in");
    let identity: Identity & { typ?: string };
    try {
      identity = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException("Session expired");
    }
    if (identity.typ !== "access" || !identity.sid || !(await this.sessions.isActive(identity.sid)))
      throw new UnauthorizedException("Session expired");
    if (!bearer && !SAFE_METHODS.has(req.method) && !req.headers[CLIENT_HEADER])
      throw new ForbiddenException("Missing client header");
    req.user = identity;
    return true;
  }
}

const password = z.string().min(10).max(72);
const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(\+?880|0)1[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile number"))
  .transform((v) => `+880${v.replace(/^(\+?880|0)/, "")}`);
const clientMeta = {
  client: z.enum(["web", "mobile"]).default("web"),
  deviceName: z.string().max(100).optional(),
};
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

type CodePurpose = "VERIFY_EMAIL" | "RESET_PASSWORD" | "VERIFY_PHONE";
const CODE_TTL_MINUTES: Record<CodePurpose, number> = {
  VERIFY_EMAIL: 15,
  RESET_PASSWORD: 30,
  VERIFY_PHONE: 10,
};

function profile(user: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone: string | null;
  locale: string;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  totpEnabledAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone,
    locale: user.locale,
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt),
    twoFactorEnabled: Boolean(user.totpEnabledAt),
    createdAt: user.createdAt,
  };
}

@Controller("auth")
export class AuthController {
  constructor(
    private db: Database,
    private jwt: JwtService,
    private sessions: Sessions,
    private notifier: Notifier,
  ) {}

  @Post("register") async register(@Body() body: unknown, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const data = parse(
      z.object({
        email: z.email().toLowerCase(),
        password,
        fullName: z.string().trim().min(2).max(100),
        role: z.enum(["HOST", "VENDOR"]).default("HOST"),
        locale: z.enum(["en", "bn"]).default("en"),
        ...clientMeta,
      }),
      body,
    );
    if (await this.db.user.findUnique({ where: { email: data.email } }))
      throw new ConflictException("Email already registered");
    const user = await this.db.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        role: data.role,
        locale: data.locale,
        passwordHash: await hash(data.password, 12),
      },
    });
    await this.sendEmailVerification(user);
    return this.start(user, data, req, res);
  }

  @Post("login") @HttpCode(200) async login(@Body() body: unknown, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const data = parse(
      z.object({ email: z.email().toLowerCase(), password: z.string().max(100), ...clientMeta }),
      body,
    );
    const user = await this.db.user.findUnique({ where: { email: data.email } });
    if (user?.lockedUntil && user.lockedUntil > new Date())
      throw new HttpException(`Too many attempts. Try again in ${LOCK_MINUTES} minutes or reset your password.`, 429);
    if (!user || user.deletedAt || !(await compare(data.password, user.passwordHash))) {
      if (user && !user.deletedAt) {
        const failed = user.failedLogins + 1;
        await this.db.user.update({
          where: { id: user.id },
          data: {
            failedLogins: failed >= LOCK_AFTER ? 0 : failed,
            lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60000) : undefined,
          },
        });
      }
      throw new UnauthorizedException("Incorrect email or password");
    }
    if (user.failedLogins) await this.db.user.update({ where: { id: user.id }, data: { failedLogins: 0 } });
    if (user.totpEnabledAt)
      return {
        twoFactorRequired: true,
        challenge: this.jwt.sign(
          { sub: user.id, typ: "2fa", client: data.client, deviceName: data.deviceName },
          { expiresIn: 300 },
        ),
      };
    return this.start(user, data, req, res);
  }

  @Post("login/2fa") @HttpCode(200) async secondFactor(@Body() body: unknown, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const data = parse(z.object({ challenge: z.string().max(2000), code: z.string().trim().max(10) }), body);
    let claim: { sub: string; typ: string; client: Client; deviceName?: string };
    try {
      claim = await this.jwt.verifyAsync(data.challenge);
    } catch {
      throw new UnauthorizedException("Sign-in expired. Start again.");
    }
    if (claim.typ !== "2fa") throw new UnauthorizedException("Sign-in expired. Start again.");
    const user = await this.db.user.findUniqueOrThrow({ where: { id: claim.sub } });
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new HttpException(`Too many attempts. Try again in ${LOCK_MINUTES} minutes.`, 429);
    if (!user.totpSecret || !verifyTotp(openSecret(user.totpSecret), data.code)) {
      const failed = user.failedLogins + 1;
      await this.db.user.update({
        where: { id: user.id },
        data: {
          failedLogins: failed >= LOCK_AFTER ? 0 : failed,
          lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60000) : undefined,
        },
      });
      throw new UnauthorizedException("That code is not valid");
    }
    await this.db.user.update({ where: { id: user.id }, data: { failedLogins: 0 } });
    return this.start(user, { client: claim.client, deviceName: claim.deviceName }, req, res);
  }

  @Post("refresh") @HttpCode(200) async refresh(@Body() body: unknown, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const data = parse(z.object({ refreshToken: z.string().max(300).optional() }).default({}), body ?? {});
    const presented = data.refreshToken || readCookie(req, REFRESH_COOKIE);
    if (!presented) throw new UnauthorizedException("Session expired");
    const result = await this.sessions.refresh(presented, req.ip);
    if (!data.refreshToken) this.sessions.setCookies(res, result.accessToken, result.refreshToken, result.session.client as Client);
    return {
      user: profile(result.user),
      ...(data.refreshToken ? { accessToken: result.accessToken, refreshToken: result.refreshToken } : {}),
    };
  }

  @Post("logout") @HttpCode(200) async logout(@Body() body: unknown, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const data = parse(z.object({ refreshToken: z.string().max(300).optional() }).default({}), body ?? {});
    const presented = data.refreshToken || readCookie(req, REFRESH_COOKIE);
    const sessionId = presented?.split(".")[0];
    if (sessionId) {
      const session = await this.db.session.findUnique({ where: { id: sessionId } });
      if (session && session.refreshHash === sha256(presented!.split(".")[1] || "")) {
        await this.sessions.revoke(session.id);
        await this.db.deviceToken.deleteMany({ where: { userId: session.userId, createdAt: { gte: session.createdAt } } }).catch(() => undefined);
      }
    }
    this.sessions.clearCookies(res);
    return { ok: true };
  }

  @Post("logout-all") @HttpCode(200) @UseGuards(AuthGuard) async logoutAll(@Req() req: any, @Res({ passthrough: true }) res: any) {
    await this.sessions.revokeAll(req.user.sub);
    disconnectUser(req.user.sub);
    this.sessions.clearCookies(res);
    return { ok: true };
  }

  @Get("me") @UseGuards(AuthGuard) async me(@Req() req: any) {
    return profile(await this.db.user.findUniqueOrThrow({ where: { id: req.user.sub } }));
  }

  @Patch("me") @UseGuards(AuthGuard) async update(@Req() req: any, @Body() body: unknown) {
    const data = parse(
      z.object({
        fullName: z.string().trim().min(2).max(100).optional(),
        locale: z.enum(["en", "bn"]).optional(),
      }),
      body,
    );
    return profile(await this.db.user.update({ where: { id: req.user.sub }, data }));
  }

  /** Permanently removes personal data (required by app stores). Events are archived, listings suspended. */
  @Delete("me") @UseGuards(AuthGuard) async remove(@Req() req: any, @Body() body: unknown, @Res({ passthrough: true }) res: any) {
    const data = parse(z.object({ password: z.string().max(100) }), body);
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    if (!(await compare(data.password, user.passwordHash))) throw new UnauthorizedException("Incorrect password");
    await this.db.$transaction([
      this.db.event.updateMany({ where: { hostId: user.id, archivedAt: null }, data: { archivedAt: new Date() } }),
      this.db.vendor.updateMany({ where: { ownerId: user.id }, data: { status: "SUSPENDED" } }),
      this.db.eventMember.deleteMany({ where: { userId: user.id } }),
      this.db.vendorMember.deleteMany({ where: { userId: user.id } }),
      this.db.deviceToken.deleteMany({ where: { userId: user.id } }),
      this.db.favorite.deleteMany({ where: { userId: user.id } }),
      this.db.authCode.deleteMany({ where: { userId: user.id } }),
      this.db.user.update({
        where: { id: user.id },
        data: {
          email: `deleted+${user.id}@deleted.invalid`,
          fullName: "Deleted user",
          phone: null,
          passwordHash: await hash(randomBytes(32).toString("hex"), 4),
          totpSecret: null,
          totpEnabledAt: null,
          emailVerifiedAt: null,
          phoneVerifiedAt: null,
          deletedAt: new Date(),
        },
      }),
    ]);
    await this.sessions.revokeAll(user.id);
    disconnectUser(user.id);
    this.sessions.clearCookies(res);
    return { ok: true };
  }

  @Get("sessions") @UseGuards(AuthGuard) async listSessions(@Req() req: any) {
    const sessions = await this.db.session.findMany({
      where: { userId: req.user.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: "desc" },
      select: { id: true, client: true, deviceName: true, userAgent: true, ip: true, createdAt: true, lastUsedAt: true },
    });
    return sessions.map((s) => ({ ...s, current: s.id === req.user.sid }));
  }

  @Delete("sessions/:id") @UseGuards(AuthGuard) async endSession(@Req() req: any, @Param("id") id: string) {
    const session = await this.db.session.findFirst({ where: { id, userId: req.user.sub } });
    if (!session) throw new NotFoundException("Session not found");
    await this.sessions.revoke(id);
    return { ok: true };
  }

  @Get("socket-token") @UseGuards(AuthGuard) socketToken(@Req() req: any) {
    return { token: this.sessions.socketToken(req.user) };
  }

  // ---- Email verification ----
  @Post("email/resend") @HttpCode(200) @UseGuards(AuthGuard) async resendEmail(@Req() req: any) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    if (user.emailVerifiedAt) return { ok: true, alreadyVerified: true };
    await this.throttleCodes(user.id, "VERIFY_EMAIL");
    await this.sendEmailVerification(user);
    return { ok: true };
  }

  @Post("email/verify") @HttpCode(200) async verifyEmail(@Req() req: any, @Body() body: unknown) {
    const data = parse(
      z.object({ code: z.string().trim().max(10).optional(), token: z.string().max(200).optional() }),
      body,
    );
    let userId: string | undefined;
    if (data.token) {
      const record = await this.consumeToken("VERIFY_EMAIL", data.token);
      userId = record.userId;
    } else {
      // Code entry requires the signed-in user (bearer or cookie).
      const identity = await this.optionalIdentity(req);
      if (!identity || !data.code) throw new BadRequestException("Enter the code from your email");
      await this.consumeCode(identity.sub, "VERIFY_EMAIL", data.code);
      userId = identity.sub;
    }
    const user = await this.db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    return profile(user);
  }

  // ---- Password reset & change ----
  @Post("password/forgot") @HttpCode(200) async forgot(@Body() body: unknown) {
    const data = parse(z.object({ email: z.email().toLowerCase() }), body);
    const user = await this.db.user.findUnique({ where: { email: data.email } });
    // Always the same response so the endpoint does not reveal which emails exist.
    if (user && !user.deletedAt) {
      const recent = await this.db.authCode.count({
        where: { userId: user.id, purpose: "RESET_PASSWORD", createdAt: { gt: new Date(Date.now() - 3600000) } },
      });
      if (recent < 5) {
        const token = await this.issueToken(user.id, "RESET_PASSWORD", user.email);
        const message = render("resetPassword", user.locale, { link: link(`/reset-password?token=${token}`) });
        await this.notifier.direct("EMAIL", user.email, message.subject, message.body, user.id);
      }
    }
    return { ok: true, message: "If that email has an account, a reset link is on its way." };
  }

  @Post("password/reset") @HttpCode(200) async reset(@Body() body: unknown) {
    const data = parse(z.object({ token: z.string().max(200), password }), body);
    const record = await this.consumeToken("RESET_PASSWORD", data.token);
    const user = await this.db.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hash(data.password, 12),
        failedLogins: 0,
        lockedUntil: null,
        // A working reset link proves control of the inbox.
        emailVerifiedAt: new Date(),
      },
    });
    await this.sessions.revokeAll(user.id);
    disconnectUser(user.id);
    const message = render("passwordChanged", user.locale, { link: link("/forgot-password") });
    await this.notifier.direct("EMAIL", user.email, message.subject, message.body, user.id);
    return { ok: true };
  }

  @Post("password/change") @HttpCode(200) @UseGuards(AuthGuard) async change(@Req() req: any, @Body() body: unknown) {
    const data = parse(z.object({ currentPassword: z.string().max(100), newPassword: password }), body);
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    if (!(await compare(data.currentPassword, user.passwordHash))) throw new UnauthorizedException("Current password is incorrect");
    await this.db.user.update({ where: { id: user.id }, data: { passwordHash: await hash(data.newPassword, 12) } });
    await this.sessions.revokeAll(user.id, req.user.sid);
    const message = render("passwordChanged", user.locale, { link: link("/forgot-password") });
    await this.notifier.direct("EMAIL", user.email, message.subject, message.body, user.id);
    return { ok: true };
  }

  // ---- Phone verification (SMS OTP) ----
  @Post("phone/start") @HttpCode(200) @UseGuards(AuthGuard) async startPhone(@Req() req: any, @Body() body: unknown) {
    const data = parse(z.object({ phone }), body);
    const taken = await this.db.user.findFirst({ where: { phone: data.phone, id: { not: req.user.sub } } });
    if (taken) throw new ConflictException("This number is linked to another account");
    await this.throttleCodes(req.user.sub, "VERIFY_PHONE");
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    const code = await this.issueCode(user.id, "VERIFY_PHONE", data.phone);
    const message = render("phoneOtp", user.locale, { code });
    await this.notifier.direct("SMS", data.phone, message.subject, message.body, user.id);
    return { ok: true, phone: data.phone };
  }

  @Post("phone/verify") @HttpCode(200) @UseGuards(AuthGuard) async verifyPhone(@Req() req: any, @Body() body: unknown) {
    const data = parse(z.object({ code: z.string().trim().max(10) }), body);
    const record = await this.consumeCode(req.user.sub, "VERIFY_PHONE", data.code);
    const taken = await this.db.user.findFirst({ where: { phone: record.target, id: { not: req.user.sub } } });
    if (taken) throw new ConflictException("This number is linked to another account");
    return profile(
      await this.db.user.update({
        where: { id: req.user.sub },
        data: { phone: record.target, phoneVerifiedAt: new Date() },
      }),
    );
  }

  // ---- Two-factor authentication (authenticator app) ----
  @Post("2fa/setup") @HttpCode(200) @UseGuards(AuthGuard) async setupTwoFactor(@Req() req: any) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    if (user.totpEnabledAt) throw new ConflictException("Two-factor sign-in is already on");
    const secret = newTotpSecret();
    await this.db.user.update({ where: { id: user.id }, data: { totpSecret: sealSecret(secret) } });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
  }

  @Post("2fa/enable") @HttpCode(200) @UseGuards(AuthGuard) async enableTwoFactor(@Req() req: any, @Body() body: unknown) {
    const data = parse(z.object({ code: z.string().trim().max(10) }), body);
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    if (!user.totpSecret) throw new BadRequestException("Start two-factor setup first");
    if (!verifyTotp(openSecret(user.totpSecret), data.code)) throw new BadRequestException("That code is not valid");
    await this.sessions.revokeAll(user.id, req.user.sid);
    return profile(await this.db.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date() } }));
  }

  @Post("2fa/disable") @HttpCode(200) @UseGuards(AuthGuard) async disableTwoFactor(@Req() req: any, @Body() body: unknown) {
    const data = parse(z.object({ password: z.string().max(100), code: z.string().trim().max(10) }), body);
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    if (!(await compare(data.password, user.passwordHash))) throw new UnauthorizedException("Incorrect password");
    if (!user.totpSecret || !verifyTotp(openSecret(user.totpSecret), data.code))
      throw new BadRequestException("That code is not valid");
    return profile(
      await this.db.user.update({ where: { id: user.id }, data: { totpSecret: null, totpEnabledAt: null } }),
    );
  }

  // ---- Push notification devices ----
  @Post("devices") @HttpCode(200) @UseGuards(AuthGuard) async registerDevice(@Req() req: any, @Body() body: unknown) {
    const data = parse(
      z.object({ platform: z.enum(["android", "ios", "web"]), token: z.string().min(20).max(4096) }),
      body,
    );
    await this.db.deviceToken.upsert({
      where: { token: data.token },
      update: { userId: req.user.sub, platform: data.platform, lastSeenAt: new Date() },
      create: { userId: req.user.sub, platform: data.platform, token: data.token },
    });
    return { ok: true };
  }

  @Post("devices/remove") @HttpCode(200) @UseGuards(AuthGuard) async removeDevice(@Req() req: any, @Body() body: unknown) {
    const data = parse(z.object({ token: z.string().max(4096) }), body);
    await this.db.deviceToken.deleteMany({ where: { token: data.token, userId: req.user.sub } });
    return { ok: true };
  }

  // ---- helpers ----
  private async start(
    user: Parameters<typeof profile>[0],
    meta: { client: Client; deviceName?: string },
    req: any,
    res: any,
  ) {
    const result = await this.sessions.create(user, {
      client: meta.client,
      deviceName: meta.deviceName,
      userAgent: req.headers?.["user-agent"],
      ip: req.ip,
    });
    if (meta.client === "web") {
      this.sessions.setCookies(res, result.accessToken, result.refreshToken, "web");
      return { user: profile(user) };
    }
    return { user: profile(user), accessToken: result.accessToken, refreshToken: result.refreshToken };
  }

  private async optionalIdentity(req: any): Promise<Identity | undefined> {
    const token = req.headers.authorization?.replace(/^Bearer /, "") || readCookie(req, ACCESS_COOKIE);
    if (!token) return undefined;
    try {
      const identity = await this.jwt.verifyAsync(token);
      if (identity.typ !== "access" || !(await this.sessions.isActive(identity.sid))) return undefined;
      return identity;
    } catch {
      return undefined;
    }
  }

  private async sendEmailVerification(user: { id: string; email: string; locale: string }) {
    const code = await this.issueCode(user.id, "VERIFY_EMAIL", user.email);
    const token = await this.issueToken(user.id, "VERIFY_EMAIL", user.email, false);
    const message = render("verifyEmail", user.locale, { code, link: link(`/verify-email?token=${token}`) });
    await this.notifier.direct("EMAIL", user.email, message.subject, message.body, user.id);
  }

  private async throttleCodes(userId: string, purpose: CodePurpose) {
    const last = await this.db.authCode.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: "desc" },
    });
    if (last && Date.now() - +last.createdAt < 60000)
      throw new HttpException("Please wait a minute before requesting another code.", 429);
  }

  /** Six-digit code bound to the user. Older unused codes for the same purpose are invalidated. */
  private async issueCode(userId: string, purpose: CodePurpose, target: string) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.db.authCode.updateMany({
      where: { userId, purpose, usedAt: null, codeHash: { not: { startsWith: "t:" } } },
      data: { usedAt: new Date() },
    });
    await this.db.authCode.create({
      data: {
        userId,
        purpose,
        target,
        codeHash: sha256(`${purpose}:${userId}:${code}`),
        expiresAt: new Date(Date.now() + CODE_TTL_MINUTES[purpose] * 60000),
      },
    });
    return code;
  }

  /** Long random token for links. Stored hashed with a "t:" prefix to separate it from codes. */
  private async issueToken(userId: string, purpose: CodePurpose, target: string, invalidate = true) {
    const token = randomBytes(32).toString("base64url");
    if (invalidate)
      await this.db.authCode.updateMany({
        where: { userId, purpose, usedAt: null, codeHash: { startsWith: "t:" } },
        data: { usedAt: new Date() },
      });
    await this.db.authCode.create({
      data: {
        userId,
        purpose,
        target,
        codeHash: `t:${sha256(token)}`,
        expiresAt: new Date(Date.now() + CODE_TTL_MINUTES[purpose] * 60000),
      },
    });
    return token;
  }

  private async consumeCode(userId: string, purpose: CodePurpose, code: string) {
    const record = await this.db.authCode.findFirst({
      where: { userId, purpose, usedAt: null, expiresAt: { gt: new Date() }, codeHash: { not: { startsWith: "t:" } } },
      orderBy: { createdAt: "desc" },
    });
    if (!record) throw new BadRequestException("That code has expired. Request a new one.");
    if (record.attempts >= 5) throw new HttpException("Too many wrong codes. Request a new one.", 429);
    if (record.codeHash !== sha256(`${purpose}:${userId}:${code}`)) {
      await this.db.authCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException("That code is not valid");
    }
    const used = await this.db.authCode.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (!used.count) throw new BadRequestException("That code has already been used");
    return record;
  }

  private async consumeToken(purpose: CodePurpose, token: string) {
    const record = await this.db.authCode.findFirst({
      where: { purpose, codeHash: `t:${sha256(token)}` },
    });
    if (!record || record.usedAt || record.expiresAt < new Date())
      throw new BadRequestException("This link has expired. Request a new one.");
    const used = await this.db.authCode.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (!used.count) throw new BadRequestException("This link has already been used");
    return record;
  }
}
