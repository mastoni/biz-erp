-- Phase 9C.5B: Income transaction foundation
-- Creates the canonical Income business transaction table and its indexes.
-- Journal posting (Dr Cash/Bank/Mobile -> Cr Income) is handled by Finance Core
-- (migration 027 + finance_service); this table stores only the transaction
-- source identity. No journal_entry_id is stored; the journal is resolved via
-- journal_entries(business_id, source_type='INCOME', source_id=income.id).

CREATE TABLE IF NOT EXISTS incomes (
  id             UUID PRIMARY KEY,
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id      UUID NULL REFERENCES branches(id) ON DELETE RESTRICT,
  date           DATE NOT NULL,
  amount_minor   BIGINT NOT NULL CHECK (amount_minor > 0),
  method         TEXT NOT NULL CHECK (
    method IN ('cash', 'bank_transfer', 'debit', 'credit')
  ),
  category       TEXT NULL,
  reference      TEXT NULL,
  description    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'posted', 'reversed')),
  server_version BIGINT NOT NULL DEFAULT 1
                  CHECK (server_version >= 1),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ NULL
);

-- Tenant + branch lookup (soft-delete aware)
CREATE INDEX IF NOT EXISTS idx_incomes_business_branch
  ON incomes (business_id, branch_id) WHERE deleted_at IS NULL;

-- Sync pagination by server_version (soft-delete aware)
CREATE INDEX IF NOT EXISTS idx_incomes_business_version
  ON incomes (business_id, server_version) WHERE deleted_at IS NULL;

-- Date-range reporting (soft-delete aware)
CREATE INDEX IF NOT EXISTS idx_incomes_business_date
  ON incomes (business_id, date) WHERE deleted_at IS NULL;
