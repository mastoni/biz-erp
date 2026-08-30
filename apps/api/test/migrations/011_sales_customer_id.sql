-- Phase 4.1.38E: Customer-Sales linkage
-- Adds optional customer_id to sales table for POS/reporting integration.

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_customer_id
  ON sales (customer_id);
