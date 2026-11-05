import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent, ownVendor } from "./access";
@Controller("insights")
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private db: Database) {}
  @Get("event/:id") async event(@Req() req: any, @Param("id") id: string) {
    const event = await ownEvent(this.db, id, req.user, "read");
    const [guests, bookings, tasks, payments, expenses, activity] =
      await Promise.all([
        this.db.guest.findMany({ where: { eventId: id } }),
        this.db.booking.findMany({ where: { eventId: id } }),
        this.db.checklistItem.findMany({ where: { eventId: id } }),
        this.db.payment.findMany({
          where: { eventId: id, status: "CAPTURED" },
        }),
        this.db.expense.findMany({ where: { eventId: id } }),
        this.db.activity.findMany({
          where: { eventId: id },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      ]);
    const committed = bookings
        .filter((b) => ["CONFIRMED", "COMPLETED"].includes(b.status))
        .reduce((s, b) => s + b.priceMinor, 0),
      actual =
        payments.reduce((s, p) => s + p.amountMinor, 0) +
        expenses.reduce((s, e) => s + e.amountMinor, 0);
    return {
      plannedMinor: event.budgetMinor,
      committedMinor: committed,
      actualMinor: actual,
      remainingMinor: event.budgetMinor - committed,
      guests: {
        invited: guests.length,
        accepted: guests.filter((g) => g.rsvpStatus === "ACCEPTED").length,
        attending: guests
          .filter((g) => g.rsvpStatus === "ACCEPTED")
          .reduce((s, g) => s + g.partySize, 0),
        declined: guests.filter((g) => g.rsvpStatus === "DECLINED").length,
        seated: guests
          .filter((g) => g.seatingTableId && g.rsvpStatus === "ACCEPTED")
          .reduce((s, g) => s + g.partySize, 0),
      },
      tasks: {
        total: tasks.length,
        done: tasks.filter((t) => t.done).length,
        overdue: tasks.filter((t) => !t.done && t.dueAt && t.dueAt < new Date())
          .length,
      },
      categories: [...new Set(bookings.map((b) => b.category))].map(
        (category) => ({
          category,
          committedMinor: bookings
            .filter(
              (b) =>
                b.category === category &&
                ["CONFIRMED", "COMPLETED"].includes(b.status),
            )
            .reduce((s, b) => s + b.priceMinor, 0),
        }),
      ),
      activity,
    };
  }
  @Get("business/:id") async business(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    await ownVendor(this.db, id, req.user, "read");
    const [leads, bookings, ledger, activity] = await Promise.all([
      this.db.lead.findMany({ where: { vendorId: id } }),
      this.db.booking.findMany({ where: { vendorId: id } }),
      this.db.ledgerEntry.findMany({
        where: { vendorId: id, status: { not: "REFUNDED" } },
      }),
      this.db.activity.findMany({
        where: { vendorId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    return {
      leads: leads.length,
      won: leads.filter((l) => l.stage === "WON").length,
      pipelineMinor: leads
        .filter((l) => !["WON", "LOST"].includes(l.stage))
        .reduce((s, l) => s + l.estimatedMinor, 0),
      grossMinor: ledger.reduce((s, l) => s + l.grossMinor, 0),
      commissionMinor: ledger.reduce((s, l) => s + l.commissionMinor, 0),
      netMinor: ledger.reduce((s, l) => s + l.netMinor, 0),
      outstandingPayoutMinor: ledger
        .filter((l) => l.status === "PENDING")
        .reduce((s, l) => s + l.netMinor, 0),
      confirmedBookings: bookings.filter((b) => b.status === "CONFIRMED")
        .length,
      monthly: Array.from({ length: 6 }, (_, i) => {
        const date = new Date();
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() - 5 + i);
        const month = date.toISOString().slice(0, 7);
        return {
          month,
          netMinor: ledger
            .filter((l) => l.createdAt.toISOString().startsWith(month))
            .reduce((s, l) => s + l.netMinor, 0),
        };
      }),
      activity,
    };
  }
}
