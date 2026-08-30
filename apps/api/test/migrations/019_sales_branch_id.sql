-- Phase 4.1.41C: Add branch_id to sales for inventory stock deduction
-- Adds required branch_id to sales table with FK to branches(id)
-- New sales MUST have branch_id. Existing historical rows remain nullable.

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT;

-- For new sales, branch_id will be required at application level
-- Create index for branch-based queries
CREATE INDEX IF NOT EXISTS idx_sales_branch_id
  ON sales (branch_id);