import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent, ownVendor } from "./access";
import { amount, date, parse, z } from "./validation";
import { packagePrice } from "./domain";
@Controller("packages")
export class PackagesController {
  constructor(private db: Database) {}
  @Get() async list() {
    const packages = await this.db.package.findMany();
    return Promise.all(
      packages.map(async (p) => {
        const services = await this.db.vendorService.findMany({
          where: { id: { in: p.serviceIds }, vendor: { status: "ACTIVE" } },
          include: { vendor: true },
        });
        return {
          ...p,
          services,
          priceMinor: packagePrice(
            services.map((s) => s.basePriceMinor),
            p.discountBps,
          ),
        };
      }),
    );
  }
  @Post() @UseGuards(AuthGuard) async create(
    @Req() req: any,
    @Body() body: unknown,
  ) {
    const data = parse(
      z.object({
        vendorId: z.string(),
        title: z.string().min(2).max(100),
        description: z.string().max(2000),
        serviceIds: z.array(z.string()).min(1).max(10),
        discountBps: z.number().int().min(0).max(5000),
      }),
      body,
    );
    await ownVendor(this.db, data.vendorId, req.user);
    const count = await this.db.vendorService.count({
      where: { id: { in: data.serviceIds }, vendorId: data.vendorId },
    });
    if (count !== data.serviceIds.length)
      throw new BadRequestException("Services must belong to your business");
    return this.db.package.create({ data });
  }
}
@Controller("quotes")
@UseGuards(AuthGuard)
export class QuotesController {
  constructor(private db: Database) {}
  @Get("event/:id") async list(@Req() req: any, @Param("id") id: string) {
    await ownEvent(this.db, id, req.user, "read");
    return this.db.quote.findMany({ where: { eventId: id } });
  }
  @Post() async create(@Req() req: any, @Body() body: unknown) {
    const data = parse(
      z.object({
        eventId: z.string(),
        vendorId: z.string(),
        amountMinor: amount,
        breakdown: z.array(
          z.object({ label: z.string(), amountMinor: amount }),
        ),
        expiresAt: date,
      }),
      body,
    );
    await ownVendor(this.db, data.vendorId, req.user);
    if (new Date(data.expiresAt) <= new Date())
      throw new BadRequestException("Choose a future expiry");
    if (
      data.breakdown.reduce((s, i) => s + i.amountMinor, 0) !== data.amountMinor
    )
      throw new BadRequestException("Breakdown must equal the total");
    return this.db.quote.create({ data });
  }
  @Post(":id/respond") async respond(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const { status } = parse(
      z.object({ status: z.enum(["ACCEPTED", "REJECTED"]) }),
      body,
    );
    const quote = await this.db.quote.findUniqueOrThrow({ where: { id } });
    await ownEvent(this.db, quote.eventId, req.user);
    if (quote.status !== "SENT" || quote.expiresAt < new Date())
      throw new BadRequestException("Quote is closed or expired");
    return this.db.quote.update({ where: { id }, data: { status } });
  }
}
