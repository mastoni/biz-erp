-- Phase 3.5: Enforce barcode uniqueness per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_business_barcode_unique
ON products (business_id, barcode)
WHERE barcode IS NOT NULL AND barcode != '';
