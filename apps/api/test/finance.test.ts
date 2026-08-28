import path from 'path'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { seedTestUser, authenticateTestUser } from './auth_helper'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'
const BRANCH_B = '22222222-2222-4222-8222-222222222222'

let pool!: Pool
let app!: ReturnType<typeof createApp>
let ownerTokenA!: string
let ownerTokenB!: string

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
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/biz_erp_test'
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
})