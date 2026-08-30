CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  description TEXT,
  price_minor BIGINT NOT NULL CHECK (price_minor >= 0),
  category TEXT,
  barcode TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  server_version BIGINT NOT NULL DEFAULT 1 CHECK (server_version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  receipt_number TEXT NOT NULL,
  subtotal_minor BIGINT CHECK (subtotal_minor >= 0),
  discount_minor BIGINT CHECK (discount_minor >= 0),
  tax_minor BIGINT CHECK (tax_minor >= 0),
  total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
  payment_method TEXT,
  paid_minor BIGINT CHECK (paid_minor >= 0),
  change_minor BIGINT CHECK (change_minor >= 0),
  cashier_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_created_at TIMESTAMPTZ,
  server_created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
  subtotal_minor BIGINT NOT NULL CHECK (subtotal_minor >= 0)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  business_id UUID NOT NULL REFERENCES businesses(id),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (business_id, idempotency_key)
);

CREATE OR REPLACE FUNCTION prevent_sales_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'sales tables are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sales_append_only ON sales;
CREATE TRIGGER sales_append_only
BEFORE UPDATE OR DELETE ON sales
FOR EACH ROW
EXECUTE FUNCTION prevent_sales_mutation();

DROP TRIGGER IF EXISTS sale_items_append_only ON sale_items;
CREATE TRIGGER sale_items_append_only
BEFORE UPDATE OR DELETE ON sale_items
FOR EACH ROW
EXECUTE FUNCTION prevent_sales_mutation();