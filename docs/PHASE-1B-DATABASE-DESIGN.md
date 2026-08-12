# PHASE 1B — LOCAL DATABASE FOUNDATION — DESIGN DOCUMENT

**Status:** DESIGN COMPLETE — IMPLEMENTATION NOT STARTED
**Phase:** 1B (design-only)
**Git baseline:** 6a8e321 `chore(mobile): bootstrap Flutter application`
**Working tree at design time:** clean
**Flutter:** 3.44.9 stable · **Dart:** 3.12.2 · **OS:** Windows 10 x64
**Governing reference:** docs/P0-OFFLINE-POS-DESIGN-V2.1.2.md

---

## 1. CURRENT PROJECT STATE (Task 1)

Basis: pubspec baseline provided in the phase brief + Phase 0B bootstrap state.
Not a live filesystem read (agent has no filesystem access); items marked
[AS-REPORTED] should be trivially confirmable by you.

| Item | State |
|------|-------|
| apps/mobile/pubspec.yaml | name `biz_erp_mobile`, v1.0.0+1, sdk ^3.12.2 [AS-REPORTED] |
| deps | flutter, cupertino_icons ^1.0.8 [AS-REPORTED] |
| dev deps | flutter_test, flutter_lints ^6.0.0 [AS-REPORTED] |
| apps/mobile/lib/ | default bootstrap `main.dart` (counter app) [AS-REPORTED] |
| apps/mobile/test/ | default `widget_test.dart` [AS-REPORTED] |
| docs/ | P0-OFFLINE-POS design/api/test-plan V2.1.2, Phase-1A audit, Phase-0B report [AS-REPORTED] |
| business/DB deps | NONE present |

Conclusion: clean slate. No database, encryption, UUID, network, or state
dependencies exist yet. No conflict risk for the proposed additions.

---

## 2. DEPENDENCY ANALYSIS (Task 2)

Evaluated per category. "Phase" = when it is introduced.

### A. Local database
- Candidate of record: **Drift** over raw sqlite/sqflite/Hive/Isar (see §3).
- Required in Phase 1B: **YES** (this is the foundation).
- Dart 3.12.2 compatibility: Drift is null-safe and tracks recent Dart; let pub
  resolve versions. Confirm `drift` + `drift_flutter` resolve on 3.12.2 during 1B.1.
- Security/financial: enables SQL constraints (UNIQUE/CHECK/FK) + explicit
  transactions → core integrity guarantees.

### B. Database encryption
- Mechanism: **SQLCipher** (AES-256 full-DB), via `sqlcipher_flutter_libs`.
- Required in Phase 1B: **YES**.
- Compatibility: bundles native libs for Android/iOS. **Windows host testing is a
  known constraint** (see §11). Must verify build on Android/iOS.
- Financial: protects financial data at rest. Uses a vetted standard — we do NOT
  invent cryptography.

### C. Secure key storage
- Package: **flutter_secure_storage** (Android Keystore / iOS Keychain / Windows DPAPI).
- Required in Phase 1B: **YES** (must protect the DB key).
- Security: key never hardcoded, never plaintext. Distinct from DB encryption (§5).

### D. UUID / identifiers
- Package: **uuid** (v4).
- Required in Phase 1B: **YES** — deterministic, collision-safe
  `client_transaction_id` / `client_payment_id` are integrity primitives tested in 1B.
- Compatibility: pure Dart, low risk.

### E. Network client
- Package: dio.
- Required in Phase 1B: **NO — DEFERRED** (sync/server work, Phase 2+).

### F. Connectivity detection
- Package: connectivity_plus.
- Required in Phase 1B: **NO — DEFERRED** to Phase 1E (per approved sequencing).

### G. State management
- Package: flutter_riverpod.
- Required in Phase 1B: **NO — DEFERRED**. The DB foundation layer does not need
  state management; introduce when wiring UI/repos in later phases.

---

## 3. DATABASE TECHNOLOGY DECISION (Task 3)

Requirements: SQLite-compatible persistence, transactions, durable state,
deterministic identifiers, migration, offline operation, testability, encryption,
financial integrity.

