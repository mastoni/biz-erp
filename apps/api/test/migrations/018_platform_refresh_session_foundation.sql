-- Phase 4.1.41B-4a: Refresh Session Schema Foundation
-- Additive, non-breaking change for tenant/platform refresh sessions.
-- Does NOT modify users, user_businesses, 40B, 40C, or any canonical entity.

-- 1. Platform refresh sessions have no business scope, so business_id becomes nullable.
--    NULL business_id == platform session; non-NULL == tenant session.
ALTER TABLE refresh_tokens
  ALTER COLUMN business_id DROP NOT NULL;

-- 2. Record the session scope. Legacy (pre-existing) rows become 'tenant' via the default.
--    New rows must declare an explicit scope.
ALTER TABLE refresh_tokens
  ADD COLUMN scope TEXT NOT NULL DEFAULT 'tenant'
  CHECK (scope IN ('tenant', 'platform'));
