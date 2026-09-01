-- Phase SA-1: Tenant Lifecycle & Registration Approval Gate
-- Adds lifecycle status, owner references, and approval/rejection/suspension metadata to businesses

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE'
  CHECK (status IN ('PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'TERMINATED'));

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id);

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id);

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES users(id);

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS reactivated_by UUID REFERENCES users(id);

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMPTZ;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_owner_user_id ON businesses(owner_user_id);
