import {
  Body,
  ConflictException,
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
import { ownVendor } from "./access";
import { parse, z } from "./validation";
import { audit } from "./activity";
@Controller("vendors/:id/availability")
@UseGuards(AuthGuard)
export class AvailabilityController {
  constructor(private db: Database) {}
  @Get() async get(@Req() req: any, @Param("id") id: string) {
    await ownVendor(this.db, id, req.user, "read");
    return this.db.vendorService.findMany({
      where: { vendorId: id },
      include: {
        blocks: true,
        bookings: {
          where: {
            OR: [
              { status: "CONFIRMED" },
              {
                status: { in: ["HELD", "AWAITING_ADVANCE"] },
                holdExpiresAt: { gt: new Date() },
              },
            ],
          },
          include: { event: { select: { title: true } } },
        },
      },
    });
  }
  @Post("recurring") async recurring(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownVendor(this.db, id, req.user);
    const data = parse(
      z
        .object({
          serviceId: z.string(),
          from: z.iso.date(),
          until: z.iso.date(),
          weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
          fromTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          untilTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          reason: z.string().min(2).max(200),
        })
        .refine(
          (d) =>
            d.from <= d.until &&
            d.fromTime < d.untilTime &&
            +new Date(d.until) - +new Date(d.from) <= 90 * 86400000,
          "Choose a date range up to 90 days and an end time after the start",
        ),
      body,
    );
    await this.db.vendorService.findFirstOrThrow({
      where: { id: data.serviceId, vendorId: id },
    });
    const windows: {
      serviceId: string;
      startAt: Date;
      endAt: Date;
      reason: string;
    }[] = [];
    for (
      let t = +new Date(data.from);
      t <= +new Date(data.until);
      t += 86400000
    ) {
      const day = new Date(t);
      if (!data.weekdays.includes(day.getUTCDay())) continue;
      const date = day.toISOString().slice(0, 10);
      windows.push({
        serviceId: data.serviceId,
        startAt: new Date(`${date}T${data.fromTime}:00+06:00`),
        endAt: new Date(`${date}T${data.untilTime}:00+06:00`),
        reason: data.reason,
      });
    }
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.serviceId}))`;
        for (const w of windows) {
          if (
            await tx.booking.findFirst({
              where: {
                serviceId: data.serviceId,
                startAt: { lt: w.endAt },
                reservedUntil: { gt: w.startAt },
                OR: [
                  { status: "CONFIRMED" },
                  {
                    status: { in: ["HELD", "AWAITING_ADVANCE"] },
                    holdExpiresAt: { gt: new Date() },
                  },
                ],
              },
            })
          )
            throw new ConflictException(
              "A recurring block overlaps an active booking. No dates were changed.",
            );
        }
        let created = 0;
        for (const w of windows)
          if (
            !(await tx.availabilityBlock.findFirst({
              where: {
                serviceId: w.serviceId,
                startAt: w.startAt,
                endAt: w.endAt,
              },
            }))
          ) {
            await tx.availabilityBlock.create({ data: w });
            created++;
          }
        await audit(
          tx,
          req.user,
          { vendorId: id },
          "RECURRING_BLOCKS_CREATED",
          `${created} date blocks`,
        );
        return { created };
      },
      { timeout: 15000 },
    );
  }
  @Delete("blocks/:blockId") async remove(
    @Req() req: any,
    @Param("id") id: string,
    @Param("blockId") blockId: string,
  ) {
    await ownVendor(this.db, id, req.user);
    const block = await this.db.availabilityBlock.findFirstOrThrow({
      where: { id: blockId, service: { vendorId: id } },
    });
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${block.serviceId}))`;
      return tx.availabilityBlock.delete({ where: { id: blockId } });
    });
  }
}
