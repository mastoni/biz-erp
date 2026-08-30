-- Phase 4.1.41B-1: Platform Identity Foundation
-- Additive, non-breaking change.
-- Adds nullable platform_role to users for the Platform Control Plane identity model.
-- Existing rows keep platform_role = NULL (no backfill required).
-- user_businesses is intentionally NOT changed:
--   role stays OWNER | CASHIER, business_id stays NOT NULL.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS platform_role TEXT
  CHECK (
    platform_role IS NULL
    OR platform_role IN ('PLATFORM_ADMIN', 'SUPER_ADMIN')
  );
