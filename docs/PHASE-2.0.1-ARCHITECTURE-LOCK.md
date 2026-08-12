# PHASE 2.0.1 — ARCHITECTURE LOCK

**Status:** APPROVED / LOCKED
**Git baseline:** 500ac99 `feat(mobile): Phase 1B - Local Database Foundation`
**Scope:** Phase 2 domain architecture decisions + Schema V2 design
**Authority:** This document is the binding contract for all Phase 2 implementation.

---

## 1. LOCKED DECISIONS (D1–D8)

| ID     | Decision                                      | Detail                                                                                           | Rationale                                                                                       |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **D1** | Server Master + Local Encrypted Catalog Cache | Products originate from server. Local DB is encrypted cache. Server is source of truth.          | Prevents multi-device catalog conflicts. Enables offline operation via cached data.             |
| **D2** | DB-backed Persistent Cart                     | Cart stored in encrypted local DB. Survives app crash/restart. Cart ≠ Sale.                      | Prevents data loss on crash. Clear separation between shopping state and financial transaction. |
| **D3** | Flat Tax + Simple Deterministic Rules         | Tax in basis points (INTEGER). Discount as percentage or fixed amount. No rules engine.          | Financial precision. No floating point. Deterministic and testable.                             |
| **D4** | Sequential Receipt per Branch per Day         | Format: `[BRANCH_ID]-[YYYYMMDD]-[SEQUENCE]`. Atomic UPSERT in DB.                                | Daily reconciliation. No duplicate receipt numbers.                                             |
| **D5** | Single Payment per Sale                       | One payment method per transaction. Split payment deferred.                                      | Reduces complexity. Avoids partial payment, ordering, and refund edge cases.                    |
| **D6** | Inventory DEFERRED                            | No stock tracking in Phase 2. Deferred to Phase 3+ (after Sync Engine).                          | Local inventory without sync engine risks global overselling.                                   |
| **D7** | Offline Credit DISABLED                       | No HUTANG, PIUTANG, CREDIT, or BELUM BAYAR in offline mode. Only CASH and TRANSFER (UNVERIFIED). | Prevents uncontrolled accounts receivable. Financial risk mitigation.                           |
| **D8** | Automatic Cash Change                         | `change = cash_received - grand_total`. Reject if `cash < total`. All INTEGER.                   | Standard POS behavior. Prevents negative change.                                                |

---

## 2. SCHEMA V2 — COMPLETE DESIGN

### 2.1 New Tables (5)

#### Table: `products_local`

| Column           | Type    | Constraints          | Purpose                                                 |
| ---------------- | ------- | -------------------- | ------------------------------------------------------- |
| `id`             | TEXT    | PRIMARY KEY          | Server-generated product UUID (see ASSUMPTION-PROD-001) |
| `business_id`    | TEXT    | NOT NULL             | Business isolation                                      |
| `name`           | TEXT    | NOT NULL             | Product display name                                    |
| `description`    | TEXT    | NULLABLE             | Optional description                                    |
| `price_minor`    | INTEGER | NOT NULL, CHECK >= 0 | Price in minor units                                    |
| `category`       | TEXT    | NULLABLE             | Product category                                        |
| `is_active`      | INTEGER | NOT NULL, DEFAULT 1  | Soft delete flag (1=active, 0=inactive)                 |
| `server_version` | INTEGER | NOT NULL, DEFAULT 0  | Sync version tracking (Phase 3)                         |
| `last_synced_at` | INTEGER | NULLABLE             | Last sync timestamp (epoch ms)                          |

**Soft Delete Policy (LOCKED):**

> Products are NEVER physically deleted from `products_local`.
> When the server deactivates a product, the sync engine sets `is_active = 0`.
> Historical transactions and cart items may still reference inactive products.
> Product browsing/search MUST filter by `is_active = 1`.

---

#### Table: `receipt_sequences_local`

