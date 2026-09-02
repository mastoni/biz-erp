# P0 BUG FIX REPORT

**Date:** 2026-09-02  
**Commit under review:** `33b6ce5` — `feat(4.1.5): complete application shell` (HEAD on `main`)  
**Scope:** ERP prioritization — P0 bug fix gate  
**Constraint:** Do not modify roadmap, do not reopen completed phases, do not touch ISP/4.1.40D, no commits yet.

---

## Summary

Both P0 defects identified in `STAGING_FULL_ACCEPTANCE_REPORT.md` were **already fixed** in commit `a164ee1` ("fix(web): finalize money and print architecture"). This gate verified the fixes are present at HEAD, added regression tests that did not previously exist, and confirmed no regressions. No production/application code was changed — only test files were added/modified.

---

## 1. P0 BUG-001: Sales Display Money Format Bug

### Root Cause
In `apps/web/src/features/sales/sales-helpers.ts`, the `idrShort()` function divided the input by 100:

```typescript
const major = minor / 100;  // ← BUG: _minor stores Rupiah directly, not cents
```

The codebase convention (confirmed in `apps/web/src/lib/format.ts` docstring and the `formatMinor` function) is that `*_minor` fields store Rupiah values directly. The `/ 100` division assumed minor units were cents (as in USD), causing all sales-display values to appear 100× too small (e.g., `idrShort(438500)` displayed "Rp 4,39 rb" instead of "Rp 439 rb").

### Fix (already committed in `a164ee1`)
**File:** `apps/web/src/features/sales/sales-helpers.ts:30`

```diff
- const major = minor / 100;
+ const major = minor;  // _minor stores Rupiah directly, not cents
```

### Verification — Other `idrShort` implementations
Confirmed that sibling `idrShort` functions were NOT affected by the same bug:
- `customer-helpers.ts:30` — uses `Math.abs(minor)` directly (no division) — already correct
- `reports-helpers.ts:51` — same pattern — already correct
- `pos-helpers.ts:35` — uses `minor / 1000` (converts to thousands for "rb" suffix, not cents) — already correct
- `purchases-helpers.ts:45` — separate implementation, no `/100` bug — already correct
- `supplier-helpers.ts:57` — separate implementation — already correct
- `FinanceCashflowChart.tsx:12` — local function, no `/100` bug — already correct

### Regression Test Added
**File:** `apps/web/src/features/sales/__tests__/sales-viewmodel.test.ts` (SALES-VM-018)

Added `idrShort` to imports and 6 test cases:
- `idrShort(438500)` → "Rp 439 rb" (bug would produce "Rp 4,39 rb")
- `idrShort(100000)` → "Rp 100 rb" (bug would produce "Rp 1 rb")
- `idrShort(50000)` → "Rp 50 rb" (bug would produce "Rp 500")
- `idrShort(1500000)` → "Rp 1,5 jt" (bug would produce "Rp 15 rb")
- `idrShort(4385)` → "Rp 4,39 rb" (bug would produce "Rp 43.85")
- `idrShort(43850000)` → "Rp 43,9 jt" (bug would produce "Rp 439 rb")

---

## 2. P0 BUG-002: Print Architecture Missing Shell Hiding

### Root Cause
The application called `window.print()` in `use-pos-viewmodel.ts` and finance print triggers, but there was no `@media print` CSS to hide the application shell (sidebar, header, navigation, buttons) during printing. This caused receipts and financial reports to print with the entire web UI shell visible.

### Fix (already committed in `a164ee1`)

**File 1:** `apps/web/src/app/globals.css:208-217` — Added print CSS:
```css
/* Print Architecture */
@media print {
  .no-print {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }
}
```

**File 2:** `apps/web/src/app/(authenticated)/layout.tsx:72,77` — Added `no-print` class to `<Sidebar>` and `<Header>`:
```diff
- <Sidebar />
+ <Sidebar className="no-print" />
```

**File 3:** `apps/web/src/features/pos/components/POSReceiptCard.tsx:103,111,115,118` — Added `no-print` class to "Cetak" and "Transaksi Baru" buttons and their text spans.

**File 4:** `apps/web/src/features/pos/use-pos-viewmodel.ts:547-559` — Enhanced `triggerPrint` to check for `no-print` class before calling `window.print()`:
```typescript
const triggerPrint = useCallback(
  (element?: Element | null) => {
    // Skip printing if element has .no-print class (sidebar, navbar, buttons, etc.)
    if (element && element.classList.contains('no-print')) {
      return;
    }
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  },
  []
);
```

### Regression Tests Added
**File:** `apps/web/src/app/__tests__/print-architecture.test.ts` (new file)

Three test groups:
- `PRINT-ARCH-001` — Verifies `globals.css` contains `@media print` block with `.no-print { display: none !important }` and `.print-only { display: block !important }`
- `PRINT-ARCH-002` — Verifies `no-print` class is applied to Sidebar and Header in authenticated layout, and POS receipt buttons
- `PRINT-ARCH-003` — Verifies `triggerPrint` in `use-pos-viewmodel.ts` checks `classList.contains('no-print')` before calling `window.print()`

---

## 3. Files Changed

| File | Change Type | Lines Added | Lines Removed |
|---|---|---|---|
| `apps/web/src/features/sales/__tests__/sales-viewmodel.test.ts` | Modified | +38 | 0 |
| `apps/web/src/app/__tests__/print-architecture.test.ts` | New file | +74 | 0 |

