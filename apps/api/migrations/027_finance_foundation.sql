-- Phase 9C.3: Finance Core Foundation
-- Accounts, Journal Entries, Journal Lines with full integrity constraints

-- ============================================================================
-- ACCOUNTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'mobile', 'receivable', 'payable', 'inventory', 'revenue', 'cogs', 'expense', 'income')),
  currency TEXT NOT NULL DEFAULT 'IDR',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  server_version BIGINT NOT NULL DEFAULT 1 CHECK (server_version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_business_code ON accounts (business_id, code);
CREATE INDEX IF NOT EXISTS idx_accounts_business_id ON accounts (business_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts (type);

-- ============================================================================
-- JOURNAL ENTRIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  branch_id UUID NULL REFERENCES branches(id),
  date DATE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('SALE', 'PURCHASE_PAYMENT', 'EXPENSE', 'INCOME', 'REVERSAL')),
  source_id UUID NOT NULL,
  reference TEXT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed')),
  reversed_by UUID NULL REFERENCES journal_entries(id),
  reversed_at TIMESTAMPTZ NULL,
  reversal_of UUID NULL REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  server_version BIGINT NOT NULL DEFAULT 1 CHECK (server_version >= 1),
  UNIQUE (business_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_business_id ON journal_entries (business_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_business_branch ON journal_entries (business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries (date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries (status);

-- ============================================================================
-- JOURNAL LINES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY,
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  debit_minor BIGINT NOT NULL DEFAULT 0 CHECK (debit_minor >= 0),
  credit_minor BIGINT NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((debit_minor > 0 AND credit_minor = 0) OR (credit_minor > 0 AND debit_minor = 0))
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_journal_entry_id ON journal_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON journal_lines (account_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- 1. Journal entry mutation protection
CREATE OR REPLACE FUNCTION journal_entries_mutation_protection()
RETURNS TRIGGER AS $$
DECLARE
  total_debit BIGINT;
  total_credit BIGINT;
  je_status TEXT;
BEGIN
  -- INSERT: only draft allowed
  IF TG_OP = 'INSERT' THEN
    IF NEW.status != 'draft' THEN
      RAISE EXCEPTION 'Only INSERT with status=draft allowed';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: validate status transitions
  IF TG_OP = 'UPDATE' THEN
    -- draft -> posted: validate balance
    IF OLD.status = 'draft' AND NEW.status = 'posted' THEN
      SELECT COALESCE(SUM(jl.debit_minor), 0), COALESCE(SUM(jl.credit_minor), 0)
      INTO total_debit, total_credit
      FROM journal_lines jl
      WHERE jl.journal_entry_id = NEW.id;

      IF total_debit = 0 AND total_credit = 0 THEN
        RAISE EXCEPTION 'Cannot post journal with no lines (total_debit=%, total_credit=%)', total_debit, total_credit;
      END IF;

      IF total_debit != total_credit THEN
        RAISE EXCEPTION 'Journal must be balanced: debit=%, credit=%', total_debit, total_credit
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END IF;

    -- posted -> reversed: header immutability check
    IF OLD.status = 'posted' AND NEW.status = 'reversed' THEN
      IF OLD.business_id IS DISTINCT FROM NEW.business_id THEN
        RAISE EXCEPTION 'Immutable: business_id';
      END IF;
      IF OLD.branch_id IS DISTINCT FROM NEW.branch_id THEN
        RAISE EXCEPTION 'Immutable: branch_id';
      END IF;
      IF OLD.date IS DISTINCT FROM NEW.date THEN
        RAISE EXCEPTION 'Immutable: date';
      END IF;
      IF OLD.source_type IS DISTINCT FROM NEW.source_type THEN
        RAISE EXCEPTION 'Immutable: source_type';
      END IF;
      IF OLD.source_id IS DISTINCT FROM NEW.source_id THEN
        RAISE EXCEPTION 'Immutable: source_id';
      END IF;
      IF OLD.reference IS DISTINCT FROM NEW.reference THEN
        RAISE EXCEPTION 'Immutable: reference';
      END IF;
      IF OLD.description IS DISTINCT FROM NEW.description THEN
        RAISE EXCEPTION 'Immutable: description';
      END IF;
      RETURN NEW;
    END IF;

    -- All other transitions forbidden
    RAISE EXCEPTION 'Invalid status transition: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journal_entries_protection ON journal_entries;
CREATE TRIGGER journal_entries_protection BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION journal_entries_mutation_protection();

-- 2. Journal entry delete protection
CREATE OR REPLACE FUNCTION journal_entries_delete_protection()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'All journal_entries are immutable';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journal_entries_delete ON journal_entries;
CREATE TRIGGER journal_entries_delete BEFORE DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION journal_entries_delete_protection();

-- 3. Journal line INSERT protection
CREATE OR REPLACE FUNCTION journal_lines_insert_protection()
RETURNS TRIGGER AS $$
DECLARE je_status TEXT;
BEGIN
  SELECT status INTO je_status FROM journal_entries WHERE id = NEW.journal_entry_id;
  IF je_status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'Cannot INSERT lines into % journal', je_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journal_lines_insert ON journal_lines;
CREATE TRIGGER journal_lines_insert BEFORE INSERT ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION journal_lines_insert_protection();

-- 4. Journal line UPDATE protection
-- Both the OLD and NEW parent journal must be draft. This prevents:
--   * reparenting a posted/reversed line onto a draft journal
--   * moving a draft line onto a posted/reversed journal
CREATE OR REPLACE FUNCTION journal_lines_update_protection()
RETURNS TRIGGER AS $$
DECLARE old_status TEXT; new_status TEXT;
BEGIN
  SELECT status INTO old_status FROM journal_entries WHERE id = OLD.journal_entry_id;
  SELECT status INTO new_status FROM journal_entries WHERE id = NEW.journal_entry_id;
  IF old_status IS DISTINCT FROM 'draft' OR new_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Cannot UPDATE line unless both old and new journal are draft';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journal_lines_update ON journal_lines;
CREATE TRIGGER journal_lines_update BEFORE UPDATE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION journal_lines_update_protection();

-- 5. Journal line DELETE protection
CREATE OR REPLACE FUNCTION journal_lines_delete_protection()
RETURNS TRIGGER AS $$
DECLARE je_status TEXT;
BEGIN
  SELECT status INTO je_status FROM journal_entries WHERE id = OLD.journal_entry_id;
  IF je_status != 'draft' THEN
    RAISE EXCEPTION 'Cannot DELETE line on % journal', je_status;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journal_lines_delete ON journal_lines;
CREATE TRIGGER journal_lines_delete BEFORE DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION journal_lines_delete_protection();

-- ============================================================================
-- REVERSAL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION create_reversal(original_id UUID)
RETURNS UUID AS $$
DECLARE
  reversal_id UUID := gen_random_uuid();
  je_status TEXT;
BEGIN
  -- 1. Lock original and verify single-reversal
  SELECT status INTO je_status FROM journal_entries
  WHERE id = original_id AND status = 'posted' AND reversed_by IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target journal not eligible for reversal: must be posted and not already reversed';
  END IF;

  -- 2. Create reversal journal as draft (preserve original branch_id for branch-scoped reporting)
  INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, reversal_of)
  SELECT reversal_id, business_id, branch_id, date, 'REVERSAL', reversal_id, reference, 'Reversal: ' || description, 'draft', original_id
  FROM journal_entries WHERE id = original_id;

  -- 3. Insert reversal lines with debit/credit swapped
  INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
  SELECT gen_random_uuid(), reversal_id, account_id, credit_minor, debit_minor
  FROM journal_lines WHERE journal_entry_id = original_id;

  -- 4. Post reversal (triggers validate balance)
  UPDATE journal_entries SET status = 'posted' WHERE id = reversal_id;

  -- 5. Close original
  UPDATE journal_entries SET status = 'reversed', reversed_by = reversal_id, reversed_at = NOW(), server_version = server_version + 1
  WHERE id = original_id;

  RETURN reversal_id;
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$ LANGUAGE plpgsql;