import { notifierFor } from "./helpers";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { BookingsController } from "../src/bookings";
import { PaymentsController } from "../src/payments";
import { Database } from "../src/prisma";
import { ownEvent } from "../src/access";
import { BudgetController } from "../src/budget";
import { GuestsController, RsvpController } from "../src/guests";
import { CartController } from "../src/cart";
import { QuotesController } from "../src/packages";
import { DisputesController } from "../src/disputes";
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
    let extraServiceId = "";
    try {
      await db.user.create({ data: { id: suffix, email: `quote-${suffix}@example.com`, fullName: "Test User", passwordHash: "test" } });
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
      const booking = new BookingsController(db as Database, notifierFor(db as Database));
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
      const duplicate = await payments.create(req, {
        bookingId: result.value.id,
        provider: "SANDBOX",
        kind: "ADVANCE",
        idempotencyKey: `duplicate-key-${suffix}`,
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
      await assert.rejects(
        () => payments.sandbox(req, duplicate.id),
        /advance was already captured/,
      );
      await assert.rejects(
        () => booking.status(req, result.value.id, { status: "CANCELLED" }),
        /refund review/,
      );
      await assert.rejects(() =>
        ownEvent(db as Database, eventId, {
          sub: "someone-else",
          role: "HOST",
          fullName: "Other",
        }),
      );
      const balance = await payments.create(req, {
        bookingId: result.value.id,
        provider: "SANDBOX",
        kind: "BALANCE",
        idempotencyKey: `balance-key-${suffix}`,
      });
      assert.equal(balance.amountMinor, 70000);
      await payments.sandbox(req, balance.id);
      const budget = await new BudgetController(db as Database).get(
        req,
        eventId,
      );
      assert.equal(budget.committedMinor, 100000);
      assert.equal(budget.actualMinor, 100000);
      const nextBody = {
        ...body,
        startAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      };
      const expired = await booking.hold(req, nextBody);
      await db.booking.update({
        where: { id: expired.id },
        data: { holdExpiresAt: new Date(Date.now() - 1000) },
      });
      const replacement = await booking.hold(req, nextBody);
      assert.notEqual(expired.id, replacement.id);
      assert.equal(
        (await db.booking.findUniqueOrThrow({ where: { id: expired.id } }))
          .status,
        "EXPIRED",
      );
      const extra = await db.vendorService.create({
        data: { vendorId, title: "Second hall", basePriceMinor: 200000 },
      });
      extraServiceId = extra.id;
      await assert.rejects(() =>
        new CartController(db as Database).checkout(req, {
          eventId,
          items: [
            { serviceId: extra.id, startAt: body.startAt },
            { serviceId, startAt: body.startAt },
          ],
        }),
      );
      assert.equal(
        await db.booking.count({ where: { serviceId: extra.id } }),
        0,
        "failed collection must not leave a partial reservation",
      );
      const cart = await new CartController(db as Database).checkout(req, {
        eventId,
        items: [
          {
            serviceId: extra.id,
            startAt: new Date(Date.now() + 5 * 86400000).toISOString(),
          },
          {
            serviceId,
            startAt: new Date(Date.now() + 5 * 86400000).toISOString(),
          },
        ],
      });
      assert.equal(cart.bookings.length, 2);
      assert.equal(cart.advanceMinor, 90000);
      const directStart = new Date(Date.now() + 10 * 86400000);
      const direct = {
        eventId,
        serviceId: extra.id,
        vendorId,
        category: "Venue",
        startAt: directStart,
        endAt: new Date(+directStart + 4 * 3600000),
        reservedUntil: new Date(+directStart + 5 * 3600000),
        holdExpiresAt: new Date(Date.now() + 60000),
        priceMinor: 200000,
        advanceMinor: 60000,
      };
      const directResults = await Promise.allSettled([
        db.booking.create({ data: direct }),
        db.booking.create({ data: direct }),
      ]);
      assert.equal(
        directResults.filter((r) => r.status === "fulfilled").length,
        1,
        "PostgreSQL must reject overlapping direct writes without application locks",
      );
      const guest = await new GuestsController(db as Database).add(
        req,
        eventId,
        { name: "Invited Guest", maxPartySize: 2 },
      );
      const rsvp = new RsvpController(db as Database);
      await assert.rejects(
        () =>
          rsvp.respond(guest.token, { rsvpStatus: "ACCEPTED", partySize: 3 }),
        /allowance/,
      );
      await rsvp.respond(guest.token, { rsvpStatus: "DECLINED", partySize: 1 });
      await db.event.update({
        where: { id: eventId },
        data: { guestCapacity: 1 },
      });
      assert.equal(
        (
          await rsvp.respond(guest.token, {
            rsvpStatus: "ACCEPTED",
            partySize: 2,
          })
        ).capacityWarning,
        true,
      );
      const quotes = new QuotesController(db as Database, notifierFor(db as Database));
      await assert.rejects(
        () =>
          quotes.create(
            { user: { sub: suffix, role: "VENDOR" } },
            {
              eventId,
              vendorId,
              amountMinor: 50000,
              breakdown: [{ label: "Unsolicited", amountMinor: 50000 }],
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
            },
          ),
        /after its host contacts you/,
      );
      await db.conversation.create({ data: { eventId, vendorId } });
      const quote = await quotes.create(
        { user: { sub: suffix, role: "VENDOR" } },
        {
          eventId,
          vendorId,
          amountMinor: 50000,
          breakdown: [{ label: "Custom hall quote", amountMinor: 50000 }],
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      );
      const accept = { status: "ACCEPTED", serviceId: extraServiceId, startAt: new Date(Date.now() + 20 * 86400000).toISOString() };
      const [first, second] = await Promise.all([quotes.respond(req, quote.id, accept), quotes.respond(req, quote.id, accept)]);
      const quoted = first.booking!;
      assert.equal(second.booking?.id, quoted.id);
      assert.equal((await quotes.respond(req, quote.id, accept)).booking?.id, quoted.id);
      assert.equal(await db.booking.count({ where: { quoteId: quote.id } }), 1);
      assert.equal(quoted.priceMinor, 50000, "accepted quote price overrides the catalog price");
      assert.equal(quoted.status, "CONFIRMED");
      assert.deepEqual((await db.installment.findMany({ where: { bookingId: quoted.id }, orderBy: { dueAt: "asc" } })).map(i => [i.label, i.amountMinor, i.status]), [["Advance", 15000, "PENDING"], ["Balance", 35000, "PENDING"]]);
      assert.equal((await booking.list(req)).some(b => b.id === quoted.id), true);
      assert.equal((await booking.list({ user: { sub: suffix, role: "VENDOR" } })).some(b => b.id === quoted.id), true);
      assert.equal(await db.notification.count({ where: { key: { in: [`quote-response:${quote.id}`, `quote-booking-host:${quote.id}`] } } }), 2);
      await assert.rejects(() => booking.hold(req, { eventId, serviceId: extraServiceId, startAt: new Date(Date.now() + 21 * 86400000).toISOString(), quoteId: quote.id }), /already been booked/);
      const conflictQuote = await quotes.create({ user: { sub: suffix, role: "VENDOR" } }, { eventId, vendorId, amountMinor: 60000, breakdown: [{ label: "Other quote", amountMinor: 60000 }], expiresAt: new Date(Date.now() + 86400000).toISOString() });
      await assert.rejects(() => quotes.respond(req, conflictQuote.id, accept), (error: any) => error.getStatus() === 409 && /reserved/.test(error.message));
      assert.equal((await db.quote.findUniqueOrThrow({ where: { id: conflictQuote.id } })).status, "SENT");
      assert.equal(await db.booking.count({ where: { quoteId: conflictQuote.id } }), 0);
      const retry = await quotes.respond(req, conflictQuote.id, { ...accept, startAt: new Date(Date.now() + 22 * 86400000).toISOString() });
      assert.ok(retry.booking);
      const vendorReq = { user: { sub: suffix, role: "VENDOR" } };
      const offline = { amountMinor: 18000, method: "CASH", kind: "ADVANCE", idempotencyKey: `offline-${suffix}-advance` };
      const recorded = await booking.recordPayment(vendorReq, retry.booking!.id, offline);
      assert.equal((await booking.recordPayment(vendorReq, retry.booking!.id, offline)).id, recorded.id);
      assert.deepEqual((await db.installment.findMany({ where: { bookingId: retry.booking!.id }, orderBy: { dueAt: "asc" } })).map(i => i.status), ["PAID", "PENDING"]);
      await booking.recordPayment(vendorReq, retry.booking!.id, { ...offline, amountMinor: 42000, kind: "BALANCE", idempotencyKey: `offline-${suffix}-balance` });
      assert.deepEqual((await db.installment.findMany({ where: { bookingId: retry.booking!.id }, orderBy: { dueAt: "asc" } })).map(i => i.status), ["PAID", "PAID"]);
      const quotedAdvance = await payments.create(req, {
        bookingId: quoted.id,
        provider: "SANDBOX",
        kind: "ADVANCE",
        idempotencyKey: `quoted-pay-${suffix}`,
      });
      await payments.sandbox(req, quotedAdvance.id);
      const disputes = new DisputesController(db as Database);
      const dispute = await disputes.request(req, {
        bookingId: quoted.id,
        reason: "Our celebration dates have changed.",
      });
      await disputes.resolve({ user: { role: "PLATFORM_ADMIN" } }, dispute.id, {
        action: "REFUND",
      });
      assert.equal(
        (await db.booking.findUniqueOrThrow({ where: { id: quoted.id } }))
          .status,
        "CANCELLED",
      );
      assert.equal(
        (
          await db.payment.findUniqueOrThrow({
            where: { id: quotedAdvance.id },
          })
        ).status,
        "REFUNDED",
      );
      assert.equal(
        (
          await db.ledgerEntry.findUniqueOrThrow({
            where: { paymentId: quotedAdvance.id },
          })
        ).status,
        "REFUNDED",
      );
    } finally {
      await db.ledgerEntry.deleteMany({ where: { vendorId } });
      await db.payment.deleteMany({ where: { eventId } });
      await db.installment.deleteMany({ where: { eventId } });
      await db.booking.deleteMany({ where: { eventId } });
      await db.guest.deleteMany({ where: { eventId } });
      await db.quote.deleteMany({ where: { eventId } });
      await db.dispute.deleteMany({ where: { eventId } });
      await db.message.deleteMany({ where: { conversation: { eventId } } });
      await db.conversation.deleteMany({ where: { eventId } });
      await db.installment.deleteMany({ where: { eventId } });
      if (eventId) await db.event.delete({ where: { id: eventId } });
      if (serviceId)
        await db.vendorService.delete({ where: { id: serviceId } });
      if (extraServiceId)
        await db.vendorService.delete({ where: { id: extraServiceId } });
      if (vendorId) await db.vendor.delete({ where: { id: vendorId } });
      await db.notification.deleteMany({ where: { recipientId: suffix } });
      await db.user.deleteMany({ where: { id: suffix } });
      await db.$disconnect();
    }
  },
);
