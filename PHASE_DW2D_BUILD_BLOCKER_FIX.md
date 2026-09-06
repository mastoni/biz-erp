# PHASE DW-2D: CI BUILD BLOCKER FIX
## Report & Verification Checkpoint

- **Gate**: DW-2D Deployment — Build Blocker Fix
- **Status**: RESOLVED & VALIDATED
- **Base DW-2D Implementation Commit**: `ffca475c58b8bb9d660ce18d711a4b3da1d708d2`
- **Date**: 2026-09-06

---

## 1. Root Cause Analysis

During official GitHub Actions `Production Artifact Build` run `34014733542`, the full CI backend test suite failed on historical test `apps/api/test/digital_wallet_api_dw1d.test.ts`:

```text
error: sales tables are append-only
  at cleanWalletData (test/digital_wallet_api_dw1d.test.ts:35:3)
```

**Triggering Mechanics**:
1. In `test/digital_wallet_api_dw1d.test.ts`, the test teardown function `cleanWalletData()` previously executed an unrestricted table wipe: `DELETE FROM wallet_accounts;`.
2. In Migration `055_wallet_pos_settlement.sql`, the foreign key `sales.wallet_id REFERENCES wallet_accounts(id) ON DELETE SET NULL` was added to link POS sales to digital wallets.
3. When `DELETE FROM wallet_accounts;` was executed globally across the test database, PostgreSQL attempted to update `sales.wallet_id` to `NULL` for sales rows inserted by previous POS tests.
4. The PostgreSQL trigger `sales_append_only` (`BEFORE UPDATE OR DELETE ON sales`) invoked `prevent_sales_mutation()`, which rejected the internal cascading update and threw `'sales tables are append-only'`.

---

## 2. Minimal Fix Implemented

Instead of weakening database integrity triggers or modifying production code:
1. `cleanWalletData()` in `apps/api/test/digital_wallet_api_dw1d.test.ts` was scoped strictly to the test-specific businesses (`BUSINESS_A`, `BUSINESS_B`) and test-specific account customer codes (`ACC-A-%`, `ACC-B-%`, `ACC-C-%`).
2. Global `DELETE FROM wallet_accounts` was replaced with tenant-scoped deletion:
   ```sql
   DELETE FROM wallet_accounts WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}')
     OR account_customer_id IN (SELECT id FROM account_customers WHERE code LIKE 'ACC-A-%' OR code LIKE 'ACC-B-%' OR code LIKE 'ACC-C-%');
   ```
3. This prevents cascading mutations on sales rows belonging to other test suites while fully resetting the test environment for `digital_wallet_api_dw1d.test.ts`.

---

## 3. Preservation of Production Database Integrity

- **No Schema Changes**: Migration files `001–055` remain 100% immutable and unmodified.
- **No Trigger Weakening**: The `sales_append_only` trigger and `prevent_sales_mutation()` function remain completely intact and active.
- **No Production Code Alteration**: No production API, web, or service code was modified.
- **Production Baseline**: SHA `639a66d3583871c8b7a4fdf5cdbf18cde83bd60e` remains 100% untouched.

---

## 4. Test & Verification Results

1. **Previously Failing Test**:
   - `test/digital_wallet_api_dw1d.test.ts`: **18/18 PASS (100%)**
2. **DW-2D Focused Test Suite**:
   - `test/wallet_reconciliation_dw2d.test.ts`: **9/9 PASS (100%)**
3. **Related Regression Test Suites**:
   - `test/customer_invoice_wallet_dw2b.test.ts`: **11/11 PASS**
   - `test/pos_wallet_settlement_dw2c3.test.ts`: **9/9 PASS**
   - `test/pos_wallet_settlement_dw2c2.test.ts`: **6/6 PASS**
   - `test/pos_wallet_settlement_dw2c1.test.ts`: **9/9 PASS**
   - `test/digital_wallet_service_dw1b.test.ts`: **15/15 PASS**
   - **Total Combined**: **59/59 PASS (100%)**
4. **TypeScript Build (`tsc -p tsconfig.json`)**: **0 errors**

---

## 5. Changed Files

- `apps/api/test/digital_wallet_api_dw1d.test.ts` (MODIFIED: scoped test fixture teardown)
- `PHASE_DW2D_BUILD_BLOCKER_FIX.md` (NEW)
