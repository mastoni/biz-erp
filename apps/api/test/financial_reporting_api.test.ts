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
const BRANCH_A2 = '33333333-3333-4333-8333-333333333333'
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
      customer_payments,
      receivables,
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
    `INSERT INTO businesses (id, name) VALUES ($1, 'Business A'), ($2, 'Business B')`,
    [BUSINESS_A, BUSINESS_B]
  )

  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES
     ($1, $2, 'Branch A', true),
     ($3, $2, 'Branch A2', true),
     ($4, $5, 'Branch B', true)`,
    [BRANCH_A, BUSINESS_A, BRANCH_A2, BRANCH_B, BUSINESS_B]
  )

  await seedDefaultAccounts(BUSINESS_A)
  await seedDefaultAccounts(BUSINESS_B)
}

async function seedDefaultAccounts(businessId: string): Promise<void> {
  const defaultAccounts = [
    { type: 'cash', code: '100', name: 'Cash' },
    { type: 'bank', code: '101', name: 'Bank' },
    { type: 'mobile', code: '102', name: 'Mobile Payment' },
    { type: 'receivable', code: '110', name: 'Accounts Receivable' },
    { type: 'payable', code: '200', name: 'Accounts Payable' },
    { type: 'income', code: '400', name: 'Income' },
    { type: 'revenue', code: '500', name: 'Revenue' },
    { type: 'expense', code: '600', name: 'Expense' },
    { type: 'cogs', code: '601', name: 'Cost of Goods Sold' },
    { type: 'inventory', code: '150', name: 'Inventory' },
  ]

  for (const acc of defaultAccounts) {
    await pool.query(
      `INSERT INTO accounts (id, business_id, code, name, type, currency, active, created_at, server_version)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'IDR', true, now(), 1)`,
      [businessId, acc.code, acc.name, acc.type]
    )
  }
}

interface JournalLineSpec {
  account_type: string
  debit_minor: number
  credit_minor: number
}

async function createPostedJournal(
  businessId: string,
  opts: {
    source_type: string
    description: string
    date: string
    branch_id?: string | null
    lines: JournalLineSpec[]
  }
): Promise<string> {
  const journalId = randomUUID()
  const sourceId = randomUUID()
  const branchId = opts.branch_id ?? null

  await pool.query(
    `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
     VALUES ($1, $2, $3, $4, $5, $6, null, $7, 'draft', now(), 1)`,
    [journalId, businessId, branchId, opts.date, opts.source_type, sourceId, opts.description]
  )

  for (const line of opts.lines) {
    const accountId = await getAccountByType(businessId, line.account_type)
    await pool.query(
      `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor, description)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, null)`,
      [journalId, accountId, line.debit_minor, line.credit_minor]
    )
  }

  await pool.query(`UPDATE journal_entries SET status = 'posted' WHERE id = $1`, [journalId])
  return journalId
}

async function getAccountByType(businessId: string, type: string): Promise<string> {
  const res = await pool.query(
    `SELECT id FROM accounts WHERE business_id = $1 AND type = $2`,
    [businessId, type]
  )
  return res.rows[0].id
}

beforeAll(async () => {
  const dbUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
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

  const cashierA = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  const authCashierA = await authenticateTestUser(app, cashierA.email, cashierA.password, BUSINESS_A)
  cashierTokenA = authCashierA.accessToken
})

afterAll(async () => {
  await pool.end()
})

describe('Phase 9C.8D Financial Reporting API Tests', () => {
  describe('P&L endpoint', () => {
    it('RPT-API-001: P&L 200 OWNER', async () => {
      await createPostedJournal(BUSINESS_A, {
        source_type: 'SALE',
        description: 'Sale',
        date: '2026-01-15',
        lines: [
          { account_type: 'cash', debit_minor: 100000, credit_minor: 0 },
          { account_type: 'revenue', debit_minor: 0, credit_minor: 100000 },
        ],
      })

      const res = await request(app)
        .get('/v1/finance/reports/profit-loss')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)

      expect(res.body.revenue_minor).toBe(100000)
      expect(res.body.expense_minor).toBe(0)
      expect(res.body.net_income_minor).toBe(100000)
    })

    it('RPT-API-002: P&L CASHIER', async () => {
      await createPostedJournal(BUSINESS_A, {
        source_type: 'SALE',
        description: 'Cashier sale',
        date: '2026-01-15',
        lines: [
          { account_type: 'cash', debit_minor: 50000, credit_minor: 0 },
          { account_type: 'revenue', debit_minor: 0, credit_minor: 50000 },
        ],
      })

      const res = await request(app)
        .get('/v1/finance/reports/profit-loss')
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .expect(200)

      expect(res.body.revenue_minor).toBe(50000)
    })

    it('RPT-API-003: unauthenticated 401', async () => {
      await request(app)
        .get('/v1/finance/reports/profit-loss')
        .expect(401)

      await request(app)
        .get('/v1/finance/reports/balance-sheet')
        .query({ as_of: '2026-01-31' })
        .expect(401)

      await request(app)
        .get('/v1/finance/reports/general-ledger')
        .query({ from: '2026-01-01', to: '2026-01-31' })
        .expect(401)

      await request(app)
        .get('/v1/finance/reports/account-balances')
        .expect(401)

      await request(app)
        .get('/v1/finance/reports/cashflow')
        .expect(401)
    })
  })

  describe('Tenant & branch isolation', () => {
    it('RPT-API-004: tenant isolation', async () => {
      await createPostedJournal(BUSINESS_A, {
        source_type: 'SALE',
        description: 'Business A sale',
        date: '2026-01-15',
        lines: [
          { account_type: 'cash', debit_minor: 100000, credit_minor: 0 },
          { account_type: 'revenue', debit_minor: 0, credit_minor: 100000 },
        ],
      })

      await createPostedJournal(BUSINESS_B, {
        source_type: 'SALE',
        description: 'Business B sale',
        date: '2026-01-15',
        lines: [
          { account_type: 'cash', debit_minor: 99999, credit_minor: 0 },
          { account_type: 'revenue', debit_minor: 0, credit_minor: 99999 },
        ],
      })

      const resA = await request(app)
        .get('/v1/finance/reports/profit-loss')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)

      const resB = await request(app)
        .get('/v1/finance/reports/profit-loss')
        .set('Authorization', `Bearer ${ownerTokenB}`)
        .expect(200)

      expect(resA.body.revenue_minor).toBe(100000)
      expect(resB.body.revenue_minor).toBe(99999)
    })

    it('RPT-API-005: branch/date filtering', async () => {
      await createPostedJournal(BUSINESS_A, {
        source_type: 'SALE',
        description: 'Branch A sale',
        date: '2026-01-15',
        branch_id: BRANCH_A,
        lines: [
          { account_type: 'cash', debit_minor: 100000, credit_minor: 0 },
          { account_type: 'revenue', debit_minor: 0, credit_minor: 100000 },
        ],
      })
      await createPostedJournal(BUSINESS_A, {
        source_type: 'SALE',
        description: 'Branch A2 sale',
        date: '2026-02-15',
        branch_id: BRANCH_A2,
        lines: [
          { account_type: 'bank', debit_minor: 50000, credit_minor: 0 },
          { account_type: 'revenue', debit_minor: 0, credit_minor: 50000 },
        ],
      })

      const resBranchA = await request(app)
        .get('/v1/finance/reports/profit-loss')
        .query({ branch_id: BRANCH_A })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)
      expect(resBranchA.body.revenue_minor).toBe(100000)

      const resJan = await request(app)
        .get('/v1/finance/reports/profit-loss')
        .query({ branch_id: BRANCH_A, from: '2026-01-01', to: '2026-01-31' })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)
      expect(resJan.body.revenue_minor).toBe(100000)

      const resFeb = await request(app)
        .get('/v1/finance/reports/profit-loss')
        .query({ branch_id: BRANCH_A2, from: '2026-02-01', to: '2026-02-28' })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)
      expect(resFeb.body.revenue_minor).toBe(50000)

      const resAll = await request(app)
        .get('/v1/finance/reports/profit-loss')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)
      expect(resAll.body.revenue_minor).toBe(150000)
    })
  })

  describe('Other report endpoints', () => {
    it('RPT-API-006: balance sheet', async () => {
      await createPostedJournal(BUSINESS_A, {
        source_type: 'SALE',
        description: 'Sale',
        date: '2026-01-15',
        lines: [
          { account_type: 'cash', debit_minor: 200000, credit_minor: 0 },
          { account_type: 'revenue', debit_minor: 0, credit_minor: 200000 },
        ],
      })
      await createPostedJournal(BUSINESS_A, {
        source_type: 'EXPENSE',
        description: 'Expense',
        date: '2026-01-15',
        lines: [
          { account_type: 'expense', debit_minor: 50000, credit_minor: 0 },
          { account_type: 'cash', debit_minor: 0, credit_minor: 50000 },
        ],
      })

      const res = await request(app)
        .get('/v1/finance/reports/balance-sheet')
        .query({ as_of: '2026-01-31' })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)

      expect(res.body.total_assets_minor).toBe(150000)
      expect(res.body.total_liabilities_minor).toBe(0)
      expect(res.body.total_equity_minor).toBe(150000)
      expect(res.body.total_assets_minor).toBe(
        res.body.total_liabilities_minor + res.body.total_equity_minor
      )
    })

    it('RPT-API-007: cashflow backward compatibility', async () => {
      await createPostedJournal(BUSINESS_A, {
        source_type: 'SALE',
        description: 'Sale',
        date: '2026-01-15',
        branch_id: BRANCH_A,
        lines: [
          { account_type: 'cash', debit_minor: 100000, credit_minor: 0 },
          { account_type: 'revenue', debit_minor: 0, credit_minor: 100000 },
        ],
      })

      const resNoParams = await request(app)
        .get('/v1/finance/cashflow')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)
      expect(resNoParams.body.entries.length).toBeGreaterThan(0)

      const resWithParams = await request(app)
        .get('/v1/finance/cashflow')
        .query({ from: '2026-01-01', to: '2026-01-31', branch_id: BRANCH_A })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)
      expect(resWithParams.body.entries.length).toBeGreaterThan(0)

      const resReporting = await request(app)
        .get('/v1/finance/reports/cashflow')
        .query({ from: '2026-01-01', to: '2026-01-31' })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)
      expect(resReporting.body.total_inflow).toBe(100000)
      expect(resReporting.body.total_outflow).toBe(0)
      expect(resReporting.body.net_cash_flow).toBe(100000)
    })

    it('RPT-API-008: general ledger', async () => {
      await createPostedJournal(BUSINESS_A, {
        source_type: 'SALE',
        description: 'Period sale',
        date: '2026-01-15',
        lines: [
          { account_type: 'cash', debit_minor: 100000, credit_minor: 0 },
          { account_type: 'revenue', debit_minor: 0, credit_minor: 100000 },
        ],
      })

      const res = await request(app)
        .get('/v1/finance/reports/general-ledger')
        .query({ from: '2026-01-01', to: '2026-01-31' })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)

      expect(res.body.opening_balance).toBe(0)
      expect(res.body.opening_balance + res.body.period_movements).toBe(res.body.closing_balance)
      expect(res.body.entries.length).toBeGreaterThan(0)
      const cashEntry = res.body.entries.find((e: any) => e.account_type === 'cash')
      expect(cashEntry).toBeDefined()
      expect(cashEntry.running_balance).toBe(100000)
    })

    it('RPT-API-009: account balances', async () => {
      await createPostedJournal(BUSINESS_A, {
        source_type: 'SALE',
        description: 'Sale',
        date: '2026-01-15',
        lines: [
          { account_type: 'cash', debit_minor: 100000, credit_minor: 0 },
          { account_type: 'revenue', debit_minor: 0, credit_minor: 100000 },
        ],
      })

      const res = await request(app)
        .get('/v1/finance/reports/account-balances')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)

      expect(res.body.length).toBe(10)
      const cash = res.body.find((a: any) => a.account_type === 'cash')
      expect(cash.balance).toBe(100000)
      const revenue = res.body.find((a: any) => a.account_type === 'revenue')
      expect(revenue.balance).toBe(-100000)
    })
  })

  describe('Validation', () => {
    it('RPT-API-010: invalid UUID/date validation', async () => {
      const resInvalidUuid = await request(app)
        .get('/v1/finance/reports/profit-loss')
        .query({ branch_id: 'not-a-uuid' })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(400)
      expect(resInvalidUuid.body.error.code).toBe('VALIDATION_ERROR')

      const resInvalidDate = await request(app)
        .get('/v1/finance/reports/profit-loss')
        .query({ from: 'not-a-date' })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(400)
      expect(resInvalidDate.body.error.code).toBe('VALIDATION_ERROR')

      const resInvalidAsOf = await request(app)
        .get('/v1/finance/reports/balance-sheet')
        .query({ as_of: '2026/01/31' })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(400)
      expect(resInvalidAsOf.body.error.code).toBe('VALIDATION_ERROR')

      const resGlMissingParams = await request(app)
        .get('/v1/finance/reports/general-ledger')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(400)
      expect(resGlMissingParams.body.error.code).toBe('VALIDATION_ERROR')

      const resCashflowInvalidDate = await request(app)
        .get('/v1/finance/reports/cashflow')
        .query({ from: '2026/13/45' })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(400)
      expect(resCashflowInvalidDate.body.error.code).toBe('VALIDATION_ERROR')

      await request(app)
        .get('/v1/finance/cashflow')
        .query({ branch_id: 'invalid-uuid' })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(400)

      await request(app)
        .get('/v1/finance/cashflow')
        .query({ from: 'bad-date' })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(400)

      await request(app)
        .get('/v1/finance/reports/profit-loss')
        .query({ branch_id: 'not-a-uuid' })
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .expect(400)
    })
  })
})
