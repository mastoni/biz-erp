CREATE TABLE IF NOT EXISTS store_settings (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  store_name TEXT,
  address TEXT,
  phone TEXT,
  tax_rate_bps INTEGER NOT NULL DEFAULT 1100 CHECK (tax_rate_bps >= 0 AND tax_rate_bps <= 3000),
  receipt_footer TEXT,
  payment_methods JSONB NOT NULL DEFAULT '{"cash": true, "qris": true, "debit": true}'::jsonb,
  printer_config JSONB NOT NULL DEFAULT '{"model": "Epson TM-T82", "paper": "80mm", "copies": 1, "autoCut": true, "printLogo": true, "autoPrint": true, "connectionType": "USB"}'::jsonb,
  drawer_config JSONB NOT NULL DEFAULT '{"openOnPayment": true, "openOnShift": false, "delayMs": 300}'::jsonb,
  scanner_config JSONB NOT NULL DEFAULT '{"type": "USB HID", "autoEnter": true, "sound": true}'::jsonb,
  barcode_config JSONB NOT NULL DEFAULT '{"format": "CODE128", "prefix": "2891", "autoGenerate": true, "labelSize": "sedang", "showPrice": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_settings_business_default ON store_settings (business_id) WHERE branch_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_settings_branch_override ON store_settings (business_id, branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_settings_lookup ON store_settings (business_id, branch_id);
