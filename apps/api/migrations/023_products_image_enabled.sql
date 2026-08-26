-- Phase 8G: Product Media Management
-- Adds image_enabled column to products table

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_enabled BOOLEAN NOT NULL DEFAULT FALSE;
