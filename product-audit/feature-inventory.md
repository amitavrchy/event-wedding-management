# Event & Wedding Management — Feature Inventory

Status values: COMPLETE, PARTIALLY IMPLEMENTED, BROKEN, FRONTEND ONLY, BACKEND ONLY, NOT IMPLEMENTED, NOT VERIFIED. "COMPLETE" here means the code path exists end to end in source; none of these were exercised in a running system during this audit, so runtime behaviour is NOT VERIFIED for every row.

Test coverage column: U = unit, I = DB integration (`backend/test`), E = Playwright spec exists. Integration and browser tests were not runnable locally (see `../testing/execution-results.md`).

## Host features

| Feature | Role | Page | Endpoint | Entities | Status | Tests | Known issues |
|---|---|---|---|---|---|---|---|
| Registration / login | Host, Vendor | `/signup`, `/login` | `auth/register`, `auth/login` | User | PARTIALLY IMPLEMENTED | E | No verification, reset, logout (E-S2) |
| Event creation with occasion template | Host | `components/new-event.tsx` | `POST events` | Event, ChecklistItem, BudgetItem, EventDay | COMPLETE | U, E | No delete/archive |
| Multiple events + switcher | Host | shell | `GET events` | Event | COMPLETE | E | — |
| Multi-day timeline | Host | `/timeline` | `POST events/:id/days` | EventDay | PARTIALLY IMPLEMENTED | — | Create only |
| Checklist | Host | `/checklist`, `/dashboard` | `events/:id/tasks` | ChecklistItem | PARTIALLY IMPLEMENTED | E | No edit, delete, assignment |
| Budget plan + expenses | Host | `/budget` | `events/:id/budget*` | BudgetItem, Expense | PARTIALLY IMPLEMENTED | I | Expenses cannot be edited/deleted |
| Guest list, CSV import/export | Host | `/guests` | `events/:id/guests*` | Guest | PARTIALLY IMPLEMENTED | I, E | No edit/delete guest |
| Public RSVP (per-day, meal, party) | Guest | `/rsvp/[token]` | `rsvp/:token` | Guest, GuestResponse | COMPLETE | I, E | Invitation links must be sent manually |
| Seating plan | Host | `/seating` | `events/:id/seating*` | SeatTable, Guest | COMPLETE | I, E | — |
| Run sheet | Host | `/run-sheet` | `events/:id/run-sheet*` | RunSheetItem | COMPLETE | I, E | — |
| QR check-in | Host | `/check-in` | `events/:id/check-in*` | GuestCheckin | COMPLETE | I, E | Needs camera permission; offline not supported |
| Celebration website + guestbook | Host, public | `/website`, `/celebrate/[slug]` | `events/:id/website`, `public/sites/*` | EventWebsite, GuestbookEntry | COMPLETE | I, E | E-S5, E-S11 |
| Inspiration board | Host | `/inspiration` | `events/:id/inspiration` | MoodItem | COMPLETE | E | Links only, no upload |
| Collaborators (editor/viewer) | Host | `/collaboration`, `/invite/[token]` | `collaboration/*` | EventMember, WorkspaceInvite | PARTIALLY IMPLEMENTED | I | No email delivery |
| Automations | Host | `/automations` | `events/:id/automations*` | AutomationRule, AutomationRun | BROKEN in default prod config | I | E-B3, E-B4 |
| Reminders / notifications | Host | `/notifications` | `notifications*` | Notification | BROKEN in default prod config | — | Needs Redis worker (E-B4); in-app only |
| Insights | Host, Vendor | `/insights` | `insights/*` | — | COMPLETE | — | — |

## Marketplace features

