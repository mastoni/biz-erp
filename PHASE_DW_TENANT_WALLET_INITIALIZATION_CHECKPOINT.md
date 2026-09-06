# DIGITAL WALLET TENANT ACCOUNT INITIALIZATION

## 1. Root Cause
When an `ACTIVE` business tenant with an `ACTIVE` subscription navigated to `/wallet`, the page displayed `"Digital Wallet Belum Diaktifkan"` because there were 0 records in `wallet_accounts` for that tenant. Although `walletService.createAccount()` existed, there was no lifecycle linkage to automatically initialize a default stored-value wallet account (`IDR`, `balance = 0`, `status = ACTIVE`) upon tenant creation, business approval, subscription activation, or on-demand tenant wallet access.

## 2. Existing Wallet Account Contract
- **Database Table**: `wallet_accounts`
- **Columns**: `id` (UUID PK), `account_customer_id` (UUID NOT NULL), `business_id` (UUID Nullable), `wallet_number` (TEXT UNIQUE `WAL-xxxx`), `currency` (VARCHAR(3) DEFAULT 'IDR'), `status` (VARCHAR(20) DEFAULT 'ACTIVE'), `balance` (BIGINT NOT NULL DEFAULT 0), `pending_credit` (BIGINT NOT NULL DEFAULT 0), `pending_debit` (BIGINT NOT NULL DEFAULT 0), `server_version` (BIGINT NOT NULL DEFAULT 1), `metadata` (JSONB NOT NULL DEFAULT '{}').
- **Constraints**: `uq_account_customer_currency UNIQUE (account_customer_id, currency)` and non-negative balance checks.
- **Contract Function**: `walletService.ensureTenantWallet(businessId, actorContext)` leverages `walletRepo.createAccount()` and `walletRepo.getAccountByCustomerAndCurrency()`.

## 3. Selected Lifecycle Hook
A multi-layered lifecycle hook was selected:
1. **Tenant On-Demand Access Gate (Primary Lazy Hook)**: In `GET /v1/wallets`, when an authenticated `OWNER` accesses their wallet list and 0 accounts exist, `walletService.ensureTenantWallet()` is invoked to safely and idempotently initialize the tenant's default wallet.
2. **Platform Approval Hook (Proactive Creation)**: In `platformService.approveBusiness()`, upon transitioning a business from `PENDING_REVIEW` to `ACTIVE`, `walletService.ensureTenantWallet()` is triggered after transaction commit.
3. **Subscription Activation Hook (Commercial Linkage)**: In `subscriptionService.activate()` and `subscriptionService.update()` (when transitioning to `ACTIVE`), `walletService.ensureTenantWallet()` is triggered after transaction commit.

## 4. Why This Lifecycle Was Selected
- **Universal Coverage**: Handles both future newly approved/subscribed tenants AND existing tenants (e.g. Kios KIARA) seamlessly without requiring dangerous manual SQL scripts in production.
- **Zero Financial Disruption**: Only creates a valid account with `balance = 0`. No ledger credit, no invoice, no payment.
- **Idempotent & Race-Safe**: Handles unique constraint collisions (`uq_account_customer_currency`) gracefully, returning the existing wallet account if concurrent requests occur.

## 5. Minimal Implementation
- `apps/api/src/services/wallet_service.ts`: Added `ensureTenantWallet(businessId, actorContext)` which verifies active business status, resolves/creates `account_customer_id`, checks for existing wallet, and atomically inserts the initial wallet account (`balance = 0`, `currency = IDR`, `status = ACTIVE`).
- `apps/api/src/routes/wallet_routes.ts`: In `GET /v1/wallets`, auto-ensures tenant wallet when 0 accounts are returned for an active tenant OWNER.
- `apps/api/src/services/platform_service.ts`: Added post-commit `ensureTenantWallet` in `approveBusiness`.
- `apps/api/src/services/subscription_service.ts`: Added post-commit `ensureTenantWallet` in `activate` and `update` (for `status = ACTIVE`).

## 6. Transaction Boundary
- The wallet account creation executes atomically.
- Post-commit execution ensures that business status changes are safely committed in the database before wallet initialization queries and linkages take place.
- If wallet creation encounters a race condition, it recovers by reading the atomically committed wallet.

## 7. Idempotency
- Multiple successive or concurrent calls to `ensureTenantWallet` return the identical existing wallet account.
- Database uniqueness constraint `uq_account_customer_currency` prevents duplicate wallet creation.

## 8. Tenant Isolation
- `business_id` is extracted strictly from the verified authentication JWT token (`authContext.businessId`).
- Cross-tenant lookups on `GET /v1/wallets/:id` continue to return `404 Not Found` for unauthorized tenants, preventing existence leaking.

## 9. Initial Balance Invariant
- Initial wallet balance is strictly `0` (zero).
- Verified in automated tests: `Number(wallet.balance) === 0`.

## 10. Financial Side-Effect Invariant
- Wallet initialization produces 0 entries in `wallet_ledgers`.
- Wallet initialization produces 0 entries in `top_up_intents`.
- Zero GL journal entries or accounts receivable/payable mutations.

## 11. Existing Tenant Handling
- When existing tenants (such as Kios KIARA) log in and open `/wallet`, `GET /v1/wallets` automatically initializes their zero-balance wallet account without manual production DB intervention.

## 12. Focused Test Scenarios
- `test/tenant_wallet_initialization.test.ts`:
  - Scenario A: ACTIVE business with missing wallet initializes wallet account.
  - Scenario B: ACTIVE business with existing wallet does not create duplicate.
  - Scenario C: Repeated initialization is idempotent.
  - Scenario D: Tenant isolation — Tenant A cannot initialize or access Tenant B wallet.
  - Scenario E: Initial wallet balance is exactly zero.
  - Scenario F: Initialization produces NO CREDIT ledger entries.
  - Scenario G: Initialization produces NO financial transactions or GL mutations.
  - Scenario H: Inactive/unapproved tenant cannot have a wallet created.
  - Scenario I: Concurrent initialization creates exactly one wallet account.
  - Scenario J: Existing tenant accessing `GET /v1/wallets` gets auto-initialized wallet.
  - Scenario K: Platform business approval automatically initializes wallet account.

## 13. Test Results
- `test/tenant_wallet_initialization.test.ts`: 11 passed (11/11) (100% PASS).
- `test/digital_wallet_api_dw1d.test.ts`: 18 passed (18/18) (100% PASS).

## 14. Typecheck Result
- `npm run typecheck --prefix apps/api`: 0 errors (Exit code 0).

## 15. Diff Scope
- `apps/api/src/routes/wallet_routes.ts`
- `apps/api/src/services/platform_service.ts`
- `apps/api/src/services/subscription_service.ts`
- `apps/api/src/services/wallet_service.ts`
- `apps/api/test/tenant_wallet_initialization.test.ts`
- `PHASE_DW_TENANT_WALLET_INITIALIZATION_CHECKPOINT.md`

## 16. Production Integrity
- Production environment untouched (no SSH, no direct DB edits, no manual INSERTs).
- Changes validated locally and scoped to official implementation gate.

## 17. Final Verdict
**PASS** — All invariants satisfied. Ready for single commit.
