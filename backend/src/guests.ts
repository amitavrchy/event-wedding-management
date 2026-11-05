import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent } from "./access";
import { parse, z } from "./validation";
const guestSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().max(25).optional(),
  maxPartySize: z.number().int().min(1).max(10).default(2),
  groupName: z.string().min(1).max(60).default("Friends"),
  dietaryNotes: z.string().max(500).optional(),
});
@Controller("events/:id/guests")
@UseGuards(AuthGuard)
export class GuestsController {
  constructor(private db: Database) {}
  @Get() async list(@Req() req: any, @Param("id") id: string) {
    const event=await ownEvent(this.db, id, req.user, "read");
    const guests=await this.db.guest.findMany({
      where: { eventId: id },
      orderBy: { name: "asc" },
    });
    return guests.map(g=>event.access==='VIEWER'?{...g,token:undefined}:g);
  }
  @Post() async add(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(guestSchema, body);
    return this.db.guest.create({
      data: { ...data, eventId: id, token: randomBytes(32).toString("hex") },
    });
  }
  @Post("import") async bulk(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const { guests } = parse(
      z.object({ guests: z.array(guestSchema).min(1).max(500) }),
      body,
    );
    return this.db.guest.createMany({
      data: guests.map((g) => ({
        ...g,
        eventId: id,
        token: randomBytes(32).toString("hex"),
      })),
    });
  }
  @Patch(":guestId") async seat(
    @Req() req: any,
    @Param("id") id: string,
    @Param("guestId") guestId: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(z.object({ tableLabel: z.string().max(50) }), body);
    return this.db.guest.updateMany({
      where: { id: guestId, eventId: id },
      data,
    });
  }
}
@Controller("rsvp")
export class RsvpController {
  constructor(private db: Database) {}
  @Get(":token") async get(@Param("token") token: string) {
    const guest = await this.db.guest.findUnique({
      where: { token },
      include: {
        event: { select: { title: true, days: true, rsvpDeadline: true } },
      },
    });
    if (!guest) throw new BadRequestException("Invitation not found");
    return {
      name: guest.name,
      rsvpStatus: guest.rsvpStatus,
      partySize: guest.partySize,
      maxPartySize: guest.maxPartySize,
      mealPreference: guest.mealPreference,
      dietaryNotes: guest.dietaryNotes,
      event: guest.event,
      responses: await this.db.guestResponse.findMany({
        where: { guestId: guest.id },
        select: { dayId: true, status: true },
      }),
    };
  }
  @Post(":token") async respond(
    @Param("token") token: string,
    @Body() body: unknown,
  ) {
    const data = parse(
      z.object({
        rsvpStatus: z.enum(["ACCEPTED", "DECLINED", "MAYBE"]),
        partySize: z.number().int().min(1).max(10),
        mealPreference: z
          .enum(["Regular", "Vegetarian", "No beef"])
          .default("Regular"),
        dayResponses: z
          .array(
            z.object({
              dayId: z.string(),
              status: z.enum(["ACCEPTED", "DECLINED", "MAYBE"]),
            }),
          )
          .max(30)
          .optional(),
        dietaryNotes: z.string().max(500).optional(),
      }),
      body,
    );
    const guest = await this.db.guest.findUniqueOrThrow({
      where: { token },
      include: { event: true },
    });
    if (guest.event.rsvpDeadline && guest.event.rsvpDeadline < new Date())
      throw new BadRequestException("RSVP deadline has passed");
    if (data.partySize > guest.maxPartySize)
      throw new BadRequestException("Party exceeds your invitation allowance");
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${guest.eventId}))`;
      const { dayResponses, ...values } = data;
      if (dayResponses) {
        const days = await tx.eventDay.findMany({
          where: { eventId: guest.eventId },
          select: { id: true },
        });
        if (
          new Set(dayResponses.map((r) => r.dayId)).size !==
            dayResponses.length ||
          dayResponses.some((r) => !days.some((d) => d.id === r.dayId))
        )
          throw new BadRequestException(
            "Choose celebration days from this invitation",
          );
        for (const response of dayResponses)
          await tx.guestResponse.upsert({
            where: {
              guestId_dayId: { guestId: guest.id, dayId: response.dayId },
            },
            create: { guestId: guest.id, ...response },
            update: { status: response.status },
          });
      }
      await tx.guest.update({ where: { id: guest.id }, data: values });
      const accepted = await tx.guest.aggregate({
        where: { eventId: guest.eventId, rsvpStatus: "ACCEPTED" },
        _sum: { partySize: true },
      });
      let tableWarning = false;
      if (guest.seatingTableId && data.rsvpStatus === "ACCEPTED") {
        const table = await tx.seatTable.findUnique({
          where: { id: guest.seatingTableId },
        });
        const used = await tx.guest.aggregate({
          where: {
            seatingTableId: guest.seatingTableId,
            rsvpStatus: { not: "DECLINED" },
          },
          _sum: { partySize: true },
        });
        tableWarning = Boolean(
          table && (used._sum.partySize || 0) > table.capacity,
        );
      }
      return {
        saved: true,
        capacityWarning:
          (accepted._sum.partySize || 0) > guest.event.guestCapacity ||
          tableWarning,
      };
    });
  }
}
