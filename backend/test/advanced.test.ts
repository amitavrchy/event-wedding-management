import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { Database } from "../src/prisma";
import { ownEvent, ownVendor } from "../src/access";
import { CollaborationController } from "../src/collaboration";
import { SeatingController } from "../src/seating";
import { RunSheetController } from "../src/run-sheet";
import { CheckInController } from "../src/check-in";
import { AutomationsController, executeAutomations } from "../src/automations";
import { WebsitesController, PublicWebsitesController } from "../src/websites";
import { ContractsController } from "../src/contracts";
import { BookingsController } from "../src/bookings";
import { PaymentsController } from "../src/payments";
import { InvoicesController } from "../src/invoices";
import { AvailabilityController } from "../src/availability";
import { CrmController } from "../src/crm";
import { AnalyticsController } from "../src/analytics";
import { EventsController } from "../src/events";
test(
  "advanced planning and business operations",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const db = new PrismaClient({
        datasourceUrl: process.env.TEST_DATABASE_URL,
      }),
      database = db as Database,
      suffix = `advanced-${Date.now()}`;
    const userIds: string[] = [];
    let eventId = "",
      vendorId = "",
      dayId = "",
      serviceId = "";
    try {
      const identities: any[] = [];
      for (const [name, role] of [
        ["Host", "HOST"],
        ["Professional", "VENDOR"],
        ["Planner", "HOST"],
        ["Observer", "HOST"],
        ["Unrelated", "HOST"],
        ["Assistant", "VENDOR"],
      ]) {
        const user = await db.user.create({
          data: {
            email: `${suffix}-${name}@example.com`.toLowerCase(),
            fullName: `${name} Test`,
            role,
            passwordHash: "not-used-in-controller-tests",
          },
        });
        userIds.push(user.id);
        identities.push({
          user: { sub: user.id, role, fullName: user.fullName },
        });
      }
      const [host, professional, editor, viewer, outsider] = identities;
      const event = await db.event.create({
        data: {
          hostId: host.user.sub,
          title: "Advanced fixture",
          guestCapacity: 2,
        },
      });
      eventId = event.id;
      const vendor = await db.vendor.create({
        data: {
          ownerId: professional.user.sub,
          slug: suffix,
          businessName: "Fixture Venue",
          category: "Venue",
          description: "An isolated integration fixture",
          image: "https://example.com/cover.jpg",
          status: "ACTIVE",
        },
      });
      vendorId = vendor.id;
      const service = await db.vendorService.create({
        data: {
          vendorId,
          title: "Hall A",
          basePriceMinor: 1000000,
          durationHours: 4,
          bufferHours: 1,
        },
      });
      serviceId = service.id;
      const futureDate = new Date(Date.now() + 60 * 86400000)
          .toISOString()
          .slice(0, 10),
        startAt = `${futureDate}T12:00:00+06:00`;
      const day = await db.eventDay.create({
        data: {
          eventId,
          name: "Wedding",
          startsAt: new Date(startAt),
          endsAt: new Date(+new Date(startAt) + 8 * 3600000),
        },
      });
      dayId = day.id;
      const guests = await Promise.all(
        [0, 1].map((i) =>
          db.guest.create({
            data: {
              eventId,
              name: `Party ${i}`,
              partySize: 2,
              maxPartySize: 2,
              rsvpStatus: "ACCEPTED",
              token: `${suffix}-guest-${i}`,
            },
          }),
        ),
      );
      await db.conversation.create({ data: { eventId, vendorId } });
      await t.test(
        "email-bound invitations enforce viewer writes, revocation and expiry",
        async () => {
          const collaboration = new CollaborationController(database);
          const editorInvite = await collaboration.invite(
            host,
            "EVENT",
            eventId,
            {
              email: `${suffix}-planner@example.com`,
              permission: "EDITOR",
              days: 30,
            },
          );
          await assert.rejects(() =>
            collaboration.accept(outsider, editorInvite.token),
          );
          await collaboration.accept(editor, editorInvite.token);
          assert.equal(
            (await ownEvent(database, eventId, editor.user)).access,
            "EDITOR",
          );
          const invite = await collaboration.invite(host, "EVENT", eventId, {
            email: `${suffix}-observer@example.com`,
            permission: "VIEWER",
            days: 30,
          });
          await collaboration.accept(viewer, invite.token);
          assert.equal(
            (await ownEvent(database, eventId, viewer.user, "read")).access,
            "VIEWER",
          );
          await assert.rejects(() => ownEvent(database, eventId, viewer.user));
          const snapshot = await new EventsController(database).get(
            viewer,
            eventId,
          );
          assert.equal(snapshot!.guests[0].token, undefined);
          const member = await db.eventMember.findUniqueOrThrow({
            where: { eventId_userId: { eventId, userId: viewer.user.sub } },
          });
          await db.eventMember.update({
            where: { id: member.id },
            data: { expiresAt: new Date(Date.now() - 1000) },
          });
          await assert.rejects(() =>
            ownEvent(database, eventId, viewer.user, "read"),
          );
          await collaboration.revoke(host, "EVENT", eventId, member.id);
          await assert.rejects(
            () => collaboration.accept(viewer, invite.token),
            /used or expired/,
          );
        },
      );
      await t.test(
        "business team permissions can be promoted, expired, and revoked",
        async () => {
          const teammate = identities[5],
            collaboration = new CollaborationController(database);
          const email = `${suffix}-assistant@example.com`;
          const view = await collaboration.invite(
            professional,
            "VENDOR",
            vendorId,
            { email, permission: "VIEWER", days: 30 },
          );
          await collaboration.accept(teammate, view.token);
          await ownVendor(database, vendorId, teammate.user, "read");
          await assert.rejects(() =>
            ownVendor(database, vendorId, teammate.user),
          );
          const manage = await collaboration.invite(
            professional,
            "VENDOR",
            vendorId,
            { email, permission: "MANAGER", days: 30 },
          );
          await collaboration.accept(teammate, manage.token);
          await ownVendor(database, vendorId, teammate.user);
          const membership = await db.vendorMember.findUniqueOrThrow({
            where: { vendorId_userId: { vendorId, userId: teammate.user.sub } },
          });
          await db.vendorMember.update({
            where: { id: membership.id },
            data: { expiresAt: new Date(Date.now() - 1000) },
          });
          await assert.rejects(() =>
            ownVendor(database, vendorId, teammate.user, "read"),
          );
          await collaboration.revoke(
            professional,
            "VENDOR",
            vendorId,
            membership.id,
          );
          assert.equal(
            await db.vendorMember.count({ where: { id: membership.id } }),
            0,
          );
        },
      );
      await t.test(
        "concurrent table assignments cannot exceed capacity; stale moves fail",
        async () => {
          const seating = new SeatingController(database);
          const table = await seating.create(host, eventId, {
            label: "Family",
            capacity: 2,
            shape: "ROUND",
          });
          const assigned = await Promise.allSettled(
            guests.map((g) =>
              seating.assign(host, eventId, {
                guestId: g.id,
                tableId: table.id,
              }),
            ),
          );
          assert.equal(
            assigned.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.equal(
            (
              await db.guest.aggregate({
                where: { seatingTableId: table.id },
                _sum: { partySize: true },
              })
            )._sum.partySize,
            2,
          );
          await seating.move(editor, eventId, table.id, {
            x: 240,
            y: 180,
            version: 1,
          });
          await assert.rejects(
            () =>
              seating.move(host, eventId, table.id, {
                x: 260,
                y: 180,
                version: 1,
              }),
            /Someone moved/,
          );
        },
      );
      await t.test(
        "one live cue per event day survives concurrent operators",
        async () => {
          const runSheet = new RunSheetController(database);
          const cues = await Promise.all(
            ["Entrance", "Speeches"].map((title) =>
              runSheet.create(host, eventId, {
                dayId,
                title,
                startsAt: startAt,
                durationMinutes: 15,
                owner: "Welcome team",
              }),
            ),
          );
          for (const cue of cues)
            await runSheet.update(host, eventId, cue.id, {
              version: 1,
              status: "READY",
            });
          const results = await Promise.allSettled(
            cues.map((c) =>
              runSheet.update(host, eventId, c.id, {
                version: 2,
                status: "LIVE",
              }),
            ),
          );
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.equal(
            await db.runSheetItem.count({ where: { eventId, status: "LIVE" } }),
            1,
          );
        },
      );
      await t.test(
        "QR check-in is idempotent and respects per-day replies",
        async () => {
          const checkin = new CheckInController(database);
          const results = await Promise.all([
            checkin.arrive(host, eventId, dayId, { token: guests[0].token }),
            checkin.arrive(editor, eventId, dayId, { token: guests[0].token }),
          ]);
          assert.equal(results.filter((r) => r.duplicate).length, 1);
          assert.equal(await db.guestCheckin.count({ where: { eventId } }), 1);
          await db.guestResponse.create({
            data: { guestId: guests[1].id, dayId, status: "DECLINED" },
          });
          await assert.rejects(
            () =>
              checkin.arrive(host, eventId, dayId, { token: guests[1].token }),
            /did not accept/,
          );
        },
      );
      await t.test(
        "automation retries create one task and one run record",
        async () => {
          await db.checklistItem.create({
            data: {
              eventId,
              title: "Overdue fixture",
              dueAt: new Date(Date.now() - 86400000),
            },
          });
          const automation = new AutomationsController(database);
          const rule = await automation.create(host, eventId, {
            title: "Handle an overdue detail",
            trigger: "TASK_OVERDUE",
            action: "CREATE_TASK",
            message: `Unique next step ${suffix}`,
          });
          await Promise.all([
            executeAutomations(database, eventId),
            executeAutomations(database, eventId),
          ]);
          assert.equal(
            await db.automationRun.count({ where: { ruleId: rule.id } }),
            1,
          );
          assert.equal(
            await db.checklistItem.count({
              where: { eventId, title: rule.message },
            }),
            1,
          );
        },
      );
      await t.test(
        "published websites preserve privacy, moderation and optimistic edits",
        async () => {
          const websites = new WebsitesController(database),
            publicSites = new PublicWebsitesController(database);
          const draft = {
            slug: suffix,
            headline: "A thoughtful celebration",
            story: "A private little story.",
            coverUrl: "https://example.com/cover.jpg",
            theme: "ROSE",
            faqs: [],
            password: "Private123",
            published: true,
          };
          await websites.save(host, eventId, draft);
          assert.deepEqual(await publicSites.get(suffix), {
            passwordRequired: true,
          });
          const page = await publicSites.access(suffix, {
            password: "Private123",
          });
          assert.equal((page as any).headline, draft.headline);
          assert.equal("passwordHash" in page, false);
          await publicSites.message(suffix, {
            name: "Our Guest",
            message: "Wishing you a beautiful beginning.",
            password: "Private123",
          });
          assert.equal(
            (
              (await publicSites.access(suffix, {
                password: "Private123",
              })) as any
            ).guestbook.length,
            0,
          );
          const entry = await db.guestbookEntry.findFirstOrThrow({
            where: {
              websiteId: (
                await db.eventWebsite.findUniqueOrThrow({ where: { eventId } })
              ).id,
            },
          });
          await websites.moderate(host, eventId, entry.id, { approved: true });
          assert.equal(
            (
              (await publicSites.access(suffix, {
                password: "Private123",
              })) as any
            ).guestbook.length,
            1,
          );
          await websites.save(host, eventId, { ...draft, version: 1 });
          await assert.rejects(
            () => websites.save(host, eventId, { ...draft, version: 1 }),
            /edited elsewhere/,
          );
          await assert.rejects(() => websites.get(outsider, eventId));
        },
      );
      await t.test(
        "contract acknowledgement binds the account and preserves its fingerprint",
        async () => {
          const contracts = new ContractsController(database);
          const contract = await contracts.create(professional, {
            eventId,
            vendorId,
            title: "Venue agreement",
            body: "We agree to provide the venue and setup described in our confirmed proposal.",
            amountMinor: 1000000,
          });
          await assert.rejects(
            () =>
              contracts.sign(host, contract.id, {
                name: "Another Person",
                accepted: true,
              }),
            /full account name/,
          );
          const signed = await contracts.sign(host, contract.id, {
            name: host.user.fullName,
            accepted: true,
          });
          assert.equal(signed.status, "SIGNED");
          assert.equal(signed.contentHash, contract.contentHash);
          assert.equal(signed.signedBy, host.user.sub);
          await assert.rejects(
            () => contracts.withdraw(professional, contract.id),
            /cannot be overwritten/,
          );
        },
      );
      await t.test(
        "installment capture is race-safe and settles the exact booking balance",
        async () => {
          process.env.PAYMENT_MODE = "sandbox";
          const booking = await new BookingsController(database).hold(host, {
            eventId,
            serviceId,
            startAt,
          });
          const payments = new PaymentsController(database),
            invoices = new InvoicesController(database);
          const advance = await payments.create(host, {
            bookingId: booking.id,
            provider: "SANDBOX",
            kind: "ADVANCE",
            idempotencyKey: `advance-${suffix}`,
          });
          await payments.sandbox(host, advance.id);
          await assert.rejects(
            () =>
              invoices.plan(host, booking.id, {
                installments: [
                  {
                    label: "Wrong balance",
                    amountMinor: 1,
                    dueAt: new Date(Date.now() + 86400000).toISOString(),
                  },
                ],
              }),
            /exact remaining/,
          );
          await invoices.plan(host, booking.id, {
            installments: [
              {
                label: "First milestone",
                amountMinor: 500000,
                dueAt: new Date(Date.now() + 86400000).toISOString(),
              },
              {
                label: "Final milestone",
                amountMinor: 200000,
                dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
              },
            ],
          });
          const installment = await db.installment.findFirstOrThrow({
            where: { bookingId: booking.id, amountMinor: 500000 },
          });
          const intents = await Promise.all(
            [0, 1].map((i) =>
              payments.create(host, {
                bookingId: booking.id,
                kind: "INSTALLMENT",
                provider: "SANDBOX",
                installmentId: installment.id,
                idempotencyKey: `installment-${suffix}-${i}`,
              }),
            ),
          );
          const captures = await Promise.allSettled(
            intents.map((i) => payments.sandbox(host, i.id)),
          );
          assert.equal(
            captures.filter((r) => r.status === "fulfilled").length,
            1,
          );
          const balance = await payments.create(host, {
            bookingId: booking.id,
            kind: "BALANCE",
            provider: "SANDBOX",
            idempotencyKey: `balance-${suffix}`,
          });
          assert.equal(balance.amountMinor, 200000);
          await payments.sandbox(host, balance.id);
          assert.equal(
            await db.installment.count({
              where: { bookingId: booking.id, status: "PENDING" },
            }),
            0,
          );
          const invoice = (await invoices.event(host, eventId)).find(
            (i) => i.booking.id === booking.id,
          )!;
          assert.equal(invoice.paidMinor, 1000000);
          assert.equal(invoice.outstandingMinor, 0);
        },
      );
      await t.test(
        "recurring blackouts roll back on a protected reservation",
        async () => {
          const calendar = new AvailabilityController(database);
          await assert.rejects(
            () =>
              calendar.recurring(professional, vendorId, {
                serviceId,
                from: futureDate,
                until: futureDate,
                weekdays: [0, 1, 2, 3, 4, 5, 6],
                fromTime: "10:00",
                untilTime: "18:00",
                reason: "Maintenance",
              }),
            /overlaps an active booking/,
          );
          assert.equal(
            await db.availabilityBlock.count({ where: { serviceId } }),
            0,
          );
        },
      );
      await t.test(
        "CRM permissions and earnings analytics reflect captured money",
        async () => {
          const crm = new CrmController(database);
          const lead = await crm.create(professional, vendorId, {
            name: "A thoughtful inquiry",
            estimatedMinor: 1200000,
          });
          await assert.rejects(() => crm.list(outsider, vendorId));
          await crm.update(professional, vendorId, lead.id, { stage: "WON" });
          assert.equal(
            (await db.lead.findUniqueOrThrow({ where: { id: lead.id } }))
              .estimatedMinor,
            1200000,
            "moving a lead must preserve its estimated value",
          );
          const insights = await new AnalyticsController(database).business(
            professional,
            vendorId,
          );
          assert.equal(insights.won, 1);
          assert.equal(insights.grossMinor, 1000000);
          assert.equal(insights.netMinor, 900000);
          assert.ok(insights.activity.length > 0);
        },
      );
    } finally {
      await db.activity.deleteMany({
        where: { OR: [{ eventId }, { vendorId }] },
      });
      const site = eventId
        ? await db.eventWebsite.findUnique({ where: { eventId } })
        : null;
      if (site)
        await db.guestbookEntry.deleteMany({ where: { websiteId: site.id } });
      for (const model of [
        "eventWebsite",
        "contract",
        "automationRun",
        "automationRule",
        "runSheetItem",
        "guestCheckin",
        "seatTable",
        "installment",
        "moodItem",
        "activity",
        "dispute",
        "quote",
      ] as const)
        await (db[model] as any).deleteMany({ where: { eventId } });
      await db.workspaceInvite.deleteMany({
        where: { scopeId: { in: [eventId, vendorId] } },
      });
      await db.ledgerEntry.deleteMany({ where: { vendorId } });
      await db.payment.deleteMany({ where: { eventId } });
      await db.booking.deleteMany({ where: { eventId } });
      const guests = await db.guest.findMany({
        where: { eventId },
        select: { id: true },
      });
      await db.guestResponse.deleteMany({
        where: { guestId: { in: guests.map((g) => g.id) } },
      });
      await db.guest.deleteMany({ where: { eventId } });
      await db.checklistItem.deleteMany({ where: { eventId } });
      await db.eventDay.deleteMany({ where: { eventId } });
      await db.conversation.deleteMany({ where: { eventId } });
      await db.notification.deleteMany({
        where: { recipientId: { in: userIds } },
      });
      await db.lead.deleteMany({ where: { vendorId } });
      if (eventId) await db.event.delete({ where: { id: eventId } });
      if (serviceId)
        await db.vendorService.delete({ where: { id: serviceId } });
      if (vendorId) await db.vendor.delete({ where: { id: vendorId } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await db.$disconnect();
    }
  },
);
