# Mobile Inventory Implementation Report

## 1. Context Preflight

- **Objective:** Build the smallest production-appropriate mobile Inventory workflow reusing the existing backend Inventory API, without modifying backend code or expanding scope.
- **Repository:** `mastoni/biz-erp`, branch `main`.
- **Backend Inventory API:** COMPLETE and READ-ONLY. Endpoints: `GET /stocks`, `GET /stock/:id`, `GET /summary`, `GET /movements`, `POST /adjustment`. Backend `LOW_STOCK_THRESHOLD = 5`.
- **Phase:** Mobile ERP Inventory (MOB-INV). No ISP, Finance, or Reporting scope introduced.
- **Architecture:** Offline-first via Drift local DB → SyncEngine → HTTP API → PostgreSQL. Mobile uses the same canonical backend; no second business DB created.

## 2. D1–D4 Decisions and Compliance

| Decision | Description | Compliance |
|----------|-------------|------------|
| D1 | Stock pull uses full-pull upsert each sync; `server_version` used for adjustment locking only | `applyStocksPull` deletes stale rows then upserts; `applyMovementsPull` filters by `updatedAt` |
| D2 | Stock adjustment performed via direct API call (matches purchase receive/pay pattern) | `adjustStock` sends `POST /adjustment` with idempotency key; 409 conflict handling |
| D3 | Stock summary computed locally from `stocks_local` cache (derived) | `getStockSummary` aggregates from local cache; no additional API call |
| D4 | Low-stock threshold uses backend constant (5) for MVP; per-business config deferred | `lowStockThreshold = 5` in domain model; no per-business threshold UI |

## 3. Files Changed

### New Files
- `apps/mobile/lib/inventory/domain/stock.dart` — `Stock` domain model
- `apps/mobile/lib/inventory/domain/stock_movement.dart` — `StockMovement` domain model
- `apps/mobile/lib/inventory/data/stock_repository.dart` — Drift-backed repository
- `apps/mobile/lib/inventory/presentation/stock_list_screen.dart` — Inventory list UI
- `apps/mobile/lib/inventory/presentation/stock_detail_screen.dart` — Inventory detail UI
- `apps/mobile/lib/core/database/tables/stocks_local.dart` — Drift table definition
- `apps/mobile/lib/core/database/tables/stock_movements_local.dart` — Drift table definition

### Modified Files
- `apps/mobile/lib/core/database/app_database.dart` — Registered new tables, bumped `schemaVersion` to 12, added V12 migration
- `apps/mobile/lib/core/database/app_database.g.dart` — Regenerated (verified `stocksLocal` and `stockMovementsLocal` getters present)
- `apps/mobile/lib/core/sync/sync_models.dart` — 8 DTOs added
- `apps/mobile/lib/core/sync/sync_api_client.dart` — 4 abstract methods added
- `apps/mobile/lib/core/sync/http_sync_api_client.dart` — 4 implementations added
- `apps/mobile/lib/core/sync/sync_engine.dart` — `stocks` field, `apiClient` getter, inventory section in `_pull()`, `SyncSummary.pulledStocks`
- `apps/mobile/lib/core/composition/tenant_composition_root.dart` — `StockRepository` wiring
- `apps/mobile/lib/pos/presentation/pos_screen.dart` — Inventory drawer item
- `apps/mobile/lib/main.dart` — Passes `stockRepo` to `PosScreen`

### Test Files Updated (mock SyncEngine implementations)
- `apps/mobile/test/core/sync/sync_engine_test.dart`
- `apps/mobile/test/core/sync/sync_status_notifier_test.dart`
- `apps/mobile/test/pos/presentation/pos_widget_test.dart`
- `apps/mobile/test/scanner/scanner_ui_test.dart`
- `apps/mobile/test/suppliers/supplier_sync_test.dart`
- `apps/mobile/test/store_settings/store_settings_test.dart`
- `apps/mobile/test/core/database/migration_test.dart`
- `apps/mobile/test/core/database/v2_schema_test.dart`
- `apps/mobile/test/core/database/integrity_test.dart`

## 4. Drift Schema / Version 12

