-- Phase 9C.7C: Payable Foundation
-- Amends journal_entries.source_type CHECK with PAYABLE.
-- Adds branch_id to purchase_payments.
-- Re-applies append-only trigger for self-containment.
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
    'PAYABLE',
    'REVERSAL'
  ));

-- ============================================================================
-- 2. purchase_payments.branch_id (nullable, inherited from purchase)
-- ============================================================================

ALTER TABLE purchase_payments
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL
  REFERENCES branches(id) ON DELETE RESTRICT;

-- ============================================================================
-- 3. Append-only protection for purchase_payments
--    (re-applied for self-containment; existing trigger retained by DROP IF EXISTS)
-- ============================================================================

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