| Feature | Role | Page | Endpoint | Entities | Status | Tests | Known issues |
|---|---|---|---|---|---|---|---|
| Vendor discovery + filters | Host | `/vendors` | `GET vendors` | Vendor, VendorService | PARTIALLY IMPLEMENTED | E | 100-vendor cap, no pagination/sort (E-B2), leaks fields (E-S4) |
| Vendor detail, calendar, reviews | Host | `components/booking-modal.tsx` | `vendors/:id*` | Review, AvailabilityBlock | COMPLETE | E | — |
| Shortlist + recommendations | Host | `/shortlist` | `favorites`, `events/:id/recommendations` | Favorite | COMPLETE | — | Same 100 cap |
| Vendor comparison | Host | `/shortlist` | — | — | NOT VERIFIED | — | Described in `docs/ADVANCED_SCOPE.md` |
| Messaging (realtime) | Host, Vendor | `/messages` | `conversations*`, Socket.IO | Conversation, Message | COMPLETE | I | No unread counts, no notification on new message |
| Quotes | Vendor → Host | `/studio`, `/packages` | `quotes*` | Quote | PARTIALLY IMPLEMENTED | I | One line item in UI; E-S8 |
| Date hold / booking | Host | booking modal, `/bookings` | `bookings`, `cart/hold` | Booking | COMPLETE | I, E | — |
| Advance / balance / instalment payment | Host | `/bookings`, `/finance` | `payments*`, `invoices/*/plan` | Payment, Installment, LedgerEntry | **SIMULATION ONLY** | I | No real gateway (E-S1) |
| Contracts with typed-name acknowledgement | Vendor, Host | `/contracts` | `contracts*` | Contract | COMPLETE | I | Not a legally reviewed e-signature |
| Reviews | Host | `/bookings` | `POST reviews` | Review | PARTIALLY IMPLEMENTED | — | No moderation, reply or reporting |
| Disputes / refunds | Host, Vendor, Admin | `/bookings`, `/admin` | `disputes*` | Dispute | BROKEN for vendors | I | E-B1; sandbox refunds only |

## Vendor features

| Feature | Page | Endpoint | Status | Known issues |
|---|---|---|---|---|
| Vendor registration (application) | `/studio` | `POST vendors` | PARTIALLY IMPLEMENTED | No documents, phone, address; cannot edit afterwards |
| Service catalogue | `/studio` | `POST vendors/:id/services` | PARTIALLY IMPLEMENTED | Create only |
| Packages | `/packages` | `POST packages` | NOT VERIFIED (UI) | — |
| Availability calendar + recurring blocks | `/studio`, `/availability` | `vendors/:id/blocks`, `availability/*` | COMPLETE | — |
| Lead CRM | `/business` | `vendors/:id/leads*` | PARTIALLY IMPLEMENTED | Leads are manual; inquiries do not create leads |
| Team members | `/collaboration` | `collaboration/VENDOR/*` | PARTIALLY IMPLEMENTED | No email delivery |
| Business analytics | `/insights` | `insights/business/:id` | COMPLETE | — |
| Portfolio upload | — | — | NOT IMPLEMENTED | Single image URL |
| **Vendor subscription, invoices, renewals** | — | — | **NOT IMPLEMENTED** | No models, routes or UI |
| Business verification | — | — | NOT IMPLEMENTED | Admin toggles `ACTIVE`/`SUSPENDED` only |

## Platform administration

| Feature | Page | Endpoint | Status |
|---|---|---|---|
| Vendor approval / suspension, commission rate | `/admin` | `admin/vendors*` | COMPLETE |
| Payout ledger (mark paid) | `/admin` | `admin/ledger*` | COMPLETE (manual bookkeeping) |
| Category management | `components/category-manager.tsx` | `categories*` | COMPLETE |
| Dispute resolution | `/admin` | `disputes/:id/resolve` | PARTIALLY IMPLEMENTED (sandbox refunds only) |
| Admin user provisioning | — | — | NOT IMPLEMENTED (seed or manual SQL) |
| Admin audit log | — | — | NOT IMPLEMENTED |

## Cross-cutting

| Capability | Status |
|---|---|
| Email, SMS, push notifications | NOT IMPLEMENTED |
| File/image upload and storage | NOT IMPLEMENTED |
| Bangla localisation | NOT IMPLEMENTED |
| Real payment gateway | NOT IMPLEMENTED |
| Data export / account deletion | NOT IMPLEMENTED (guest CSV export only) |
