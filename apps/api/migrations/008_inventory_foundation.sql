CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  status BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_branches_business_id ON branches(business_id);

CREATE TABLE IF NOT EXISTS stocks (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  server_version BIGINT NOT NULL DEFAULT 1 CHECK (server_version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_stocks_business_branch ON stocks(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_stocks_product ON stocks(product_id);

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  movement_type TEXT NOT NULL,
  reference TEXT,
  actor TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_lookup ON stock_movements(business_id, branch_id, product_id);

CREATE OR REPLACE FUNCTION prevent_movement_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements tables are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stock_movements_append_only ON stock_movements;
CREATE TRIGGER stock_movements_append_only
BEFORE UPDATE OR DELETE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION prevent_movement_mutation();
