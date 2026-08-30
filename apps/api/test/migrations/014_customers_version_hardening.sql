-- Phase 4.1.39 Track B0: Customer mutation hardening
-- 1. Change default server_version for NEW rows to 1
ALTER TABLE customers ALTER COLUMN server_version SET DEFAULT 1;

-- 2. Backfill existing rows with server_version = 0 to 1
UPDATE customers SET server_version = 1 WHERE server_version = 0;

-- 3. Add CHECK constraint (server_version >= 1) - aligns with products table
ALTER TABLE customers ADD CONSTRAINT customers_server_version_positive CHECK (server_version >= 1);

-- 4. Ensure deleted_at is included in sync queries (no code change needed, just documentation)
-- The sync query in customer_repository.findByBusinessAfter will be modified to remove
-- the "deleted_at IS NULL" filter so that soft-deleted customers appear as tombstones.