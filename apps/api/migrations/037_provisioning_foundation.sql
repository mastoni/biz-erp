-- Phase SA-2.7: Provisioning Foundation

-- 1. Create provisioning_jobs table
CREATE TABLE IF NOT EXISTS provisioning_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    service_code TEXT NOT NULL REFERENCES services(code) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (action IN ('ACTIVATE', 'SUSPEND', 'RESTORE', 'DEACTIVATE', 'CONFIGURE')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    payload JSONB NOT NULL DEFAULT '{}',
    result JSONB NOT NULL DEFAULT '{}',
    error_message TEXT,
    idempotency_key TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for provisioning_jobs
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_business_id ON provisioning_jobs(business_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_service_code ON provisioning_jobs(service_code);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_status ON provisioning_jobs(status);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_created_at ON provisioning_jobs(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provisioning_jobs_idempotency 
    ON provisioning_jobs(business_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

-- 3. Create provisioning_audit_logs table
CREATE TABLE IF NOT EXISTS provisioning_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES provisioning_jobs(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    service_code TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    actor_id UUID,
    actor_scope TEXT NOT NULL DEFAULT 'tenant',
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provisioning_audit_logs_job_id ON provisioning_audit_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_audit_logs_business_id ON provisioning_audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_audit_logs_created_at ON provisioning_audit_logs(created_at DESC);
