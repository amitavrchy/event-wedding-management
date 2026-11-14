import {
  BadRequestException,
  Body,
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
import { randomBytes } from "node:crypto";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent } from "./access";
import { parse, z } from "./validation";
import { featuresFor } from "./features";
const SIDES = ["BRIDE", "GROOM", "BOTH"] as const;
const guestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().max(25).optional(),
  maxPartySize: z.number().int().min(1).max(20).default(2),
  groupName: z.string().min(1).max(60).default("Friends"),
  dietaryNotes: z.string().max(500).optional(),
  side: z.enum(SIDES).nullable().optional(),
  householdId: z.string().nullable().optional(),
  relationship: z.string().max(60).optional(),
});
const token = () => randomBytes(32).toString("hex");

async function checkHousehold(db: Database, eventId: string, householdId?: string | null) {
  if (!householdId) return;
  if (!(await db.household.findFirst({ where: { id: householdId, eventId } })))
    throw new BadRequestException("Choose a family from this event");
}

@Controller("events/:id/guests")
@UseGuards(AuthGuard)
export class GuestsController {
  constructor(private db: Database) {}
  @Get() async list(@Req() req: any, @Param("id") id: string, @Query() query: any) {
    const event = await ownEvent(this.db, id, req.user, "read");
    const filter = parse(
      z.object({
        side: z.enum(SIDES).optional(),
        householdId: z.string().optional(),
        status: z.enum(["INVITED", "ACCEPTED", "DECLINED", "MAYBE"]).optional(),
      }),
      { side: query?.side, householdId: query?.householdId, status: query?.status },
    );
    const guests = await this.db.guest.findMany({
      where: { eventId: id, side: filter.side, householdId: filter.householdId, rsvpStatus: filter.status },
      orderBy: { name: "asc" },
    });
    return guests.map((g) =>
      event.access === "VIEWER" ? { ...g, token: undefined } : g,
    );
  }
  @Post() async add(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(guestSchema, body);
    await checkHousehold(this.db, id, data.householdId);
    return this.db.guest.create({
      data: { ...data, eventId: id, token: token() },
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
    for (const householdId of new Set(guests.map((g) => g.householdId).filter(Boolean)))
      await checkHousehold(this.db, id, householdId);
    return this.db.guest.createMany({
      data: guests.map((g) => ({ ...g, eventId: id, token: token() })),
    });
  }
  /** Edit any guest detail. Seating moves keep using the seating studio. */
  @Patch(":guestId") async update(
    @Req() req: any,
    @Param("id") id: string,
    @Param("guestId") guestId: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      guestSchema.partial().extend({
        tableLabel: z.string().max(50).optional(),
        partySize: z.number().int().min(1).max(20).optional(),
        mealPreference: z.string().max(40).nullable().optional(),
        rsvpStatus: z.enum(["INVITED", "ACCEPTED", "DECLINED", "MAYBE"]).optional(),
      }),
      body,
    );
    // Partial schemas keep zod defaults; only apply what was sent.
    const sent = Object.fromEntries(
      Object.entries(data).filter(([key]) => body && typeof body === "object" && key in (body as object)),
    );
    await checkHousehold(this.db, id, sent.householdId as string | undefined);
    const guest = await this.db.guest.findFirst({ where: { id: guestId, eventId: id } });
    if (!guest) throw new NotFoundException("Guest not found");
    const max = (sent.maxPartySize as number | undefined) ?? guest.maxPartySize;
    if (((sent.partySize as number | undefined) ?? guest.partySize) > max)
      throw new BadRequestException("Party size is above this guest's allowance");
    return this.db.guest.update({ where: { id: guestId }, data: sent });
  }
  @Delete(":guestId") async remove(
    @Req() req: any,
    @Param("id") id: string,
    @Param("guestId") guestId: string,
  ) {
    await ownEvent(this.db, id, req.user);
    const guest = await this.db.guest.findFirst({ where: { id: guestId, eventId: id } });
    if (!guest) throw new NotFoundException("Guest not found");
    if (await this.db.guestCheckin.count({ where: { guestId } }))
      throw new BadRequestException("This guest has already checked in and cannot be removed");
    await this.db.$transaction([
      this.db.guestResponse.deleteMany({ where: { guestId } }),
      this.db.guestTravel.deleteMany({ where: { guestId } }),
      this.db.gift.updateMany({ where: { guestId }, data: { guestId: null } }),
      this.db.guest.delete({ where: { id: guestId } }),
    ]);
    return { ok: true };
  }
  /** Marks invitations as sent (after sharing links by WhatsApp/SMS). */
  @Post("mark-sent") async markSent(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z.object({ guestIds: z.array(z.string()).max(1000).default([]), householdIds: z.array(z.string()).max(500).default([]) }),
      body,
    );
    const now = new Date();
    const [guests, households] = await this.db.$transaction([
      this.db.guest.updateMany({ where: { eventId: id, id: { in: data.guestIds } }, data: { invitationSentAt: now } }),
      this.db.household.updateMany({ where: { eventId: id, id: { in: data.householdIds } }, data: { invitationSentAt: now } }),
    ]);
    return { guests: guests.count, households: households.count };
  }
  /** Bride/groom side summary: counts against each family's quota. */
  @Get("sides/summary") async sides(@Req() req: any, @Param("id") id: string) {
    const event = await ownEvent(this.db, id, req.user, "read");
    const rows = await this.db.guest.groupBy({
      by: ["side", "rsvpStatus"],
      where: { eventId: id },
      _count: true,
      _sum: { partySize: true, maxPartySize: true },
    });
    const config = (event.sides || {}) as Record<string, { label?: string; quota?: number }>;
    return (["BRIDE", "GROOM", "BOTH", null] as const).map((side) => {
      const mine = rows.filter((r) => r.side === side);
      return {
        side,
        label: side ? config[side]?.label || { BRIDE: "Bride's side", GROOM: "Groom's side", BOTH: "Both families" }[side] : "Not assigned",
        quota: side ? config[side]?.quota ?? null : null,
        invitations: mine.reduce((n, r) => n + r._count, 0),
        invitedPeople: mine.reduce((n, r) => n + (r._sum.maxPartySize || 0), 0),
        acceptedPeople: mine.filter((r) => r.rsvpStatus === "ACCEPTED").reduce((n, r) => n + (r._sum.partySize || 0), 0),
      };
    });
  }
}

