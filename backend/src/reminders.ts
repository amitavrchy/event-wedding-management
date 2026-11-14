import { recordNotification } from "./notify/notifier";
import { Database } from "./prisma";
export async function createReminders(db: Database, now = new Date()) {
  const tomorrow = new Date(+now + 86400000),
    week = new Date(+now + 7 * 86400000),
    // Day key in Asia/Dhaka so reminders roll over at local midnight (E-B9).
    day = new Date(+now + 6 * 3600000).toISOString().slice(0, 10);
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
      await recordNotification(db, b.event.hostId, { key: `balance:${b.id}:${day}`, title: "A little payment reminder", body: `Your ${b.service.title} booking is coming up. Balance remaining: BDT ${(remaining / 100).toFixed(2)}.`, kind: "REMINDER" });
  }
  const tasks = await db.checklistItem.findMany({
    where: { done: false, dueAt: { gte: now, lte: tomorrow } },
    include: { event: true },
  });
  const installments = await db.installment.findMany({
    where: { status: "PENDING", dueAt: { lte: week } },
  });
  for (const installment of installments) {
    const event = await db.event.findUnique({
      where: { id: installment.eventId },
    });
    if (event)
      await recordNotification(db, event.hostId, { key: `installment:${installment.id}:${day}`, title: "A payment milestone is coming up", body: `${installment.label}: BDT ${(installment.amountMinor / 100).toFixed(2)} due ${installment.dueAt.toISOString().slice(0, 10)}.`, kind: "REMINDER" });
  }
  for (const task of tasks)
    await recordNotification(db, task.event.hostId, { key: `task:${task.id}:${day}`, title: "One lovely detail is nearly due", body: task.title, kind: "REMINDER" });
  const events = await db.event.findMany({
    where: { rsvpDeadline: { gte: now, lte: week } },
    include: {
      _count: { select: { guests: { where: { rsvpStatus: "INVITED" } } } },
    },
  });
  for (const e of events)
    if (e._count.guests)
      await recordNotification(db, e.hostId, { key: `rsvp:${e.id}:${day}`, title: "A little nudge for your guest list", body: `${e._count.guests} invitation replies are still pending for ${e.title}. Share their public invitation links before the deadline.`, kind: "REMINDER" });
}
