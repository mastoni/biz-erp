-- Phase 6B: Customers Contract & Backend Foundation — Tier & Loyalty Points

-- 1. Add tier column with default 'Reguler' and CHECK constraint
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'Reguler'
  CHECK (tier IN ('Reguler', 'Silver', 'Gold'));

-- 2. Add points column with default 0 and non-negative CHECK constraint
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0
  CHECK (points >= 0);

-- 3. Create index for tier filtering / counting per business
CREATE INDEX IF NOT EXISTS idx_customers_business_tier
  ON customers (business_id, tier)
  WHERE deleted_at IS NULL;
