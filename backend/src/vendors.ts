import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownVendor } from "./access";
import { amount, date, parse, z } from "./validation";
@Controller("vendors")
export class VendorsController {
  constructor(private db: Database) {}
  @Get("mine") @UseGuards(AuthGuard) mine(@Req() req: any) {
    return this.db.vendor.findMany({
      where: { ownerId: req.user.sub },
      include: { services: true },
    });
  }
  @Get(":id/clients") @UseGuards(AuthGuard) async clients(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    await ownVendor(this.db, id, req.user);
    const conversations = await this.db.conversation.findMany({
      where: { vendorId: id },
      select: { eventId: true },
    });
    return this.db.event.findMany({
      where: { id: { in: conversations.map((c) => c.eventId) } },
      select: { id: true, title: true },
    });
  }
  @Get() async list(@Query() query: any) {
    const q = parse(
      z.object({
        category: z.string().max(50).optional(),
        city: z.string().max(80).optional(),
        q: z.string().max(100).optional(),
        startAt: date.optional(),
      }),
      query,
    );
    const vendors = await this.db.vendor.findMany({
      where: {
        status: "ACTIVE",
        category: q.category,
        city: q.city,
        businessName: q.q ? { contains: q.q, mode: "insensitive" } : undefined,
      },
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
    });
    const start = q.startAt ? new Date(q.startAt) : null;
    return vendors
      .map((v) => ({
        ...v,
        services: v.services
          .filter((s) => {
            if (!start) return true;
            const end = new Date(
              +start + (s.durationHours + s.bufferHours) * 3600000,
            );
            return (
              !s.blocks.some((b) => b.startAt < end && b.endAt > start) &&
              !s.bookings.some(
                (b) => b.startAt < end && b.reservedUntil > start,
              )
            );
          })
          .map(({ blocks, bookings, ...service }) => service),
      }))
      .filter((v) => !start || v.services.length);
  }
  @Get(":id") async get(@Param("id") id: string) {
    return this.db.vendor.findFirst({
      where: { id, status: "ACTIVE" },
      include: { services: true },
    });
  }
  @Get(":id/reviews") reviews(@Param("id") id: string) {
    return this.db.review.findMany({
      where: { vendorId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
  @Get(":id/calendar") async calendar(@Param("id") id: string) {
    return this.db.vendorService.findMany({
      where: { vendorId: id },
      select: {
        id: true,
        title: true,
        blocks: { select: { startAt: true, endAt: true } },
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
          select: { startAt: true, reservedUntil: true, status: true },
        },
      },
    });
  }
  @Post() @UseGuards(AuthGuard) async onboard(
    @Req() req: any,
    @Body() body: unknown,
  ) {
    if (req.user.role !== "VENDOR")
      throw new ForbiddenException("Vendor account required");
    const data = parse(
      z.object({
        businessName: z.string().min(2).max(100),
        slug: z.string().regex(/^[a-z0-9-]+$/),
        category: z.enum([
          "Venue",
          "Photography",
          "Catering",
          "Decoration",
          "Makeup",
        ]),
        city: z.string().min(2),
        description: z.string().min(20).max(3000),
        image: z
          .url()
          .default(
            "https://images.unsplash.com/photo-1519741497674-611481863552?w=900",
          ),
      }),
      body,
    );
    return this.db.vendor.create({ data: { ...data, ownerId: req.user.sub } });
  }
  @Post(":id/services") @UseGuards(AuthGuard) async service(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownVendor(this.db, id, req.user);
    const data = parse(
      z.object({
        title: z.string().min(2).max(100),
        basePriceMinor: amount.refine(
          (n) => n > 0,
          "Service price must be positive",
        ),
        durationHours: z.number().int().min(1).max(72),
        bufferHours: z.number().int().min(0).max(24).default(1),
        capacity: z.number().int().positive().optional(),
      }),
      body,
    );
    return this.db.vendorService.create({ data: { ...data, vendorId: id } });
  }
  @Post(":id/blocks") @UseGuards(AuthGuard) async block(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownVendor(this.db, id, req.user);
    const data = parse(
      z
        .object({
          serviceId: z.string(),
          startAt: date,
          endAt: date,
          reason: z.string().max(200).optional(),
        })
        .refine((d) => new Date(d.startAt) < new Date(d.endAt)),
      body,
    );
    const service = await this.db.vendorService.findFirst({
      where: { id: data.serviceId, vendorId: id },
    });
    if (!service) throw new ForbiddenException();
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.serviceId}))`;
      const conflict = await tx.booking.findFirst({
        where: {
          serviceId: data.serviceId,
          startAt: { lt: new Date(data.endAt) },
          reservedUntil: { gt: new Date(data.startAt) },
          OR: [
            { status: "CONFIRMED" },
            {
              status: { in: ["HELD", "AWAITING_ADVANCE"] },
              holdExpiresAt: { gt: new Date() },
            },
          ],
        },
      });
      if (conflict)
        throw new ConflictException(
          "A reservation already occupies this calendar block",
        );
      return tx.availabilityBlock.create({ data });
    });
  }
}
