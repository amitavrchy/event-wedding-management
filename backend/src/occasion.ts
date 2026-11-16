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
  Res,
  UseGuards,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthGuard } from "./auth";
import { Database } from "./prisma";
import { ownEvent } from "./access";
import { amount, date, parse, z } from "./validation";
import { csv } from "./common";
import { FeatureKey, hasFeature } from "./features";
import { holidaysBetween } from "./holidays";

const SIDE = z.enum(["BRIDE", "GROOM", "BOTH"]);
type SideConfig = Record<string, { label?: string; quota?: number | null; share?: number }>;

/** Feature gate: the tool must be part of the event's occasion (or switched on). */
async function eventWithFeature(db: Database, id: string, user: any, feature: FeatureKey, permission: "read" | "write" = "write") {
  const event = await ownEvent(db, id, user, permission);
  if (!hasFeature(event, feature)) throw new ForbiddenException("Turn this tool on in event settings first");
  return event;
}

const shares = (sides: SideConfig) => {
  const bride = sides.BRIDE?.share ?? 50;
  const groom = sides.GROOM?.share ?? 100 - bride;
  const total = bride + groom || 100;
  return { BRIDE: bride / total, GROOM: groom / total };
};

@Controller("events/:id")
@UseGuards(AuthGuard)
export class OccasionController {
  constructor(private db: Database) {}

  // ---------------- Bride & groom sides ----------------
  @Put("sides") async saveSides(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    await eventWithFeature(this.db, id, req.user, "sides");
    const entry = z.object({
      label: z.string().trim().min(2).max(40).optional(),
      quota: z.number().int().min(0).max(100000).nullable().optional(),
      share: z.number().min(0).max(100).optional(),
    });
    const data = parse(z.object({ BRIDE: entry.optional(), GROOM: entry.optional() }), body);
    const event = await this.db.event.update({ where: { id }, data: { sides: data as Prisma.InputJsonValue } });
    return event.sides;
  }

  // ---------------- Family cost split ----------------
  /** Who paid what, each family's agreed share, and the amount that settles it. */
  @Get("cost-split") async costSplit(@Req() req: any, @Param("id") id: string) {
    const event = await eventWithFeature(this.db, id, req.user, "costSplit", "read");
    const sides = (event.sides || {}) as SideConfig;
    const ratio = shares(sides);
    const [expenses, payments] = await Promise.all([
      this.db.expense.findMany({ where: { eventId: id }, orderBy: { createdAt: "desc" } }),
      this.db.payment.findMany({ where: { eventId: id, status: "CAPTURED" } }),
    ]);
    const paid = { BRIDE: 0, GROOM: 0, SHARED: 0, UNASSIGNED: 0 };
    for (const e of expenses) {
      const key = (e.paidBy as keyof typeof paid) || "UNASSIGNED";
      paid[key in paid ? key : "UNASSIGNED"] += e.amountMinor;
    }
    // Online and recorded vendor payments are made by the host account; count them as shared.
    paid.SHARED += payments.reduce((n, p) => n + p.amountMinor, 0);
    const total = paid.BRIDE + paid.GROOM + paid.SHARED;
    const fair = { BRIDE: Math.round(total * ratio.BRIDE), GROOM: total - Math.round(total * ratio.BRIDE) };
    // Shared money counts toward each side by its share.
    const contributed = {
      BRIDE: paid.BRIDE + Math.round(paid.SHARED * ratio.BRIDE),
      GROOM: paid.GROOM + (paid.SHARED - Math.round(paid.SHARED * ratio.BRIDE)),
    };
    const balance = contributed.BRIDE - fair.BRIDE; // > 0: groom's side owes bride's side
    return {
      labels: {
        BRIDE: sides.BRIDE?.label || "Bride's side",
        GROOM: sides.GROOM?.label || "Groom's side",
      },
      sharePercent: { BRIDE: Math.round(ratio.BRIDE * 100), GROOM: Math.round(ratio.GROOM * 100) },
      paidMinor: paid,
      totalMinor: total,
      fairShareMinor: fair,
      contributedMinor: contributed,
      settlement:
        balance === 0
          ? null
          : { from: balance > 0 ? "GROOM" : "BRIDE", to: balance > 0 ? "BRIDE" : "GROOM", amountMinor: Math.abs(balance) },
      unassignedMinor: paid.UNASSIGNED,
    };
  }

