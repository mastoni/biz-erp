# PHASE 2.0 — POS DOMAIN DISCOVERY

**Status:** DISCOVERY COMPLETE
**Phase:** 2.0 (read-only discovery)
**Git baseline:** 500ac99 `feat(mobile): Phase 1B - Local Database Foundation`
**Method:** Analysis of Phase 1B implementation (schema, services, tests)

---

## 1. Baseline

| Item                   | Value                                                      |
| ---------------------- | ---------------------------------------------------------- |
| Repository             | biz-erp                                                    |
| Branch                 | main                                                       |
| HEAD                   | 500ac99 feat(mobile): Phase 1B - Local Database Foundation |
| Flutter                | 3.44.9 stable                                              |
| Dart                   | 3.12.2                                                     |
| Drift                  | 2.34.3                                                     |
| sqlite3                | 3.5.1 (SQLite3MultipleCiphers via official hooks)          |
| flutter_secure_storage | 11.0.0                                                     |
| Android compileSdk     | 37                                                         |
| Test suite             | 104 host + 8 Android integration tests                     |

---

## 2. Current Architecture

### Encryption Stack (LOCKED — Phase 1B.1)

Drift 2.34.3
└─ NativeDatabase
└─ sqlite3 3.5.1
└─ official sqlite3 hooks (source: sqlite3mc)
└─ SQLite3MultipleCiphers (ChaCha20-Poly1305 AEAD)
Key: flutter\*secure_storage → 256-bit CSPRNG → PRAGMA key

### Service Layer

DbKeyService (SecureStorageAdapter → FlutterSecureStorage)
DbOpener (Per-business isolation, Key-loss protection)

### What Does NOT Exist Yet (Phase 2 Gaps)

- No product/catalog model or table
- No cart state management (ephemeral or persistent)
- No sale creation/calculation service
- No payment recording service
- No checkout orchestration
- No receipt/reference number generation
- No UI layer

---

## 3. Current Database Model (Phase 1B Baseline)

### Table: `sales_local`

| Column                  | Type    | Constraints              | Purpose                    |
| ----------------------- | ------- | ------------------------ | -------------------------- |
| `client_transaction_id` | TEXT    | PRIMARY KEY              | UUID v4 idempotency anchor |
| `business_id`           | TEXT    | NOT NULL                 | Business isolation         |
| `branch_id`             | TEXT    | NOT NULL                 | Branch identification      |
| `cashier_id`            | TEXT    | NOT NULL                 | Cashier identification     |
| `customer_id`           | TEXT    | NULLABLE                 | Optional customer link     |
| `status`                | TEXT    | NOT NULL, CHECK IN list  | Sale state machine         |
| `subtotal_minor`        | INTEGER | NOT NULL, >= 0           | Sum of line totals         |
| `discount_minor`        | INTEGER | NOT NULL DEFAULT 0, >= 0 | Sale-level discount        |
| `tax_minor`             | INTEGER | NOT NULL DEFAULT 0, >= 0 | Tax amount                 |
| `total_minor`           | INTEGER | NOT NULL, >= 0           | Final total                |
| `currency_code`         | TEXT    | NOT NULL                 | ISO currency code          |
| `currency_minor_units`  | INTEGER | NOT NULL                 | Decimal places             |
| `device_id`             | TEXT    | NOT NULL                 | Device identification      |
| `created_at`            | INTEGER | NOT NULL                 | Epoch milliseconds         |
| `updated_at`            | INTEGER | NOT NULL                 | Epoch milliseconds         |
| `synced_at`             | INTEGER | NULLABLE                 | Sync timestamp             |

**Status values:** `DRAFT`, `PENDING_SYNC`, `SYNCING`, `RESULT_UNKNOWN`, `SYNCED`, `SYNC_FAILED`, `CONFLICT`, `CANCELLED`

### Table: `sale_items_local`

