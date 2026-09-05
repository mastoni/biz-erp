-- Phase DW-1A: Digital Wallet Foundation & Account Ledger Schema
-- Establishes stored-value wallet accounts, immutable transaction ledgers,
-- top-up intents, and service registry integration.

-- 1. SEED SERVICE REGISTRY (Idempotent)
INSERT INTO services (code, name, category, service_type, owner, lifecycle_status, public_visibility, description)
VALUES (
    'DIGITAL_WALLET',
    'SKMNetwork Digital Wallet',
    'FINANCIAL',
    'INTERNAL',
    'PLATFORM',
    'ACTIVE',
    TRUE,
    'Digital Stored-Value Wallet and Account Ledger Service'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    service_type = EXCLUDED.service_type,
    lifecycle_status = EXCLUDED.lifecycle_status,
    public_visibility = EXCLUDED.public_visibility,
    description = EXCLUDED.description;

-- 2. WALLET ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS wallet_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_customer_id UUID NOT NULL REFERENCES account_customers(id) ON DELETE RESTRICT,
    business_id UUID REFERENCES businesses(id) ON DELETE RESTRICT,
    wallet_number TEXT NOT NULL UNIQUE,
    currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING', 'ACTIVE', 'FROZEN', 'CLOSED')),
    balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    pending_credit BIGINT NOT NULL DEFAULT 0 CHECK (pending_credit >= 0),
    pending_debit BIGINT NOT NULL DEFAULT 0 CHECK (pending_debit >= 0),
    server_version BIGINT NOT NULL DEFAULT 1 CHECK (server_version >= 1),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_account_customer_currency UNIQUE (account_customer_id, currency)
);

-- Indexes for wallet_accounts
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_account_customer ON wallet_accounts(account_customer_id);
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_business ON wallet_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_status ON wallet_accounts(status);
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_number ON wallet_accounts(wallet_number);

-- 3. WALLET LEDGERS TABLE (Immutable, append-only)
CREATE TABLE IF NOT EXISTS wallet_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'TOP_UP', 'DEBIT', 'CREDIT', 'TRANSFER', 'REFUND', 'REVERSAL', 'FEE', 'ADJUSTMENT'
    )),
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    balance_before BIGINT NOT NULL CHECK (balance_before >= 0),
    balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
    reference_type VARCHAR(50) NOT NULL,
    reference_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_scope VARCHAR(20) NOT NULL CHECK (actor_scope IN ('platform', 'tenant', 'customer', 'system')),
    description TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_wallet_ledger_balance_math CHECK (
        (entry_type = 'CREDIT' AND balance_after = balance_before + amount) OR
        (entry_type = 'DEBIT' AND balance_after = balance_before - amount)
    )
);

-- Indexes for wallet_ledgers
CREATE INDEX IF NOT EXISTS idx_wallet_ledgers_wallet_created ON wallet_ledgers(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_ledgers_reference ON wallet_ledgers(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledgers_idempotency ON wallet_ledgers(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_wallet_ledgers_actor ON wallet_ledgers(actor_id);

-- 4. TOP-UP INTENTS TABLE
CREATE TABLE IF NOT EXISTS top_up_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intent_number TEXT NOT NULL UNIQUE,
    wallet_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
    account_customer_id UUID NOT NULL REFERENCES account_customers(id) ON DELETE RESTRICT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    fee_amount BIGINT NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
    total_payable BIGINT NOT NULL CHECK (total_payable >= amount),
    currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'
    )),
    payment_method VARCHAR(50),
    payment_reference TEXT,
    gateway_transaction_id TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    settled_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for top_up_intents
CREATE INDEX IF NOT EXISTS idx_top_up_intents_wallet ON top_up_intents(wallet_id);
CREATE INDEX IF NOT EXISTS idx_top_up_intents_account_customer ON top_up_intents(account_customer_id);
CREATE INDEX IF NOT EXISTS idx_top_up_intents_status ON top_up_intents(status);
CREATE INDEX IF NOT EXISTS idx_top_up_intents_number ON top_up_intents(intent_number);

-- 5. TRIGGERS FOR updated_at
DROP TRIGGER IF EXISTS update_wallet_accounts_updated_at ON wallet_accounts;
CREATE TRIGGER update_wallet_accounts_updated_at
BEFORE UPDATE ON wallet_accounts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_top_up_intents_updated_at ON top_up_intents;
CREATE TRIGGER update_top_up_intents_updated_at
BEFORE UPDATE ON top_up_intents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
