# Event & Wedding Management — Missing Features

"Missing" means no implementation was found in source at commit `19e6734`. Priorities: P0 launch blocker, P1 core commercial, P2 retention/competitive, P3 future. Effort: S ≤ 3 days, M ≤ 2 weeks, L > 2 weeks for one experienced engineer.

## P0 — required before any commercial launch

| Feature | Why | Effort | Depends on |
|---|---|---|---|
| Vendor subscription: plans, entitlements, payment record, activation, expiry, renewal reminder, invoice/receipt | It is the stated revenue model and nothing exists (no models/routes/UI) | L | Decision on gateway vs manual review |
| Real session management: cookie session, logout, password reset, email or phone verification | Accounts cannot be recovered or secured | M | Email/SMS provider |
| Outbound notifications (email and/or SMS/WhatsApp) for: verification, reset, new inquiry, quote, booking, invite | No channel reaches a user who is not on the page | M | Provider accounts, real domain |
| Remove or gate simulated payments in production | Free confirmed bookings and fake payouts | S | — |
| Vendor profile editing and image upload to object storage | A marketplace listing without photos or edits is not sellable | M | S3-compatible storage + CDN |
| Edit/delete for guests, tasks, expenses, services, event days; archive event | Basic data correction | M | — |
| Vendor list pagination, ordering and server-side filters | Vendors after #100 are invisible | S | — |
| Terms of service, privacy policy, refund/cancellation policy pages | Required for merchant accounts and trust | S | Legal text |
| Backups, monitoring, CI gate | Operational minimum | M | — |

## P1 — core commercial features

| Feature | Notes | Effort |
|---|---|---|
| Vendor verification workflow | Upload trade licence / NID, admin review queue, "Verified" badge with date | M |
| Inquiry → quotation flow independent of online payment | Structured inquiry form; quotation with multiple line items; accept/decline; booking recorded with offline payment milestones | M |
| Automatic lead creation from inquiries | `Lead` rows are manual today (`crm.ts`) | S |
| Service areas and richer categories | District/area list; multiple categories per vendor | S |
| Vendor public profile page with shareable URL and SEO metadata | Vendors will share it; drives organic sign-ups | M |
| Review request automation + vendor reply + report/moderation | Reviews depend on vendor marking completion today | M |
| Bangla localisation (public pages first) | See `ui-ux-audit.md` | M |
| WhatsApp/SMS invitation sharing | Matches how invitations are actually sent | S (share links) / M (SMS) |
| Admin: paginated vendor/subscription/payment management and audit log | One unpaginated page today | M |
| Featured listings with clear "Sponsored" label | Second revenue line; needs ranking rules | M |

## P2 — retention and competitive features

| Feature | Notes | Effort |
|---|---|---|
| Vendor comparison view (price, inclusions, capacity, rating) | Verify what `/shortlist` already does | S–M |
| Task assignment to collaborators with reminders | `ChecklistItem` has no assignee | S |
| Document storage per event (contracts, receipts, ID copies) | Needs uploads | M |
| Event templates library and "duplicate event" | Templates exist in code (`event-templates.ts`); expose duplication | S |
| Recurring/annual events (birthdays, anniversaries) with yearly reminder | The cheapest retention lever | S |
| Corporate events: multiple organisers, approval of budget lines, export to Excel/PDF | Extends collaboration | M |
| Vendor calendar sync (ICS export) | Read-only feed is simple | S |
| Push notifications / PWA install | After email/SMS | M |
| Guest photo sharing on the celebration site | Needs storage and moderation | M |

## P3 — future expansion

Online advance payments held and settled by the platform (needs gateway, settlement, refunds, legal review); booking commission; vendor mobile app; venue 360° tours; gift registry; livestream links; multi-city expansion tooling; public vendor API.

## Features to keep out of the first launch

The code already contains seating canvas, run sheet, QR check-in, automations, contracts, instalment plans, inspiration board, celebration website and CRM. They work in source, but each adds support surface. Recommendation: keep them, but do not extend them until the P0/P1 list is finished; hide "Automations" until the worker runs reliably.

## AI opportunities (evaluated, not assumed)

| Idea | User problem | Data needed | Complexity / cost | Risk | Simpler alternative | Verdict |
|---|---|---|---|---|---|---|
| Draft vendor replies and quotation text | Vendors answer slowly or poorly | Inquiry text, vendor packages | Low; LLM call per draft | Wrong prices if not grounded in packages | Saved reply templates | Worth a P2 experiment for paid plans |
| Budget suggestion from guests, city, style | Hosts do not know realistic costs | Real booking prices — not available yet | Medium | Invented numbers | Static templates already exist | Not now; revisit with data |
| Guest list clean-up from pasted text | Names arrive as messy WhatsApp lists | Pasted text | Low | Mis-parsed names | CSV import (exists) | P2, cheap and useful |
| Vendor matching | Discovery | Bookings, reviews | Medium | Opaque ranking | Rule-based score (exists in `recommendations.ts`) | Not needed |
| Review moderation | Fake/abusive reviews | Review text | Low | False positives | Manual queue | P3 |

Privacy: guest names and phone numbers must not be sent to a model provider without a stated purpose in the privacy policy.
