# Event & Wedding Management — Product Roadmap

Complexity: S ≤ 3 days, M ≤ 2 weeks, L > 2 weeks (one experienced engineer). Durations are effort, not calendar promises.

## Positioning

- **Target hosts:** families and couples planning weddings in Bangladeshi cities; secondarily birthday, anniversary and corporate organisers.
- **Target vendors:** small and mid-size event businesses that currently sell through Facebook pages, phone and referrals.
- **Existing alternatives:** Facebook pages/groups and Messenger, phone calls, spreadsheets and notebooks, a relative who "knows a guy", wedding planners for those who can afford them. Named competitor products were not researched in this session — NOT ASSESSED.
- **Proposition:** free, practical planning for the family (guests, RSVP by link, budget, checklist) plus a trustworthy vendor directory with real availability and quotations.
- **Differentiation to protect:** multi-day Bangladeshi wedding structure, guest RSVP links with meal counts, date-aware vendor availability.

## Roadmap 1 — Minimum lovable commercial launch

Goal: one city, three categories, vendors can pay, hosts can rely on it.

| # | Item | Complexity | Depends on | Customer value |
|---|---|---|---|---|
| 1 | Incident response, secrets rotation, branch protection, CI gate | S | — | Safety |
| 2 | Disable simulated payment in production; relabel booking as "recorded" | S | — | Honesty of data |
| 3 | Cookie sessions, logout, password reset, phone/email verification | M | SMS/email provider | Account safety |
| 4 | Notification service (SMS/email) for inquiry, quotation, invite, reset | M | Provider, real domain | Vendors actually respond |
| 5 | Vendor profile edit, image upload (object storage), service edit/delete | M | Storage | Sellable listings |
| 6 | Vendor list pagination, ordering, area filter | S | — | Discovery works beyond 100 |
| 7 | Guest/task/expense/day edit + delete; event archive | M | — | Daily usability |
| 8 | Inquiry → quotation → recorded booking flow; auto lead | M | 4 | Core marketplace loop |
| 9 | Vendor subscriptions with manual payment review, entitlements, receipts, renewal reminders | L | 3, 4 | Revenue |
| 10 | Vendor verification with documents; admin queues with pagination | M | 5 | Trust |
| 11 | Role-based navigation; confirmation dialogs; Bangla for public pages | M | — | Usability |
| 12 | Backups, monitoring, staging, deploy order | M | — | Reliability |
| 13 | Missing indexes + key foreign keys | S–M | — | Integrity, speed |
| 14 | Legal pages | S | — | Merchant onboarding |

## Roadmap 2 — Competitive SaaS product

| Item | Complexity | Depends on | Value |
|---|---|---|---|
| Hosted checkout for subscriptions (aggregator) and auto-activation | M | Merchant account | Less manual work |
| Featured listings with sponsored label and ranking rules | M | Traffic | Second revenue line |
| Vendor public profile pages + SEO category/area pages | M | Listings | Organic acquisition |
| Review request automation, vendor replies, moderation queue | M | Notifications | Trust |
| Vendor comparison, shortlist sharing with family | S–M | — | Decision support |
| Task assignment, document storage per event | M | Storage | Family collaboration |
| WhatsApp share, SMS invitation bundles | S–M | SMS provider | Matches habits |
| Full Bangla workspace | M | i18n scaffold | Reach |
| Recurring-event reminders, event duplication | S | — | Retention |
| Vendor monthly performance email/SMS | S | Notifications | Renewal |
| PWA install + push | M | — | Engagement |

## Roadmap 3 — Long-term expansion

| Item | Complexity | Precondition |
|---|---|---|
| On-platform advance payments with settlement and refunds | L | Gateway contract, legal review, finance operations |
| Booking commission | M | Above |
| Qualified-lead pricing | M | Reliable lead quality data |
| Corporate accounts (multi-event organisations, approvals, invoices) | L | Demand evidence |
| More cities | M each | Supply playbook proven |
| Vendor mobile app | L | Retention evidence |
| AI-assisted quotation drafts and guest list parsing | S–M | See `missing-features.md` |

## Sequencing notes

- Items 3–5 of Roadmap 1 unlock almost everything else; do them first after the security work.
- Do not start Roadmap 2 until at least 50 vendors are live and inquiries are flowing; the bottleneck will be supply, not features.
- Freeze feature work on seating, run sheet, automations, contracts and instalments until Roadmap 1 is complete.