| Column          | Type    | Constraints         | Purpose                              |
| --------------- | ------- | ------------------- | ------------------------------------ |
| `id`            | TEXT    | PRIMARY KEY         | UUID                                 |
| `business_id`   | TEXT    | NOT NULL            | Business isolation                   |
| `branch_id`     | TEXT    | NOT NULL            | Branch identification                |
| `sequence_date` | TEXT    | NOT NULL            | Format: YYYYMMDD (business timezone) |
| `last_sequence` | INTEGER | NOT NULL, DEFAULT 0 | Last used sequence number            |
| `updated_at`    | INTEGER | NOT NULL            | Epoch milliseconds                   |

**UNIQUE constraint:** `(business_id, branch_id, sequence_date)`

**Atomic UPSERT Mechanism (LOCKED):**

```sql
INSERT INTO receipt_sequences_local
  (id, business_id, branch_id, sequence_date, last_sequence, updated_at)
VALUES (?, ?, ?, ?, 1, ?)
ON CONFLICT(business_id, branch_id, sequence_date)
DO UPDATE SET
  last_sequence = last_sequence + 1,
  updated_at = excluded.updated_at
RETURNING last_sequence;

This operation MUST execute within a Drift transaction() together with the checkout inserts. It MUST NOT use SELECT MAX + 1.
Table: cart_local
Column
Type
Constraints
Purpose
id
TEXT
PRIMARY KEY
UUID
business_id
TEXT
NOT NULL
Business isolation
status
TEXT
NOT NULL, CHECK IN list
Cart lifecycle status
created_at
INTEGER
NOT NULL
Epoch milliseconds
updated_at
INTEGER
NOT NULL
Epoch milliseconds
Status values: ACTIVE, CHECKED_OUT, ABANDONED
One Active Cart Enforcement (LOCKED):
Partial unique index:

CREATE UNIQUE INDEX idx_one_active_cart_per_business
ON cart_local(business_id)
WHERE status = 'ACTIVE';

This guarantees at the database level that only ONE cart per business can be ACTIVE at any time.
Application-level guard (defense-in-depth):
Before creating a new active cart, the service layer MUST check for existing active carts within the same transaction and throw ActiveCartAlreadyExistsException if one exists.
Table: cart_items_local
Column
Type
Constraints
Purpose
id
TEXT
PRIMARY KEY
UUID
cart_id
TEXT
NOT NULL, FK → cart_local.id
Parent cart
product_id
TEXT
NOT NULL, FK → products_local.id
Product reference
quantity
INTEGER
NOT NULL, CHECK >= 1
Item quantity
unit_price_minor
INTEGER
NOT NULL, CHECK >= 0
Frozen price snapshot
added_at
INTEGER
NOT NULL
Epoch milliseconds
updated_at
INTEGER
NOT NULL
Epoch milliseconds
Price Snapshot Policy (LOCKED):
unit_price_minor is the price at the moment the item was added to the cart.
This value is FROZEN and does NOT change when the product catalog is refreshed.
If the server changes a product's price, existing cart items retain their original price.
To get the new price, the cashier must remove the item and re-add it.
Checkout ALWAYS uses the price stored in cart_items_local, never the current catalog price.
Table: business_settings_local
Column
Type
Constraints
Purpose
id
TEXT
PRIMARY KEY
UUID
business_id
TEXT
NOT NULL
Business isolation
branch_id
TEXT
NOT NULL, DEFAULT '__BUSINESS__'
Branch or business-level sentinel
tax_rate_bps
INTEGER
NOT NULL, DEFAULT 0
Tax rate in basis points
currency_code
TEXT
NOT NULL, DEFAULT 'IDR'
ISO currency code
currency_minor_units
INTEGER
NOT NULL, DEFAULT 0
Currency decimal places
timezone
TEXT
NOT NULL, DEFAULT 'Asia/Jakarta'
IANA timezone for receipt dates
updated_at
INTEGER
NOT NULL
Epoch milliseconds
UNIQUE constraint: (business_id, branch_id)
Reserved Sentinel Value (LOCKED):
The string "__BUSINESS__" is a RESERVED sentinel value.
It represents business-level settings (applies to all branches).
A real branch_id MUST NEVER equal "__BUSINESS__".
The server MUST guarantee that no branch UUID can equal this string.
Tax Resolution Order:

1. Look up settings WHERE business_id = ? AND branch_id = <actual_branch_id>
2. If not found, fall back WHERE business_id = ? AND branch_id = '__BUSINESS__'
3. If neither found, use defaults: tax_rate_bps = 0, currency = 'IDR'

Basis Points Calculation (INTEGER only, no floating point):

tax_minor = (subtotal_minor * tax_rate_bps) / 10000

Example:
  subtotal_minor = 100000  (Rp 100.000)
  tax_rate_bps   = 1100    (11%)
  tax_minor      = (100000 * 1100) / 10000 = 11000  (Rp 11.000)

  2.2 Modified Existing Tables (2)
sales_local — Add 3 columns
Column
Type
Constraints
Purpose
receipt_number
TEXT
NULLABLE
Full formatted receipt: B01-20260812-0001
receipt_sequence
INTEGER
NULLABLE
Sequence number for that day
receipt_date
TEXT
NULLABLE
Date portion: 20260812 (business timezone)
Note: branch_id already exists on sales_local from Phase 1B.

payments_local — Add 1 column
Column
Type
Constraints
Purpose
change_minor
INTEGER
NULLABLE, CHECK >= 0
Change given for cash payments
2.3 Migration Summary (v1 → v2)
Action
Object
Type
CREATE TABLE
products_local
New
CREATE TABLE
receipt_sequences_local
New
CREATE TABLE
cart_local
New
CREATE TABLE
cart_items_local
New
CREATE TABLE
business_settings_local
New
CREATE UNIQUE INDEX
idx_one_active_cart_per_business
Partial unique
ADD COLUMN
sales_local.receipt_number
Alter
ADD COLUMN
sales_local.receipt_sequence
Alter
ADD COLUMN
sales_local.receipt_date
Alter
ADD COLUMN
payments_local.change_minor
Alter
Total: 5 new tables + 4 new columns + 1 partial unique index
All additive. No destructive operations. All v1 data preserved.
3. RECEIPT DATE TIMEZONE RULE (LOCKED)
The receipt_date field MUST be derived from the business-configured timezone stored in business_settings_local.timezone.
The device-local timezone MUST NEVER be used for receipt date calculation.
Receipt sequence resets at midnight business timezone, not device midnight.
Example:

business_settings.timezone = 'Asia/Jakarta' (UTC+7)
device timezone            = 'America/New_York' (UTC-5)
UTC time                   = 2026-08-12 20:00:00

Jakarta time               = 2026-08-13 03:00:00
receipt_date               = '20260813'  ← Jakarta, NOT New York

Implementation constraint:
Receipt generation MUST NOT proceed until the timezone source is explicitly defined and stored in business_settings_local.
4. SERVER CONTRACT ASSUMPTIONS
ASSUMPTION-PROD-001 (BLOCKING)
products_local.id is a server-generated globally unique UUID.
The server product API MUST guarantee:
Every product has a globally unique UUID assigned by the server
This UUID never changes once assigned
This UUID is identical across all devices that sync the catalog
Product deactivation on server results in is_active = 0, not physical deletion
STATUS: NOT YET VERIFIED.
This assumption has NOT been validated against an actual server contract.
If the server uses auto-increment integers, composite keys, or non-unique identifiers,
Schema V2 MUST be revised before Phase 2.1 implementation begins.
ASSUMPTION-BRANCH-001
No real branch_id generated by the server will ever equal the reserved sentinel string "__BUSINESS__".
STATUS: NOT YET VERIFIED.
The server branch ID generation mechanism must be confirmed to never produce this value.
ASSUMPTION-TZ-001
The server will provide a valid IANA timezone identifier for each business.
If not provided, the default 'Asia/Jakarta' will be used.
STATUS: DEFAULT APPLIED.
5. ACCEPTANCE TESTS (MANDATORY)
5.1 Receipt Sequencing (RCPT)
ID
Test
Expected
RCPT-001
First checkout of day for branch
sequence = 1
RCPT-002
Second checkout same day same branch
sequence = 2
RCPT-003
Concurrent checkout simulation
No duplicate receipt numbers
RCPT-004
New day arrives
sequence resets to 1
5.2 Cart Uniqueness (CART)
ID
Test
Expected
CART-001
Create active cart
PASS
CART-002
Attempt second active cart same business
REJECT (exception)
CART-003
Checkout active cart → new active cart
Allowed after CHECKED_OUT
CART-004
Partial unique index prevents duplicate at DB level
SqliteException on direct insert
5.3 Price Snapshot (PRICE)
ID
Test
Expected
PRICE-001
Add item at price 10000
cart shows 10000
PRICE-002
Catalog refresh changes price to 12000
cart still shows 10000
PRICE-003
Remove item and re-add
cart shows 12000
PRICE-004
Checkout uses cart price
sale uses 10000, not 12000
5.4 Tax Calculation (TAX)
ID
Test
Expected
TAX-001
Tax calculation with bps
(subtotal * bps) / 10000 exact INTEGER
TAX-002
Zero tax rate
tax_minor = 0
5.5 Payment (PAY)
ID
Test
Expected
PAY-001
Cash >= total
change = cash - total
PAY-002
Cash < total
REJECT (no negative change)
5.6 Timezone (TZ)
ID
Test
Expected
TZ-001
Receipt date uses business timezone
Not device timezone
TZ-002
Missing timezone setting
Uses default 'Asia/Jakarta'
TZ-003
Timezone change mid-day
New receipts use new timezone
TZ-004
Sequence resets at business midnight
Not device midnight
5.7 Idempotency (IDEM)
ID
Test
Expected
IDEM-001
Double checkout (rapid double-tap)
Exactly 1 sale, 1 payment, 1 receipt
IDEM-002
Checkout retry after simulated crash
No duplicate transaction
IDEM-003
Concurrent checkout same idempotency key
Only one succeeds
IDEM-004
Retry with different payment, same key
REJECTED
IDEM-005
Crash between sale and payment insert
Full rollback, no orphan
IDEM-006
Crash after payment, before cart update
Recovery corrects cart status
IDEM-007
Idempotency key survives close/reopen
Duplicate insert rejected
5.8 Idempotency Scenarios (Detailed)
Double-Checkout:

Tap 1 → checkout(key="abc") → BEGIN TX → insert all → COMMIT → receipt #1
Tap 2 → checkout(key="abc") → CHECK idempotency → EXISTS → return existing sale
Result: 1 sale, 1 payment, 1 receipt. No duplicates.

Crash Recovery:
Tap 1 → checkout(key="abc") → BEGIN TX → insert sale → CRASH
SQLite ROLLBACK → no sale, no payment, no receipt in DB
App restart → retry checkout(key="abc") → CHECK idempotency → NOT EXISTS
Proceed fresh → COMMIT → receipt #1
Result: Exactly 1 sale, 1 payment, 1 receipt. No orphans.

6. WHAT IS EXCLUDED FROM SCHEMA V2
Item
Reason
stock_count on products_local
D6: Inventory deferred to Phase 3+
credit_limit / debt_amount
D7: Offline credit disabled
Split payment fields
D5: Single payment only
Complex discount rules engine
D3: Simple flat rules
Physical product deletion
Soft delete only (is_active = 0)
Tax rate configuration as separate table
Consolidated into business_settings_local
7. ARCHITECTURE DIAGRAM

                 SERVER (Phase 3: Sync Engine)
                   │
              Product Master
              Branch Master
              Settings Master
                   │
                   ▼
        ┌─────────────────────────┐
        │ products_local          │  ← D1: Server master, local cache
        │ (soft delete only)      │  ← ASSUMPTION-PROD-001
        └──────────┬──────────────┘
                   │
        ┌─────────────────────────┐
        │ business_settings_local │  ← Tax (bps), timezone, currency
        │ (branch_id sentinel)    │  ← "__BUSINESS__" reserved
        └──────────┬──────────────┘
                   │
                   ▼
              CART (D2: Persistent)
        ┌─────────────────────────┐
        │ cart_local              │  ← One ACTIVE per business
        │ cart_items_local        │  ← Price snapshot FROZEN
        └────────┬────────────────┘
                 │
                 ▼
           CALCULATION (D3: Deterministic)
        ┌─────────────────────────┐
        │ subtotal = Σ(price×qty) │
        │ discount = % or fixed   │
        │ tax = (sub × bps)/10000 │
        │ total = sub - disc + tax│
        │ ALL INTEGER             │
        └────────┬────────────────┘
                 │
                 ▼
           CHECKOUT (Atomic Transaction)
                 │
        ┌────────┴────────────┐
        ▼                     ▼
 receipt_sequences      payments_local
 (UPSERT atomic)        (single, D5)
 (D4: branch/day)       │
        │               ├── CASH → change_minor (D8)
        ▼               ├── TRANSFER → UNVERIFIED
   sales_local          └── NO CREDIT (D7)
   + receipt_number
   + receipt_sequence
   + receipt_date
   + branch_id ✓

   8. PHASE 2 ROADMAP (REVISED)

   PHASE 2
│
├── 2.0 Discovery                    ✅ COMPLETE
│
├── 2.0.1 Architecture Lock         ✅ THIS DOCUMENT
│
├── 2.1 Product/Catalog
│     ├── Schema V2 migration (v1 → v2)
│     ├── products_local table
│     ├── business_settings_local table
│     ├── Product cache service
│     └── Soft delete enforcement
│
├── 2.2 Persistent Cart
│     ├── cart_local + cart_items_local
│     ├── Add / update / remove
│     ├── Price snapshot freeze
│     ├── One ACTIVE cart enforcement
│     └── Restore after restart
│
├── 2.3 Calculation Engine
│     ├── Subtotal (Σ price × qty)
│     ├── Discount (% or fixed)
│     ├── Tax (basis points)
│     └── Grand total
│
├── 2.4 Checkout Transaction
│     ├── Receipt sequence (atomic UPSERT)
│     ├── Timezone-aware receipt date
│     ├── Sale + items insert
│     └── All in ONE Drift transaction()
│
├── 2.5 Payment
│     ├── CASH with automatic change
│     ├── TRANSFER with UNVERIFIED status
│     ├── Single payment per sale
│     └── No credit / no debt
│
├── 2.6 Idempotent Checkout
│     ├── Double-tap prevention
│     ├── Crash recovery
│     └── Retry safety
│
├── 2.7 POS UI
│     ├── Product browsing
│     ├── Cart management
│     ├── Checkout flow
│     └── Receipt display
│
└── 2.8 Offline Failure Testing
      ├── All acceptance tests (Section 5)
      ├── Concurrent access
      └── Crash simulation

Inventory and Sync Engine are NOT in Phase 2.
9. BINDING CONSTRAINTS FOR PHASE 2 IMPLEMENTATION
Phase 1B is LOCKED. No modifications to encryption, DbKeyService, DbOpener, or existing schema constraints.
All money fields are INTEGER minor units. No REAL, FLOAT, or DOUBLE anywhere.
All calculations use INTEGER arithmetic. No floating-point division. Use ~/ for integer division.
Tax is in basis points. tax_minor = (subtotal * bps) ~/ 10000.
Receipt date uses business timezone. Never device timezone.
One ACTIVE cart per business. Enforced by partial unique index + application guard.
Cart item prices are frozen snapshots. Never auto-updated by catalog refresh.
Products are soft-deleted. is_active = 0, never physical DELETE.
Single payment per sale. No split payments in Phase 2.
No offline credit. No HUTANG, PIUTANG, CREDIT, BELUM BAYAR.
Checkout is atomic. Sale + items + payment + idempotency key in ONE transaction.
Idempotency prevents duplicates. Check before insert, return existing on conflict.
"__BUSINESS__" is reserved. No real branch_id may equal this string.
Server product UUID is assumed. ASSUMPTION-PROD-001 must be verified before production deployment.
10. GATE CRITERIA FOR PHASE 2.1
Phase 2.1 (Product/Catalog + Schema V2 Migration) may begin ONLY when:
D1–D8 decisions locked (this document)
Schema V2 design approved (this document)
All 4 clarifications applied
ASSUMPTION-PROD-001 acknowledged (server UUID contract)
ASSUMPTION-BRANCH-001 acknowledged (sentinel safety)
Architecture Lock document committed to repository
Explicit approval to begin Phase 2.1 coding
End of Phase 2.0.1 Architecture Lock.
```
