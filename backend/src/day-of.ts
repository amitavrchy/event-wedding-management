import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { AuthGuard } from "./auth";
import { Database } from "./prisma";
import { ownEvent, ownVendor } from "./access";
import { parse, z } from "./validation";
import { hasFeature } from "./features";
import { appUrl } from "./config";
import { recordNotification } from "./notify/notifier";
import { link } from "./notify/templates";

/**
 * Vendor day-of coordination: each booked vendor gets a private link showing
 * their cues for the event, with an arrival check-in and cue status updates.
 * The host sees arrivals live on the run sheet.
 */
@Controller("events/:id/vendor-links")
@UseGuards(AuthGuard)
export class VendorLinksController {
  constructor(private db: Database) {}

  @Get() async list(@Req() req: any, @Param("id") id: string) {
    const event = await ownEvent(this.db, id, req.user, "read");
    if (!hasFeature(event, "vendorPortal")) throw new ForbiddenException("Turn this tool on in event settings first");
    const bookings = await this.db.booking.findMany({
      where: { eventId: id, status: { in: ["CONFIRMED", "COMPLETED"] } },
      select: { vendorId: true },
      distinct: ["vendorId"],
    });
    const vendorIds = bookings.map((b) => b.vendorId);
    for (const vendorId of vendorIds)
      await this.db.vendorDayLink.upsert({
        where: { eventId_vendorId: { eventId: id, vendorId } },
        update: {},
        create: { eventId: id, vendorId, token: randomBytes(18).toString("base64url") },
      });
    const [links, vendors, cues] = await Promise.all([
      this.db.vendorDayLink.findMany({ where: { eventId: id } }),
      this.db.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, businessName: true, category: true, phone: true } }),
      this.db.runSheetItem.findMany({ where: { eventId: id, vendorId: { not: null } }, select: { vendorId: true, status: true } }),
    ]);
    return links
      .filter((l) => vendorIds.includes(l.vendorId))
      .map((l) => ({
        ...l,
        token: event.access === "VIEWER" ? undefined : l.token,
        url: event.access === "VIEWER" ? undefined : `${appUrl()}/day-of/${l.token}`,
        vendor: vendors.find((v) => v.id === l.vendorId),
        cues: cues.filter((c) => c.vendorId === l.vendorId).length,
        cuesDone: cues.filter((c) => c.vendorId === l.vendorId && c.status === "DONE").length,
      }));
  }
}

@Controller("day-of")
export class PublicDayOfController {
  constructor(private db: Database) {}

  private async link(token: string) {
    const link = await this.db.vendorDayLink.findUnique({ where: { token } });
    if (!link) throw new NotFoundException("This link is not valid");
    const event = await this.db.event.findUnique({ where: { id: link.eventId } });
    if (!event || event.archivedAt || !hasFeature(event, "vendorPortal")) throw new NotFoundException("This link is not valid");
    return { link, event };
  }

  @Get(":token") async view(@Param("token") token: string) {
    const { link, event } = await this.link(token);
    const [vendor, days, cues] = await Promise.all([
      this.db.vendor.findUnique({ where: { id: link.vendorId }, select: { businessName: true } }),
      this.db.eventDay.findMany({ where: { eventId: event.id }, orderBy: { startsAt: "asc" }, select: { id: true, name: true, startsAt: true, endsAt: true, venueName: true } }),
      this.db.runSheetItem.findMany({
        where: { eventId: event.id, vendorId: link.vendorId },
        orderBy: { startsAt: "asc" },
        select: { id: true, dayId: true, title: true, startsAt: true, durationMinutes: true, location: true, notes: true, status: true },
      }),
    ]);
    return { event: { title: event.title }, vendor, days, cues, arrivedAt: link.arrivedAt, arrivedDayId: link.arrivedDayId };
  }

  @Post(":token/arrive") async arrive(@Param("token") token: string, @Body() body: unknown) {
    const { link: dayLink, event } = await this.link(token);
    const { dayId } = parse(z.object({ dayId: z.string() }), body);
    if (!(await this.db.eventDay.findFirst({ where: { id: dayId, eventId: event.id } }))) throw new BadRequestException("Choose a day of this event");
    if (dayLink.arrivedAt && dayLink.arrivedDayId === dayId) return { arrivedAt: dayLink.arrivedAt, duplicate: true };
    const updated = await this.db.vendorDayLink.update({ where: { id: dayLink.id }, data: { arrivedAt: new Date(), arrivedDayId: dayId } });
    const vendor = await this.db.vendor.findUnique({ where: { id: dayLink.vendorId } });
    await recordNotification(this.db, event.hostId, {
      title: `${vendor?.businessName || "A vendor"} has arrived`,
      body: event.title,
      link: link("/run-sheet?view=vendors"),
      kind: "DAY_OF",
      key: `vendor-arrived:${dayLink.id}:${dayId}`,
    });
    return { arrivedAt: updated.arrivedAt, duplicate: false };
  }

