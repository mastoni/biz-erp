-- Phase SA-2.8: Platform Audit & Observability Foundation

-- 1. Create platform_audit_logs table
CREATE TABLE IF NOT EXISTS platform_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    actor_email TEXT,
    actor_scope TEXT NOT NULL CHECK (actor_scope IN ('platform', 'tenant', 'system')),
    actor_role TEXT,
    action TEXT NOT NULL,
    service_code TEXT REFERENCES services(code) ON DELETE SET NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    before_state JSONB,
    after_state JSONB,
    diff JSONB,
    request_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILURE')),
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for platform_audit_logs
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_created_at ON platform_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_actor_id ON platform_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_actor_scope ON platform_audit_logs(actor_scope);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_service_code ON platform_audit_logs(service_code);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_target ON platform_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_request_id ON platform_audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_status ON platform_audit_logs(status);