| Option | Transactions | Relational integrity (UNIQUE/FK/CHECK) | Migrations | Encryption fit | Verdict |
|--------|:--:|:--:|:--:|:--:|---------|
| **Drift** | ✅ explicit | ✅ strong | ✅ schemaVersion+onUpgrade | ✅ via SQLCipher | **SELECTED** |
| sqflite (raw) | ✅ | ✅ (manual SQL) | ⚠️ manual | ✅ (sqlcipher_sqlite) | Rejected as primary (no type safety, boilerplate, error-prone for finance) |
| Hive | ⚠️ limited | ❌ no relational constraints | ⚠️ | ⚠️ cipher, not SQLCipher | **REJECTED** (no integrity constraints) |
| Isar | ✅ | ⚠️ NoSQL semantics | ✅ | ⚠️ limited | **REJECTED** (weaker fit for double-entry integrity, licensing/ecosystem caution) |

**Decision: Drift + SQLCipher.**
Rationale is requirement-driven, not popularity:
- Financial integrity requires **enforced UNIQUE/CHECK/FK constraints** and
  **explicit multi-statement transactions** → relational SQL, not KV/NoSQL.
- Idempotency requires **durable UNIQUE keys** across restarts → SQL PK/UNIQUE.
- Migration requires a **versioned, non-destructive upgrade path** → Drift provides it.
- Encryption must be **standard at-rest full-DB encryption** → SQLCipher integrates with Drift.

---

## 4. ENCRYPTION STRATEGY (Task 4)

**Mechanism (do not invent):** SQLCipher full-database encryption (AES-256), key
supplied to SQLite at open time. Drift opens the file through the SQLCipher library.

Requirements mapping:
- **At-rest protection:** entire `.db` file encrypted by SQLCipher.
- **Key not hardcoded:** key is generated randomly on device at first run.
- **Key not plaintext:** key bytes stored only in secure storage (§5), held in
  memory transiently at open.
- **Explicit key lifecycle:**
  - **Generate:** once, on first DB creation for a business, random 256-bit.
  - **Independent of auth token:** JWT expiry/refresh/rotation MUST NOT change or
    destroy the key (per V2.1.2 R03).
  - **Logout:** does NOT auto-delete the key (per V2.1.2; deletion policy requires
    separate approval).
  - **App reinstall:** uninstall clears secure storage → key destroyed → any local
    encrypted data becomes unrecoverable. This is intended (no lingering secrets).
  - **Device replacement:** local key/data do not migrate. Server is the financial
    source of truth; unsynced offline items must be synced before replacing the
    device. Document this in UX (later phase).
- **Backup implications:**
  - A DB backup WITHOUT the key is useless (encrypted).
  - The key is NOT backed up to cloud. Restoring a DB backup onto a new device
    without the key fails by design.
  - Because the server is authoritative, local loss is a sync-gap risk, not a
    ledger-corruption risk.

**Phase 1B scope (exactly):**
1. Integrate SQLCipher as the SQLite implementation for Drift.
2. Open the DB with the key retrieved from secure storage.
3. Key generate/retrieve service.
4. Tests for open/write/read/reopen and (where platform-permitted) wrong-key
   behavior.
NOT in 1B: key rotation, cloud key escrow, re-encryption tooling.

---

## 5. SECURE KEY STORAGE (Task 5)

Two separate concerns — do not conflate:

| Concern | What it is | Package |
|---------|-----------|---------|
| **DATABASE ENCRYPTION** | SQLCipher encrypting the `.db` file at rest | sqlcipher_flutter_libs + Drift |
| **KEY STORAGE** | Protecting the raw key bytes on device | flutter_secure_storage |

- flutter_secure_storage is **not** database encryption; it only guards the key.
- Flow at DB open:
  `secure_storage.read(key) → pass to SQLCipher open → encrypted DB available`.
- The key is never written to the DB, never logged, never sent over network.
- Platform note: Windows dev host uses DPAPI via flutter_secure_storage; behavior
  under `flutter test` may differ from device (see §11 test constraints).

---

## 6. SCHEMA BOUNDARY (Task 6)

Defined, **not implemented**. Money = INTEGER minor units; quantity = INTEGER ≥1.

