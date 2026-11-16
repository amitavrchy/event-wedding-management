import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent } from "./access";
import { parse, z } from "./validation";
import { audit } from "./activity";
@Controller("events/:id/check-in")
@UseGuards(AuthGuard)
export class CheckInController {
  constructor(private db: Database) {}
  @Get(":dayId") async list(
    @Req() req: any,
    @Param("id") id: string,
    @Param("dayId") dayId: string,
  ) {
    const event = await ownEvent(this.db, id, req.user, "read");
    await this.db.eventDay.findFirstOrThrow({
      where: { id: dayId, eventId: id },
    });
    const [entries, guests] = await Promise.all([
      this.db.guestCheckin.findMany({
        where: { eventId: id, dayId },
        orderBy: { createdAt: "desc" },
      }),
      this.db.guest.findMany({ where: { eventId: id } }),
    ]);
    return entries.map((e) => ({
      ...e,
      guest: guests
        .map((g) =>
          event.access === "VIEWER" ? { ...g, token: undefined } : g,
        )
        .find((g) => g.id === e.guestId),
    }));
  }
  @Post(":dayId") async arrive(
    @Req() req: any,
    @Param("id") id: string,
    @Param("dayId") dayId: string,
    @Body() body: unknown,
  ) {
    const event = await ownEvent(this.db, id, req.user);
    const { token } = parse(
      z.object({ token: z.string().min(16).max(200) }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      await tx.eventDay.findFirstOrThrow({ where: { id: dayId, eventId: id } });
      const guest = await tx.guest.findFirstOrThrow({
        where: { eventId: id, token },
      });
      if (guest.rsvpStatus !== "ACCEPTED")
        throw new BadRequestException("Only an accepted RSVP can check in");
      const response = await tx.guestResponse.findUnique({
        where: { guestId_dayId: { guestId: guest.id, dayId } },
      });
      if (response && response.status !== "ACCEPTED")
        throw new BadRequestException(
          "This guest did not accept this celebration day",
        );
      const existing = await tx.guestCheckin.findUnique({
        where: { dayId_guestId: { dayId, guestId: guest.id } },
      });
      if (existing) return { ...existing, duplicate: true, guest };
      const entry = await tx.guestCheckin.create({
        data: {
          eventId: id,
          dayId,
          guestId: guest.id,
          partySize: guest.partySize,
          checkedInBy: req.user.sub,
        },
      });
      const total = await tx.guestCheckin.aggregate({
        where: { eventId: id, dayId },
        _sum: { partySize: true },
      });
      await audit(
        tx,
        req.user,
        { eventId: id },
        "GUEST_ARRIVED",
        `${guest.name}, party of ${guest.partySize}`,
      );
      return {
        ...entry,
        duplicate: false,
        guest,
        capacityWarning: (total._sum.partySize || 0) > event.guestCapacity,
      };
    });
  }
  /** Roster for offline scanning on the mobile app (tokens of accepted guests for this day). */
  @Get(":dayId/roster") async roster(@Req() req: any, @Param("id") id: string, @Param("dayId") dayId: string) {
    await ownEvent(this.db, id, req.user);
    await this.db.eventDay.findFirstOrThrow({ where: { id: dayId, eventId: id } });
    const [guests, declined, arrived] = await Promise.all([
      this.db.guest.findMany({
        where: { eventId: id, rsvpStatus: "ACCEPTED" },
        select: { id: true, name: true, token: true, partySize: true, side: true, tableLabel: true },
      }),
      this.db.guestResponse.findMany({ where: { dayId, status: { not: "ACCEPTED" } }, select: { guestId: true } }),
      this.db.guestCheckin.findMany({ where: { dayId }, select: { guestId: true, createdAt: true } }),
    ]);
    const skip = new Set(declined.map((d) => d.guestId));
    return {
      generatedAt: new Date(),
      guests: guests
        .filter((g) => !skip.has(g.id))
        .map((g) => ({ ...g, arrivedAt: arrived.find((a) => a.guestId === g.id)?.createdAt ?? null })),
    };
  }
  /**
   * Uploads arrivals scanned offline. Each item is applied idempotently, so a
   * retried sync never double-counts a guest.
   */
  @Post(":dayId/sync") async sync(@Req() req: any, @Param("id") id: string, @Param("dayId") dayId: string, @Body() body: unknown) {
    await ownEvent(this.db, id, req.user);
    const { items } = parse(
      z.object({ items: z.array(z.object({ clientId: z.string().max(100), token: z.string().min(16).max(200) })).min(1).max(500) }),
      body,
    );
    const results = [];
    for (const item of items) {
      try {
        const result = await this.arrive(req, id, dayId, { token: item.token });
        results.push({ clientId: item.clientId, ok: true, duplicate: result.duplicate, guestId: result.guest.id });
      } catch (error) {
        results.push({ clientId: item.clientId, ok: false, error: (error as Error).message });
      }
    }
    return { results };
  }
  @Delete(":entryId") async undo(
    @Req() req: any,
    @Param("id") id: string,
    @Param("entryId") entryId: string,
  ) {
    await ownEvent(this.db, id, req.user);
    return this.db.guestCheckin.deleteMany({
      where: { id: entryId, eventId: id },
    });
  }
}
