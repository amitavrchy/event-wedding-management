import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { hash, compare } from "bcryptjs";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent } from "./access";
import { parse, z } from "./validation";
const https = z
  .url()
  .refine((s) => s.startsWith("https://"), "Use an HTTPS image URL");
const website = z.object({
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  headline: z.string().min(3).max(150),
  story: z.string().max(8000),
  coverUrl: https,
  theme: z.enum(["ROSE", "SAGE", "MIDNIGHT"]),
  faqs: z
    .array(
      z.object({
        question: z.string().min(2).max(200),
        answer: z.string().min(2).max(1000),
      }),
    )
    .max(20),
  password: z.string().min(6).max(72).optional(),
  clearPassword: z.boolean().optional(),
  published: z.boolean(),
  version: z.number().int().positive().optional(),
});
@Controller("events/:id/website")
@UseGuards(AuthGuard)
export class WebsitesController {
  constructor(private db: Database) {}
  @Get() async get(@Req() req: any, @Param("id") id: string) {
    await ownEvent(this.db, id, req.user, "read");
    const site = await this.db.eventWebsite.findUnique({
      where: { eventId: id },
    });
    if (!site) return null;
    const { passwordHash, ...safe } = site;
    return {
      ...safe,
      passwordProtected: Boolean(passwordHash),
      guestbook: await this.db.guestbookEntry.findMany({
        where: { websiteId: site.id },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    };
  }
  @Put() async save(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(website, body);
    const { password, clearPassword, version, ...values } = data;
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const site = await tx.eventWebsite.findUnique({ where: { eventId: id } });
      const passwordHash = password
        ? await hash(password, 12)
        : clearPassword
          ? null
          : undefined;
      if (site) {
        if (version !== site.version)
          throw new ConflictException(
            "The website was edited elsewhere. Reload before saving.",
          );
        const result = await tx.eventWebsite.update({
          where: { id: site.id },
          data: { ...values, passwordHash, version: { increment: 1 } },
        });
        return { saved: true, version: result.version };
      }
      if (version) throw new ConflictException("Reload the website editor");
      const result = await tx.eventWebsite.create({
        data: { ...values, eventId: id, passwordHash },
      });
      return { saved: true, version: result.version };
    });
  }
  @Patch("guestbook/:entryId") async moderate(
    @Req() req: any,
    @Param("id") id: string,
    @Param("entryId") entryId: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const site = await this.db.eventWebsite.findUniqueOrThrow({
      where: { eventId: id },
    });
    return this.db.guestbookEntry.updateMany({
      where: { id: entryId, websiteId: site.id },
      data: parse(z.object({ approved: z.boolean() }), body),
    });
  }
  @Delete("guestbook/:entryId") async remove(
    @Req() req: any,
    @Param("id") id: string,
    @Param("entryId") entryId: string,
  ) {
    await ownEvent(this.db, id, req.user);
    const site = await this.db.eventWebsite.findUniqueOrThrow({
      where: { eventId: id },
    });
    return this.db.guestbookEntry.deleteMany({
      where: { id: entryId, websiteId: site.id },
    });
  }
}
@Controller("public/sites")
export class PublicWebsitesController {
  constructor(private db: Database) {}
  private async read(slug: string, password?: string) {
    const site = await this.db.eventWebsite.findFirstOrThrow({
      where: { slug, published: true },
    });
    if (
      site.passwordHash &&
      !(await compare(password || "", site.passwordHash))
    )
      return { passwordRequired: true };
    const event = await this.db.event.findUniqueOrThrow({
      where: { id: site.eventId },
      select: { title: true, city: true, days: true },
    });
    const { passwordHash, eventId, ...safe } = site;
    return {
      ...safe,
      event,
      passwordRequired: false,
      guestbook: await this.db.guestbookEntry.findMany({
        where: { websiteId: site.id, approved: true },
        select: { id: true, name: true, message: true },
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
    };
  }
  @Get(":slug") get(@Param("slug") slug: string) {
    return this.read(slug);
  }
  @Post(":slug/access") access(
    @Param("slug") slug: string,
    @Body() body: unknown,
  ) {
    const { password } = parse(
      z.object({ password: z.string().max(72) }),
      body,
    );
    return this.read(slug, password);
  }
  @Post(":slug/guestbook") async message(
    @Param("slug") slug: string,
    @Body() body: unknown,
  ) {
    const data = parse(
      z.object({
        name: z.string().min(2).max(100),
        message: z.string().min(3).max(1000),
        password: z.string().max(72).optional(),
      }),
      body,
    );
    const site = await this.db.eventWebsite.findFirstOrThrow({
      where: { slug, published: true },
    });
    if (
      site.passwordHash &&
      !(await compare(data.password || "", site.passwordHash))
    )
      throw new BadRequestException("Website password required");
    await this.db.guestbookEntry.create({
      data: { websiteId: site.id, name: data.name, message: data.message },
    });
    return { submitted: true, awaitingApproval: true };
  }
}
