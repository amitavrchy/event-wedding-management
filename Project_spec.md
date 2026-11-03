# Event & Wedding Management — Project Spec

> Stack: **Next.js + NestJS + Prisma + PostgreSQL + Redis/BullMQ + Socket.IO**  
> Bangladesh wedding/event platform: vendor marketplace (decorator, photographer, catering, venue), availability booking, packages, budget planner, guest/RSVP, payments.

---

## 1. Overview & Goals

### Product
Couples/event hosts plan weddings & corporate events: discover vendors, book dates with conflict-free availability, assemble packages, manage guest lists/RSVP, track budget vs spend, pay advances via BD gateways.

### Engineering goals
- Vendor calendar with **double-booking prevention** (exclusion/locks).
- Package composer + custom quotes.
- Budget planner linking bookings & manual expenses.
- Guest RSVP (public links) + seating stub.
- Multi-vendor event cart checkout with split payments/advances.

### Non-goals
- Full travel booking for honeymoon.
- Live streaming production tools.

---

## 2. User Roles & Permissions (RBAC)

| Role | Permissions |
|------|-------------|
| `PLATFORM_ADMIN` | Categories, commissions, disputes |
| `VENDOR` | Services, calendar, packages, bookings, team |
| `HOST` / `COUPLE` | Events, budget, guests, bookings, payments |
| `PLANNER` (optional) | Act on behalf of host with invite |
| `GUEST` | RSVP public token only |

---

## 3. Feature Modules

1. Auth & vendor onboarding/KYC lite  
2. Vendor catalog (category, portfolio, pricing)  
3. Availability calendar & booking requests  
4. Packages & quotes  
5. Event workspace (timeline, checklist)  
6. Budget planner  
7. Guest list & RSVP  
8. Payments (advance/balance) & commissions  
9. Reviews  
10. Messaging  

---

## 4. Advanced Business Logic

### 4.1 Availability & booking
- Vendor services have duration + buffer; venues have capacity & parallel halls.
- Booking hold TTL; confirm after advance payment.
- DB exclusion or advisory lock on `(vendorServiceId, tstzrange)`.
- Multi-day weddings (Gaye Holud, Wedding, Reception) as linked `EventDay`s.

### 4.2 Packages
- Curated bundles across vendors OR single-vendor packages.
- Price = sum components − bundle discount; snapshot on book.

### 4.3 Budget planner
```
categories: venue, catering, decor, photo, attire, misc
plannedAmount vs committed (bookings) vs actual (payments+expenses)
alert when committed > planned * threshold
```

### 4.4 RSVP
- Unique guest tokens; +1 allowed per rules; meal preference; deadline.
- Capacity warnings for venue seating.

### 4.5 Payments & commission
- Advance % by category; balance before event date job.
- Platform commission on captured amount; vendor payout ledger.

### 4.6 Edge cases
- Vendor cancel → replacement suggestions + refund policy.  
- Rain date / force majeure policy flags.  
- Concurrent booking same venue hall.  
- Guest token reuse after decline→accept.  
- Planner permissions expire after event.

---

## 5. State Machines

**Vendor**: `APPLIED → ACTIVE | SUSPENDED`  
**Booking**: `INQUIRY → HELD → AWAITING_ADVANCE → CONFIRMED → COMPLETED | CANCELLED | EXPIRED`  
**Quote**: `DRAFT → SENT → ACCEPTED | REJECTED | EXPIRED`  
**RSVP**: `INVITED → ACCEPTED | DECLINED | MAYBE`  
**Payout**: `PENDING → PAID`

---

## 6. Prisma Schema Draft

