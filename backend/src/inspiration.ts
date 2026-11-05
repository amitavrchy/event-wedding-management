import {
  Body,
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
import { ownEvent } from "./access";
import { parse, z } from "./validation";
@Controller("events/:id/inspiration")
@UseGuards(AuthGuard)
export class InspirationController {
  constructor(private db: Database) {}
  @Get() async list(@Req() req: any, @Param("id") id: string) {
    await ownEvent(this.db, id, req.user, "read");
    return this.db.moodItem.findMany({
      where: { eventId: id },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post() async add(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("IMAGE"),
          title: z.string().min(2).max(100),
          value: z.url().refine((s) => s.startsWith("https://")),
          tag: z.string().min(1).max(50),
        }),
        z.object({
          kind: z.literal("COLOR"),
          title: z.string().min(2).max(100),
          value: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          tag: z.string().min(1).max(50),
        }),
        z.object({
          kind: z.literal("NOTE"),
          title: z.string().min(2).max(100),
          value: z.string().min(2).max(3000),
          tag: z.string().min(1).max(50),
        }),
      ]),
      body,
    );
    return this.db.moodItem.create({ data: { ...data, eventId: id } });
  }
  @Delete(":itemId") async remove(
    @Req() req: any,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
  ) {
    await ownEvent(this.db, id, req.user);
    return this.db.moodItem.deleteMany({ where: { id: itemId, eventId: id } });
  }
}
@Controller("favorites")
@UseGuards(AuthGuard)
export class FavoritesController {
  constructor(private db: Database) {}
  @Get() async list(@Req() req: any) {
    const favorites = await this.db.favorite.findMany({
      where: { userId: req.user.sub },
    });
    return this.db.vendor.findMany({
      where: { id: { in: favorites.map((f) => f.vendorId) }, status: "ACTIVE" },
      include: { services: true },
    });
  }
  @Post(":vendorId") async add(
    @Req() req: any,
    @Param("vendorId") vendorId: string,
  ) {
    await this.db.vendor.findFirstOrThrow({
      where: { id: vendorId, status: "ACTIVE" },
    });
    return this.db.favorite.upsert({
      where: { userId_vendorId: { userId: req.user.sub, vendorId } },
      create: { userId: req.user.sub, vendorId },
      update: {},
    });
  }
  @Delete(":vendorId") remove(
    @Req() req: any,
    @Param("vendorId") vendorId: string,
  ) {
    return this.db.favorite.deleteMany({
      where: { userId: req.user.sub, vendorId },
    });
  }
}
