-- Phase: Platform Billing Lifecycle Completion
-- Establishes internal platform subscription billing, invoices, and payment records

-- 1. PLATFORM INVOICES TABLE
CREATE TABLE IF NOT EXISTS platform_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    plan_code TEXT NOT NULL REFERENCES plans(code) ON DELETE RESTRICT,
    billing_period_start TIMESTAMPTZ NOT NULL,
    billing_period_end TIMESTAMPTZ NOT NULL,
    subtotal_amount BIGINT NOT NULL CHECK (subtotal_amount >= 0),
    discount_amount BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount BIGINT NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID')),
    due_date TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    payment_reference TEXT,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_platform_invoice_subscription_period UNIQUE (subscription_id, billing_period_start, billing_period_end)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_platform_invoices_business ON platform_invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_subscription ON platform_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_status ON platform_invoices(status);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_due_date ON platform_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_created_at ON platform_invoices(created_at DESC);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_platform_invoices_updated_at ON platform_invoices;
CREATE TRIGGER update_platform_invoices_updated_at
BEFORE UPDATE ON platform_invoices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. PLATFORM PAYMENTS TABLE (Internal manual / bank transfer payment record)
CREATE TABLE IF NOT EXISTS platform_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES platform_invoices(id) ON DELETE RESTRICT,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    payment_method TEXT NOT NULL CHECK (payment_method IN ('MANUAL_BANK_TRANSFER', 'CASH', 'INTERNAL_CREDIT', 'GATEWAY_PENDING')),
    payment_reference TEXT,
    notes TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_payments_invoice ON platform_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_platform_payments_business ON platform_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_platform_payments_created_at ON platform_payments(created_at DESC);
