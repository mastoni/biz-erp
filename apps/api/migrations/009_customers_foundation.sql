-- Phase 4.1.11B: Customer domain foundation
-- Creates customers table with tenant-scoped soft delete.

CREATE TABLE IF NOT EXISTS customers (
  id          UUID        PRIMARY KEY,
  business_id UUID        NOT NULL REFERENCES businesses(id),
  name        TEXT        NOT NULL,
  phone       TEXT,
  email       TEXT,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial index: tenant lookup of active customers
CREATE INDEX IF NOT EXISTS idx_customers_business_id
  ON customers (business_id)
  WHERE deleted_at IS NULL;

-- Partial index: tenant + name lookup of active customers
CREATE INDEX IF NOT EXISTS idx_customers_business_name
  ON customers (business_id, name)
  WHERE deleted_at IS NULL;
