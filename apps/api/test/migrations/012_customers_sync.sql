-- Phase 4.1.38 Track I: Add server_version to customers for sync
ALTER TABLE customers ADD COLUMN IF NOT EXISTS server_version INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_customers_business_server_version
  ON customers (business_id, server_version)
  WHERE deleted_at IS NULL;
