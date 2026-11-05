import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { BookingsController } from "../src/bookings";
import { PaymentsController } from "../src/payments";
import { Database } from "../src/prisma";
const enabled = Boolean(process.env.TEST_DATABASE_URL);
test(
  "parallel booking has one winner; advance capture is idempotent and ledger is exact",
  { skip: !enabled },
  async () => {
    const db = new PrismaClient({
      datasourceUrl: process.env.TEST_DATABASE_URL,
    });
    const suffix = Date.now().toString();
    let eventId = "",
      vendorId = "",
      serviceId = "";
    try {
      const vendor = await db.vendor.create({
        data: {
          ownerId: suffix,
          slug: `test-${suffix}`,
          businessName: "Test Venue",
          category: "Venue",
          description: "test",
          image: "https://example.com/a.jpg",
          status: "ACTIVE",
        },
      });
      vendorId = vendor.id;
      const service = await db.vendorService.create({
        data: {
          vendorId,
          title: "Hall",
          basePriceMinor: 100000,
          durationHours: 4,
          bufferHours: 1,
        },
      });
      serviceId = service.id;
      const event = await db.event.create({
        data: { hostId: suffix, title: "Test" },
      });
      eventId = event.id;
      const req = { user: { sub: suffix, role: "HOST" } };
      const booking = new BookingsController(db as Database);
      const body = {
        eventId,
        serviceId,
        startAt: new Date(Date.now() + 86400000).toISOString(),
      };
      const results = await Promise.allSettled([
        booking.hold(req, body),
        booking.hold(req, body),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const result = results.find(
        (r) => r.status === "fulfilled",
      ) as PromiseFulfilledResult<any>;
      process.env.PAYMENT_MODE = "sandbox";
      const payments = new PaymentsController(db as Database);
      const payment = await payments.create(req, {
        bookingId: result.value.id,
        provider: "SANDBOX",
        kind: "ADVANCE",
        idempotencyKey: `test-key-${suffix}`,
      });
      await Promise.all([
        payments.sandbox(req, payment.id),
        payments.sandbox(req, payment.id),
      ]);
      assert.equal(
        (await db.booking.findUniqueOrThrow({ where: { id: result.value.id } }))
          .status,
        "CONFIRMED",
      );
      const ledger = await db.ledgerEntry.findMany({
        where: { paymentId: payment.id },
      });
      assert.equal(ledger.length, 1);
      assert.equal(ledger[0].netMinor, 27000);
      assert.equal(ledger[0].commissionMinor, 3000);
    } finally {
      await db.ledgerEntry.deleteMany({ where: { vendorId } });
      await db.payment.deleteMany({ where: { eventId } });
      await db.booking.deleteMany({ where: { eventId } });
      if (eventId) await db.event.delete({ where: { id: eventId } });
      if (serviceId)
        await db.vendorService.delete({ where: { id: serviceId } });
      if (vendorId) await db.vendor.delete({ where: { id: vendorId } });
      await db.$disconnect();
    }
  },
);