  // ---------------- Gift register (upohar khata) ----------------
  @Get("gifts") async gifts(@Req() req: any, @Param("id") id: string, @Query() query: any) {
    await eventWithFeature(this.db, id, req.user, "gifts", "read");
    const filter = parse(
      z.object({ side: SIDE.optional(), pending: z.enum(["true", "false"]).optional(), q: z.string().max(80).optional() }),
      { side: query?.side, pending: query?.pending, q: query?.q },
    );
    const items = await this.db.gift.findMany({
      where: {
        eventId: id,
        side: filter.side,
        ...(filter.pending === "true" ? { thankYouSentAt: null } : {}),
        ...(filter.q ? { giverName: { contains: filter.q, mode: "insensitive" } } : {}),
      },
      orderBy: { receivedAt: "desc" },
    });
    const all = await this.db.gift.findMany({ where: { eventId: id }, select: { kind: true, amountMinor: true, side: true, thankYouSentAt: true } });
    const sum = (rows: typeof all) => rows.reduce((n, g) => n + (g.amountMinor || 0), 0);
    return {
      items,
      summary: {
        count: all.length,
        cashMinor: sum(all.filter((g) => g.kind === "CASH")),
        byKind: ["CASH", "GIFT", "GOLD", "OTHER"].map((kind) => ({ kind, count: all.filter((g) => g.kind === kind).length })),
        bySide: ["BRIDE", "GROOM", "BOTH", null].map((side) => ({
          side,
          count: all.filter((g) => g.side === side).length,
          cashMinor: sum(all.filter((g) => g.side === side && g.kind === "CASH")),
        })),
        thankYouPending: all.filter((g) => !g.thankYouSentAt).length,
      },
    };
  }

  @Post("gifts") async addGift(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    await eventWithFeature(this.db, id, req.user, "gifts");
    const data = parse(
      z.object({
        giverName: z.string().trim().min(2).max(120),
        guestId: z.string().optional(),
        householdId: z.string().optional(),
        side: SIDE.nullable().optional(),
        kind: z.enum(["CASH", "GIFT", "GOLD", "OTHER"]).default("CASH"),
        amountMinor: amount.optional(),
        description: z.string().max(300).optional(),
        dayId: z.string().optional(),
        receivedAt: date.optional(),
      }),
      body,
    );
    if (data.kind === "CASH" && !data.amountMinor) throw new BadRequestException("Enter the cash amount");
    if (data.guestId && !(await this.db.guest.findFirst({ where: { id: data.guestId, eventId: id } })))
      throw new BadRequestException("Choose a guest from this event");
    return this.db.gift.create({
      data: { ...data, receivedAt: data.receivedAt ? new Date(data.receivedAt) : undefined, eventId: id, recordedBy: req.user.sub },
    });
  }

  @Patch("gifts/:giftId") async updateGift(@Req() req: any, @Param("id") id: string, @Param("giftId") giftId: string, @Body() body: unknown) {
    await eventWithFeature(this.db, id, req.user, "gifts");
    const data = parse(
      z.object({
        giverName: z.string().trim().min(2).max(120).optional(),
        side: SIDE.nullable().optional(),
        kind: z.enum(["CASH", "GIFT", "GOLD", "OTHER"]).optional(),
        amountMinor: amount.nullable().optional(),
        description: z.string().max(300).nullable().optional(),
        thankYouSent: z.boolean().optional(),
      }),
      body,
    );
    const { thankYouSent, ...values } = data;
    const result = await this.db.gift.updateMany({
      where: { id: giftId, eventId: id },
      data: { ...values, ...(thankYouSent === undefined ? {} : { thankYouSentAt: thankYouSent ? new Date() : null }) },
    });
    if (!result.count) throw new NotFoundException("Gift not found");
    return this.db.gift.findUnique({ where: { id: giftId } });
  }

  @Delete("gifts/:giftId") async removeGift(@Req() req: any, @Param("id") id: string, @Param("giftId") giftId: string) {
    await eventWithFeature(this.db, id, req.user, "gifts");
    const result = await this.db.gift.deleteMany({ where: { id: giftId, eventId: id } });
    if (!result.count) throw new NotFoundException("Gift not found");
    return { ok: true };
  }

