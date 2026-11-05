import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent } from "./access";
@Controller("events/:id/recommendations")
@UseGuards(AuthGuard)
export class RecommendationsController {
  constructor(private db: Database) {}
  @Get() async get(@Req() req: any, @Param("id") id: string) {
    const event = await ownEvent(this.db, id, req.user, "read");
    const [days, budgets, vendors] = await Promise.all([
      this.db.eventDay.findMany({
        where: { eventId: id, startsAt: { gt: new Date() } },
        orderBy: { startsAt: "asc" },
      }),
      this.db.budgetItem.findMany({ where: { eventId: id } }),
      this.db.vendor.findMany({
        where: { status: "ACTIVE" },
        include: {
          services: {
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
              },
            },
          },
        },
        take: 100,
      }),
    ]);
    return vendors
      .map(({ ownerId, commissionBps, ...vendor }) => {
        let score = 20;
        const reasons: string[] = [];
        if (vendor.city.toLowerCase() === event.city.toLowerCase()) {
          score += 20;
          reasons.push(`Based in ${event.city}`);
        }
        const budget = budgets.find((b) => b.category === vendor.category),
          prices = vendor.services.map((s) => s.basePriceMinor);
        if (budget && prices.some((p) => p <= budget.plannedMinor)) {
          score += 20;
          reasons.push("A service fits your category allocation");
        }
        if (
          vendor.category !== "Venue" ||
          vendor.services.some(
            (s) => s.capacity && s.capacity >= event.guestCapacity,
          )
        ) {
          score += 15;
          if (vendor.category === "Venue")
            reasons.push(`Room for your ${event.guestCapacity} guests`);
        }
        if (
          days[0] &&
          vendor.services.some((s) => {
            const start = days[0].startsAt,
              end = new Date(
                +start + (s.durationHours + s.bufferHours) * 3600000,
              );
            return (
              !s.blocks.some((b) => b.startAt < end && b.endAt > start) &&
              !s.bookings.some(
                (b) => b.startAt < end && b.reservedUntil > start,
              )
            );
          })
        ) {
          score += 25;
          reasons.push("A service is available for your next celebration day");
        }
        return {
          vendor: {
            ...vendor,
            services: vendor.services.map(({ blocks, bookings, ...s }) => s),
          },
          score,
          reasons,
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.vendor.businessName.localeCompare(b.vendor.businessName),
      );
  }
}
