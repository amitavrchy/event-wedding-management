# Event & Wedding Management — UI/UX Audit

**Method and limits.** This review is based on the page and component source in `frontend/src` and the stylesheets. The application was not rendered, so visual hierarchy, contrast, spacing and real device behaviour are NOT VERIFIED. Findings below are those that can be established from source: structure, navigation, flows, copy, states and responsiveness rules.

## 1. Summary

The product has a distinctive, warm visual language and consistent building blocks (`components/ui.tsx`, toasts, empty states, a command menu). The main usability problems are structural: one navigation for three very different audiences, important tools hidden from the menu, English-only copy written in a poetic voice that will not translate to task clarity for many Bangladeshi users, and create-only forms.

## 2. Navigation and information architecture

| Finding | Evidence | Recommendation |
|---|---|---|
| Hosts, vendors and admins share the same nine host links | `components/shell.tsx:28-38` | Three menus. Vendor: Leads, Messages, Quotes, Bookings, Calendar, Services, Team, Payouts, Insights, Subscription. Admin: Vendors, Categories, Disputes, Payouts, Subscriptions |
| Twelve tools are not in the sidebar (seating, run sheet, check-in, website, contracts, finance, collaboration, automations, inspiration, insights, shortlist, availability) | `shell.tsx:164-181` | Group visibly: **Plan** (Overview, Checklist, Timeline, Budget), **Guests** (List, Seating, Check-in, Website), **Vendors** (Find, Shortlist, Messages, Bookings, Contracts, Payments), **More** (Team, Automations, Inspiration, Insights) |
| "Packages & quotes" mixes vendor bundles with quotes received | `shell.tsx:36` | Move quotes next to Messages/Bookings |
| Labels use branded names: "Planning studio", "Control room", "Guest welcome", "Planning circle", "Inspiration atelier", "Workflows" | `shell.tsx:164-181` | Plain names: Tools, Day schedule, Check-in, Team, Ideas, Reminders |
| Notification bell has no count | `shell.tsx:187-193` | Unread badge |
| Event switcher is a native select inside the sidebar | `shell.tsx:66-84` | Keep, add "New event" as the last option |

## 3. Onboarding

- Sign-up asks name, email, password and role in one form (`components/auth-screen.tsx`). No phone number — the primary identifier for most Bangladeshi users — and no OTP.
- After sign-up a host with no events sees the shell with an empty selector; `new-event.tsx` provides occasion-aware creation with a starter plan, which is the strongest part of onboarding.
- A vendor lands on the host dashboard and must find "Vendor studio". There is no checklist such as "1. Business details → 2. Services → 3. Photos → 4. Availability → 5. Go live".
- Vendor application ends with a toast: "Application received. An administrator must activate your business." (`studio/page.tsx`) and no status screen.

**Recommendations:** phone-first sign-up with OTP; role chosen on the landing page and carried into a role-specific first screen; a vendor setup checklist with progress and a visible "Pending review" state.

## 4. Screen-by-screen recommendations

| Screen | Source | Observations | Recommendation |
|---|---|---|---|
| Dashboard | `dashboard/page.tsx` (277) | Overview, timeline, next steps | Lead with the three numbers that matter: days to go, budget remaining, RSVPs pending; one primary next action |
| Guests | `guests/page.tsx` (356) | Add, import, export, seat | Inline edit and delete; bulk select; "Copy invite link" and "Share on WhatsApp" per guest and in bulk; filters by RSVP status and group |
| Budget | `budget/page.tsx` (296) | Allocation + expenses | Edit/delete expenses; show paid vs due per vendor; amounts with thousands separators |
| Checklist | `checklist/page.tsx` (157) | Add and tick | Edit, delete, assign to collaborator, due-date grouping (overdue / this week / later) |
| Find vendors | `vendors/page.tsx` (140) + `booking-modal.tsx` (174) | Filter by category, price, date; modal with calendar and reviews | Dedicated vendor page with gallery, packages, map area, reviews; price range filter server-side; sort |
| Bookings | `bookings/page.tsx` (274) | Reservations, sandbox payment, review, dispute | Timeline per booking (held → advance → balance → completed); clear countdown for the 15-minute hold |
| Messages | `messages/page.tsx` (232) | Realtime chat | Unread markers, last message preview, attach image, quote card inside the thread |
| Vendor studio | `studio/page.tsx` (337) | Tabbed create forms | Split into Profile, Services, Calendar, Quotes pages with lists and edit |
| Business suite | `business/page.tsx` (343) | Lead pipeline | Create a lead automatically from each new conversation |
| Seating | `seating/page.tsx` (370) | Drag layout | On phones offer a list view (table → guests) instead of a canvas |
| Check-in | `check-in/page.tsx` (295) | QR scan | Manual search fallback by name/phone prominently; works on poor connectivity |
| Admin | `admin/page.tsx` (242) | Vendors, ledger, disputes on one page | Separate tabs with search and pagination |
| Public RSVP | `rsvp/[token]/page.tsx` (210) | Per-day responses, meal | Bangla by default with English toggle; large buttons; confirmation screen with "Add to calendar" and venue map |

