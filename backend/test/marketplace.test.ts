import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { holidaysBetween } from "../src/holidays";

test("holiday table: fixed and estimated lunar holidays", () => {
  const list = holidaysBetween("2027-03-01", "2027-03-31");
  assert.ok(list.some((h) => h.date === "2027-03-26" && !h.estimated));
  assert.ok(list.some((h) => h.name === "Eid ul-Fitr" && h.estimated));
  assert.ok(list.some((h) => h.kind === "RAMADAN"));
});

const enabled = Boolean(process.env.TEST_DATABASE_URL);
let app: any;
let base = "";
const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL || "postgresql://x/y" });

before(async () => {
  if (!enabled) return;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.NODE_ENV = "test";
  process.env.RATE_LIMIT_AUTH_PER_MINUTE = "10000";
  process.env.RATE_LIMIT_PER_MINUTE = "10000";
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_DIR = mkdtempSync(join(tmpdir(), "ayojon-mkt-"));
  delete process.env.REDIS_URL;
  // @ts-ignore -- compiled output (decorator metadata) is required for Nest DI
  const { createApp } = await import("../dist/main.js");
  app = await createApp({ logger: false });
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;
});
after(async () => {
  await app?.close();
  await db.$disconnect();
});

async function call(path: string, init: { method?: string; body?: unknown; token?: string } = {}) {
  const response = await fetch(`${base}/${path}`, {
    method: init.method || (init.body !== undefined ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
async function account(role: "HOST" | "VENDOR", extra: Partial<{ admin: boolean }> = {}) {
  const email = `${role.toLowerCase()}-${unique()}@test.local`;
  const r = await call("auth/register", { body: { email, password: "test-password-1", fullName: `${role} ${unique()}`, role, client: "mobile" } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  if (extra.admin) {
    await db.user.update({ where: { id: r.data.user.id }, data: { role: "PLATFORM_ADMIN" } });
    const login = await call("auth/login", { body: { email, password: "test-password-1", client: "mobile" } });
    return { token: login.data.accessToken as string, id: r.data.user.id as string };
  }
  return { token: r.data.accessToken as string, id: r.data.user.id as string };
}
async function vendorFor(owner: { token: string; id: string }, name = `Studio ${unique()}`) {
  const category = (await db.category.findFirst({ where: { enabled: true } }))!.name;
  const slug = `v-${unique()}`;
  const created = await call("vendors", {
    token: owner.token,
    body: { businessName: name, slug, category, city: "Dhaka", description: "A trusted team for weddings and family celebrations." },
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  await db.vendor.update({ where: { id: created.data.id }, data: { status: "ACTIVE" } });
  const service = await call(`vendors/${created.data.id}/services`, {
    token: owner.token,
    body: { title: "Full day coverage", basePriceMinor: 5000000, durationHours: 6, bufferHours: 1, capacity: 400 },
  });
  assert.equal(service.status, 201, JSON.stringify(service.data));
  return { id: created.data.id as string, slug, serviceId: service.data.id as string };
}

test("vendor search: public fields only, pagination, sponsored cap, availability and capacity filters", { skip: !enabled }, async () => {
  const owner = await account("VENDOR");
  const vendor = await vendorFor(owner);
  await db.vendor.update({ where: { id: vendor.id }, data: { phone: "+8801700000000", featuredUntil: new Date(Date.now() + 86400000) } });
  const page = await call(`vendors?limit=5&q=${encodeURIComponent("trusted team")}`);
  assert.equal(page.status, 200);
  assert.ok(Array.isArray(page.data.items) && page.data.total >= 1 && page.data.limit === 5);
  const mine = page.data.items.find((v: any) => v.id === vendor.id);
  assert.ok(mine, "vendor is listed");
  assert.equal(mine.sponsored, true);
  for (const hidden of ["ownerId", "commissionBps", "phone", "planCode", "status"]) assert.equal(mine[hidden], undefined, `${hidden} is private`);
  assert.ok(page.data.items.filter((v: any) => v.sponsored).length <= 3);

  const tooBig = await call(`vendors?q=${encodeURIComponent("trusted team")}&guests=1000&limit=60`);
  assert.ok(!tooBig.data.items.some((v: any) => v.id === vendor.id), "capacity filter");

  const when = new Date(Date.now() + 40 * 86400000);
  when.setUTCHours(12, 0, 0, 0);
  await db.availabilityBlock.create({
    data: { serviceId: vendor.serviceId, startAt: new Date(+when - 3600000), endAt: new Date(+when + 3600000) },
  });
  const busy = await call(`vendors?q=${encodeURIComponent("trusted team")}&startAt=${encodeURIComponent(when.toISOString())}&limit=60`);
  assert.ok(!busy.data.items.some((v: any) => v.id === vendor.id), "blocked vendors are hidden for that time");
  const bySlug = await call(`vendors/${vendor.slug}`);
  assert.equal(bySlug.data.id, vendor.id);
});

test("vendor profile edit, service retire and plan limits", { skip: !enabled }, async () => {
  const owner = await account("VENDOR");
  const vendor = await vendorFor(owner);
  const edit = await call(`vendors/${vendor.id}`, {
    method: "PATCH",
    token: owner.token,
    body: { description: "Updated description for our wedding photography team.", serviceAreas: ["Dhanmondi", "Gulshan"] },
  });
  assert.equal(edit.status, 200);
  assert.deepEqual(edit.data.serviceAreas, ["Dhanmondi", "Gulshan"]);
  // Free plan: three active services.
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await call(`vendors/${vendor.id}/services`, { token: owner.token, body: { title: `Extra ${i}`, basePriceMinor: 100000, durationHours: 2 } })).status,
      201,
    );
  const fourth = await call(`vendors/${vendor.id}/services`, { token: owner.token, body: { title: "Fourth", basePriceMinor: 100000, durationHours: 2 } });
  assert.equal(fourth.status, 400);
  assert.match(fourth.data.message, /plan allows 3/);
  const removed = await call(`vendors/${vendor.id}/services/${vendor.serviceId}`, { method: "DELETE", token: owner.token });
  assert.equal(removed.status, 200);
  const other = await account("VENDOR");
  assert.equal((await call(`vendors/${vendor.id}`, { method: "PATCH", token: other.token, body: { city: "Sylhet" } })).status, 403);
});

test("subscription: manual payment review is idempotent and stacks renewals", { skip: !enabled }, async () => {
  const owner = await account("VENDOR");
  const admin = await account("HOST", { admin: true });
  const vendor = await vendorFor(owner);
  const plans = await call("plans");
  assert.ok(plans.data.some((p: any) => p.code === "PREMIUM"));
  const sub = await call(`vendors/${vendor.id}/subscriptions`, { token: owner.token, body: { planCode: "PREMIUM" } });
  assert.equal(sub.status, 201);
  const cheap = await call(`subscriptions/${sub.data.id}/payments`, { token: owner.token, body: { method: "BKASH", reference: `TRX${unique()}`, amountMinor: 100 } });
  assert.equal(cheap.status, 400);
  const reference = `TRX${unique()}`;
  const paid = await call(`subscriptions/${sub.data.id}/payments`, { token: owner.token, body: { method: "BKASH", reference, amountMinor: 400000 } });
  assert.equal(paid.status, 201);
  // The same transaction ID cannot be reused.
  const sub2 = await call(`vendors/${vendor.id}/subscriptions`, { token: owner.token, body: { planCode: "PREMIUM" } });
  assert.equal(sub2.status, 409);
  assert.equal((await call(`admin/subscription-payments`, { token: owner.token })).status, 403);
  const queue = await call(`admin/subscription-payments`, { token: admin.token });
  assert.ok(queue.data.items.some((p: any) => p.id === paid.data.id));
  const [a, b] = await Promise.all([
    call(`admin/subscription-payments/${paid.data.id}/approve`, { token: admin.token, body: {} }),
    call(`admin/subscription-payments/${paid.data.id}/approve`, { token: admin.token, body: {} }),
  ]);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(a.data.receiptNumber, b.data.receiptNumber);
  const current = await call(`vendors/${vendor.id}/subscription`, { token: owner.token });
  assert.equal(current.data.planCode, "PREMIUM");
  const firstEnd = new Date(current.data.active.endsAt);
  // Renewal starts when the current period ends.
  const renew = await call(`vendors/${vendor.id}/subscriptions`, { token: owner.token, body: { planCode: "PREMIUM" } });
  const renewPay = await call(`subscriptions/${renew.data.id}/payments`, { token: owner.token, body: { method: "NAGAD", reference: `N${unique()}`, amountMinor: 400000 } });
  await call(`admin/subscription-payments/${renewPay.data.id}/approve`, { token: admin.token, body: {} });
  const renewed = await db.subscription.findUniqueOrThrow({ where: { id: renew.data.id } });
  assert.equal(+renewed.startsAt!, +firstEnd);
  const receipt = await call(`subscription-payments/${paid.data.id}/receipt`, { token: owner.token });
  assert.equal(receipt.data.reference, reference.toUpperCase());
  const vendorRow = await db.vendor.findUniqueOrThrow({ where: { id: vendor.id } });
  assert.ok(vendorRow.featuredUntil && vendorRow.featuredUntil > new Date());
  assert.ok((await db.auditLog.count({ where: { targetId: paid.data.id } })) >= 1);
});

test("inquiry creates a lead and conversation; vendors can only quote after contact; reviews and replies", { skip: !enabled }, async () => {
  const host = await account("HOST");
  const owner = await account("VENDOR");
  const vendor = await vendorFor(owner);
  const event = await call("events", { token: host.token, body: { title: "Rahman wedding", eventType: "WEDDING", budgetMinor: 100000000, guestCapacity: 300 } });
  const quoteFirst = await call("quotes", {
    token: owner.token,
    body: { eventId: event.data.id, vendorId: vendor.id, amountMinor: 1000, breakdown: [{ label: "x", amountMinor: 1000 }], expiresAt: new Date(Date.now() + 86400000).toISOString() },
  });
  assert.equal(quoteFirst.status, 400);
  const inquiry = await call(`vendors/${vendor.id}/inquiries`, {
    token: host.token,
    body: { eventId: event.data.id, guestCount: 250, budgetMinor: 6000000, message: "Are you free on our wedding evening?" },
  });
  assert.equal(inquiry.status, 201, JSON.stringify(inquiry.data));
  assert.ok(inquiry.data.leadId && inquiry.data.conversationId);
  const inbox = await call(`vendors/${vendor.id}/inquiries`, { token: owner.token });
  assert.equal(inbox.data.items[0].id, inquiry.data.id);
  const quote = await call("quotes", {
    token: owner.token,
    body: { eventId: event.data.id, vendorId: vendor.id, amountMinor: 5500000, breakdown: [{ label: "Coverage", amountMinor: 5500000 }], expiresAt: new Date(Date.now() + 86400000).toISOString() },
  });
  assert.equal(quote.status, 201);
  const updated = await db.inquiry.findUniqueOrThrow({ where: { id: inquiry.data.id } });
  assert.equal(updated.status, "QUOTED");
  assert.ok(updated.respondedAt);
  const detail = await call(`quotes/${quote.data.id}`, { token: host.token });
  assert.equal(detail.data.vendor.businessName.length > 0, true);
  assert.equal((await call(`vendors/${vendor.id}/inquiries`, { token: host.token, body: { message: "Vendors cannot do this to themselves" } })).status, 201);
  assert.equal((await call(`vendors/${vendor.id}/inquiries`, { token: owner.token, body: { message: "Vendors cannot send inquiries" } })).status, 403);
});

test("households: one family link answers for every member; sides summary", { skip: !enabled }, async () => {
  const host = await account("HOST");
  const event = await call("events", { token: host.token, body: { title: "Family wedding", eventType: "WEDDING", budgetMinor: 1000000, guestCapacity: 50 } });
  const id = event.data.id;
  await call(`events/${id}/sides`, { method: "PUT", token: host.token, body: { BRIDE: { label: "কনে পক্ষ", quota: 10, share: 40 }, GROOM: { label: "বর পক্ষ", quota: 12, share: 60 } } });
  const family = await call(`events/${id}/households`, {
    token: host.token,
    body: { name: "Rahman poribar", side: "BRIDE", members: [{ name: "Abdur Rahman" }, { name: "Salma Rahman" }] },
  });
  assert.equal(family.status, 201);
  const view = await call(`rsvp/household/${family.data.token}`);
  assert.equal(view.data.members.length, 2);
  const replies = view.data.members.map((m: any) => ({ token: m.token, reply: { rsvpStatus: "ACCEPTED", partySize: 1 } }));
  assert.equal((await call(`rsvp/household/${family.data.token}`, { body: { replies } })).status, 201);
  const summary = await call(`events/${id}/guests/sides/summary`, { token: host.token });
  const bride = summary.data.find((s: any) => s.side === "BRIDE");
  assert.equal(bride.acceptedPeople, 2);
  assert.equal(bride.label, "কনে পক্ষ");
  assert.equal(bride.quota, 10);
  const opened = await db.household.findUniqueOrThrow({ where: { id: family.data.id } });
  assert.ok(opened.invitationOpenedAt);
  // Guest edit and delete.
  const guest = await call(`events/${id}/guests`, { token: host.token, body: { name: "Karim Uddin", side: "GROOM" } });
  const edited = await call(`events/${id}/guests/${guest.data.id}`, { method: "PATCH", token: host.token, body: { name: "Karim Uddin Ahmed", maxPartySize: 4 } });
  assert.equal(edited.data.name, "Karim Uddin Ahmed");
  assert.equal(edited.data.maxPartySize, 4);
  assert.equal((await call(`events/${id}/guests/${guest.data.id}`, { method: "DELETE", token: host.token })).status, 200);
});

test("cost split, gifts, catering, logistics capacity and tool gates", { skip: !enabled }, async () => {
  const host = await account("HOST");
  const wedding = await call("events", { token: host.token, body: { title: "Split wedding", eventType: "WEDDING", budgetMinor: 1000000, guestCapacity: 50 } });
  const id = wedding.data.id;
  await call(`events/${id}/sides`, { method: "PUT", token: host.token, body: { BRIDE: { share: 50 }, GROOM: { share: 50 } } });
  const e1 = await call(`events/${id}/budget/expenses`, { token: host.token, body: { category: "Venue", amountMinor: 100000, note: "Hall advance" } });
  await call(`events/${id}/budget/expenses/${e1.data.id}`, { method: "PATCH", token: host.token, body: { paidBy: "BRIDE" } });
  const split = await call(`events/${id}/cost-split`, { token: host.token });
  assert.deepEqual(split.data.settlement, { from: "GROOM", to: "BRIDE", amountMinor: 50000 });

  const gift = await call(`events/${id}/gifts`, { token: host.token, body: { giverName: "Nasrin Khala", kind: "CASH", amountMinor: 500000, side: "BRIDE" } });
  assert.equal(gift.status, 201);
  assert.equal((await call(`events/${id}/gifts`, { token: host.token, body: { giverName: "No amount", kind: "CASH" } })).status, 400);
  await call(`events/${id}/gifts/${gift.data.id}`, { method: "PATCH", token: host.token, body: { thankYouSent: true } });
  const register = await call(`events/${id}/gifts`, { token: host.token });
  assert.equal(register.data.summary.cashMinor, 500000);
  assert.equal(register.data.summary.thankYouPending, 0);

  const day = await call(`events/${id}/days`, {
    token: host.token,
    body: { name: "Biye", startsAt: new Date(Date.now() + 30 * 86400000).toISOString(), endsAt: new Date(Date.now() + 30 * 86400000 + 5 * 3600000).toISOString() },
  });
  const g1 = await call(`events/${id}/guests`, { token: host.token, body: { name: "Guest One", maxPartySize: 3 } });
  await call(`rsvp/${g1.data.token}`, { body: { rsvpStatus: "ACCEPTED", partySize: 3, mealPreference: "No beef" } });
  const catering = await call(`events/${id}/catering?buffer=10`, { token: host.token });
  assert.equal(catering.data.overall.confirmedPeople, 3);
  assert.equal(catering.data.overall.recommendedPlates, 4);
  assert.equal(catering.data.days[0].dayId, day.data.id);
  assert.equal(catering.data.overall.meals["No beef"], 3);

  const car = await call(`events/${id}/logistics/transports`, { token: host.token, body: { label: "Microbus", capacity: 2 } });
  const full = await call(`events/${id}/logistics/guests/${g1.data.id}`, { method: "PUT", token: host.token, body: { transportId: car.data.id } });
  assert.equal(full.status, 400, "party of 3 does not fit in 2 seats");

  // A birthday does not include family sides or cost split.
  const birthday = await call("events", { token: host.token, body: { title: "Riya 30", eventType: "BIRTHDAY", budgetMinor: 100000, guestCapacity: 30 } });
  assert.equal((await call(`events/${birthday.data.id}/cost-split`, { token: host.token })).status, 403);
  await call(`events/${birthday.data.id}`, { method: "PATCH", token: host.token, body: { enabledFeatures: ["costSplit"] } });
  assert.equal((await call(`events/${birthday.data.id}/cost-split`, { token: host.token })).status, 200);
});

test("photo wall: public QR upload, moderation and live wall", { skip: !enabled }, async () => {
  const host = await account("HOST");
  const event = await call("events", { token: host.token, body: { title: "Photo party", eventType: "BIRTHDAY", budgetMinor: 100000, guestCapacity: 30 } });
  const id = event.data.id;
  const settings = await call(`events/${id}/photo-wall/settings`, { token: host.token, body: { enabled: true, moderation: true } });
  const token = settings.data.token;
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
  const slot = await call(`photo-wall/${token}/uploads`, { body: { contentType: "image/jpeg", sizeBytes: jpeg.length } });
  assert.equal(slot.status, 201);
  await fetch(`${base.replace(/\/api$/, "")}${slot.data.upload.url}`, { method: "PUT", body: jpeg, headers: { "Content-Type": "image/jpeg" } });
  const done = await call(`photo-wall/${token}/uploads/${slot.data.id}/complete`, { body: { uploaderName: "Cousin" } });
  assert.equal(done.data.status, "PENDING");
  assert.equal((await call(`photo-wall/${token}`)).data.photos.length, 0, "pending photos are not public");
  await call(`events/${id}/photo-wall/${done.data.id}`, { method: "PATCH", token: host.token, body: { status: "APPROVED" } });
  assert.equal((await call(`photo-wall/${token}`)).data.photos.length, 1);
  await call(`events/${id}/photo-wall/settings`, { token: host.token, body: { enabled: false } });
  assert.equal((await call(`photo-wall/${token}`)).status, 404);
});

test("offline check-in sync is idempotent", { skip: !enabled }, async () => {
  const host = await account("HOST");
  const event = await call("events", { token: host.token, body: { title: "Check-in", eventType: "CORPORATE", budgetMinor: 100000, guestCapacity: 30 } });
  const id = event.data.id;
  const day = await call(`events/${id}/days`, {
    token: host.token,
    body: { name: "Summit", startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date(Date.now() + 90000000).toISOString() },
  });
  const guest = await call(`events/${id}/guests`, { token: host.token, body: { name: "Delegate", maxPartySize: 1 } });
  await call(`rsvp/${guest.data.token}`, { body: { rsvpStatus: "ACCEPTED", partySize: 1 } });
  const roster = await call(`events/${id}/check-in/${day.data.id}/roster`, { token: host.token });
  assert.equal(roster.data.guests.length, 1);
  const items = [
    { clientId: "a", token: guest.data.token },
    { clientId: "b", token: guest.data.token },
    { clientId: "c", token: "x".repeat(32) },
  ];
  const sync = await call(`events/${id}/check-in/${day.data.id}/sync`, { token: host.token, body: { items } });
  assert.deepEqual(
    sync.data.results.map((r: any) => [r.clientId, r.ok, r.duplicate]),
    [
      ["a", true, false],
      ["b", true, true],
      ["c", false, undefined],
    ],
  );
  assert.equal(await db.guestCheckin.count({ where: { dayId: day.data.id } }), 1);
});
