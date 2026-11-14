import { sandboxPaymentsEnabled } from "./config";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent, ownVendor } from "./access";
import { parse, z } from "./validation";
import { publishBooking } from "./realtime";
@Controller("disputes")
@UseGuards(AuthGuard)
export class DisputesController {
  constructor(private db: Database) {}
  @Get() async list(@Req() req: any) {
    if (req.user.role === "PLATFORM_ADMIN")
      return this.db.dispute.findMany({ orderBy: { createdAt: "desc" } });
    const events = await this.db.event.findMany({
      where: { hostId: req.user.sub },
      select: { id: true },
    });
    return this.db.dispute.findMany({
      where: { eventId: { in: events.map((e) => e.id) } },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post() async request(@Req() req: any, @Body() body: unknown) {
    const data = parse(
      z.object({ bookingId: z.string(), reason: z.string().min(10).max(1000) }),
      body,
    );
    const booking = await this.db.booking.findUniqueOrThrow({
      where: { id: data.bookingId },
    });
    if (req.user.role === "VENDOR")
      await ownVendor(this.db, booking.vendorId, req.user);
    else await ownEvent(this.db, booking.eventId, req.user);
    if (!["CONFIRMED", "COMPLETED"].includes(booking.status))
      throw new BadRequestException(
        "Cancel unpaid holds directly from bookings",
      );
    return this.db.dispute.create({
      data: { ...data, eventId: booking.eventId },
    });
  }
  @Post(":id/resolve") async resolve(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    if (req.user.role !== "PLATFORM_ADMIN") throw new ForbiddenException();
    const { action } = parse(
      z.object({ action: z.enum(["REFUND", "REJECT"]) }),
      body,
    );
    const dispute = await this.db.dispute.findUniqueOrThrow({ where: { id } });
    const booking = await this.db.booking.findUniqueOrThrow({
      where: { id: dispute.bookingId },
    });
    const result = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.serviceId}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.id}))`;
      const current = await tx.dispute.findUniqueOrThrow({ where: { id } });
      if (current.status !== "REQUESTED")
        throw new BadRequestException("This request is already resolved");
      if (action === "REFUND") {
        const payments = await tx.payment.findMany({
          where: { bookingId: booking.id, status: "CAPTURED" },
        });
        if (
          !sandboxPaymentsEnabled() ||
          payments.some((p) => p.provider !== "SANDBOX")
        )
          throw new BadRequestException("Only sandbox refunds are supported");
        await tx.payment.updateMany({
          where: { bookingId: booking.id, status: "CAPTURED" },
          data: { status: "REFUNDED" },
        });
        await tx.ledgerEntry.updateMany({
          where: { paymentId: { in: payments.map((p) => p.id) } },
          data: { status: "REFUNDED" },
        });
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: "CANCELLED" },
        });
        await tx.installment.updateMany({
          where: { bookingId: booking.id },
          data: { status: "CANCELLED" },
        });
      }
      return tx.dispute.update({
        where: { id },
        data: { status: action === "REFUND" ? "REFUNDED" : "REJECTED" },
      });
    });
    await publishBooking(this.db, booking.eventId, booking.vendorId);
    return result;
  }
}
