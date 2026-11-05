# Events for every occasion

Utsab supports GENERAL, WEDDING, BIRTHDAY, ANNIVERSARY, CORPORATE, CONFERENCE, ENGAGEMENT, HOLUD, RECEPTION, BABY_SHOWER, GRADUATION, REUNION, and COMMUNITY. These use the same host planning and vendor operations: guests/RSVP, budgets, bookings, seating, check-in, run sheets, collaboration, websites, contracts, quotes, invoices, and sandbox payments.

`GET /api/event-types` exposes the server templates in `src/event-templates.ts`. It returns the occasion label, suggested budget in integer paisa, guest capacity, duration, checklist titles, and allocation weights in basis points. Suggestions are editable starting points, not market prices. The frontend metadata in `frontend/src/lib/event-types.ts` adds imagery and copy; the browser suite checks that types and numeric defaults agree with the API.

Authenticated `POST /api/events` requires `title`, `budgetMinor`, and `guestCapacity`. Optional fields are `city` (Dhaka), `eventType` (GENERAL), `starterPlan` (true), `startsAt` (future ISO timestamp with timezone), and `durationHours` (1–72; otherwise the occasion default). A single nested database write creates the event, checklist and budget allocations, and an optional event day. Budget allocations always total the supplied budget, including rounding remainders. Disabling `starterPlan` creates no checklist or allocations; a supplied date still creates an event day.

`PATCH /api/events/:id` accepts a supported `eventType`. This changes the occasion and dashboard presentation while preserving existing tasks, budget allocations, dates, bookings, and guest records. Subsequent budget edits are explicit in Settings. Unknown event types are rejected.

The demo host has a wedding plus birthday, anniversary, and corporate workspaces. Demo professionals include cake/desserts, entertainment, AV/production, and event planning alongside venues, photography, catering, decoration and makeup. These are fictional development examples. Rerunning the seed preserves existing example edits; production seeding is disabled.

The public homepage has occasion selection, host/professional account entry, planning and business feature sections, and FAQs. `/dashboard` is the authenticated overview. Photos are locally served; attribution is in `frontend/public/images/CREDITS.md`.

Live payments and external notification delivery still require production integrations. The general-event expansion does not add conference ticket sales, a speaker portal, or a live gateway.
