import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthGuard } from "./auth";
import { Database } from "./prisma";
import { ownVendor } from "./access";
import { amount, parse, z } from "./validation";
import { adminIds, audit, pagination, requireAdmin } from "./common";
import { Notifier, recordNotification } from "./notify/notifier";
import { link } from "./notify/templates";

/**
 * Vendor subscriptions with manual payment review (the recommended launch
 * model): the vendor pays by bKash / Nagad / bank transfer outside the app,
 * submits the transaction reference and an optional proof image, and an
 * administrator approves it. Approval is idempotent and stacks renewals.
 */
const METHODS = ["BKASH", "NAGAD", "ROCKET", "BANK", "CASH"] as const;

export function paymentInstructions() {
  return {
    bkash: process.env.BKASH_MERCHANT_NUMBER || null,
    nagad: process.env.NAGAD_MERCHANT_NUMBER || null,
    bank: process.env.BANK_TRANSFER_DETAILS || null,
    note:
      process.env.SUBSCRIPTION_PAYMENT_NOTE ||
      "Send the plan amount, then submit the transaction ID. Your plan starts as soon as we confirm the payment (usually within one working day).",
  };
}

const receiptNumber = (id: string, at: Date) =>
  `AYJ-${at.toISOString().slice(0, 7).replace("-", "")}-${id.slice(-6).toUpperCase()}`;

@Controller("plans")
export class PlansController {
  constructor(private db: Database) {}
  @Get() list() {
    return this.db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  }
}

@Controller()
@UseGuards(AuthGuard)
export class SubscriptionsController {
  constructor(
    private db: Database,
    private notifier: Notifier,
  ) {}