  @Get("gifts.csv") async giftsCsv(@Req() req: any, @Param("id") id: string, @Res() res: any) {
    await eventWithFeature(this.db, id, req.user, "gifts", "read");
    const rows = await this.db.gift.findMany({ where: { eventId: id }, orderBy: { receivedAt: "asc" } });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="gift-register.csv"');
    // BOM so Excel opens Bangla names correctly.
    res.send(
      "﻿" +
        csv(
          rows.map((g) => ({ ...g, amount: g.amountMinor != null ? (g.amountMinor / 100).toFixed(2) : "", thankYou: g.thankYouSentAt ? "yes" : "no" })),
          ["receivedAt", "giverName", "side", "kind", "amount", "description", "thankYou"],
        ),
    );
  }

  // ---------------- Catering headcount ----------------
  /** Plates per day and meal from accepted RSVPs, with a safety buffer. */
  @Get("catering") async catering(@Req() req: any, @Param("id") id: string, @Query() query: any) {
    const event = await eventWithFeature(this.db, id, req.user, "catering", "read");
    const buffer = parse(z.coerce.number().int().min(0).max(50).default(10), query?.buffer);
    const [days, guests] = await Promise.all([
      this.db.eventDay.findMany({ where: { eventId: id }, orderBy: { startsAt: "asc" } }),
      this.db.guest.findMany({
        where: { eventId: id },
        select: { id: true, name: true, partySize: true, maxPartySize: true, rsvpStatus: true, mealPreference: true, dietaryNotes: true },
      }),
    ]);
    const dayResponses = await this.db.guestResponse.findMany({ where: { dayId: { in: days.map((d) => d.id) } } });
    const byGuest = new Map(guests.map((g) => [g.id, g]));
    const plan = (attending: typeof guests, pending: typeof guests) => {
      const meals: Record<string, number> = {};
      for (const g of attending) {
        const meal = g.mealPreference || "Regular";
        meals[meal] = (meals[meal] || 0) + g.partySize;
      }
      const confirmed = attending.reduce((n, g) => n + g.partySize, 0);
      const maybe = pending.reduce((n, g) => n + g.maxPartySize, 0);
      return {
        confirmedPeople: confirmed,
        pendingPeople: maybe,
        meals,
        recommendedPlates: Math.ceil(confirmed * (1 + buffer / 100)),
        dietaryNotes: attending.filter((g) => g.dietaryNotes).map((g) => ({ name: g.name, note: g.dietaryNotes })),
      };
    };
    const overall = plan(
      guests.filter((g) => g.rsvpStatus === "ACCEPTED"),
      guests.filter((g) => g.rsvpStatus === "INVITED" || g.rsvpStatus === "MAYBE"),
    );
    return {
      bufferPercent: buffer,
      guestCapacity: event.guestCapacity,
      overall,
      days: days.map((day) => {
        const replies = dayResponses.filter((r) => r.dayId === day.id);
        const accepted = replies.filter((r) => r.status === "ACCEPTED").map((r) => byGuest.get(r.guestId)!).filter(Boolean);
        // Guests who accepted overall but did not answer per day are counted as attending.
        const answered = new Set(replies.map((r) => r.guestId));
        const implicit = guests.filter((g) => g.rsvpStatus === "ACCEPTED" && !answered.has(g.id));
        const pending = replies.filter((r) => r.status === "MAYBE").map((r) => byGuest.get(r.guestId)!).filter(Boolean);
        return { dayId: day.id, name: day.name, startsAt: day.startsAt, venueName: day.venueName, ...plan([...accepted, ...implicit], pending) };
      }),
    };
  }

  // ---------------- Livestream ----------------
  @Put("livestream") async livestream(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    await eventWithFeature(this.db, id, req.user, "livestream");
    const { url } = parse(
      z.object({
        url: z
          .url()
          .refine((u) => /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|facebook\.com|fb\.watch|zoom\.us|meet\.google\.com)\//.test(u), "Use a YouTube, Facebook, Zoom or Google Meet link")
          .nullable(),
      }),
      body,
    );
    const event = await this.db.event.update({ where: { id }, data: { livestreamUrl: url } });
    return { livestreamUrl: event.livestreamUrl };
  }

