-- Phase 8E: Canonical Product Master Image Contract
-- Adds image_url column to products table

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url TEXT;