```prisma
model User { id String @id @default(cuid()) email String? phone String? fullName String passwordHash String? role String }
model Vendor {
  id String @id @default(cuid())
  ownerId String
  slug String @unique
  businessName String
  categories String[]
  status String
  commissionBps Int @default(1000)
}
model VendorService {
  id String @id @default(cuid())
  vendorId String
  title String
  description String?
  basePriceMinor Int
  durationHours Int @default(4)
  bufferHours Int @default(0)
  capacity Int?
}
model AvailabilityBlock {
  id String @id @default(cuid())
  serviceId String
  startAt DateTime
  endAt DateTime
  reason String?
}
model Event {
  id String @id @default(cuid())
  hostId String
  title String
  eventType String // WEDDING HOLUD RECEPTION CORPORATE
  city String?
  status String
}
model EventDay {
  id String @id @default(cuid())
  eventId String
  name String
  startsAt DateTime
  endsAt DateTime
  venueName String?
}
model Package {
  id String @id @default(cuid())
  vendorId String?
  title String
  items Json
  priceMinor Int
}
model Quote {
  id String @id @default(cuid())
  eventId String
  vendorId String
  status String
  amountMinor Int
  breakdown Json
  expiresAt DateTime?
}
model Booking {
  id String @id @default(cuid())
  eventId String
  serviceId String
  vendorId String
  status String
  startAt DateTime
  endAt DateTime
  priceMinor Int
  advanceMinor Int
  // period exclusion via SQL migration
  @@index([vendorId, startAt, endAt])
}
model BudgetItem {
  id String @id @default(cuid())
  eventId String
  category String
  plannedMinor Int
  notes String?
}
model Expense {
  id String @id @default(cuid())
  eventId String
  category String
  amountMinor Int
  bookingId String?
  note String?
}
model Guest {
  id String @id @default(cuid())
  eventId String
  name String
  phone String?
  email String?
  partySize Int @default(1)
  rsvpStatus String @default("INVITED")
  token String @unique
  mealPreference String?
  tableLabel String?
}
model Payment {
  id String @id @default(cuid())
  bookingId String?
  eventId String?
  provider String
  status String
  amountMinor Int
  kind String // ADVANCE BALANCE
  idempotencyKey String @unique
}
model Review {
  id String @id @default(cuid())
  bookingId String @unique
  rating Int
  body String?
}
model Conversation { id String @id @default(cuid()) eventId String vendorId String }
model Message { id String @id @default(cuid()) conversationId String senderId String body String createdAt DateTime @default(now()) }
model VendorBalance {
  vendorId String @id
  availableMinor Int @default(0)
}
```

---

## 7. REST API

- Vendor onboarding, services, calendar  
- Search vendors by category/city/date availability  
- Events, event days, checklist  
- Quotes & bookings holds/confirm  
- Budget + expenses  
- Guests import CSV; public `GET/POST /rsvp/:token`  
- Payments webhooks  
- Reviews after COMPLETED  

---

## 8. Real-time

- Host↔vendor messaging  
- Booking status updates  

---

## 9. Jobs

- Expire holds  
- Balance payment reminders  
- RSVP deadline reminders (SMS)  
- Vendor payout batch  
- Event-day checklist nudges  

---

## 10. Security

- Public RSVP token unguessable; rate-limited.  
- Host data isolated; planner scoped.  
- Webhook signatures.  
- Portfolio media via signed URLs.

---

## 11. Caching

- Vendor search cards; invalidate on publish/calendar change.  
- Available dates short TTL cache.

---

## 12. Testing

- Parallel venue booking → one win.  
- Advance payment transitions booking to CONFIRMED.  
- Budget alert threshold.  
- RSVP party size capacity warning.  
- Commission ledger on payment success.

---

## 13. Folder Structure

```
event-wedding-management/
  Project_spec.md
  frontend/  # host + vendor + public RSVP
  backend/
```

---

## 14. Env vars

`DATABASE_URL`, `REDIS_URL`, `JWT_*`, `APP_URL`, `CORS_ORIGINS`, `S3_*`, `SMTP_URL`, `SMS_*`, `SSLCOMMERZ_*`, `BKASH_*`, `NAGAD_*`, `BOOKING_HOLD_MINUTES`, `DEFAULT_ADVANCE_BPS`, `DEFAULT_COMMISSION_BPS`

---

## 15. Milestones

1. Auth, vendors, services, search  
2. Calendar + booking holds/locks  
3. Payments advance/balance  
4. Event workspace + budget  
5. Guests/RSVP  
6. Packages/quotes/messaging  
7. Reviews, payouts, polish  

---

## 16. Acceptance Criteria

- [ ] Double-booking same service slot impossible under concurrency.
- [ ] Hold expires and frees calendar.
- [ ] Budget committed includes confirmed bookings.
- [ ] RSVP public page works without login.
- [ ] Vendor payout reflects commission correctly.
- [ ] Seed: venues/decorators/photographers in Dhaka with calendars.

---

## 17. Agent Notes

- Cultural defaults: multi-day Bangla wedding event types.  
- SMS RSVP reminders important.  
- Money ints; Asia/Dhaka TZ.
