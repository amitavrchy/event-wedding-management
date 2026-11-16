import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { AuthGuard } from "./auth";
import { Database } from "./prisma";
import { ownEvent } from "./access";
import { date, parse, z } from "./validation";
import { FeatureKey, hasFeature } from "./features";
import { completeUpload, createUpload, publicUrl } from "./storage";
import { limiter } from "./rate-limit";
import { appUrl } from "./config";

async function gate(db: Database, id: string, user: any, feature: FeatureKey, permission: "read" | "write" = "write") {
  const event = await ownEvent(db, id, user, permission);
  if (!hasFeature(event, feature)) throw new ForbiddenException("Turn this tool on in event settings first");
  return event;
}

// ---------------------------------------------------------------------------
// Guest travel & stay
// ---------------------------------------------------------------------------
@Controller("events/:id/logistics")
@UseGuards(AuthGuard)
export class LogisticsController {
  constructor(private db: Database) {}

  @Get() async overview(@Req() req: any, @Param("id") id: string) {
    await gate(this.db, id, req.user, "logistics", "read");
    const [stays, transports, travel, guests] = await Promise.all([
      this.db.accommodation.findMany({ where: { eventId: id }, orderBy: { name: "asc" } }),
      this.db.transport.findMany({ where: { eventId: id }, orderBy: { departAt: "asc" } }),
      this.db.guestTravel.findMany({ where: { eventId: id } }),
      this.db.guest.findMany({ where: { eventId: id }, select: { id: true, name: true, partySize: true, phone: true, side: true } }),
    ]);
    const people = (ids: string[]) =>
      travel.filter((t) => ids.includes(t.guestId)).reduce((n, t) => n + (guests.find((g) => g.id === t.guestId)?.partySize || 1), 0);
    return {
      accommodations: stays.map((a) => {
        const assigned = travel.filter((t) => t.accommodationId === a.id).map((t) => t.guestId);
        return { ...a, assignedPeople: people(assigned), guests: assigned };
      }),
      transports: transports.map((v) => {
        const assigned = travel.filter((t) => t.transportId === v.id).map((t) => t.guestId);
        return { ...v, assignedPeople: people(assigned), guests: assigned };
      }),
      travelers: travel.map((t) => ({ ...t, guest: guests.find((g) => g.id === t.guestId) })),
    };
  }

  @Post("accommodations") async addStay(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    await gate(this.db, id, req.user, "logistics");
    const data = parse(
      z.object({
        name: z.string().trim().min(2).max(120),
        address: z.string().max(300).optional(),
        rooms: z.number().int().min(1).max(500).default(1),
        capacity: z.number().int().min(1).max(5000).default(2),
        checkIn: date.optional(),
        checkOut: date.optional(),
        contact: z.string().max(100).optional(),
        notes: z.string().max(500).optional(),
      }),
      body,
    );
    return this.db.accommodation.create({ data: { ...data, eventId: id } });
  }

  @Post("transports") async addTransport(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    await gate(this.db, id, req.user, "logistics");
    const data = parse(
      z.object({
        label: z.string().trim().min(2).max(80),
        capacity: z.number().int().min(1).max(200).default(4),
        driverName: z.string().max(80).optional(),
        driverPhone: z.string().max(25).optional(),
        departAt: date.optional(),
        route: z.string().max(200).optional(),
      }),
      body,
    );
    return this.db.transport.create({ data: { ...data, eventId: id } });
  }

  @Delete(":kind/:itemId") async remove(@Req() req: any, @Param("id") id: string, @Param("kind") kind: string, @Param("itemId") itemId: string) {
    await gate(this.db, id, req.user, "logistics");
    if (kind === "accommodations") {
      await this.db.guestTravel.updateMany({ where: { eventId: id, accommodationId: itemId }, data: { accommodationId: null } });
      const r = await this.db.accommodation.deleteMany({ where: { id: itemId, eventId: id } });
      if (!r.count) throw new NotFoundException();
    } else if (kind === "transports") {
      await this.db.guestTravel.updateMany({ where: { eventId: id, transportId: itemId }, data: { transportId: null } });
      const r = await this.db.transport.deleteMany({ where: { id: itemId, eventId: id } });
      if (!r.count) throw new NotFoundException();
    } else throw new NotFoundException();
    return { ok: true };
  }

