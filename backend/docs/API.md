# API reference

Base URL: `http://localhost:4000/api`. Requests and responses are JSON. Protected routes require `Authorization: Bearer <token>`. Amount fields ending in `Minor` are integer paisa, and timestamps must be ISO 8601 with a timezone offset. Validation errors use HTTP 400, sessions 401, ownership violations 403, missing records 404, conflicts 409, and throttling 429.

| Method    | Route                           | Behavior                                                  |
| --------- | ------------------------------- | --------------------------------------------------------- |
| POST      | `/auth/register`                | `email,password,fullName,role` (HOST or VENDOR)           |
| POST      | `/auth/login`                   | `email,password` → token and user                         |
| GET       | `/event-types`                  | Public occasion templates, suggested defaults and allocations |
| GET/POST  | `/events`                       | Owned event list / create                                 |
| GET/PATCH | `/events/:id`                   | Owned event details / settings                            |
| POST      | `/events/:id/days`              | Add `name,startsAt,endsAt,venueName`                      |
| POST      | `/events/:id/tasks`             | Add `title,dueAt?`                                        |
| PATCH     | `/events/:id/tasks/:taskId`     | Set `done`                                                |
| GET/POST  | `/vendors`                      | Public catalog / vendor application                       |
| GET       | `/vendors/:id`                  | Active vendor detail                                      |
| GET       | `/vendors/:id/calendar`         | Public busy periods; host IDs are excluded                |
| GET       | `/vendors/:id/reviews`          | Published verified reviews                                |
| POST      | `/vendors/:id/services`         | Owner adds a bookable service                             |
| POST      | `/vendors/:id/blocks`           | Owner blocks a free calendar period                       |
| GET/POST  | `/bookings`                     | Owned host/vendor reservations / acquire a hold           |
| PATCH     | `/bookings/:id/status`          | Unpaid cancellation or vendor completion                  |
| POST      | `/cart/hold`                    | Atomic multi-service holds with optional package discount |
| GET       | `/events/:id/budget`            | Planned, committed, actual, allocations, expenses         |
| PUT       | `/events/:id/budget/:category`  | Upsert `plannedMinor`                                     |
| POST      | `/events/:id/budget/expenses`   | Record `category,amountMinor,note`                        |
| GET/POST  | `/events/:id/guests`            | Owned guest list / add a guest                            |
| POST      | `/events/:id/guests/import`     | `{guests:[...]}`, 1–500 guests                            |
| PATCH     | `/events/:id/guests/:guestId`   | Set `tableLabel`                                          |
| GET/POST  | `/rsvp/:token`                  | Public invitation / reply, no login                       |
| POST      | `/payments`                     | Create sandbox ADVANCE or BALANCE intent                  |
| POST      | `/payments/:id/sandbox-confirm` | Capture a simulated payment                               |
| POST      | `/payments/webhook`             | HMAC-authenticated internal capture boundary              |
| GET       | `/payments/event/:id`           | Owned event payment history                               |
| GET/POST  | `/packages`                     | Public collections / owner creates a collection           |
| GET       | `/quotes/event/:id`             | Host quote list                                           |
| POST      | `/quotes`                       | Vendor sends itemized quote                               |
| POST      | `/quotes/:id/respond`           | Host accepts or rejects an open quote                     |
| GET/POST  | `/conversations`                | Owned threads / host opens a vendor thread                |
| GET/POST  | `/conversations/:id/messages`   | Latest 200 messages / send                                |
| POST      | `/reviews`                      | Host review on a COMPLETED booking                        |
| GET       | `/notifications`                | Current user's latest reminders                           |
| PATCH     | `/notifications/:id/read`       | Mark an owned reminder read                               |
| GET       | `/admin/vendors`                | Admin application queue                                   |
| PATCH     | `/admin/vendors/:id`            | Admin status and commission controls                      |
| GET       | `/admin/ledger`                 | Admin settlement ledger                                   |
| PATCH     | `/admin/ledger/:id/paid`        | Record manual settlement                                  |
| GET       | `/health`                       | Database readiness and payment mode                       |

Vendor query parameters: `category`, `city`, `q`, and `startAt`. Date filtering includes each service's duration and buffer. Dates in the web marketplace picker use 18:00 Asia/Dhaka; the reservation dialog accepts the exact time.

## Reservation examples

```json
{
  "eventId": "...",
  "serviceId": "...",
  "startAt": "2027-02-14T18:00:00+06:00",
  "policyFlags": ["RAIN_DATE"]
}
```

```json
{
  "eventId": "...",
  "packageId": "optional-package-id",
  "items": [
    { "serviceId": "...", "startAt": "2027-02-14T18:00:00+06:00" },
    { "serviceId": "...", "startAt": "2027-02-14T18:00:00+06:00" }
  ]
}
```

A cart accepts 1–10 distinct services. When `packageId` is present it must contain every package component, exactly once. Server prices/discounts are snapshotted; client totals are never trusted. All timestamps may be different in the API; the collection UI uses one shared start time.

## Sandbox payment

```json
{
  "bookingId": "...",
  "provider": "SANDBOX",
  "kind": "ADVANCE",
  "idempotencyKey": "a-stable-unique-request-key"
}
```

Retry the same logical request with its same key. Sandbox confirmation and webhook retries never duplicate a capture or ledger entry. The internal webhook signature is the hexadecimal HMAC-SHA256 of `JSON.stringify({paymentId,status:"CAPTURED"})` with `WEBHOOK_SECRET`, supplied as `x-signature`. This is not a live gateway integration.

