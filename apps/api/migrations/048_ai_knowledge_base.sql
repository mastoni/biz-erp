-- Phase SA-3.0B-3: Superadmin AI CS Knowledge Base Control

CREATE TABLE IF NOT EXISTS ai_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority_order INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_category ON ai_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_is_active ON ai_knowledge_base(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_priority ON ai_knowledge_base(priority_order ASC, created_at ASC);

-- Seed initial static knowledge articles idempotently
INSERT INTO ai_knowledge_base (code, category, title, content, keywords, is_public, is_active, priority_order)
VALUES
  (
    'KB-PLAT-01',
    'PLATFORM',
    'Tentang Ekosistem SKMNetwork',
    'SKMNetwork adalah platform multi-service terintegrasi yang menyediakan ERP, ISP Management, CCTV Management, WhatsApp Gateway, dan Digital Marketing AutoPost.',
    '["skmnetwork", "ekosistem", "platform", "layanan"]'::jsonb,
    TRUE,
    TRUE,
    10
  ),
  (
    'KB-BILL-01',
    'BILLING',
    'Siklus dan Pembayaran Tagihan',
    'Tagihan langganan dibuat setiap awal periode penagihan. Pembayaran dapat dilakukan via virtual account atau transfer bank otomatis.',
    '["tagihan", "pembayaran", "invoice", "bayar", "billing"]'::jsonb,
    TRUE,
    TRUE,
    20
  ),
  (
    'KB-ISP-01',
    'ISP_MANAGEMENT',
    'Troubleshooting Router dan Internet ISP',
    'Jika koneksi internet mati: 1. Periksa lampu indikator PON/LOS pada router ONT. 2. Restart router selama 30 detik. 3. Jika lampu LOS merah, hubungi tim teknis via AI CS.',
    '["wifi", "internet", "mati", "los", "pon", "ont", "router"]'::jsonb,
    FALSE,
    TRUE,
    30
  ),
  (
    'KB-ERP-01',
    'ERP',
    'Pencatatan dan Laporan Penjualan ERP',
    'Laporan penjualan harian dapat diakses melalui menu Penjualan > Laporan. Transaksi kasir POS secara otomatis tersinkronisasi ke jurnal keuangan.',
    '["laporan", "penjualan", "pos", "kasir", "stok", "erp"]'::jsonb,
    FALSE,
    TRUE,
    40
  ),
  (
    'KB-CCTV-01',
    'CCTV_MANAGEMENT',
    'Konfigurasi Streaming CCTV & Retensi Video',
    'Kamera CCTV terhubung melalui gateway streaming terenkripsi. Retensi rekaman default adalah 30 hari sesuai paket langganan.',
    '["cctv", "kamera", "rekaman", "streaming", "nvr"]'::jsonb,
    FALSE,
    TRUE,
    50
  ),
  (
    'KB-TRBL-01',
    'TROUBLESHOOTING',
    'Panduan Eskalasi Kendala Teknis',
    'Untuk kendala kritis yang tidak terselesaikan melalui panduan otomatis, Anda dapat meminta eskalasi langsung ke tiket bantuan operator manusia.',
    '["eskalasi", "bantuan", "manusia", "tiket", "operator", "support"]'::jsonb,
    TRUE,
    TRUE,
    60
  )
ON CONFLICT (code) DO NOTHING;
