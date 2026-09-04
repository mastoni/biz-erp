-- Phase: Canonical ERP UMKM & Grosir Commercial Bundles (Migration 045)
-- Seeds canonical ERP POS hardware, accessories, installation service, and sales bundles combining ERP software plans with physical equipment.
-- Uses ON CONFLICT DO NOTHING to ensure idempotency and preserve existing records.

-- ============================================================================
-- 1. SUBSCRIPTION FAMILIES, SERVICES & CANONICAL ERP PLANS PRESERVATION / SEED
-- ============================================================================

INSERT INTO subscription_families (code, name, replacement_policy, description)
VALUES ('ERP_PLAN', 'ERP Plan', 'REPLACEABLE', 'Core ERP plans - only one active per business')
ON CONFLICT (code) DO NOTHING;

INSERT INTO services (code, name, category, service_type, owner, lifecycle_status, public_visibility)
VALUES ('ERP', 'Enterprise Resource Planning', 'OPERATIONS', 'INTERNAL', 'PLATFORM', 'ACTIVE', FALSE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO plans (
  code,
  name,
  family,
  tier,
  billing_cycle,
  pricing,
  type,
  status,
  limits,
  trial_days,
  is_published,
  display_order,
  version,
  service_code
) VALUES
  (
    'ERP_BASIC_MONTHLY',
    'ERP Basic Bulanan',
    'ERP_PLAN',
    'BASIC',
    'MONTHLY',
    '{"base_price": 99000, "discount": 0, "tax": 0, "final_price": 99000, "currency": "IDR"}',
    'STANDALONE',
    'ACTIVE',
    '{"max_branches": 1, "max_users": 3}',
    14,
    TRUE,
    1,
    1,
    'ERP'
  ),
  (
    'ERP_PRO_MONTHLY',
    'ERP Pro Bulanan',
    'ERP_PLAN',
    'PRO',
    'MONTHLY',
    '{"base_price": 249000, "discount": 0, "tax": 0, "final_price": 249000, "currency": "IDR"}',
    'STANDALONE',
    'ACTIVE',
    '{"max_branches": 5, "max_users": 10}',
    0,
    TRUE,
    2,
    1,
    'ERP'
  )
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. CANONICAL ERP & POS SUPPORTING CATALOG PRODUCTS (8 Products)
-- ============================================================================

INSERT INTO catalog_products (
  code,
  name,
  type,
  category,
  billing_model,
  base_price,
  currency,
  tax_rate,
  metadata,
  status,
  is_published,
  display_order,
  version
) VALUES
  -- A. Thermal Receipt Printer
  ('POS_PRINTER_THERMAL', 'Printer Kasir Thermal 80mm USB+Bluetooth', 'HARDWARE', 'POS_EQUIPMENT', 'ONE_TIME', 650000, 'IDR', 11.00, '{"spec": "Thermal 80mm Auto-Cutter USB+Bluetooth", "warranty_months": 12, "description": "Printer struk kasir thermal kecepatan tinggi 80mm dengan koneksi USB dan Bluetooth"}', 'ACTIVE', TRUE, 13, 1),

  -- B. Barcode Scanner
  ('POS_SCANNER_BARCODE', 'Barcode Scanner 1D/2D Omnidirectional', 'HARDWARE', 'POS_EQUIPMENT', 'ONE_TIME', 350000, 'IDR', 11.00, '{"spec": "1D/2D QR Barcode Scanner + Stand", "warranty_months": 12, "description": "Scanner barcode 1D dan 2D QR Code presisi tinggi dengan stand otomatis"}', 'ACTIVE', TRUE, 14, 1),

  -- C. Cash Drawer
  ('POS_CASH_DRAWER', 'Cash Drawer Laci Kasir Metal RJ11', 'HARDWARE', 'POS_EQUIPMENT', 'ONE_TIME', 450000, 'IDR', 11.00, '{"spec": "4 Bill / 5 Coin RJ11 Metal Casing", "warranty_months": 12, "description": "Laci uang kasir logam kokoh dengan 4 slot uang kertas & 5 koin trigger RJ11 printer"}', 'ACTIVE', TRUE, 15, 1),

  -- D. Customer Display
  ('POS_CUSTOMER_DISPLAY', 'Customer Display 2-Line VFD Pole', 'HARDWARE', 'POS_EQUIPMENT', 'ONE_TIME', 650000, 'IDR', 11.00, '{"spec": "2-Line 40 Characters VFD USB Display", "warranty_months": 12, "description": "Layar monitor display pelanggan 2 baris untuk transparansi total transaksi kasir"}', 'ACTIVE', TRUE, 16, 1),

  -- E. Label Printer (Retail & Wholesale)
  ('POS_PRINTER_LABEL', 'Printer Label Barcode & Resi Thermal', 'HARDWARE', 'POS_EQUIPMENT', 'ONE_TIME', 850000, 'IDR', 11.00, '{"spec": "Direct Thermal Label Printer 108mm USB", "warranty_months": 12, "description": "Printer cetak stiker barcode dan label harga rak untuk operasional toko grosir dan ritel"}', 'ACTIVE', TRUE, 17, 1),

  -- F. UPS Power Backup
  ('POS_UPS_650VA', 'UPS 650VA Power Backup Kasir & Router', 'HARDWARE', 'POS_EQUIPMENT', 'ONE_TIME', 550000, 'IDR', 11.00, '{"spec": "650VA / 360W Line Interactive Battery Backup", "warranty_months": 12, "description": "Cadangan daya darurat UPS 650VA melindungi mesin kasir dan router dari mati lampu mendadak"}', 'ACTIVE', TRUE, 18, 1),

  -- G. Consumables / Starter Roll Kit
  ('ACC_THERMAL_ROLL', 'Starter Kit Kertas Struk & Label Barcode', 'HARDWARE', 'ACCESSORIES', 'ONE_TIME', 75000, 'IDR', 11.00, '{"spec": "5 Roll Thermal 80mm + 2 Roll Label Barcode", "description": "Paket hemat kertas struk kasir thermal 80mm dan roll stiker barcode siap pakai"}', 'ACTIVE', TRUE, 19, 1),

  -- H. Professional POS Setup Service
  ('INSTALL_POS', 'Jasa Setup POS, Perangkat Kasir & Training', 'SERVICE', 'INSTALLATION', 'ONE_TIME', 200000, 'IDR', 11.00, '{"sla_hours": 24, "scope": "Pemasangan printer kasir, cash drawer, barcode scanner, setup software ERP dan pelatihan kasir"}', 'ACTIVE', TRUE, 20, 1)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 3. CANONICAL ERP COMMERCIAL BUNDLES (5 Bundles)
-- ============================================================================

INSERT INTO bundles (
  code,
  name,
  pricing,
  target_segment,
  installation_required,
  installation_service_code,
  presentation_metadata,
  status,
  is_published,
  display_order,
  version
) VALUES
  (
    'BUNDLE_ERP_UMKM_STARTER',
    'ERP UMKM Toko Starter 1 Tahun',
    '{"one_time": 1500000, "monthly": 99000, "commitment_months": 12}',
    'UMKM_RETAIL',
    TRUE,
    'INSTALL_POS',
    '{"marketing_badge": "Starter", "description": "Paket lengkap kasir UMKM: Software ERP Basic 1 tahun, printer kasir thermal, barcode scanner, cash drawer, dan setup siap pakai"}',
    'ACTIVE',
    TRUE,
    6,
    1
  ),
  (
    'BUNDLE_ERP_UMKM_LENGKAP',
    'ERP UMKM Toko Lengkap 1 Tahun',
    '{"one_time": 2650000, "monthly": 99000, "commitment_months": 12}',
    'RETAIL_STORE',
    TRUE,
    'INSTALL_POS',
    '{"marketing_badge": "Lengkap", "description": "Paket kasir ritel profesional: ERP Basic 1 tahun + printer, scanner, cash drawer, customer display, UPS anti mati lampu, dan instalasi"}',
    'ACTIVE',
    TRUE,
    7,
    1
  ),
  (
    'BUNDLE_ERP_GROSIR_1YR',
    'ERP Grosir UMKM 1 Tahun',
    '{"one_time": 2850000, "monthly": 249000, "commitment_months": 12}',
    'WHOLESALE_GROSIR',
    TRUE,
    'INSTALL_POS',
    '{"marketing_badge": "Grosir", "description": "Solusi usaha grosir & multi-cabang: ERP Pro 1 tahun + printer kasir, label printer barcode, scanner, cash drawer, UPS, dan setup"}',
    'ACTIVE',
    TRUE,
    8,
    1
  ),
  (
    'BUNDLE_ERP_TOKO_WIFI',
    'ERP Toko + WiFi 1 Tahun',
    '{"one_time": 1750000, "monthly": 99000, "commitment_months": 12}',
    'STORE_CONNECTIVITY',
    TRUE,
    'INSTALL_POS',
    '{"marketing_badge": "Toko+WiFi", "description": "Paket usaha toko baru: ERP Basic 1 tahun + paket kasir lengkap + WiFi router untuk operasional toko terhubung"}',
    'ACTIVE',
    TRUE,
    9,
    1
  ),
  (
    'BUNDLE_ERP_UMKM_COMPLETE',
    'ERP UMKM Complete 1 Tahun',
    '{"one_time": 3450000, "monthly": 249000, "commitment_months": 12}',
    'ALL_IN_ONE_STORE',
    TRUE,
    'INSTALL_POS',
    '{"marketing_badge": "Ultimate", "description": "Solusi all-in-one terlengkap: ERP Pro 1 tahun + POS hardware penuh, customer display, label barcode printer, UPS, router dual-band, dan instalasi"}',
    'ACTIVE',
    TRUE,
    10,
    1
  )
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 4. BUNDLE ITEMS COMPOSITION (PLAN + HARDWARE + SERVICE)
-- ============================================================================

INSERT INTO bundle_items (bundle_code, item_type, item_code, quantity, required)
VALUES
  -- 1. BUNDLE_ERP_UMKM_STARTER (5 items)
  ('BUNDLE_ERP_UMKM_STARTER', 'PLAN', 'ERP_BASIC_MONTHLY', 1, TRUE),
  ('BUNDLE_ERP_UMKM_STARTER', 'HARDWARE', 'POS_PRINTER_THERMAL', 1, TRUE),
  ('BUNDLE_ERP_UMKM_STARTER', 'HARDWARE', 'POS_SCANNER_BARCODE', 1, TRUE),
  ('BUNDLE_ERP_UMKM_STARTER', 'HARDWARE', 'POS_CASH_DRAWER', 1, TRUE),
  ('BUNDLE_ERP_UMKM_STARTER', 'SERVICE', 'INSTALL_POS', 1, TRUE),

  -- 2. BUNDLE_ERP_UMKM_LENGKAP (7 items)
  ('BUNDLE_ERP_UMKM_LENGKAP', 'PLAN', 'ERP_BASIC_MONTHLY', 1, TRUE),
  ('BUNDLE_ERP_UMKM_LENGKAP', 'HARDWARE', 'POS_PRINTER_THERMAL', 1, TRUE),
  ('BUNDLE_ERP_UMKM_LENGKAP', 'HARDWARE', 'POS_SCANNER_BARCODE', 1, TRUE),
  ('BUNDLE_ERP_UMKM_LENGKAP', 'HARDWARE', 'POS_CASH_DRAWER', 1, TRUE),
  ('BUNDLE_ERP_UMKM_LENGKAP', 'HARDWARE', 'POS_CUSTOMER_DISPLAY', 1, TRUE),
  ('BUNDLE_ERP_UMKM_LENGKAP', 'HARDWARE', 'POS_UPS_650VA', 1, TRUE),
  ('BUNDLE_ERP_UMKM_LENGKAP', 'SERVICE', 'INSTALL_POS', 1, TRUE),

  -- 3. BUNDLE_ERP_GROSIR_1YR (7 items)
  ('BUNDLE_ERP_GROSIR_1YR', 'PLAN', 'ERP_PRO_MONTHLY', 1, TRUE),
  ('BUNDLE_ERP_GROSIR_1YR', 'HARDWARE', 'POS_PRINTER_THERMAL', 1, TRUE),
  ('BUNDLE_ERP_GROSIR_1YR', 'HARDWARE', 'POS_SCANNER_BARCODE', 1, TRUE),
  ('BUNDLE_ERP_GROSIR_1YR', 'HARDWARE', 'POS_CASH_DRAWER', 1, TRUE),
  ('BUNDLE_ERP_GROSIR_1YR', 'HARDWARE', 'POS_PRINTER_LABEL', 1, TRUE),
  ('BUNDLE_ERP_GROSIR_1YR', 'HARDWARE', 'POS_UPS_650VA', 1, TRUE),
  ('BUNDLE_ERP_GROSIR_1YR', 'SERVICE', 'INSTALL_POS', 1, TRUE),

  -- 4. BUNDLE_ERP_TOKO_WIFI (6 items)
  ('BUNDLE_ERP_TOKO_WIFI', 'PLAN', 'ERP_BASIC_MONTHLY', 1, TRUE),
  ('BUNDLE_ERP_TOKO_WIFI', 'HARDWARE', 'POS_PRINTER_THERMAL', 1, TRUE),
  ('BUNDLE_ERP_TOKO_WIFI', 'HARDWARE', 'POS_SCANNER_BARCODE', 1, TRUE),
  ('BUNDLE_ERP_TOKO_WIFI', 'HARDWARE', 'POS_CASH_DRAWER', 1, TRUE),
  ('BUNDLE_ERP_TOKO_WIFI', 'HARDWARE', 'ROUTER_WIFI', 1, TRUE),
  ('BUNDLE_ERP_TOKO_WIFI', 'SERVICE', 'INSTALL_POS', 1, TRUE),

  -- 5. BUNDLE_ERP_UMKM_COMPLETE (9 items)
  ('BUNDLE_ERP_UMKM_COMPLETE', 'PLAN', 'ERP_PRO_MONTHLY', 1, TRUE),
  ('BUNDLE_ERP_UMKM_COMPLETE', 'HARDWARE', 'POS_PRINTER_THERMAL', 1, TRUE),
  ('BUNDLE_ERP_UMKM_COMPLETE', 'HARDWARE', 'POS_SCANNER_BARCODE', 1, TRUE),
  ('BUNDLE_ERP_UMKM_COMPLETE', 'HARDWARE', 'POS_CASH_DRAWER', 1, TRUE),
  ('BUNDLE_ERP_UMKM_COMPLETE', 'HARDWARE', 'POS_CUSTOMER_DISPLAY', 1, TRUE),
  ('BUNDLE_ERP_UMKM_COMPLETE', 'HARDWARE', 'POS_PRINTER_LABEL', 1, TRUE),
  ('BUNDLE_ERP_UMKM_COMPLETE', 'HARDWARE', 'POS_UPS_650VA', 1, TRUE),
  ('BUNDLE_ERP_UMKM_COMPLETE', 'HARDWARE', 'ROUTER_DUALBAND', 1, TRUE),
  ('BUNDLE_ERP_UMKM_COMPLETE', 'SERVICE', 'INSTALL_POS', 1, TRUE)
ON CONFLICT (bundle_code, item_type, item_code) DO NOTHING;
