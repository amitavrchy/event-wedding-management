# Event & Wedding Management — User Journeys

Each journey lists the path the code supports today, where it breaks, and the target journey. File references are to `backend/src` and `frontend/src`.

## 1. Host: first visit to first useful plan

**Today**

1. Landing page (`components/landing-page.tsx`) → Sign up with name, email, password, role.
2. Immediately signed in (no verification). Shell shows an empty event selector.
3. Create event (`components/new-event.tsx`): occasion, title, date, duration, city, budget, guests, starter plan on/off → `POST events` creates tasks, budget split and the first day.
4. Dashboard shows overview and next steps.

**Friction**

- Closing the tab logs the user out (`sessionStorage`).
- No phone number captured, so no SMS/WhatsApp reminders later.
- The twelve advanced tools are discoverable only via "Planning studio".

**Target**

Phone or email sign-up with OTP → "What are you planning?" → three questions (date, guests, budget) → dashboard with a visible plan and one suggested action ("Add your first 10 guests") → persistent session.

## 2. Host: guest list to RSVP

**Today**

1. Guests page: add one by one or import CSV (max 500 per call).
2. Each guest has a private link `/rsvp/<token>`; the host copies and sends it outside the product.
3. Guest opens the link, answers per day, picks a meal, sets party size (`guests.ts:107-192`).
4. Host sees totals; capacity warning if accepted party exceeds capacity.

**Friction**

- A typo in a name or phone cannot be corrected; a guest cannot be removed.
- No bulk sending, no WhatsApp share, no reminder to non-responders (an in-app nudge to the host exists only if the Redis worker runs).
- RSVP page is English only.

**Target**

Import from phone contacts/CSV → edit/delete → select guests → "Send on WhatsApp" (prefilled message with link) or "Send SMS" (paid) → automatic reminder 3 days before the deadline → host exports the caterer headcount by meal.

## 3. Host: vendor discovery to confirmed booking

**Today**

1. Find vendors: filter by category, city, name, date; open the booking modal (calendar, reviews).
2. Shortlist/favourite; recommendations score by city, budget fit, capacity, availability (`recommendations.ts`).
3. Open a conversation; chat in real time.
4. Optionally receive a quote and accept it.
5. Hold a date: 15-minute hold, 30 % advance.
6. "Pay" → simulated capture → booking `CONFIRMED`.
7. Optional contract acknowledgement; optional instalment plan defined by the host.
8. After the event the vendor marks completed → host can review.

**Where it breaks**

- Step 6 is a simulation (`payments.ts:113-123`).
- A 15-minute hold is too short for a wedding decision that involves family; holds silently expire.
- Vendors beyond the first 100 never appear.
- If the vendor never marks "completed", the host can never review.

**Target (no online payment required for launch)**

Discover → compare up to 3 vendors side by side → send an **inquiry** (date, guests, budget, message) → vendor replies with a quotation → host accepts → booking is recorded as "Confirmed with vendor" with the agreed amount and payment milestones tracked in the budget (paid offline: cash, bank, bKash to the vendor) → reminders for milestones → automatic review request the day after the event.

## 4. Vendor: registration to first lead

**Today**

1. Sign up with role VENDOR.
2. Vendor studio → Business tab: name, slug, category, city, description, image URL → status `APPLIED`.
3. Wait for an administrator to set `ACTIVE` (no notification either way).
4. Add services (title, price, duration, buffer, capacity), calendar blocks.
5. Wait for a host to open a conversation. Leads in the CRM are entered manually.

**Where it breaks**

- No way to pay for or even see a subscription plan.
- Profile cannot be edited; images cannot be uploaded; one image only.
- No verification documents, so "trusted local vendors" on the sign-in screen is not backed by a process.
- No notification of a new inquiry outside the open browser tab.

**Target**

Sign up → setup checklist (business details, category and service areas, 5–20 photos, packages with prices, availability) → submit trade licence/NID for verification → choose plan (free listing or paid) → pay by bKash/Nagad/card or submit a manual payment reference → listing live → new inquiry arrives by SMS/WhatsApp and creates a lead automatically → reply, quote, mark booked → monthly performance summary and renewal reminder.

## 5. Collaborator (family member or planner)

**Today:** host creates an invite bound to an email, copies the link, the invitee signs up with that email and accepts (`collaboration.ts:117-178`). Access ends automatically a day after the last event day.

**Friction:** the invite link opened in a new tab shows the sign-in screen and the context is lost after sign-up unless the user reopens the link. No email is sent.

**Target:** invite by phone or email → message with link → after sign-up the user lands inside the shared event with a banner explaining their role.

## 6. Platform administrator

**Today:** one page (`admin/page.tsx`) lists all vendors, the full ledger and disputes; admin can activate/suspend, set commission, mark payouts paid, resolve disputes, manage categories. Admin accounts are created by seed or SQL.

**Target:** queue of vendor applications with documents → approve/reject with reason → subscriptions and payments review → featured placement management → review moderation → searchable, paginated lists → audit log of every admin action.

## 7. Journey priority

| Journey | Blocks revenue | Blocks retention | Priority |
|---|---|---|---|
| Vendor subscription (4) | Yes | — | P0 |
| Sign-in persistence, password reset (1) | — | Yes | P0 |
| Guest edit/delete + sharing (2) | — | Yes | P1 |
| Inquiry → quotation without online payment (3) | Yes (vendor value) | — | P1 |
| New-inquiry notification to vendor (4) | Yes | Yes | P1 |
| Admin verification queue (6) | Trust | — | P1 |
| Collaborator invite delivery (5) | — | Yes | P2 |
