-- Phase 9A.1: Supplier domain foundation
-- Creates suppliers table with tenant-scoped soft delete.

CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID        PRIMARY KEY,
  business_id   UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code          TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  contact       TEXT,
  phone         TEXT,
  email         TEXT,
  category      TEXT,
  term          TEXT        NOT NULL DEFAULT 'Tunai' CHECK (term IN ('Tunai', 'Tempo 14', 'Tempo 30')),
  status        TEXT        NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  server_version INTEGER     NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

-- Uniqueness: supplier code must be unique per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_business_code
  ON suppliers (business_id, code);

-- Partial index: tenant lookup of active suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_business_id
  ON suppliers (business_id)
  WHERE deleted_at IS NULL;

-- Partial index: tenant + name lookup of active suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_business_name
  ON suppliers (business_id, name)
  WHERE deleted_at IS NULL;

-- Partial index: sync pagination by server_version
CREATE INDEX IF NOT EXISTS idx_suppliers_business_version
  ON suppliers (business_id, server_version)
  WHERE deleted_at IS NULL;
