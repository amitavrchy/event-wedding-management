import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard, Identity } from "./auth";
import { ownEvent, ownVendor, eventAccess, vendorAccess } from "./access";
import { parse, z } from "./validation";
import { publishMessage } from "./realtime";
import { Notifier } from "./notify/notifier";
import { link } from "./notify/templates";
import { markResponded } from "./marketplace";
@Controller("conversations")
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(
    private db: Database,
    private notifier: Notifier,
  ) {}
  @Get() async list(@Req() req: any) {
    const vendor = req.user.role === "VENDOR";
    const ids = vendor
      ? (
          await this.db.vendor.findMany({
            where: vendorAccess(req.user.sub),
            select: { id: true },
          })
        ).map((v) => v.id)
      : (
          await this.db.event.findMany({
            where: eventAccess(req.user.sub),
            select: { id: true },
          })
        ).map((e) => e.id);
    return this.db.conversation.findMany({
      where: vendor ? { vendorId: { in: ids } } : { eventId: { in: ids } },
      take: 100,
    });
  }
  @Post() async open(@Req() req: any, @Body() body: unknown) {
    const data = parse(
      z.object({ eventId: z.string(), vendorId: z.string() }),
      body,
    );
    await ownEvent(this.db, data.eventId, req.user);
    if (
      !(await this.db.vendor.findFirst({
        where: { id: data.vendorId, status: "ACTIVE" },
      }))
    )
      throw new BadRequestException("Vendor unavailable");
    return this.db.conversation.upsert({
      where: { eventId_vendorId: data },
      create: data,
      update: {},
    });
  }
  @Get(":id/messages") async messages(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    await this.access(id, req.user, "read");
    return (
      await this.db.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    ).reverse();
  }
  @Post(":id/messages") async send(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const conversation = await this.access(id, req.user);
    const data = parse(
      z.object({ body: z.string().trim().min(1).max(4000) }),
      body,
    );
    const message = await this.db.message.create({
      data: { ...data, conversationId: id, senderId: req.user.sub },
    });
    publishMessage(id, message);
    const fromVendor = req.user.role === "VENDOR";
    if (fromVendor) await markResponded(this.db, conversation.vendorId, undefined, conversation.eventId);
    const recipient = fromVendor
      ? (await this.db.event.findUnique({ where: { id: conversation.eventId } }))?.hostId
      : (await this.db.vendor.findUnique({ where: { id: conversation.vendorId } }))?.ownerId;
    if (recipient && recipient !== req.user.sub)
      await this.notifier.notifyTemplate(
        recipient,
        "newMessage",
        { name: req.user.fullName, preview: data.body.slice(0, 80) },
        // One push per conversation per 10 minutes keeps chat from flooding phones.
        { link: link(`/messages?c=${id}`), kind: "MESSAGE", key: `msg:${id}:${recipient}:${Math.floor(Date.now() / 600000)}` },
      );
    return message;
  }
  async access(
    id: string,
    user: Identity,
    permission: "read" | "write" = "write",
  ) {
    const c = await this.db.conversation.findUniqueOrThrow({ where: { id } });
    if (user.role === "VENDOR")
      await ownVendor(this.db, c.vendorId, user, permission);
    else await ownEvent(this.db, c.eventId, user, permission);
    return c;
    return c;
  }
}