Socket.IO accepts `{auth:{token}}`. `join(conversationId)` checks conversation ownership; `leave(conversationId)` leaves it. Saved messages are broadcast as `message`. Authenticated private user rooms receive `booking:update` after a hold or capture. Clients reconnect and also refresh messages over HTTP as a fallback.

## Vendor clients, quotes, and cancellation reviews

`GET /vendors/mine` lists the current vendor?s businesses including pending applications. `GET /vendors/:id/clients` lists client celebrations from existing conversations and requires business ownership. `POST /bookings` accepts an optional `quoteId`; it must be an accepted, unexpired quote for the same event and vendor and may be booked only once.

`GET /disputes` lists owned cancellation reviews (all for administrators). `POST /disputes` accepts `{bookingId,reason}` for a paid booking. `POST /disputes/:id/resolve` accepts `{action:"REFUND"}` or `{action:"REJECT"}` and requires an administrator. Refunds are sandbox-only, reverse captured payment and ledger status, and release the reservation atomically.

## Advanced planning and business APIs

All protected advanced routes use the same bearer session. Event collaborators must have an unexpired membership; viewers may read, editors may operate, and only the owner manages memberships. The business equivalents are viewer and manager.

| Route group                                     | Methods and behavior                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/collaboration/:scope/:id`                     | GET owner membership/invite list; scope is EVENT or VENDOR                               |
| `/collaboration/:scope/:id/invites`             | POST email, permission, days; returns a seven-day share token                            |
| `/collaboration/accept/:token`                  | POST consumes the invitation for the matching account email                              |
| `/collaboration/:scope/:id/members/:memberId`   | DELETE revokes membership and disconnects that account's live sockets                    |
| `/collaboration/:scope/:id/invites/:inviteId`   | DELETE cancels a pending invitation                                                      |
| `/events/:id/seating`                           | GET tables, permitted guest fields, and venue capacity                                   |
| `/events/:id/seating/tables`                    | POST label, capacity, shape, x/y                                                         |
| `/events/:id/seating/tables/:tableId`           | PATCH x/y with version; DELETE unassigns its guests and removes table                    |
| `/events/:id/seating/assign`                    | POST guestId and tableId (nullable), capacity-safe under concurrency                     |
| `/events/:id/run-sheet`                         | GET cues; POST dayId, title, startsAt, durationMinutes, owner, location, notes           |
| `/events/:id/run-sheet/:itemId`                 | PATCH version and status/details; DELETE non-live cue                                    |
| `/events/:id/check-in/:dayId`                   | GET arrivals; POST invitation token for idempotent check-in                              |
| `/events/:id/check-in/:entryId`                 | DELETE arrival correction                                                                |
| `/contracts`                                    | POST fixed client agreement; a vendor/client conversation is required                    |
| `/contracts/event/:id`, `/contracts/business`   | GET host or business agreement lists                                                     |
| `/contracts/:id/sign`                           | POST name and accepted=true, restricted to actual event owner                            |
| `/contracts/:id/withdraw`                       | POST withdrawal before signature                                                         |
| `/invoices/event/:id`, `/invoices/business`     | GET invoice snapshots, captured totals, and installment records                          |
| `/invoices/:bookingId/plan`                     | POST exact remaining-balance installments with label, amountMinor, dueAt                 |
| `/vendors/:id/leads`                            | GET/POST pipeline; PATCH/DELETE `/:leadId` for owned inquiries                           |
| `/vendors/:id/availability`                     | GET private resources, reservations, and blocks                                          |
| `/vendors/:id/availability/recurring`           | POST serviceId, from/until dates, weekdays 0?6, fromTime/untilTime, reason; max 90 days  |
| `/vendors/:id/availability/blocks/:blockId`     | DELETE owned blackout                                                                    |
| `/events/:id/automations`                       | GET rules/runs; POST trigger/action rule                                                 |
| `/events/:id/automations/:ruleId`               | PATCH enabled; DELETE rule while preserving run history                                  |
| `/events/:id/automations/run`                   | POST checks eligible rules idempotently                                                  |
| `/events/:id/website`                           | GET editor data; PUT full draft with version, published, optional password/clearPassword |
| `/events/:id/website/guestbook/:entryId`        | PATCH approved; DELETE entry                                                             |
| `/public/sites/:slug`                           | Public GET; protected websites expose only passwordRequired until authorized             |
| `/public/sites/:slug/access`                    | Public POST password returns permitted public website data                               |
| `/public/sites/:slug/guestbook`                 | Public POST name/message/password; messages await moderation                             |
| `/events/:id/inspiration`                       | GET/POST IMAGE, COLOR, or NOTE records; DELETE `/:itemId`                                |
| `/favorites`                                    | GET user's saved professionals; POST/DELETE `/:vendorId`                                 |
| `/events/:id/recommendations`                   | GET explained, deterministic vendor matching                                             |
| `/insights/event/:id`, `/insights/business/:id` | GET actual planning, financial, and activity metrics                                     |
| `/categories`                                   | Public GET active categories; admin POST name adds/restores one                          |
| `/categories/:id`                               | Admin PATCH enabled hides/restores a category                                            |

Public RSVP responses also accept `dietaryNotes` and `dayResponses: [{dayId,status}]`. Day identifiers must belong to the invitation event. Check-in verifies both the overall accepted response and any per-day response. View-only guest responses omit invitation tokens.

`POST /payments` additionally accepts `kind: INSTALLMENT` with `installmentId`. Capture checks the exact scheduled balance and serializes against all other payments on that booking. Paying the full remaining balance also settles pending milestones. Refunds mark milestones cancelled.
