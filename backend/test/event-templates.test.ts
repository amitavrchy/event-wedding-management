import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { Database } from "../src/prisma";
import { EventsController } from "../src/events";
import {
  eventTypes,
  eventTemplates,
  allocateBudget,
  templateFor,
} from "../src/event-templates";

test("occasion budgets conserve every minor unit including small and odd totals", () => {
  assert.equal(
    new Set(eventTemplates.map((t) => t.type)).size,
    eventTypes.length,
  );
  for (const template of eventTemplates) {
    assert.ok(template.checklist.length >= 5);
    for (const total of [0, 1, 7, 10001, 10000003, 2147483647]) {
      const items = allocateBudget(total, template.allocations);
      assert.equal(
        items.reduce((sum, item) => sum + item.plannedMinor, 0),
        total,
      );
      assert.ok(
        items.every(
          (item) =>
            Number.isSafeInteger(item.plannedMinor) && item.plannedMinor >= 0,
        ),
      );
    }
  }
  assert.ok(
    templateFor("BIRTHDAY").allocations.some(
      (a) => a.category === "Cake & desserts",
    ),
  );
  assert.ok(
    templateFor("CORPORATE").allocations.some(
      (a) => a.category === "AV & production",
    ),
  );
  assert.throws(() =>
    allocateBudget(100, [{ category: "Invalid", bps: 9999 }]),
  );
});

test(
  "all occasions create atomic editable plans, optional schedules, and safe type changes",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const db = new PrismaClient({
      datasourceUrl: process.env.TEST_DATABASE_URL,
    });
    const owner = await db.user.create({
      data: {
        email: `occasion-${Date.now()}@example.com`,
        fullName: "Occasion Test",
        role: "HOST",
        passwordHash: "unused",
      },
    });
    const controller = new EventsController(db as Database),
      req = { user: { sub: owner.id, role: "HOST" } };
    try {
      for (const type of eventTypes) {
        const template = templateFor(type),
          startsAt = new Date(Date.now() + 100 * 86400000).toISOString();
        const event = await controller.create(req, {
          title: `Test ${type}`,
          eventType: type,
          budgetMinor: 10000003,
          guestCapacity: 50,
          startsAt,
        });
        assert.equal(event.eventType, type);
        assert.deepEqual(
          event.tasks.map((t) => t.title),
          template.checklist,
        );
        assert.equal(
          event.budget.reduce((s, b) => s + b.plannedMinor, 0),
          10000003,
        );
        assert.equal(
          +event.days[0].endsAt - +event.days[0].startsAt,
          template.durationHours * 3600000,
        );
        await controller.update(req, event.id, { eventType: "GENERAL" });
        assert.equal(
          await db.checklistItem.count({ where: { eventId: event.id } }),
          template.checklist.length,
        );
      }
      const empty = await controller.create(req, {
        title: "Blank workspace",
        budgetMinor: 0,
        guestCapacity: 1,
        starterPlan: false,
      });
      assert.equal(empty.eventType, "GENERAL");
      assert.deepEqual(
        [empty.tasks.length, empty.budget.length, empty.days.length],
        [0, 0, 0],
      );
      const base = {
        title: "Invalid workspace",
        budgetMinor: 10000,
        guestCapacity: 10,
      };
      await assert.rejects(() =>
        controller.create(req, { ...base, eventType: "UNKNOWN" }),
      );
      await assert.rejects(() =>
        controller.create(req, { ...base, startsAt: "2020-01-01T00:00:00Z" }),
      );
    } finally {
      const events = await db.event.findMany({
          where: { hostId: owner.id },
          select: { id: true },
        }),
        ids = events.map((e) => e.id);
      await db.checklistItem.deleteMany({ where: { eventId: { in: ids } } });
      await db.budgetItem.deleteMany({ where: { eventId: { in: ids } } });
      await db.eventDay.deleteMany({ where: { eventId: { in: ids } } });
      await db.event.deleteMany({ where: { hostId: owner.id } });
      await db.user.delete({ where: { id: owner.id } });
      await db.$disconnect();
    }
  },
);
