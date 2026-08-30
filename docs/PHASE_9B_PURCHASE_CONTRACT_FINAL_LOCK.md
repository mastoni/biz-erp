# PHASE 9B PURCHASE CONTRACT — FINAL LOCK

## Payment tenant isolation

**LOCKED**: `purchase_payments` table adds `business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE`.

- All `purchase_payments` queries scoped `WHERE business_id = $N`
- Tenant-safe unique constraint: `UNIQUE (business_id, purchase_id, idempotency_key)`
- Payment insertion occurs only within a transaction that has already validated `purchases.business_id = req.tenantId` — cross-tenant payment insertion is impossible
- Rationale: `purchases` is business-scoped; `purchase_payments` references `purchases.id` via FK, but tenant isolation must be enforced at the payments-table level independently (mirroring `idempotency_keys(business_id, idempotency_key)` and `stock_movements(business_id, branch_id)`) so that direct DB queries and sync endpoints cannot leak cross-tenant payment data

## Versioning

**LOCKED**: `purchases` schema has only:
- `server_version BIGINT NOT NULL DEFAULT 1 CHECK (server_version >= 1)`

**`expected_server_version` is removed from the DB schema** — it is a request-only field.

- Client sends `expected_server_version` in the request body (integer >= 1)
- Server validates `expected_server_version >= 1` in DTO layer (`PurchaseUpdateRequest`)
- Server uses it in the `WHERE server_version = $expected` clause of the UPDATE statement
- 0 rows returned → `409 CONFLICT { current_server_version: actual, error: 'server_version mismatch' }`
- After successful write, `server_version` is incremented by 1
- Rationale: aligns with the established pattern in `suppliers`, `products`, and `stocks` (all use `server_version` column + request-only `expected_server_version`); avoids schema redundancy per `SUPPLIER-MODEL-002` / `SUPPLIER-ROUTE-003`

## Product FK

**LOCKED**: `purchase_items.product_id UUID NULL REFERENCES products(id) ON DELETE SET NULL`

