-- Phase SA-2.5: Service Registry Foundation
-- Creates the canonical macro-service registry for platform ecosystem

-- 1. SERVICES TABLE
CREATE TABLE IF NOT EXISTS services (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    service_type TEXT NOT NULL CHECK (service_type IN ('INTERNAL', 'EXTERNAL', 'HYBRID')),
    owner TEXT NOT NULL DEFAULT 'PLATFORM',
    lifecycle_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (lifecycle_status IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'DEPRECATED', 'RETIRED')),
    public_visibility BOOLEAN NOT NULL DEFAULT FALSE,
    base_capability JSONB NOT NULL DEFAULT '{}',
    provisioning_capability JSONB NOT NULL DEFAULT '{}',
    support_capability JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. SERVICE DEPENDENCIES TABLE (DAG)
CREATE TABLE IF NOT EXISTS service_dependencies (
    service_code TEXT NOT NULL REFERENCES services(code) ON DELETE CASCADE,
    depends_on_service_code TEXT NOT NULL REFERENCES services(code) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL DEFAULT 'REQUIRED' CHECK (dependency_type IN ('REQUIRED', 'OPTIONAL')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (service_code, depends_on_service_code),
    CHECK (service_code != depends_on_service_code) -- Prevent self-dependency
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_lifecycle_status ON services(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_services_public_visibility ON services(public_visibility);
CREATE INDEX IF NOT EXISTS idx_service_dependencies_depends_on ON service_dependencies(depends_on_service_code);

-- 3. ALTER MODULES (Nullable mapping)
ALTER TABLE modules
ADD COLUMN IF NOT EXISTS service_code TEXT REFERENCES services(code) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_modules_service_code ON modules(service_code);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON services
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
