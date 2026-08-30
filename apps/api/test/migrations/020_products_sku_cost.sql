-- Phase 3B.1: Product Master Contract — SKU and HPP/cost

-- 1. Add sku column (nullable, optional, unique per tenant)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sku TEXT;

-- Tenant-scoped unique index for SKU (same pattern as barcode, migration 006)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_business_sku_unique
  ON products (business_id, sku)
  WHERE sku IS NOT NULL AND sku != '';

-- 2. Add cost_minor column (HPP / purchase cost in minor currency units, nullable)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_minor BIGINT
  CHECK (cost_minor >= 0);
