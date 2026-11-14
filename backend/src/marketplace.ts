import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "./auth";
import { Database } from "./prisma";
import { ownEvent, ownVendor } from "./access";
import { amount, date, parse, z } from "./validation";
import { adminIds, audit, pagination, requireAdmin } from "./common";
import { Notifier, recordNotification } from "./notify/notifier";
import { link } from "./notify/templates";
import { publishMessage } from "./realtime";

const DOCUMENT_TYPES = ["TRADE_LICENSE", "NID", "TIN", "PORTFOLIO_PROOF", "OTHER"] as const;

@Controller()
@UseGuards(AuthGuard)
export class VerificationController {
  constructor(
    private db: Database,
    private notifier: Notifier,
  ) {}

  @Get("vendors/:id/verification") async status(@Req() req: any, @Param("id") id: string) {
    const vendor = await ownVendor(this.db, id, req.user, "read");
    const requests = await this.db.verificationRequest.findMany({
      where: { vendorId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return { verifiedAt: vendor.verifiedAt, requests };
  }

  @Post("vendors/:id/verification") async submit(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    const vendor = await ownVendor(this.db, id, req.user);
    const data = parse(
      z.object({ documentType: z.enum(DOCUMENT_TYPES), mediaIds: z.array(z.string()).min(1).max(6) }),
      body,
    );
    const media = await this.db.media.findMany({ where: { id: { in: data.mediaIds } } });
    if (
      media.length !== data.mediaIds.length ||
      media.some((m) => m.ownerId !== req.user.sub || m.status !== "READY" || m.purpose !== "VERIFICATION")
    )
      throw new BadRequestException("Upload each document first");
    if (await this.db.verificationRequest.findFirst({ where: { vendorId: id, status: "SUBMITTED" } }))
      throw new BadRequestException("Your documents are already being reviewed");
    const request = await this.db.verificationRequest.create({ data: { vendorId: id, ...data } });
    for (const adminId of await adminIds(this.db))
      await this.notifier.notify(adminId, {
        title: "Verification to review",
        body: `${vendor.businessName} submitted ${data.documentType.replace("_", " ").toLowerCase()}`,
        link: link("/admin?tab=verification"),
        kind: "ADMIN",
      });
    return request;
  }

  @Get("admin/verifications") async queue(@Req() req: any, @Query() query: any) {
    requireAdmin(req);
    const page = pagination(query);
    const status = parse(z.enum(["SUBMITTED", "APPROVED", "REJECTED"]).default("SUBMITTED"), query?.status);
    const [total, items] = await Promise.all([
      this.db.verificationRequest.count({ where: { status } }),
      this.db.verificationRequest.findMany({
        where: { status },
        orderBy: { createdAt: "asc" },
        skip: page.skip,
        take: page.take,
      }),
    ]);
    const vendors = await this.db.vendor.findMany({
      where: { id: { in: items.map((i) => i.vendorId) } },
      select: { id: true, businessName: true, category: true, city: true, phone: true },
    });
    return page.wrap(
      items.map((i) => ({ ...i, vendor: vendors.find((v) => v.id === i.vendorId) })),
      total,
    );
  }

  @Post("admin/verifications/:id/:decision") async decide(
    @Req() req: any,
    @Param("id") id: string,
    @Param("decision") decision: string,
    @Body() body: unknown,
  ) {
    requireAdmin(req);
    if (!["approve", "reject"].includes(decision)) throw new NotFoundException();
    const { note } = parse(z.object({ note: z.string().max(500).optional() }).default({}), body ?? {});
    if (decision === "reject" && !note) throw new BadRequestException("Tell the vendor what is missing");
    const request = await this.db.verificationRequest.findUnique({ where: { id } });
    if (!request || request.status !== "SUBMITTED") throw new BadRequestException("This request was already reviewed");
    const approved = decision === "approve";
    await this.db.$transaction([
      this.db.verificationRequest.update({
        where: { id },
        data: { status: approved ? "APPROVED" : "REJECTED", note, reviewedBy: req.user.sub, reviewedAt: new Date() },
      }),
      ...(approved ? [this.db.vendor.update({ where: { id: request.vendorId }, data: { verifiedAt: new Date() } })] : []),
    ]);
    await audit(this.db, req, `verification.${decision}`, "VerificationRequest", id, { vendorId: request.vendorId, note });
    const vendor = await this.db.vendor.findUnique({ where: { id: request.vendorId } });
    if (vendor)
      await this.notifier.notify(vendor.ownerId, {
        title: approved ? "Your business is verified" : "Verification needs another look",
        body: approved ? "The Verified badge now shows on your profile." : note!,
        link: link("/studio?tab=verification"),
        kind: "VERIFICATION",
        channels: { email: true },
      });
    return { ok: true };
  }
}

/**
 * Structured inquiries: the core marketplace loop. Each inquiry creates a CRM
 * lead for the vendor, opens the event conversation, and notifies the vendor
 * by push, email and SMS.
 */
@Controller()
@UseGuards(AuthGuard)
export class InquiriesController {
  constructor(
    private db: Database,
    private notifier: Notifier,
  ) {}

  @Post("vendors/:id/inquiries") async create(@Req() req: any, @Param("id") vendorId: string, @Body() body: unknown) {
    if (req.user.role === "VENDOR") throw new ForbiddenException("Use a host account to send inquiries");
    const vendor = await this.db.vendor.findFirst({ where: { id: vendorId, status: "ACTIVE" } });
    if (!vendor) throw new NotFoundException("Vendor not found");
    const data = parse(
      z.object({
        eventId: z.string().optional(),
        serviceId: z.string().optional(),
        eventDate: date.optional(),
        guestCount: z.number().int().min(1).max(100000).optional(),
        budgetMinor: amount.optional(),
        phone: z.string().max(20).optional(),
        message: z.string().trim().min(10).max(2000),
      }),
      body,
    );
    const today = await this.db.inquiry.count({
      where: { hostId: req.user.sub, createdAt: { gt: new Date(Date.now() - 86400000) } },
    });
    if (today >= 25) throw new HttpException("You have sent many inquiries today. Try again tomorrow.", 429);
    if (data.eventId) await ownEvent(this.db, data.eventId, req.user);
    if (data.serviceId && !(await this.db.vendorService.findFirst({ where: { id: data.serviceId, vendorId, active: true } })))
      throw new BadRequestException("Choose one of this vendor's services");
    const host = await this.db.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    const phone = data.phone || (host.phoneVerifiedAt ? host.phone : null);
    const inquiry = await this.db.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          vendorId,
          name: host.fullName,
          email: host.email,
          eventDate: data.eventDate ? new Date(data.eventDate) : null,
          estimatedMinor: data.budgetMinor || 0,
          notes: `${data.guestCount ? `${data.guestCount} guests. ` : ""}${phone ? `Phone ${phone}. ` : ""}${data.message}`.slice(0, 2000),
          followUpAt: new Date(Date.now() + 86400000),
        },
      });
      let conversationId: string | undefined;
      if (data.eventId) {
        const conversation = await tx.conversation.upsert({
          where: { eventId_vendorId: { eventId: data.eventId, vendorId } },
          update: {},
          create: { eventId: data.eventId, vendorId },
        });
        conversationId = conversation.id;
        const message = await tx.message.create({
          data: { conversationId, senderId: req.user.sub, body: data.message },
        });
        publishMessage(conversationId, message);
      }
      return tx.inquiry.create({
        data: {
          vendorId,
          hostId: req.user.sub,
          eventId: data.eventId,
          serviceId: data.serviceId,
          name: host.fullName,
          email: host.email,
          phone,
          eventDate: data.eventDate ? new Date(data.eventDate) : null,
          guestCount: data.guestCount,
          budgetMinor: data.budgetMinor,
          message: data.message,
          leadId: lead.id,
          conversationId,
        },
      });
    });
    await this.notifier.notifyTemplate(
      vendor.ownerId,
      "newInquiry",
      { name: host.fullName, date: data.eventDate ? data.eventDate.slice(0, 10) : "a date to confirm" },
      { link: link("/business?tab=inquiries"), kind: "INQUIRY", key: `inquiry:${inquiry.id}`, channels: { email: true, sms: true } },
    );
    return inquiry;
  }

  @Get("inquiries/mine") async mine(@Req() req: any, @Query() query: any) {
    const page = pagination(query);
    const where = { hostId: req.user.sub };
    const [total, items] = await Promise.all([
      this.db.inquiry.count({ where }),
      this.db.inquiry.findMany({ where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take }),
    ]);
    const vendors = await this.db.vendor.findMany({
      where: { id: { in: items.map((i) => i.vendorId) } },
      select: { id: true, businessName: true, slug: true, image: true, category: true },
    });
    return page.wrap(items.map((i) => ({ ...i, vendor: vendors.find((v) => v.id === i.vendorId) })), total);
  }

  @Get("vendors/:id/inquiries") async forVendor(@Req() req: any, @Param("id") id: string, @Query() query: any) {
    await ownVendor(this.db, id, req.user, "read");
    const page = pagination(query);
    const status = query?.status ? parse(z.enum(["NEW", "REPLIED", "QUOTED", "BOOKED", "CLOSED"]), query.status) : undefined;
    const where = { vendorId: id, ...(status ? { status } : {}) };
    const [total, items] = await Promise.all([
      this.db.inquiry.count({ where }),
      this.db.inquiry.findMany({ where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take }),
    ]);
    return page.wrap(items, total);
  }

  @Patch("inquiries/:id") async update(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    const inquiry = await this.db.inquiry.findUnique({ where: { id } });
    if (!inquiry) throw new NotFoundException("Inquiry not found");
    await ownVendor(this.db, inquiry.vendorId, req.user);
    const { status } = parse(z.object({ status: z.enum(["NEW", "REPLIED", "QUOTED", "BOOKED", "CLOSED"]) }), body);
    const updated = await this.db.inquiry.update({ where: { id }, data: { status } });
    if (status !== "NEW") await markResponded(this.db, inquiry.vendorId, inquiry.id);
    return updated;
  }
}

