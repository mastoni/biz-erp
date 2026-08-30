-- Phase 4.1.40B: Canonical Catalog + Module Foundation
-- Creates the canonical ERP Catalog + Module Foundation tables

-- 1. MODULES TABLE
CREATE TABLE IF NOT EXISTS modules (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pillar TEXT NOT NULL CHECK (pillar IN ('CONNECT', 'OPERATE', 'PROTECT', 'HARDWARE', 'SERVICES')),
    category TEXT NOT NULL,
    is_core BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEPRECATED', 'PLANNED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. MODULE FEATURES TABLE
CREATE TABLE IF NOT EXISTS module_features (
    module_code TEXT NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    default_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (module_code, code)
);

-- 3. MODULE DEPENDENCIES TABLE (DAG)
CREATE TABLE IF NOT EXISTS module_dependencies (
    module_code TEXT NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
    depends_on_module_code TEXT NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (module_code, depends_on_module_code)
);

-- 4. PLATFORM PRODUCTS CATALOG (platform-level products, not business inventory)
CREATE TABLE IF NOT EXISTS catalog_products (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('INTERNET', 'HARDWARE', 'SERVICE')),
    category TEXT NOT NULL,
    billing_model TEXT NOT NULL CHECK (billing_model IN ('RECURRING', 'ONE_TIME', 'USAGE', 'HYBRID')),
    base_price BIGINT NOT NULL CHECK (base_price >= 0), -- in minor units (cents/rupiah)
    currency TEXT NOT NULL DEFAULT 'IDR',
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 11.00,
    metadata JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEPRECATED', 'DRAFT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. PLANS TABLE
CREATE TABLE IF NOT EXISTS plans (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    family TEXT NOT NULL,
    tier TEXT NOT NULL,
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('MONTHLY', 'QUARTERLY', 'ANNUAL')),
    pricing JSONB NOT NULL, -- {base_price, discount, tax, final_price, currency}
    type TEXT NOT NULL CHECK (type IN ('STANDALONE', 'INCLUDED', 'TRIAL', 'PROMO', 'MIGRATION')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEPRECATED', 'DRAFT')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. PLAN_MODULES (M:N relationship between plans and modules)
CREATE TABLE IF NOT EXISTS plan_modules (
    plan_code TEXT NOT NULL REFERENCES plans(code) ON DELETE CASCADE,
    module_code TEXT NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
    feature_overrides JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (plan_code, module_code)
);

-- 8. BUNDLES TABLE
CREATE TABLE IF NOT EXISTS bundles (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pricing JSONB NOT NULL, -- {one_time, monthly, commitment_months}
    target_segment TEXT,
    installation_required BOOLEAN NOT NULL DEFAULT FALSE,
    installation_service_code TEXT,
    presentation_metadata JSONB NOT NULL DEFAULT '{}', -- display_name, description, target_segment, marketing_badge
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEPRECATED', 'DRAFT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. BUNDLE_ITEMS TABLE
CREATE TABLE IF NOT EXISTS bundle_items (
    id BIGSERIAL PRIMARY KEY,
    bundle_code TEXT NOT NULL REFERENCES bundles(code) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('PRODUCT', 'PLAN', 'SERVICE', 'HARDWARE')),
    item_code TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    required BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (bundle_code, item_type, item_code)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_modules_pillar ON modules(pillar);
CREATE INDEX IF NOT EXISTS idx_modules_status ON modules(status);
CREATE INDEX IF NOT EXISTS idx_module_dependencies_depends_on ON module_dependencies(depends_on_module_code);
CREATE INDEX IF NOT EXISTS idx_catalog_products_type ON catalog_products(type);
CREATE INDEX IF NOT EXISTS idx_catalog_products_status ON catalog_products(status);
CREATE INDEX IF NOT EXISTS idx_plans_family ON plans(family);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_plan_modules_module ON plan_modules(module_code);
CREATE INDEX IF NOT EXISTS idx_bundles_status ON bundles(status);
CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle ON bundle_items(bundle_code);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_modules_updated_at ON modules;
CREATE TRIGGER update_modules_updated_at
BEFORE UPDATE ON modules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_catalog_products_updated_at ON catalog_products;
CREATE TRIGGER update_catalog_products_updated_at
BEFORE UPDATE ON catalog_products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
CREATE TRIGGER update_plans_updated_at
BEFORE UPDATE ON plans
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bundles_updated_at ON bundles;
CREATE TRIGGER update_bundles_updated_at
BEFORE UPDATE ON bundles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Module Features updated_at trigger
DROP TRIGGER IF EXISTS update_module_features_updated_at ON module_features;
CREATE TRIGGER update_module_features_updated_at
BEFORE UPDATE ON module_features
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();