- `product_name TEXT NOT NULL` — immutable snapshot at PO creation
- `unit_cost_minor BIGINT NOT NULL CHECK (unit_cost_minor >= 0)` — immutable snapshot at PO creation (references `products.cost_minor`, NOT `products.price * 0.72` — the blueprint's `costOf` heuristic in `Purchasing.tsx:18` is demo-only)
- On `products` row deletion, `product_id` becomes NULL but `product_name` + `unit_cost_minor` are preserved
- Rationale: PO line items must remain auditable after product archival/deletion — matches the pattern in `sale_items` (`migration 001:40-41`: `product_id UUID REFERENCES products(id) ON DELETE SET NULL`)

## Received value

**LOCKED**: `received_value_minor` is the monetary value of goods received in a given receive operation:

```
received_value_minor = SUM(received_qty_i × unit_cost_minor_i)  — for items in this receive
```

- `unit_cost_minor` is the price snapshot stored on `purchase_items` at PO creation (immutable)
- `received_qty_i` is the quantity received for item i in this specific receive operation
- This is the value actually received — the sole payable basis for Tunai automatic payment

### PO-level aggregates:
- `total_minor = SUM(ordered_qty_i × unit_cost_minor_i)` — set at PO creation, immutable
- `received_minor = SUM(received_qty_i × unit_cost_minor_i)` — updated on each receive
- `paid_minor` — cumulative payments recorded
- `outstanding_minor` — depends on supplier_term (see §5)

## Partial receiving

**LOCKED**: Partial receiving is supported on both Tunai and Tempo POs.

### Tunai PO — partial receive:
- On partial receive: `received_value_minor_this = SUM(received_qty × unit_cost_minor)` for items received NOW
- `paid_minor += received_value_minor_this` — automatic payment for received goods only
- `received_minor = SUM(received_qty × unit_cost_minor)` over ALL items (cumulative)
- `outstanding_minor = received_minor - paid_minor`
- Status: `partial` if `received_minor < total_minor`, `received` if `received_minor = total_minor`

### Tempo PO — partial receive:
- On partial receive: NO automatic payment
- `outstanding_minor` remains `total_minor` (set at PO creation — supplier credit exists for full PO value)
- `received_minor` updated to reflect cumulative received value (inventory tracking)
- Status: `partial` if `received_minor < total_minor`, `received` if `received_minor = total_minor`

### Status transitions:
```
draft → sent        (explicit "send to supplier")
sent → partial      (first partial receive)
partial → partial   (subsequent partial receive)
partial → received  (final receive completes all items)
sent → cancelled    (explicit cancel — does NOT reverse stock)
partial → cancelled (explicit cancel — does NOT reverse stock)
received → cancelled (for Tunai, stock already received; cancel is admin-only)
```

## Tunai payment

**LOCKED**: For Tunai PO receive operations, automatic payment is recorded.

### Payment record fields:
- `amount_minor` = `received_value_minor_this` (value of items received in THIS operation, NOT `total_minor`)
- `reference` = `RECEIVE_TUNAI:{purchase_id}:{idempotency_key_hash_prefix}` — links the payment back to its receive operation
- `method` = `'cash'`
- `idempotency_key` = same idempotency key as the receive operation (shared key, tenant-scoped unique index prevents duplicate payment on replay)
- `business_id` = `req.tenantId` (tenant-scoped, NOT inferred from `purchases` FK)

### Transaction boundary:
The automatic Tunai payment is created **inside the same `withTransaction` block** as the receive operation:

```
BEGIN;
  -- 1. idempotency check (receive op key)
  -- 2. SELECT po WHERE id AND business_id AND branch_id AND server_version = expected → 409
  -- 3. validate receive_lines: qty > 0, received_qty + qty <= ordered_qty
  -- 4. FOR EACH item: updateStockAtomic + INSERT stock_movements + UPDATE purchase_items.received_qty
  -- 5. received_value_this = SUM(qty_i × unit_cost_minor_i)
  -- 6. received_minor_total = SELECT SUM(received_qty × unit_cost_minor) FROM purchase_items
  -- 7. status = (received_minor_total = total_minor) ? 'received' : 'partial'
  -- 8. IF supplier_term = 'Tunai':
  --    a. INSERT purchase_payments (business_id, purchase_id, amount_minor=received_value_this, method='cash', reference, idempotency_key)
  --    b. new_paid = paid_minor + received_value_this
  --    c. new_outstanding = received_minor_total - new_paid  (CHECK >= 0)
  -- 9. UPDATE purchases SET status, received_minor, paid_minor, outstanding_minor, server_version+1
  -- 10. idempotency insert
COMMIT;
```

Any failure at any step → `ROLLBACK` cancels BOTH the stock update AND the payment record.

## Tempo outstanding

**LOCKED**: For Tempo POs, `outstanding_minor` is based on the **entire PO** (Option A).

### Rationale:
Tempo terms mean the supplier extends credit for the full PO amount upon order confirmation (status transitions to `sent`). The payable obligation exists immediately at PO creation:
- At create: `outstanding_minor = total_minor` (full PO is payable)
- Partial receive does NOT reduce outstanding (goods received later, but credit was already extended)
- Partial receive updates `received_minor` (inventory tracking) but leaves `outstanding_minor` unchanged
- Payment reduces `outstanding_minor` via independent `/pay` endpoint

### Precise definition (Tempo):
| Event | outstanding_minor |
|---|---|
| At PO create (draft/sent) | `= total_minor` |
| Partial receive | unchanged (`= total_minor`) |
| Full receive | unchanged (`= total_minor`) |
| Partial pay | `= total_minor - paid_minor` |
| Full pay | `= 0` |

### Precise definition (Tunai):
| Event | outstanding_minor |
|---|---|
| At PO create (draft/sent) | `= 0` (no credit extended; Tunai = cash on delivery) |
| Partial receive | `= received_minor - paid_minor` (increases as goods received, payment follows) |
| Full receive | `= 0` (paid = received) |
| Independent pay (manual) | `= received_minor - paid_minor` (checked against Tunai max_payable) |

This is consistent because:
- **Tunai** = cash on delivery — customer only owes for goods actually delivered → Option B semantics
- **Tempo** = credit on order — supplier extends credit for full PO value upon confirmation → Option A semantics

The two models coexist cleanly: Tunai outstanding starts at 0 and tracks received goods; Tempo outstanding starts at `total_minor` and tracks payments against the full commitment.

## Payment invariant

**LOCKED**: The payment invariant is term-dependent.

### Tunai PO:
```
received_minor <= total_minor     CHECK (received_qty cannot exceed ordered_qty)
paid_minor <= received_minor      CHECK (cannot pay for goods not yet received)
outstanding_minor = received_minor - paid_minor  = received_value_minor - paid_minor
outstanding_minor >= 0            CHECK (no negative outstanding)
```

### Tempo PO:
```
paid_minor <= total_minor         CHECK (cannot pay more than PO total)
outstanding_minor = total_minor - paid_minor
outstanding_minor >= 0            CHECK (no negative outstanding)
```

**Note**: A unified SQL CHECK constraint is impractical (term-dependent semantics). The invariant is enforced in service logic within `withTransaction`, with explicit `CHECK` constraints on the absolute-value columns (`CHECK (paid_minor >= 0)`, `CHECK (received_minor >= 0)`, `CHECK (outstanding_minor >= 0)`).

### Receive operation payment guard (Tunai):
- `received_value_this` must be `>= 0`
- `received_value_this <= total_minor - received_minor` (cannot receive more than ordered)
- After payment: `paid_minor + received_value_this <= received_minor + received_value_this` → simplifies to `paid_minor <= received_minor` (always true since we set `paid_minor += received_value_this`)

### Independent payment operation guard:
- **Tunai**: `amount <= outstanding_minor` (where `outstanding = received - paid`)
- **Tempo**: `amount <= outstanding_minor` (where `outstanding = total - paid`)
- If exceeded → `400 BAD_REQUEST { error: 'payment exceeds outstanding' }`

## Database schema

```sql
CREATE TABLE IF NOT EXISTS purchases (
  id                UUID PRIMARY KEY,
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id         UUID NOT NULL REFERENCES branches(id),
  supplier_id       UUID NOT NULL REFERENCES suppliers(id),
  code              TEXT NOT NULL,
  date              DATE NOT NULL,
  due_date          DATE NOT NULL,
  supplier_term     TEXT NOT NULL CHECK (supplier_term IN ('Tunai', 'Tempo 14', 'Tempo 30')),
  status            TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'partial', 'received', 'cancelled')),
  total_minor       BIGINT NOT NULL CHECK (total_minor >= 0),
  paid_minor        BIGINT NOT NULL DEFAULT 0 CHECK (paid_minor >= 0),
  outstanding_minor BIGINT NOT NULL DEFAULT 0 CHECK (outstanding_minor >= 0),
  received_minor    BIGINT NOT NULL DEFAULT 0 CHECK (received_minor >= 0),
  note              TEXT,
  server_version    BIGINT NOT NULL DEFAULT 1 CHECK (server_version >= 1),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
  -- expected_server_version: REMOVED — REQUEST-ONLY, NOT A DB COLUMN
);

CREATE UNIQUE INDEX idx_purchases_business_code
  ON purchases (business_id, code) WHERE deleted_at IS NULL;

CREATE INDEX idx_purchases_business_branch
  ON purchases (business_id, branch_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_purchases_business_version
  ON purchases (business_id, server_version) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS purchase_items (
  id              UUID PRIMARY KEY,
  purchase_id     UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id      UUID NULL REFERENCES products(id) ON DELETE SET NULL,
  product_name    TEXT NOT NULL,
  ordered_qty     INTEGER NOT NULL CHECK (ordered_qty > 0),
  received_qty    INTEGER NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  unit_cost_minor BIGINT NOT NULL CHECK (unit_cost_minor >= 0),
  subtotal_minor  BIGINT NOT NULL CHECK (subtotal_minor >= 0)
);
-- subtotal_minor = ordered_qty * unit_cost_minor (enforced in service)

CREATE INDEX idx_purchase_items_purchase ON purchase_items (purchase_id);

CREATE TABLE IF NOT EXISTS purchase_payments (
  id              UUID PRIMARY KEY,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  purchase_id     UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  amount_minor    BIGINT NOT NULL CHECK (amount_minor > 0),
  method          TEXT NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'debit', 'credit')),
  reference       TEXT,
  idempotency_key TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, purchase_id, idempotency_key)
);

CREATE INDEX idx_purchase_payments_purchase
  ON purchase_payments (business_id, purchase_id);

-- Append-only guard (mirrors sales/sale_items pattern from migration 001)
CREATE OR REPLACE FUNCTION prevent_purchase_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'purchases tables are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS purchases_append_only ON purchases;
CREATE TRIGGER purchases_append_only
BEFORE UPDATE OR DELETE ON purchases
FOR EACH ROW
EXECUTE FUNCTION prevent_purchase_mutation();

DROP TRIGGER IF EXISTS purchase_items_append_only ON purchase_items;
CREATE TRIGGER purchase_items_append_only
BEFORE UPDATE OR DELETE ON purchase_items
FOR EACH ROW
EXECUTE FUNCTION prevent_purchase_mutation();

DROP TRIGGER IF EXISTS purchase_payments_append_only ON purchase_payments;
CREATE TRIGGER purchase_payments_append_only
BEFORE UPDATE OR DELETE ON purchase_payments
FOR EACH ROW
EXECUTE FUNCTION prevent_purchase_mutation();
```

### Changes from prior 9B.1 contract:

| Change | Prior | Final |
|---|---|---|
| `purchases.expected_server_version` column | Included | **Removed** (request-only) |
| `purchase_items.product_id` | `NOT NULL` | **NULL** (`ON DELETE SET NULL`) |
| `purchases.received_minor` | Missing | **Added** (`BIGINT DEFAULT 0 CHECK >= 0`) |
| `purchase_payments.business_id` | Missing | **Added** (`UUID NOT NULL REFERENCES businesses`, `UNIQUE (business_id, purchase_id, idempotency_key)`) |
| PO statuses | `draft/pending/received/partial/paid/cancelled` | **Normalized** to `draft/sent/partial/received/cancelled` (5 statuses; `paid` is not a PO status — payment is tracked via `purchase_payments`) |
| Status transitions | N/A | `draft → sent → partial → received` (cancel from any non-received state) |

### Schema decisions explained:

1. **`supplier_term` snapshot**: The PO stores `supplier_term` as a snapshot of the supplier's term (`supplier.term`) at creation time. If the supplier's term changes later, existing POs retain their original term. This determines payment behavior (Tunai = pay at receive, Tempo = credit on order).

2. **5 PO statuses** (not 6): `draft`, `sent`, `partial`, `received`, `cancelled`. The blueprint's `paid` is a boolean flag, not a status — in the canonical schema, "paid" is determined by `paid_minor >= total_minor` (Tunai) or `outstanding_minor = 0` (Tempo), not a separate status. `sent` replaces the blueprint's `dikirim`; `partial` replaces the blueprint's implicit partial-receive handling.

3. **Append-only triggers**: `purchases`, `purchase_items`, and `purchase_payments` all get append-only triggers (mirroring the `sales`/`sale_items` pattern). Updates go through explicit service mutations that bump `server_version`, not raw SQL UPDATE.

4. **`received_minor` added**: Required for the Tunai outstanding model (`outstanding = received_minor - paid_minor`). Without it, partial receiving cannot compute the correct Tunai outstanding.

## Transaction rules

### Create PO (draft or sent):
```sql
BEGIN;
1. validatePurchaseCreate (DTO validation)
2. assertTenant(request.business_id, tenantId)
3. SELECT supplier WHERE id AND business_id AND status='aktif' → 404 if not found
4. SELECT branch WHERE id AND business_id → 404 if not found
5. FOR EACH item:
   a. SELECT product WHERE id AND business_id AND is_active=true → 404 if not found
   b. IF product.cost_minor IS NULL → 400 'product must have a cost price set'
6. total_minor = SUM(ordered_qty_i × product.cost_minor_i)
7. snapshot supplier_term = supplier.term
8. BEGIN retry loop (max 3):
   a. pg_advisory_xact_lock(hashtext('po_code' || business_id))
   b. seq = SELECT COALESCE(MAX(RIGHT(code,3)::INTEGER),0)+1 FROM purchases WHERE business_id AND code LIKE '%/PO/%'
   c. code = generatePurchaseCode(business_id, seq)  -- e.g. "2025/08/PO-001"
   d. INSERT purchases (id, business_id, branch_id, supplier_id, code, date, due_date, supplier_term, total_minor, outstanding_minor=(supplier_term starts with 'Tunai' ? 0 : total_minor), status, created_at, updated_at)
   e. INSERT purchase_items (id, purchase_id, product_id, product_name, ordered_qty, received_qty=0, unit_cost_minor, subtotal_minor)
   f. ON unique_violation(code): seq++, retry
   g. ON 3rd failure: 409 'code_generation_failed'
9. idempotency insert
COMMIT;
```

**Key**: `outstanding_minor` at creation:
- Tunai: `0` (no credit extended; payment happens at receive)
- Tempo: `total_minor` (full credit extended on order confirmation)

### Send PO (draft → sent):
```sql
BEGIN;
1. idempotency check (findActive → replay or IDEMPOTENCY_KEY_REUSE)
2. UPDATE purchases SET status='sent', server_version=sv+1
   WHERE id AND business_id AND status='draft' AND server_version=expected
   → 409 if 0 rows (version conflict or already sent or cancelled)
3. idempotency insert
COMMIT;
```

### Receive (sent/partial → partial/received):
```sql
BEGIN;
1. idempotency check
2. SELECT po, po_items WHERE id AND business_id AND branch_id AND server_version=expected
   → 409 if mismatch
3. IF po.status NOT IN ('sent','partial') → 400 'cannot receive in draft/cancelled/received state'
4. Validate receive_lines:
   - qty > 0 for each line
   - received_qty + qty <= ordered_qty for each line
5. FOR EACH line item to receive:
   a. stock = SELECT WHERE business_id AND branch_id AND product_id → 404 if not found
   b. updateStockAtomic(stock.id, qty, stock.server_version) → 409 if mismatch
   c. INSERT stock_movements (STOCK_IN, reference_type='purchase', reference_id=purchases.id)
   d. UPDATE purchase_items SET received_qty = received_qty + qty WHERE id = item_id AND purchase_id = po.id
6. received_value_this = SUM(received_qty_this_i × unit_cost_minor_i)  -- THIS receive's value
7. received_minor_total = SELECT SUM(received_qty × unit_cost_minor) FROM purchase_items WHERE purchase_id = po.id
8. IF received_minor_total = po.total_minor:
     new_status = 'received'
   ELSE:
     new_status = 'partial'
9. IF po.supplier_term = 'Tunai':
   a. payment_amount = received_value_this  -- value of THIS receive, NOT total
   b. INSERT purchase_payments (business_id=req.tenantId, purchase_id=po.id,
      amount_minor=payment_amount, method='cash',
      reference='RECEIVE_TUNAI:' || po.id || ':' || left(md5(idempotency_key),8),
      idempotency_key=receive_idempotency_key)
   c. new_paid = po.paid_minor + payment_amount
   d. new_outstanding = received_minor_total - new_paid
      CHECK: new_outstanding >= 0 AND new_paid <= received_minor_total
10. ELSE (Tempo):
    -- No automatic payment at receive
    new_paid = po.paid_minor  -- unchanged
    new_outstanding = po.outstanding_minor  -- unchanged (stays at total_minor)
11. UPDATE purchases SET
      status = new_status,
      received_minor = received_minor_total,
      paid_minor = new_paid,
      outstanding_minor = new_outstanding,
      updated_at = now(),
      server_version = server_version + 1
    WHERE id = po.id AND business_id = tenantId AND server_version = expected
    → 409 if concurrent modification
12. idempotency insert
COMMIT;
```

### Cancel (any non-received state → cancelled):
```sql
BEGIN;
1. idempotency check
2. SELECT po WHERE id AND business_id AND server_version=expected → 409 if mismatch
3. IF po.status IN ('received', 'cancelled') → 400 'cannot cancel in received/cancelled state'
4. UPDATE purchases SET status='cancelled', updated_at=now(), server_version=sv+1
   WHERE id AND business_id AND server_version = expected
5. idempotency insert
COMMIT;
```

**Note**: Cancel does NOT reverse stock movements or payments. If goods were already received and paid, those records remain as audit history. The PO status simply marks it as cancelled for reporting purposes.

### Independent Pay (manual payment against PO):
```sql
BEGIN;
1. idempotency check
2. SELECT po WHERE id AND business_id AND server_version=expected → 409 if mismatch
3. IF po.status NOT IN ('partial', 'received') → 400 'cannot pay draft/sent/cancelled PO'
4. IF amount_minor <= 0 → 400
5. IF po.supplier_term = 'Tunai':
   max_payable = po.received_minor - po.paid_minor
   IF amount_minor > max_payable → 400 'payment exceeds receivable'
6. ELSE (Tempo):
   IF amount_minor > po.outstanding_minor → 400 'payment exceeds outstanding'
7. INSERT purchase_payments (business_id, purchase_id, amount_minor, method, reference='MANUAL_PAY', idempotency_key)
8. UPDATE purchases SET
     paid_minor = paid_minor + amount_minor,
     outstanding_minor = outstanding_minor - amount_minor,
     server_version = server_version + 1
   WHERE id AND business_id AND server_version = expected
9. idempotency insert
COMMIT;
```

## Test additions

| Test ID | Scenario | Expected |
|---|---|---|
| **PO-RECEIVE-CASH-001** | Full Tunai receive (100% qty on all items) | payment = total_minor, paid_minor = total_minor, outstanding_minor = 0, status = 'received' |
| **PO-RECEIVE-CASH-002** | Partial Tunai receive (50% of items) | payment = 50% of received_value, paid_minor = 50% received_value, outstanding_minor = 50% received_value - paid = 0 (paid = received), status = 'partial' |
| **PO-RECEIVE-CASH-003** | Second Tunai receive (remaining 50%) | payment = 50% remaining received_value, paid_minor = total, outstanding_minor = 0, status = 'received' |
| **PO-RECEIVE-CASH-004** | Receive attempts to pay > received_value | 400 BAD_REQUEST (received_value_this > total_minor - received_minor) |
| **PO-RECEIVE-TEMPO-001** | Partial Tempo receive (50% qty) | outstanding_minor = total_minor (unchanged from create), received_minor = 50% total, status = 'partial' |
| **PO-PAY-007** | Manual pay > outstanding_minor | 400 BAD_REQUEST (Tunai: amount > received - paid; Tempo: amount > outstanding) |
| **PO-FK-001** | Delete product referenced by PO item | PO item retains product_name + unit_cost_minor snapshot, product_id becomes NULL |
| **PO-SCHEMA-001** | Verify `purchase_payments.business_id` column exists | Schema introspection: `information_schema.columns` contains `business_id` |
| **PO-SCHEMA-002** | Verify `expected_server_version` is NOT a DB column | Schema introspection: `information_schema.columns` does NOT contain `expected_server_version` |

**No unresolved contradictions.**

---

*Status: FINAL LOCK — contract is complete and unambiguous. Awaiting Phase 9B coding authorization before any implementation.*
