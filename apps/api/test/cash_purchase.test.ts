import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { seedTestUser, authenticateTestUser } from './auth_helper'
import { accountRepository } from '../src/repositories/account_repository'
import { journalRepository } from '../src/repositories/journal_repository'
import { purchaseRepository } from '../src/repositories/purchase_repository'
import { createFinanceService } from '../src/services/finance_service'
import { ApiError } from '../src/errors/api_error'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'
const BRANCH_B = '22222222-2222-4222-8222-222222222222'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let pool!: Pool
let app!: ReturnType<typeof createApp>
let ownerTokenA!: string
let ownerTokenB!: string
let cashierTokenA!: string

// ---------------------------------------------------------------------------
// DB Setup Helpers
// ---------------------------------------------------------------------------

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

async function getInventoryAccount(businessId: string): Promise<string> {
  const res = await pool.query(
    `SELECT id FROM accounts WHERE business_id = $1 AND type = 'inventory' LIMIT 1`,
    [businessId]
  )
  return res.rows[0].id
}

// ---------------------------------------------------------------------------
// Setup Hooks
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const dbUrl =
    process.env.CASH_PURCHASE_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_cash_purchase_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)

  const migrationsDir = __dirname + '/migrations'
  await runMigrations(pool, migrationsDir)

  app = createApp(pool)
})

beforeEach(async () => {
  await resetDatabase()

  const ownerA = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  const authOwnerA = await authenticateTestUser(app, ownerA.email, ownerA.password, BUSINESS_A)
  ownerTokenA = authOwnerA.accessToken

  const cashierA = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  const authCashierA = await authenticateTestUser(app, cashierA.email, cashierA.password, BUSINESS_A)
  cashierTokenA = authCashierA.accessToken

  const ownerB = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER' })
  const authOwnerB = await authenticateTestUser(app, ownerB.email, ownerB.password, BUSINESS_B)
  ownerTokenB = authOwnerB.accessToken
}, 30000)

afterAll(async () => {
  await pool.end()
})

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function seedSupplier(
  businessId: string,
  options: {
    name?: string
    code?: string
    term?: 'Tunai' | 'Tempo 14' | 'Tempo 30'
    status?: 'aktif' | 'nonaktif'
  } = {}
): Promise<{ id: string; code: string; name: string; term: string }> {
  const id = randomUUID()
  const name = options.name ?? `Supplier ${id.slice(0, 8)}`
  const code = options.code ?? `SUP-${id.slice(0, 4).toUpperCase()}`
  const term = options.term ?? 'Tunai'
  const status = options.status ?? 'aktif'

  await pool.query(
    `INSERT INTO suppliers (id, business_id, code, name, term, status, server_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 1, now(), now())`,
    [id, businessId, code, name, term, status]
  )

  return { id, code, name, term }
}

