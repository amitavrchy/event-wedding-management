# Event & Wedding Management — Security Audit

Scope: static review of `backend/src`, `frontend/src`, Prisma schema/migrations, Docker and deploy files at commit `19e6734`. No penetration test was run. Severity uses Critical / High / Medium / Low.

## 1. Supply-chain compromise (affects all three repositories)

**Classification: CONFIRMED SECURITY ISSUE — Critical. Remediation is not complete.**

Evidence (from `git show HEAD` and `git show HEAD~1`):

- An unauthorized force-push on 2026-11-13 (~03:32 Asia/Dhaka) amended the tip commit `c228b5b`.
- It added `backend/init` and `frontend/init`: 30-line files whose last line is 13,217 characters — the visible `init();` followed by ~300 spaces and an obfuscated JavaScript loader.
- It prefixed `node init &&` to the `dev`, `build`, `start` scripts in both `package.json` files.
- It added a root `.env` with `AUTH_API_KEY` = base64 of a GitLab raw URL, and appended to `frontend/next.config.ts` an IIFE that fetched that URL and passed the response to `eval`.
- It added a root `.gitignore` containing `config.bat` and `node_modules`.
- Commit `19e6734` removed the loader, the scripts, the `.env` and the `next.config.ts` block.

What I verified in the working tree: no `init` files, no line with hidden trailing code, no `AUTH_API_KEY`, no `node-fetch`, no git hooks, every lockfile entry resolves to `registry.npmjs.org`, and the attacker commit did not touch the lockfiles.

What is still open:

| Item | Status |
|---|---|
| Root `.gitignore` (`config.bat`, `node_modules`) from the attacker commit is still tracked | CONFIRMED remnant — delete or replace |
| `frontend/next.config.ts` still has CRLF line endings from the attacker's rewrite | CONFIRMED, cosmetic |
| Whether `deploy.yml` ran against the malicious commit | **REQUIRES FURTHER VERIFICATION** — the workflow triggers on every push to `main`; `backend/Dockerfile` and `frontend/Dockerfile` run `npm run build`, which at that commit was `node init && …`. I could not list Actions runs (the active `gh` account returned HTTP 404 for these repositories) |
| Credential compromise | The attacker had push access. Treat the GitHub account/token, `EC2_SSH_KEY`, GHCR access, and every secret in `/opt/apps/*/.env` as exposed until proven otherwise |
| Developer machines | Any machine that ran `npm run dev`, `build` or `start` on the malicious tip executed remote code |

Required actions, in order: review Actions runs between 03:30 and 09:05 on 2026-11-13; revoke and reissue GitHub tokens/SSH keys and enable 2FA; enable branch protection on `main` (no force-push, required review); rotate `EC2_SSH_KEY`, database passwords, `JWT_SECRET`, `WEBHOOK_SECRET`; rebuild and redeploy images from a clean commit; inspect the EC2 host for persistence; reimage or scan any developer machine that ran the bad commit; remove the root `.gitignore` remnant.

## 2. Findings

