-- Phase 9C.9B: Cash Purchase Foundation
-- Adds PURCHASE to journal_entries.source_type CHECK constraint.
-- This enables cash (Tunai) purchase accounting.

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
    'PURCHASE',
    'REVERSAL'
  ));

-- ============================================================================
-- 2. purchase_payments.branch_id (nullable, inherited from purchase)
-- This migration is already done by 031_payable_foundation.sql
-- ============================================================================

-- ============================================================================
-- 3. Append-only protection for purchase_payments
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