- `schemaVersion` bumped from 11 to 12
- New tables: `stocks_local`, `stock_movements_local`
- Migration V12: creates both tables with `CREATE TABLE IF NOT EXISTS` (idempotent)
- `app_database.g.dart` regenerated — verified table getters present

## 5. DTO / Data Layer

### DTOs (sync_models.dart)
1. `StockDto` — id, business_id, branch_id, product_id, quantity, server_version
2. `StockWithProductDto` — stock + product name/sku
3. `StockMovementDto` — id, stock_id, type, quantity, reference_id, created_at, server_version
4. `StockMovementPaginatedResponse` — items + pagination metadata
5. `StockSummaryDto` — total_products, low_stock_count, out_of_stock_count
6. `StockAdjustmentRequest` — product_id, branch_id, quantity, reason, idempotency_key
7. `StockAdjustmentResult` — success, stock_id, new_quantity, server_version
8. `PullStocksResponse` — items + sync_version

### Data Layer (stock_repository.dart)
- `applyStocksPull(List<StockDto>, businessId, branchId)` — full-pull upsert
- `applyMovementsPull(List<StockMovementDto>, businessId, branchId)` — movement cache
- `listStocks(businessId, branchId)` — returns `Stock` domain models
- `getStockByProductId(productId, businessId, branchId)` — single stock lookup
- `listMovements(businessId, branchId, limit, offset)` — paginated movements
- `getStockSummary(businessId, branchId)` — computes summary from local cache
- `maxServerVersion(businessId, branchId)` — for sync bookkeeping
- `clearBranch(businessId, branchId)` — branch cleanup

## 6. API Client

### Abstract Methods (SyncApiClient)
- `pullStocks({businessId, branchId, sinceVersion, limit})` → `PullStocksResponse`
- `pullStockSummary({businessId, branchId})` → `StockSummaryDto`
- `pullStockMovements({businessId, branchId, sinceVersion, limit, offset})` → `StockMovementPaginatedResponse`
- `adjustStock(StockAdjustmentRequest)` → `StockAdjustmentResult`

### HTTP Implementation (HttpSyncApiClient)
- All 5 methods implemented with token refresh, error handling (400, 403, 409, 500), idempotency-key header
- 409 conflict retried with server_version from response
- Base URL: `${apiBaseUrl}/inventory/stocks`

## 7. SyncEngine Integration

- Added `StockRepository? stocks` field to constructor
- Added `SyncApiClient get apiClient` getter
- Inventory section in `_pull()`: fetches stocks → movements if `stocks != null && branchId != null`
- `SyncSummary` updated with `pulledStocks` field
- Full-pull upsert pattern: clears stale data, applies new data per D1

## 8. UI / Navigation

- `StockListScreen` — search bar, low-stock highlighting (yellow for `qty <= 5 && qty > 0`, red for `qty == 0`), status badges, product name + SKU
- `StockDetailScreen` — stock summary card (current quantity, low-stock indicator), adjustment card (OWNER-only), movement history audit trail (type, quantity, reference, timestamp)
- POS screen drawer: inventory drawer item navigates to `StockListScreen`
- `main.dart`: passes `stockRepo` through DI chain to `PosScreen`

## 9. RBAC Behavior

| Role | Stocks List | Stock Detail | Adjustment |
|------|------------|-------------|------------|
| OWNER | Read | Read + Adjust | Visible + enabled |
| CASHIER | Read | Read-only | Button/card hidden |
| STAFF | Read | Read-only | Button/card hidden |

- Enforcement at widget level: adjustment button/card only rendered when `userRole == 'OWNER'`
- Backend enforces API-level RBAC (OWNER for adjustment, OWNER+CASHIER for read)

## 10. Offline / Local-Cache Behavior

- All inventory data stored in Drift local SQLite database
- `stocks_local` table caches complete stock state per (business_id, branch_id)
- `stock_movements_local` table caches movement history
- `StockListScreen` displays cached data immediately on load (no network wait)
- `StockDetailScreen` works from local cache; shows cached movements even offline
- Adjustment requests are sent via `SyncApiClient.adjustStock` (direct API call, not queued) — matches purchase receive/pay pattern
- If API call fails (network), error is surfaced to UI; no local write occurs (server-authoritative)