@Controller("events/:id/households")
@UseGuards(AuthGuard)
export class HouseholdsController {
  constructor(private db: Database) {}
  @Get() async list(@Req() req: any, @Param("id") id: string) {
    const event = await ownEvent(this.db, id, req.user, "read");
    const households = await this.db.household.findMany({ where: { eventId: id }, orderBy: { name: "asc" } });
    const guests = await this.db.guest.findMany({
      where: { eventId: id, householdId: { in: households.map((h) => h.id) } },
      select: { id: true, name: true, householdId: true, rsvpStatus: true, partySize: true, maxPartySize: true },
    });
    return households.map((h) => ({
      ...h,
      token: event.access === "VIEWER" ? undefined : h.token,
      members: guests.filter((g) => g.householdId === h.id),
    }));
  }
  @Post() async create(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z.object({
        name: z.string().trim().min(2).max(100),
        side: z.enum(SIDES).nullable().optional(),
        phone: z.string().max(25).optional(),
        address: z.string().max(300).optional(),
        /** Optional members to create at the same time. */
        members: z.array(z.object({ name: z.string().trim().min(2).max(100), relationship: z.string().max(60).optional() })).max(30).default([]),
      }),
      body,
    );
    const { members, ...values } = data;
    return this.db.$transaction(async (tx) => {
      const household = await tx.household.create({ data: { ...values, eventId: id, token: token() } });
      if (members.length)
        await tx.guest.createMany({
          data: members.map((m) => ({
            ...m,
            eventId: id,
            householdId: household.id,
            side: values.side,
            phone: values.phone,
            groupName: "Family",
            maxPartySize: 1,
            token: token(),
          })),
        });
      return household;
    });
  }
  @Patch(":householdId") async update(@Req() req: any, @Param("id") id: string, @Param("householdId") householdId: string, @Body() body: unknown) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z.object({
        name: z.string().trim().min(2).max(100).optional(),
        side: z.enum(SIDES).nullable().optional(),
        phone: z.string().max(25).nullable().optional(),
        address: z.string().max(300).nullable().optional(),
      }),
      body,
    );
    const result = await this.db.household.updateMany({ where: { id: householdId, eventId: id }, data });
    if (!result.count) throw new NotFoundException("Family not found");
    if (data.side !== undefined)
      await this.db.guest.updateMany({ where: { householdId, eventId: id }, data: { side: data.side } });
    return this.db.household.findUnique({ where: { id: householdId } });
  }
  /** Removing a family keeps its members as individual guests. */
  @Delete(":householdId") async remove(@Req() req: any, @Param("id") id: string, @Param("householdId") householdId: string) {
    await ownEvent(this.db, id, req.user);
    const household = await this.db.household.findFirst({ where: { id: householdId, eventId: id } });
    if (!household) throw new NotFoundException("Family not found");
    await this.db.$transaction([
      this.db.guest.updateMany({ where: { householdId }, data: { householdId: null } }),
      this.db.household.delete({ where: { id: householdId } }),
    ]);
    return { ok: true };
  }
}
@Controller("rsvp")
export class RsvpController {
  constructor(private db: Database) {}
  /** Family invitation: one link, a reply for each member. */
  @Get("household/:token") async household(@Param("token") token: string) {
    const household = await this.db.household.findUnique({ where: { token } });
    if (!household) throw new NotFoundException("Invitation not found");
    if (!household.invitationOpenedAt)
      await this.db.household.update({ where: { id: household.id }, data: { invitationOpenedAt: new Date() } });
    const members = await this.db.guest.findMany({ where: { householdId: household.id }, orderBy: { name: "asc" } });
    const first = members[0] ? await this.get(members[0].token) : null;
    return {
      name: household.name,
      event: first?.event ?? null,
      card: first?.card ?? null,
      livestreamUrl: first?.livestreamUrl ?? null,
      members: members.map((m) => ({
        token: m.token,
        name: m.name,
        relationship: m.relationship,
        rsvpStatus: m.rsvpStatus,
        partySize: m.partySize,
        maxPartySize: m.maxPartySize,
        mealPreference: m.mealPreference,
      })),
    };
  }
  @Post("household/:token") async respondHousehold(@Param("token") token: string, @Body() body: unknown) {
    const household = await this.db.household.findUnique({ where: { token } });
    if (!household) throw new NotFoundException("Invitation not found");
    const { replies } = parse(
      z.object({ replies: z.array(z.object({ token: z.string().max(100), reply: z.unknown() })).min(1).max(30) }),
      body,
    );
    const members = await this.db.guest.findMany({ where: { householdId: household.id }, select: { token: true } });
    let capacityWarning = false;
    for (const r of replies) {
      if (!members.some((m) => m.token === r.token)) throw new BadRequestException("Reply for a member of this family");
      capacityWarning = (await this.respond(r.token, r.reply)).capacityWarning || capacityWarning;
    }
    return { saved: true, capacityWarning };
  }
  @Get(":token") async get(@Param("token") token: string) {
    const guest = await this.db.guest.findUnique({
      where: { token },
      include: {
        event: {
          select: { id: true, title: true, eventType: true, days: true, rsvpDeadline: true, livestreamUrl: true, enabledFeatures: true, disabledFeatures: true },
        },
      },
    });
    if (!guest) throw new NotFoundException("Invitation not found");
    if (!guest.invitationOpenedAt)
      await this.db.guest.update({ where: { id: guest.id }, data: { invitationOpenedAt: new Date() } });
    const features = featuresFor(guest.event);
    const card = features.includes("invitations")
      ? await this.db.invitationCard.findFirst({ where: { eventId: guest.event.id }, orderBy: { updatedAt: "desc" } })
      : null;
    const { id: _eventId, enabledFeatures: _e, disabledFeatures: _d, livestreamUrl, ...event } = guest.event;
    return {
      card: card && { template: card.template, language: card.language, headline: card.headline, hostLine: card.hostLine, message: card.message },
      livestreamUrl: features.includes("livestream") ? livestreamUrl : null,
      name: guest.name,
      rsvpStatus: guest.rsvpStatus,
      partySize: guest.partySize,
      maxPartySize: guest.maxPartySize,
      mealPreference: guest.mealPreference,
      dietaryNotes: guest.dietaryNotes,
      event,
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
      await tx.guest.update({ where: { id: guest.id }, data: { ...values, respondedAt: new Date() } });
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
