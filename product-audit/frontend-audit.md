# Event & Wedding Management — Frontend Engineering Audit

Static review of `frontend/src` at commit `19e6734`. The application was **not run in a browser** during this audit (no database or Docker available locally), so visual and runtime behaviour is NOT VERIFIED; findings below come from source.

## 1. Structure

- Next.js 16 App Router. Route groups: public (`/`, `/login`, `/signup`, `/rsvp/[token]`, `/celebrate/[slug]`) and `(workspace)` with 24 pages wrapped by `components/shell.tsx`.
- Every workspace page is a client component. There is no server-side data fetching and no route middleware; access control in the UI is "if no user, render `AuthScreen`" (`shell.tsx`).
- Shared code: `lib/api.ts` (fetch wrapper), `lib/context.tsx` (session + events + vendors + toast), `lib/use-resource.ts` (`useResource`, `useAction`), `components/ui.tsx` (Button, Field, Empty …).

## 2. Authentication persistence

| Finding | Evidence | Class |
|---|---|---|
| Token and user are kept in `sessionStorage`. Opening a link in a new tab, or the collaborator invite link, starts logged out; closing the tab ends the session | `lib/api.ts:5-8`, `lib/context.tsx:41-50`, `:101-106` | CONFIRMED BUG (usability) / security issue E-S3 |
| On a 401 the token is removed and the user state reset, but the `utsab-user` entry stays in storage | `lib/api.ts:25-28` | Low |
| No forgot-password, change-password or email-verification screens exist | `components/auth-screen.tsx` | MISSING FEATURE |
| Socket connects with the token read once at creation | `lib/socket.ts:5-12` | OK (re-created on logout) |

## 3. State and data flow

**E-B13 — CONFIRMED ARCHITECTURAL WEAKNESS.** `Provider.refresh()` (`lib/context.tsx:60-81`) fetches `events`, then the public `vendors` list, then the full selected event. It runs on login, on event switch, after most mutations (pages call `refresh()`), and on every `booking:update` socket event. Consequences:

- A vendor account also downloads the host-oriented vendor marketplace on every refresh.
- The full event payload contains every guest, booking and expense; guest-heavy events re-download the whole list after each small edit.
- Pages that also use `useResource` fetch their own copy, so the same data is loaded twice (for example guests).

`useResource` and the context both guard against out-of-order responses with a generation counter — good.

## 4. Routing and navigation

| ID | Finding | Evidence |
|---|---|---|
| E-B14 | The sidebar shows the same nine host links to every role. Vendors see "Budget planner" and "Guest list"; admins see the full host menu. Vendor and admin links are appended, and `/admin` has no active state | `components/shell.tsx:28-38`, `:100-126` |
| E-F2 | Twelve pages (seating, run sheet, check-in, website, contracts, finance, collaboration, automations, inspiration, insights, shortlist, availability) are absent from the sidebar and are reached only through the Planning studio hub or the command menu | `components/shell.tsx:164-181` (breadcrumb map), `app/(workspace)/planning/page.tsx` |
| E-F3 | The notification bell has no unread indicator | `components/shell.tsx:187-193` |
| E-F4 | No route-level guard for role-specific pages; pages render an empty state after loading (`studio/page.tsx:46-47`) | — |

## 5. Forms and validation

- HTML validation attributes mirror the API in the auth form (`minLength`, `type="email"`).
- Money is entered in taka and converted with `Math.round(Number(x) * 100)` (`studio/page.tsx:58`, `:77`) — acceptable; no thousand-separator or Bangla-digit handling.
- Server validation messages are shown verbatim, including zod paths such as `guests.3.name: Too small` — **PRODUCT IMPROVEMENT**: map to friendly text.
- No `confirm(` call exists anywhere in `frontend/src`; destructive actions (remove collaborator, delete table, delete inspiration item, undo check-in) fire immediately — **CONFIRMED UX defect**; verify per page when fixing.

## 6. Loading, empty and error states

`app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx` exist. `useAction` centralises busy state and toast feedback. Toasts auto-dismiss after 4.5 s with `role="alert"`/`"status"`. Global API errors are shown in a banner in the shell. Per-page skeletons were not checked page by page — NOT VERIFIED.

## 7. Frontend ↔ backend match

All API paths used by the frontend (collected with a grep over `frontend/src`) exist in the backend. Capabilities the UI exposes that cannot complete as a user would expect:

| UI | Why it does not complete | Class |
|---|---|---|
| "Pay advance / balance" in Bookings and Finance | Calls `payments` then `payments/:id/sandbox-confirm`; there is no real gateway | FRONTEND + BACKEND SIMULATION |
| Vendor "Dispute" on a booking | Created, then invisible to the vendor (E-B1) | BROKEN |
| Guest list editing | Only table label can change; no edit/delete | PARTIALLY IMPLEMENTED |
| Vendor studio | Create-only: profile, services and blocks cannot be edited; quotes have one breakdown line (`studio/page.tsx:74-88`) | PARTIALLY IMPLEMENTED |
| Collaborator invite | Produces a link the host must send manually; no email is sent | PARTIALLY IMPLEMENTED |

Backend capabilities with no UI found by grep: `POST packages` (vendor package creation) — REQUIRES FURTHER VERIFICATION in `packages/page.tsx`.

## 8. Responsive design and accessibility (static indicators)

- Media queries: 7 in `globals.css`, 6 in `advanced.css`, 7 in `landing.css`, with breakpoints at 480, 600, 760, 1000, 1200/1250 px. Mobile menu and scrim exist in the shell.
- Playwright is configured for one desktop viewport (1440×1050) only (`playwright.config.ts`).
- `lang="en"` fixed; no Bangla strings, no locale switch.
- ARIA labels are present on icon buttons in the shell; the event switcher is a labelled `<select>`.
- Colour contrast, focus order and touch-target size: NOT VERIFIED (needs a running build).

## 9. Performance

- 9,347 lines of CSS load on every route (E-C10).
- `@zxing/browser` and `qrcode` are needed only on check-in and guest-pass screens; whether they are code-split was not measured — NOT VERIFIED (needs `next build` output).
- Landing images are five JPEGs under `public/images`; sizes not measured.

## 10. Recommendations

1. Cookie-based session (with the backend change) so tabs, refreshes and invite links keep the user signed in.
2. Split the context: session only. Fetch events, vendors and event detail where they are used; stop refetching vendors on booking events.
3. Role-specific navigation: host, vendor and admin menus; group the twelve hidden tools into visible sections.
4. Confirmation dialogs for destructive actions; friendly validation messages.
5. Split CSS per route group (landing vs workspace vs public RSVP/site).
6. Add mobile viewports to Playwright and run them in CI.
