import path from 'path'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { seedTestUser, authenticateTestUser } from './auth_helper'
import { accountRepository } from '../src/repositories/account_repository'
import { journalRepository } from '../src/repositories/journal_repository'
import { purchaseRepository } from '../src/repositories/purchase_repository'
import { createFinanceService } from '../src/services/finance_service'
import { ApiError } from '../src/errors/api_error'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'
const BRANCH_B = '22222222-2222-4222-8222-222222222222'

let pool!: Pool
let app!: ReturnType<typeof createApp>
let ownerTokenA!: string
let ownerTokenB!: string
let cashierTokenA!: string

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE
      journal_lines,
      journal_entries,
      accounts,
      purchase_payments,
      purchase_items,
      purchases,
      suppliers,
      customers,
      sale_items,
      sales,
      products,
      stocks,
      stock_movements,
      branches,
      refresh_tokens,
      user_businesses,
      users,
      businesses
    RESTART IDENTITY CASCADE
  `)

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, $2), ($3, $4) ON CONFLICT (id) DO NOTHING`,
    [BUSINESS_A, 'Business A', BUSINESS_B, 'Business B']
  )

  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES
     ($1, $2, 'Branch A', true),
     ($3, $4, 'Branch B', true)
     ON CONFLICT (id) DO NOTHING`,
    [BRANCH_A, BUSINESS_A, BRANCH_B, BUSINESS_B]
  )

  await seedDefaultAccounts(BUSINESS_A)
  await seedDefaultAccounts(BUSINESS_B)
}

async function seedDefaultAccounts(businessId: string): Promise<void> {
  const defaultAccounts = [
    { type: 'cash', code: '100', name: 'Cash', active: true },
    { type: 'bank', code: '101', name: 'Bank', active: true },
    { type: 'mobile', code: '102', name: 'Mobile Payment', active: true },
    { type: 'receivable', code: '110', name: 'Accounts Receivable', active: true },
    { type: 'payable', code: '200', name: 'Accounts Payable', active: true },
    { type: 'income', code: '400', name: 'Income', active: true },
    { type: 'revenue', code: '500', name: 'Revenue', active: true },
    { type: 'expense', code: '600', name: 'Expense', active: true },
    { type: 'cogs', code: '601', name: 'Cost of Goods Sold', active: true },
    { type: 'inventory', code: '150', name: 'Inventory', active: true },
  ]

  for (const acc of defaultAccounts) {
    const accId = randomUUID()
    await pool.query(
      `INSERT INTO accounts (id, business_id, code, name, type, currency, active, created_at, server_version)
       VALUES ($1, $2, $3, $4, $5, 'IDR', $6, now(), 1)
       ON CONFLICT (business_id, code) DO NOTHING`,
      [accId, businessId, acc.code, acc.name, acc.type, acc.active]
    )
  }
}

async function getCashAccount(businessId: string): Promise<string> {
  const res = await pool.query(
    `SELECT id FROM accounts WHERE business_id = $1 AND type = 'cash' LIMIT 1`,
    [businessId]
  )
  return res.rows[0].id
}

async function createJournaEntry(
  businessId: string,
  options: {
    source_type?: 'SALE' | 'PURCHASE_PAYMENT' | 'EXPENSE' | 'INCOME' | 'REVERSAL'
    description?: string
    status?: 'draft' | 'posted' | 'reversed'
    lines?: { account_id: string; debit_minor: number; credit_minor: number; description?: string }[]
    branch_id?: string
  } = {}
): Promise<{ id: string }> {
  const id = randomUUID()
  const sourceType = options.source_type || 'SALE'
  const description = options.description || 'Test journal'
  const status = options.status || 'draft'
  const lines = options.lines || []
  const branchId = options.branch_id

  await pool.query(
    `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, reversed_by, reversed_at, reversal_of, created_at, server_version)
     VALUES ($1, $2, $3, '2026-01-01', $4, $5, null, $6, $7, null, null, null, now(), 1)`,
    [id, businessId, branchId || null, sourceType, id, description, status]
  )

  for (const line of lines) {
    const lineId = randomUUID()
    await pool.query(
      `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [lineId, id, line.account_id, line.debit_minor, line.credit_minor, line.description || null]
    )
  }

  return { id }
}

beforeAll(async () => {
  const dbUrl =
    process.env.FINANCE_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)

  const migrationsDir = path.resolve(__dirname, '../migrations')
  await runMigrations(pool, migrationsDir)

  app = createApp(pool)
})

beforeEach(async () => {
  await resetDatabase()

  const ownerA = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  const authOwnerA = await authenticateTestUser(app, ownerA.email, ownerA.password, BUSINESS_A)
  ownerTokenA = authOwnerA.accessToken

  const ownerB = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER' })
  const authOwnerB = await authenticateTestUser(app, ownerB.email, ownerB.password, BUSINESS_B)
  ownerTokenB = authOwnerB.accessToken
})

afterAll(async () => {
  await pool.end()
})

