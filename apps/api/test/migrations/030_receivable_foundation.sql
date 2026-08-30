-- Phase 9C.6C: Receivable Foundation
-- Adds RECEIVABLE and CUSTOMER_PAYMENT source types to journal_entries.
-- Creates receivables and customer_payments tables.
-- Self-contained and idempotent.

-- ============================================================================
-- 1. Finance Core Amendment: extend journal_entries.source_type CHECK
-- ============================================================================

ALTER TABLE journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_source_type_check;

ALTER TABLE journal_entries
  ADD CONSTRAINT journal_entries_source_type_check
  CHECK (source_type IN (
    'SALE',
    'PURCHASE_PAYMENT',
    'EXPENSE',
    'INCOME',
    'RECEIVABLE',
    'CUSTOMER_PAYMENT',
    'REVERSAL'
  ));

-- ============================================================================
-- 2. Receivables Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS receivables (
  id                UUID PRIMARY KEY,
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sale_id           UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  branch_id         UUID NULL REFERENCES branches(id) ON DELETE RESTRICT,
  amount_minor      BIGINT NOT NULL CHECK (amount_minor > 0),
  paid_minor        BIGINT NOT NULL DEFAULT 0 CHECK (paid_minor >= 0),
  outstanding_minor BIGINT NOT NULL,
  date              DATE NOT NULL,
  reference         TEXT NULL,
  description       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'PARTIAL', 'PAID', 'REVERSED')),
  server_version    BIGINT NOT NULL DEFAULT 1 CHECK (server_version >= 1),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ NULL,
  CONSTRAINT chk_receivable_balance
    CHECK (outstanding_minor + paid_minor = amount_minor),
  CONSTRAINT chk_receivable_outstanding_nonneg
    CHECK (outstanding_minor >= 0)
);

-- ============================================================================
-- 3. Receivable Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_receivables_business_id
  ON receivables (business_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_receivables_business_sale_id
  ON receivables (business_id, sale_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_receivables_business_customer_id
  ON receivables (business_id, customer_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_receivables_business_status
  ON receivables (business_id, status) WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. Customer Payments Table (append-only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_payments (
  id              UUID PRIMARY KEY,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  receivable_id   UUID NOT NULL REFERENCES receivables(id) ON DELETE RESTRICT,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  branch_id       UUID NULL REFERENCES branches(id) ON DELETE RESTRICT,
  amount_minor    BIGINT NOT NULL CHECK (amount_minor > 0),
  method          TEXT NOT NULL CHECK (
    method IN ('cash', 'bank_transfer', 'debit', 'credit')
  ),
  reference       TEXT NULL,
  idempotency_key TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, idempotency_key)
);

-- ============================================================================
-- 5. Customer Payment Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_customer_payments_business_id
  ON customer_payments (business_id);

CREATE INDEX IF NOT EXISTS idx_customer_payments_receivable_id
  ON customer_payments (business_id, receivable_id);

CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id
  ON customer_payments (business_id, customer_id);

-- ============================================================================
-- 6. Append-only protection for customer_payments
-- ============================================================================

CREATE OR REPLACE FUNCTION customer_payments_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'customer_payments rows are append-only and cannot be modified or deleted';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_payments_protection ON customer_payments;
CREATE TRIGGER customer_payments_protection
  BEFORE UPDATE OR DELETE ON customer_payments
  FOR EACH ROW
  EXECUTE FUNCTION customer_payments_append_only();

-- ============================================================================
-- 7. Physical delete protection for receivables
-- ============================================================================

CREATE OR REPLACE FUNCTION receivables_delete_protection()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'receivables cannot be physically deleted; use status transitions instead';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS receivables_delete_protection ON receivables;
CREATE TRIGGER receivables_delete_protection
  BEFORE DELETE ON receivables
  FOR EACH ROW
  EXECUTE FUNCTION receivables_delete_protection();
