import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "./auth";
import { Database } from "./prisma";
import { ownEvent } from "./access";
import { amount, date, parse, z } from "./validation";
@Controller("events")
@UseGuards(AuthGuard)
export class EventsController {
  constructor(private db: Database) {}
  @Get() list(@Req() req: any) {
    return this.db.event.findMany({
      where: { hostId: req.user.sub },
      include: { days: true, tasks: true },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post() create(@Req() req: any, @Body() body: unknown) {
    const data = parse(
      z.object({
        title: z.string().min(2).max(150),
        eventType: z
          .enum(["WEDDING", "HOLUD", "RECEPTION", "CORPORATE"])
          .default("WEDDING"),
        city: z.string().default("Dhaka"),
        budgetMinor: amount,
        guestCapacity: z.number().int().min(1).max(10000),
      }),
      body,
    );
    return this.db.event.create({ data: { ...data, hostId: req.user.sub } });
  }
  @Get(":id") async get(@Req() req: any, @Param("id") id: string) {
    await ownEvent(this.db, id, req.user);
    return this.db.event.findUnique({
      where: { id },
      include: {
        days: true,
        tasks: true,
        bookings: { include: { service: { include: { vendor: true } } } },
        guests: true,
        budget: true,
        expenses: true,
      },
    });
  }
  @Patch(":id") async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z.object({
        title: z.string().min(2).max(150).optional(),
        budgetMinor: amount.optional(),
        guestCapacity: z.number().int().min(1).max(10000).optional(),
        rsvpDeadline: date.optional(),
      }),
      body,
    );
    return this.db.event.update({ where: { id }, data });
  }
  @Post(":id/days") async day(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z
        .object({
          name: z.string().min(2).max(100),
          startsAt: date,
          endsAt: date,
          venueName: z.string().max(150).optional(),
        })
        .refine(
          (d) => new Date(d.startsAt) < new Date(d.endsAt),
          "End must follow start",
        ),
      body,
    );
    return this.db.eventDay.create({ data: { ...data, eventId: id } });
  }
  @Post(":id/tasks") async task(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z.object({ title: z.string().min(2).max(200), dueAt: date.optional() }),
      body,
    );
    return this.db.checklistItem.create({ data: { ...data, eventId: id } });
  }
  @Patch(":id/tasks/:taskId") async toggle(
    @Req() req: any,
    @Param("id") id: string,
    @Param("taskId") taskId: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(z.object({ done: z.boolean() }), body);
    return this.db.checklistItem.updateMany({
      where: { id: taskId, eventId: id },
      data,
    });
  }
}
