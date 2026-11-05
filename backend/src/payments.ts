import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent } from "./access";
import { commission } from "./domain";
import { parse, z } from "./validation";
@Controller("payments")
export class PaymentsController {
  constructor(private db: Database) {}
  @Get("event/:id") @UseGuards(AuthGuard) async list(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    await ownEvent(this.db, id, req.user);
    return this.db.payment.findMany({
      where: { eventId: id },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post() @UseGuards(AuthGuard) async create(
    @Req() req: any,
    @Body() body: unknown,
  ) {
    const data = parse(
      z.object({
        bookingId: z.string(),
        provider: z.enum(["SANDBOX", "BKASH", "NAGAD", "SSLCOMMERZ"]),
        kind: z.enum(["ADVANCE", "BALANCE"]),
        idempotencyKey: z.string().min(16).max(100),
      }),
      body,
    );
    const booking = await this.db.booking.findUniqueOrThrow({
      where: { id: data.bookingId },
    });
    await ownEvent(this.db, booking.eventId, req.user);
    if (data.provider !== "SANDBOX" || process.env.PAYMENT_MODE !== "sandbox")
      throw new BadRequestException(
        "Live gateway is not configured. No payment has been taken.",
      );
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.id}))`;
      const previous = await tx.payment.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (previous) {
        if (previous.bookingId !== booking.id || previous.kind !== data.kind)
          throw new BadRequestException(
            "Idempotency key belongs to a different payment",
          );
        return previous;
      }
      const current = await tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
      });
      const captured = await tx.payment.aggregate({
        where: { bookingId: booking.id, status: "CAPTURED" },
        _sum: { amountMinor: true },
      });
      const paid = captured._sum.amountMinor || 0;
      if (
        !["HELD", "AWAITING_ADVANCE", "CONFIRMED"].includes(current.status) ||
        (!["CONFIRMED"].includes(current.status) &&
          current.holdExpiresAt < new Date())
      )
        throw new BadRequestException("Booking is closed or its hold expired");
      if (data.kind === "BALANCE" && current.status !== "CONFIRMED")
        throw new BadRequestException("Pay the advance first");
      if (data.kind === "ADVANCE" && paid > 0)
        throw new BadRequestException("Advance already paid");
      const amountMinor =
        data.kind === "ADVANCE"
          ? current.advanceMinor
          : current.priceMinor - paid;
      if (amountMinor <= 0) throw new BadRequestException("Already fully paid");
      return tx.payment.create({
        data: { ...data, eventId: booking.eventId, amountMinor },
      });
    });
  }
  @Post(":id/sandbox-confirm") @UseGuards(AuthGuard) async sandbox(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    if (process.env.PAYMENT_MODE !== "sandbox")
      throw new BadRequestException("Sandbox is disabled");
    const payment = await this.db.payment.findUniqueOrThrow({ where: { id } });
    await ownEvent(this.db, payment.eventId, req.user);
    if (payment.provider !== "SANDBOX") throw new BadRequestException();
    return this.capture(id);
  }
  @Post("webhook") async webhook(
    @Body() body: unknown,
    @Headers("x-signature") signature: string,
  ) {
    const data = parse(
      z.object({ paymentId: z.string(), status: z.literal("CAPTURED") }),
      body,
    );
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) throw new BadRequestException("Webhook not configured");
    const expected = createHmac("sha256", secret)
      .update(JSON.stringify(data))
      .digest("hex");
    if (
      !signature ||
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      throw new BadRequestException("Invalid signature");
    return this.capture(data.paymentId);
  }
  async capture(id: string) {
    return this.db.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id } });
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment.bookingId}))`;
      const fresh = await tx.payment.findUniqueOrThrow({ where: { id } });
      if (fresh.status === "CAPTURED") return fresh;
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: payment.bookingId },
      });
      if (
        !["HELD", "AWAITING_ADVANCE", "CONFIRMED"].includes(booking.status) ||
        (booking.status !== "CONFIRMED" && booking.holdExpiresAt < new Date())
      )
        throw new BadRequestException(
          "Booking hold expired; payment was not captured",
        );
      const paid = await tx.payment.aggregate({
        where: { bookingId: booking.id, status: "CAPTURED" },
        _sum: { amountMinor: true },
      });
      if (payment.kind === "ADVANCE" && (paid._sum.amountMinor || 0) > 0)
        throw new BadRequestException(
          "An advance was already captured for this booking",
        );
      if (
        (paid._sum.amountMinor || 0) + payment.amountMinor >
        booking.priceMinor
      )
        throw new BadRequestException("Payment exceeds remaining balance");
      const vendor = await tx.vendor.findUniqueOrThrow({
        where: { id: booking.vendorId },
      });
      await tx.ledgerEntry.create({
        data: {
          paymentId: id,
          vendorId: vendor.id,
          ...commission(payment.amountMinor, vendor.commissionBps),
        },
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CONFIRMED" },
      });
      return tx.payment.update({ where: { id }, data: { status: "CAPTURED" } });
    });
  }
}
