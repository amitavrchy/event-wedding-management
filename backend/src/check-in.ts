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
