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
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent, ownVendor } from "./access";
import { parse, z } from "./validation";
import { audit, pagination, requireAdmin } from "./common";
import { Notifier } from "./notify/notifier";
import { link } from "./notify/templates";

export async function refreshRating(db: Database, vendorId: string) {
  const stats = await db.review.aggregate({
    where: { vendorId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: true,
  });
  await db.vendor.update({
    where: { id: vendorId },
    data: { ratingAvg: Math.round((stats._avg.rating || 0) * 10) / 10, ratingCount: stats._count },
  });
}

/**
 * Reviews: only the event host (or an editor) of a completed booking may
 * review, once per booking. Vendors can reply once and report abuse; reported
 * reviews stay visible until an administrator decides.
 */
@Controller("reviews")
@UseGuards(AuthGuard)
export class ReviewsController {
  constructor(
    private db: Database,
    private notifier: Notifier,
  ) {}
  @Post() async create(@Req() req: any, @Body() body: unknown) {
    if (req.user.role === "VENDOR") throw new ForbiddenException("Only hosts can leave reviews");
    const data = parse(
      z.object({
        bookingId: z.string(),
        rating: z.number().int().min(1).max(5),
        body: z.string().trim().min(5).max(2000),
      }),
      body,
    );
    const booking = await this.db.booking.findUniqueOrThrow({
      where: { id: data.bookingId },
    });
    await ownEvent(this.db, booking.eventId, req.user);
    if (booking.status !== "COMPLETED")
      throw new BadRequestException("Reviews open after your booking is completed");
    const review = await this.db.review.create({
      data: { ...data, vendorId: booking.vendorId, hostId: req.user.sub },
    });
    await refreshRating(this.db, booking.vendorId);
    const vendor = await this.db.vendor.findUnique({ where: { id: booking.vendorId } });
    if (vendor)
      await this.notifier.notify(vendor.ownerId, {
        title: `New ${data.rating}★ review`,
        body: data.body.slice(0, 120),
        link: link("/studio?tab=reviews"),
        kind: "REVIEW",
        key: `review:${review.id}`,
      });
    return review;
  }

  @Get("vendor/:vendorId") async forVendor(@Req() req: any, @Param("vendorId") vendorId: string, @Query() query: any) {
    await ownVendor(this.db, vendorId, req.user, "read");
    const page = pagination(query);
    const [total, items] = await Promise.all([
      this.db.review.count({ where: { vendorId } }),
      this.db.review.findMany({ where: { vendorId }, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take }),
    ]);
    return page.wrap(items, total);
  }

  @Post(":id/reply") async reply(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    const review = await this.db.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException("Review not found");
    await ownVendor(this.db, review.vendorId, req.user);
    if (review.reply) throw new BadRequestException("You have already replied to this review");
    const { reply } = parse(z.object({ reply: z.string().trim().min(2).max(1000) }), body);
    return this.db.review.update({ where: { id }, data: { reply, repliedAt: new Date() } });
  }

  @Post(":id/report") async report(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    const review = await this.db.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException("Review not found");
    await ownVendor(this.db, review.vendorId, req.user);
    const { reason } = parse(z.object({ reason: z.string().trim().min(10).max(500) }), body);
    return this.db.review.update({ where: { id }, data: { status: review.status === "HIDDEN" ? "HIDDEN" : "REPORTED", reportReason: reason } });
  }

  @Get("admin/reported") async reported(@Req() req: any, @Query() query: any) {
    requireAdmin(req);
    const page = pagination(query);
    const where = { status: "REPORTED" };
    const [total, items] = await Promise.all([
      this.db.review.count({ where }),
      this.db.review.findMany({ where, orderBy: { createdAt: "asc" }, skip: page.skip, take: page.take }),
    ]);
    return page.wrap(items, total);
  }

  @Post(":id/moderate") async moderate(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    requireAdmin(req);
    const { status } = parse(z.object({ status: z.enum(["PUBLISHED", "HIDDEN"]) }), body);
    const review = await this.db.review.update({ where: { id }, data: { status } });
    await refreshRating(this.db, review.vendorId);
    await audit(this.db, req, `review.${status.toLowerCase()}`, "Review", id);
    return review;
  }
}
