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
import { AuthGuard } from "./auth";
import { ownEvent, vendorAccess } from "./access";
import { amount, date, parse, z } from "./validation";
import { audit } from "./activity";
@Controller("invoices")
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(private db: Database) {}
  @Get("event/:id") async event(@Req() req: any, @Param("id") id: string) {
    await ownEvent(this.db, id, req.user, "read");
    return this.records({ eventId: id });
  }
  @Get("business") async business(@Req() req: any) {
    const vendors = await this.db.vendor.findMany({
      where: vendorAccess(req.user.sub),
      select: { id: true },
    });
    return this.records({ vendorId: { in: vendors.map((v) => v.id) } });
  }
  async records(where: any) {
    const bookings = await this.db.booking.findMany({
      where,
      include: { service: { include: { vendor: true } }, event: true },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(
      bookings.map(async (b) => {
        const [payments, installments] = await Promise.all([
          this.db.payment.findMany({
            where: { bookingId: b.id },
            orderBy: { createdAt: "asc" },
          }),
          this.db.installment.findMany({
            where: { bookingId: b.id },
            orderBy: { dueAt: "asc" },
          }),
        ]);
        const paid = payments
          .filter((p) => p.status === "CAPTURED")
          .reduce((s, p) => s + p.amountMinor, 0);
        return {
          booking: b,
          number: `UT-${b.createdAt.getUTCFullYear()}-${b.id.slice(-8).toUpperCase()}`,
          payments,
          installments,
          paidMinor: paid,
          outstandingMinor: ["CANCELLED", "EXPIRED"].includes(b.status)
            ? 0
            : b.priceMinor - paid,
          status:
            b.status === "CANCELLED"
              ? "VOID"
              : paid === b.priceMinor
                ? "PAID"
                : paid
                  ? "PARTIAL"
                  : "UNPAID",
        };
      }),
    );
  }
  @Post(":bookingId/plan") async plan(
    @Req() req: any,
    @Param("bookingId") bookingId: string,
    @Body() body: unknown,
  ) {
    const data = parse(
      z.object({
        installments: z
          .array(
            z.object({
              label: z.string().min(2).max(80),
              amountMinor: amount.refine((n) => n > 0),
              dueAt: date,
            }),
          )
          .min(1)
          .max(12),
      }),
      body,
    );
    const booking = await this.db.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    await ownEvent(this.db, booking.eventId, req.user);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${bookingId}))`;
      const current = await tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
      });
      if (current.status !== "CONFIRMED")
        throw new BadRequestException(
          "Confirm the advance before scheduling the balance",
        );
      if (await tx.installment.count({ where: { bookingId } }))
        throw new BadRequestException(
          "This booking already has a payment plan",
        );
      const paid = await tx.payment.aggregate({
        where: { bookingId, status: "CAPTURED" },
        _sum: { amountMinor: true },
      });
      if (
        data.installments.reduce((s, i) => s + i.amountMinor, 0) !==
        current.priceMinor - (paid._sum.amountMinor || 0)
      )
        throw new BadRequestException(
          "Installments must equal the exact remaining balance",
        );
      for (const item of data.installments)
        if (new Date(item.dueAt) <= new Date())
          throw new BadRequestException("Choose future installment deadlines");
      const result = await tx.installment.createMany({
        data: data.installments.map((i) => ({
          ...i,
          eventId: booking.eventId,
          bookingId,
        })),
      });
      await audit(
        tx,
        req.user,
        { eventId: booking.eventId },
        "PAYMENT_PLAN_CREATED",
        `${data.installments.length} installments for ${bookingId}`,
      );
      return result;
    });
  }
}
