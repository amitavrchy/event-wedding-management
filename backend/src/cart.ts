import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent } from "./access";
import { date, parse, z } from "./validation";
import { reserve } from "./reservations";
@Controller("cart")
@UseGuards(AuthGuard)
export class CartController {
  constructor(private db: Database) {}
  @Post("hold") async checkout(@Req() req: any, @Body() body: unknown) {
    const data = parse(
      z.object({
        eventId: z.string(),
        packageId: z.string().optional(),
        items: z
          .array(z.object({ serviceId: z.string(), startAt: date }))
          .min(1)
          .max(10),
      }),
      body,
    );
    await ownEvent(this.db, data.eventId, req.user);
    return this.db.$transaction(
      async (tx) => {
        const ids = [...new Set(data.items.map((i) => i.serviceId))].sort();
        if (ids.length !== data.items.length)
          throw new BadRequestException(
            "Choose each service once per checkout",
          );
        let discount = 0;
        if (data.packageId) {
          const bundle = await tx.package.findUniqueOrThrow({
            where: { id: data.packageId },
          });
          if (
            bundle.serviceIds.length !== ids.length ||
            !bundle.serviceIds.every((id) => ids.includes(id))
          )
            throw new BadRequestException(
              "Include every collection service to receive the discount",
            );
          discount = bundle.discountBps;
        }
        for (const id of ids)
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        const bookings = [];
        for (const item of data.items)
          bookings.push(
            await reserve(
              tx,
              { ...item, eventId: data.eventId, policyFlags: [] },
              discount,
            ),
          );
        return {
          bookings,
          totalMinor: bookings.reduce((s, b) => s + b.priceMinor, 0),
          advanceMinor: bookings.reduce((s, b) => s + b.advanceMinor, 0),
          discountBps: discount,
        };
      },
      { timeout: 15000 },
    );
  }
}
