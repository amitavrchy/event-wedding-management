import {
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
import { date, parse, z } from "./validation";
import { audit } from "./activity";
@Controller("events/:id/run-sheet")
@UseGuards(AuthGuard)
export class RunSheetController {
  constructor(private db: Database) {}
  @Get() async list(@Req() req: any, @Param("id") id: string) {
    await ownEvent(this.db, id, req.user, "read");
    return this.db.runSheetItem.findMany({
      where: { eventId: id },
      orderBy: { startsAt: "asc" },
    });
  }
  @Post() async create(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z.object({
        dayId: z.string(),
        title: z.string().min(2).max(150),
        startsAt: date,
        durationMinutes: z.number().int().min(1).max(1440),
        owner: z.string().min(1).max(100),
        location: z.string().max(150).optional(),
        notes: z.string().max(3000).optional(),
      }),
      body,
    );
    await this.db.eventDay.findFirstOrThrow({
      where: { id: data.dayId, eventId: id },
    });
    return this.db.runSheetItem.create({ data: { ...data, eventId: id } });
  }
  @Patch(":itemId") async update(
    @Req() req: any,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z.object({
        version: z.number().int().positive(),
        status: z.enum(["PLANNED", "READY", "LIVE", "DONE"]).optional(),
        startsAt: date.optional(),
        owner: z.string().min(1).max(100).optional(),
        notes: z.string().max(3000).optional(),
      }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const item = await tx.runSheetItem.findFirstOrThrow({
        where: { id: itemId, eventId: id },
      });
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${item.dayId}))`;
      if (
        data.status === "LIVE" &&
        (await tx.runSheetItem.findFirst({
          where: { dayId: item.dayId, status: "LIVE", id: { not: itemId } },
        }))
      )
        throw new ConflictException(
          "Finish the current live cue before starting the next",
        );
      const { version, ...values } = data;
      const result = await tx.runSheetItem.updateMany({
        where: { id: itemId, eventId: id, version },
        data: { ...values, version: { increment: 1 } },
      });
      if (!result.count)
        throw new ConflictException(
          "The run sheet changed. Refresh before updating.",
        );
      await audit(
        tx,
        req.user,
        { eventId: id },
        "RUN_SHEET_UPDATED",
        `${item.title}: ${data.status || "details changed"}`,
      );
      return tx.runSheetItem.findUniqueOrThrow({ where: { id: itemId } });
    });
  }
  @Delete(":itemId") async remove(
    @Req() req: any,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
  ) {
    await ownEvent(this.db, id, req.user);
    return this.db.runSheetItem.deleteMany({
      where: { id: itemId, eventId: id, status: { not: "LIVE" } },
    });
  }
}
