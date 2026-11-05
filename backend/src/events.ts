import {
  Body,
  BadRequestException,
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
import { ownEvent, eventAccess } from "./access";
import { amount, date, parse, z } from "./validation";
import { eventTypes, templateFor, allocateBudget } from "./event-templates";
@Controller("events")
@UseGuards(AuthGuard)
export class EventsController {
  constructor(private db: Database) {}
  @Get() list(@Req() req: any) {
    return this.db.event.findMany({
      where: eventAccess(req.user.sub),
      include: { days: true, tasks: true },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post() create(@Req() req: any, @Body() body: unknown) {
    const data = parse(
      z.object({
        title: z.string().min(2).max(150),
        eventType: z.enum(eventTypes).default("GENERAL"),
        starterPlan: z.boolean().default(true),
        startsAt: date.optional(),
        durationHours: z.number().int().min(1).max(72).optional(),
        city: z.string().default("Dhaka"),
        budgetMinor: amount,
        guestCapacity: z.number().int().min(1).max(10000),
      }),
      body,
    );
    const { starterPlan, startsAt, durationHours, ...event } = data,
      template = templateFor(event.eventType);
    if (startsAt && new Date(startsAt) <= new Date())
      throw new BadRequestException("Choose a future event date");
    return this.db.event.create({
      data: {
        ...event,
        hostId: req.user.sub,
        tasks: starterPlan
          ? {
              create: template.checklist.map((title, index) => ({
                title,
                dueAt: startsAt
                  ? new Date(
                      +new Date(startsAt) -
                        (template.checklist.length - index) * 3 * 86400000,
                    )
                  : undefined,
              })),
            }
          : undefined,
        budget: starterPlan
          ? { create: allocateBudget(event.budgetMinor, template.allocations) }
          : undefined,
        days: startsAt
          ? {
              create: {
                name: template.dayName,
                startsAt: new Date(startsAt),
                endsAt: new Date(
                  +new Date(startsAt) +
                    (durationHours || template.durationHours) * 3600000,
                ),
              },
            }
          : undefined,
      },
      include: { days: true, tasks: true, budget: true },
    });
  }
  @Get(":id") async get(@Req() req: any, @Param("id") id: string) {
    const access = await ownEvent(this.db, id, req.user, "read");
    const event = await this.db.event.findUnique({
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
    return event
      ? {
          ...event,
          access: access.access,
          guests: event.guests.map((g) =>
            access.access === "VIEWER" ? { ...g, token: undefined } : g,
          ),
        }
      : null;
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
        eventType: z.enum(eventTypes).optional(),
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
