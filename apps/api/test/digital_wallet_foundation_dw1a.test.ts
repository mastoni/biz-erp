import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'

describe('Phase DW-1A: Digital Wallet Foundation Schema & Service Registry', () => {
  let pool: Pool

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
  })

  afterAll(async () => {
    await pool.end()
  })

  async function createTestAccountCustomer(): Promise<string> {
    const code = `ACC-DW-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const res = await pool.query(
      `INSERT INTO account_customers (code, name, account_type, billing_email)
       VALUES ($1, 'Digital Wallet Customer', 'INDIVIDUAL', 'wallet@test.com')
       RETURNING id`,
      [code]
    )
    return res.rows[0].id
  }

  async function createTestBusiness(): Promise<string> {
    const res = await pool.query(
      `INSERT INTO businesses (id, name, created_at)
       VALUES ($1, 'DW Test Merchant', now())
       RETURNING id`,
      [randomUUID()]
    )
    return res.rows[0].id
  }

  describe('1. Service Registry Integration', () => {
    it('DW-1A-001: verifies DIGITAL_WALLET service is registered and active', async () => {
      const res = await pool.query(`SELECT * FROM services WHERE code = 'DIGITAL_WALLET'`)
      expect(res.rows.length).toBe(1)
      const service = res.rows[0]
      expect(service.code).toBe('DIGITAL_WALLET')
      expect(service.name).toBe('SKMNetwork Digital Wallet')
      expect(service.category).toBe('FINANCIAL')
      expect(service.service_type).toBe('INTERNAL')
      expect(service.lifecycle_status).toBe('ACTIVE')
      expect(service.public_visibility).toBe(true)
    })
  })

  describe('2. wallet_accounts Table Schema & Integrity', () => {
    it('DW-1A-002: creates a valid wallet_account with defaults and UUID PK', async () => {
      const accountCustomerId = await createTestAccountCustomer()
      const walletNumber = `WAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`

      const res = await pool.query(
        `INSERT INTO wallet_accounts (account_customer_id, wallet_number)
         VALUES ($1, $2)
         RETURNING *`,
        [accountCustomerId, walletNumber]
      )

      expect(res.rows.length).toBe(1)
      const row = res.rows[0]
      expect(row.id).toBeDefined()
      expect(row.account_customer_id).toBe(accountCustomerId)
      expect(row.business_id).toBeNull()
      expect(row.wallet_number).toBe(walletNumber)
      expect(row.currency).toBe('IDR')
      expect(row.status).toBe('ACTIVE')
      expect(BigInt(row.balance)).toBe(0n)
      expect(BigInt(row.pending_credit)).toBe(0n)
      expect(BigInt(row.pending_debit)).toBe(0n)
      expect(BigInt(row.server_version)).toBe(1n)
      expect(row.metadata).toEqual({})
      expect(row.created_at).toBeDefined()
      expect(row.updated_at).toBeDefined()
    })

    it('DW-1A-003: creates wallet with optional business_id foreign key', async () => {
      const accountCustomerId = await createTestAccountCustomer()
      const businessId = await createTestBusiness()
      const walletNumber = `WAL-BIZ-${Date.now()}`

      const res = await pool.query(
        `INSERT INTO wallet_accounts (account_customer_id, business_id, wallet_number)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [accountCustomerId, businessId, walletNumber]
      )

      expect(res.rows.length).toBe(1)
      expect(res.rows[0].business_id).toBe(businessId)
    })

    it('DW-1A-004: enforces unique wallet_number', async () => {
      const ac1 = await createTestAccountCustomer()
      const ac2 = await createTestAccountCustomer()
      const walletNumber = `WAL-DUP-${Date.now()}`

      await pool.query(
        `INSERT INTO wallet_accounts (account_customer_id, wallet_number) VALUES ($1, $2)`,
        [ac1, walletNumber]
      )

      await expect(
        pool.query(
          `INSERT INTO wallet_accounts (account_customer_id, wallet_number) VALUES ($1, $2)`,
          [ac2, walletNumber]
        )
      ).rejects.toThrow(/violates unique constraint|duplicate key|23505/)
    })

    it('DW-1A-005: enforces unique (account_customer_id, currency)', async () => {
      const accountCustomerId = await createTestAccountCustomer()
      const w1 = `WAL-CUR1-${Date.now()}`
      const w2 = `WAL-CUR2-${Date.now()}`

      await pool.query(
        `INSERT INTO wallet_accounts (account_customer_id, wallet_number, currency) VALUES ($1, $2, 'IDR')`,
        [accountCustomerId, w1]
      )

      await expect(
        pool.query(
          `INSERT INTO wallet_accounts (account_customer_id, wallet_number, currency) VALUES ($1, $2, 'IDR')`,
          [accountCustomerId, w2]
        )
      ).rejects.toThrow(/uq_account_customer_currency|23505/)
    })

    it('DW-1A-006: prevents negative balance, pending_credit, and pending_debit', async () => {
      const ac = await createTestAccountCustomer()
      const wn = `WAL-NEG-${Date.now()}`

      await expect(
        pool.query(
          `INSERT INTO wallet_accounts (account_customer_id, wallet_number, balance) VALUES ($1, $2, -100)`,
          [ac, wn]
        )
      ).rejects.toThrow(/violates check constraint|23514/)

      await expect(
        pool.query(
          `INSERT INTO wallet_accounts (account_customer_id, wallet_number, pending_credit) VALUES ($1, $2, -50)`,
          [ac, wn]
        )
      ).rejects.toThrow(/violates check constraint|23514/)

      await expect(
        pool.query(
          `INSERT INTO wallet_accounts (account_customer_id, wallet_number, pending_debit) VALUES ($1, $2, -25)`,
          [ac, wn]
        )
      ).rejects.toThrow(/violates check constraint|23514/)
    })

    it('DW-1A-007: enforces valid wallet status and server_version >= 1', async () => {
      const ac = await createTestAccountCustomer()
      const wn = `WAL-VER-${Date.now()}`

      await expect(
        pool.query(
          `INSERT INTO wallet_accounts (account_customer_id, wallet_number, status) VALUES ($1, $2, 'INVALID_STATUS')`,
          [ac, wn]
        )
      ).rejects.toThrow(/violates check constraint|23514/)

      await expect(
        pool.query(
          `INSERT INTO wallet_accounts (account_customer_id, wallet_number, server_version) VALUES ($1, $2, 0)`,
          [ac, wn]
        )
      ).rejects.toThrow(/violates check constraint|23514/)
    })
  })

  describe('3. wallet_ledgers Table Schema & Balance Math Constraints', () => {
    it('DW-1A-008: inserts valid CREDIT ledger entry with correct mathematical invariant', async () => {
      const ac = await createTestAccountCustomer()
      const wn = `WAL-LED-CR-${Date.now()}`
      const wRes = await pool.query(
        `INSERT INTO wallet_accounts (account_customer_id, wallet_number, balance) VALUES ($1, $2, 50000) RETURNING id`,
        [ac, wn]
      )
      const walletId = wRes.rows[0].id
      const idKey = `IDEM-CR-${Date.now()}`

      const res = await pool.query(
        `INSERT INTO wallet_ledgers (
           wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
           reference_type, reference_id, idempotency_key, actor_scope, description
         ) VALUES ($1, 'TOP_UP', 'CREDIT', 50000, 0, 50000, 'TOP_UP_INTENT', 'REF-123', $2, 'customer', 'Topup balance')
         RETURNING *`,
        [walletId, idKey]
      )

      expect(res.rows.length).toBe(1)
      const row = res.rows[0]
      expect(row.id).toBeDefined()
      expect(row.wallet_id).toBe(walletId)
      expect(row.transaction_type).toBe('TOP_UP')
      expect(row.entry_type).toBe('CREDIT')
      expect(BigInt(row.amount)).toBe(50000n)
      expect(BigInt(row.balance_before)).toBe(0n)
      expect(BigInt(row.balance_after)).toBe(50000n)
      expect(row.idempotency_key).toBe(idKey)
      expect(row.created_at).toBeDefined()
    })

    it('DW-1A-009: inserts valid DEBIT ledger entry with correct mathematical invariant', async () => {
      const ac = await createTestAccountCustomer()
      const wn = `WAL-LED-DR-${Date.now()}`
      const wRes = await pool.query(
        `INSERT INTO wallet_accounts (account_customer_id, wallet_number, balance) VALUES ($1, $2, 30000) RETURNING id`,
        [ac, wn]
      )
      const walletId = wRes.rows[0].id
      const idKey = `IDEM-DR-${Date.now()}`

      const res = await pool.query(
        `INSERT INTO wallet_ledgers (
           wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
           reference_type, reference_id, idempotency_key, actor_scope, description
         ) VALUES ($1, 'DEBIT', 'DEBIT', 20000, 50000, 30000, 'PLATFORM_INVOICE', 'INV-456', $2, 'system', 'Invoice debit')
         RETURNING *`,
        [walletId, idKey]
      )

      expect(res.rows.length).toBe(1)
      expect(BigInt(res.rows[0].amount)).toBe(20000n)
      expect(BigInt(res.rows[0].balance_before)).toBe(50000n)
      expect(BigInt(res.rows[0].balance_after)).toBe(30000n)
    })

    it('DW-1A-010: rejects ledger entry with broken balance math (CREDIT math mismatch)', async () => {
      const ac = await createTestAccountCustomer()
      const wn = `WAL-LED-MATH-${Date.now()}`
      const wRes = await pool.query(
        `INSERT INTO wallet_accounts (account_customer_id, wallet_number) VALUES ($1, $2) RETURNING id`,
        [ac, wn]
      )
      const walletId = wRes.rows[0].id

      await expect(
        pool.query(
          `INSERT INTO wallet_ledgers (
             wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
             reference_type, reference_id, idempotency_key, actor_scope, description
           ) VALUES ($1, 'TOP_UP', 'CREDIT', 50000, 0, 40000, 'TOP_UP_INTENT', 'REF-ERR', $2, 'customer', 'Broken math')`,
          [walletId, `IDEM-ERR-${Date.now()}`]
        )
      ).rejects.toThrow(/chk_wallet_ledger_balance_math|23514/)
    })

    it('DW-1A-011: rejects ledger entry with broken balance math (DEBIT math mismatch)', async () => {
      const ac = await createTestAccountCustomer()
      const wn = `WAL-LED-MATH2-${Date.now()}`
      const wRes = await pool.query(
        `INSERT INTO wallet_accounts (account_customer_id, wallet_number) VALUES ($1, $2) RETURNING id`,
        [ac, wn]
      )
      const walletId = wRes.rows[0].id

      await expect(
        pool.query(
          `INSERT INTO wallet_ledgers (
             wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
             reference_type, reference_id, idempotency_key, actor_scope, description
           ) VALUES ($1, 'DEBIT', 'DEBIT', 20000, 50000, 40000, 'PLATFORM_INVOICE', 'INV-ERR', $2, 'system', 'Broken math')`,
          [walletId, `IDEM-ERR2-${Date.now()}`]
        )
      ).rejects.toThrow(/chk_wallet_ledger_balance_math|23514/)
    })

    it('DW-1A-012: rejects non-positive amount on ledger', async () => {
      const ac = await createTestAccountCustomer()
      const wn = `WAL-LED-ZERO-${Date.now()}`
      const wRes = await pool.query(
        `INSERT INTO wallet_accounts (account_customer_id, wallet_number) VALUES ($1, $2) RETURNING id`,
        [ac, wn]
      )
      const walletId = wRes.rows[0].id

      await expect(
        pool.query(
          `INSERT INTO wallet_ledgers (
             wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
             reference_type, reference_id, idempotency_key, actor_scope, description
           ) VALUES ($1, 'CREDIT', 'CREDIT', 0, 0, 0, 'ADJUSTMENT', 'REF-0', $2, 'system', 'Zero amount')`,
          [walletId, `IDEM-ZERO-${Date.now()}`]
        )
      ).rejects.toThrow(/violates check constraint|23514/)
    })

    it('DW-1A-013: enforces unique idempotency_key across ledgers', async () => {
      const ac = await createTestAccountCustomer()
      const wn = `WAL-LED-IDEM-${Date.now()}`
      const wRes = await pool.query(
        `INSERT INTO wallet_accounts (account_customer_id, wallet_number) VALUES ($1, $2) RETURNING id`,
        [ac, wn]
      )
      const walletId = wRes.rows[0].id
      const idKey = `IDEM-DUP-TEST-${Date.now()}`

      await pool.query(
        `INSERT INTO wallet_ledgers (
           wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
           reference_type, reference_id, idempotency_key, actor_scope, description
         ) VALUES ($1, 'CREDIT', 'CREDIT', 1000, 0, 1000, 'ADJUSTMENT', 'REF-1', $2, 'system', 'First')`,
        [walletId, idKey]
      )

      await expect(
        pool.query(
          `INSERT INTO wallet_ledgers (
             wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
             reference_type, reference_id, idempotency_key, actor_scope, description
           ) VALUES ($1, 'CREDIT', 'CREDIT', 1000, 1000, 2000, 'ADJUSTMENT', 'REF-2', $2, 'system', 'Second')`,
          [walletId, idKey]
        )
      ).rejects.toThrow(/violates unique constraint|duplicate key|23505/)
    })
  })

  describe('4. top_up_intents Table Schema & Constraints', () => {
    it('DW-1A-014: creates a valid top_up_intent with status PENDING', async () => {
      const ac = await createTestAccountCustomer()
      const wn = `WAL-INT-${Date.now()}`
      const wRes = await pool.query(
        `INSERT INTO wallet_accounts (account_customer_id, wallet_number) VALUES ($1, $2) RETURNING id`,
        [ac, wn]
      )
      const walletId = wRes.rows[0].id
      const intentNumber = `TOP-${Date.now()}`

      const res = await pool.query(
        `INSERT INTO top_up_intents (
           intent_number, wallet_id, account_customer_id, amount, fee_amount, total_payable,
           expires_at
         ) VALUES ($1, $2, $3, 100000, 2500, 102500, now() + interval '1 day')
         RETURNING *`,
        [intentNumber, walletId, ac]
      )

      expect(res.rows.length).toBe(1)
      const row = res.rows[0]
      expect(row.id).toBeDefined()
      expect(row.intent_number).toBe(intentNumber)
      expect(row.wallet_id).toBe(walletId)
      expect(row.account_customer_id).toBe(ac)
      expect(BigInt(row.amount)).toBe(100000n)
      expect(BigInt(row.fee_amount)).toBe(2500n)
      expect(BigInt(row.total_payable)).toBe(102500n)
      expect(row.status).toBe('PENDING')
      expect(row.created_at).toBeDefined()
      expect(row.updated_at).toBeDefined()
    })

    it('DW-1A-015: enforces unique intent_number and status check constraints', async () => {
      const ac = await createTestAccountCustomer()
      const wn = `WAL-INT-STATUS-${Date.now()}`
      const wRes = await pool.query(
        `INSERT INTO wallet_accounts (account_customer_id, wallet_number) VALUES ($1, $2) RETURNING id`,
        [ac, wn]
      )
      const walletId = wRes.rows[0].id
      const intentNumber = `TOP-STATUS-${Date.now()}`

      await pool.query(
        `INSERT INTO top_up_intents (
           intent_number, wallet_id, account_customer_id, amount, total_payable, expires_at
         ) VALUES ($1, $2, $3, 50000, 50000, now() + interval '1 day')`,
        [intentNumber, walletId, ac]
      )

      // Unique intent_number
      await expect(
        pool.query(
          `INSERT INTO top_up_intents (
             intent_number, wallet_id, account_customer_id, amount, total_payable, expires_at
           ) VALUES ($1, $2, $3, 50000, 50000, now() + interval '1 day')`,
          [intentNumber, walletId, ac]
        )
      ).rejects.toThrow(/violates unique constraint|duplicate key|23505/)

      // Invalid status check
      await expect(
        pool.query(
          `INSERT INTO top_up_intents (
             intent_number, wallet_id, account_customer_id, amount, total_payable, status, expires_at
           ) VALUES ($1, $2, $3, 50000, 50000, 'BOGUS_STATUS', now() + interval '1 day')`,
          [`TOP-BOGUS-${Date.now()}`, walletId, ac]
        )
      ).rejects.toThrow(/violates check constraint|23514/)
    })
  })

  describe('5. Foreign Key Protection & Deletion Safety', () => {
    it('DW-1A-016: protects account_customers from deletion when active wallet exists (ON DELETE RESTRICT)', async () => {
      const ac = await createTestAccountCustomer()
      const wn = `WAL-PROT-${Date.now()}`
      await pool.query(
        `INSERT INTO wallet_accounts (account_customer_id, wallet_number) VALUES ($1, $2)`,
        [ac, wn]
      )

      await expect(
        pool.query(`DELETE FROM account_customers WHERE id = $1`, [ac])
      ).rejects.toThrow(/violates foreign key constraint|23503/)
    })

    it('DW-1A-017: protects wallet_accounts from deletion when ledgers exist (ON DELETE RESTRICT)', async () => {
      const ac = await createTestAccountCustomer()
      const wn = `WAL-PROT-LED-${Date.now()}`
      const wRes = await pool.query(
        `INSERT INTO wallet_accounts (account_customer_id, wallet_number, balance) VALUES ($1, $2, 1000) RETURNING id`,
        [ac, wn]
      )
      const walletId = wRes.rows[0].id

      await pool.query(
        `INSERT INTO wallet_ledgers (
           wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
           reference_type, reference_id, idempotency_key, actor_scope, description
         ) VALUES ($1, 'CREDIT', 'CREDIT', 1000, 0, 1000, 'ADJUSTMENT', 'REF-PROT', $2, 'system', 'Protected')`,
        [walletId, `IDEM-PROT-${Date.now()}`]
      )

      await expect(
        pool.query(`DELETE FROM wallet_accounts WHERE id = $1`, [walletId])
      ).rejects.toThrow(/violates foreign key constraint|23503/)
    })

    it('DW-1A-018: validates migration idempotency by re-running migration', async () => {
      await expect(
        runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
      ).resolves.not.toThrow()
    })
  })
})
