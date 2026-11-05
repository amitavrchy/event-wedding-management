import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent } from "./access";
import { parse, z } from "./validation";
export async function executeAutomations(
  db: Database,
  eventId?: string,
  now = new Date(),
) {
  const rules = await db.automationRule.findMany({
    where: { enabled: true, eventId },
  });
  let executed = 0;
  for (const rule of rules) {
    const event = await db.event.findUnique({
      where: { id: rule.eventId },
      include: {
        days: true,
        tasks: true,
        bookings: { where: { status: { in: ["CONFIRMED", "COMPLETED"] } } },
      },
    });
    if (!event) continue;
    const next = event.days
      .filter((d) => d.startsAt >= now)
      .sort((a, b) => +a.startsAt - +b.startsAt)[0];
    const eligible =
      rule.trigger === "EVENT_APPROACHING"
        ? Boolean(next && +next.startsAt - +now <= rule.daysBefore * 86400000)
        : rule.trigger === "BUDGET_EXCEEDED"
          ? event.bookings.reduce((s, b) => s + b.priceMinor, 0) >
            event.budgetMinor
          : event.tasks.some((t) => !t.done && t.dueAt && t.dueAt < now);
    if (!eligible) continue;
    const key = `${rule.id}:${event.id}`;
    const ran = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      if (await tx.automationRun.findUnique({ where: { key } })) return false;
      if (rule.action === "CREATE_TASK")
        await tx.checklistItem.create({
          data: { eventId: event.id, title: rule.message },
        });
      else
        await tx.notification.create({
          data: {
            key: `automation:${key}`,
            recipientId: event.hostId,
            title: rule.title,
            body: rule.message,
          },
        });
      await tx.automationRun.create({
        data: { key, eventId: event.id, ruleId: rule.id, result: rule.action },
      });
      return true;
    });
    if (ran) executed++;
  }
  return { executed };
}
@Controller("events/:id/automations")
@UseGuards(AuthGuard)
export class AutomationsController {
  constructor(private db: Database) {}
  @Get() async list(@Req() req: any, @Param("id") id: string) {
    await ownEvent(this.db, id, req.user, "read");
    return {
      rules: await this.db.automationRule.findMany({
        where: { eventId: id },
        orderBy: { createdAt: "desc" },
      }),
      runs: await this.db.automationRun.findMany({
        where: { eventId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    };
  }
  @Post() async create(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    const data = parse(
      z.object({
        title: z.string().min(3).max(100),
        trigger: z.enum([
          "EVENT_APPROACHING",
          "BUDGET_EXCEEDED",
          "TASK_OVERDUE",
        ]),
        daysBefore: z.number().int().min(0).max(365).default(7),
        action: z.enum(["NOTIFY", "CREATE_TASK"]),
        message: z.string().min(3).max(200),
      }),
      body,
    );
    return this.db.automationRule.create({
      data: { ...data, eventId: id, createdBy: req.user.sub },
    });
  }
  @Patch(":ruleId") async toggle(
    @Req() req: any,
    @Param("id") id: string,
    @Param("ruleId") ruleId: string,
    @Body() body: unknown,
  ) {
    await ownEvent(this.db, id, req.user);
    return this.db.automationRule.updateMany({
      where: { id: ruleId, eventId: id },
      data: parse(z.object({ enabled: z.boolean() }), body),
    });
  }
  @Delete(":ruleId") async remove(
    @Req() req: any,
    @Param("id") id: string,
    @Param("ruleId") ruleId: string,
  ) {
    await ownEvent(this.db, id, req.user);
    return this.db.automationRule.deleteMany({
      where: { id: ruleId, eventId: id },
    });
  }
  @Post("run") async run(@Req() req: any, @Param("id") id: string) {
    await ownEvent(this.db, id, req.user);
    return executeAutomations(this.db, id);
  }
}
