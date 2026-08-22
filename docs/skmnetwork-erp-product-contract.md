# SKMNetwork ERP — Product Contract

Status: DRAFT (pre-implementation business specification)
Scope: Defines the business/entitlement contract for **SKMNetwork ERP** before any
billing, entitlement, subscription, auth, or ERP-UI implementation.
Out of scope (must NOT be implemented in this phase): database, backend, billing,
auth, ERP UI, landing source, nginx, docker-compose, CI/CD.

Legend: **[DECIDED]** firm rule · **[ASSUMED]** reasonable default pending owner
confirmation · **[NEEDS DECISION]** requires business owner sign-off.

---

## A. Customer eligibility

- **INCLUDED eligibility is package-based.** `[DECIDED]`
  A SKMNetwork Internet customer becomes eligible for INCLUDED ERP when their
  active Internet subscription is on a package flagged `includes_erp = true`.
  Eligibility is derived from the Internet service/package, not granted manually.
- **One customer may own multiple businesses.** `[ASSUMED]`
  The ERP already supports multi-business / multi-tenant. We assume a customer
  account can own several businesses, each mapped to its own ERP tenant.
- **One Internet customer may hold multiple ERP tenants.** `[ASSUMED]`
  Each business = one ERP tenant; an Internet customer may therefore have several
  INCLUDED tenants, one per eligible business.
- **Which businesses are covered by INCLUDED** (all vs. one) is `[NEEDS DECISION]`.
  Recommended default `[ASSUMED]`: INCLUDED covers all businesses owned by the
  customer while the qualifying Internet subscription is active.
- Non-Internet customers are never INCLUDED-eligible. `[DECIDED]`

## B. INCLUDED lifecycle

- **Activation:** ERP entitlement is auto-provisioned when (a) the Internet
  subscription is `active` AND (b) the package `includes_erp = true`. `[DECIDED]`
- **Internet suspended:** the derived INCLUDED entitlement is suspended.
  `[DECIDED]` (mirrors the invariant "no active entitlement → no ERP access").
  Whether ERP stays available briefly during a grace window is `[NEEDS DECISION]`
  (recommended: suspend after the Internet grace period, not instantly).
- **Internet terminated:** INCLUDED entitlement ends immediately. `[DECIDED]`
- **Billing grace period:** while the Internet subscription is in grace (not yet
  terminated), INCLUDED ERP may remain usable. `[ASSUMED]` Exact grace duration
  `[NEEDS DECISION]`.
- **Can ERP remain available temporarily after Internet suspension?**
  `[NEEDS DECISION]` — policy choice (commercial retention vs. strict enforcement).

## C. STANDALONE lifecycle

Conceptual states (no implementation): `[DECIDED]`

1. **Activation** — entitlement created on STANDALONE subscription start.
2. **Trial** (optional) — `[NEEDS DECISION]` whether a trial exists, its length,
   and feature limits.
3. **Active** — full ERP access for the subscribed business/tenant.
4. **Suspended** — payment/default; access blocked but data retained.
5. **Expired** — subscription end date passed without renewal; read-only or
   locked `[NEEDS DECISION]`.
6. **Cancelled** — terminated by customer; data retention policy `[NEEDS DECISION]`.

STANDALONE does **not** depend on any Internet subscription. `[DECIDED]`

## D. Entitlement model (conceptual fields only)

No DB schema is mandated here. A conceptual entitlement record contains:

| Field | Meaning |
|---|---|
| `entitlement_id` | unique id of the access grant |
| `customer_id` | owning SKMNetwork customer |
| `access_type` | `INCLUDED` \| `STANDALONE` |
| `eligibility_source` | `internet_subscription_id` (INCLUDED) \| `direct` (STANDALONE) |
| `business_id` / `tenant_id` | the ERP business this grant unlocks |
| `package_id` | source Internet package, when `INCLUDED` |
| `status` | `active` \| `suspended` \| `expired` \| `cancelled` |
| `starts_at` | grant effective time |
| `ends_at` | grant expiry (null = open for INCLUDED while eligible) |
| `created_at` | audit timestamp |

## E. Tenant / business relationship

