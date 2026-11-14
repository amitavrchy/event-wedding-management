import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { parse, z } from "./validation";
import { Prisma } from "@prisma/client";
import { audit, csv, pagination } from "./common";
@Controller("admin")
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private db: Database) {}
  private admin(req: any) {
    if (req.user.role !== "PLATFORM_ADMIN") throw new ForbiddenException();
  }
  @Get("vendors") async vendors(@Req() req: any, @Query() query: any) {
    this.admin(req);
    const page = pagination(query, { limit: 25, max: 100 });
    const q = parse(
      z.object({ status: z.enum(["APPLIED", "ACTIVE", "SUSPENDED"]).optional(), q: z.string().max(100).optional() }),
      { status: query?.status, q: query?.q },
    );
    const where: Prisma.VendorWhereInput = {
      status: q.status,
      ...(q.q ? { OR: [{ businessName: { contains: q.q, mode: "insensitive" } }, { slug: { contains: q.q } }] } : {}),
    };
    const [total, items] = await Promise.all([
      this.db.vendor.count({ where }),
      this.db.vendor.findMany({ where, include: { services: true }, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take }),
    ]);
    return page.wrap(items, total);
  }
  @Get("users") async users(@Req() req: any, @Query() query: any) {
    this.admin(req);
    const page = pagination(query, { limit: 25, max: 100 });
    const search = typeof query?.q === "string" ? query.q.slice(0, 100) : "";
    const where: Prisma.UserWhereInput = search
      ? { OR: [{ email: { contains: search, mode: "insensitive" } }, { fullName: { contains: search, mode: "insensitive" } }] }
      : {};
    const [total, items] = await Promise.all([
      this.db.user.count({ where }),
      this.db.user.findMany({
        where,
        select: { id: true, email: true, fullName: true, role: true, phone: true, emailVerifiedAt: true, deletedAt: true, lockedUntil: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip: page.skip,
        take: page.take,
      }),
    ]);
    return page.wrap(items, total);
  }
  @Get("audit-log") async auditLog(@Req() req: any, @Query() query: any) {
    this.admin(req);
    const page = pagination(query, { limit: 50, max: 200 });
    const [total, items] = await Promise.all([
      this.db.auditLog.count(),
      this.db.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take }),
    ]);
    return page.wrap(items, total);
  }
  /** CSV export of administrative actions (last 90 days by default). */
  @Get("audit-log.csv") async auditCsv(@Req() req: any, @Query() query: any, @Res() res: any) {
    this.admin(req);
    const days = Math.min(365, Math.max(1, Number(query?.days) || 90));
    const rows = await this.db.auditLog.findMany({
      where: { createdAt: { gt: new Date(Date.now() - days * 86400000) } },
      orderBy: { createdAt: "desc" },
      take: 50000,
    });
    await audit(this.db, req, "audit.export", "AuditLog", "csv", { days, rows: rows.length });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv(rows, ["createdAt", "actorId", "actorRole", "action", "targetType", "targetId", "ip", "detail"]));
  }
  @Patch("vendors/:id") async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    this.admin(req);
    const data = parse(
      z.object({
        status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
        commissionBps: z.number().int().min(0).max(5000).optional(),
      }),
      body,
    );
    const vendor = await this.db.vendor.update({ where: { id }, data });
    await audit(this.db, req, "vendor.update", "Vendor", id, data);
    return vendor;
  }
  @Get("ledger") ledger(@Req() req: any) {
    this.admin(req);
    return this.db.ledgerEntry.findMany({ orderBy: { createdAt: "desc" } });
  }
  @Patch("ledger/:id/paid") async paid(@Req() req: any, @Param("id") id: string) {
    this.admin(req);
    const entry = await this.db.ledgerEntry.update({
      where: { id, status: "PENDING" },
      data: { status: "PAID" },
    });
    await audit(this.db, req, "ledger.paid", "LedgerEntry", id);
    return entry;
  }
}
