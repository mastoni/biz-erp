CREATE INDEX IF NOT EXISTS idx_products_business_id
  ON products (business_id);

CREATE INDEX IF NOT EXISTS idx_products_business_barcode
  ON products (business_id, barcode);

CREATE INDEX IF NOT EXISTS idx_products_business_server_version
  ON products (business_id, server_version);

CREATE INDEX IF NOT EXISTS idx_sales_business_id
  ON sales (business_id);

CREATE INDEX IF NOT EXISTS idx_sales_business_server_created_at
  ON sales (business_id, server_created_at);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id
  ON sale_items (sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_product_id
  ON sale_items (product_id);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
  ON idempotency_keys (expires_at);