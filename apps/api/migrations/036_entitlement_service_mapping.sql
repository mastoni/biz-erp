-- Phase SA-2.6: Entitlement Service Mapping

-- 1. Idempotent seed of Canonical Services
INSERT INTO services (code, name, category, service_type, owner, lifecycle_status, public_visibility)
VALUES
('ERP', 'Enterprise Resource Planning', 'OPERATIONS', 'INTERNAL', 'PLATFORM', 'ACTIVE', FALSE),
('ISP_MANAGEMENT', 'ISP Management System', 'OPERATIONS', 'INTERNAL', 'PLATFORM', 'ACTIVE', FALSE),
('CCTV_MANAGEMENT', 'CCTV Management', 'PROTECTION', 'HYBRID', 'PLATFORM', 'ACTIVE', FALSE),
('WA_GATEWAY', 'WhatsApp Gateway', 'COMMUNICATIONS', 'HYBRID', 'PLATFORM', 'DRAFT', FALSE),
('AUTOPOST', 'AI AutoPost', 'MARKETING', 'EXTERNAL', 'PLATFORM', 'DRAFT', FALSE)
ON CONFLICT (code) DO UPDATE SET
name = EXCLUDED.name,
category = EXCLUDED.category,
service_type = EXCLUDED.service_type,
lifecycle_status = EXCLUDED.lifecycle_status;

-- 2. Add plans.service_code
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS service_code TEXT REFERENCES services(code) ON DELETE RESTRICT;

-- 3. Backfill known plans based on family_code
UPDATE plans
SET service_code = 'ERP'
WHERE family = 'ERP_PLAN';

UPDATE plans
SET service_code = 'ISP_MANAGEMENT'
WHERE family = 'INTERNET_PLAN';

UPDATE plans
SET service_code = 'CCTV_MANAGEMENT'
WHERE family = 'CCTV_PLAN';

-- 4. Add index
CREATE INDEX IF NOT EXISTS idx_plans_service_code ON plans(service_code);