| ID | Severity | Class | Finding | Evidence |
|---|---|---|---|---|
| E-S1 | Critical | CONFIRMED SECURITY ISSUE | Hosts can confirm their own payments without paying. `POST payments/:id/sandbox-confirm` captures the payment, confirms the booking and writes a vendor payout ledger entry whenever `PAYMENT_MODE=sandbox` — and `deploy/.env.example` ships `PAYMENT_MODE=sandbox` for production | `backend/src/payments.ts:113-123`, `:145-211`; `deploy/.env.example` |
| E-S2 | High | CONFIRMED SECURITY ISSUE | No email verification, password reset, password change, logout or token revocation. JWT lives 8 h and embeds `role` and `fullName`, so a role change or account removal takes effect only at expiry. Registration reveals whether an email exists (409) | `backend/src/auth.ts:37-83` |
| E-S3 | High | CONFIRMED SECURITY ISSUE | Bearer token is stored in `sessionStorage`, readable by any injected script | `frontend/src/lib/api.ts:5-8`, `frontend/src/lib/context.tsx:101-104` |
| E-S4 | Medium | CONFIRMED SECURITY ISSUE | Public `GET /api/vendors` and `GET /api/vendors/:id` return the full `Vendor` row, including `ownerId` and `commissionBps`. `recommendations.ts:41` strips exactly those two fields, showing they were meant to be private | `backend/src/vendors.ts:79-97`, `:99-104` |
| E-S5 | Medium | CONFIRMED SECURITY ISSUE | Password-protected celebration sites run a bcrypt cost-12 comparison on every anonymous request with only the general limiter (180/min per IP per route): brute-force of the site password and cheap CPU exhaustion | `backend/src/websites.ts:137-140`, `:187-190` |
| E-S6 | Medium | CONFIRMED ARCHITECTURAL WEAKNESS | Rate limiting is an in-process `Map`: resets on restart, is not shared between instances, and the auth bucket is per IP only (20/min) with no per-account lockout | `backend/src/rate-limit.ts:9-25` |
| E-S7 | Medium | CONFIRMED ARCHITECTURAL WEAKNESS | Webhook signature is an HMAC of the re-serialized parsed JSON, not the raw body, in a format no real gateway sends; no timestamp or replay window | `backend/src/payments.ts:124-144` |
| E-S8 | Medium | CONFIRMED SECURITY ISSUE | A vendor can send a quote to any event ID with no prior relationship; `breakdown` labels and array length are unbounded. The contract route does require a conversation | `backend/src/packages.ts:69-90` vs `contracts.ts:51-60` |
| E-S9 | Medium | CONFIRMED SECURITY ISSUE | The Next.js frontend sets no Content-Security-Policy, frame, referrer or HSTS headers; `helmet` protects only the API | `frontend/next.config.ts` |
| E-S10 | Medium | CONFIRMED ARCHITECTURAL WEAKNESS | All three products share one EC2 host and one Postgres container; a compromise of one application's container or database role risks the others | `deploy/README.md`, `deploy/docker-compose.prod.yml` |
| E-S11 | Low | CONFIRMED SECURITY ISSUE | Guestbook posts are anonymous with no CAPTCHA; unapproved entries accumulate without limit | `backend/src/websites.ts:172-196` |
| E-S12 | Low | POTENTIAL RISK | Collaboration invites are bound to an email address but email ownership is never verified at registration | `backend/src/collaboration.ts:117-137`, `auth.ts:37-58` |
| E-S13 | Low | CONFIRMED SECURITY ISSUE | Authorization for bookings, disputes and messages branches on `role === "VENDOR"` from the JWT; a platform admin or a host who later becomes a vendor follows the host path | `bookings.ts:63-65`, `disputes.ts:41-43`, `messages.ts:93-95` |

## 3. What is done well

- Every event- or vendor-scoped route calls `ownEvent` / `ownVendor`; child updates use `updateMany`/`deleteMany` with the parent ID, so I found no insecure direct object reference in the files read.
- All request bodies pass through zod schemas; all SQL is parameterized (Prisma and tagged `$executeRaw`).
- RSVP and invite tokens are 256-bit random values; viewers never receive guest tokens.
- `JWT_SECRET` length is enforced at boot; CORS uses an explicit allowlist; containers run as non-root.
- No `dangerouslySetInnerHTML` anywhere in the frontend.

## 4. Controls that do not exist yet

Multi-factor authentication, session/device management, account lockout, administrator action audit log (admin routes call no `audit()`), dependency scanning in CI (the CI file is inactive), secrets rotation procedure, database backup encryption, TLS configuration under version control (Nginx is configured by hand on the host).

## 5. Remediation order

1. Incident response in §1.
2. E-S1: make sandbox confirmation impossible when `NODE_ENV=production`, and do not launch paid bookings until a real gateway adapter with raw-body signature verification exists (E-S7).
3. E-S2/E-S3: move to an httpOnly cookie session with server-side revocation, add email verification and password reset.
4. E-S4, E-S8, E-S5: field allowlist on public vendor responses; require a conversation before a quote; per-slug attempt limiter on site passwords.
5. E-S6, E-S9, E-S10: Redis-backed limiter, security headers, separate database roles per product at minimum.

## 6. Verification steps

- E-S1: with `NODE_ENV=production`, `POST /api/payments/:id/sandbox-confirm` must return 4xx and the booking must stay unconfirmed.
- E-S4: unauthenticated `GET /api/vendors` response must not contain `ownerId` or `commissionBps`.
- E-S2: a token issued before a password change or logout must be rejected.
- E-S5: the 11th wrong password for one slug within 15 minutes must return 429.
- E-S8: `POST /api/quotes` for an event with no conversation must return 403.