### Implemented in Phase 1B (financial-integrity core)

**sales_local** — offline sale header
- Purpose: durable offline sale record + state machine anchor.
- PK: `client_transaction_id` (UUID v4) — also the idempotency key.
- Key fields: business_id, branch_id, cashier_id, customer_id?, status,
  subtotal_minor, discount_minor, tax_minor, total_minor, currency_code,
  currency_minor_units, device_id, created_at/updated_at/synced_at.
- Uniqueness: PK on client_transaction_id.
- Integrity: CHECK(total_minor>=0), CHECK(subtotal_minor>=0), CHECK
  (status IN valid set). No REAL/FLOAT money.

**sale_items_local** — sale lines
- Purpose: line items of a sale.
- PK: `id` (UUID). FK → sales_local(client_transaction_id).
- Integrity: CHECK(quantity>=1), CHECK(unit_price_minor>=0),
  CHECK(discount_minor>=0). Integer quantity enforced (no fractional, no coercion).

**payments_local** — payments
- Purpose: payment records, RECORDED vs VERIFIED separation (V2.1.2 R09).
- PK: `client_payment_id` (UUID). FK → sales_local.
- Integrity: CHECK(amount_minor>=0); record_status IN (RECORDED,SYNCED);
  verification_status IN (UNVERIFIED,VERIFIED,FAILED_VERIFICATION).
  CASH is NOT auto-VERIFIED by sync.

**local_idempotency_keys** — idempotency record
- Purpose: record that a client key has been used; later cache sync results.
- PK: `key`. Unique per business. Fields: business_id, entity_type
  (SALE/PAYMENT), created_at.
- Integrity: UNIQUE(key) prevents duplicate local creation.
- Note: local at-most-one-sale is primarily enforced by sales_local PK;
  this table additionally supports idempotent replay/caching during sync (later phase).

### Defined now, implemented in later phases
- **products_cache / product_variations_cache / customers_cache** → Phase 1C
  (reference data for offline sale creation).
- **sync_queue / sync_attempts** → Phase 1E (sync metadata).

### Identity / tenant scoping
- Per-business DB file: `business_{uuid}/pos.db` (physical isolation).
- `business_id` also stored in rows as defense-in-depth.
- `device_id` recorded on sales for reconciliation.

---

## 7. TRANSACTION BOUNDARIES (Task 7)

Operations that MUST be atomic (single Drift/SQLite transaction, all-or-nothing):

| Operation | Atomic scope |
|-----------|--------------|
| **Create sale** | sale header + all sale lines + all payments + idempotency key |
| **Add sale line** (to DRAFT) | single line write; consistent with draft totals |
| **Finalize sale** (DRAFT→PENDING_SYNC) | state transition + total recomputation |
| **Record payment** | payment row + (if finalizing) within the same create-sale tx |
| **Local idempotency registration** | committed in the SAME tx as the sale |

Rule: a sale and its lines/payments/idempotency key commit **together or not at
all**. No partial financial state may persist. This is local SQLite atomicity;
server-side lease/fencing is a later-phase concern and is NOT introduced in 1B.

---

## 8. IDEMPOTENCY MODEL (Task 8)

- **What receives an idempotency key:** the create/finalize-sale operation
  (`client_transaction_id`); each payment gets `client_payment_id`.
- **Where stored:** `sales_local.client_transaction_id` (PK) and
  `local_idempotency_keys.key` (local). Server-side store is a later phase.
- **Uniqueness constraint:** PK on client_transaction_id; UNIQUE on
  client_payment_id; UNIQUE on idempotency key.
- **Same operation retried:** duplicate insert hits the PK/UNIQUE constraint →
  rejected → existing record returned. **At-most-one financial commit per
  client_transaction_id with deterministic idempotent replay.** (Not
  "exactly-once processing".)
- **After app restart:** records are durable; the sale + key persist; no duplicate
  can be created because the PK already exists.
- **During sync (later phase):** client_transaction_id is sent as
  `X-Idempotency-Key`; server dedupes via its own lease/fencing model. Not built in 1B.

---

## 9. OFFLINE FINANCIAL RULES (Task 9)