  @Post(":token/cues/:cueId") async cue(@Param("token") token: string, @Param("cueId") cueId: string, @Body() body: unknown) {
    const { link: dayLink, event } = await this.link(token);
    const { status } = parse(z.object({ status: z.enum(["READY", "DONE"]) }), body);
    const result = await this.db.runSheetItem.updateMany({
      where: { id: cueId, eventId: event.id, vendorId: dayLink.vendorId, status: { not: "DONE" } },
      data: { status, version: { increment: 1 } },
    });
    if (!result.count) throw new BadRequestException("This cue cannot be updated");
    return { ok: true };
  }
}

/** Vendor monthly performance report. */
@Controller("vendors/:id/report")
@UseGuards(AuthGuard)
export class VendorReportController {
  constructor(private db: Database) {}
  @Get() async report(@Req() req: any, @Param("id") id: string, @Query("month") month?: string) {
    await ownVendor(this.db, id, req.user, "read");
    return monthlyReport(this.db, id, month);
  }
}

export async function monthlyReport(db: Database, vendorId: string, month?: string) {
  const key = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 7);
  const from = new Date(`${key}-01T00:00:00+06:00`);
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + 1);
  const range = { gte: from, lt: to };
  const [inquiries, responded, quotes, accepted, bookings, payments, reviews, vendor] = await Promise.all([
    db.inquiry.count({ where: { vendorId, createdAt: range } }),
    db.inquiry.findMany({ where: { vendorId, createdAt: range, respondedAt: { not: null } }, select: { createdAt: true, respondedAt: true } }),
    db.quote.count({ where: { vendorId, expiresAt: { gte: from } } }),
    db.quote.count({ where: { vendorId, status: "ACCEPTED", expiresAt: { gte: from } } }),
    db.booking.findMany({ where: { vendorId, createdAt: range, status: { in: ["CONFIRMED", "COMPLETED"] } }, select: { priceMinor: true } }),
    db.payment.aggregate({ where: { booking: { vendorId }, status: "CAPTURED", createdAt: range }, _sum: { amountMinor: true } }),
    db.review.aggregate({ where: { vendorId, createdAt: range, status: "PUBLISHED" }, _avg: { rating: true }, _count: true }),
    db.vendor.findUnique({ where: { id: vendorId }, select: { businessName: true, ratingAvg: true, ratingCount: true } }),
  ]);
  const avgResponse = responded.length
    ? Math.round(responded.reduce((n, i) => n + (+i.respondedAt! - +i.createdAt) / 60000, 0) / responded.length)
    : null;
  return {
    month: key,
    vendor,
    inquiries,
    respondedInquiries: responded.length,
    responseRate: inquiries ? Math.round((responded.length / inquiries) * 100) : null,
    averageResponseMinutes: avgResponse,
    quotesSent: quotes,
    quotesAccepted: accepted,
    bookings: bookings.length,
    bookedValueMinor: bookings.reduce((n, b) => n + b.priceMinor, 0),
    paymentsRecordedMinor: payments._sum.amountMinor || 0,
    newReviews: reviews._count,
    newReviewAverage: reviews._avg.rating,
  };
}

/** Worker: on the 1st (Asia/Dhaka) tell each active vendor how last month went. */
export async function sendMonthlyReports(db: Database, now = new Date()) {
  const local = new Date(+now + 6 * 3600000);
  if (local.getUTCDate() !== 1 || local.getUTCHours() < 9) return;
  const previous = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const vendors = await db.vendor.findMany({ where: { status: "ACTIVE" }, select: { id: true, ownerId: true } });
  for (const v of vendors) {
    const key = `monthly-report:${v.id}:${previous}`;
    if (await db.notification.findUnique({ where: { key } })) continue;
    const r = await monthlyReport(db, v.id, previous);
    await recordNotification(db, v.ownerId, {
      key,
      title: `Your ${previous} report`,
      body: `${r.inquiries} inquiries, ${r.bookings} bookings${r.averageResponseMinutes != null ? `, average reply ${r.averageResponseMinutes} min` : ""}.`,
      link: link(`/insights?month=${previous}`),
      kind: "REPORT",
      channels: { email: true },
    });
  }
}
