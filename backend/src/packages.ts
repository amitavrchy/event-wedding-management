import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent, ownVendor } from "./access";
import { amount, date, parse, z } from "./validation";
import { packagePrice } from "./domain";
import { Notifier } from "./notify/notifier";
import { link } from "./notify/templates";
import { markResponded } from "./marketplace";
import { reserve } from "./reservations";
import { publishBooking } from "./realtime";
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
    const data = parse(
      z.object({ status: z.enum(["ACCEPTED", "REJECTED"]), serviceId: z.string().optional(), startAt: date.optional() }),
      body,
    );
    const quote = await this.db.quote.findUniqueOrThrow({ where: { id } });
    await ownEvent(this.db, quote.eventId, req.user);
    let result: { quote: typeof quote; booking: Awaited<ReturnType<typeof reserve>> | null; created: boolean };
    try {
      result = await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        const current = await tx.quote.findUniqueOrThrow({ where: { id } });
        const existing = await tx.booking.findUnique({ where: { quoteId: id } });
        if (data.status === "ACCEPTED" && current.status === "ACCEPTED" && existing)
          return { quote: current, booking: existing, created: false };
        if (current.status !== "SENT" || current.expiresAt < new Date())
          throw new BadRequestException("Quote is closed or expired");
        if (data.status === "REJECTED")
          return { quote: await tx.quote.update({ where: { id }, data: { status: data.status } }), booking: null, created: true };
        if (!data.serviceId || !data.startAt)
          throw new BadRequestException("Choose a service and date to accept this quote");
        const updated = await tx.quote.update({ where: { id }, data: { status: "ACCEPTED" } });
        const held = await reserve(tx, { eventId: current.eventId, serviceId: data.serviceId, startAt: data.startAt, quoteId: id, policyFlags: [] });
        const booking = await tx.booking.update({ where: { id: held.id }, data: { status: "CONFIRMED" } });
        await tx.installment.createMany({ data: [
          { bookingId: booking.id, eventId: booking.eventId, label: "Advance", amountMinor: booking.advanceMinor, dueAt: new Date() },
          { bookingId: booking.id, eventId: booking.eventId, label: "Balance", amountMinor: booking.priceMinor - booking.advanceMinor, dueAt: booking.startAt },
        ] });
        return { quote: updated, booking, created: true };
      });
    } catch (error) {
      if (String(error).includes("booking_service_period_exclusion") || String(error).includes("23P01"))
        throw new ConflictException("This service is already reserved for that time");
      throw error;
    }
    if (result.created) {
      const [vendor, event] = await Promise.all([
        this.db.vendor.findUnique({ where: { id: quote.vendorId } }),
        this.db.event.findUnique({ where: { id: quote.eventId } }),
      ]);
      if (result.booking) await publishBooking(this.db, quote.eventId, quote.vendorId);
      if (vendor)
        await this.notifier.notify(vendor.ownerId, {
          title: data.status === "ACCEPTED" ? "Your quotation was accepted" : "Your quotation was declined",
          body: `BDT ${(quote.amountMinor / 100).toLocaleString("en-IN")}`,
          link: link(data.status === "ACCEPTED" ? "/bookings" : "/business"), kind: "QUOTE",
          key: `quote-response:${id}`, channels: { email: data.status === "ACCEPTED" },
        });
      if (event && result.booking)
        await this.notifier.notify(event.hostId, {
          title: "Your booking is recorded", body: "Arrange the advance and balance directly with your vendor.",
          link: link("/bookings"), kind: "BOOKING", key: `quote-booking-host:${id}`, channels: { email: true },
        });
    }
    return { ...result.quote, booking: result.booking };
  }
}
