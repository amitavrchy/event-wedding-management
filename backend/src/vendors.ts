import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Patch,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownVendor, vendorAccess } from "./access";
import { amount, date, parse, z } from "./validation";
import { Prisma } from "@prisma/client";
import { pagination } from "./common";
import { entitlements } from "./plans";
import { readyPublicUrl } from "./storage";

type VendorRow = Prisma.VendorGetPayload<{ include: { services: true } }>;
/** Public fields only: no owner id, commission, plan or contact phone (shared after an inquiry). */
export function publicVendor(v: VendorRow, sponsored = false) {
  return {
    id: v.id,
    slug: v.slug,
    businessName: v.businessName,
    category: v.category,
    city: v.city,
    description: v.description,
    image: v.image,
    logo: v.logo,
    gallery: v.gallery,
    serviceAreas: v.serviceAreas,
    attributes: v.attributes,
    priceFromMinor: v.priceFromMinor,
    verified: Boolean(v.verifiedAt),
    sponsored,
    ratingAvg: v.ratingAvg,
    ratingCount: v.ratingCount,
    responseMinutes: v.responseMinutes,
    services: v.services
      .filter((s) => s.active)
      .map((s) => ({
        id: s.id,
        vendorId: s.vendorId,
        title: s.title,
        description: s.description,
        basePriceMinor: s.basePriceMinor,
        durationHours: s.durationHours,
        bufferHours: s.bufferHours,
        capacity: s.capacity,
      })),
  };
}
async function refreshPriceFrom(db: Database, vendorId: string) {
  const cheapest = await db.vendorService.aggregate({
    where: { vendorId, active: true },
    _min: { basePriceMinor: true },
  });
  await db.vendor.update({ where: { id: vendorId }, data: { priceFromMinor: cheapest._min.basePriceMinor } });
}
@Controller("vendors")
export class VendorsController {
  constructor(private db: Database) {}
  @Get("mine") @UseGuards(AuthGuard) mine(@Req() req: any) {
    return this.db.vendor.findMany({
      where: vendorAccess(req.user.sub),
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
  /**
   * Public marketplace search. Ranking: relevance filters first, then at most
   * three clearly labelled sponsored listings, then verified, rated and
   * complete profiles. Paid plans add a small boost but never hide matches.
   */
  @Get() async list(@Query() query: any) {
    const q = parse(
      z.object({
        category: z.string().max(50).optional(),
        city: z.string().max(80).optional(),
        area: z.string().max(80).optional(),
        q: z.string().max(100).optional(),
        startAt: date.optional(),
        guests: z.coerce.number().int().min(1).max(100000).optional(),
        budgetMinor: z.coerce.number().int().min(0).optional(),
        verified: z.enum(["true", "false"]).optional(),
      }),
      query,
    );
    const page = pagination(query, { limit: 24, max: 60 });
    const start = q.startAt ? new Date(q.startAt) : null;
    let availableServices: Map<string, Set<string>> | null = null;
    if (start) {
      // ISO text with "Z" so the comparison is UTC regardless of the database time zone.
      const startIso = start.toISOString();
      const rows = await this.db.$queryRaw<{ id: string; vendorId: string }[]>`
        SELECT s."id", s."vendorId" FROM "VendorService" s
        WHERE s."active" = true
          AND NOT EXISTS (
            SELECT 1 FROM "AvailabilityBlock" b WHERE b."serviceId" = s."id"
              AND (b."startAt" AT TIME ZONE 'UTC') < ${startIso}::timestamptz + make_interval(hours => s."durationHours" + s."bufferHours")
              AND (b."endAt" AT TIME ZONE 'UTC') > ${startIso}::timestamptz)
          AND NOT EXISTS (
            SELECT 1 FROM "Booking" k WHERE k."serviceId" = s."id"
              AND (k."startAt" AT TIME ZONE 'UTC') < ${startIso}::timestamptz + make_interval(hours => s."durationHours" + s."bufferHours")
              AND (k."reservedUntil" AT TIME ZONE 'UTC') > ${startIso}::timestamptz
              AND (k."status" = 'CONFIRMED' OR (k."status" IN ('HELD', 'AWAITING_ADVANCE') AND (k."holdExpiresAt" AT TIME ZONE 'UTC') > now())))`;
      availableServices = new Map();
      for (const row of rows) {
        if (!availableServices.has(row.vendorId)) availableServices.set(row.vendorId, new Set());
        availableServices.get(row.vendorId)!.add(row.id);
      }
    }
    const and: Prisma.VendorWhereInput[] = [];
    if (q.area) and.push({ OR: [{ serviceAreas: { has: q.area } }, { city: q.area }] });
    if (q.q)
      and.push({
        OR: [
          { businessName: { contains: q.q, mode: "insensitive" } },
          { description: { contains: q.q, mode: "insensitive" } },
        ],
      });
    if (q.budgetMinor !== undefined) and.push({ OR: [{ priceFromMinor: { lte: q.budgetMinor } }, { priceFromMinor: null }] });
    if (q.guests) and.push({ services: { some: { active: true, OR: [{ capacity: null }, { capacity: { gte: q.guests } }] } } });
    if (availableServices) and.push({ id: { in: [...availableServices.keys()] } });
    if (q.verified === "true") and.push({ verifiedAt: { not: null } });
    const where: Prisma.VendorWhereInput = { status: "ACTIVE", category: q.category, city: q.city, AND: and };
    const order: Prisma.VendorOrderByWithRelationInput[] = [
      { verifiedAt: { sort: "desc", nulls: "last" } },
      { ratingAvg: "desc" },
      { ratingCount: "desc" },
      { updatedAt: "desc" },
    ];
    const now = new Date();
    // Sponsored slots only on the first page, capped and labelled.
    const sponsored =
      page.page === 1
        ? await this.db.vendor.findMany({
            where: { ...where, featuredUntil: { gt: now } },
            include: { services: { where: { active: true } } },
            orderBy: order,
            take: 3,
          })
        : [];
    const sponsoredIds = sponsored.map((v) => v.id);
    const organicWhere = sponsoredIds.length ? { AND: [where, { id: { notIn: sponsoredIds } }] } : where;
    const [total, organic] = await Promise.all([
      this.db.vendor.count({ where }),
      this.db.vendor.findMany({
        where: organicWhere,
        include: { services: { where: { active: true } } },
        orderBy: order,
        skip: page.page === 1 ? 0 : Math.max(0, page.skip - sponsoredIds.length),
        take: page.take - (page.page === 1 ? sponsoredIds.length : 0),
      }),
    ]);
    const shape = (v: (typeof organic)[number], isSponsored: boolean) => {
      const allowed = availableServices?.get(v.id);
      const vendor = publicVendor(v, isSponsored);
      return {
        ...vendor,
        services: vendor.services.filter((s) => !allowed || allowed.has(s.id)).filter((s) => !q.guests || !s.capacity || s.capacity >= q.guests),
      };
    };
    return page.wrap([...sponsored.map((v) => shape(v, true)), ...organic.map((v) => shape(v, false))], total);
  }
  @Get(":id") async get(@Param("id") id: string) {
    const vendor = await this.db.vendor.findFirst({
      where: { OR: [{ id }, { slug: id }], status: "ACTIVE" },
      include: { services: { where: { active: true } } },
    });
    if (!vendor) throw new NotFoundException("Vendor not found");
    return publicVendor(vendor, Boolean(vendor.featuredUntil && vendor.featuredUntil > new Date()));
  }
  /** Owner edits the public profile. Images are media ids from /uploads. */
  @Patch(":id") @UseGuards(AuthGuard) async update(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    const vendor = await ownVendor(this.db, id, req.user);
    const data = parse(
      z.object({
        businessName: z.string().trim().min(2).max(100).optional(),
        category: z.string().min(2).max(50).optional(),
        city: z.string().min(2).max(80).optional(),
        description: z.string().min(20).max(3000).optional(),
        phone: z.string().max(20).nullable().optional(),
        serviceAreas: z.array(z.string().trim().min(2).max(60)).max(30).optional(),
        attributes: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
        imageMediaId: z.string().optional(),
        logoMediaId: z.string().optional(),
        /** Final gallery order: existing URLs and/or new media ids. */
        gallery: z.array(z.string().max(500)).max(100).optional(),
      }),
      body,
    );
    if (data.category && !(await this.db.category.findFirst({ where: { name: data.category, enabled: true } })))
      throw new BadRequestException("Choose an active marketplace category");
    const limits = await entitlements(this.db, vendor);
    const update: Prisma.VendorUpdateInput = {
      businessName: data.businessName,
      category: data.category,
      city: data.city,
      description: data.description,
      phone: data.phone,
      serviceAreas: data.serviceAreas,
      attributes: data.attributes as Prisma.InputJsonValue | undefined,
    };
    if (data.imageMediaId)
      update.image = await readyPublicUrl(this.db, req.user.sub, data.imageMediaId, ["VENDOR_PORTFOLIO", "VENDOR_LOGO"]);
    if (data.logoMediaId)
      update.logo = await readyPublicUrl(this.db, req.user.sub, data.logoMediaId, ["VENDOR_LOGO", "VENDOR_PORTFOLIO"]);
    if (data.gallery) {
      if (data.gallery.length > limits.maxPhotos)
        throw new BadRequestException(`Your plan allows ${limits.maxPhotos} portfolio photos. Upgrade to add more.`);
      const urls: string[] = [];
      for (const item of data.gallery)
        urls.push(
          vendor.gallery.includes(item) || item === vendor.image
            ? item
            : await readyPublicUrl(this.db, req.user.sub, item, ["VENDOR_PORTFOLIO"]),
        );
      update.gallery = urls;
    }
    const saved = await this.db.vendor.update({ where: { id }, data: update, include: { services: true } });
    return saved;
  }
  @Patch(":id/services/:serviceId") @UseGuards(AuthGuard) async updateService(
    @Req() req: any,
    @Param("id") id: string,
    @Param("serviceId") serviceId: string,
    @Body() body: unknown,
  ) {
    await ownVendor(this.db, id, req.user);
    const data = parse(
      z.object({
        title: z.string().min(2).max(100).optional(),
        description: z.string().max(1000).nullable().optional(),
        basePriceMinor: amount.refine((n) => n > 0, "Service price must be positive").optional(),
        durationHours: z.number().int().min(1).max(72).optional(),
        bufferHours: z.number().int().min(0).max(24).optional(),
        capacity: z.number().int().positive().nullable().optional(),
        active: z.boolean().optional(),
      }),
      body,
    );
    const result = await this.db.vendorService.updateMany({ where: { id: serviceId, vendorId: id }, data });
    if (!result.count) throw new NotFoundException("Service not found");
    await refreshPriceFrom(this.db, id);
    return this.db.vendorService.findUnique({ where: { id: serviceId } });
  }
  /** Services with booking history are retired (hidden) instead of deleted. */
  @Delete(":id/services/:serviceId") @UseGuards(AuthGuard) async removeService(
    @Req() req: any,
    @Param("id") id: string,
    @Param("serviceId") serviceId: string,
  ) {
    await ownVendor(this.db, id, req.user);
    const service = await this.db.vendorService.findFirst({ where: { id: serviceId, vendorId: id } });
    if (!service) throw new NotFoundException("Service not found");
    const upcoming = await this.db.booking.count({
      where: { serviceId, status: { in: ["HELD", "AWAITING_ADVANCE", "CONFIRMED"] }, endAt: { gt: new Date() } },
    });
    if (upcoming) throw new BadRequestException("This service has upcoming bookings. Complete or cancel them first.");
    const history = await this.db.booking.count({ where: { serviceId } });
    if (history) await this.db.vendorService.update({ where: { id: serviceId }, data: { active: false } });
    else
      await this.db.$transaction([
        this.db.availabilityBlock.deleteMany({ where: { serviceId } }),
        this.db.vendorService.delete({ where: { id: serviceId } }),
      ]);
    await refreshPriceFrom(this.db, id);
    return { ok: true, retired: Boolean(history) };
  }
  @Get(":id/reviews") reviews(@Param("id") id: string) {
    return this.db.review.findMany({
      where: { vendorId: id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, rating: true, body: true, reply: true, repliedAt: true, createdAt: true },
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
        category: z.string().min(2).max(50),
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
    if (
      !(await this.db.category.findFirst({
        where: { name: data.category, enabled: true },
      }))
    )
      throw new BadRequestException("Choose an active marketplace category");
    return this.db.vendor.create({ data: { ...data, ownerId: req.user.sub } });
  }
  @Post(":id/services") @UseGuards(AuthGuard) async service(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const vendor = await ownVendor(this.db, id, req.user);
    const limits = await entitlements(this.db, vendor);
    if ((await this.db.vendorService.count({ where: { vendorId: id, active: true } })) >= limits.maxServices)
      throw new BadRequestException(`Your plan allows ${limits.maxServices} active services. Upgrade to add more.`);
    const data = parse(
      z.object({
        description: z.string().max(1000).optional(),
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
    const created = await this.db.vendorService.create({ data: { ...data, vendorId: id } });
    await refreshPriceFrom(this.db, id);
    return created;
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
