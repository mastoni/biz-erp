-- Phase 4.1.40H: Native ERP Recurring Customer Billing Foundation
-- Establishes tenant-scoped customer subscriptions, invoices, and sequence counters
-- with database-level composite tenant foreign key integrity.

-- 0. Ensure Composite Unique Constraints on existing prerequisite tables (Rerun-Safe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_customers_id_business'
    ) THEN
        ALTER TABLE customers ADD CONSTRAINT uq_customers_id_business UNIQUE (id, business_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_receivables_id_business'
    ) THEN
        ALTER TABLE receivables ADD CONSTRAINT uq_receivables_id_business UNIQUE (id, business_id);
    END IF;
END $$;

-- Allow receivables to be created for non-sale billing (e.g. recurring invoices)
ALTER TABLE receivables ALTER COLUMN sale_id DROP NOT NULL;

-- 1. TENANT INVOICE COUNTERS (Monotonic sequence numbering per tenant)
CREATE TABLE IF NOT EXISTS tenant_invoice_counters (
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    year_month TEXT NOT NULL, -- e.g. '202609'
    last_seq INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (business_id, year_month)
);

-- 2. CUSTOMER SUBSCRIPTIONS (Recurring Service Agreements)
CREATE TABLE IF NOT EXISTS customer_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL,
    plan_code TEXT REFERENCES plans(code) ON DELETE RESTRICT,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
    discount_minor BIGINT NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
    tax_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
    total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELLED')),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ,
    next_billing_date DATE NOT NULL,
    anchor_day INTEGER NOT NULL CHECK (anchor_day BETWEEN 1 AND 31),
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Database-level composite tenant foreign key
    CONSTRAINT uq_customer_subscriptions_id_business UNIQUE (id, business_id),
    CONSTRAINT fk_customer_sub_customer FOREIGN KEY (customer_id, business_id)
        REFERENCES customers(id, business_id) ON DELETE RESTRICT
);

-- Performance and operational indexes for customer_subscriptions
CREATE INDEX IF NOT EXISTS idx_customer_sub_business ON customer_subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_sub_customer ON customer_subscriptions(business_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sub_status ON customer_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_customer_sub_next_billing ON customer_subscriptions(next_billing_date) WHERE status = 'ACTIVE';

-- 3. CUSTOMER INVOICES (Recurring Billing Invoices linked to AR)
CREATE TABLE IF NOT EXISTS customer_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    customer_subscription_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    receivable_id UUID NOT NULL,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    subtotal_minor BIGINT NOT NULL CHECK (subtotal_minor >= 0),
    discount_minor BIGINT NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
    tax_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
    total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED')),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    paid_at TIMESTAMPTZ,
    payment_reference TEXT,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Database-level composite tenant foreign keys & uniqueness constraints
    CONSTRAINT uq_customer_invoices_id_business UNIQUE (id, business_id),
    CONSTRAINT fk_customer_invoices_customer FOREIGN KEY (customer_id, business_id)
        REFERENCES customers(id, business_id) ON DELETE RESTRICT,
    CONSTRAINT fk_customer_invoices_subscription FOREIGN KEY (customer_subscription_id, business_id)
        REFERENCES customer_subscriptions(id, business_id) ON DELETE RESTRICT,
    CONSTRAINT fk_customer_invoices_receivable FOREIGN KEY (receivable_id, business_id)
        REFERENCES receivables(id, business_id) ON DELETE RESTRICT,
    CONSTRAINT uq_customer_invoice_period UNIQUE (customer_subscription_id, billing_period_start, billing_period_end),
    CONSTRAINT uq_customer_invoice_number_business UNIQUE (business_id, invoice_number)
);

-- Performance and operational indexes for customer_invoices
CREATE INDEX IF NOT EXISTS idx_customer_invoices_business ON customer_invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_customer ON customer_invoices(business_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_sub ON customer_invoices(customer_subscription_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_receivable ON customer_invoices(receivable_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_status ON customer_invoices(status);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_due_date ON customer_invoices(due_date);

-- 4. UPDATED_AT TRIGGERS
DROP TRIGGER IF EXISTS update_tenant_invoice_counters_updated_at ON tenant_invoice_counters;
CREATE TRIGGER update_tenant_invoice_counters_updated_at
BEFORE UPDATE ON tenant_invoice_counters
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_subscriptions_updated_at ON customer_subscriptions;
CREATE TRIGGER update_customer_subscriptions_updated_at
BEFORE UPDATE ON customer_subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_invoices_updated_at ON customer_invoices;
CREATE TRIGGER update_customer_invoices_updated_at
BEFORE UPDATE ON customer_invoices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