No production/application code, migrations, or configuration files were changed.

---

## 4. Tests Executed and Results

### Focused Tests (directly related to P0 fixes)
```
npx vitest run "sales-viewmodel" "print-architecture"
```
```
Test Files  2 passed (2)
Tests       29 passed (29)
Duration    432ms
```

Breakdown:
- `sales-viewmodel.test.ts` — 24 tests (18 existing + 6 new SALES-VM-018 idrShort regression tests) ✅
- `print-architecture.test.ts` — 5 tests (3 PRINT-ARCH groups) ✅

### Sales suite (regression)
```
npx vitest run "sales"
```
```
Test Files  3 passed (3)
Tests       61 passed (61)
Duration    1.10s
```

### Format + POS suite (regression — both domains use idrShort and print)
```
npx vitest run "format" "pos-viewmodel" "pos-settings"
```
```
Test Files  3 passed (3)
Tests       59 passed (59)
Duration    857ms
```

### Full web suite
```
npx vitest run
```
```
Test Files  2 failed | 45 passed (47)
Tests       3 failed | 805 passed (808)
```

**Pre-existing failures (NOT caused by this gate):**
1. `rbac.test.ts > canAccessRoute > Unknown/unimplemented route is denied for all roles` — test asserts `canAccessRoute('OWNER', '/finance')` should be `false`, but `ROUTE_PERMISSIONS` in `rbac.ts:31` defines `/finance` as accessible to OWNER+CASHIER. This is a test expectation mismatch unrelated to P0 fixes.
2. `rbac.test.ts > getAuthorizedNavigation > Unimplemented modules are absent from navigation` — same root cause: `/finance` is in the navigation per `rbac.ts:73`.
3. `customers-list.test.ts > header shows the Customers title` — test expects `'Customers'` but the page uses Indonesian `'Pelanggan'`. Unrelated to P0 fixes.

### TypeScript Typecheck
```
npx tsc --noEmit
```
```
(no output — no errors)
exit code: 0
```

---

## 5. P0 Defect Status

| P0 Bug | Status | Fix Location | Regression Test |
|---|---|---|---|
| BUG-001: `idrShort` divides by 100 → 100x under-display | **FIXED** (committed `a164ee1`) | `sales-helpers.ts:30` | SALES-VM-018 (6 cases) ✅ |
| BUG-002: Missing `@media print` CSS → shell printed | **FIXED** (committed `a164ee1`) | `globals.css:208-217`, `layout.tsx:72,77`, `POSReceiptCard.tsx:103-118`, `use-pos-viewmodel.ts:547-559` | PRINT-ARCH-001/002/003 ✅ |

**Conclusion: Both P0 defects are confirmed fixed at HEAD `33b6ce5`.**

---

## 6. Unrelated Modules Not Changed

The following modules/files were verified NOT to be modified:
- `apps/web/src/lib/format.ts` — `formatMinor` (canonical money formatter) was already correct; not touched
- `apps/web/src/features/pos/pos-helpers.ts` — `idrShort` was already correct; not touched
- `apps/web/src/features/customers/customer-helpers.ts` — `idrShort` was already correct; not touched
- `apps/web/src/features/reports/reports-helpers.ts` — `idrShort` was already correct; not touched
- `apps/web/src/features/purchases/purchase-helpers.ts` — `idrShort` was already correct; not touched
- `apps/web/src/features/suppliers/supplier-helpers.ts` — `idrShort` was already correct; not touched
- `apps/web/src/features/finance/components/FinanceCashflowChart.tsx` — local `idrShort` was already correct; not touched
- All API code (`apps/api/`) — not touched
- All mobile code (`apps/mobile/`) — not touched
- All migrations (`apps/api/migrations/`) — not touched
- `docs/PHASE_ROADMAP.md` — not touched

---

## 7. Remaining Known Blockers

| Item | Severity | Status |
|---|---|---|
| Payables API gap (`payable_routes.ts` missing from `app.ts`) | P1 (per audit) | Not in scope for P0 gate — deferred per task constraints |
| Mobile ERP expansion (inventory, finance, reporting modules) | P2 (per audit) | Not in scope for P0 gate — deferred per task constraints |
| 9 Flutter test failures (migration schema, POS widget) | P1 (per audit) | Not in scope for P0 gate — deferred |
| 3 pre-existing web test failures (rbac `/finance` assertions, customers title localization) | Pre-existing | Pre-existing; not caused by P0 gate; not in scope |

No remaining blockers for the P0 bug fix gate specifically.

---

## 8. Proposed Commit Message

```
test(web): add P0 BUG-001/BUG-002 regression tests for money format and print CSS

Both P0 defects were already fixed in a164ee1 (idrShort /100 → /1,
@media print .no-print CSS). This commit adds regression test coverage
that did not previously exist:

- SALES-VM-018: idrShort money contract — verifies 438500 minor → "Rp 439 rb"
  (not "Rp 4,39 rb" from the /100 bug), plus 5 additional magnitude cases
- PRINT-ARCH-001/002/003: print architecture — verifies @media print rules
  in globals.css, no-print class on shell elements, and triggerPrint guard

All 29 focused tests pass; typecheck clean; no regressions in sales/POS/format suites.
3 pre-existing failures in rbac.test.ts and customers-list.test.ts are unrelated.
```