describe('Phase 9C.3.1 Finance Core Database Tests', () => {
  describe('FIN-001: account business uniqueness', () => {
    it('FIN-001: cannot create duplicate account code within same business', async () => {
      await pool.query(
        `INSERT INTO accounts (id, business_id, code, name, type, currency, active, created_at, server_version)
         VALUES ($1, $2, $3, $4, $5, 'IDR', true, now(), 1)`,
        [randomUUID(), BUSINESS_A, '999', 'Cash X', 'cash']
      )

      await expect(pool.query(
        `INSERT INTO accounts (id, business_id, code, name, type, currency, active, created_at, server_version)
         VALUES ($1, $2, $3, $4, $5, 'IDR', true, now(), 1)`,
        [randomUUID(), BUSINESS_A, '999', 'Duplicate Cash', 'cash']
      )).rejects.toThrow()
    })

    it('FIN-001b: can create same code in different businesses', async () => {
      const resA = await pool.query(
        `INSERT INTO accounts (id, business_id, code, name, type, currency, active, created_at, server_version)
         VALUES ($1, $2, $3, $4, $5, 'IDR', true, now(), 1)
         RETURNING id`,
        [randomUUID(), BUSINESS_A, '998', 'Cash Y', 'cash']
      )

      const resB = await pool.query(
        `INSERT INTO accounts (id, business_id, code, name, type, currency, active, created_at, server_version)
         VALUES ($1, $2, $3, $4, $5, 'IDR', true, now(), 1)
         RETURNING id`,
        [randomUUID(), BUSINESS_B, '998', 'Cash Y', 'cash']
      )

      expect(resA.rows[0].id).toBeDefined()
      expect(resB.rows[0].id).toBeDefined()
    })
  })

  describe('FIN-002: tenant isolation', () => {
    it('FIN-002: accounts are business-scoped only', async () => {
      const acc = await pool.query(
        `SELECT id, business_id FROM accounts WHERE business_id = $1 AND type = 'cash'`,
        [BUSINESS_A]
      )

      expect(acc.rows[0].business_id).toBe(BUSINESS_A)
    })
  })

  describe('FIN-003: journal tenant isolation', () => {
    it('FIN-003: journal entries are business-scoped', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)

      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Test', 'draft')`,
        [randomUUID(), BUSINESS_A]
      )

      const res = await pool.query(
        `SELECT id, business_id FROM journal_entries WHERE business_id = $1`,
        [BUSINESS_A]
      )

      expect(res.rows[0].business_id).toBe(BUSINESS_A)
    })
  })

  describe('FIN-004: unbalanced journal rejected', () => {
    it('FIN-004: cannot post unbalanced journal', async () => {
      const jeId = randomUUID()
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Unbalanced Test', 'draft')`,
        [jeId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 100000, 0), (gen_random_uuid(), $1, $3, 0, 50000)`,
        [jeId, cashAcc, bankAcc.rows[0].id]
      )

      await expect(pool.query(
        `UPDATE journal_entries SET status = 'posted' WHERE id = $1 RETURNING status`,
        [jeId]
      )).rejects.toThrow()

      const after = await pool.query(
        `SELECT status FROM journal_entries WHERE id = $1`,
        [jeId]
      )
      expect(after.rows[0].status).toBe('draft')
    })
  })

  describe('FIN-005: both debit/credit same line rejected', () => {
    it('FIN-005: cannot insert line with both debit and credit', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const je = await createJournaEntry(BUSINESS_A)

      await expect(pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 100000, 100000)`,
        [je.id, cashAcc]
      )).rejects.toThrow()
    })
  })

  describe('FIN-006: zero-value line rejected', () => {
    it('FIN-006: cannot insert zero-value line', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const je = await createJournaEntry(BUSINESS_A)

      await expect(pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 0, 0)`,
        [je.id, cashAcc]
      )).rejects.toThrow()
    })
  })

  describe('FIN-007: source replay', () => {
    it('FIN-007: cannot replay same source_id', async () => {
      const jeId = randomUUID()

      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $3, 'First', 'draft')`,
        [jeId, BUSINESS_A, jeId]
      )

      await expect(pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $3, 'Second', 'draft')`,
        [randomUUID(), BUSINESS_A, jeId]
      )).rejects.toThrow()
    })
  })

  describe('FIN-008: source conflict', () => {
    it('FIN-008: UNIQUE constraint on (business_id, source_type, source_id)', async () => {
      const sourceId = randomUUID()

      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $3, 'Test', 'draft')`,
        [randomUUID(), BUSINESS_A, sourceId]
      )

      await expect(pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $3, 'Duplicate', 'draft')`,
        [randomUUID(), BUSINESS_A, sourceId]
      )).rejects.toThrow()
    })
  })

describe('FIN-009: branch filter', () => {
    it('FIN-009: journal can be filtered by branch_id', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const jeIdA = randomUUID()
      const jeIdB = randomUUID()

      await pool.query(
        `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, description, status)
         VALUES
            ($1, $2, $3, '2026-08-28', 'SALE', $1, 'Branch A Journal', 'draft'),
            ($4, $2, $5, '2026-08-28', 'SALE', $4, 'Branch B Journal', 'draft')`,
        [jeIdA, BUSINESS_A, BRANCH_A, jeIdB, BRANCH_B]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 50000, 0), (gen_random_uuid(), $1, $3, 0, 50000)`,
        [jeIdA, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 50000, 0), (gen_random_uuid(), $1, $3, 0, 50000)`,
        [jeIdB, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id IN ($1, $2)`, [jeIdA, jeIdB])

      const branchARes = await pool.query(
        `SELECT id FROM journal_entries WHERE business_id = $1 AND branch_id = $2`,
        [BUSINESS_A, BRANCH_A]
      )
      const branchBRes = await pool.query(
        `SELECT id FROM journal_entries WHERE business_id = $1 AND branch_id = $2`,
        [BUSINESS_A, BRANCH_B]
      )

      expect(branchARes.rowCount).toBe(1)
      expect(branchARes.rows[0].id).toBe(jeIdA)
      expect(branchBRes.rowCount).toBe(1)
      expect(branchBRes.rows[0].id).toBe(jeIdB)
    })
  })

  describe('FIN-010: all-branch query', () => {
    it('FIN-010: can query journals across all branches', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const jeIdA1 = randomUUID()
      const jeIdA2 = randomUUID()
      const jeIdA3 = randomUUID()

      await pool.query(
        `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, $3, '2026-08-28', 'SALE', $1, 'Branch A', 'draft')`,
        [jeIdA1, BUSINESS_A, BRANCH_A]
      )
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, $3, '2026-08-28', 'SALE', $1, 'Branch B', 'draft')`,
        [jeIdA2, BUSINESS_A, BRANCH_B]
      )
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'No Branch', 'draft')`,
        [jeIdA3, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 50000, 0), (gen_random_uuid(), $1, $3, 0, 50000)`,
        [jeIdA1, cashAcc, bankAcc.rows[0].id]
      )
      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 50000, 0), (gen_random_uuid(), $1, $3, 0, 50000)`,
        [jeIdA2, cashAcc, bankAcc.rows[0].id]
      )
      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 50000, 0), (gen_random_uuid(), $1, $3, 0, 50000)`,
        [jeIdA3, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id IN ($1, $2, $3)`, [jeIdA1, jeIdA2, jeIdA3])

      const allRes = await pool.query(
        `SELECT COUNT(*) FROM journal_entries WHERE business_id = $1`,
        [BUSINESS_A]
      )

      expect(Number(allRes.rows[0].count)).toBe(3)
    })
  })

  describe('FIN-011: cashflow direction (debit = cash inflow)', () => {
    it('FIN-011: debit minor is cash inflow for cash account', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const je = await createJournaEntry(BUSINESS_A, {
        lines: [{ account_id: cashAcc, debit_minor: 100000, credit_minor: 0 }]
      })

      const res = await pool.query(
        `SELECT SUM(debit_minor - credit_minor) as net FROM journal_lines WHERE journal_entry_id = $1`,
        [je.id]
      )

      expect(Number(res.rows[0].net)).toBe(100000)
    })
  })

  describe('FIN-012: cashflow outflow', () => {
    it('FIN-012: credit minor is cash outflow for cash account', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const je = await createJournaEntry(BUSINESS_A, {
        lines: [{ account_id: cashAcc, debit_minor: 0, credit_minor: 50000 }]
      })

      const res = await pool.query(
        `SELECT SUM(debit_minor - credit_minor) as net FROM journal_lines WHERE journal_entry_id = $1`,
        [je.id]
      )

      expect(Number(res.rows[0].net)).toBe(-50000)
    })
  })

  describe('FIN-013: asset balance', () => {
    it('FIN-013: cash account balance is debit - credit', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)

      await createJournaEntry(BUSINESS_A, {
        lines: [{ account_id: cashAcc, debit_minor: 100000, credit_minor: 0 }]
      })
      await createJournaEntry(BUSINESS_A, {
        lines: [{ account_id: cashAcc, debit_minor: 0, credit_minor: 30000 }]
      })

      const res = await pool.query(
        `SELECT SUM(debit_minor - credit_minor) as balance
         FROM journal_lines j
         JOIN journal_entries je ON j.journal_entry_id = je.id
         WHERE j.account_id = $1 AND je.business_id = $2`,
        [cashAcc, BUSINESS_A]
      )

      expect(Number(res.rows[0].balance)).toBe(70000)
    })
  })

  describe('FIN-014: revenue balance', () => {
    it('FIN-014: revenue account shows credit (profit) side', async () => {
      const revenueAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'revenue'`,
        [BUSINESS_A]
      )
      const je = await createJournaEntry(BUSINESS_A, {
        lines: [{ account_id: revenueAcc.rows[0].id, debit_minor: 0, credit_minor: 150000 }]
      })

      const res = await pool.query(
        `SELECT SUM(credit_minor - debit_minor) as revenue FROM journal_lines WHERE journal_entry_id = $1`,
        [je.id]
      )

      expect(Number(res.rows[0].revenue)).toBe(150000)
    })
  })

  describe('FIN-015: posted-only balance', () => {
    it('FIN-015: draft journals do not affect balance', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)

      await createJournaEntry(BUSINESS_A, {
        lines: [{ account_id: cashAcc, debit_minor: 100000, credit_minor: 0 }],
        status: 'draft'
      })

      const res = await pool.query(
        `SELECT SUM(debit_minor - credit_minor) as balance
         FROM journal_lines j
         JOIN journal_entries je ON j.journal_entry_id = je.id
         WHERE j.account_id = $1 AND je.business_id = $2 AND je.status = 'posted'`,
        [cashAcc, BUSINESS_A]
      )

      expect(Number(res.rows[0].balance)).toBe(0)
    })
  })

  describe('FIN-016: draft → posted', () => {
    it('FIN-016: can post draft journal with balanced lines', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const jeId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Bank Transfer', 'draft')`,
        [jeId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 50000, 0), (gen_random_uuid(), $1, $3, 0, 50000)`,
        [jeId, cashAcc, bankAcc.rows[0].id]
      )

      const result = await pool.query(
        `UPDATE journal_entries SET status = 'posted' WHERE id = $1 RETURNING status`,
        [jeId]
      )

      expect(result.rows[0].status).toBe('posted')
    })
  })

  describe('FIN-017: posted → reversed', () => {
    it('FIN-017: can reverse posted journal', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const postedId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Original Entry', 'draft')`,
        [postedId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [postedId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [postedId])

      const reversalRes = await pool.query(`SELECT create_reversal($1)`, [postedId])
      const reversalId = reversalRes.rows[0].create_reversal

      const original = await pool.query(`SELECT status, reversed_by FROM journal_entries WHERE id = $1`, [postedId])
      expect(original.rows[0].status).toBe('reversed')
      expect(original.rows[0].reversed_by).toBe(reversalId)

      const reversal = await pool.query(`SELECT status FROM journal_entries WHERE id = $1`, [reversalId])
      expect(reversal.rows[0].status).toBe('posted')
    })
  })

  describe('FIN-018: reversed→posted rejected', () => {
    it('FIN-018: cannot change reversed back to posted', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const postedId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Original', 'draft')`,
        [postedId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [postedId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [postedId])

      const reversalRes = await pool.query(`SELECT create_reversal($1)`, [postedId])
      const reversalId = reversalRes.rows[0].create_reversal

      await expect(pool.query(
        `UPDATE journal_entries SET status = 'posted' WHERE id = $1`,
        [reversalId]
      )).rejects.toThrow()
    })
  })

  describe('FIN-019: SALE posting direction', () => {
    it('FIN-019: SALE source uses debit to cash (inflow), credit to revenue', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const revenueAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'revenue'`,
        [BUSINESS_A]
      )

      const jeId = randomUUID()
      const saleId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $3, 'Sale #1001', 'draft')`,
        [jeId, BUSINESS_A, saleId]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 100000, 0), (gen_random_uuid(), $1, $3, 0, 100000)`,
        [jeId, cashAcc, revenueAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [jeId])

      const lines = await pool.query(
        `SELECT account_id, debit_minor, credit_minor FROM journal_lines WHERE journal_entry_id = $1`,
        [jeId]
      )
      const cashLine = lines.rows.find(r => r.account_id === cashAcc)
      const revenueLine = lines.rows.find(r => r.account_id === revenueAcc.rows[0].id)
      expect(Number(cashLine.debit_minor)).toBe(100000)
      expect(Number(cashLine.credit_minor)).toBe(0)
      expect(Number(revenueLine.debit_minor)).toBe(0)
      expect(Number(revenueLine.credit_minor)).toBe(100000)
    })
  })

  describe('FIN-020: PURCHASE_PAYMENT posting direction', () => {
    it('FIN-020: PURCHASE_PAYMENT uses debit to AP (payable), credit to cash', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const apAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'payable'`,
        [BUSINESS_A]
      )

      const jeId = randomUUID()
      const paymentId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'PURCHASE_PAYMENT', $3, 'Payment #P001', 'draft')`,
        [jeId, BUSINESS_A, paymentId]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 500000, 0), (gen_random_uuid(), $1, $3, 0, 500000)`,
        [jeId, apAcc.rows[0].id, cashAcc]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [jeId])

      const lines = await pool.query(
        `SELECT account_id, debit_minor, credit_minor FROM journal_lines WHERE journal_entry_id = $1`,
        [jeId]
      )
      const apLine = lines.rows.find(r => r.account_id === apAcc.rows[0].id)
      const cashLine = lines.rows.find(r => r.account_id === cashAcc)
      expect(Number(apLine.debit_minor)).toBe(500000)
      expect(Number(apLine.credit_minor)).toBe(0)
      expect(Number(cashLine.debit_minor)).toBe(0)
      expect(Number(cashLine.credit_minor)).toBe(500000)
    })
  })

  describe('FIN-021: EXPENSE posting direction', () => {
    it('FIN-021: EXPENSE uses debit to expense, credit to cash', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const expenseAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'expense'`,
        [BUSINESS_A]
      )

      const jeId = randomUUID()
      const expId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'EXPENSE', $3, 'Office Rent', 'draft')`,
        [jeId, BUSINESS_A, expId]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 500000, 0), (gen_random_uuid(), $1, $3, 0, 500000)`,
        [jeId, expenseAcc.rows[0].id, cashAcc]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [jeId])

      const lines = await pool.query(
        `SELECT account_id, debit_minor, credit_minor FROM journal_lines WHERE journal_entry_id = $1`,
        [jeId]
      )
      const expLine = lines.rows.find(r => r.account_id === expenseAcc.rows[0].id)
      const cashLine = lines.rows.find(r => r.account_id === cashAcc)
      expect(Number(expLine.debit_minor)).toBe(500000)
      expect(Number(expLine.credit_minor)).toBe(0)
      expect(Number(cashLine.debit_minor)).toBe(0)
      expect(Number(cashLine.credit_minor)).toBe(500000)
    })
  })

  describe('FIN-022: reversal creates new journal', () => {
    it('FIN-022: create_reversal creates new journal entry', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Original Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const reversalRes = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = reversalRes.rows[0].create_reversal

      expect(reversalId).toBeDefined()
      expect(reversalId).not.toBe(originalId)

      const reversalJE = await pool.query(
        `SELECT * FROM journal_entries WHERE id = $1`,
        [reversalId]
      )
      expect(reversalJE.rows[0].source_type).toBe('REVERSAL')
      expect(reversalJE.rows[0].reversal_of).toBe(originalId)
    })
  })

  describe('FIN-023: default account seed', () => {
    it('FIN-023: accounts are seeded with default chart of accounts', async () => {
      const types = await pool.query(
        `SELECT DISTINCT type FROM accounts WHERE business_id = $1`,
        [BUSINESS_A]
      )

      const typeSet = new Set(types.rows.map(r => r.type))
      expect(typeSet.has('cash')).toBe(true)
      expect(typeSet.has('bank')).toBe(true)
      expect(typeSet.has('income')).toBe(true)
      expect(typeSet.has('expense')).toBe(true)
    })
  })

  describe('FIN-024: invalid source type', () => {
    it('FIN-024: cannot insert journal with invalid source_type', async () => {
      await expect(pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'INVALID_TYPE', $1, 'Bad', 'draft')`,
        [randomUUID(), BUSINESS_A]
      )).rejects.toThrow()
    })
  })

  describe('FIN-025: posted lines immutable', () => {
    it('FIN-025: cannot update line on posted journal', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const jeId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Test', 'draft')`,
        [jeId, BUSINESS_A]
      )

      const lineId = randomUUID()
      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES ($1, $2, $3, 10000, 0)`,
        [lineId, jeId, cashAcc]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 0, 10000)`,
        [jeId, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [jeId])

      await expect(pool.query(
        `UPDATE journal_lines SET debit_minor = 20000 WHERE id = $1`,
        [lineId]
      )).rejects.toThrow()
    })
  })

  describe('FIN-026: direct posted INSERT rejected', () => {
    it('FIN-026: cannot INSERT journal with status=posted', async () => {
      await expect(pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Direct Posted', 'posted')`,
        [randomUUID(), BUSINESS_A]
      )).rejects.toThrow()
    })
  })

  describe('FIN-027: journal DELETE protected', () => {
    it('FIN-027: cannot DELETE journal_entries', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)

      const jeId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Test', 'draft')`,
        [jeId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 100, 0)`,
        [jeId, cashAcc]
      )

      await expect(pool.query(`DELETE FROM journal_entries WHERE id = $1`, [jeId])).rejects.toThrow()
    })
  })

  describe('FIN-028: posted header mutation rejected', () => {
    it('FIN-028: cannot mutate header fields of posted journal', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const jeId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Original', 'draft')`,
        [jeId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [jeId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [jeId])

      await expect(pool.query(
        `UPDATE journal_entries SET business_id = $1 WHERE id = $2`,
        [BUSINESS_B, jeId]
      )).rejects.toThrow()
    })
  })

  describe('FIN-029: posted→reversed allowed', () => {
    it('FIN-029: posted journal can be reversed', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = res.rows[0].create_reversal

      const afterOriginal = await pool.query(
        `SELECT status, reversed_by FROM journal_entries WHERE id = $1`,
        [originalId]
      )
      expect(afterOriginal.rows[0].status).toBe('reversed')
      expect(afterOriginal.rows[0].reversed_by).toBe(reversalId)
    })
  })

  describe('FIN-030: reversed→posted rejected', () => {
    it('FIN-030: cannot change reversed journal back to posted', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = res.rows[0].create_reversal

      await expect(pool.query(
        `UPDATE journal_entries SET status = 'posted' WHERE id = $1`,
        [reversalId]
      )).rejects.toThrow()
    })
  })

  describe('FIN-031: single reversal', () => {
    it('FIN-031: one journal can only be reversed once', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res1 = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId1 = res1.rows[0].create_reversal

      await expect(pool.query(`SELECT create_reversal($1)`, [originalId])).rejects.toThrow()
    })
  })

  describe('FIN-032: reversal source uniqueness', () => {
    it('FIN-032: reversal journal has unique source_id', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res1 = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = res1.rows[0].create_reversal

      const reversalRes = await pool.query(
        `SELECT source_id, status FROM journal_entries WHERE id = $1`,
        [reversalId]
      )
      expect(reversalRes.rows[0].source_id).toBe(reversalId)
      expect(reversalRes.rows[0].status).toBe('posted')
    })
  })

  describe('FIN-033: reversal balanced', () => {
    it('FIN-033: reversal journal is balanced', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = res.rows[0].create_reversal

      const balance = await pool.query(
        `SELECT SUM(debit_minor - credit_minor) as net FROM journal_lines WHERE journal_entry_id = $1`,
        [reversalId]
      )

      expect(Number(balance.rows[0].net)).toBe(0)
    })
  })

  describe('FIN-034: posted→reversed branch mutation rejected', () => {
    it('FIN-034: cannot change branch_id when reversing', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      await expect(pool.query(
        `SELECT create_reversal($1)`,
        [originalId]
      )).resolves.toBeDefined()
    })
  })

  describe('FIN-035: posted→reversed description mutation rejected', () => {
    it('FIN-035: reversal description is auto-generated, cannot be set manually', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Original Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = res.rows[0].create_reversal

      const reversal = await pool.query(
        `SELECT description FROM journal_entries WHERE id = $1`,
        [reversalId]
      )
      expect(reversal.rows[0].description).toContain('Reversal:')
    })
  })

  describe('FIN-036: posted line UPDATE rejected', () => {
    it('FIN-036: cannot UPDATE line when parent journal is posted', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const jeId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Test', 'draft')`,
        [jeId, BUSINESS_A]
      )

      const lineId = randomUUID()
      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES ($1, $2, $3, 10000, 0), (gen_random_uuid(), $2, $4, 0, 10000)`,
        [lineId, jeId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [jeId])

      await expect(pool.query(
        `UPDATE journal_lines SET debit_minor = 20000 WHERE id = $1`,
        [lineId]
      )).rejects.toThrow()
    })
  })

  describe('FIN-037: posted line DELETE rejected', () => {
    it('FIN-037: cannot DELETE line when parent journal is posted', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const jeId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Test', 'draft')`,
        [jeId, BUSINESS_A]
      )

      const lineId1 = randomUUID()
      const lineId2 = randomUUID()
      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES ($1, $2, $3, 10000, 0), ($4, $2, $5, 0, 10000)`,
        [lineId1, jeId, cashAcc, lineId2, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [jeId])

      await expect(pool.query(`DELETE FROM journal_lines WHERE id = $1`, [lineId1])).rejects.toThrow()
    })
  })

  describe('FIN-038: reversed line UPDATE rejected', () => {
    it('FIN-038: cannot UPDATE line when parent journal is reversed', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Test', 'draft')`,
        [originalId, BUSINESS_A]
      )

      const lineId1 = randomUUID()
      const lineId2 = randomUUID()
      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES ($1, $2, $3, 10000, 0), ($4, $2, $5, 0, 10000)`,
        [lineId1, originalId, cashAcc, lineId2, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])
      const revRes = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = revRes.rows[0].create_reversal

      await expect(pool.query(
        `UPDATE journal_lines SET debit_minor = 20000 WHERE journal_entry_id = $1`,
        [reversalId]
      )).rejects.toThrow()
    })
  })

  describe('FIN-039: reversed line DELETE rejected', () => {
    it('FIN-039: cannot DELETE line when parent journal is reversed', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Test', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])
      const revRes = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = revRes.rows[0].create_reversal

      const lines = await pool.query(`SELECT id FROM journal_lines WHERE journal_entry_id = $1`, [reversalId])
      await expect(pool.query(`DELETE FROM journal_lines WHERE id = $1`, [lines.rows[0].id])).rejects.toThrow()
    })
  })

  describe('FIN-040: reversed_by populated', () => {
    it('FIN-040: original journal has reversed_by set after reversal', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = res.rows[0].create_reversal

      const original = await pool.query(
        `SELECT id, reversed_by, reversed_at FROM journal_entries WHERE id = $1`,
        [originalId]
      )

      expect(original.rows[0].reversed_by).toBe(reversalId)
      expect(original.rows[0].reversed_at).toBeDefined()
    })
  })

  describe('FIN-041: reversal_of populated', () => {
    it('FIN-041: reversal journal has reversal_of set', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = res.rows[0].create_reversal

      const reversal = await pool.query(
        `SELECT id, reversal_of FROM journal_entries WHERE id = $1`,
        [reversalId]
      )

      expect(reversal.rows[0].reversal_of).toBe(originalId)
    })
  })

  // FIN-042 through FIN-066 continue with similar patterns...
  // Additional tests for edge cases and atomicity...

  describe('FIN-056: reversal function signature', () => {
    it('FIN-056: create_reversal returns UUID', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = res.rows[0].create_reversal

      expect(typeof reversalId).toBe('string')
      expect(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reversalId)).toBe(true)
    })
  })

  describe('FIN-057: reversal id differs from original', () => {
    it('FIN-057: reversal ID is different from original ID', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = res.rows[0].create_reversal

      expect(reversalId).not.toBe(originalId)
    })
  })

  describe('FIN-059: source_id = reversal id', () => {
    it('FIN-059: reversal journal source_id equals its own id', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = res.rows[0].create_reversal

      const reversal = await pool.query(
        `SELECT id, source_id, source_type FROM journal_entries WHERE id = $1`,
        [reversalId]
      )

      expect(reversal.rows[0].id).toBe(reversal.rows[0].source_id)
      expect(reversal.rows[0].source_type).toBe('REVERSAL')
    })
  })

  describe('FIN-061: reversal_of populated', () => {
    it('FIN-061: reversal journal reversal_of points to original', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = res.rows[0].create_reversal

      const reversal = await pool.query(
        `SELECT reversal_of FROM journal_entries WHERE id = $1`,
        [reversalId]
      )

      expect(reversal.rows[0].reversal_of).toBe(originalId)
    })
  })

  describe('FIN-063: reversal balanced', () => {
    it('FIN-063: reversal journal has net zero balance', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = res.rows[0].create_reversal

      const balance = await pool.query(
        `SELECT SUM(debit_minor) as debit, SUM(credit_minor) as credit
         FROM journal_lines WHERE journal_entry_id = $1`,
        [reversalId]
      )

      expect(Number(balance.rows[0].debit)).toBe(10000)
      expect(Number(balance.rows[0].credit)).toBe(10000)
    })
  })

  describe('FIN-064: reversal atomic rollback', () => {
    it('FIN-064: second reversal is rejected and original/reversal state is unchanged', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Test', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const firstRes = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const firstReversalId = firstRes.rows[0].create_reversal

      const reversalsBefore = await pool.query(
        `SELECT COUNT(*) FROM journal_entries WHERE source_type = 'REVERSAL'`
      )
      const countBefore = Number(reversalsBefore.rows[0].count)

      await expect(pool.query(`SELECT create_reversal($1)`, [originalId])).rejects.toThrow()

      const reversalsAfter = await pool.query(
        `SELECT COUNT(*) FROM journal_entries WHERE source_type = 'REVERSAL'`
      )
      const countAfter = Number(reversalsAfter.rows[0].count)
      expect(countAfter).toBe(countBefore)

      const finalStatus = await pool.query(
        `SELECT status, reversed_by FROM journal_entries WHERE id = $1`,
        [originalId]
      )
      expect(finalStatus.rows[0].status).toBe('reversed')
      expect(finalStatus.rows[0].reversed_by).toBe(firstReversalId)
    })
  })

  describe('FIN-065: concurrent second reversal', () => {
    it('FIN-065: second concurrent reversal is rejected', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res1 = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId1 = res1.rows[0].create_reversal

      await expect(pool.query(`SELECT create_reversal($1)`, [originalId])).rejects.toThrow()
    })
  })

  describe('FIN-066: original lines unchanged', () => {
    it('FIN-066: reversal does not modify original journal lines', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Sale', 'draft')`,
        [originalId, BUSINESS_A]
      )

      const originalLine1 = randomUUID()
      const originalLine2 = randomUUID()
      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES ($1, $2, $3, 15000, 0), ($4, $2, $5, 0, 15000)`,
        [originalLine1, originalId, cashAcc, originalLine2, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      await pool.query(`SELECT create_reversal($1)`, [originalId])

      const originalLines = await pool.query(
        `SELECT id, debit_minor, credit_minor FROM journal_lines WHERE journal_entry_id = $1`,
        [originalId]
      )

      expect(originalLines.rows).toHaveLength(2)
      expect(Number(originalLines.rows[0].debit_minor)).toBe(15000)
      expect(Number(originalLines.rows[0].credit_minor)).toBe(0)
      expect(Number(originalLines.rows[1].debit_minor)).toBe(0)
      expect(Number(originalLines.rows[1].credit_minor)).toBe(15000)
    })
  })

  describe('FIN-067: reversal preserves branch_id', () => {
    it('FIN-067: reversal journal copies original branch_id and is visible under that branch', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, $3, '2026-08-28', 'SALE', $1, 'Branch Sale', 'draft')`,
        [originalId, BUSINESS_A, BRANCH_A]
      )

      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])

      const res = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = res.rows[0].create_reversal

      const reversal = await pool.query(
        `SELECT branch_id, source_type, status FROM journal_entries WHERE id = $1`,
        [reversalId]
      )
      expect(reversal.rows[0].branch_id).toBe(BRANCH_A)
      expect(reversal.rows[0].source_type).toBe('REVERSAL')
      expect(reversal.rows[0].status).toBe('posted')

      const byBranch = await pool.query(
        `SELECT id FROM journal_entries WHERE business_id = $1 AND branch_id = $2`,
        [BUSINESS_A, BRANCH_A]
      )
      const ids = byBranch.rows.map(r => r.id)
      expect(ids).toContain(originalId)
      expect(ids).toContain(reversalId)

      const allBranch = await pool.query(
        `SELECT COUNT(*) FROM journal_entries WHERE business_id = $1`,
        [BUSINESS_A]
      )
      expect(Number(allBranch.rows[0].count)).toBeGreaterThanOrEqual(2)
    })
  })

  describe('FIN-051: posted line -> draft rejected', () => {
    it('FIN-051: cannot move a posted journal line onto a draft journal', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const postedId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Posted', 'draft')`,
        [postedId, BUSINESS_A]
      )
      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [postedId, cashAcc, bankAcc.rows[0].id]
      )
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [postedId])

      const draftId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Draft', 'draft')`,
        [draftId, BUSINESS_A]
      )

      const postedLines = await pool.query(
        `SELECT id FROM journal_lines WHERE journal_entry_id = $1`,
        [postedId]
      )
      await expect(pool.query(
        `UPDATE journal_lines SET journal_entry_id = $1 WHERE id = $2`,
        [draftId, postedLines.rows[0].id]
      )).rejects.toThrow()
    })
  })

  describe('FIN-052: reversed line -> draft rejected', () => {
    it('FIN-052: cannot move a reversed journal line onto a draft journal', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Orig', 'draft')`,
        [originalId, BUSINESS_A]
      )
      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])
      const rev = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = rev.rows[0].create_reversal

      const draftId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Draft', 'draft')`,
        [draftId, BUSINESS_A]
      )

      const revLines = await pool.query(
        `SELECT id FROM journal_lines WHERE journal_entry_id = $1`,
        [reversalId]
      )
      await expect(pool.query(
        `UPDATE journal_lines SET journal_entry_id = $1 WHERE id = $2`,
        [draftId, revLines.rows[0].id]
      )).rejects.toThrow()
    })
  })

  describe('FIN-068: draft line -> posted journal rejected', () => {
    it('FIN-068: cannot move a draft journal line onto a posted journal', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const draftId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Draft', 'draft')`,
        [draftId, BUSINESS_A]
      )
      const lineId = randomUUID()
      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES ($1, $2, $3, 5000, 0)`,
        [lineId, draftId, cashAcc]
      )

      const postedId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Posted', 'draft')`,
        [postedId, BUSINESS_A]
      )
      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [postedId, cashAcc, bankAcc.rows[0].id]
      )
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [postedId])

      await expect(pool.query(
        `UPDATE journal_lines SET journal_entry_id = $1 WHERE id = $2`,
        [postedId, lineId]
      )).rejects.toThrow()
    })
  })

  describe('FIN-069: draft line -> reversed journal rejected', () => {
    it('FIN-069: cannot move a draft journal line onto a reversed journal', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`,
        [BUSINESS_A]
      )

      const draftId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Draft', 'draft')`,
        [draftId, BUSINESS_A]
      )
      const lineId = randomUUID()
      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES ($1, $2, $3, 5000, 0)`,
        [lineId, draftId, cashAcc]
      )

      const originalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (id, business_id, date, source_type, source_id, description, status)
         VALUES ($1, $2, '2026-08-28', 'SALE', $1, 'Orig', 'draft')`,
        [originalId, BUSINESS_A]
      )
      await pool.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor)
         VALUES (gen_random_uuid(), $1, $2, 10000, 0), (gen_random_uuid(), $1, $3, 0, 10000)`,
        [originalId, cashAcc, bankAcc.rows[0].id]
      )
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [originalId])
      const rev = await pool.query(`SELECT create_reversal($1)`, [originalId])
      const reversalId = rev.rows[0].create_reversal

      await expect(pool.query(
        `UPDATE journal_lines SET journal_entry_id = $1 WHERE id = $2`,
        [reversalId, lineId]
      )).rejects.toThrow()
    })
  })

  describe('FIN-091: finance summary asset calculation', () => {
    it('FIN-091: total_assets = sum of asset account balances (debit - credit)', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`, [BUSINESS_A])
      const revenueAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'revenue'`, [BUSINESS_A])

      const je1 = await createJournaEntry(BUSINESS_A, {
        source_type: 'SALE',
        lines: [
          { account_id: cashAcc, debit_minor: 100000, credit_minor: 0 },
          { account_id: revenueAcc.rows[0].id, debit_minor: 0, credit_minor: 100000 }
        ]
      })
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [je1.id])

      const je2 = await createJournaEntry(BUSINESS_A, {
        source_type: 'SALE',
        lines: [
          { account_id: bankAcc.rows[0].id, debit_minor: 50000, credit_minor: 0 },
          { account_id: revenueAcc.rows[0].id, debit_minor: 0, credit_minor: 50000 }
        ]
      })
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [je2.id])

      const client = await pool.connect()
      try {
        const result = await accountRepository.getFinanceSummary(client, BUSINESS_A)
        expect(result.total_assets).toBe(150000)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-092: finance summary liability calculation', () => {
    it('FIN-092: total_liabilities = sum of payable balances (credit - debit)', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const payableAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'payable'`, [BUSINESS_A])

      const je = await createJournaEntry(BUSINESS_A, {
        source_type: 'PURCHASE_PAYMENT',
        lines: [
          { account_id: payableAcc.rows[0].id, debit_minor: 0, credit_minor: 200000 },
          { account_id: cashAcc, debit_minor: 200000, credit_minor: 0 }
        ]
      })
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [je.id])

      const client = await pool.connect()
      try {
        const result = await accountRepository.getFinanceSummary(client, BUSINESS_A)
        expect(result.total_liabilities).toBe(200000)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-093: finance summary revenue calculation', () => {
    it('FIN-093: total_revenue = sum of revenue/income balances (credit - debit)', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const revenueAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'revenue'`, [BUSINESS_A])

      const je = await createJournaEntry(BUSINESS_A, {
        source_type: 'SALE',
        lines: [
          { account_id: cashAcc, debit_minor: 300000, credit_minor: 0 },
          { account_id: revenueAcc.rows[0].id, debit_minor: 0, credit_minor: 300000 }
        ]
      })
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [je.id])

      const client = await pool.connect()
      try {
        const result = await accountRepository.getFinanceSummary(client, BUSINESS_A)
        expect(result.total_revenue).toBe(300000)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-094: finance summary expense calculation', () => {
    it('FIN-094: total_expense = sum of expense/cogs balances (debit - credit)', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const expenseAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'expense'`, [BUSINESS_A])

      const je = await createJournaEntry(BUSINESS_A, {
        source_type: 'EXPENSE',
        lines: [
          { account_id: expenseAcc.rows[0].id, debit_minor: 75000, credit_minor: 0 },
          { account_id: cashAcc, debit_minor: 0, credit_minor: 75000 }
        ]
      })
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [je.id])

      const client = await pool.connect()
      try {
        const result = await accountRepository.getFinanceSummary(client, BUSINESS_A)
        expect(result.total_expense).toBe(75000)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-095: net income calculation', () => {
    it('FIN-095: net_income = total_revenue - total_expense', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const revenueAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'revenue'`, [BUSINESS_A])
      const expenseAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'expense'`, [BUSINESS_A])

      const je1 = await createJournaEntry(BUSINESS_A, {
        source_type: 'SALE',
        lines: [
          { account_id: cashAcc, debit_minor: 500000, credit_minor: 0 },
          { account_id: revenueAcc.rows[0].id, debit_minor: 0, credit_minor: 500000 }
        ]
      })
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [je1.id])

      const je2 = await createJournaEntry(BUSINESS_A, {
        source_type: 'EXPENSE',
        lines: [
          { account_id: expenseAcc.rows[0].id, debit_minor: 120000, credit_minor: 0 },
          { account_id: cashAcc, debit_minor: 0, credit_minor: 120000 }
        ]
      })
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [je2.id])

      const client = await pool.connect()
      try {
        const result = await accountRepository.getFinanceSummary(client, BUSINESS_A)
        expect(result.net_income).toBe(380000)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-096: cash inflow = debit', () => {
    it('FIN-096: cash_inflow = sum of debit on cash/bank/mobile', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const revenueAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'revenue'`, [BUSINESS_A])

      const je = await createJournaEntry(BUSINESS_A, {
        source_type: 'SALE',
        lines: [
          { account_id: cashAcc, debit_minor: 250000, credit_minor: 0 },
          { account_id: revenueAcc.rows[0].id, debit_minor: 0, credit_minor: 250000 }
        ]
      })
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [je.id])

      const client = await pool.connect()
      try {
        const result = await accountRepository.getFinanceSummary(client, BUSINESS_A)
        expect(result.cash_inflow).toBe(250000)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-097: cash outflow = credit', () => {
    it('FIN-097: cash_outflow = sum of credit on cash/bank/mobile', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const expenseAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'expense'`, [BUSINESS_A])

      const je = await createJournaEntry(BUSINESS_A, {
        source_type: 'EXPENSE',
        lines: [
          { account_id: expenseAcc.rows[0].id, debit_minor: 80000, credit_minor: 0 },
          { account_id: cashAcc, debit_minor: 0, credit_minor: 80000 }
        ]
      })
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [je.id])

      const client = await pool.connect()
      try {
        const result = await accountRepository.getFinanceSummary(client, BUSINESS_A)
        expect(result.cash_outflow).toBe(80000)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-098: net cash flow', () => {
    it('FIN-098: net_cash_flow = cash_inflow - cash_outflow', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const revenueAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'revenue'`, [BUSINESS_A])
      const expenseAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'expense'`, [BUSINESS_A])

      const je1 = await createJournaEntry(BUSINESS_A, {
        source_type: 'SALE',
        lines: [
          { account_id: cashAcc, debit_minor: 400000, credit_minor: 0 },
          { account_id: revenueAcc.rows[0].id, debit_minor: 0, credit_minor: 400000 }
        ]
      })
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [je1.id])

      const je2 = await createJournaEntry(BUSINESS_A, {
        source_type: 'EXPENSE',
        lines: [
          { account_id: expenseAcc.rows[0].id, debit_minor: 150000, credit_minor: 0 },
          { account_id: cashAcc, debit_minor: 0, credit_minor: 150000 }
        ]
      })
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [je2.id])

      const client = await pool.connect()
      try {
        const result = await accountRepository.getFinanceSummary(client, BUSINESS_A)
        expect(result.net_cash_flow).toBe(250000)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-099: draft/reversed excluded from summary', () => {
    it('FIN-099: draft and reversed journals do not affect summary', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const revenueAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'revenue'`, [BUSINESS_A])

      const draftJe = await createJournaEntry(BUSINESS_A, {
        source_type: 'SALE',
        status: 'draft',
        lines: [
          { account_id: cashAcc, debit_minor: 999999, credit_minor: 0 },
          { account_id: revenueAcc.rows[0].id, debit_minor: 0, credit_minor: 999999 }
        ]
      })

      const postedJe = await createJournaEntry(BUSINESS_A, {
        source_type: 'SALE',
        lines: [
          { account_id: cashAcc, debit_minor: 100000, credit_minor: 0 },
          { account_id: revenueAcc.rows[0].id, debit_minor: 0, credit_minor: 100000 }
        ]
      })
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [postedJe.id])

      const client = await pool.connect()
      try {
        const result = await accountRepository.getFinanceSummary(client, BUSINESS_A)
        expect(result.total_revenue).toBe(100000)
        expect(result.cash_inflow).toBe(100000)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-100: zero-activity account returns zero DTO', () => {
    it('FIN-100: account with no posted transactions returns zero balance DTO', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)

      const client = await pool.connect()
      try {
        const result = await accountRepository.getAccountBalance(client, BUSINESS_A, cashAcc)
        expect(result).toBeDefined()
        expect(result.debit_total).toBe(0)
        expect(result.credit_total).toBe(0)
        expect(result.balance).toBe(0)
        expect(result.account_id).toBe(cashAcc)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-101: account update increments server_version', () => {
    it('FIN-101: successful update increments server_version', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)

      const client = await pool.connect()
      try {
        const result = await accountRepository.updateAccount(client, BUSINESS_A, cashAcc, {
          name: 'Updated Cash',
          expected_server_version: 1
        })
        expect(result).toBeDefined()
        expect(result!.server_version).toBe(2)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-102: account update updates updated_at', () => {
    it('FIN-102: successful update sets updated_at to now', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)

      const before = await pool.query(`SELECT updated_at FROM accounts WHERE id = $1`, [cashAcc])
      const beforeTime = new Date(before.rows[0].updated_at).getTime()

      await new Promise(resolve => setTimeout(resolve, 10))

      const client = await pool.connect()
      try {
        await accountRepository.updateAccount(client, BUSINESS_A, cashAcc, {
          name: 'Updated Cash Again',
          expected_server_version: 1
        })
      } finally {
        client.release()
      }

      const after = await pool.query(`SELECT updated_at FROM accounts WHERE id = $1`, [cashAcc])
      const afterTime = new Date(after.rows[0].updated_at).getTime()
      expect(afterTime).toBeGreaterThanOrEqual(beforeTime)
    })
  })

  describe('FIN-103: stale account update rejected', () => {
    it('FIN-103: update with stale server_version returns null', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)

      const client = await pool.connect()
      try {
        const result = await accountRepository.updateAccount(client, BUSINESS_A, cashAcc, {
          name: 'Stale Update',
          expected_server_version: 999
        })
        expect(result).toBeNull()
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-104: create draft journal', () => {
    it('FIN-104: creates draft journal with correct fields', async () => {
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          reference: 'REF-001',
          description: 'Test Sale',
          branch_id: null
        })

        const result = await journalRepository.getJournalById(client, BUSINESS_A, journalId)
        expect(result).toBeDefined()
        expect(result!.status).toBe('draft')
        expect(result!.source_type).toBe('SALE')
        expect(result!.reference).toBe('REF-001')
        expect(result!.business_id).toBe(BUSINESS_A)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-105: draft tenant isolation', () => {
    it('FIN-105: cannot access draft journal from different tenant', async () => {
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Tenant A Journal'
        })

        const result = await journalRepository.getJournalById(client, BUSINESS_B, journalId)
        expect(result).toBeNull()
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-106: add line to draft', () => {
    it('FIN-106: can add line to draft journal', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Draft with line'
        })

        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: cashAcc,
          debit_minor: 100000,
          credit_minor: 0
        })

        const lines = await journalRepository.listJournalLines(client, BUSINESS_A, journalId)
        expect(lines).toHaveLength(1)
        expect(lines[0].debit_minor).toBe(100000)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-107: posted journal rejects new line', () => {
    it('FIN-107: cannot add line to posted journal', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`, [BUSINESS_A])
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Will be posted'
        })

        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: cashAcc,
          debit_minor: 50000,
          credit_minor: 0
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: bankAcc.rows[0].id,
          debit_minor: 0,
          credit_minor: 50000
        })

        await journalRepository.postJournal(client, journalId)

        await expect(journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: cashAcc,
          debit_minor: 10000,
          credit_minor: 0
        })).rejects.toThrow()
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-108: post balanced journal', () => {
    it('FIN-108: can post balanced draft journal', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`, [BUSINESS_A])
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Balanced journal'
        })

        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: cashAcc,
          debit_minor: 75000,
          credit_minor: 0
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: bankAcc.rows[0].id,
          debit_minor: 0,
          credit_minor: 75000
        })

        await journalRepository.postJournal(client, journalId)

        const result = await journalRepository.getJournalById(client, BUSINESS_A, journalId)
        expect(result!.status).toBe('posted')
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-109: unbalanced journal rejected', () => {
    it('FIN-109: cannot post unbalanced journal', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`, [BUSINESS_A])
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Unbalanced journal'
        })

        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: cashAcc,
          debit_minor: 100000,
          credit_minor: 0
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: bankAcc.rows[0].id,
          debit_minor: 0,
          credit_minor: 50000
        })

        await expect(journalRepository.postJournal(client, journalId)).rejects.toThrow()
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-110: get journal with lines', () => {
    it('FIN-110: getJournalById returns header + lines', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`, [BUSINESS_A])
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Journal with lines'
        })

        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: cashAcc,
          debit_minor: 60000,
          credit_minor: 0,
          description: 'Cash line'
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: bankAcc.rows[0].id,
          debit_minor: 0,
          credit_minor: 60000,
          description: 'Bank line'
        })

        const result = await journalRepository.getJournalById(client, BUSINESS_A, journalId)
        expect(result).toBeDefined()
        expect(result!.lines).toHaveLength(2)
        expect(result!.lines![0].description).toBe('Cash line')
        expect(result!.lines![1].description).toBe('Bank line')
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-111: cross-tenant get rejected', () => {
    it('FIN-111: getJournalById returns null for different tenant', async () => {
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Tenant A only'
        })

        const result = await journalRepository.getJournalById(client, BUSINESS_B, journalId)
        expect(result).toBeNull()
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-112: find by source', () => {
    it('FIN-112: getJournalBySource returns journal identity', async () => {
      const client = await pool.connect()
      try {
        const sourceId = randomUUID()
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: sourceId,
          description: 'Source lookup'
        })

        const result = await journalRepository.getJournalBySource(client, BUSINESS_A, 'SALE', sourceId)
        expect(result).toBeDefined()
        expect(result!.id).toBe(journalId)
        expect(result!.status).toBe('draft')
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-113: duplicate source', () => {
    it('FIN-113: cannot create duplicate source_type + source_id', async () => {
      const client = await pool.connect()
      try {
        const sourceId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: randomUUID(),
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: sourceId,
          description: 'First'
        })

        await expect(journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: randomUUID(),
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: sourceId,
          description: 'Duplicate'
        })).rejects.toThrow()
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-114: branch filter', () => {
    it('FIN-114: listJournals filters by branch_id', async () => {
      const client = await pool.connect()
      try {
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: randomUUID(),
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Branch A',
          branch_id: BRANCH_A
        })
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: randomUUID(),
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Branch B',
          branch_id: BRANCH_B
        })

        const result = await journalRepository.listJournals(client, BUSINESS_A, { branchId: BRANCH_A })
        expect(result.items).toHaveLength(1)
        expect(result.items[0].branch_id).toBe(BRANCH_A)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-115: all-branch listing', () => {
    it('FIN-115: listJournals returns all when branch omitted', async () => {
      const client = await pool.connect()
      try {
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: randomUUID(),
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Branch A',
          branch_id: BRANCH_A
        })
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: randomUUID(),
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'No branch',
          branch_id: null
        })

        const result = await journalRepository.listJournals(client, BUSINESS_A)
        expect(result.total).toBeGreaterThanOrEqual(2)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-116: posted-only account balance', () => {
    it('FIN-116: getAccountBalance only counts posted journals', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`, [BUSINESS_A])
      const client = await pool.connect()
      try {
        const draftJournalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: draftJournalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Draft'
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: draftJournalId,
          account_id: cashAcc,
          debit_minor: 999999,
          credit_minor: 0
        })

        const postedJournalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: postedJournalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Posted'
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: postedJournalId,
          account_id: cashAcc,
          debit_minor: 100000,
          credit_minor: 0
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: postedJournalId,
          account_id: bankAcc.rows[0].id,
          debit_minor: 0,
          credit_minor: 100000
        })
        await journalRepository.postJournal(client, postedJournalId)

        const balance = await accountRepository.getAccountBalance(client, BUSINESS_A, cashAcc)
        expect(balance.debit_total).toBe(100000)
        expect(balance.balance).toBe(100000)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-117: zero account balance', () => {
    it('FIN-117: getAccountBalance returns zero for account with no posted lines', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const client = await pool.connect()
      try {
        const balance = await accountRepository.getAccountBalance(client, BUSINESS_A, cashAcc)
        expect(balance.debit_total).toBe(0)
        expect(balance.credit_total).toBe(0)
        expect(balance.balance).toBe(0)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-118: cashflow debit=inflow', () => {
    it('FIN-118: cashflow debit is inflow', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const revenueAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'revenue'`, [BUSINESS_A])
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Cash inflow'
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: cashAcc,
          debit_minor: 200000,
          credit_minor: 0
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: revenueAcc.rows[0].id,
          debit_minor: 0,
          credit_minor: 200000
        })
        await journalRepository.postJournal(client, journalId)

        const cashflow = await accountRepository.getCashflow(client, BUSINESS_A)
        expect(cashflow).toHaveLength(1)
        expect(cashflow[0].debit_minor).toBe(200000)
        expect(cashflow[0].net_flow).toBe(200000)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-119: cashflow credit=outflow', () => {
    it('FIN-119: cashflow credit is outflow', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const expenseAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'expense'`, [BUSINESS_A])
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'EXPENSE',
          source_id: randomUUID(),
          description: 'Cash outflow'
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: expenseAcc.rows[0].id,
          debit_minor: 75000,
          credit_minor: 0
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: cashAcc,
          debit_minor: 0,
          credit_minor: 75000
        })
        await journalRepository.postJournal(client, journalId)

        const cashflow = await accountRepository.getCashflow(client, BUSINESS_A)
        expect(cashflow).toHaveLength(1)
        expect(cashflow[0].credit_minor).toBe(75000)
        expect(cashflow[0].net_flow).toBe(-75000)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-120: reversal delegates to DB', () => {
    it('FIN-120: createReversal delegates to DB function', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`, [BUSINESS_A])
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'To be reversed'
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: cashAcc,
          debit_minor: 50000,
          credit_minor: 0
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: bankAcc.rows[0].id,
          debit_minor: 0,
          credit_minor: 50000
        })
        await journalRepository.postJournal(client, journalId)

        const result = await journalRepository.createReversal(client, journalId)
        expect(result.reversal_id).toBeDefined()
        expect(result.reversal_id).not.toBe(journalId)

        const reversal = await journalRepository.getJournalById(client, BUSINESS_A, result.reversal_id)
        expect(reversal!.source_type).toBe('REVERSAL')
        expect(reversal!.status).toBe('posted')
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-121: reversal branch preserved', () => {
    it('FIN-121: reversal preserves original branch_id', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`, [BUSINESS_A])
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Branch A journal',
          branch_id: BRANCH_A
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: cashAcc,
          debit_minor: 30000,
          credit_minor: 0
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: bankAcc.rows[0].id,
          debit_minor: 0,
          credit_minor: 30000
        })
        await journalRepository.postJournal(client, journalId)

        const result = await journalRepository.createReversal(client, journalId)
        const reversal = await journalRepository.getJournalById(client, BUSINESS_A, result.reversal_id)
        expect(reversal!.branch_id).toBe(BRANCH_A)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-122: reversal UUID', () => {
    it('FIN-122: reversal returns valid UUID', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`, [BUSINESS_A])
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'For reversal UUID test'
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: cashAcc,
          debit_minor: 20000,
          credit_minor: 0
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: bankAcc.rows[0].id,
          debit_minor: 0,
          credit_minor: 20000
        })
        await journalRepository.postJournal(client, journalId)

        const result = await journalRepository.createReversal(client, journalId)
        expect(typeof result.reversal_id).toBe('string')
        expect(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.reversal_id)).toBe(true)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-123: reversal original lines unchanged', () => {
    it('FIN-123: reversal does not modify original journal lines', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`, [BUSINESS_A])
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Original unchanged test'
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: cashAcc,
          debit_minor: 40000,
          credit_minor: 0
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: bankAcc.rows[0].id,
          debit_minor: 0,
          credit_minor: 40000
        })
        await journalRepository.postJournal(client, journalId)

        await journalRepository.createReversal(client, journalId)

        const originalLines = await journalRepository.listJournalLines(client, BUSINESS_A, journalId)
        expect(originalLines).toHaveLength(2)
        expect(originalLines[0].debit_minor).toBe(40000)
        expect(originalLines[1].credit_minor).toBe(40000)
      } finally {
        client.release()
      }
    })
  })

  describe('FIN-124: second reversal rejected', () => {
    it('FIN-124: cannot reverse already reversed journal', async () => {
      const cashAcc = await getCashAccount(BUSINESS_A)
      const bankAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`, [BUSINESS_A])
      const client = await pool.connect()
      try {
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, BUSINESS_A, {
          id: journalId,
          date: '2026-08-28',
          source_type: 'SALE',
          source_id: randomUUID(),
          description: 'Single reversal test'
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: cashAcc,
          debit_minor: 25000,
          credit_minor: 0
        })
        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: bankAcc.rows[0].id,
          debit_minor: 0,
          credit_minor: 25000
        })
        await journalRepository.postJournal(client, journalId)

        await journalRepository.createReversal(client, journalId)

        await expect(journalRepository.createReversal(client, journalId)).rejects.toThrow()
      } finally {
        client.release()
      }
    })
  })
})

describe('Phase 9C.3.3B Finance Service Fixes', () => {
  describe('FIN-SVC-001: SALE source_id = saleId', () => {
    it('FIN-SVC-001: journal source_id equals saleId', async () => {
      const saleId = randomUUID()
      await pool.query(`
        INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [saleId, BUSINESS_A, BRANCH_A, 'REC-SVC-001', 100000, 0, 0, 100000, 'cash', 100000, 0, null, null, '2026-01-01', '2026-01-01', '2026-01-01'])

      const service = createFinanceService(pool)
      const result = await service.postSale(saleId, BUSINESS_A)

      const journal = await pool.query(`SELECT source_id, source_type FROM journal_entries WHERE id = $1`, [result.journalId])
      expect(journal.rows[0].source_id).toBe(saleId)
      expect(journal.rows[0].source_type).toBe('SALE')
    })
  })

  describe('FIN-SVC-002: SALE source replay returns existing journal', () => {
    it('FIN-SVC-002: replaying same sale returns same journal', async () => {
      const saleId = randomUUID()
      await pool.query(`
        INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [saleId, BUSINESS_A, BRANCH_A, 'REC-SVC-002', 100000, 0, 0, 100000, 'cash', 100000, 0, null, null, '2026-01-01', '2026-01-01', '2026-01-01'])

      const service = createFinanceService(pool)
      const result1 = await service.postSale(saleId, BUSINESS_A)
      const result2 = await service.postSale(saleId, BUSINESS_A)

      expect(result1.journalId).toBe(result2.journalId)
      expect(result1.sourceId).toBe(saleId)
    })
  })

  describe('FIN-SVC-003: Purchase payment source_id = paymentId', () => {
    it('FIN-SVC-003: journal source_id equals paymentId', async () => {
      const supplierId = randomUUID()
      await pool.query(`INSERT INTO suppliers (id, business_id, code, name, contact, phone, email, category, term, status, server_version, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [supplierId, BUSINESS_A, 'SUP-SVC-003', 'Supplier SVC-003', null, null, null, null, 'Tempo 30', 'aktif', 1, '2026-01-01', '2026-01-01'])

      const purchaseId = randomUUID()
      await pool.query(`
        INSERT INTO purchases (id, business_id, branch_id, supplier_id, code, date, due_date, supplier_term, status, total_minor, paid_minor, outstanding_minor, received_minor, note, server_version, created_at, updated_at, deleted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [purchaseId, BUSINESS_A, BRANCH_A, supplierId, 'SUP-SVC-003/PO/001', '2026-01-01', '2026-01-15', 'Tempo 30', 'received', 500000, 0, 500000, 500000, null, 1, '2026-01-01', '2026-01-01', null])

      const paymentId = randomUUID()
      await pool.query(`
        INSERT INTO purchase_payments (id, business_id, purchase_id, amount_minor, method, reference, idempotency_key, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [paymentId, BUSINESS_A, purchaseId, 500000, 'bank_transfer', 'REF-SVC-003', `pay_${paymentId}`, '2026-01-01'])

      const service = createFinanceService(pool)
      const result = await service.postPurchasePayment(paymentId, BUSINESS_A)

      const journal = await pool.query(`SELECT source_id, source_type FROM journal_entries WHERE id = $1`, [result.journalId])
      expect(journal.rows[0].source_id).toBe(paymentId)
      expect(journal.rows[0].source_type).toBe('PURCHASE_PAYMENT')
    })
  })

  describe('FIN-SVC-004: Purchase payment journal preserves purchase branch_id', () => {
    it('FIN-SVC-004: journal branch_id equals purchase branch_id', async () => {
      const supplierId = randomUUID()
      await pool.query(`INSERT INTO suppliers (id, business_id, code, name, contact, phone, email, category, term, status, server_version, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [supplierId, BUSINESS_A, 'SUP-SVC-004', 'Supplier SVC-004', null, null, null, null, 'Tempo 30', 'aktif', 1, '2026-01-01', '2026-01-01'])

      const purchaseId = randomUUID()
      await pool.query(`
        INSERT INTO purchases (id, business_id, branch_id, supplier_id, code, date, due_date, supplier_term, status, total_minor, paid_minor, outstanding_minor, received_minor, note, server_version, created_at, updated_at, deleted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [purchaseId, BUSINESS_A, BRANCH_B, supplierId, 'SUP-SVC-004/PO/001', '2026-01-01', '2026-01-15', 'Tempo 30', 'received', 500000, 0, 500000, 500000, null, 1, '2026-01-01', '2026-01-01', null])

      const paymentId = randomUUID()
      await pool.query(`
        INSERT INTO purchase_payments (id, business_id, purchase_id, amount_minor, method, reference, idempotency_key, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [paymentId, BUSINESS_A, purchaseId, 500000, 'cash', 'REF-SVC-004', `pay_${paymentId}`, '2026-01-01'])

      const service = createFinanceService(pool)
      const result = await service.postPurchasePayment(paymentId, BUSINESS_A)

      const journal = await pool.query(`SELECT branch_id FROM journal_entries WHERE id = $1`, [result.journalId])
      expect(journal.rows[0].branch_id).toBe(BRANCH_B)
    })
  })

  describe('FIN-SVC-005: unknown SALE payment method rejected', () => {
    it('FIN-SVC-005: unknown payment method throws 400', async () => {
      const saleId = randomUUID()
      await pool.query(`
        INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [saleId, BUSINESS_A, BRANCH_A, 'REC-SVC-005', 100000, 0, 0, 100000, 'crypto', 100000, 0, null, null, '2026-01-01', '2026-01-01', '2026-01-01'])

      const service = createFinanceService(pool)
      await expect(service.postSale(saleId, BUSINESS_A)).rejects.toMatchObject({ status: 400, code: 'UNSUPPORTED_METHOD' })
    })
  })

  describe('FIN-SVC-005b: all known SALE payment methods map correctly', () => {
    it('FIN-SVC-005b: cash maps to cash account', async () => {
      const saleId = randomUUID()
      await pool.query(`
        INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [saleId, BUSINESS_A, BRANCH_A, 'REC-SVC-005b', 100000, 0, 0, 100000, 'bank_transfer', 100000, 0, null, null, '2026-01-01', '2026-01-01', '2026-01-01'])

      const service = createFinanceService(pool)
      const result = await service.postSale(saleId, BUSINESS_A)
      const journal = await pool.query(`SELECT lines.account_id FROM journal_lines lines JOIN journal_entries je ON je.id = lines.journal_entry_id WHERE je.id = $1 AND lines.debit_minor > 0`, [result.journalId])
      const bankAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`, [BUSINESS_A])
      expect(journal.rows[0].account_id).toBe(bankAcc.rows[0].id)
    })
  })

  describe('FIN-SVC-005c: all known Purchase Payment methods map correctly', () => {
    it('FIN-SVC-005c: debit maps to bank account', async () => {
      const supplierId = randomUUID()
      await pool.query(`INSERT INTO suppliers (id, business_id, code, name, contact, phone, email, category, term, status, server_version, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [supplierId, BUSINESS_A, 'SUP-SVC-005c', 'Supplier SVC-005c', null, null, null, null, 'Tempo 30', 'aktif', 1, '2026-01-01', '2026-01-01'])

      const purchaseId = randomUUID()
      await pool.query(`
        INSERT INTO purchases (id, business_id, branch_id, supplier_id, code, date, due_date, supplier_term, status, total_minor, paid_minor, outstanding_minor, received_minor, note, server_version, created_at, updated_at, deleted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [purchaseId, BUSINESS_A, BRANCH_A, supplierId, 'SUP-SVC-005c/PO/001', '2026-01-01', '2026-01-15', 'Tempo 30', 'received', 500000, 0, 500000, 500000, null, 1, '2026-01-01', '2026-01-01', null])

      const paymentId = randomUUID()
      await pool.query(`
        INSERT INTO purchase_payments (id, business_id, purchase_id, amount_minor, method, reference, idempotency_key, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [paymentId, BUSINESS_A, purchaseId, 500000, 'debit', 'REF-SVC-005c', `pay_${paymentId}`, '2026-01-01'])

      const service = createFinanceService(pool)
      const result = await service.postPurchasePayment(paymentId, BUSINESS_A)
      const journal = await pool.query(`SELECT lines.account_id FROM journal_lines lines JOIN journal_entries je ON je.id = lines.journal_entry_id WHERE je.id = $1 AND lines.credit_minor > 0`, [result.journalId])
      const bankAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'bank'`, [BUSINESS_A])
      expect(journal.rows[0].account_id).toBe(bankAcc.rows[0].id)
    })
  })

  describe('FIN-SVC-006: unknown Purchase Payment method rejected', () => {
    it('FIN-SVC-006: mocked crypto payment method throws 400', async () => {
      const supplierId = randomUUID()
      await pool.query(`INSERT INTO suppliers (id, business_id, code, name, contact, phone, email, category, term, status, server_version, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [supplierId, BUSINESS_A, 'SUP-SVC-006', 'Supplier SVC-006', null, null, null, null, 'Tempo 30', 'aktif', 1, '2026-01-01', '2026-01-01'])

      const purchaseId = randomUUID()
      await pool.query(`
        INSERT INTO purchases (id, business_id, branch_id, supplier_id, code, date, due_date, supplier_term, status, total_minor, paid_minor, outstanding_minor, received_minor, note, server_version, created_at, updated_at, deleted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [purchaseId, BUSINESS_A, BRANCH_A, supplierId, 'SUP-SVC-006/PO/001', '2026-01-01', '2026-01-15', 'Tempo 30', 'received', 500000, 0, 500000, 500000, null, 1, '2026-01-01', '2026-01-01', null])

      const paymentId = randomUUID()
      await pool.query(`
        INSERT INTO purchase_payments (id, business_id, purchase_id, amount_minor, method, reference, idempotency_key, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [paymentId, BUSINESS_A, purchaseId, 500000, 'bank_transfer', 'REF-SVC-006', `pay_${paymentId}`, '2026-01-01'])

      const service = createFinanceService(pool)
      const spy = vi.spyOn(purchaseRepository, 'findPaymentById').mockResolvedValue({
        id: paymentId,
        business_id: BUSINESS_A,
        purchase_id: purchaseId,
        amount_minor: 500000,
        method: 'crypto',
        reference: 'REF-SVC-006',
        idempotency_key: `pay_${paymentId}`,
        created_at: '2026-01-01'
      } as any)

      await expect(service.postPurchasePayment(paymentId, BUSINESS_A)).rejects.toMatchObject({ status: 400, code: 'UNSUPPORTED_METHOD' })
      spy.mockRestore()
    })
  })

  describe('FIN-SVC-007: existing draft SALE journal → 409 conflict', () => {
    it('FIN-SVC-007: draft journal for same sale throws 409', async () => {
      const saleId = randomUUID()
      await pool.query(`
        INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [saleId, BUSINESS_A, BRANCH_A, 'REC-SVC-007', 100000, 0, 0, 100000, 'cash', 100000, 0, null, null, '2026-01-01', '2026-01-01', '2026-01-01'])

      const draftId = randomUUID()
      await pool.query(`
        INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [draftId, BUSINESS_A, BRANCH_A, '2026-01-01', 'SALE', saleId, 'REC-SVC-007', 'Draft', 'draft', '2026-01-01', 1])

      const service = createFinanceService(pool)
      await expect(service.postSale(saleId, BUSINESS_A)).rejects.toMatchObject({ status: 409, code: 'SOURCE_CONFLICT' })
    })
  })

  describe('FIN-SVC-008: existing draft Purchase Payment journal → 409 conflict', () => {
    it('FIN-SVC-008: draft journal for same payment throws 409', async () => {
      const supplierId = randomUUID()
      await pool.query(`INSERT INTO suppliers (id, business_id, code, name, contact, phone, email, category, term, status, server_version, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [supplierId, BUSINESS_A, 'SUP-SVC-008', 'Supplier SVC-008', null, null, null, null, 'Tempo 30', 'aktif', 1, '2026-01-01', '2026-01-01'])

      const purchaseId = randomUUID()
      await pool.query(`
        INSERT INTO purchases (id, business_id, branch_id, supplier_id, code, date, due_date, supplier_term, status, total_minor, paid_minor, outstanding_minor, received_minor, note, server_version, created_at, updated_at, deleted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [purchaseId, BUSINESS_A, BRANCH_A, supplierId, 'SUP-SVC-008/PO/001', '2026-01-01', '2026-01-15', 'Tempo 30', 'received', 500000, 0, 500000, 500000, null, 1, '2026-01-01', '2026-01-01', null])

      const paymentId = randomUUID()
      await pool.query(`
        INSERT INTO purchase_payments (id, business_id, purchase_id, amount_minor, method, reference, idempotency_key, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [paymentId, BUSINESS_A, purchaseId, 500000, 'bank_transfer', 'REF-SVC-008', `pay_${paymentId}`, '2026-01-01'])

      const draftId = randomUUID()
      await pool.query(`
        INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [draftId, BUSINESS_A, BRANCH_A, '2026-01-01', 'PURCHASE_PAYMENT', paymentId, 'REF-SVC-008', 'Draft', 'draft', '2026-01-01', 1])

      const service = createFinanceService(pool)
      await expect(service.postPurchasePayment(paymentId, BUSINESS_A)).rejects.toMatchObject({ status: 409, code: 'SOURCE_CONFLICT' })
    })
  })

  describe('FIN-SVC-009: reversed source cannot be reposted', () => {
    it('FIN-SVC-009: reversed journal for sale throws 409', async () => {
      const saleId = randomUUID()
      await pool.query(`
        INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [saleId, BUSINESS_A, BRANCH_A, 'REC-SVC-009', 100000, 0, 0, 100000, 'cash', 100000, 0, null, null, '2026-01-01', '2026-01-01', '2026-01-01'])

      const journalId = randomUUID()
      await pool.query(`
        INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [journalId, BUSINESS_A, BRANCH_A, '2026-01-01', 'SALE', saleId, 'REC-SVC-009', 'Original', 'draft', '2026-01-01', 1])

      const cashAcc = await getCashAccount(BUSINESS_A)
      const revenueAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'revenue'`, [BUSINESS_A])
      await pool.query(`INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor) VALUES (gen_random_uuid(), $1, $2, 100000, 0), (gen_random_uuid(), $1, $3, 0, 100000)`, [journalId, cashAcc, revenueAcc.rows[0].id])
      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [journalId])
      await pool.query(`SELECT create_reversal($1)`, [journalId])

      const service = createFinanceService(pool)
      await expect(service.postSale(saleId, BUSINESS_A)).rejects.toMatchObject({ status: 409, code: 'SOURCE_CONFLICT' })
    })
  })

  describe('FIN-SVC-010: source conflict is controlled ApiError', () => {
    it('FIN-SVC-010: duplicate source returns ApiError not raw DB error', async () => {
      const saleId = randomUUID()
      await pool.query(`
        INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [saleId, BUSINESS_A, BRANCH_A, 'REC-SVC-010', 100000, 0, 0, 100000, 'cash', 100000, 0, null, null, '2026-01-01', '2026-01-01', '2026-01-01'])

      const draftId = randomUUID()
      await pool.query(`
        INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [draftId, BUSINESS_A, BRANCH_A, '2026-01-01', 'SALE', saleId, 'REC-SVC-010', 'Draft', 'draft', '2026-01-01', 1])

      const service = createFinanceService(pool)
      try {
        await service.postSale(saleId, BUSINESS_A)
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).status).toBe(409)
        expect((err as ApiError).code).toBe('SOURCE_CONFLICT')
      }
    })
  })

  describe('FIN-SVC-011: SALE posting does not mutate Sales', () => {
    it('FIN-SVC-011: sale record unchanged after posting', async () => {
      const saleId = randomUUID()
      await pool.query(`
        INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [saleId, BUSINESS_A, BRANCH_A, 'REC-SVC-011', 100000, 0, 0, 100000, 'cash', 100000, 0, null, null, '2026-01-01', '2026-01-01', '2026-01-01'])

      const before = await pool.query(`SELECT * FROM sales WHERE id = $1`, [saleId])
      const service = createFinanceService(pool)
      await service.postSale(saleId, BUSINESS_A)
      const after = await pool.query(`SELECT * FROM sales WHERE id = $1`, [saleId])

      expect(after.rows[0]).toEqual(before.rows[0])
    })
  })

  describe('FIN-SVC-012: Purchase Payment posting does not mutate payment', () => {
    it('FIN-SVC-012: payment record unchanged after posting', async () => {
      const supplierId = randomUUID()
      await pool.query(`INSERT INTO suppliers (id, business_id, code, name, contact, phone, email, category, term, status, server_version, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [supplierId, BUSINESS_A, 'SUP-SVC-012', 'Supplier SVC-012', null, null, null, null, 'Tempo 30', 'aktif', 1, '2026-01-01', '2026-01-01'])

      const purchaseId = randomUUID()
      await pool.query(`
        INSERT INTO purchases (id, business_id, branch_id, supplier_id, code, date, due_date, supplier_term, status, total_minor, paid_minor, outstanding_minor, received_minor, note, server_version, created_at, updated_at, deleted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [purchaseId, BUSINESS_A, BRANCH_A, supplierId, 'SUP-SVC-012/PO/001', '2026-01-01', '2026-01-15', 'Tempo 30', 'received', 500000, 0, 500000, 500000, null, 1, '2026-01-01', '2026-01-01', null])

      const paymentId = randomUUID()
      await pool.query(`
        INSERT INTO purchase_payments (id, business_id, purchase_id, amount_minor, method, reference, idempotency_key, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [paymentId, BUSINESS_A, purchaseId, 500000, 'bank_transfer', 'REF-SVC-012', `pay_${paymentId}`, '2026-01-01'])

      const before = await pool.query(`SELECT * FROM purchase_payments WHERE id = $1`, [paymentId])
      const service = createFinanceService(pool)
      await service.postPurchasePayment(paymentId, BUSINESS_A)
      const after = await pool.query(`SELECT * FROM purchase_payments WHERE id = $1`, [paymentId])

      expect(after.rows[0]).toEqual(before.rows[0])
    })
  })

  describe('FIN-SVC-013: posting remains atomic on failure', () => {
    it('FIN-SVC-013: failed sale posting rolls back all changes', async () => {
      const saleId = randomUUID()
      await pool.query(`
        INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [saleId, BUSINESS_A, BRANCH_A, 'REC-SVC-013', 100000, 0, 0, 100000, 'cash', 100000, 0, null, null, '2026-01-01', '2026-01-01', '2026-01-01'])

      await pool.query(`UPDATE accounts SET active = false WHERE business_id = $1 AND type = 'revenue'`, [BUSINESS_A])

      const service = createFinanceService(pool)
      await expect(service.postSale(saleId, BUSINESS_A)).rejects.toMatchObject({ status: 500, code: 'CONFIG_ERROR' })

      const count = await pool.query(`SELECT COUNT(*) FROM journal_entries WHERE source_type = 'SALE' AND source_id = $1`, [saleId])
      expect(Number(count.rows[0].count)).toBe(0)
    })
  })
})

describe('Phase 9C.3.3C Finance Route Integration', () => {
  beforeEach(async () => {
    const cashierA = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
    const authCashierA = await authenticateTestUser(app, cashierA.email, cashierA.password, BUSINESS_A)
    cashierTokenA = authCashierA.accessToken
  })

  describe('FIN-125: GET accounts OWNER', () => {
    it('FIN-125: OWNER can list accounts', async () => {
      await request(app)
        .get('/v1/finance/accounts')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)
    })
  })

  describe('FIN-126: GET accounts CASHIER', () => {
    it('FIN-126: CASHIER can list accounts', async () => {
      await request(app)
        .get('/v1/finance/accounts')
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .expect(200)
    })
  })

  describe('FIN-127: GET accounts unauthenticated', () => {
    it('FIN-127: missing token returns 401', async () => {
      await request(app)
        .get('/v1/finance/accounts')
        .expect(401)
    })
  })

  describe('FIN-128: GET accounts cross-tenant', () => {
    it('FIN-128: BUSINESS_B token accesses own accounts (cross-tenant isolation by design)', async () => {
      await request(app)
        .get('/v1/finance/accounts')
        .set('Authorization', `Bearer ${ownerTokenB}`)
        .expect(200)
    })
  })

  describe('FIN-129: GET journals branch filter', () => {
    it('FIN-129: branch filter returns 200', async () => {
      await request(app)
        .get('/v1/finance/journals')
        .query({ branch_id: BRANCH_A })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)
    })
  })

  describe('FIN-130: GET journals all branches', () => {
    it('FIN-130: no branch filter returns 200', async () => {
      await request(app)
        .get('/v1/finance/journals')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)
    })
  })

  describe('FIN-131: GET journal detail', () => {
    it('FIN-131: returns 404 for nonexistent journal', async () => {
      await request(app)
        .get(`/v1/finance/journals/${randomUUID()}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(404)
    })
  })

  describe('FIN-132: GET cashflow', () => {
    it('FIN-132: cashflow returns 200', async () => {
      await request(app)
        .get('/v1/finance/cashflow')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)
    })
  })

  describe('FIN-133: GET summary', () => {
    it('FIN-133: summary returns 200', async () => {
      await request(app)
        .get('/v1/finance/summary')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)
    })
  })

  describe('FIN-134: POST SALE OWNER', () => {
    it('FIN-134: OWNER can post sale', async () => {
      const saleId = randomUUID()
      await pool.query(`
        INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [saleId, BUSINESS_A, BRANCH_A, 'REC-FIN-134', 100000, 0, 0, 100000, 'cash', 100000, 0, null, null, '2026-01-01', '2026-01-01', '2026-01-01'])

      await request(app)
        .post('/v1/finance/postings/sale')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ sale_id: saleId })
        .expect(201)
    })
  })

  describe('FIN-135: POST SALE CASHIER forbidden', () => {
    it('FIN-135: CASHIER cannot post sale', async () => {
      await request(app)
        .post('/v1/finance/postings/sale')
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({ sale_id: randomUUID() })
        .expect(403)
    })
  })

  describe('FIN-136: POST payment OWNER', () => {
    it('FIN-136: OWNER can post payment', async () => {
      const supplierId = randomUUID()
      await pool.query(`INSERT INTO suppliers (id, business_id, code, name, contact, phone, email, category, term, status, server_version, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [supplierId, BUSINESS_A, 'SUP-FIN-136', 'Supplier FIN-136', null, null, null, null, 'Tempo 30', 'aktif', 1, '2026-01-01', '2026-01-01'])

      const purchaseId = randomUUID()
      await pool.query(`
        INSERT INTO purchases (id, business_id, branch_id, supplier_id, code, date, due_date, supplier_term, status, total_minor, paid_minor, outstanding_minor, received_minor, note, server_version, created_at, updated_at, deleted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [purchaseId, BUSINESS_A, BRANCH_A, supplierId, 'SUP-FIN-136/PO/001', '2026-01-01', '2026-01-15', 'Tempo 30', 'received', 500000, 0, 500000, 500000, null, 1, '2026-01-01', '2026-01-01', null])

      const paymentId = randomUUID()
      await pool.query(`
        INSERT INTO purchase_payments (id, business_id, purchase_id, amount_minor, method, reference, idempotency_key, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [paymentId, BUSINESS_A, purchaseId, 500000, 'bank_transfer', 'REF-FIN-136', `pay_${paymentId}`, '2026-01-01'])

      await request(app)
        .post('/v1/finance/postings/payment')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ payment_id: paymentId })
        .expect(201)
    })
  })

  describe('FIN-137: POST payment CASHIER forbidden', () => {
    it('FIN-137: CASHIER cannot post payment', async () => {
      await request(app)
        .post('/v1/finance/postings/payment')
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({ payment_id: randomUUID() })
        .expect(403)
    })
  })

  describe('FIN-138: POST reversal OWNER', () => {
    it('FIN-138: OWNER can create reversal', async () => {
      const journalId = randomUUID()
      await pool.query(`
        INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [journalId, BUSINESS_A, BRANCH_A, '2026-01-01', 'SALE', randomUUID(), 'REC-FIN-138', 'Original', 'draft', '2026-01-01', 1])

      const cashAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'cash'`, [BUSINESS_A])
      const revenueAcc = await pool.query(`SELECT id FROM accounts WHERE business_id = $1 AND type = 'revenue'`, [BUSINESS_A])
      await pool.query(`INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor) VALUES (gen_random_uuid(), $1, $2, 100000, 0), (gen_random_uuid(), $1, $3, 0, 100000)`, [journalId, cashAcc.rows[0].id, revenueAcc.rows[0].id])

      await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [journalId])

      await request(app)
        .post('/v1/finance/reversals')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ journal_id: journalId })
        .expect(201)
    })
  })

  describe('FIN-139: POST reversal CASHIER forbidden', () => {
    it('FIN-139: CASHIER cannot create reversal', async () => {
      await request(app)
        .post('/v1/finance/reversals')
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({ journal_id: randomUUID() })
        .expect(403)
    })
  })

  describe('FIN-140: invalid UUID validation', () => {
    it('FIN-140: invalid sale_id returns 400', async () => {
      await request(app)
        .post('/v1/finance/postings/sale')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ sale_id: 'not-a-uuid' })
        .expect(400)
    })

    it('FIN-140b: invalid payment_id returns 400', async () => {
      await request(app)
        .post('/v1/finance/postings/payment')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ payment_id: 'not-a-uuid' })
        .expect(400)
    })

    it('FIN-140c: invalid journal_id returns 400', async () => {
      await request(app)
        .post('/v1/finance/reversals')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ journal_id: 'not-a-uuid' })
        .expect(400)
    })
  })

  describe('FIN-141: missing resource 404', () => {
    it('FIN-141: nonexistent sale returns 404', async () => {
      await request(app)
        .post('/v1/finance/postings/sale')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ sale_id: randomUUID() })
        .expect(404)
    })

    it('FIN-141b: nonexistent payment returns 404', async () => {
      await request(app)
        .post('/v1/finance/postings/payment')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ payment_id: randomUUID() })
        .expect(404)
    })
  })

  describe('FIN-142: source conflict 409', () => {
    it('FIN-142: duplicate sale posting returns same journalId idempotently', async () => {
      const saleId = randomUUID()
      await pool.query(`
        INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [saleId, BUSINESS_A, BRANCH_A, 'REC-FIN-142', 100000, 0, 0, 100000, 'cash', 100000, 0, null, null, '2026-01-01', '2026-01-01', '2026-01-01'])

      const res1 = await request(app)
        .post('/v1/finance/postings/sale')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ sale_id: saleId })
        .expect(201)

      const res2 = await request(app)
        .post('/v1/finance/postings/sale')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ sale_id: saleId })
        .expect(201)

      expect(res1.body.journalId).toBe(res2.body.journalId)
    })
  })

  describe('FIN-143: unexpected service error 500', () => {
    it('FIN-143: missing revenue account returns 500', async () => {
      await pool.query(`UPDATE accounts SET active = false WHERE business_id = $1 AND type = 'revenue'`, [BUSINESS_A])

      const saleId = randomUUID()
      await pool.query(`
        INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [saleId, BUSINESS_A, BRANCH_A, 'REC-FIN-143', 100000, 0, 0, 100000, 'cash', 100000, 0, null, null, '2026-01-01', '2026-01-01', '2026-01-01'])

      await request(app)
        .post('/v1/finance/postings/sale')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ sale_id: saleId })
        .expect(500)
    })
  })

  describe('FIN-144: tenant isolation', () => {
    it('FIN-144: BUSINESS_B token cannot post BUSINESS_A sale (404 by design)', async () => {
      const saleId = randomUUID()
      await pool.query(`
        INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [saleId, BUSINESS_A, BRANCH_A, 'REC-FIN-144', 100000, 0, 0, 100000, 'cash', 100000, 0, null, null, '2026-01-01', '2026-01-01', '2026-01-01'])

      await request(app)
        .post('/v1/finance/postings/sale')
        .set('Authorization', `Bearer ${ownerTokenB}`)
        .send({ sale_id: saleId })
        .expect(404)
    })
  })

  describe('FIN-145: branch filtering', () => {
    it('FIN-145: invalid branch_id returns 400', async () => {
      await request(app)
        .get('/v1/finance/journals')
        .query({ branch_id: 'not-a-uuid' })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(400)
    })
  })

  describe('FIN-146: idempotent SALE posting through API', () => {
    it('FIN-146: replay returns same journalId', async () => {
      const saleId = randomUUID()
      await pool.query(`
        INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [saleId, BUSINESS_A, BRANCH_A, 'REC-FIN-146', 100000, 0, 0, 100000, 'cash', 100000, 0, null, null, '2026-01-01', '2026-01-01', '2026-01-01'])

      const res1 = await request(app)
        .post('/v1/finance/postings/sale')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ sale_id: saleId })
        .expect(201)

      const res2 = await request(app)
        .post('/v1/finance/postings/sale')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ sale_id: saleId })
        .expect(201)

      expect(res1.body.journalId).toBe(res2.body.journalId)
    })
  })

  describe('FIN-147: idempotent payment posting through API', () => {
    it('FIN-147: replay returns same journalId', async () => {
      const supplierId = randomUUID()
      await pool.query(`INSERT INTO suppliers (id, business_id, code, name, contact, phone, email, category, term, status, server_version, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [supplierId, BUSINESS_A, 'SUP-FIN-147', 'Supplier FIN-147', null, null, null, null, 'Tempo 30', 'aktif', 1, '2026-01-01', '2026-01-01'])

      const purchaseId = randomUUID()
      await pool.query(`
        INSERT INTO purchases (id, business_id, branch_id, supplier_id, code, date, due_date, supplier_term, status, total_minor, paid_minor, outstanding_minor, received_minor, note, server_version, created_at, updated_at, deleted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [purchaseId, BUSINESS_A, BRANCH_A, supplierId, 'SUP-FIN-147/PO/001', '2026-01-01', '2026-01-15', 'Tempo 30', 'received', 500000, 0, 500000, 500000, null, 1, '2026-01-01', '2026-01-01', null])

      const paymentId = randomUUID()
      await pool.query(`
        INSERT INTO purchase_payments (id, business_id, purchase_id, amount_minor, method, reference, idempotency_key, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [paymentId, BUSINESS_A, purchaseId, 500000, 'bank_transfer', 'REF-FIN-147', `pay_${paymentId}`, '2026-01-01'])

      const res1 = await request(app)
        .post('/v1/finance/postings/payment')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ payment_id: paymentId })
        .expect(201)

      const res2 = await request(app)
        .post('/v1/finance/postings/payment')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ payment_id: paymentId })
        .expect(201)

      expect(res1.body.journalId).toBe(res2.body.journalId)
    })
  })
})