`[ASSUMED]` (aligned with existing ERP multi-tenant capability):

- one **customer** → many **businesses**
- one **business** → one **ERP tenant**
- one **business** → many **users**
- one **business** → many **outlets**

One entitlement maps to **one business/tenant**. `[DECIDED]` (see Invariant I.4)
Multiple businesses ⇒ multiple entitlements.

## F. Billing relationship (conceptual)

```
Internet billing (active, includes_erp package)
        │  derives
        ▼
INCLUDED ERP eligibility  ──►  ERP entitlement (access_type = INCLUDED)

ERP billing (direct subscription)
        │  creates
        ▼
STANDALONE entitlement    ──►  ERP entitlement (access_type = STANDALONE)
```

No payment or invoice logic is defined here. `[DECIDED]` that the two streams are
independent: INCLUDED is a benefit of Internet billing; STANDALONE is its own
billing line.

## G. Upgrade possibilities (conceptual)

- **INCLUDED → STANDALONE:** convert the same tenant; `access_type` flips to
  `STANDALONE`, ERP billing begins, `eligibility_source` becomes `direct`.
  `[DECIDED]` as a supported path.
- **INCLUDED → paid upgrade:** treated as the INCLUDED→STANDALONE conversion;
  whether any intermediate "paid INCLUDED" tier exists is `[NEEDS DECISION]`.
- **STANDALONE → higher plan:** supported conceptually; plan names and prices
  are **not** defined in this contract. `[NEEDS DECISION]`
- Downgrades/proration are explicitly out of scope for this phase. `[DECIDED]`

## H. Access denial behavior (UX contract)

| Condition | User should see |
|---|---|
| Internet service inactive (INCLUDED) | "SKMNetwork ERP is included with your Internet service. Resume your Internet subscription to continue." + link to SKMNetwork contact/support. |
| STANDALONE subscription expired | "Your ERP subscription has expired." + clear renewal path to `erp.skmnetwork.com`. |
| Tenant suspended | "This business account is suspended." + contact support. |
| Unauthorized user | "You do not have access to this business." No data exposure. |

All denial states must resolve through the entitlement record (never implicit).
`[DECIDED]`

## I. Business invariants

1. **No active entitlement → no ERP access.** `[DECIDED]`
2. **STANDALONE ERP does not require an Internet subscription.** `[DECIDED]`
3. **INCLUDED eligibility derives from Internet service/package.** `[DECIDED]`
4. **One entitlement maps to one business/tenant.** `[DECIDED]` (chosen model).
5. **Every ERP session resolves an entitlement**; absence or non-`active`
   status ⇒ denial per section H. `[DECIDED]`
6. INCLUDED and STANDALONE are mutually consistent: a tenant may originate from
   either stream but is always represented by one entitlement record. `[DECIDED]`

## J. Decisions requiring owner approval

### DECIDED
- INCLUDED is package-based and derived from Internet service.
- Standalone ERP requires no Internet subscription.
- One entitlement = one business/tenant; multi-business = multiple entitlements.
- Lifecycle states for INCLUDED and STANDALONE as defined in B/C.
- Invariants I.1–I.6.

### ASSUMED (defaults, confirm)
- Customer may own multiple businesses; each = one ERP tenant.
- INCLUDED covers all businesses owned by the customer while eligible.
- ERP remains usable during the Internet billing grace period.
- Existing ERP multi-tenant/outlet model is reused as-is.

### NEEDS BUSINESS DECISION
1. Exact Internet packages flagged `includes_erp` (package list/policy).
2. Grace period length for INCLUDED when Internet is suspended.
3. Whether INCLUDED ERP stays available temporarily after Internet suspension
   (retention vs. strict suspend).
4. Whether INCLUDED covers all owned businesses or only one.
5. Existence, length, and limits of any STANDALONE trial.
6. STANDALONE plan tiers, pricing, and upgrade/downgrade rules.
7. Data retention policy on STANDALONE expiry/cancellation.
8. Whether an intermediate "paid INCLUDED" tier exists.

---
*No code, schema, or infrastructure was created. This document is the business
contract only.*
