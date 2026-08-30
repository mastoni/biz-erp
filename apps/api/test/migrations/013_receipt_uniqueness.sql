-- Phase 4.1.39 Track A: Receipt Integrity
-- Enforce unique receipt numbers per business to prevent multi-device duplicates.

-- Pre-check: halt if duplicates exist
-- SELECT business_id, receipt_number, COUNT(*) AS cnt
-- FROM sales
-- GROUP BY business_id, receipt_number
-- HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_business_receipt
  ON sales (business_id, receipt_number);
