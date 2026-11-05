import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent } from "./access";
import { amount, parse, z } from "./validation";
import { budgetAlert } from "./domain";
@Controller("events/:id/budget")
@UseGuards(AuthGuard)
export class BudgetController {
  constructor(private db: Database) {}
  @Get() async get(@Req() req: any, @Param("id") id: string) {
    const event = await ownEvent(this.db, id, req.user, "read");
    const [items, bookings, expenses, payments] = await Promise.all([
      this.db.budgetItem.findMany({ where: { eventId: id } }),
      this.db.booking.findMany({
        where: { eventId: id, status: { in: ["CONFIRMED", "COMPLETED"] } },
      }),
      this.db.expense.findMany({ where: { eventId: id } }),
      this.db.payment.findMany({ where: { eventId: id, status: "CAPTURED" } }),
    ]);
    const committed = bookings.reduce((sum, b) => sum + b.priceMinor, 0),
      actual =
        expenses.reduce((sum, e) => sum + e.amountMinor, 0) +
        payments.reduce((sum, p) => sum + p.amountMinor, 0);
    return {
      items,
      expenses,
      payments,
      committedMinor: committed,
      actualMinor: actual,
      plannedMinor: event.budgetMinor,
      alert: budgetAlert(event.budgetMinor, committed),
    };
  }
  @Put(":category") async plan(
    @Req() req: any,
    @Param("id") id: string,
    @Param("category") category: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(z.object({ plannedMinor: amount }), body);
    return this.db.budgetItem.upsert({
      where: { eventId_category: { eventId: id, category } },
      create: { ...data, eventId: id, category },
      update: data,
    });
  }
  @Post("expenses") async expense(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z.object({
        category: z.string().min(1).max(50),
        amountMinor: amount,
        note: z.string().min(2).max(300),
      }),
      body,
    );
    return this.db.expense.create({ data: { ...data, eventId: id } });
  }
}
