# Event & Wedding Management — Monetization Strategy

All prices are **hypotheses in BDT** to be tested with real vendors. Nothing here is a forecast of income.

## 1. Readiness of the billing system

| Requirement | Status in code |
|---|---|
| Plan management | NOT IMPLEMENTED |
| Feature entitlements | NOT IMPLEMENTED |
| Trial periods | NOT IMPLEMENTED |
| Monthly / annual billing | NOT IMPLEMENTED |
| Activation, renewal, grace, cancellation | NOT IMPLEMENTED |
| Invoices / receipts for subscriptions | NOT IMPLEMENTED |
| Payment audit log | Partial: `LedgerEntry` and `Activity` exist for booking payments only |
| Webhook verification | Generic HMAC stub (`payments.ts:124-144`), not gateway-compatible |
| Idempotent payment handling | Implemented for booking payments (`Payment.idempotencyKey`) — reusable pattern |

Monetization readiness score: see `launch-readiness.md`.

## 2. Recommended model

**Primary: vendor subscriptions. Secondary: featured placement. Later: qualified-lead fees. Not at launch: booking commission.**

Reasoning from the code and from the market research in this session:

- Commission requires the platform to collect customer money. No gateway is integrated and settlement/refund operations do not exist.
- Recurring auto-debit is not something to assume: third-party documentation describes bKash "tokenized checkout" agreements that allow repeat charges, but this was not confirmed from bKash's own merchant documentation in this session, and public sources disagree on whether SSLCommerz supports recurring billing. Design for **prepaid periods with renewal reminders**, and treat auto-renewal as an enhancement after a merchant agreement confirms it.
- The school ERP repository already contains a working manual-review subscription flow (plan → bKash/Nagad/bank reference → admin approval → activation → receipt). The same design can be ported (see `../03-shared-architecture-opportunities.md`).

## 3. Plan hypotheses

| Plan | Monthly (BDT) | Annual (BDT) | Entitlements (proposed) |
|---|---:|---:|---|
| Free listing | 0 | 0 | Profile, 1 category, 5 photos, receive inquiries, 3 quotation replies per month |
| Basic | 500 | 5,000 | 20 photos, unlimited replies, 3 packages, calendar, "Verified" badge after document check |
| Professional | 1,500 | 15,000 | 60 photos + video links, unlimited packages, lead CRM, quotation PDFs, team members, analytics, priority in default ranking tie-breaks |
| Premium | 3,500 | 35,000 | Everything, plus one featured slot in one category/area, storefront customisation, priority support |

What must be validated with at least 20–30 vendor conversations before publishing prices:

- Whether small vendors (solo photographers, makeup artists) will pay anything monthly outside the season — a **seasonal pass** (for example 4 months) may fit better than 12 monthly charges.
- Whether venues, whose booking values are far higher, accept a higher tier (BDT 5,000–10,000 per month).
- Whether vendors value leads more than tools (then price per qualified lead instead).

## 4. Additional revenue lines

| Line | Mechanism | When | Risk |
|---|---|---|---|
| Featured listing | Fixed weekly/monthly fee per category + area slot, labelled Sponsored | After there is measurable traffic | Erodes trust if overused |
| Qualified lead fee | Small fee per inquiry meeting criteria (date, budget, phone verified) | When inquiry volume is steady | Disputes over lead quality; needs refund rule |
| Vendor CRM / quotation tools | Included in Professional | Launch | — |
| Premium storefront | Custom URL, theme, gallery sections | Later | Low demand risk |
| SMS invitations for hosts | Per-SMS margin on a prepaid bundle | After SMS integration | Vendor price lists found in this session show roughly BDT 0.15–0.60 per SMS depending on type and volume; margin is thin |
| Booking commission | Percentage of on-platform payments | Only after gateway + settlement + legal review | Operational and regulatory load |

## 5. Payment collection for subscriptions

| Option | Fit |
|---|---|
| Manual: vendor pays to a merchant bKash/Nagad number or bank, submits transaction ID, admin approves | Works immediately; port from the ERP codebase; labour grows with volume |
| Hosted checkout through an aggregator (for example SSLCommerz) for one-off period purchases | Third-party pages found in this session quote around 2–2.5 % per transaction; get a written rate card and confirm onboarding requirements (trade licence, bank account) |
| Direct bKash/Nagad merchant APIs | Useful later for lower fees and possible agreement-based repeat payments; confirm with each provider |

Required rules regardless of option: unique transaction reference; exact-amount check; idempotent activation; receipt PDF; renewal reminders at 7 days, 1 day and on expiry; 7-day grace before the listing drops to Free; downgrade keeps data.

## 6. Revenue scenarios (illustrative arithmetic, not predictions)

Assumptions stated per row; average revenue per paying vendor (ARPV) is a blend of plans.

| Scenario | Paying vendors | ARPV / month | MRR | ARR | Assumed monthly churn |
|---|---:|---:|---:|---:|---:|
| Conservative | 30 | 700 | 21,000 | 252,000 | 8 % |
| Base | 150 | 900 | 135,000 | 1,620,000 | 5 % |
| Optimistic | 500 | 1,100 | 550,000 | 6,600,000 | 4 % |

Costs to set against these (estimates): infrastructure BDT 6,000–25,000 per month depending on stage (`../04-infrastructure-cost-analysis.md`); gateway fees ~2–2.5 % of collected amounts if a gateway is used; SMS/email at cost; one support/onboarding person during season (BDT 25,000–40,000 per month); vendor acquisition time. At the conservative row the product does not cover one salary; the marketplace needs the base row to be self-sustaining.

## 7. Unit economics to measure after launch

| Metric | Definition | How to capture |
|---|---|---|
| CAC (vendor) | Sales + marketing spend ÷ new paying vendors | Tag acquisition source at application |
| ARPV | Subscription revenue ÷ paying vendors | Subscription payments table |
| Gross margin | (Revenue − hosting − gateway − SMS) ÷ revenue | Monthly |
| Logo churn | Vendors not renewing ÷ vendors due | Renewal events |
| Payback | CAC ÷ (ARPV × margin) | Derived |
| Inquiries per paying vendor | Count per month | Conversations/leads |

The last metric is the leading indicator: vendors renew when inquiries arrive.

## 8. Implementation outline

1. Models: `Plan`, `VendorSubscription` (status, period start/end), `SubscriptionPayment` (method, reference unique, amount, status, reviewer), `SubscriptionEvent`.
2. Entitlement helper used by vendor routes (photo count, package count, reply quota, CRM access).
3. Vendor screens: Plans, Pay / submit reference, Billing history, Receipt download.
4. Admin screens: pending payments review, grant/extend, suspend.
5. Jobs: expiry → grace → downgrade; reminders.
6. Tests: activation idempotency, duplicate reference, amount mismatch, downgrade preserves data.
