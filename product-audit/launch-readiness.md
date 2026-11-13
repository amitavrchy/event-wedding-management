# Event & Wedding Management — Launch Readiness

## Scoring method

Each category starts from what the source demonstrably contains and loses points for confirmed defects in proportion to their severity for a paid product. Scores are judgements anchored to cited evidence, not measurements. Bands: 0–20 absent, 21–40 major gaps, 41–60 workable with significant defects, 61–80 solid with known gaps, 81–100 production grade. Where no runtime evidence could be gathered the category is marked NOT ASSESSED, with a static-risk note.

## Scores

| Category | Score | Evidence |
|---|---:|---|
| Code Quality | 55 | Type-checks clean (executed); consistent style and validation; no service layer, duplicated predicates, magic numbers, inactive CI, broken `verify.mjs` (`code-audit.md`) |
| Backend Architecture | 45 | Single module, logic in 34 controllers; sound reservation/payment transaction design; in-process state blocks scaling (`backend-audit.md`) |
| Frontend Architecture | 45 | Coherent hooks and components; global refetching context, `sessionStorage` session, one menu for three roles, 9k lines global CSS (`frontend-audit.md`) |
| Database Design | 40 | Good integrity constraints on bookings/money; ~30 references without foreign keys; ~20 missing indexes; string statuses (`database-audit.md`) |
| Security | 30 | Good authorization coverage and validation; unresolved repository compromise; self-confirmable payments; no reset/verification/revocation; public field leak (`security-audit.md`) |
| Functional Completeness | 45 | Wide planning feature set; create-only CRUD; no uploads, notifications or real payments; vendor subscription absent (`feature-inventory.md`) |
| UI/UX | 50 (static only) | Consistent components and states; navigation, hidden tools, English-only, no confirmations (`ui-ux-audit.md`). Rendering NOT VERIFIED |
| Performance | NOT ASSESSED | No load test. Static risk: unpaginated marketplace query on every refresh, N+1 jobs (`performance-scalability.md`) |
| Scalability | 35 | In-memory limiter and socket state; in-process worker; no pooling plan; nothing prevents a single-instance launch |
| Reliability | 25 | Health check and restart policy exist; no backups, monitoring, staging, tests in pipeline; migrate-after-start (`reliability-review.md`) |
| Testing Maturity | 40 | Unit tests pass (7/7 executed); meaningful DB integration and browser tests exist but are not run anywhere automatically |
| Monetization Readiness | 5 | The intended revenue model has no implementation; the implemented one runs on simulated money |
| Production Readiness | 20 | Containers and deploy script exist; sandbox payment mode, no Redis, IP-based hostname, shared host, open incident |

## Classification

**NOT READY** for commercial launch. **READY FOR INTERNAL TESTING** of the planning tools once the security incident is closed.

## Blockers

1. Repository/CI compromise not fully closed (credential rotation and pipeline review outstanding).
2. No vendor subscription system — there is nothing to sell.
3. Payments are simulated and enabled in the production configuration template.
4. No account recovery, verification or logout.
5. No outbound notifications; vendors will not know about inquiries.
6. No image upload or profile editing for vendors.
7. Basic data correction missing (guests, tasks, expenses, services).
8. No backups or monitoring; deploy has no test gate.
9. Background jobs do not run in the documented production configuration.

## Path to each next level

| Level | Requirements |
|---|---|
| Internal testing | Blocker 1 closed; staging environment with Redis; CI active |
| Controlled beta (free, invited hosts and 20–30 vendors) | Blockers 3, 4, 5, 7, 8, 9 closed; vendor edit + upload; pagination; role navigation |
| Limited commercial launch (one city, three categories) | Subscription system live with manual review; verification workflow; legal pages; real domain; restore drill done; Bangla public pages |
| Broader rollout | Load test passed at target; gateway checkout; moderation tooling; support process |

## Estimated effort to limited commercial launch

Roughly 10–14 engineer-weeks for Roadmap 1 in `product-roadmap.md`, excluding vendor acquisition work, legal text and merchant-account lead time. This is an estimate from the backlog, not a commitment.
