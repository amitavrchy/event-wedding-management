# Event & Wedding Management — Database Audit

Source: `backend/prisma/schema.prisma` (36 models) and the five SQL migrations under `backend/prisma/migrations/`. No live database was available, so query plans were not measured (index findings are derived from the schema and the queries in the code).

## 1. Schema design

| Topic | Finding |
|---|---|
| Keys | All tables use `cuid()` text primary keys |
| Enumerations | Every status, role, kind and permission is a free-form `String`. Nothing in the database stops an invalid status |
| Money | Integer paisa (`Int`, 32-bit). The request validator caps amounts at 2,000,000,000 paisa (BDT 2 crore). Sums are done in Postgres `bigint` or JavaScript numbers, so aggregates are safe |
| Audit fields | Only some tables have `createdAt`; almost none have `updatedAt`; no soft-delete column anywhere |
| User | No phone, no `emailVerifiedAt`, no status/disabled flag |
| Vendor | One `image` URL; no phone, address, service areas, gallery, verification documents or rating aggregate |
| Arrays as relations | `Package.serviceIds String[]` holds service IDs with no referential integrity |

## 2. Referential integrity — CONFIRMED ARCHITECTURAL WEAKNESS

Only these foreign keys exist (migration `202611050001_initial:288-315`, `202611050004:303-306`): `VendorService→Vendor`, `AvailabilityBlock→VendorService`, `EventDay/ChecklistItem/Booking/BudgetItem/Expense/Guest→Event`, `Booking→VendorService`, `Message→Conversation`, `EventMember→Event`, `VendorMember→Vendor`.

Columns that reference other tables with **no** foreign key:

`Event.hostId`, `Vendor.ownerId`, `Booking.vendorId`, `Payment.bookingId`, `Payment.eventId`, `LedgerEntry.paymentId`, `LedgerEntry.vendorId`, `Review.bookingId/vendorId/hostId`, `Conversation.eventId/vendorId`, `Quote.eventId/vendorId`, `Dispute.bookingId/eventId`, `Notification.recipientId`, `Contract.eventId/vendorId`, `Installment.bookingId/eventId`, `Lead.vendorId`, `AutomationRule.eventId`, `AutomationRun.ruleId/eventId`, `EventWebsite.eventId`, `GuestbookEntry.websiteId`, `MoodItem.eventId`, `Favorite.userId/vendorId`, `Activity.*`, `GuestCheckin.*`, `GuestResponse.*`, `SeatTable.eventId`, `RunSheetItem.eventId/dayId`, `Guest.seatingTableId`, `Package.vendorId`.

Impact: orphaned payments, ledger rows and contracts are possible; deleting anything is unsafe; reporting joins cannot rely on the data.

## 3. Constraints that exist (keep)

Migration `202611050002_integrity`:

- `booking_service_period_exclusion`: GiST exclusion on `(serviceId, tsrange(startAt, reservedUntil))` for active statuses — the database itself rejects double bookings.
- `booking_money_valid`, `booking_period_valid`, `payment_amount_valid`, `guest_party_valid`, `ledger_conserves_money`, `review_rating_valid`.

These are not expressible in `schema.prisma`. The `db:push` script in `backend/package.json` would create a database **without** them — **POTENTIAL RISK**; remove the script or document that only `migrate deploy` is supported.

## 4. Indexes

Existing: unique keys on email, slug, tokens, idempotency key, `(eventId, category)`, `(eventId, vendorId)` etc.; `Booking(serviceId, startAt, reservedUntil)`; `Notification(recipientId, createdAt)`; `RunSheetItem(eventId, startsAt)`; `Installment(eventId, dueAt)`; `Lead(vendorId, stage)`; `GuestbookEntry(websiteId, approved)`; `Activity(eventId|vendorId, createdAt)`.

Missing for queries that run today — **CONFIRMED ARCHITECTURAL WEAKNESS** (PostgreSQL does not index foreign-key columns automatically):

