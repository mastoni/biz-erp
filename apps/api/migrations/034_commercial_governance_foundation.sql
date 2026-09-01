-- Phase SA-2.1: Commercial Governance & Showcase Foundation
-- Additive enhancements for Plans, Bundles, Catalog Products, and Landing Showcase

-- 1. PLANS ENHANCEMENTS
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS limits JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trial_days INTEGER NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);

CREATE INDEX IF NOT EXISTS idx_plans_published ON plans(status, is_published);
CREATE INDEX IF NOT EXISTS idx_plans_display_order ON plans(display_order);

-- 2. BUNDLES ENHANCEMENTS
ALTER TABLE bundles
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);

CREATE INDEX IF NOT EXISTS idx_bundles_published ON bundles(status, is_published);
CREATE INDEX IF NOT EXISTS idx_bundles_display_order ON bundles(display_order);

-- 3. CATALOG PRODUCTS ENHANCEMENTS
ALTER TABLE catalog_products
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);

CREATE INDEX IF NOT EXISTS idx_catalog_products_published ON catalog_products(status, is_published);
CREATE INDEX IF NOT EXISTS idx_catalog_products_display_order ON catalog_products(display_order);

-- 4. LANDING SHOWCASE ITEMS TABLE
CREATE TABLE IF NOT EXISTS showcase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section TEXT NOT NULL CHECK (section IN ('HERO_FEATURED', 'ERP_PLANS', 'ISP_PLANS', 'BUNDLES', 'HARDWARE', 'PROMOS')),
    item_type TEXT NOT NULL CHECK (item_type IN ('PLAN', 'BUNDLE', 'CATALOG_PRODUCT', 'CUSTOM')),
    plan_code TEXT REFERENCES plans(code) ON DELETE CASCADE,
    bundle_code TEXT REFERENCES bundles(code) ON DELETE CASCADE,
    catalog_product_code TEXT REFERENCES catalog_products(code) ON DELETE CASCADE,
    custom_item_code TEXT,
    display_name TEXT NOT NULL,
    headline TEXT,
    description TEXT,
    marketing_badge TEXT,
    features_list JSONB NOT NULL DEFAULT '[]',
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    cta_text TEXT NOT NULL DEFAULT 'Pilih Paket',
    cta_url TEXT NOT NULL DEFAULT '/register',
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_showcase_item_target_integrity CHECK (
        (item_type = 'PLAN' AND plan_code IS NOT NULL AND bundle_code IS NULL AND catalog_product_code IS NULL AND custom_item_code IS NULL) OR
        (item_type = 'BUNDLE' AND bundle_code IS NOT NULL AND plan_code IS NULL AND catalog_product_code IS NULL AND custom_item_code IS NULL) OR
        (item_type = 'CATALOG_PRODUCT' AND catalog_product_code IS NOT NULL AND plan_code IS NULL AND bundle_code IS NULL AND custom_item_code IS NULL) OR
        (item_type = 'CUSTOM' AND custom_item_code IS NOT NULL AND plan_code IS NULL AND bundle_code IS NULL AND catalog_product_code IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_showcase_items_section_published ON showcase_items(section, is_published, display_order);
CREATE INDEX IF NOT EXISTS idx_showcase_items_plan ON showcase_items(plan_code);
CREATE INDEX IF NOT EXISTS idx_showcase_items_bundle ON showcase_items(bundle_code);
CREATE INDEX IF NOT EXISTS idx_showcase_items_catalog_product ON showcase_items(catalog_product_code);

-- 5. UPDATED_AT TRIGGER FOR SHOWCASE ITEMS
DROP TRIGGER IF EXISTS update_showcase_items_updated_at ON showcase_items;
CREATE TRIGGER update_showcase_items_updated_at
BEFORE UPDATE ON showcase_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