| Column                  | Type    | Constraints                | Purpose                                          |
| ----------------------- | ------- | -------------------------- | ------------------------------------------------ |
| `id`                    | TEXT    | PRIMARY KEY                | UUID                                             |
| `client_transaction_id` | TEXT    | NOT NULL, FK → sales_local | Parent sale                                      |
| `product_id`            | TEXT    | NOT NULL                   | Product reference (no products table exists yet) |
| `quantity`              | INTEGER | NOT NULL, >= 1             | Line quantity                                    |
| `unit_price_minor`      | INTEGER | NOT NULL, >= 0             | Price per unit                                   |
| `discount_minor`        | INTEGER | NOT NULL DEFAULT 0, >= 0   | Line discount                                    |
| `created_at`            | INTEGER | NOT NULL                   | Epoch milliseconds                               |

### Table: `payments_local`

| Column                  | Type    | Constraints                   | Purpose                                   |
| ----------------------- | ------- | ----------------------------- | ----------------------------------------- |
| `client_payment_id`     | TEXT    | PRIMARY KEY                   | UUID                                      |
| `client_transaction_id` | TEXT    | NOT NULL, FK → sales_local    | Parent sale                               |
| `payment_method`        | TEXT    | NOT NULL                      | CASH, BANK_TRANSFER, etc.                 |
| `amount_minor`          | INTEGER | NOT NULL, >= 0                | Payment amount                            |
| `record_status`         | TEXT    | NOT NULL DEFAULT 'RECORDED'   | RECORDED, SYNCED                          |
| `verification_status`   | TEXT    | NOT NULL DEFAULT 'UNVERIFIED' | UNVERIFIED, VERIFIED, FAILED_VERIFICATION |
| `created_at`            | INTEGER | NOT NULL                      | Epoch milliseconds                        |
| `synced_at`             | INTEGER | NULLABLE                      | Sync timestamp                            |

### Table: `local_idempotency_keys`

| Column        | Type    | Constraints             | Purpose            |
| ------------- | ------- | ----------------------- | ------------------ |
| `key`         | TEXT    | PRIMARY KEY, UNIQUE     | Idempotency key    |
| `business_id` | TEXT    | NOT NULL                | Business isolation |
| `entity_type` | TEXT    | NOT NULL, CHECK IN list | SALE, PAYMENT      |
| `created_at`  | INTEGER | NOT NULL                | Epoch milliseconds |

---

## 4. Existing Financial Invariants (MUST NOT BREAK)

These are enforced by database constraints and verified by 104+ tests. Phase 2 MUST respect all of them:

- **Money:** All fields INTEGER minor units. Zero valid. Negative rejected (where prohibited). No floating-point.
- **Quantity:** INTEGER >= 1. No fractional. No silent coercion.
- **Payment:** `amount_minor >= 0`. `RECORDED ≠ VERIFIED`. No auto-conversion from `RECORDED` to `VERIFIED`.
- **Sale Status:** Restricted to valid state machine values. (State transitions are NOT enforced at DB level).
- **Idempotency:** Keys UNIQUE. `SALE`/`PAYMENT` distinguishable.
- **Foreign Keys:** Items/payments MUST reference existing sales. (`PRAGMA foreign_keys = ON`).
- **Transactions:** Drift `transaction()` guarantees atomicity. Partial failure = full rollback.

---

## 5. Missing POS Capabilities (GAP ANALYSIS)

| Gap                        | Current State                                 | Impact on POS                                                         |
| -------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| **Product Catalog**        | `product_id` exists, but no `products` table. | Cannot browse/search products, validate prices, or enforce inventory. |
| **Cart State**             | No cart concept in DB or code.                | Cannot accumulate items before checkout.                              |
| **Totals Calculation**     | Fields exist, but no calculation logic.       | Totals can be set to arbitrary values (security risk).                |
| **Discount/Tax Rules**     | Fields exist, but no rules engine.            | Discounts/taxes can be arbitrary or negative.                         |
| **Payment Recording**      | Table exists, but no service.                 | Cannot record payments against sales or calculate change.             |
| **Checkout Orchestration** | No atomic checkout flow.                      | Checkout can leave partial state or duplicate payments.               |
| **Receipt Number**         | Only UUID (`client_transaction_id`).          | No human-readable, sequential customer-facing reference.              |
| **State Transitions**      | Status values defined, but no logic.          | Invalid transitions possible (e.g., `SYNCED` → `DRAFT`).              |