  @Get("vendors/:id/subscription") async current(@Req() req: any, @Param("id") id: string) {
    const vendor = await ownVendor(this.db, id, req.user, "read");
    const subscriptions = await this.db.subscription.findMany({
      where: { vendorId: id },
      include: { payments: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const active = subscriptions.find((s) => s.status === "ACTIVE" && s.endsAt && s.endsAt > new Date());
    return {
      planCode: vendor.planCode,
      active: active || null,
      open: subscriptions.find((s) => ["PENDING_PAYMENT", "PENDING_REVIEW"].includes(s.status)) || null,
      history: subscriptions,
      instructions: paymentInstructions(),
    };
  }

  @Post("vendors/:id/subscriptions") async start(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    await ownVendor(this.db, id, req.user);
    const { planCode } = parse(z.object({ planCode: z.string().max(40) }), body);
    const plan = await this.db.plan.findFirst({ where: { code: planCode, active: true } });
    if (!plan) throw new BadRequestException("Choose an available plan");
    const open = await this.db.subscription.findFirst({
      where: { vendorId: id, status: { in: ["PENDING_PAYMENT", "PENDING_REVIEW"] } },
    });
    if (open?.status === "PENDING_REVIEW")
      throw new ConflictException("A payment is already waiting for review");
    if (open) return this.db.subscription.update({ where: { id: open.id }, data: { planCode } });
    return this.db.subscription.create({ data: { vendorId: id, planCode } });
  }

  @Post("subscriptions/:id/payments") async submit(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    const subscription = await this.db.subscription.findUnique({ where: { id } });
    if (!subscription) throw new NotFoundException("Subscription not found");
    const vendor = await ownVendor(this.db, subscription.vendorId, req.user);
    if (!["PENDING_PAYMENT", "PENDING_REVIEW"].includes(subscription.status))
      throw new BadRequestException("This subscription is not waiting for payment");
    const data = parse(
      z.object({
        method: z.enum(METHODS),
        reference: z.string().trim().min(4).max(60),
        amountMinor: amount,
        proofMediaId: z.string().optional(),
      }),
      body,
    );
    const plan = await this.db.plan.findUniqueOrThrow({ where: { code: subscription.planCode } });
    if (data.amountMinor < plan.priceMinor)
      throw new BadRequestException(`The plan costs BDT ${(plan.priceMinor / 100).toFixed(2)}`);
    if (data.proofMediaId) {
      const media = await this.db.media.findUnique({ where: { id: data.proofMediaId } });
      if (!media || media.ownerId !== req.user.sub || media.status !== "READY" || media.purpose !== "PAYMENT_PROOF")
        throw new BadRequestException("Upload the payment screenshot first");
    }
    const payment = await this.db.$transaction(async (tx) => {
      const created = await tx.subscriptionPayment.create({
        data: { subscriptionId: id, ...data, reference: data.reference.toUpperCase() },
      });
      await tx.subscription.update({ where: { id }, data: { status: "PENDING_REVIEW" } });
      return created;
    });
    for (const adminId of await adminIds(this.db))
      await this.notifier.notify(adminId, {
        title: "Subscription payment to review",
        body: `${vendor.businessName}: ${data.method} ${data.reference} for ${plan.name}`,
        link: link("/admin?tab=payments"),
        kind: "ADMIN",
      });
    return payment;
  }

  /** Printable receipt for an approved payment (vendor or admin). */
  @Get("subscription-payments/:id/receipt") async receipt(@Req() req: any, @Param("id") id: string) {
    const payment = await this.db.subscriptionPayment.findUnique({ where: { id }, include: { subscription: true } });
    if (!payment || payment.status !== "APPROVED") throw new NotFoundException("Receipt not found");
    const vendor =
      req.user.role === "PLATFORM_ADMIN"
        ? await this.db.vendor.findUniqueOrThrow({ where: { id: payment.subscription.vendorId } })
        : await ownVendor(this.db, payment.subscription.vendorId, req.user, "read");
    const plan = await this.db.plan.findUnique({ where: { code: payment.subscription.planCode } });
    return {
      receiptNumber: payment.receiptNumber,
      issuedAt: payment.reviewedAt,
      vendor: { businessName: vendor.businessName, city: vendor.city },
      plan: plan?.name || payment.subscription.planCode,
      period: { startsAt: payment.subscription.startsAt, endsAt: payment.subscription.endsAt },
      amountMinor: payment.amountMinor,
      method: payment.method,
      reference: payment.reference,
      issuer: process.env.LEGAL_ENTITY_NAME || "Ayojon",
    };
  }

  // ---------------- Administration ----------------
  @Get("admin/subscription-payments") async queue(@Req() req: any, @Query() query: any) {
    requireAdmin(req);
    const page = pagination(query);
    const status = parse(z.enum(["SUBMITTED", "APPROVED", "REJECTED"]).default("SUBMITTED"), query?.status);
    const where = { status };
    const [total, items] = await Promise.all([
      this.db.subscriptionPayment.count({ where }),
      this.db.subscriptionPayment.findMany({
        where,
        include: { subscription: true },
        orderBy: { createdAt: status === "SUBMITTED" ? "asc" : "desc" },
        skip: page.skip,
        take: page.take,
      }),
    ]);
    const vendors = await this.db.vendor.findMany({
      where: { id: { in: items.map((p) => p.subscription.vendorId) } },
      select: { id: true, businessName: true, city: true },
    });
    return page.wrap(
      items.map((p) => ({ ...p, vendor: vendors.find((v) => v.id === p.subscription.vendorId) })),
      total,
    );
  }

  @Post("admin/subscription-payments/:id/approve") async approve(@Req() req: any, @Param("id") id: string) {
    requireAdmin(req);
    const result = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const payment = await tx.subscriptionPayment.findUnique({ where: { id }, include: { subscription: true } });
      if (!payment) throw new NotFoundException("Payment not found");
      if (payment.status === "APPROVED") return { payment, alreadyApproved: true };
      if (payment.status !== "SUBMITTED") throw new BadRequestException("This payment was already reviewed");
      const sub = payment.subscription;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sub.vendorId}))`;
      const plan = await tx.plan.findUniqueOrThrow({ where: { code: sub.planCode } });
      // Renewals start when the current active period ends.
      const current = await tx.subscription.findFirst({
        where: { vendorId: sub.vendorId, status: "ACTIVE", endsAt: { gt: new Date() } },
        orderBy: { endsAt: "desc" },
      });
      const startsAt = current?.endsAt || new Date();
      const endsAt = new Date(+startsAt + plan.periodDays * 86400000);
      const now = new Date();
      const approved = await tx.subscriptionPayment.update({
        where: { id },
        data: { status: "APPROVED", reviewedBy: req.user.sub, reviewedAt: now, receiptNumber: receiptNumber(id, now) },
      });
      await tx.subscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", startsAt, endsAt } });
      const entitlements = plan.entitlements as { featured?: boolean };
      const vendor = await tx.vendor.findUniqueOrThrow({ where: { id: sub.vendorId } });
      await tx.vendor.update({
        where: { id: sub.vendorId },
        data: {
          planCode: plan.code,
          featuredUntil: entitlements.featured
            ? new Date(Math.max(+endsAt, +(vendor.featuredUntil || 0)))
            : vendor.featuredUntil,
        },
      });
      await audit(tx, req, "subscription.approve", "SubscriptionPayment", id, { vendorId: sub.vendorId, plan: plan.code });
      return { payment: approved, alreadyApproved: false, vendor, plan, endsAt };
    });
    if (!result.alreadyApproved && "vendor" in result && result.vendor)
      await this.notifier.notify(result.vendor.ownerId, {
        title: "Your plan is active",
        body: `${result.plan!.name} is active until ${result.endsAt!.toISOString().slice(0, 10)}. Receipt ${result.payment.receiptNumber}.`,
        link: link("/studio?tab=plan"),
        kind: "SUBSCRIPTION",
        key: `subscription-approved:${id}`,
        channels: { email: true, sms: true },
      });
    return result.payment;
  }

  @Post("admin/subscription-payments/:id/reject") async reject(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    requireAdmin(req);
    const { note } = parse(z.object({ note: z.string().min(5).max(500) }), body);
    const payment = await this.db.subscriptionPayment.findUnique({ where: { id }, include: { subscription: true } });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status !== "SUBMITTED") throw new BadRequestException("This payment was already reviewed");
    await this.db.$transaction([
      this.db.subscriptionPayment.update({
        where: { id },
        data: { status: "REJECTED", note, reviewedBy: req.user.sub, reviewedAt: new Date() },
      }),
      this.db.subscription.update({ where: { id: payment.subscriptionId }, data: { status: "PENDING_PAYMENT" } }),
    ]);
    await audit(this.db, req, "subscription.reject", "SubscriptionPayment", id, { note });
    const vendor = await this.db.vendor.findUnique({ where: { id: payment.subscription.vendorId } });
    if (vendor)
      await this.notifier.notify(vendor.ownerId, {
        title: "We could not confirm your payment",
        body: note,
        link: link("/studio?tab=plan"),
        kind: "SUBSCRIPTION",
        channels: { email: true },
      });
    return { ok: true };
  }

  @Get("admin/plans") async plans(@Req() req: any) {
    requireAdmin(req);
    return this.db.plan.findMany({ orderBy: { sortOrder: "asc" } });
  }

  @Put("admin/plans/:code") async savePlan(@Req() req: any, @Param("code") code: string, @Body() body: unknown) {
    requireAdmin(req);
    const data = parse(
      z.object({
        name: z.string().min(2).max(60),
        priceMinor: amount,
        periodDays: z.number().int().min(1).max(730),
        active: z.boolean().default(true),
        sortOrder: z.number().int().min(0).max(100).default(0),
        entitlements: z.object({
          maxPhotos: z.number().int().min(1).max(500),
          maxServices: z.number().int().min(1).max(500),
          featured: z.boolean(),
          priority: z.number().int().min(0).max(10),
        }),
      }),
      body,
    );
    const key = code.toUpperCase().replace(/[^A-Z0-9_]/g, "");
    const plan = await this.db.plan.upsert({
      where: { code: key },
      update: { ...data, entitlements: data.entitlements as Prisma.InputJsonValue },
      create: { code: key, ...data, entitlements: data.entitlements as Prisma.InputJsonValue },
    });
    await audit(this.db, req, "plan.save", "Plan", key, data);
    return plan;
  }
}

/** Worker: expire finished plans and remind vendors before renewal. */
export async function maintainSubscriptions(db: Database) {
  const now = new Date();
  const expired = await db.subscription.findMany({ where: { status: "ACTIVE", endsAt: { lte: now } } });
  for (const sub of expired) {
    await db.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } });
    const stillActive = await db.subscription.findFirst({
      where: { vendorId: sub.vendorId, status: "ACTIVE", endsAt: { gt: now } },
      orderBy: { endsAt: "desc" },
    });
    await db.vendor.update({
      where: { id: sub.vendorId },
      data: stillActive ? { planCode: stillActive.planCode } : { planCode: null, featuredUntil: null },
    });
  }
  const soon = await db.subscription.findMany({
    where: { status: "ACTIVE", endsAt: { gt: now, lte: new Date(+now + 7 * 86400000) } },
  });
  for (const sub of soon) {
    const renewed = await db.subscription.findFirst({
      where: { vendorId: sub.vendorId, status: "ACTIVE", startsAt: { gte: sub.endsAt! } },
    });
    if (renewed) continue;
    const days = Math.ceil((+sub.endsAt! - +now) / 86400000);
    const bucket = days <= 1 ? "1d" : "7d";
    const vendor = await db.vendor.findUnique({ where: { id: sub.vendorId } });
    if (!vendor) continue;
    const reminder = {
      title: "Your plan renews soon",
      body: `Your ${sub.planCode.toLowerCase()} plan ends on ${sub.endsAt!.toISOString().slice(0, 10)}. Renew to keep your listing benefits.`,
      key: `renewal:${sub.id}:${bucket}`,
      link: link("/studio?tab=plan"),
    };
    await recordNotification(db, vendor.ownerId, { ...reminder, kind: "SUBSCRIPTION", channels: { email: true, sms: days <= 1 } });
  }
}
