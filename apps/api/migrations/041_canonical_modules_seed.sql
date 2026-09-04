-- Phase: Canonical Module Catalog Seeding (Migration 041)
-- Populates the platform modules table with canonical ERP and ecosystem modules.
-- Uses ON CONFLICT (code) DO NOTHING to ensure idempotency and preserve existing metadata.

INSERT INTO modules (code, name, pillar, category, is_core, status, service_code)
VALUES
  ('POS', 'Point of Sale', 'OPERATE', 'SALES', TRUE, 'ACTIVE', 'ERP'),
  ('INVENTORY', 'Manajemen Inventaris', 'OPERATE', 'LOGISTICS', TRUE, 'ACTIVE', 'ERP'),
  ('PURCHASING', 'Pengadaan & Pembelian', 'OPERATE', 'PURCHASING', FALSE, 'ACTIVE', 'ERP'),
  ('FINANCE', 'Keuangan & Akuntansi', 'OPERATE', 'FINANCE', FALSE, 'ACTIVE', 'ERP'),
  ('CRM', 'Manajemen Pelanggan', 'OPERATE', 'SALES', FALSE, 'ACTIVE', 'ERP'),
  ('ISP_CORE', 'ISP Core Management', 'CONNECT', 'NETWORK', FALSE, 'ACTIVE', 'ISP_MANAGEMENT'),
  ('CCTV_CORE', 'CCTV Surveillance', 'PROTECT', 'SECURITY', FALSE, 'ACTIVE', 'CCTV_MANAGEMENT'),
  ('WA_GATEWAY', 'WhatsApp Gateway', 'SERVICES', 'COMMUNICATIONS', FALSE, 'PLANNED', 'WA_GATEWAY'),
  ('AUTOPOST', 'AI Marketing AutoPost', 'SERVICES', 'MARKETING', FALSE, 'PLANNED', 'AUTOPOST')
ON CONFLICT (code) DO NOTHING;
