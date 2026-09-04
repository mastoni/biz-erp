-- Phase: Canonical Demo Product Catalog & Bundles (Migration 044)
-- Seeds realistic, canonical SKMNetwork catalog products, network hardware, CCTV, services, and commercial bundles.
-- Uses ON CONFLICT DO NOTHING to ensure idempotency and preserve existing records.

-- ============================================================================
-- 1. CATALOG PRODUCTS SEED (8-12 Canonical Products)
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
  -- A. Internet / ISP Products (Recurring)
  ('INET_BASIC', 'Internet Paket Basic 20 Mbps', 'INTERNET', 'INTERNET_BROADBAND', 'RECURRING', 110000, 'IDR', 11.00, '{"speed_mbps": 20, "description": "Internet rumah stabil 20 Mbps cocok untuk browsing & streaming ringan"}', 'ACTIVE', TRUE, 1, 1),
  ('INET_FAMILY', 'Internet Paket Family 50 Mbps', 'INTERNET', 'INTERNET_BROADBAND', 'RECURRING', 150000, 'IDR', 11.00, '{"speed_mbps": 50, "description": "Internet keluarga cepat 50 Mbps untuk streaming 4K & multi-device"}', 'ACTIVE', TRUE, 2, 1),
  ('INET_BUSINESS', 'Internet Paket Business 100 Mbps', 'INTERNET', 'INTERNET_DEDICATED', 'RECURRING', 250000, 'IDR', 11.00, '{"speed_mbps": 100, "description": "Internet bisnis dedicated 100 Mbps prioritas tinggi untuk operasional toko & kantor"}', 'ACTIVE', TRUE, 3, 1),

  -- B. Network Hardware (One-Time)
  ('ONT_FIBER', 'ONU/ONT Fiber Terminal Gigabit', 'HARDWARE', 'NETWORK_EQUIPMENT', 'ONE_TIME', 350000, 'IDR', 11.00, '{"brand": "ZTE / Huawei", "ports": "1 GE + 1 FE + WiFi", "description": "Optical Network Unit Gigabit untuk koneksi fiber optic"}', 'ACTIVE', TRUE, 4, 1),
  ('ROUTER_WIFI', 'WiFi Router Single Band N300', 'HARDWARE', 'NETWORK_EQUIPMENT', 'ONE_TIME', 250000, 'IDR', 11.00, '{"speed": "300 Mbps", "frequency": "2.4 GHz", "description": "Router WiFi 300 Mbps jangkauan luas untuk rumah & UMKM"}', 'ACTIVE', TRUE, 5, 1),
  ('ROUTER_DUALBAND', 'WiFi Router Dual Band AC1200', 'HARDWARE', 'NETWORK_EQUIPMENT', 'ONE_TIME', 450000, 'IDR', 11.00, '{"speed": "1200 Mbps", "frequency": "2.4 GHz / 5 GHz", "description": "Gigabit Dual Band Router kecepatan tinggi bebas interferensi"}', 'ACTIVE', TRUE, 6, 1),
  ('ACC_LAN_FIBER', 'Kabel LAN Cat6 & Aksesoris Fiber', 'HARDWARE', 'ACCESSORIES', 'ONE_TIME', 75000, 'IDR', 11.00, '{"length_meters": 20, "spec": "Cat6 UTP + Patchcord Fiber SC-UPC", "description": "Paket instalasi kabel LAN dan patchcord fiber berkualitas tinggi"}', 'ACTIVE', TRUE, 7, 1),

  -- C. CCTV Surveillance (One-Time)
  ('CCTV_INDOOR', 'CCTV Indoor Camera Full HD', 'HARDWARE', 'SURVEILLANCE', 'ONE_TIME', 450000, 'IDR', 11.00, '{"resolution": "1080p Full HD", "night_vision": true, "audio": "Two-way audio", "description": "Kamera CCTV indoor 1080p dengan night vision & sensor gerak"}', 'ACTIVE', TRUE, 8, 1),
  ('CCTV_OUTDOOR', 'CCTV Outdoor Weatherproof Camera', 'HARDWARE', 'SURVEILLANCE', 'ONE_TIME', 550000, 'IDR', 11.00, '{"resolution": "1080p Full HD", "waterproof": "IP67", "description": "Kamera CCTV outdoor tahan cuaca IP67 dengan night vision tajam"}', 'ACTIVE', TRUE, 9, 1),
  ('CCTV_4CAM_PKG', 'Paket CCTV 4 Kamera + DVR Kit', 'HARDWARE', 'SURVEILLANCE', 'ONE_TIME', 2500000, 'IDR', 11.00, '{"channels": 4, "storage_tb": 1, "cameras": "2 Indoor + 2 Outdoor", "description": "Paket lengkap sistem keamanan 4 kamera dengan DVR 1TB & remote viewing"}', 'ACTIVE', TRUE, 10, 1),

  -- D. Professional Services (One-Time)
  ('INSTALL_WIFI', 'Jasa Instalasi & Setup WiFi', 'SERVICE', 'INSTALLATION', 'ONE_TIME', 150000, 'IDR', 11.00, '{"sla_hours": 24, "scope": "Pemasangan kabel, konfigurasi router, dan uji kecepatan"}', 'ACTIVE', TRUE, 11, 1),
  ('INSTALL_CCTV', 'Jasa Instalasi & Konfigurasi CCTV', 'SERVICE', 'INSTALLATION', 'ONE_TIME', 250000, 'IDR', 11.00, '{"sla_hours": 48, "scope": "Pemasangan kabel, mounting kamera, konfigurasi DVR/NVR, dan mobile app setup"}', 'ACTIVE', TRUE, 12, 1)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. BUNDLES SEED (5 Canonical Bundles)
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
    'BUNDLE_WIFI_BASIC',
    'WiFi Rumah Basic',
    '{"one_time": 350000, "monthly": 110000, "commitment_months": 12}',
    'RESIDENTIAL',
    TRUE,
    'INSTALL_WIFI',
    '{"marketing_badge": "Hemat", "description": "Paket internet rumah terjangkau lengkap dengan router dan instalasi siap pakai"}',
    'ACTIVE',
    TRUE,
    1,
    1
  ),
  (
    'BUNDLE_WIFI_FAMILY',
    'WiFi Rumah Family',
    '{"one_time": 499000, "monthly": 150000, "commitment_months": 12}',
    'RESIDENTIAL',
    TRUE,
    'INSTALL_WIFI',
    '{"marketing_badge": "Terpopuler", "description": "Paket internet keluarga 50 Mbps dengan router dual-band untuk seluruh anggota keluarga"}',
    'ACTIVE',
    TRUE,
    2,
    1
  ),
  (
    'BUNDLE_BUSINESS_STARTER',
    'Internet Bisnis Starter',
    '{"one_time": 550000, "monthly": 250000, "commitment_months": 12}',
    'BUSINESS',
    TRUE,
    'INSTALL_WIFI',
    '{"marketing_badge": "Bisnis", "description": "Solusi internet dedicated 100 Mbps dengan router gigabit untuk kelancaran operasional usaha"}',
    'ACTIVE',
    TRUE,
    3,
    1
  ),
  (
    'BUNDLE_CCTV_4CAM',
    'CCTV Rumah 4 Kamera Lengkap',
    '{"one_time": 2650000, "monthly": 0, "commitment_months": 1}',
    'RESIDENTIAL_SECURITY',
    TRUE,
    'INSTALL_CCTV',
    '{"marketing_badge": "Keamanan", "description": "Paket sistem keamanan 4 kamera lengkap dengan DVR 1TB dan instalasi profesional"}',
    'ACTIVE',
    TRUE,
    4,
    1
  ),
  (
    'BUNDLE_HOME_SECURITY',
    'Keamanan Rumah & Internet Terpadu',
    '{"one_time": 1150000, "monthly": 150000, "commitment_months": 12}',
    'ALL_IN_ONE',
    TRUE,
    'INSTALL_WIFI',
    '{"marketing_badge": "All-in-One", "description": "Kombinasi lengkap internet 50 Mbps + kamera CCTV indoor/outdoor untuk perlindungan maksimal"}',
    'ACTIVE',
    TRUE,
    5,
    1
  )
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 3. BUNDLE ITEMS SEED
-- ============================================================================

