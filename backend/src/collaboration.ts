import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent, ownVendor } from "./access";
import { parse, z } from "./validation";
import { audit } from "./activity";
import { disconnectUser } from "./realtime";
@Controller("collaboration")
@UseGuards(AuthGuard)
export class CollaborationController {
  constructor(private db: Database) {}
  private async owner(scope: string, id: string, req: any) {
    if (scope === "EVENT") {
      const event = await ownEvent(this.db, id, req.user, "read");
      if (event.hostId !== req.user.sub && req.user.role !== "PLATFORM_ADMIN")
        throw new ForbiddenException("Only the host manages collaborators");
    } else {
      const vendor = await ownVendor(this.db, id, req.user, "read");
      if (vendor.ownerId !== req.user.sub && req.user.role !== "PLATFORM_ADMIN")
        throw new ForbiddenException(
          "Only the business owner manages teammates",
        );
    }
  }
  @Get(":scope/:id") async list(
    @Req() req: any,
    @Param("scope") scope: string,
    @Param("id") id: string,
  ) {
    parse(z.enum(["EVENT", "VENDOR"]), scope);
    await this.owner(scope, id, req);
    const [members, invites] = await Promise.all([
      scope === "EVENT"
        ? this.db.eventMember.findMany({ where: { eventId: id } })
        : this.db.vendorMember.findMany({ where: { vendorId: id } }),
      this.db.workspaceInvite.findMany({
        where: {
          scope,
          scopeId: id,
          acceptedBy: null,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);
    const users = await this.db.user.findMany({
      where: { id: { in: members.map((m) => m.userId) } },
      select: { id: true, fullName: true, email: true },
    });
    return {
      members: members.map((m) => ({
        ...m,
        user: users.find((u) => u.id === m.userId),
      })),
      invites,
    };
  }
  @Post(":scope/:id/invites") async invite(
    @Req() req: any,
    @Param("scope") scope: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    parse(z.enum(["EVENT", "VENDOR"]), scope);
    await this.owner(scope, id, req);
    const data = parse(
      z.object({
        email: z.email().toLowerCase(),
        permission: z.enum(["EDITOR", "VIEWER", "MANAGER"]),
        days: z.number().int().min(1).max(180).default(90),
      }),
      body,
    );
    if (
      (scope === "EVENT" && data.permission === "MANAGER") ||
      (scope === "VENDOR" && data.permission === "EDITOR")
    )
      throw new BadRequestException(
        "Choose a permission supported by this workspace",
      );
    let memberExpiresAt = new Date(Date.now() + data.days * 86400000);
    if (scope === "EVENT") {
      const last = await this.db.eventDay.findFirst({
        where: { eventId: id },
        orderBy: { endsAt: "desc" },
      });
      if (last)
        memberExpiresAt = new Date(
          Math.min(+memberExpiresAt, +last.endsAt + 86400000),
        );
    }
    if (memberExpiresAt <= new Date())
      throw new BadRequestException("This event has ended");
    return this.db.workspaceInvite.create({
      data: {
        scope,
        scopeId: id,
        email: data.email,
        permission: data.permission,
        token: randomBytes(32).toString("hex"),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        memberExpiresAt,
      },
    });
  }
  @Post("accept/:token") async accept(
    @Req() req: any,
    @Param("token") token: string,
  ) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: req.user.sub },
    });
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${token}))`;
      const invite = await tx.workspaceInvite.findUniqueOrThrow({
        where: { token },
      });
      if (
        invite.acceptedBy ||
        invite.expiresAt < new Date() ||
        invite.memberExpiresAt < new Date()
      )
        throw new BadRequestException("Invitation was used or expired");
      if (invite.email !== user.email)
        throw new ForbiddenException("Sign in with the invited email address");
      if (invite.scope === "VENDOR" && user.role !== "VENDOR")
        throw new BadRequestException(
          "Business team invitations require a vendor account",
        );
      if (invite.scope === "EVENT")
        await tx.eventMember.upsert({
          where: {
            eventId_userId: { eventId: invite.scopeId, userId: user.id },
          },
          create: {
            eventId: invite.scopeId,
            userId: user.id,
            permission: invite.permission,
            expiresAt: invite.memberExpiresAt,
          },
          update: {
            permission: invite.permission,
            expiresAt: invite.memberExpiresAt,
          },
        });
      else
        await tx.vendorMember.upsert({
          where: {
            vendorId_userId: { vendorId: invite.scopeId, userId: user.id },
          },
          create: {
            vendorId: invite.scopeId,
            userId: user.id,
            permission: invite.permission,
            expiresAt: invite.memberExpiresAt,
          },
          update: {
            permission: invite.permission,
            expiresAt: invite.memberExpiresAt,
          },
        });
      await tx.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedBy: user.id },
      });
      return { joined: true, scope: invite.scope, scopeId: invite.scopeId };
    });
  }
  @Delete(":scope/:id/members/:memberId") async revoke(
    @Req() req: any,
    @Param("scope") scope: string,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
  ) {
    parse(z.enum(["EVENT", "VENDOR"]), scope);
    await this.owner(scope, id, req);
    const member =
      scope === "EVENT"
        ? await this.db.eventMember.findFirst({
            where: { id: memberId, eventId: id },
          })
        : await this.db.vendorMember.findFirst({
            where: { id: memberId, vendorId: id },
          });
    const result =
      scope === "EVENT"
        ? await this.db.eventMember.deleteMany({
            where: { id: memberId, eventId: id },
          })
        : await this.db.vendorMember.deleteMany({
            where: { id: memberId, vendorId: id },
          });
    if (member) disconnectUser(member.userId);
    return result;
  }
  @Delete(":scope/:id/invites/:inviteId") async cancel(
    @Req() req: any,
    @Param("scope") scope: string,
    @Param("id") id: string,
    @Param("inviteId") inviteId: string,
  ) {
    parse(z.enum(["EVENT", "VENDOR"]), scope);
    await this.owner(scope, id, req);
    return this.db.workspaceInvite.deleteMany({
      where: { id: inviteId, scope, scopeId: id, acceptedBy: null },
    });
  }
}
