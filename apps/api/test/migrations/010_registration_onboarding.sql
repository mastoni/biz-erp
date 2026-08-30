-- Phase 4.1.38: Self-service onboarding
-- This migration does not alter existing tables.
-- It adds optional indexes to support registration queries.

CREATE INDEX IF NOT EXISTS idx_users_email
  ON users (email);
