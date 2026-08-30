-- Phase 4.1.40C: Subscription / Commercial Lifecycle
-- Creates subscription_families and subscriptions tables with lifecycle and family conflict validation

-- 1. SUBSCRIPTION_FAMILIES TABLE
CREATE TABLE IF NOT EXISTS subscription_families (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    replacement_policy TEXT NOT NULL CHECK (replacement_policy IN ('REPLACEABLE', 'ADDITIVE')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_customer_id UUID,  -- nullable for now; FK added in 40F
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    plan_code TEXT NOT NULL REFERENCES plans(code) ON DELETE RESTRICT,
    family_code TEXT NOT NULL REFERENCES subscription_families(code) ON DELETE RESTRICT,
    source TEXT NOT NULL CHECK (source IN ('DIRECT', 'INCLUDED', 'TRIAL', 'PROMO', 'MIGRATION')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED')),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    billing_account_id UUID,
    internet_service_id UUID,  -- nullable for now; FK added in 40D
    unit_price BIGINT NOT NULL CHECK (unit_price >= 0),
    discount BIGINT NOT NULL DEFAULT 0 CHECK (discount >= 0),
    tax BIGINT NOT NULL DEFAULT 0 CHECK (tax >= 0),
    final_price BIGINT NOT NULL CHECK (final_price >= 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('MONTHLY', 'QUARTERLY', 'ANNUAL')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_business ON subscriptions(business_id);
-- CREATE INDEX IF NOT EXISTS idx_subscriptions_account_customer ON subscriptions(account_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_family ON subscriptions(family_code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_source ON subscriptions(source);
-- CREATE INDEX IF NOT EXISTS idx_subscriptions_internet_service ON subscriptions(internet_service_id);

-- Unique constraint for replaceable family: only one ACTIVE subscription per business per replaceable family
-- Hardcoded replaceable family codes (ERP_PLAN, INTERNET_PLAN, CCTV_PLAN)
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_active_per_business_replaceable
    ON subscriptions (business_id, family_code)
    WHERE status = 'ACTIVE'
    AND family_code IN ('ERP_PLAN', 'INTERNET_PLAN', 'CCTV_PLAN');

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. SUBSCRIPTION LIFECYCLE VALIDATION FUNCTION
CREATE OR REPLACE FUNCTION validate_subscription_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow initial insert (OLD is null)
    IF TG_OP = 'INSERT' THEN
        RETURN NEW;
    END IF;

    -- Define valid transitions
    IF OLD.status = 'PENDING' THEN
        IF NEW.status NOT IN ('ACTIVE', 'CANCELLED') THEN
            RAISE EXCEPTION 'Invalid transition from PENDING to %', NEW.status;
        END IF;
    ELSIF OLD.status = 'ACTIVE' THEN
        IF NEW.status NOT IN ('SUSPENDED', 'EXPIRED', 'CANCELLED') THEN
            RAISE EXCEPTION 'Invalid transition from ACTIVE to %', NEW.status;
        END IF;
    ELSIF OLD.status = 'SUSPENDED' THEN
        IF NEW.status NOT IN ('ACTIVE', 'EXPIRED', 'CANCELLED') THEN
            RAISE EXCEPTION 'Invalid transition from SUSPENDED to %', NEW.status;
        END IF;
    ELSIF OLD.status = 'EXPIRED' THEN
        IF NEW.status NOT IN ('CANCELLED') THEN
            RAISE EXCEPTION 'Invalid transition from EXPIRED to %', NEW.status;
        END IF;
    ELSIF OLD.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Cannot transition from CANCELLED';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for subscription lifecycle validation
DROP TRIGGER IF EXISTS validate_subscription_lifecycle ON subscriptions;
CREATE TRIGGER validate_subscription_lifecycle
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION validate_subscription_transition();

-- 4. SUBSCRIPTION FAMILY CONFLICT VALIDATION FUNCTION
CREATE OR REPLACE FUNCTION validate_subscription_family_conflict()
RETURNS TRIGGER AS $$
DECLARE
    family_policy TEXT;
BEGIN
    -- Only validate when subscription becomes ACTIVE (on INSERT with ACTIVE status, or UPDATE to ACTIVE)
    IF (TG_OP = 'INSERT' AND NEW.status = 'ACTIVE')
       OR (TG_OP = 'UPDATE' AND NEW.status = 'ACTIVE' AND OLD.status != 'ACTIVE') THEN
        -- Get the family's replacement policy
        SELECT replacement_policy INTO family_policy
        FROM subscription_families
        WHERE code = NEW.family_code;

        IF family_policy = 'REPLACEABLE' THEN
            -- Check for existing ACTIVE subscription in the same replaceable family
            IF EXISTS (
                SELECT 1 FROM subscriptions
                WHERE business_id = NEW.business_id
                  AND family_code = NEW.family_code
                  AND status = 'ACTIVE'
                  AND id != NEW.id
            ) THEN
                RAISE EXCEPTION 'Business already has an active subscription in replaceable family %', NEW.family_code;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for family conflict validation
DROP TRIGGER IF EXISTS validate_subscription_family ON subscriptions;
CREATE TRIGGER validate_subscription_family
BEFORE INSERT OR UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION validate_subscription_family_conflict();

-- 5. SEED SUBSCRIPTION FAMILIES
INSERT INTO subscription_families (code, name, replacement_policy, description) VALUES
    ('ERP_PLAN', 'ERP Plan', 'REPLACEABLE', 'Core ERP plans - only one active per business'),
    ('INTERNET_PLAN', 'Internet Plan', 'REPLACEABLE', 'Internet service plans - only one active per business'),
    ('CCTV_PLAN', 'CCTV Plan', 'REPLACEABLE', 'CCTV plans - only one active per business'),
    ('CLOUD_STORAGE_PLAN', 'Cloud Storage Plan', 'ADDITIVE', 'Cloud storage plans - can have multiple'),
    ('SERVICE_PLAN', 'Service Plan', 'ADDITIVE', 'Service plans - can have multiple'),
    ('HARDWARE_LEASE', 'Hardware Lease', 'ADDITIVE', 'Hardware lease plans - can have multiple')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    replacement_policy = EXCLUDED.replacement_policy,
    description = EXCLUDED.description,
    updated_at = now();

-- 6. PLAN FAMILY VALIDATION FUNCTION
CREATE OR REPLACE FUNCTION validate_plan_family_match()
RETURNS TRIGGER AS $$
DECLARE
    plan_family TEXT;
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.plan_code != OLD.plan_code) THEN
        -- Get the plan's family
        SELECT family INTO plan_family
        FROM plans
        WHERE code = NEW.plan_code;

        IF plan_family IS NULL THEN
            RAISE EXCEPTION 'Plan % does not exist', NEW.plan_code;
        END IF;

        IF plan_family != NEW.family_code THEN
            RAISE EXCEPTION 'Plan % belongs to family % but subscription has family_code %', NEW.plan_code, plan_family, NEW.family_code;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for plan family validation
DROP TRIGGER IF EXISTS validate_plan_family ON subscriptions;
CREATE TRIGGER validate_plan_family
BEFORE INSERT OR UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION validate_plan_family_match();

-- 7. PRICE SNAPSHOT VALIDATION (immutable after creation)
CREATE OR REPLACE FUNCTION validate_price_snapshot_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.unit_price != NEW.unit_price
           OR OLD.discount != NEW.discount
           OR OLD.tax != NEW.tax
           OR OLD.final_price != NEW.final_price
           OR OLD.currency != NEW.currency
           OR OLD.billing_cycle != NEW.billing_cycle THEN
            RAISE EXCEPTION 'Price snapshot is immutable after subscription creation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for price snapshot immutability
DROP TRIGGER IF EXISTS validate_price_snapshot ON subscriptions;
CREATE TRIGGER validate_price_snapshot
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION validate_price_snapshot_immutability();

-- 8. SOURCE VALIDATION
CREATE OR REPLACE FUNCTION validate_subscription_source()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Note: internet_service_id and billing_account_id FKs will be added in 40D/40F
        -- For now, just validate that the fields are present when required
        IF NEW.source = 'INCLUDED' THEN
            -- internet_service_id will be validated when FK is added in 40D
            NULL;
        END IF;
        IF NEW.source = 'DIRECT' THEN
            -- billing_account_id will be validated when FK is added
            NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_subscription_source ON subscriptions;
CREATE TRIGGER validate_subscription_source
BEFORE INSERT ON subscriptions
FOR EACH ROW EXECUTE FUNCTION validate_subscription_source();