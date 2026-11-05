import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent, ownVendor } from "./access";
import { activeStatuses } from "./domain";
import { date, parse, z } from "./validation";
import { reserve } from "./reservations";
import { publishBooking } from "./realtime";
@Controller("bookings")
@UseGuards(AuthGuard)
export class BookingsController {
  constructor(private db: Database) {}
  @Get() list(@Req() req: any) {
    return this.db.booking.findMany({
      where:
        req.user.role === "VENDOR"
          ? { service: { vendor: { ownerId: req.user.sub } } }
          : { event: { hostId: req.user.sub } },
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
    return booking;
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
    });
  }
}