| Table | Needed index | Query |
|---|---|---|
| `Event` | `(hostId)` | every event list (`access.ts:54-59`) |
| `EventMember`, `VendorMember` | `(userId)` | every access filter |
| `Vendor` | `(status, category, city)`, `(ownerId)` | marketplace list, `vendors/mine` |
| `Guest` | `(eventId)` | guest list, RSVP totals, analytics |
| `EventDay`, `ChecklistItem`, `Expense`, `MoodItem` | `(eventId)` | event detail |
| `ChecklistItem` | `(done, dueAt)` | reminder job every minute (`reminders.ts:28-31`) |
| `Booking` | `(eventId)`, `(vendorId)`, `(status, holdExpiresAt)` | lists; hold-expiry job every minute (`jobs.ts:24-30`) |
| `Payment` | `(bookingId, status)`, `(eventId)` | capture, budget, invoices |
| `Message` | `(conversationId, createdAt)` | chat history |
| `Quote` | `(eventId)`, `(status, expiresAt)` | quote list; expiry job |
| `Installment` | `(bookingId)`, `(status, dueAt)` | payments; reminder job |
| `LedgerEntry`, `Review`, `Contract` | `(vendorId)` | vendor finance, reviews, contracts |
| `AutomationRule` | `(enabled, eventId)` | automation job |
| `GuestCheckin` | `(eventId, dayId)` | check-in list and totals |
| `WorkspaceInvite` | `(scope, scopeId)` | collaboration list |

## 5. Query performance

- Full-event reads with every guest/booking/expense on each UI refresh (`events.ts:82-104`).
- The marketplace reads up to 100 vendors with all services, all blocks and all active bookings, then filters in application memory (`vendors.ts:51-97`).
- Three N+1 patterns in request paths and two in the every-minute job (see `backend-audit.md` §5).
- No query anywhere uses a cursor or offset.

## 6. Transaction safety

| Operation | Assessment |
|---|---|
| Booking hold, cart hold | Safe: advisory lock + exclusion constraint |
| Payment create/capture | Safe: advisory lock, idempotency, re-read inside transaction |
| Dispute refund | Safe ordering of locks; marks payments, ledger, instalments, booking in one transaction |
| Quote respond | Check then update outside a transaction (`packages.ts:100-104`) — a narrow race, low impact |
| Guest import | `createMany` of up to 500 rows, atomic |
| RSVP | Serialized per event by advisory lock; capacity is a warning only |

Lock keys are `hashtext(id)` (32-bit). A collision only adds contention, not incorrectness.

## 7. Migration safety

- Five forward-only migrations, no destructive statements. No down migrations (normal for Prisma).
- `CREATE EXTENSION btree_gist` requires the database role to be allowed to create extensions on the shared Postgres.
- Deploy applies migrations **after** the new containers are already serving traffic (`deploy.yml`: `up -d` then `prisma migrate deploy`) — **CONFIRMED BUG** in ordering.
- No backup is taken before migrating.

## 8. Recommended changes

1. One migration adding the missing indexes (use `CREATE INDEX CONCURRENTLY` on a populated database).
2. Add foreign keys in stages: first clean orphans, then `ADD CONSTRAINT … NOT VALID`, then `VALIDATE CONSTRAINT`. Start with payments/ledger/bookings.
3. Replace status strings with CHECK constraints or Postgres enums for `Booking.status`, `Payment.status`, `Vendor.status`, `User.role`.
4. Add `createdAt`/`updatedAt` to all tables and `deletedAt` to `Event`, `Vendor`, `Guest`.
5. Add the entities the business model needs: `Plan`, `VendorSubscription`, `SubscriptionPayment`, `VendorDocument`, `VendorMedia` (see `monetization-strategy.md`).
6. Remove `db:push` from `package.json`.

## 9. Verification

- `\d "Booking"` must list the new indexes; `EXPLAIN` on the hold-expiry update must show an index scan.
- Inserting a `Payment` with a non-existent `bookingId` must fail.
- `prisma migrate diff` between the migrations folder and `schema.prisma` must be empty apart from the hand-written constraints.
