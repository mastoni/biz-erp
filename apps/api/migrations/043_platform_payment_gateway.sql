-- 043_platform_payment_gateway.sql
-- Migration for external payment gateway integration & webhook idempotency tracking

CREATE TABLE IF NOT EXISTS platform_payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway VARCHAR(50) NOT NULL, -- e.g. 'MIDTRANS', 'XENDIT'
  event_id VARCHAR(255) NOT NULL, -- unique event/transaction identifier from gateway
  invoice_id UUID REFERENCES platform_invoices(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL, -- e.g. 'settlement', 'capture', 'pending', 'expire', 'deny'
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'PROCESSED', -- 'PROCESSED', 'IGNORED_ALREADY_PAID', 'PENDING', 'FAILED', 'REJECTED'
  error_message TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_platform_webhook_event UNIQUE (gateway, event_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_webhook_events_invoice ON platform_payment_webhook_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_platform_webhook_events_gateway_event ON platform_payment_webhook_events(gateway, event_id);
