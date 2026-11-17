import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { featuresFor, isFeatureKey } from "./features";
import { AuthGuard } from "./auth";
import { Database } from "./prisma";
import { ownEvent, eventAccess } from "./access";
import { amount, date, parse, z } from "./validation";
import { eventTypes, templateFor, allocateBudget } from "./event-templates";
@Controller("events")
@UseGuards(AuthGuard)
export class EventsController {
  constructor(private db: Database) {}
  @Get() async list(@Req() req: any, @Query("archived") archived?: string) {
    const events = await this.db.event.findMany({
      where: { ...eventAccess(req.user.sub), archivedAt: archived === "true" ? { not: null } : null },
      include: { days: true, tasks: true },
      orderBy: { createdAt: "desc" },
    });
    return events.map((event) => ({ ...event, features: featuresFor(event) }));
  }
  @Post() async create(@Req() req: any, @Body() body: unknown) {
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
    const created = await this.db.event.create({
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
    return { ...created, features: featuresFor(created) };
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
          features: featuresFor(event),
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
        rsvpDeadline: date.nullable().optional(),
        city: z.string().min(2).max(80).optional(),
        enabledFeatures: z.array(z.string().refine(isFeatureKey, "Unknown tool")).max(40).optional(),
        disabledFeatures: z.array(z.string().refine(isFeatureKey, "Unknown tool")).max(40).optional(),
      }),
      body,
    );
    const updated = await this.db.event.update({ where: { id }, data });
    return { ...updated, features: featuresFor(updated) };
  }
  /** Archive hides an event from the switcher without deleting its records. */
  @Post(":id/archive") async archive(@Req() req: any, @Param("id") id: string) {
    const event = await ownEvent(this.db, id, req.user);
    if (event.access !== "OWNER") throw new BadRequestException("Only the host can archive this event");
    return this.db.event.update({ where: { id }, data: { archivedAt: new Date() } });
  }
  @Post(":id/restore") async restore(@Req() req: any, @Param("id") id: string) {
    const event = await ownEvent(this.db, id, req.user);
    if (event.access !== "OWNER") throw new BadRequestException("Only the host can restore this event");
    return this.db.event.update({ where: { id }, data: { archivedAt: null } });
  }
  @Patch(":id/days/:dayId") async updateDay(
    @Req() req: any,
    @Param("id") id: string,
    @Param("dayId") dayId: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const day = await this.db.eventDay.findFirst({ where: { id: dayId, eventId: id } });
    if (!day) throw new NotFoundException("Event day not found");
    const data = parse(
      z.object({
        name: z.string().min(2).max(100).optional(),
        startsAt: date.optional(),
        endsAt: date.optional(),
        venueName: z.string().max(150).nullable().optional(),
      }),
      body,
    );
    const startsAt = data.startsAt ? new Date(data.startsAt) : day.startsAt;
    const endsAt = data.endsAt ? new Date(data.endsAt) : day.endsAt;
    if (startsAt >= endsAt) throw new BadRequestException("End must follow start");
    return this.db.eventDay.update({ where: { id: dayId }, data: { ...data, startsAt, endsAt } });
  }
  @Delete(":id/days/:dayId") async deleteDay(
    @Req() req: any,
    @Param("id") id: string,
    @Param("dayId") dayId: string,
  ) {
    await ownEvent(this.db, id, req.user);
    const day = await this.db.eventDay.findFirst({ where: { id: dayId, eventId: id } });
    if (!day) throw new NotFoundException("Event day not found");
    const [responses, checkins, cues] = await Promise.all([
      this.db.guestResponse.count({ where: { dayId } }),
      this.db.guestCheckin.count({ where: { dayId } }),
      this.db.runSheetItem.count({ where: { dayId } }),
    ]);
    if (checkins) throw new BadRequestException("Guests have already checked in to this day; it cannot be removed");
    await this.db.$transaction([
      this.db.guestResponse.deleteMany({ where: { dayId } }),
      this.db.runSheetItem.deleteMany({ where: { dayId } }),
      this.db.eventDay.delete({ where: { id: dayId } }),
    ]);
    return { ok: true, removedResponses: responses, removedCues: cues };
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
    const data = parse(
      z.object({
        done: z.boolean().optional(),
        title: z.string().min(2).max(200).optional(),
        dueAt: date.nullable().optional(),
      }),
      body,
    );
    const result = await this.db.checklistItem.updateMany({
      where: { id: taskId, eventId: id },
      data,
    });
    if (!result.count) throw new NotFoundException("Task not found");
    return result;
  }
  @Delete(":id/tasks/:taskId") async deleteTask(
    @Req() req: any,
    @Param("id") id: string,
    @Param("taskId") taskId: string,
  ) {
    await ownEvent(this.db, id, req.user);
    const result = await this.db.checklistItem.deleteMany({ where: { id: taskId, eventId: id } });
    if (!result.count) throw new NotFoundException("Task not found");
    return { ok: true };
  }
}
