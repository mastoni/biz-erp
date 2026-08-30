-- Phase 9B: Purchase Order and Receiving foundation
-- Creates purchases, purchase_items, and purchase_payments tables.

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
);

-- Unique PO code per business (for non-deleted POs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_business_code
  ON purchases (business_id, code) WHERE deleted_at IS NULL;

-- Branch lookup for purchases
CREATE INDEX IF NOT EXISTS idx_purchases_business_branch
  ON purchases (business_id, branch_id) WHERE deleted_at IS NULL;

-- Supplier lookup for purchases
CREATE INDEX IF NOT EXISTS idx_purchases_business_supplier
  ON purchases (business_id, supplier_id) WHERE deleted_at IS NULL;

-- Version lookup for sync pagination
CREATE INDEX IF NOT EXISTS idx_purchases_business_version
  ON purchases (business_id, server_version) WHERE deleted_at IS NULL;

-- Purchase line items
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

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase
  ON purchase_items (purchase_id);

CREATE INDEX IF NOT EXISTS idx_purchase_items_product
  ON purchase_items (product_id);

-- Purchase payments (append-only)
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

CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase
  ON purchase_payments (business_id, purchase_id);

-- Append-only trigger on purchase_payments
CREATE OR REPLACE FUNCTION prevent_purchase_payment_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'purchase_payments table is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS purchase_payments_append_only ON purchase_payments;
CREATE TRIGGER purchase_payments_append_only
BEFORE UPDATE OR DELETE ON purchase_payments
FOR EACH ROW
EXECUTE FUNCTION prevent_purchase_payment_mutation();
