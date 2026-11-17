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
import { Notifier } from "./notify/notifier";
import { link } from "./notify/templates";
import { markResponded } from "./marketplace";
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
  constructor(
    private db: Database,
    private notifier: Notifier,
  ) {}
  /** Full quotation for the branded print/PDF view (host or the quoting vendor). */
  @Get(":id") async detail(@Req() req: any, @Param("id") id: string) {
    const quote = await this.db.quote.findUnique({ where: { id } });
    if (!quote) throw new BadRequestException("Quote not found");
    if (req.user.role === "VENDOR") await ownVendor(this.db, quote.vendorId, req.user, "read");
    else await ownEvent(this.db, quote.eventId, req.user, "read");
    const [vendor, event] = await Promise.all([
      this.db.vendor.findUnique({
        where: { id: quote.vendorId },
        select: { businessName: true, logo: true, image: true, city: true, phone: true, verifiedAt: true, slug: true },
      }),
      this.db.event.findUnique({ where: { id: quote.eventId }, select: { title: true, city: true, days: { orderBy: { startsAt: "asc" } } } }),
    ]);
    return { ...quote, vendor, event };
  }
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
        breakdown: z
          .array(z.object({ label: z.string().trim().min(1).max(120), amountMinor: amount }))
          .min(1)
          .max(30),
        expiresAt: date,
      }),
      body,
    );
    const vendor = await ownVendor(this.db, data.vendorId, req.user);
    // Vendors may only quote events that contacted them.
    const contact =
      (await this.db.conversation.findUnique({
        where: { eventId_vendorId: { eventId: data.eventId, vendorId: data.vendorId } },
      })) || (await this.db.inquiry.findFirst({ where: { eventId: data.eventId, vendorId: data.vendorId } }));
    if (!contact) throw new BadRequestException("You can quote an event after its host contacts you");
    if (new Date(data.expiresAt) <= new Date())
      throw new BadRequestException("Choose a future expiry");
    if (
      data.breakdown.reduce((s, i) => s + i.amountMinor, 0) !== data.amountMinor
    )
      throw new BadRequestException("Breakdown must equal the total");
    const quote = await this.db.quote.create({ data });
    await this.db.inquiry.updateMany({
      where: { eventId: data.eventId, vendorId: data.vendorId, status: { in: ["NEW", "REPLIED"] } },
      data: { status: "QUOTED" },
    });
    await markResponded(this.db, data.vendorId, undefined, data.eventId);
    const event = await this.db.event.findUnique({ where: { id: data.eventId } });
    if (event)
      await this.notifier.notifyTemplate(
        event.hostId,
        "newQuote",
        { vendor: vendor.businessName, amount: (data.amountMinor / 100).toLocaleString("en-IN") },
        { link: link("/packages"), kind: "QUOTE", key: `quote:${quote.id}`, channels: { email: true, sms: true } },
      );
    return quote;
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
    const updated = await this.db.quote.update({ where: { id }, data: { status } });
    const vendor = await this.db.vendor.findUnique({ where: { id: quote.vendorId } });
    if (vendor)
      await this.notifier.notify(vendor.ownerId, {
        title: status === "ACCEPTED" ? "Your quotation was accepted" : "Your quotation was declined",
        body: `BDT ${(quote.amountMinor / 100).toLocaleString("en-IN")}`,
        link: link("/business"),
        kind: "QUOTE",
        key: `quote-response:${id}`,
        channels: { email: status === "ACCEPTED" },
      });
    return updated;
  }
}