---

## 6. Financial Risks (Phase 2 Implementation)

| Risk                                           | Severity | Mitigation Strategy                                                               |
| ---------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| **Duplicate Checkout** (rapid button taps)     | CRITICAL | Idempotency key check BEFORE checkout. UI debounce.                               |
| **Incorrect Totals** (client-side math errors) | CRITICAL | Service-layer totals calculation. Never trust UI input.                           |
| **Retry Behavior** (replaying failed checkout) | CRITICAL | Check idempotency key existence BEFORE creating sale.                             |
| **Double Payment** (recording > sale total)    | HIGH     | Validate `sum(payments) <= sale.total_minor` at service layer.                    |
| **Partial Sale Creation** (crash mid-checkout) | HIGH     | Entire checkout (sale + items + payment + idem key) in ONE Drift `transaction()`. |
| **Quantity Mutation** (post-checkout edits)    | HIGH     | Immutable line items after status leaves `DRAFT`.                                 |

---

## 7. Proposed Phase 2 Breakdown

### Phase 2.1 — Product/Catalog Domain

- Design product model (local vs server-synced).
- Implement product service (CRUD, pricing in minor units).

### Phase 2.2 — Cart Domain

- Implement cart state management (in-memory vs DB-backed).
- Add/remove/update quantity logic.

### Phase 2.3 — Sale Calculation Engine

- Implement totals calculation (subtotal, discount, tax, total).
- All calculations in INTEGER minor units.
- Validation: `total == f(items)`.

### Phase 2.4 — Sale & Payment Services

- Sale creation with state machine enforcement.
- Payment recording with amount validation.
- No auto RECORDED → VERIFIED.

### Phase 2.5 — Idempotent Checkout Orchestration

- Atomic checkout transaction (sale + items + payment + idempotency key).
- Duplicate checkout prevention.
- Change calculation (for cash).

### Phase 2.6 — POS UI Layer

- Product browsing, cart display, checkout flow, payment selection.

### Phase 2.7 — Offline Failure Testing

- Crash recovery, retry behavior, concurrent access tests.

---

## 8. Database Change Assessment

**Does Phase 2 require database schema changes?**
**Answer: YES (Schema Version 2)**

The existing schema is sufficient for the _core_ sale/payment workflow, but Phase 2.1 (Product Catalog) and Phase 2.5 (Receipt Numbering) will require new tables/columns.

### Required Additions (Proposed for v2):

1. **`products_local`** table: `id`, `name`, `price_minor`, `category_id`, `stock_count`, etc.
2. **`receipt_sequences_local`** table: For generating sequential, human-readable receipt numbers per business/branch.
3. **Optional columns:** `receipt_number` on `sales_local`, `change_minor` on `payments_local`.

### Migration Strategy:

- Increment `schemaVersion` to 2.
- Implement `onUpgrade` for v1 → v2.
- Preserve all existing v1 data.
- No destructive operations.

---

## 9. Open Decisions (Required before Phase 2.1)

| #   | Decision                                                            | Impact                                             |
| --- | ------------------------------------------------------------------- | -------------------------------------------------- |
| D1  | Product catalog: Local DB vs Server-synced?                         | Determines if `products_local` is master or cache. |
| D2  | Cart persistence: In-memory vs DB-backed?                           | Determines if cart survives app crash/restart.     |
| D3  | Tax/Discount model: Fixed, per-product, or rules engine?            | Determines calculation complexity.                 |
| D4  | Receipt number format: Sequential per business, per day, or global? | Determines `receipt_sequences` table design.       |
| D5  | Payment split: Single vs multiple payments per sale?                | Determines payment recording logic.                |
| D6  | Inventory tracking: In scope for Phase 2?                           | Determines if `stock_count` is needed now.         |

---

## 10. Recommended Next Gate

**Phase 2.0.1 — Architecture & Domain Decisions**
Before writing any Phase 2.1 code, resolve D1–D6 and lock the v2 schema design.

_End of Discovery._
