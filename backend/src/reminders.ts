import { Database } from "./prisma";
export async function createReminders(db: Database, now = new Date()) {
  const tomorrow = new Date(+now + 86400000),
    week = new Date(+now + 7 * 86400000),
    day = now.toISOString().slice(0, 10);
  const bookings = await db.booking.findMany({
    where: { status: "CONFIRMED", startAt: { gte: now, lte: week } },
    include: { event: true, service: true },
  });
  for (const b of bookings) {
    const sum = await db.payment.aggregate({
      where: { bookingId: b.id, status: "CAPTURED" },
      _sum: { amountMinor: true },
    });
    const remaining = b.priceMinor - (sum._sum.amountMinor || 0);
    if (remaining > 0)
      await db.notification.upsert({
        where: { key: `balance:${b.id}:${day}` },
        update: {},
        create: {
          key: `balance:${b.id}:${day}`,
          recipientId: b.event.hostId,
          title: "A little payment reminder",
          body: `Your ${b.service.title} booking is coming up. Balance remaining: BDT ${(remaining / 100).toFixed(2)}.`,
        },
      });
  }
  const tasks = await db.checklistItem.findMany({
    where: { done: false, dueAt: { gte: now, lte: tomorrow } },
    include: { event: true },
  });
  for (const task of tasks)
    await db.notification.upsert({
      where: { key: `task:${task.id}:${day}` },
      update: {},
      create: {
        key: `task:${task.id}:${day}`,
        recipientId: task.event.hostId,
        title: "One lovely detail is nearly due",
        body: task.title,
      },
    });
  const events = await db.event.findMany({
    where: { rsvpDeadline: { gte: now, lte: week } },
    include: {
      _count: { select: { guests: { where: { rsvpStatus: "INVITED" } } } },
    },
  });
  for (const e of events)
    if (e._count.guests)
      await db.notification.upsert({
        where: { key: `rsvp:${e.id}:${day}` },
        update: {},
        create: {
          key: `rsvp:${e.id}:${day}`,
          recipientId: e.hostId,
          title: "A little nudge for your guest list",
          body: `${e._count.guests} invitation replies are still pending for ${e.title}. Share their public invitation links before the deadline.`,
        },
      });
}