**OFFLINE ALLOWED**
- Cash sale → recorded as RECORDED + UNVERIFIED (verified later by cash count).
- Bank-transfer / Other sale → RECORDED + UNVERIFIED, requires manual verification.
- Optimistic local stock reservation for offline sale (local view only; server is
  authoritative).
- Sale creation with INTEGER quantity and INTEGER minor-unit money.

**OFFLINE NOT ALLOWED**
- **OFFLINE CREDIT: DISABLED.** Must remain disabled. No alternative credit
  behavior is introduced. Credit/due sales are blocked offline and do not enter
  the sync queue as financial sales.
- MOBILE (QRIS/e-wallet) and CARD (EDC) payments — require online gateway/terminal;
  blocked offline.
- Price tampering / unauthorized price changes (server validates via catalog
  version in later phases).
- New customer creation, supplier/purchase operations, reporting.

---

## 10. MIGRATION STRATEGY (Task 10)

- **Schema versioning:** Drift `schemaVersion`, starting at **1**.
- **Migration policy:** pre-production, schema may evolve with version bumps; from
  first production release onward, migrations must be **additive / non-destructive**
  (no silent data loss).
- **Failure behavior:** migrations run inside a Drift transaction; on failure the DB
  is NOT left half-migrated — open aborts and surfaces an error at previous version.
- **Backup/rollback:** before any future destructive change, back up the `.db` file;
  rollback = restore backup. During pre-production, rollback = revert to baseline.
- **App upgrade:** Drift detects version mismatch and runs onUpgrade old→new.
- Phase 1B ships schemaVersion = 1 with the §6 core tables.

---

## 11. TEST STRATEGY (Task 11)

Financial-integrity focus.

| ID | Test | Layer |
|----|------|-------|
| DB-001 | Encrypted DB opens | infra |
| DB-002 | Write/read round-trip | infra |
| DB-003 | Wrong key cannot decrypt | encryption (device-gated, see below) |
| DB-004 | Key retrieved from secure storage | key storage |
| DB-005 | JWT expiry/refresh does not change/destroy key | key lifecycle |
| DB-006 | Business A cannot access Business B DB | isolation |
| DB-007 | Business B cannot access Business A DB | isolation |
| DB-008 | Money stored as INTEGER minor units | schema |
| DB-009 | quantity INTEGER ≥1 enforced (reject 0/negative) | schema CHECK |
| DB-010 | Create-sale atomicity (commit together / rollback all) | transaction |
| DB-011 | client_transaction_id / client_payment_id uniqueness | uniqueness |
| DB-012 | Idempotent retry creates no duplicate | idempotency |
| DB-013 | Restart persistence (close+reopen intact) | durability |
| DB-014 | Migration path opens at schemaVersion 1 | migration |
| DB-015 | Failure/corruption behavior (practical subset) | resilience |

**Honest test-environment constraint (must be acknowledged):**
`flutter test` runs on the host Dart VM, which loads a host `sqlite3` library —
typically **not** SQLCipher. Therefore:
- Schema/transaction/uniqueness/money/quantity/idempotency tests (DB-008…014) run
  fine on the host via an in-memory/plain SQLite Drift database.
- **Encryption-specific tests (DB-001 encrypted-file, DB-003 wrong-key) may NOT be
  verifiable under `flutter test` on the Windows host.** They require SQLCipher on a
  device/emulator (integration test) or documented manual verification.
- Additionally, Windows host needs a usable sqlite3 native lib for Drift; if absent,
  host tests must use an in-memory setup or CI must run on a platform with sqlite3.

This constraint is recorded as a risk (§14) and must not be papered over by claiming
encryption tests PASS on host when they cannot exercise SQLCipher.

---

## 12. DEPENDENCY DECISION TABLE (Task 12)