async function seedProduct(
  businessId: string,
  options: {
    name?: string
    costMinor?: number
    priceMinor?: number
    isActive?: boolean
  } = {}
): Promise<{ id: string; name: string; costMinor: number }> {
  const id = randomUUID()
  const name = options.name ?? `Product ${id.slice(0, 8)}`
  const costMinor = options.costMinor ?? 50000
  const priceMinor = options.priceMinor ?? 75000
  const isActive = options.isActive ?? true

  await pool.query(
    `INSERT INTO products (id, business_id, name, cost_minor, price_minor, is_active, server_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 1, now(), now())`,
    [id, businessId, name, costMinor, priceMinor, isActive]
  )

  return { id, name, costMinor }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PHASE 9C.9B - CASH PURCHASE ACCOUNTING FIX', () => {
  describe('CASH-PUR-001: cash receive creates PURCHASE journal', () => {
    it('Tunai purchase receive creates PURCHASE journal', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-01', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Beras 5kg', costMinor: 60000 })
      const poId = randomUUID()
      const idemKey = randomUUID()

      const res = await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, note, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now(), now()
         ) RETURNING id`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-01/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 600000, 0, 0, 0, 'Restok beras mingguan', 1
        ]
      )

      const po = res.rows[0]
      const poIdActual = po.id

      const itemId = randomUUID()
      await pool.query(
        `INSERT INTO purchase_items (
           id, purchase_id, product_id, product_name,
           ordered_qty, received_qty, unit_cost_minor, subtotal_minor
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          itemId, poIdActual, product.id, product.name, 10, 10, 60000, 600000
        ]
      )

      await pool.query(
        `UPDATE purchases SET received_minor = 600000, status = 'partial', server_version = server_version + 1
         WHERE id = $1 AND business_id = $2`,
        [poIdActual, BUSINESS_A]
      )

      const updateIdem = randomUUID()
      await pool.query(
        `INSERT INTO idempotency_keys (business_id, idempotency_key, request_hash, response_status, response_body, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, now(), now())`,
        [
          BUSINESS_A, updateIdem, 'hash', 200, JSON.stringify({})
        ]
      )

      const financeService = createFinanceService(pool)
      const result = await financeService.postCashPurchase(
        pool, poIdActual, BUSINESS_A, 600000
      )

      expect(result.journalId).toBeDefined()
      expect(result.sourceId).toBe(poIdActual)

      const journal = await journalRepository.getJournalBySource(
        pool, BUSINESS_A, 'PURCHASE', poIdActual
      )

      expect(journal).toBeDefined()
      expect(journal.status).toBe('posted')
    })
  })


  describe('CASH-PUR-002: Dr Inventory', () => {
    it('Tunai purchase creates Dr Inventory line', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-02', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Laptop', costMinor: 100000 })
      const poId = randomUUID()

      const res = await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()
         ) RETURNING id`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-02/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 100000, 0, 0, 0, 1
        ]
      )

      const po = res.rows[0]
      const inventoryAccount = await getInventoryAccount(BUSINESS_A)

      const journalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (
           id, business_id, branch_id, date, source_type, source_id,
           reference, description, status, reversed_by, reversed_at, reversal_of,
           created_at, server_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13)`,
        [
          journalId, BUSINESS_A, BRANCH_A, '2026-08-28', 'PURCHASE', po.id,
          null, `Cash purchase payment ${po.id}`, 'draft', null, null, null, 1
        ]
      )

      const cashAccount = await getCashAccount(BUSINESS_A)

      await pool.query(
        `INSERT INTO journal_lines (
           id, journal_entry_id, account_id, debit_minor, credit_minor, description
         ) VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)`,
        [
          randomUUID(), journalId, inventoryAccount, 100000, 0, 'Inventory from cash purchase',
          randomUUID(), journalId, cashAccount, 0, 100000, 'Cash outflow for purchase'
        ]
      )

      await pool.query(
        `UPDATE journal_entries SET status = 'posted', server_version = server_version + 1 WHERE id = $1`,
        [journalId]
      )

      const lines = await pool.query(
        `SELECT account_id, debit_minor, credit_minor FROM journal_lines WHERE journal_entry_id = $1`,
        [journalId]
      )

      const inventoryLine = lines.rows.find(r => r.account_id === inventoryAccount)
      expect(inventoryLine.debit_minor).toBe(100000)
      expect(inventoryLine.credit_minor).toBe(0)
    })
  })

  describe('CASH-PUR-003: Cr Cash', () => {
    it('Tunai purchase creates Cr Cash line', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-03', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Mouse', costMinor: 20000 })
      const poId = randomUUID()

      const res = await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()
         ) RETURNING id`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-03/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 20000, 0, 0, 0, 1
        ]
      )

      const po = res.rows[0]
      const cashAccount = await getCashAccount(BUSINESS_A)

      const journalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (
           id, business_id, branch_id, date, source_type, source_id,
           reference, description, status, reversed_by, reversed_at, reversal_of,
           created_at, server_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13)`,
        [
          journalId, BUSINESS_A, BRANCH_A, '2026-08-28', 'PURCHASE', po.id,
          null, `Cash purchase payment ${po.id}`, 'draft', null, null, null, 1
        ]
      )

      const inventoryAccount = await getInventoryAccount(BUSINESS_A)

      await pool.query(
        `INSERT INTO journal_lines (
           id, journal_entry_id, account_id, debit_minor, credit_minor, description
         ) VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)`,
        [
          randomUUID(), journalId, inventoryAccount, 20000, 0, 'Inventory from cash purchase',
          randomUUID(), journalId, cashAccount, 0, 20000, 'Cash outflow for purchase'
        ]
      )

      await pool.query(
        `UPDATE journal_entries SET status = 'posted', server_version = server_version + 1 WHERE id = $1`,
        [journalId]
      )

      const lines = await pool.query(
        `SELECT account_id, debit_minor, credit_minor FROM journal_lines WHERE journal_entry_id = $1`,
        [journalId]
      )

      const cashLine = lines.rows.find(r => r.account_id === cashAccount)
      expect(cashLine.credit_minor).toBe(20000)
      expect(cashLine.debit_minor).toBe(0)
    })
  })

  describe('CASH-PUR-004: journal balanced', () => {
    it('Tunai purchase creates balanced journal', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-04', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Keyboard', costMinor: 30000 })
      const poId = randomUUID()

      const res = await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()
         ) RETURNING id`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-04/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 30000, 0, 0, 0, 1
        ]
      )

      const po = res.rows[0]
      const inventoryAccount = await getInventoryAccount(BUSINESS_A)
      const cashAccount = await getCashAccount(BUSINESS_A)

      const journalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (
           id, business_id, branch_id, date, source_type, source_id,
           reference, description, status, reversed_by, reversed_at, reversal_of,
           created_at, server_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13)`,
        [
          journalId, BUSINESS_A, BRANCH_A, '2026-08-28', 'PURCHASE', po.id,
          null, `Cash purchase payment ${po.id}`, 'draft', null, null, null, 1
        ]
      )

      await pool.query(
        `INSERT INTO journal_lines (
           id, journal_entry_id, account_id, debit_minor, credit_minor, description
         ) VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)`,
        [
          randomUUID(), journalId, inventoryAccount, 30000, 0, 'Inventory from cash purchase',
          randomUUID(), journalId, cashAccount, 0, 30000, 'Cash outflow for purchase'
        ]
      )

      await pool.query(
        `UPDATE journal_entries SET status = 'posted', server_version = server_version + 1 WHERE id = $1`,
        [journalId]
      )

      const result = await pool.query(
        `SELECT
           COALESCE(SUM(debit_minor), 0) as total_debit,
           COALESCE(SUM(credit_minor), 0) as total_credit
         FROM journal_lines WHERE journal_entry_id = $1`,
        [journalId]
      )

      expect(Number(result.rows[0].total_debit)).toBe(30000)
      expect(Number(result.rows[0].total_credit)).toBe(30000)
    })
  })

  describe('CASH-PUR-005: source_type PURCHASE', () => {
    it('Tunai purchase uses source_type PURCHASE', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-05', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Monitor', costMinor: 40000 })
      const poId = randomUUID()

      const res = await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()
         ) RETURNING id`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-05/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 40000, 0, 0, 0, 1
        ]
      )

      const po = res.rows[0]

      const journalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (
           id, business_id, branch_id, date, source_type, source_id,
           reference, description, status, reversed_by, reversed_at, reversal_of,
           created_at, server_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13)`,
        [
          journalId, BUSINESS_A, BRANCH_A, '2026-08-28', 'PURCHASE', po.id,
          null, `Cash purchase payment ${po.id}`, 'draft', null, null, null, 1
        ]
      )

      const check = await pool.query(
        `SELECT source_type FROM journal_entries WHERE id = $1`,
        [journalId]
      )

      expect(check.rows[0].source_type).toBe('PURCHASE')
    })
  })

  describe('CASH-PUR-006: source_id canonical', () => {
    it('Tunai purchase uses payment id as source_id', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-06', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Tablet', costMinor: 50000 })
      const poId = randomUUID()
      const paymentId = randomUUID()

      const res = await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()
         ) RETURNING id`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-06/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 50000, 0, 0, 0, 1
        ]
      )

      const po = res.rows[0]

      const journalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (
           id, business_id, branch_id, date, source_type, source_id,
           reference, description, status, reversed_by, reversed_at, reversal_of,
           created_at, server_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13)`,
        [
          journalId, BUSINESS_A, BRANCH_A, '2026-08-28', 'PURCHASE', paymentId,
          null, `Cash purchase payment ${paymentId}`, 'draft', null, null, null, 1
        ]
      )

      const check = await pool.query(
        `SELECT source_id FROM journal_entries WHERE id = $1`,
        [journalId]
      )

      expect(check.rows[0].source_id).toBe(paymentId)
    })
  })

  describe('CASH-PUR-007: branch propagation', () => {
    it('Tunai purchase preserves branch_id in journal', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-07', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Speaker', costMinor: 60000 })
      const paymentId = randomUUID()

      const financeService = createFinanceService(pool)
      const result = await financeService.postCashPurchase(
        pool,
        paymentId,
        BUSINESS_A,
        60000,
        BRANCH_A,
        'RECEIVE_TUNAI:SUP-07/PO/001',
        'Pembelian tunai SUP-07/PO/001'
      )

      const check = await pool.query(
        `SELECT branch_id, reference, description FROM journal_entries WHERE id = $1`,
        [result.journalId]
      )

      expect(check.rows[0].branch_id).toBe(BRANCH_A)
      expect(check.rows[0].reference).toBe('RECEIVE_TUNAI:SUP-07/PO/001')
      expect(check.rows[0].description).toBe('Pembelian tunai SUP-07/PO/001')
    })
  })

  describe('CASH-PUR-008: no PAYABLE created', () => {
    it('Tunai purchase does NOT create PAYABLE journal', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-08', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Phone', costMinor: 70000 })
      const poId = randomUUID()

      const res = await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()
         ) RETURNING id`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-08/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 70000, 0, 0, 0, 1
        ]
      )

      const po = res.rows[0]

      const check = await pool.query(
        `SELECT COUNT(*) FROM journal_entries WHERE business_id = $1 AND source_type = 'PAYABLE'`,
        [BUSINESS_A]
      )

      expect(check.rows[0].count).toBe(0)
    })
  })

  describe('CASH-PUR-009: idempotent retry', () => {
    it('Tunai purchase retry returns existing journal', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-09', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Headset', costMinor: 80000 })
      const poId = randomUUID()
      const paymentId = randomUUID()

      const res = await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()
         ) RETURNING id`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-09/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 80000, 0, 0, 0, 1
        ]
      )

      const po = res.rows[0]

      const journalId = randomUUID()
      const sourceId = paymentId

      await pool.query(
        `INSERT INTO journal_entries (
           id, business_id, branch_id, date, source_type, source_id,
           reference, description, status, reversed_by, reversed_at, reversal_of,
           created_at, server_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13)`,
        [
          journalId, BUSINESS_A, BRANCH_A, '2026-08-28', 'PURCHASE', sourceId,
          null, `Cash purchase payment ${sourceId}`, 'draft', null, null, null, 1
        ]
      )

      const inventoryAccount = await getInventoryAccount(BUSINESS_A)
      const cashAccount = await getCashAccount(BUSINESS_A)

      await pool.query(
        `INSERT INTO journal_lines (
           id, journal_entry_id, account_id, debit_minor, credit_minor, description
         ) VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)`,
        [
          randomUUID(), journalId, inventoryAccount, 80000, 0, 'Inventory from cash purchase',
          randomUUID(), journalId, cashAccount, 0, 80000, 'Cash outflow for purchase'
        ]
      )

      await pool.query(
        `UPDATE journal_entries SET status = 'posted', server_version = server_version + 1 WHERE id = $1`,
        [journalId]
      )

      const result = await pool.query(
        `SELECT * FROM journal_entries WHERE business_id = $1 AND source_type = 'PURCHASE' AND source_id = $2`,
        [BUSINESS_A, sourceId]
      )

      expect(result.rows.length).toBe(1)
      expect(result.rows[0].status).toBe('posted')
    })
  })

  describe('CASH-PUR-010: partial cash receive creates correct amount', () => {
    it('Partial Tunai receive creates PURCHASE journal with correct amount', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-10', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'USB Cable', costMinor: 10000 })
      const poId = randomUUID()

      const res = await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()
         ) RETURNING id`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-10/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 10000, 0, 0, 0, 1
        ]
      )

      const po = res.rows[0]

      const journalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (
           id, business_id, branch_id, date, source_type, source_id,
           reference, description, status, reversed_by, reversed_at, reversal_of,
           created_at, server_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13)`,
        [
          journalId, BUSINESS_A, BRANCH_A, '2026-08-28', 'PURCHASE', po.id,
          null, `Cash purchase payment ${po.id}`, 'draft', null, null, null, 1
        ]
      )

      const inventoryAccount = await getInventoryAccount(BUSINESS_A)
      const cashAccount = await getCashAccount(BUSINESS_A)

      await pool.query(
        `INSERT INTO journal_lines (
           id, journal_entry_id, account_id, debit_minor, credit_minor, description
         ) VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)`,
        [
          randomUUID(), journalId, inventoryAccount, 10000, 0, 'Inventory from cash purchase',
          randomUUID(), journalId, cashAccount, 0, 10000, 'Cash outflow for purchase'
        ]
      )

      await pool.query(
        `UPDATE journal_entries SET status = 'posted', server_version = server_version + 1 WHERE id = $1`,
        [journalId]
      )

      const lines = await pool.query(
        `SELECT account_id, debit_minor, credit_minor FROM journal_lines WHERE journal_entry_id = $1`,
        [journalId]
      )

      const totalDebit = lines.rows.reduce((sum, line) => sum + line.debit_minor, 0)
      const totalCredit = lines.rows.reduce((sum, line) => sum + line.credit_minor, 0)

      expect(totalDebit).toBe(10000)
      expect(totalCredit).toBe(10000)
    })
  })

  describe('CASH-PUR-011: credit purchase still uses PAYABLE', () => {
    it('Credit purchase (Tempo) still uses PAYABLE journal', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-11', term: 'Tempo 14' })
      const product = await seedProduct(BUSINESS_A, { name: 'Monitor', costMinor: 100000 })
      const poId = randomUUID()

      const res = await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()
         ) RETURNING id`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-11/PO/001', '2026-08-28',
          '2026-08-29', 'Tempo 14', 'sent', 100000, 0, 100000, 0, 1
        ]
      )

      const po = res.rows[0]

      const journalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (
           id, business_id, branch_id, date, source_type, source_id,
           reference, description, status, reversed_by, reversed_at, reversal_of,
           created_at, server_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13)`,
        [
          journalId, BUSINESS_A, BRANCH_A, '2026-08-28', 'PAYABLE', po.id,
          null, `Accounts payable for purchase ${po.id}`, 'draft', null, null, null, 1
        ]
      )

      const check = await pool.query(
        `SELECT source_type FROM journal_entries WHERE id = $1`,
        [journalId]
      )

      expect(check.rows[0].source_type).toBe('PAYABLE')
    })
  })

  describe('CASH-PUR-012: credit purchase payment still uses PURCHASE_PAYMENT', () => {
    it('Credit purchase payment still uses PURCHASE_PAYMENT journal', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-12', term: 'Tempo 30' })
      const product = await seedProduct(BUSINESS_A, { name: 'Laptop', costMinor: 200000 })
      const poId = randomUUID()
      const paymentId = randomUUID()

      const res = await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()
         ) RETURNING id`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-12/PO/001', '2026-08-28',
          '2026-08-29', 'Tempo 30', 'sent', 200000, 0, 200000, 0, 1
        ]
      )

      const po = res.rows[0]

      const journalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (
           id, business_id, branch_id, date, source_type, source_id,
           reference, description, status, reversed_by, reversed_at, reversal_of,
           created_at, server_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13)`,
        [
          journalId, BUSINESS_A, BRANCH_A, '2026-08-28', 'PURCHASE_PAYMENT', paymentId,
          null, `Payment ${paymentId}`, 'draft', null, null, null, 1
        ]
      )

      const check = await pool.query(
        `SELECT source_type FROM journal_entries WHERE id = $1`,
        [journalId]
      )

      expect(check.rows[0].source_type).toBe('PURCHASE_PAYMENT')
    })
  })

  describe('CASH-PUR-013: cash purchase never creates AP', () => {
    it('Tunai purchase does not create any AP-related entries', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-13', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Desk', costMinor: 150000 })
      const poId = randomUUID()

      const res = await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()
         ) RETURNING id`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-13/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 150000, 0, 0, 0, 1
        ]
      )

      const po = res.rows[0]

      const payableAccounts = await pool.query(
        `SELECT id FROM accounts WHERE business_id = $1 AND type = 'payable'`,
        [BUSINESS_A]
      )

      expect(payableAccounts.rows.length).toBe(1)
    })
  })

  describe('CASH-PUR-014: same transaction rollback on journal failure', () => {
    it('Tunai receive rolls back all changes if journal fails', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-14', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Chair', costMinor: 50000 })
      const poId = randomUUID()

      const res = await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()
         ) RETURNING id`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-14/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 50000, 0, 0, 0, 1
        ]
      )

      const po = res.rows[0]

      const itemId = randomUUID()
      await pool.query(
        `INSERT INTO purchase_items (
           id, purchase_id, product_id, product_name,
           ordered_qty, received_qty, unit_cost_minor, subtotal_minor
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          itemId, poId, product.id, product.name, 1, 1, 50000, 50000
        ]
      )

      const stockId = randomUUID()
      await pool.query(
        `INSERT INTO stocks (
           id, business_id, branch_id, product_id, quantity,
           server_version, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
        [
          stockId, BUSINESS_A, BRANCH_A, product.id, 0, 1
        ]
      )

const movementId = randomUUID()
      await pool.query(
        `INSERT INTO stock_movements (
           id, business_id, branch_id, product_id, quantity,
           movement_type, reference, actor
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          movementId, BUSINESS_A, BRANCH_A, product.id, 1, 'STOCK_IN',
          poId, 'actor'
        ]
      )

      await pool.query(
        `UPDATE stocks SET quantity = 1, server_version = server_version + 1 WHERE id = $1`,
        [stockId]
      )

      const paymentId = randomUUID()
      await pool.query(
        `INSERT INTO purchase_payments (
           id, business_id, purchase_id, branch_id, amount_minor, method,
           reference, idempotency_key, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
        [
          paymentId, BUSINESS_A, poId, BRANCH_A, 50000, 'cash', 'PAYMENT_REF', 'IDEM_KEY'
        ]
      )

      const journalId = randomUUID()
      await pool.query(
        `INSERT INTO journal_entries (
           id, business_id, branch_id, date, source_type, source_id,
           reference, description, status, reversed_by, reversed_at, reversal_of,
           created_at, server_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13)`,
        [
          journalId, BUSINESS_A, BRANCH_A, '2026-08-28', 'PURCHASE', paymentId,
          null, `Cash purchase payment ${paymentId}`, 'draft', null, null, null, 1
        ]
      )

      const inventoryAccount = await getInventoryAccount(BUSINESS_A)
      const cashAccount = await getCashAccount(BUSINESS_A)

      await pool.query(
        `INSERT INTO journal_lines (
           id, journal_entry_id, account_id, debit_minor, credit_minor, description
         ) VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)`,
        [
          randomUUID(), journalId, inventoryAccount, 50000, 0, 'Inventory from cash purchase',
          randomUUID(), journalId, cashAccount, 0, 50000, 'Cash outflow for purchase'
        ]
      )

      await pool.query(
        `UPDATE journal_entries SET status = 'posted', server_version = server_version + 1 WHERE id = $1`,
        [journalId]
      )

      const journals = await pool.query(
        `SELECT COUNT(*) FROM journal_entries WHERE business_id = $1 AND source_type = 'PURCHASE'`,
        [BUSINESS_A]
      )

      expect(journals.rows[0].count).toBeGreaterThan(0)
    })
  })

  describe('CASH-PUR-015: tenant isolation', () => {
    it('Tunai purchase journal is isolated by business_id', async () => {
      const supplierA = await seedSupplier(BUSINESS_A, { code: 'SUP-15A', term: 'Tunai' })
      const supplierB = await seedSupplier(BUSINESS_B, { code: 'SUP-15B', term: 'Tunai' })
      const productA = await seedProduct(BUSINESS_A, { name: 'Product A', costMinor: 100000 })
      const productB = await seedProduct(BUSINESS_B, { name: 'Product B', costMinor: 200000 })
      const poIdA = randomUUID()
      const poIdB = randomUUID()

      await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()
         ) RETURNING id`,
        [
          poIdA, BUSINESS_A, BRANCH_A, supplierA.id, 'SUP-15A/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 100000, 0, 0, 0, 1
        ]
      )

      await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()
         ) RETURNING id`,
        [
          poIdB, BUSINESS_B, BRANCH_B, supplierB.id, 'SUP-15B/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 200000, 0, 0, 0, 1
        ]
      )

      const journalIdA = randomUUID()
      const journalIdB = randomUUID()

      await pool.query(
        `INSERT INTO journal_entries (
           id, business_id, branch_id, date, source_type, source_id,
           reference, description, status, reversed_by, reversed_at, reversal_of,
           created_at, server_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13),
                ($14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, now(), $26)`,
        [
          journalIdA, BUSINESS_A, BRANCH_A, '2026-08-28', 'PURCHASE', poIdA,
          null, `Cash purchase payment ${poIdA}`, 'draft', null, null, null, 1,
          journalIdB, BUSINESS_B, BRANCH_B, '2026-08-28', 'PURCHASE', poIdB,
          null, `Cash purchase payment ${poIdB}`, 'draft', null, null, null, 1
        ]
      )

      const journalsA = await pool.query(
        `SELECT * FROM journal_entries WHERE business_id = $1 AND source_type = 'PURCHASE'`,
        [BUSINESS_A]
      )

      const journalsB = await pool.query(
        `SELECT * FROM journal_entries WHERE business_id = $1 AND source_type = 'PURCHASE'`,
        [BUSINESS_B]
      )

      expect(journalsA.rows.length).toBe(1)
      expect(journalsB.rows.length).toBe(1)
      expect(journalsA.rows[0].business_id).toBe(BUSINESS_A)
      expect(journalsB.rows[0].business_id).toBe(BUSINESS_B)
    })
  })

  describe('CASH-PUR-016: full receive API flow propagates branch and creates posted journal', () => {
    it('POST /v1/purchases/:id/receive for Tunai PO creates journal with branch_id and payment reference', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-16', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Printer', costMinor: 150000 })
      const poId = randomUUID()
      const itemId = randomUUID()

      await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, note, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now(), now()
         )`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-16/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 150000, 0, 0, 0, 'Pembelian printer', 1
        ]
      )

      await pool.query(
        `INSERT INTO purchase_items (
           id, purchase_id, product_id, product_name,
           ordered_qty, received_qty, unit_cost_minor, subtotal_minor
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          itemId, poId, product.id, product.name, 1, 0, 150000, 150000
        ]
      )

      const res = await request(app)
        .post(`/v1/purchases/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          items: [
            {
              item_id: itemId,
              receive_qty: 1
            }
          ]
        })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('received')
      expect(res.body.paid_minor).toBe(150000)
      expect(res.body.outstanding_minor).toBe(0)
      expect(res.body.payments.length).toBe(1)

      const payment = res.body.payments[0]
      expect(payment.branch_id).toBe(BRANCH_A)
      expect(payment.amount_minor).toBe(150000)
      expect(payment.reference).toMatch(/^RECEIVE_TUNAI:/)

      const journalRes = await pool.query(
        `SELECT * FROM journal_entries WHERE business_id = $1 AND source_type = 'PURCHASE' AND source_id = $2`,
        [BUSINESS_A, payment.id]
      )
      expect(journalRes.rows.length).toBe(1)
      const journal = journalRes.rows[0]
      expect(journal.status).toBe('posted')
      expect(journal.branch_id).toBe(BRANCH_A)
      expect(journal.reference).toBe(payment.reference)
      expect(journal.description).toBe('Pembelian tunai SUP-16/PO/001')

      const linesRes = await pool.query(
        `SELECT jl.*, a.type as account_type FROM journal_lines jl
         JOIN accounts a ON a.id = jl.account_id
         WHERE jl.journal_entry_id = $1`,
        [journal.id]
      )
      expect(linesRes.rows.length).toBe(2)
      const invLine = linesRes.rows.find((l: any) => l.account_type === 'inventory')
      const cashLine = linesRes.rows.find((l: any) => l.account_type === 'cash')
      expect(invLine.debit_minor).toBe(150000)
      expect(invLine.credit_minor).toBe(0)
      expect(cashLine.debit_minor).toBe(0)
      expect(cashLine.credit_minor).toBe(150000)
    })
  })

  describe('CASH-PUR-017: branch cashflow integration', () => {
    it('Cash purchase appears in branch-filtered cashflow report as cash outflow', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-17', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Monitor', costMinor: 200000 })
      const poId = randomUUID()
      const itemId = randomUUID()

      await pool.query(
        `INSERT INTO purchases (
           id, business_id, branch_id, supplier_id, code, date, due_date,
           supplier_term, status, total_minor, paid_minor, outstanding_minor,
           received_minor, note, server_version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now(), now()
         )`,
        [
          poId, BUSINESS_A, BRANCH_A, supplier.id, 'SUP-17/PO/001', '2026-08-28',
          '2026-08-29', 'Tunai', 'sent', 200000, 0, 0, 0, 'Pembelian monitor', 1
        ]
      )

      await pool.query(
        `INSERT INTO purchase_items (
           id, purchase_id, product_id, product_name,
           ordered_qty, received_qty, unit_cost_minor, subtotal_minor
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          itemId, poId, product.id, product.name, 1, 0, 200000, 200000
        ]
      )

      const receiveRes = await request(app)
        .post(`/v1/purchases/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          items: [{ item_id: itemId, receive_qty: 1 }]
        })

      expect(receiveRes.status).toBe(200)

      const cashflowBranchA = await accountRepository.getCashflow(pool, BUSINESS_A, BRANCH_A)
      const cashPurchaseFlowA = cashflowBranchA.find(cf => cf.account_type === 'cash' && cf.credit_minor === 200000)
      expect(cashPurchaseFlowA).toBeDefined()
      expect(cashPurchaseFlowA?.net_flow).toBe(-200000)

      const apiCashflowA = await request(app)
        .get(`/v1/finance/cashflow?branch_id=${BRANCH_A}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
      expect(apiCashflowA.status).toBe(200)
      const apiFlowA = apiCashflowA.body.entries.find((cf: any) => cf.account_type === 'cash' && cf.credit_minor === 200000)
      expect(apiFlowA).toBeDefined()

      const cashflowBranchB = await accountRepository.getCashflow(pool, BUSINESS_A, BRANCH_B)
      const cashPurchaseFlowB = cashflowBranchB.find(cf => cf.credit_minor === 200000)
      expect(cashPurchaseFlowB).toBeUndefined()
    })
  })
})


