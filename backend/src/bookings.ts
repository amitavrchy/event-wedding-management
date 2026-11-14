import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent, ownVendor, eventAccess, vendorAccess } from "./access";
import { activeStatuses } from "./domain";
import { date, parse, z } from "./validation";
import { reserve } from "./reservations";
import { publishBooking } from "./realtime";
import { Notifier } from "./notify/notifier";
import { link } from "./notify/templates";
import { sandboxPaymentsEnabled } from "./config";
@Controller("bookings")
@UseGuards(AuthGuard)
export class BookingsController {
  constructor(
    private db: Database,
    private notifier: Notifier,
  ) {}
  @Get() list(@Req() req: any) {
    return this.db.booking.findMany({
      where:
        req.user.role === "VENDOR"
          ? { service: { vendor: vendorAccess(req.user.sub) } }
          : { event: eventAccess(req.user.sub) },
      include: { service: { include: { vendor: true } }, event: true },
      orderBy: { startAt: "asc" },
    });
  }
  @Post() async hold(@Req() req: any, @Body() body: unknown) {
    const data = parse(
      z.object({
        eventId: z.string(),
        serviceId: z.string(),
        startAt: date,
        quoteId: z.string().optional(),
        policyFlags: z
          .array(z.enum(["RAIN_DATE", "FORCE_MAJEURE"]))
          .default([]),
      }),
      body,
    );
    await ownEvent(this.db, data.eventId, req.user);
    const booking = await this.db.$transaction((tx) => reserve(tx, data));
    await publishBooking(this.db, booking.eventId, booking.vendorId);
    const vendor = await this.db.vendor.findUnique({ where: { id: booking.vendorId } });
    if (vendor)
      await this.notifier.notifyTemplate(
        vendor.ownerId,
        "bookingUpdate",
        { title: "New booking request", status: sandboxPaymentsEnabled() ? "waiting for advance" : "please confirm" },
        { link: link("/bookings"), kind: "BOOKING", key: `booking-request:${booking.id}`, channels: { email: true, sms: !sandboxPaymentsEnabled() } },
      );
    return booking;
  }
  /**
   * While online payments are off, the vendor confirms a request after
   * arranging the advance directly with the host.
   */
  @Post(":id/confirm") async confirm(@Req() req: any, @Param("id") id: string) {
    const booking = await this.db.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException("Booking not found");
    await ownVendor(this.db, booking.vendorId, req.user);
    const updated = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.serviceId}))`;
      const current = await tx.booking.findUniqueOrThrow({ where: { id } });
      if (!["HELD", "AWAITING_ADVANCE"].includes(current.status) || current.holdExpiresAt < new Date())
        throw new BadRequestException("This request has expired or is already closed");
      return tx.booking.update({ where: { id }, data: { status: "CONFIRMED" } });
    });
    await publishBooking(this.db, booking.eventId, booking.vendorId);
    const event = await this.db.event.findUnique({ where: { id: booking.eventId } });
    if (event)
      await this.notifier.notifyTemplate(
        event.hostId,
        "bookingUpdate",
        { title: "Your booking", status: "confirmed by the vendor" },
        { link: link("/bookings"), kind: "BOOKING", key: `booking-confirmed:${id}`, channels: { email: true, sms: true } },
      );
    return updated;
  }
  /** Vendor records money received outside the platform (cash, bKash, bank). */
  @Post(":id/offline-payments") async recordPayment(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    const booking = await this.db.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException("Booking not found");
    await ownVendor(this.db, booking.vendorId, req.user);
    const data = parse(
      z.object({
        amountMinor: z.number().int().positive(),
        method: z.enum(["CASH", "BKASH", "NAGAD", "ROCKET", "BANK", "OTHER"]),
        kind: z.enum(["ADVANCE", "BALANCE", "INSTALLMENT"]).default("ADVANCE"),
        idempotencyKey: z.string().min(16).max(100),
      }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const previous = await tx.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (previous) return previous;
      const current = await tx.booking.findUniqueOrThrow({ where: { id } });
      if (!["CONFIRMED", "COMPLETED"].includes(current.status))
        throw new BadRequestException("Confirm the booking before recording payments");
      const paid = await tx.payment.aggregate({ where: { bookingId: id, status: "CAPTURED" }, _sum: { amountMinor: true } });
      if ((paid._sum.amountMinor || 0) + data.amountMinor > current.priceMinor)
        throw new BadRequestException("This is more than the remaining balance");
      return tx.payment.create({
        data: {
          bookingId: id,
          eventId: current.eventId,
          provider: `OFFLINE_${data.method}`,
          status: "CAPTURED",
          amountMinor: data.amountMinor,
          kind: data.kind,
          idempotencyKey: data.idempotencyKey,
        },
      });
    });
  }
  @Patch(":id/status") async status(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const { status } = parse(
      z.object({ status: z.enum(["CANCELLED", "COMPLETED"]) }),
      body,
    );
    const booking = await this.db.booking.findUnique({ where: { id } });
    if (!booking) throw new BadRequestException("Booking not found");
    if (req.user.role === "VENDOR")
      await ownVendor(this.db, booking.vendorId, req.user);
    else await ownEvent(this.db, booking.eventId, req.user);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.serviceId}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const current = await tx.booking.findUniqueOrThrow({ where: { id } });
      if (
        status === "COMPLETED" &&
        (req.user.role !== "VENDOR" ||
          current.status !== "CONFIRMED" ||
          current.endAt > new Date())
      )
        throw new BadRequestException(
          "Only the vendor may complete a confirmed, finished booking",
        );
      if (!activeStatuses.includes(current.status))
        throw new BadRequestException("Booking is already closed");
      const paid = await tx.payment.count({
        where: { bookingId: id, status: "CAPTURED" },
      });
      if (status === "CANCELLED" && paid)
        throw new BadRequestException(
          "Paid booking requires an administrator refund review",
        );
      return tx.booking.update({ where: { id }, data: { status } });
    }).then(async (updated) => {
      await publishBooking(this.db, updated.eventId, updated.vendorId);
      const event = await this.db.event.findUnique({ where: { id: updated.eventId } });
      if (event && status === "COMPLETED")
        // Review request: the only point where a review is possible and fresh.
        await this.notifier.notify(event.hostId, {
          title: "How did it go?",
          body: "Your booking is complete. A short review helps other families choose well.",
          link: link(`/bookings?review=${updated.id}`),
          kind: "REVIEW_REQUEST",
          key: `review-request:${updated.id}`,
          channels: { email: true },
        });
      else if (event && req.user.role === "VENDOR" && status === "CANCELLED")
        await this.notifier.notifyTemplate(
          event.hostId,
          "bookingUpdate",
          { title: "Your booking", status: "cancelled by the vendor" },
          { link: link("/bookings"), kind: "BOOKING", key: `booking-cancelled:${updated.id}`, channels: { email: true, sms: true } },
        );
      return updated;
    });
  }
}