  // ---------------- Date planner ----------------
  /**
   * Candidate dates with Bangladesh holidays, Ramadan and Eid, and whether
   * the host's shortlisted vendors are free (evening start, Asia/Dhaka).
   */
  @Get("date-planner") async datePlanner(@Req() req: any, @Param("id") id: string, @Query() query: any) {
    await eventWithFeature(this.db, id, req.user, "datePlanner", "read");
    const q = parse(
      z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/).default("18:00"),
      }),
      { from: query?.from, to: query?.to, time: query?.time },
    );
    const from = new Date(`${q.from}T00:00:00+06:00`);
    const to = new Date(`${q.to}T23:59:59+06:00`);
    if (to < from || +to - +from > 120 * 86400000) throw new BadRequestException("Choose a range of up to 120 days");
    const favorites = await this.db.favorite.findMany({ where: { userId: req.user.sub }, select: { vendorId: true } });
    const services = await this.db.vendorService.findMany({
      where: { vendorId: { in: favorites.map((f) => f.vendorId) }, active: true, vendor: { status: "ACTIVE" } },
      include: {
        vendor: { select: { id: true, businessName: true } },
        blocks: { where: { endAt: { gt: from }, startAt: { lt: new Date(+to + 3 * 86400000) } } },
        bookings: {
          where: {
            reservedUntil: { gt: from },
            startAt: { lt: new Date(+to + 3 * 86400000) },
            OR: [{ status: "CONFIRMED" }, { status: { in: ["HELD", "AWAITING_ADVANCE"] }, holdExpiresAt: { gt: new Date() } }],
          },
        },
      },
    });
    const holidays = holidaysBetween(q.from, q.to);
    const days: unknown[] = [];
    for (let t = +from; t <= +to; t += 86400000) {
      const day = new Date(t + 6 * 3600000).toISOString().slice(0, 10);
      const start = new Date(`${day}T${q.time}:00+06:00`);
      const weekday = new Date(`${day}T12:00:00+06:00`).getUTCDay();
      const vendors = new Map<string, { vendorId: string; name: string; free: boolean }>();
      for (const s of services) {
        const end = new Date(+start + (s.durationHours + s.bufferHours) * 3600000);
        const busy =
          s.blocks.some((b) => b.startAt < end && b.endAt > start) || s.bookings.some((b) => b.startAt < end && b.reservedUntil > start);
        const current = vendors.get(s.vendorId);
        // A vendor is free if any of its services is free.
        vendors.set(s.vendorId, { vendorId: s.vendorId, name: s.vendor.businessName, free: (current?.free ?? false) || !busy });
      }
      const notes = holidays.filter((h) => h.date === day);
      days.push({
        date: day,
        weekday,
        isWeekend: weekday === 5 || weekday === 6,
        holidays: notes,
        ramadan: holidays.some((h) => h.kind === "RAMADAN" && h.date <= day && (h.endDate || h.date) >= day),
        vendors: [...vendors.values()],
        freeVendors: [...vendors.values()].filter((v) => v.free).length,
      });
    }
    return {
      days,
      shortlistSize: new Set(services.map((s) => s.vendorId)).size,
      note: "Lunar holiday dates are estimates and depend on moon sighting. Confirm with the official government calendar.",
    };
  }

  // ---------------- Expense edit/delete with who paid ----------------
  @Patch("budget/expenses/:expenseId") async updateExpense(@Req() req: any, @Param("id") id: string, @Param("expenseId") expenseId: string, @Body() body: unknown) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z.object({
        category: z.string().min(1).max(50).optional(),
        amountMinor: amount.optional(),
        note: z.string().min(2).max(300).optional(),
        paidBy: z.enum(["BRIDE", "GROOM", "SHARED"]).nullable().optional(),
        receiptMediaId: z.string().nullable().optional(),
      }),
      body,
    );
    if (data.receiptMediaId) await assertReceipt(this.db, req.user.sub, data.receiptMediaId);
    const result = await this.db.expense.updateMany({ where: { id: expenseId, eventId: id }, data });
    if (!result.count) throw new NotFoundException("Expense not found");
    return this.db.expense.findUnique({ where: { id: expenseId } });
  }
  @Delete("budget/expenses/:expenseId") async removeExpense(@Req() req: any, @Param("id") id: string, @Param("expenseId") expenseId: string) {
    await ownEvent(this.db, id, req.user);
    const result = await this.db.expense.deleteMany({ where: { id: expenseId, eventId: id } });
    if (!result.count) throw new NotFoundException("Expense not found");
    return { ok: true };
  }
}

export async function assertReceipt(db: Database, ownerId: string, mediaId: string) {
  const media = await db.media.findUnique({ where: { id: mediaId } });
  if (!media || media.ownerId !== ownerId || media.status !== "READY" || media.purpose !== "RECEIPT")
    throw new BadRequestException("Upload the receipt first");
}