## 11. Tests

**Full suite: 537/537 PASS**

### New Inventory Tests (17 tests)
- `test/inventory/stock_repository_test.dart` — 8 tests (MOB-INV-001 through MOB-INV-008)
- `test/inventory/inventory_sync_test.dart` — 2 tests (MOB-INV-009, MOB-INV-010)
- `test/inventory/inventory_ui_test.dart` — 7 tests (MOB-INV-001 through MOB-INV-007)

### Regression Tests Verified
- `test/core/sync/sync_engine_test.dart` — 8 tests PASS (updated mock)
- `test/core/sync/sync_outbox_repository_test.dart` — PASS
- `test/core/sync/sync_status_notifier_test.dart` — 3 tests PASS (updated mock)
- `test/pos/presentation/pos_widget_test.dart` — PASS (updated mock)
- `test/scanner/scanner_ui_test.dart` — PASS (updated mock)
- `test/suppliers/supplier_sync_test.dart` — PASS (updated mock)
- `test/store_settings/store_settings_test.dart` — PASS (updated mock)
- `test/core/database/migration_test.dart` — 12 tests PASS (updated version to 12)
- `test/core/database/v2_schema_test.dart` — PASS (updated version to 12)
- `test/core/database/integrity_test.dart` — PASS (updated version to 12)
- All purchase flow tests — PASS

## 12. Analyzer / Typecheck / Build Result

- `dart analyze lib/`: 0 errors, 0 warnings. Only pre-existing info-level lints remain (deprecated `withOpacity`, `sort_child_properties_last`, etc. in other modules).
- `flutter test`: 537/537 PASS, 0 failures, 0 compilation errors.

## 13. Acceptance — MOB-INV-AC-001 through AC-012

| ID | Acceptance Criteria | Status |
|----|---------------------|--------|
| MOB-INV-AC-001 | Stock list displays all products with current quantity | PASS |
| MOB-INV-AC-002 | Low-stock products are visually highlighted (qty <= 5) | PASS |
| MOB-INV-AC-003 | Out-of-stock products shown in red (qty == 0) | PASS |
| MOB-INV-AC-004 | Stock detail screen shows product summary + movements | PASS |
| MOB-INV-AC-005 | OWNER can adjust stock via dialog | PASS |
| MOB-INV-AC-006 | CASHIER cannot see adjustment button/card | PASS |
| MOB-INV-AC-007 | Adjustment sends POST /adjustment with idempotency key | PASS |
| MOB-INV-AC-008 | 409 conflict on adjustment is handled gracefully | PASS |
| MOB-INV-AC-009 | SyncEngine pulls stocks + movements into local cache | PASS |
| MOB-INV-AC-010 | Sync skips inventory when branchId is null | PASS |
| MOB-INV-AC-011 | Offline stock list shows cached data | PASS |
| MOB-INV-AC-012 | Drift schemaVersion = 12, tables migrated | PASS |

## 14. Deferred Inventory Capabilities

- Per-business low-stock threshold configuration (D4 — deferred to future phase)
- Inventory adjustment queuing for offline mode (D2 — direct API call used per existing pattern; offline queueing could be added later)
- Barcode scanning integration for stock adjustment (POS scanner exists; not wired to inventory)
- Inventory transfer between branches (not in scope)
- Supplier reorder point automation (not in scope)

## 15. Backend Authoritative

The backend Inventory API (`apps/api/src/routes/inventory_routes.ts`, `inventory_service.ts`, `inventory_repository.ts`) remains the **authoritative source of truth** for all stock data:

- Mobile Drift cache is a derived/synced replica
- All adjustments go through `POST /adjustment` (server validates RBAC, quantity constraints, concurrency via `server_version`)
- No business database or business-logic duplicated in mobile
- Full-pull pattern (D1) ensures server state always wins on sync conflict
- Backend `LOW_STOCK_THRESHOLD = 5` constant used as source of truth for low-stock classification