INSERT INTO bundle_items (bundle_code, item_type, item_code, quantity, required)
VALUES
  -- BUNDLE 1: BUNDLE_WIFI_BASIC
  ('BUNDLE_WIFI_BASIC', 'PRODUCT', 'INET_BASIC', 1, TRUE),
  ('BUNDLE_WIFI_BASIC', 'HARDWARE', 'ROUTER_WIFI', 1, TRUE),
  ('BUNDLE_WIFI_BASIC', 'SERVICE', 'INSTALL_WIFI', 1, TRUE),

  -- BUNDLE 2: BUNDLE_WIFI_FAMILY
  ('BUNDLE_WIFI_FAMILY', 'PRODUCT', 'INET_FAMILY', 1, TRUE),
  ('BUNDLE_WIFI_FAMILY', 'HARDWARE', 'ROUTER_DUALBAND', 1, TRUE),
  ('BUNDLE_WIFI_FAMILY', 'SERVICE', 'INSTALL_WIFI', 1, TRUE),

  -- BUNDLE 3: BUNDLE_BUSINESS_STARTER
  ('BUNDLE_BUSINESS_STARTER', 'PRODUCT', 'INET_BUSINESS', 1, TRUE),
  ('BUNDLE_BUSINESS_STARTER', 'HARDWARE', 'ROUTER_DUALBAND', 1, TRUE),
  ('BUNDLE_BUSINESS_STARTER', 'SERVICE', 'INSTALL_WIFI', 1, TRUE),

  -- BUNDLE 4: BUNDLE_CCTV_4CAM
  ('BUNDLE_CCTV_4CAM', 'HARDWARE', 'CCTV_4CAM_PKG', 1, TRUE),
  ('BUNDLE_CCTV_4CAM', 'SERVICE', 'INSTALL_CCTV', 1, TRUE),

  -- BUNDLE 5: BUNDLE_HOME_SECURITY
  ('BUNDLE_HOME_SECURITY', 'PRODUCT', 'INET_FAMILY', 1, TRUE),
  ('BUNDLE_HOME_SECURITY', 'HARDWARE', 'ROUTER_WIFI', 1, TRUE),
  ('BUNDLE_HOME_SECURITY', 'HARDWARE', 'CCTV_INDOOR', 1, TRUE),
  ('BUNDLE_HOME_SECURITY', 'HARDWARE', 'CCTV_OUTDOOR', 1, TRUE),
  ('BUNDLE_HOME_SECURITY', 'SERVICE', 'INSTALL_WIFI', 1, TRUE),
  ('BUNDLE_HOME_SECURITY', 'SERVICE', 'INSTALL_CCTV', 1, TRUE)
ON CONFLICT (bundle_code, item_type, item_code) DO NOTHING;
