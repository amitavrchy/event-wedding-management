import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent } from "./access";
import { parse, z } from "./validation";
import { audit } from "./activity";
@Controller("events/:id/seating")
@UseGuards(AuthGuard)
export class SeatingController {
  constructor(private db: Database) {}
  @Get() async get(@Req() req: any, @Param("id") id: string) {
    const event = await ownEvent(this.db, id, req.user, "read");
    return {
      tables: await this.db.seatTable.findMany({
        where: { eventId: id },
        orderBy: { label: "asc" },
      }),
      guests: await this.db.guest
        .findMany({
          where: { eventId: id },
          orderBy: { name: "asc" },
        })
        .then((guests) =>
          guests.map((g) =>
            event.access === "VIEWER" ? { ...g, token: undefined } : g,
          ),
        ),
      capacity: event.guestCapacity,
    };
  }
  @Post("tables") async create(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z.object({
        label: z.string().min(1).max(60),
        capacity: z.number().int().min(1).max(50),
        shape: z.enum(["ROUND", "RECTANGLE"]).default("ROUND"),
        x: z.number().min(0).max(1100).default(100),
        y: z.number().min(0).max(700).default(100),
      }),
      body,
    );
    return this.db.seatTable.create({ data: { ...data, eventId: id } });
  }
  @Patch("tables/:tableId") async move(
    @Req() req: any,
    @Param("id") id: string,
    @Param("tableId") tableId: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z.object({
        x: z.number().min(0).max(1100),
        y: z.number().min(0).max(700),
        version: z.number().int().positive(),
      }),
      body,
    );
    const result = await this.db.seatTable.updateMany({
      where: { id: tableId, eventId: id, version: data.version },
      data: { x: data.x, y: data.y, version: { increment: 1 } },
    });
    if (!result.count)
      throw new ConflictException(
        "Someone moved this table. Refresh the floor plan.",
      );
    return this.db.seatTable.findUniqueOrThrow({ where: { id: tableId } });
  }
  @Post("assign") async assign(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z.object({ guestId: z.string(), tableId: z.string().nullable() }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const guest = await tx.guest.findFirstOrThrow({
        where: { id: data.guestId, eventId: id },
      });
      if (guest.rsvpStatus === "DECLINED" && data.tableId)
        throw new BadRequestException(
          "A declined invitation does not need seating",
        );
      let label: string | null = null;
      if (data.tableId) {
        const table = await tx.seatTable.findFirstOrThrow({
          where: { id: data.tableId, eventId: id },
        });
        const seats = await tx.guest.aggregate({
          where: {
            eventId: id,
            seatingTableId: table.id,
            id: { not: guest.id },
            rsvpStatus: { not: "DECLINED" },
          },
          _sum: { partySize: true },
        });
        if ((seats._sum.partySize || 0) + guest.partySize > table.capacity)
          throw new ConflictException(
            "This party would exceed the table capacity",
          );
        label = table.label;
      }
      const result = await tx.guest.update({
        where: { id: guest.id },
        data: { seatingTableId: data.tableId, tableLabel: label },
      });
      await audit(
        tx,
        req.user,
        { eventId: id },
        "SEATING_UPDATED",
        `${guest.name}: ${label || "unassigned"}`,
      );
      return result;
    });
  }
  @Delete("tables/:tableId") async remove(
    @Req() req: any,
    @Param("id") id: string,
    @Param("tableId") tableId: string,
  ) {
    await ownEvent(this.db, id, req.user);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      await tx.guest.updateMany({
        where: { eventId: id, seatingTableId: tableId },
        data: { seatingTableId: null, tableLabel: null },
      });
      return tx.seatTable.deleteMany({ where: { id: tableId, eventId: id } });
    });
  }
}
