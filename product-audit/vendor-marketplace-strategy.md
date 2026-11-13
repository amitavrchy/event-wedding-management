# Event & Wedding Management — Vendor Marketplace Strategy

## 1. Where the code stands versus the intended model

| Intended | In the code |
|---|---|
| Vendors pay a monthly subscription to be promoted | No subscription entity, route or screen. The only monetisation code is a per-booking commission (`Vendor.commissionBps`, default 10 %) applied to simulated payments (`payments.ts:185-194`) |
| Marketplace complements planning | Achieved in structure: planning tools work without hiring a vendor |
| Vendors verify their business | Admin can flip `APPLIED → ACTIVE`; no documents |
| Portfolios | One image URL |
| Leads | Conversations exist; CRM leads are manual |

The implemented model (platform takes payment, keeps commission, pays out) is the hardest one to operate in Bangladesh: it needs a payment gateway merchant account, settlement and refunds, and makes the platform responsible for customer money. The intended subscription model avoids all of that. **Recommendation: build subscriptions and treat on-platform payment as a later, optional feature.**

## 2. Category structure

Launch with a short, enforced list (the `Category` table already supports admin management):

Venue / convention centre · Catering · Photography · Videography (cinematography) · Decoration & stage · Makeup & mehendi artist · Event planner · Sound, lighting & DJ · Transport (car/bus rental) · Invitation card & printing · Entertainment (band, singer, anchor) · Bridal wear & jewellery rental · Flowers · Cake & desserts.

Add attributes per category instead of free text: venues need capacity, hall count, AC, parking, in-house catering rule; caterers need per-plate price range and minimum plates; photographers need coverage hours and deliverables. `VendorService.capacity` is the only such attribute today.

## 3. Customer workflow (target)

Event planning → **Discover** (category, area, date, budget, guest count) → **Compare** (up to three) → **Inquiry** (structured) → **Quotation** → **Booking recorded** (offline payment milestones tracked in the host's budget) → **Review** (automatic request).

Changes required from today's flow:

- Replace "hold + 30 % advance + 15-minute timer" as the default with an inquiry. Keep date holds as a vendor-controlled option.
- Create a lead for the vendor on every inquiry.
- Let the vendor mark a booking as confirmed and record received amounts.

## 4. Vendor workflow (target)

Registration → setup checklist → verification documents → **plan selection** → payment → listing live → inquiries → quotations → bookings → monthly performance report → renewal.

## 5. Ranking and fairness rules

Write these down before selling "featured" placement:

1. Default order: relevance to filters (category, area, date availability, capacity), then profile completeness, response rate, rating volume and score, recency of activity.
2. Paid plans may add a badge and extra media; they must not hide better-matching free listings entirely.
3. "Featured" slots are limited in number per category and area, always labelled **Sponsored**.
4. New vendors receive a time-limited visibility boost so the marketplace does not freeze around early joiners.

## 6. Trust and safety

| Risk | Control |
|---|---|
| Fake or duplicate businesses | One listing per trade licence/NID and phone; admin review; slug and phone uniqueness |
| Fraudulent listings (stolen photos) | Reverse-image spot checks on verification; report button; takedown policy |
| Fake reviews | Only customers with a confirmed booking can review (already enforced by `reviews.ts:26-33`); one review per booking (unique index); vendor reply; report → admin queue |
| Off-platform disputes | Clear statement that the platform records but does not hold payments; cancellation terms shown on each quotation |
| Harassment in chat | Report and block; message retention for moderation |
| Sponsored placement confusion | Mandatory label |
| Data misuse by vendors | Vendors see a host's contact details only after an inquiry; rate-limit quotes (today any vendor can quote any event ID — `packages.ts:69-90`) |
| Customer support | Named support number/WhatsApp during season; response-time targets |

## 7. Supply acquisition (the hard part)

A marketplace is worthless to hosts until each category in a city has enough good vendors. Plan:

1. Pick **one city and three categories** (suggested: Dhaka; venues, photography, decoration).
2. Onboard the first 50–100 vendors by hand, free for six months, with the team creating profiles from the vendors' Facebook pages with consent.
3. Give vendors something useful on day one that does not depend on demand: a shareable profile page, an inquiry form link for their Facebook page, quotation PDFs, a booking calendar.
4. Start charging only when vendors receive inquiries through the platform; measure inquiries per vendor per month before setting prices.

## 8. Demand acquisition

- The free planning tools are the acquisition channel: every RSVP link and celebration website is seen by hundreds of guests. Add a discreet "Plan your event with Utsab" footer.
- SEO pages per category and area ("wedding photographers in Dhanmondi") generated from real listings.
- Facebook groups and wedding-season campaigns; partnerships with a few well-known vendors who bring their followers.

## 9. Seasonality and retention

Weddings concentrate in the cooler months and a host's need ends with the event. Mitigations that fit the existing code:

- The product already supports birthdays, anniversaries, corporate and general events (`event-templates.ts`); market those in the off-season.
- Annual reminders for birthdays and anniversaries with one-tap "plan again".
- Corporate accounts (several events per year) are the only naturally recurring host segment — worth a dedicated landing page.
- Revenue retention comes from vendors, not hosts; vendor tools (calendar, leads, quotations) must be useful all year.

## 10. Metrics to track from day one

Vendors: applications, verified, profile completeness, inquiries per vendor per month, response time, quotation rate, booking rate, paid conversion, churn.

Hosts: sign-ups, events created, guests added, RSVP links opened, inquiries sent per event, events with at least one recorded booking.

Marketplace health: share of inquiries answered within 24 h; share of categories with ≥ 10 active vendors per launch area.