/** First vendor response: stamps the inquiry and refreshes the vendor's average response time. */
export async function markResponded(db: Database, vendorId: string, inquiryId?: string, eventId?: string) {
  const where = inquiryId ? { id: inquiryId } : { vendorId, eventId, respondedAt: null };
  // Stamp the first response; only a NEW inquiry moves to REPLIED (QUOTED/BOOKED stay).
  await db.inquiry.updateMany({ where: { ...where, respondedAt: null, status: "NEW" }, data: { respondedAt: new Date(), status: "REPLIED" } });
  await db.inquiry.updateMany({ where: { ...where, respondedAt: null }, data: { respondedAt: new Date() } });
  const recent = await db.inquiry.findMany({
    where: { vendorId, respondedAt: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { createdAt: true, respondedAt: true },
  });
  if (!recent.length) return;
  const minutes = recent.reduce((sum, i) => sum + (+i.respondedAt! - +i.createdAt) / 60000, 0) / recent.length;
  await db.vendor.update({ where: { id: vendorId }, data: { responseMinutes: Math.round(minutes) } });
}

/** Worker: nudge vendors about inquiries unanswered for 24 hours (once per inquiry). */
export async function inquiryFollowUps(db: Database) {
  const stale = await db.inquiry.findMany({
    where: { status: "NEW", respondedAt: null, followUpSentAt: null, createdAt: { lt: new Date(Date.now() - 86400000) } },
    take: 200,
  });
  for (const inquiry of stale) {
    const vendor = await db.vendor.findUnique({ where: { id: inquiry.vendorId } });
    if (vendor)
      await recordNotification(db, vendor.ownerId, {
        title: "An inquiry is waiting for you",
        body: `${inquiry.name} asked a day ago. Quick replies win more bookings.`,
        link: link("/business?tab=inquiries"),
        key: `inquiry-followup:${inquiry.id}`,
        kind: "INQUIRY",
        channels: { sms: true },
      });
    await db.inquiry.update({ where: { id: inquiry.id }, data: { followUpSentAt: new Date() } });
  }
}

