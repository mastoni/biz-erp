-- Phase 4.1.40F-1: Account Customer Foundation
-- Establishes the platform Account Customer identity model, account_customer_users mapping,
-- and adds foreign keys to businesses and subscriptions.

-- 1. ACCOUNT_CUSTOMERS TABLE (Platform Commercial Client)
CREATE TABLE IF NOT EXISTS account_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('INDIVIDUAL', 'BUSINESS', 'ENTERPRISE')),
    tax_id TEXT,
    billing_email TEXT,
    billing_phone TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ACCOUNT_CUSTOMER_USERS TABLE (Identity Bridge)
CREATE TABLE IF NOT EXISTS account_customer_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_customer_id UUID NOT NULL REFERENCES account_customers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'PRIMARY_CONTACT' CHECK (role IN ('PRIMARY_CONTACT', 'BILLING_ADMIN', 'AUTHORIZED_USER')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_account_customer_user UNIQUE (account_customer_id, user_id)
);

-- 3. ADD account_customer_id TO businesses (Nullable, ON DELETE RESTRICT)
ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS account_customer_id UUID REFERENCES account_customers(id) ON DELETE RESTRICT;

-- 4. ADD FK CONSTRAINT TO subscriptions.account_customer_id (Nullable, ON DELETE RESTRICT)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscriptions_account_customer'
    ) THEN
        ALTER TABLE subscriptions
            ADD CONSTRAINT fk_subscriptions_account_customer
            FOREIGN KEY (account_customer_id) REFERENCES account_customers(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- 5. INDEXES FOR PERFORMANCE AND LOOKUPS
CREATE INDEX IF NOT EXISTS idx_account_customers_code ON account_customers(code);
CREATE INDEX IF NOT EXISTS idx_account_customers_status ON account_customers(status);
CREATE INDEX IF NOT EXISTS idx_account_customer_users_ac ON account_customer_users(account_customer_id);
CREATE INDEX IF NOT EXISTS idx_account_customer_users_user ON account_customer_users(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_account_customer ON businesses(account_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_account_customer ON subscriptions(account_customer_id);

-- 6. TRIGGER FOR updated_at
DROP TRIGGER IF EXISTS update_account_customers_updated_at ON account_customers;
CREATE TRIGGER update_account_customers_updated_at
BEFORE UPDATE ON account_customers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_account_customer_users_updated_at ON account_customer_users;
CREATE TRIGGER update_account_customer_users_updated_at
BEFORE UPDATE ON account_customer_users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