| Package | Phase | Required? | Reason | Risk |
|---------|-------|-----------|--------|------|
| drift | 1B | REQUIRED NOW | ORM, transactions, migrations | codegen complexity |
| drift_flutter | 1B | REQUIRED NOW | open native DB | low |
| sqlcipher_flutter_libs | 1B | REQUIRED NOW | SQLCipher at-rest encryption | native build; host-test limitation |
| flutter_secure_storage | 1B | REQUIRED NOW | DB key storage | platform behavior variance |
| uuid | 1B | REQUIRED NOW | client_transaction/payment ids | low |
| path_provider | 1B | REQUIRED NOW | locate DB dir (per-business path) | low |
| path | 1B | REQUIRED NOW | path composition | low |
| drift_dev | 1B (dev) | REQUIRED NOW | Drift codegen | dev-only |
| build_runner | 1B (dev) | REQUIRED NOW | run codegen | dev-only |
| dio | 2+ | DEFERRED | network/sync | not needed now |
| connectivity_plus | 1E | DEFERRED | connectivity detection | not needed now |
| flutter_riverpod | later | DEFERRED | state management | not needed for DB foundation |
| sqflite / sqflite_sqlcipher | — | REJECTED | drift uses sqlite3/sqlcipher directly | redundant |
| hive | — | REJECTED | no relational integrity | unsafe for finance |
| isar | — | REJECTED | NoSQL/encryption fit | integrity concerns |

No dependency is added in this design phase.

---

## 13. IMPLEMENTATION PLAN (Task 13)

Ordered steps. Rollback baseline for all: commit 6a8e321.

**1B.1 — Add dependencies**
- Objective: resolve required packages.
- Files: `apps/mobile/pubspec.yaml`.
- Tests: none.
- Acceptance: `flutter pub get` succeeds, no conflicts on Dart 3.12.2.
- Rollback: revert pubspec.yaml.

**1B.2 — Secure DB key service**
- Objective: generate/retrieve 256-bit key in secure storage; independent of JWT.
- Files: `lib/core/database/db_key_service.dart` (name TBD).
- Tests: DB-004, DB-005.
- Acceptance: key stable across reads; not derived from token.
- Rollback: remove file.

**1B.3 — Drift schema + codegen**
- Objective: define §6 core tables; run build_runner.
- Files: `lib/core/database/tables/*.dart`, `app_database.dart`, generated `.g.dart`.
- Tests: codegen compiles.
- Acceptance: `dart run build_runner build` succeeds; analyze clean.
- Rollback: remove files.

**1B.4 — Encrypted DB opener + per-business path**
- Objective: open SQLCipher-encrypted DB using key; `business_{uuid}/pos.db`.
- Files: `lib/core/database/db_opener.dart`, path helper.
- Tests: DB-001, DB-002, DB-006, DB-007, DB-013.
- Acceptance: opens with key; business A/B isolated; persists reopen.
- Rollback: remove files.

**1B.5 — Migration framework**
- Objective: schemaVersion=1, onUpgrade scaffold, transactional migration.
- Files: within `app_database.dart`.
- Tests: DB-014.
- Acceptance: opens at v1; upgrade path defined.
- Rollback: revert.

**1B.6 — Integrity test suite**
- Objective: prove atomicity/uniqueness/idempotency/money/quantity.
- Files: `test/database/*.dart`.
- Tests: DB-008…DB-012, DB-015 (practical subset).
- Acceptance: all host-runnable tests pass; SQLCipher-gated tests documented.
- Rollback: remove tests.

---

## 14. RISKS

1. **SQLCipher host-test limitation** — encryption tests may require device/integration;
   must not be falsely reported as PASS on host.
2. **Windows sqlite3 availability** for Drift host tests — may need in-memory setup or CI on another OS.
3. **Native build** of sqlcipher_flutter_libs on Android/iOS — verify early.
4. **flutter_secure_storage test doubles** — host tests may need a mock key store.
5. **Codegen drift** — build_runner failures block compile; mitigate with clean steps.
6. **Scope creep** — temptation to add repos/sync in 1B; explicitly out of scope.

## 15. OPEN DECISIONS

1. Confirm DB file root dir (app documents vs application support) for per-business path.
2. Confirm whether to create a `business_{uuid}` subdirectory now or a single default
   business dir until multi-business login exists.
3. Confirm SQLCipher host-test fallback approach (in-memory plain SQLite for
   non-encryption tests).
4. Confirm key handling on logout remains "do not delete" pending a later policy decision.
5. Approve dependency versions (let pub resolve vs pinning).