  /** Assign a guest to a stay and/or vehicle, with capacity checks. */
  @Put("guests/:guestId") async assign(@Req() req: any, @Param("id") id: string, @Param("guestId") guestId: string, @Body() body: unknown) {
    await gate(this.db, id, req.user, "logistics");
    const data = parse(
      z.object({
        accommodationId: z.string().nullable().optional(),
        transportId: z.string().nullable().optional(),
        arrivalAt: date.nullable().optional(),
        departureAt: date.nullable().optional(),
        fromCity: z.string().max(80).nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      }),
      body,
    );
    const guest = await this.db.guest.findFirst({ where: { id: guestId, eventId: id } });
    if (!guest) throw new NotFoundException("Guest not found");
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`logistics:${id}`}))`;
      const usage = async (field: "accommodationId" | "transportId", target: string) => {
        const rows = await tx.guestTravel.findMany({ where: { eventId: id, [field]: target, guestId: { not: guestId } } });
        const parties = await tx.guest.findMany({ where: { id: { in: rows.map((r) => r.guestId) } }, select: { partySize: true } });
        return parties.reduce((n, p) => n + p.partySize, 0) + guest.partySize;
      };
      if (data.accommodationId) {
        const stay = await tx.accommodation.findFirst({ where: { id: data.accommodationId, eventId: id } });
        if (!stay) throw new BadRequestException("Choose a stay from this event");
        if ((await usage("accommodationId", stay.id)) > stay.capacity) throw new BadRequestException(`${stay.name} is full`);
      }
      if (data.transportId) {
        const vehicle = await tx.transport.findFirst({ where: { id: data.transportId, eventId: id } });
        if (!vehicle) throw new BadRequestException("Choose a vehicle from this event");
        if ((await usage("transportId", vehicle.id)) > vehicle.capacity) throw new BadRequestException(`${vehicle.label} is full`);
      }
      const values = {
        ...data,
        arrivalAt: data.arrivalAt === undefined ? undefined : data.arrivalAt && new Date(data.arrivalAt),
        departureAt: data.departureAt === undefined ? undefined : data.departureAt && new Date(data.departureAt),
      };
      return tx.guestTravel.upsert({
        where: { eventId_guestId: { eventId: id, guestId } },
        update: values,
        create: { ...values, eventId: id, guestId },
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Invitation cards (dawat card) and WhatsApp sharing
// ---------------------------------------------------------------------------
export const cardTemplates = [
  { key: "MARIGOLD", label: "Marigold (Holud)", colors: ["#F4A300", "#7A2E0E"] },
  { key: "ROYAL", label: "Royal red (Biye)", colors: ["#8E1B22", "#E8C27A"] },
  { key: "PASTEL", label: "Pastel bloom", colors: ["#F6D6DE", "#5B4B6E"] },
  { key: "MINIMAL", label: "Minimal ivory", colors: ["#FBF7F0", "#3D2F24"] },
  { key: "CORPORATE", label: "Corporate", colors: ["#0F3D5E", "#FFFFFF"] },
];

@Controller("events/:id/invitations")
@UseGuards(AuthGuard)
export class InvitationsController {
  constructor(private db: Database) {}

  @Get() async get(@Req() req: any, @Param("id") id: string) {
    await gate(this.db, id, req.user, "invitations", "read");
    const cards = await this.db.invitationCard.findMany({ where: { eventId: id }, orderBy: { updatedAt: "desc" } });
    const [guests, households] = await Promise.all([
      this.db.guest.count({ where: { eventId: id } }),
      this.db.household.count({ where: { eventId: id } }),
    ]);
    const [sent, opened, replied] = await Promise.all([
      this.db.guest.count({ where: { eventId: id, invitationSentAt: { not: null } } }),
      this.db.guest.count({ where: { eventId: id, invitationOpenedAt: { not: null } } }),
      this.db.guest.count({ where: { eventId: id, respondedAt: { not: null } } }),
    ]);
    return { templates: cardTemplates, cards, tracking: { guests, households, sent, opened, replied } };
  }

  @Put() async save(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    await gate(this.db, id, req.user, "invitations");
    const data = parse(
      z.object({
        cardId: z.string().optional(),
        dayId: z.string().nullable().optional(),
        template: z.enum(cardTemplates.map((t) => t.key) as [string, ...string[]]),
        language: z.enum(["bn", "en", "both"]),
        headline: z.string().trim().min(2).max(120),
        hostLine: z.string().max(200).nullable().optional(),
        message: z.string().trim().min(5).max(1500),
        version: z.number().int().optional(),
      }),
      body,
    );
    const { cardId, version, ...values } = data;
    if (values.dayId && !(await this.db.eventDay.findFirst({ where: { id: values.dayId, eventId: id } })))
      throw new BadRequestException("Choose a day from this event");
    if (!cardId) return this.db.invitationCard.create({ data: { ...values, eventId: id } });
    const updated = await this.db.invitationCard.updateMany({
      where: { id: cardId, eventId: id, ...(version ? { version } : {}) },
      data: { ...values, version: { increment: 1 } },
    });
    if (!updated.count) throw new BadRequestException("Someone else changed this card. Reload to see the latest version.");
    return this.db.invitationCard.findUnique({ where: { id: cardId } });
  }

  /**
   * Personal share messages for WhatsApp/SMS: one per guest (or family), with
   * the private RSVP link. The client opens wa.me links; nothing is sent here.
   */
  @Get("share") async share(@Req() req: any, @Param("id") id: string, @Query() query: any) {
    const event = await gate(this.db, id, req.user, "invitations");
    const language = query?.language === "en" ? "en" : "bn";
    const card = await this.db.invitationCard.findFirst({ where: { eventId: id }, orderBy: { updatedAt: "desc" } });
    const days = await this.db.eventDay.findMany({ where: { eventId: id }, orderBy: { startsAt: "asc" } });
    const when = days
      .map((d) => `${d.name}: ${d.startsAt.toLocaleDateString(language === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "long" })}`)
      .join(", ");
    const text = (name: string, url: string) =>
      language === "bn"
        ? `আসসালামু আলাইকুম ${name},\n${card?.headline || event.title}\n${when ? `${when}\n` : ""}আপনার উপস্থিতি জানাতে এই লিংকে ক্লিক করুন: ${url}`
        : `Dear ${name},\n${card?.headline || event.title}\n${when ? `${when}\n` : ""}Please let us know if you can come: ${url}`;
    const households = await this.db.household.findMany({ where: { eventId: id } });
    const guests = await this.db.guest.findMany({ where: { eventId: id, householdId: null } });
    const phone = (p?: string | null) => (p ? p.replace(/[^\d]/g, "").replace(/^0/, "880") : null);
    return [
      ...households.map((h) => {
        const url = `${appUrl()}/rsvp/family/${h.token}`;
        return { type: "household", id: h.id, name: h.name, phone: phone(h.phone), url, text: text(h.name, url), sentAt: h.invitationSentAt, openedAt: h.invitationOpenedAt };
      }),
      ...guests.map((g) => {
        const url = `${appUrl()}/rsvp/${g.token}`;
        return { type: "guest", id: g.id, name: g.name, phone: phone(g.phone), url, text: text(g.name, url), sentAt: g.invitationSentAt, openedAt: g.invitationOpenedAt };
      }),
    ];
  }
}

// ---------------------------------------------------------------------------
// QR photo wall
// ---------------------------------------------------------------------------
@Controller("events/:id/photo-wall")
@UseGuards(AuthGuard)
export class PhotoWallController {
  constructor(private db: Database) {}

  @Get() async list(@Req() req: any, @Param("id") id: string, @Query() query: any) {
    const event = await gate(this.db, id, req.user, "photoWall", "read");
    const status = parse(z.enum(["PENDING", "APPROVED", "HIDDEN"]).optional(), query?.status);
    const photos = await this.db.guestPhoto.findMany({
      where: { eventId: id, status },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return {
      token: event.photoWallToken,
      uploadUrl: event.photoWallToken ? `${appUrl()}/photos/${event.photoWallToken}` : null,
      slideshowUrl: event.photoWallToken ? `${appUrl()}/photos/${event.photoWallToken}/live` : null,
      moderation: event.photoWallModeration,
      photos,
    };
  }

  @Post("settings") async settings(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    const event = await gate(this.db, id, req.user, "photoWall");
    const data = parse(z.object({ enabled: z.boolean(), moderation: z.boolean().default(true), rotate: z.boolean().default(false) }), body);
    const token = !data.enabled ? null : data.rotate || !event.photoWallToken ? randomBytes(12).toString("base64url") : event.photoWallToken;
    const updated = await this.db.event.update({ where: { id }, data: { photoWallToken: token, photoWallModeration: data.moderation } });
    return { token: updated.photoWallToken, moderation: updated.photoWallModeration };
  }

  @Patch(":photoId") async moderate(@Req() req: any, @Param("id") id: string, @Param("photoId") photoId: string, @Body() body: unknown) {
    await gate(this.db, id, req.user, "photoWall");
    const { status } = parse(z.object({ status: z.enum(["APPROVED", "HIDDEN"]) }), body);
    const r = await this.db.guestPhoto.updateMany({ where: { id: photoId, eventId: id }, data: { status } });
    if (!r.count) throw new NotFoundException("Photo not found");
    return { ok: true };
  }
}

/** Public, token-based: guests upload without an account; the wall shows approved photos. */
@Controller("photo-wall")
export class PublicPhotoWallController {
  constructor(private db: Database) {}

  private async event(token: string) {
    const event = await this.db.event.findFirst({ where: { photoWallToken: token, archivedAt: null } });
    if (!event || !hasFeature(event, "photoWall")) throw new NotFoundException("This photo wall is not open");
    return event;
  }

  @Get(":token") async wall(@Param("token") token: string, @Query("after") after?: string) {
    const event = await this.event(token);
    const photos = await this.db.guestPhoto.findMany({
      where: { eventId: event.id, status: "APPROVED", ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, url: true, uploaderName: true, caption: true, createdAt: true },
    });
    return { title: event.title, photos };
  }

  @Post(":token/uploads") async upload(@Param("token") token: string, @Body() body: unknown, @Req() req: any) {
    const event = await this.event(token);
    await limiter.check(`photo:${token}:${req.ip}`, { limit: 30, windowSeconds: 3600 }, "You have shared many photos. Please wait a little.");
    await limiter.check(`photo:${token}`, { limit: 2000, windowSeconds: 3600 }, "The photo wall is busy. Try again soon.");
    const data = parse(z.object({ contentType: z.string().max(100), sizeBytes: z.number().int().min(1), fileName: z.string().max(200).optional() }), body);
    return createUpload(this.db, `guest:${event.id}`, { ...data, purpose: "GUEST_PHOTO" });
  }

  @Post(":token/uploads/:mediaId/complete") async complete(@Param("token") token: string, @Param("mediaId") mediaId: string, @Body() body: unknown) {
    const event = await this.event(token);
    const data = parse(
      z.object({ uploaderName: z.string().trim().max(60).optional(), caption: z.string().trim().max(200).optional() }).default({}),
      body ?? {},
    );
    const media = await completeUpload(this.db, `guest:${event.id}`, mediaId);
    const stored = await this.db.media.findUniqueOrThrow({ where: { id: mediaId } });
    const photo = await this.db.guestPhoto.upsert({
      where: { mediaId },
      update: {},
      create: {
        eventId: event.id,
        mediaId,
        url: media.url || publicUrl(stored.key),
        uploaderName: data.uploaderName,
        caption: data.caption,
        status: event.photoWallModeration ? "PENDING" : "APPROVED",
      },
    });
    return { id: photo.id, status: photo.status };
  }
}
