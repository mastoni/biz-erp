# PHASE DW-2D: CI BUILD BLOCKER FIX #2
## Report & Verification Checkpoint

- **Gate**: DW-2D Deployment — CI Build Blocker #2
- **Status**: RESOLVED & VALIDATED
- **Base DW-2D Implementation Commit**: `ffca475c58b8bb9d660ce18d711a4b3da1d708d2`
- **Prior Corrective Commit**: `386286657f0f1379e43b6fe9d949c9cff7e42505`
- **Date**: 2026-09-06

---

## 1. CI Failure & Root Cause Analysis

During official GitHub Actions `Production Artifact Build` run `34016796095`, the backend CI test suite failed on historical acceptance test `apps/api/test/digital_wallet_e2e_acceptance_dw1e.test.ts`:

```text
validation-and-build: apps/api/test/digital_wallet_e2e_acceptance_dw1e.test.ts#44

X error: sales tables are append-only
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ cleanWalletData test/digital_wallet_e2e_acceptance_dw1e.test.ts:44:3
 ❯ test/digital_wallet_e2e_acceptance_dw1e.test.ts:87:3

Serialized Error: {
  length: 262,
  severity: 'ERROR',
  code: 'P0001',
  where: 'PL/pgSQL function prevent_sales_mutation() line 3 at RAISE\nSQL statement "UPDATE ONLY "public"."sales" SET "wallet_id" = NULL WHERE $1 OPERATOR(pg_catalog.=) "wallet_id""',
  message: 'sales tables are append-only'
}
```

**Triggering Mechanics**:
1. In `test/digital_wallet_e2e_acceptance_dw1e.test.ts`, the fixture cleanup `cleanWalletData()` executed an unrestricted `DELETE FROM wallet_accounts;`.
2. With Migration `055_wallet_pos_settlement.sql`, the foreign key `sales.wallet_id REFERENCES wallet_accounts(id) ON DELETE SET NULL` was added.
3. Unscoped global deletion of `wallet_accounts` triggered PostgreSQL's internal `UPDATE sales.wallet_id = NULL` across sales rows inserted by previously run POS test suites.
4. The PostgreSQL trigger `sales_append_only` (`BEFORE UPDATE OR DELETE ON sales`) invoked `prevent_sales_mutation()`, rejecting the update and raising `'sales tables are append-only'`.

---

## 2. Minimal Test-Only Fix Implemented

Reusing the established safe fixture-scoping pattern from the DW1D fix:
1. `cleanWalletData()` in `apps/api/test/digital_wallet_e2e_acceptance_dw1e.test.ts` was scoped strictly to test-specific fixtures:
   - Businesses: `BUSINESS_A`, `BUSINESS_B`
   - Account Customer Codes: `ACC-A-%`, `ACC-B-%`, `ACC-C-%`, `ACC-D-%`
2. Unscoped global `DELETE FROM wallet_accounts;` was replaced with:
   ```sql
   DELETE FROM wallet_accounts WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}')
     OR account_customer_id IN (SELECT id FROM account_customers WHERE code LIKE 'ACC-A-%' OR code LIKE 'ACC-B-%' OR code LIKE 'ACC-C-%' OR code LIKE 'ACC-D-%');
   ```
3. Child records (`wallet_ledgers`, `top_up_intents`, `account_customer_users`) were likewise scoped to the same test fixtures prior to parent deletion.
4. No global audit log or webhook deletions are executed.

---

## 3. Preservation of Production Invariants

- **Zero Changes to Production Code**: No API, service, DTO, route, or accounting implementation files were altered.
- **Append-Only Protection Intact**: The `sales_append_only` trigger and `prevent_sales_mutation()` function remain completely active and unchanged.
- **Zero Migration Changes**: Migration files `001–055` remain strictly immutable.
- **Production Baseline**: Commit SHA `639a66d3583871c8b7a4fdf5cdbf18cde83bd60e` remains 100% untouched.

---

## 4. Test & Verification Results

1. **Previously Failing Test (`DW1E`)**:
   - `test/digital_wallet_e2e_acceptance_dw1e.test.ts`: **9/9 PASS (100%)**
2. **Previously Fixed Test (`DW1D`)**:
   - `test/digital_wallet_api_dw1d.test.ts`: **18/18 PASS (100%)**
3. **DW-2D Focused Suite**:
   - `test/wallet_reconciliation_dw2d.test.ts`: **9/9 PASS (100%)**
4. **Related Regression Suites**:
   - `test/pos_wallet_settlement_dw2c3.test.ts`: **9/9 PASS**
   - `test/pos_wallet_settlement_dw2c2.test.ts`: **6/6 PASS**
   - `test/pos_wallet_settlement_dw2c1.test.ts`: **9/9 PASS**
   - `test/customer_invoice_wallet_dw2b.test.ts`: **11/11 PASS**
   - `test/digital_wallet_service_dw1b.test.ts`: **15/15 PASS**
   - **Combined Regressions**: **77/77 PASS (100%)**
5. **TypeScript Build (`npm --prefix apps/api run build`)**: **0 errors**

---

## 5. Changed Files

- `apps/api/test/digital_wallet_e2e_acceptance_dw1e.test.ts` (MODIFIED: scoped test fixture teardown)
- `PHASE_DW2D_BUILD_BLOCKER_FIX_2.md` (NEW)