## 5. Missing screens

Forgot password; email/phone verification; profile and account settings; vendor public profile page (shareable URL); vendor subscription and billing; vendor verification status; notifications preferences; help/contact; terms, privacy and refund policy; admin user management; admin subscription management.

## 6. Forms, tables, dialogs, states

- Forms: consistent `Field` wrapper and native validation. Server messages are raw zod output. Add helper text for money (BDT), dates (Dhaka time) and phone format.
- Tables: lists are rendered in full; no pagination or sticky headers in source for long guest lists.
- Dialogs: no confirmation step for destructive actions (no `confirm` or confirm component usage found).
- Empty states: an `Empty` component is used across pages — good. Make each empty state offer the next action.
- Loading: `loading.tsx` and busy buttons exist. Per-list skeletons NOT VERIFIED.
- Errors: banner + toast. Toasts disappear after 4.5 s; errors should persist until dismissed.

## 7. Bangladesh-specific usability

| Need | Current state | Recommendation |
|---|---|---|
| Bangla | `lang="en"`, no translations | i18n with Bangla as the default for the public RSVP/site pages and selectable in the workspace; Bangla numerals optional |
| Mobile-first | Responsive rules exist (7 + 6 + 7 media queries); desktop-only test viewport | Design and test at 360×800 first; bottom navigation for the four most used host screens |
| Low bandwidth | 9,347 lines of CSS on every page; full-event payloads | Route-level CSS, paginated data, compressed images, skeletons |
| Low-end Android | Canvas-style seating, camera QR | Provide list alternatives |
| Sharing habits | Invitations are links to copy | WhatsApp/Messenger share buttons; SMS invitation as a paid add-on |
| Money | Minor units internally; display helpers in `lib/format.ts` | `৳ 1,50,000` (Indian grouping) consistently |
| Local event structure | Templates already include holud/wedding/reception days | Keep; add akdh, mehendi, bou-bhat as optional days |

## 8. Accessibility checklist

| Item | Status |
|---|---|
| `lang` attribute | Present (`en`); must switch with locale |
| Labels on inputs | Present via `Field` (static) |
| Icon-only buttons have `aria-label` | Present in the shell (static) |
| Toast roles | `alert` / `status` present |
| Keyboard access to drag-and-drop (seating, lead pipeline) | Claimed in `docs/ADVANCED_SCOPE.md`; NOT VERIFIED |
| Focus trap and Escape in modals | NOT VERIFIED |
| Colour contrast AA | NOT VERIFIED |
| Reduced motion | Media query present |
| Touch targets ≥ 44 px | NOT VERIFIED |
| Automated axe scan | Not present in this repository's Playwright specs |

## 9. Design system recommendations

Extract the tokens already implied in `globals.css` (colour, spacing, radius, type scale) into CSS variables in one file; define ten core components (Button, Field, Select, Dialog, ConfirmDialog, Table with pagination, Tabs, Badge, EmptyState, Toast); remove page-specific one-off classes from the two 3,000-line stylesheets as pages are touched. The same token and component set can be shared with the other two products (see `../03-shared-architecture-opportunities.md`).

## 10. Implementation-ready UI/UX fixing prompt

```text
You are improving the UI/UX of the Utsab Next.js frontend (frontend/src). Do not change API contracts unless a task says so. Keep existing visual style. Work in small PRs, one task each, and run `npx tsc --noEmit` and Playwright after each.

1. Navigation (components/shell.tsx): build three menus selected by user.role — HOST, VENDOR, PLATFORM_ADMIN. Host menu grouped as Plan / Guests / Vendors / More and containing every existing workspace route. Use plain labels. Add active state to all links and an unread badge on the bell (count of notifications with read=false).
2. Add a reusable ConfirmDialog in components/ui.tsx and use it for every DELETE call in app/(workspace)/**.
3. Guests page: inline edit and delete (requires new PATCH/DELETE endpoints), status and group filters, "Copy invite link" and WhatsApp share (https://wa.me/?text=) per guest.
4. Checklist and budget: edit and delete for tasks and expenses (requires endpoints).
5. Vendor studio: split into Profile, Services, Calendar, Quotes with list + edit forms; add a setup checklist and an application status card.
6. Map server validation errors to friendly messages in lib/api.ts (field label + reason).
7. Add i18n scaffolding (next-intl or a small dictionary): English and Bangla; translate the public RSVP and celebration pages first; set <html lang> from the active locale.
8. Split CSS: load landing.css only on "/", advanced.css only in (workspace), and a small public.css for rsvp/celebrate.
9. Add Playwright projects for Pixel 5 and a 360x800 viewport and make the existing specs pass on them.
Acceptance: every workspace route reachable from the menu for its role; no destructive action without confirmation; RSVP page fully usable in Bangla at 360 px width; Lighthouse mobile performance for /rsvp/[token] ≥ 85 on a throttled 4G profile.
```
