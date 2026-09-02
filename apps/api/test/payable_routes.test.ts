import path from 'path'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createFinanceService } from '../src/services/finance_service'
import { seedTestUser, authenticateTestUser } from './auth_helper'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'
const BRANCH_B = '22222222-2222-4222-8222-222222222222'

let pool!: Pool
let app!: ReturnType<typeof createApp>
let service!: ReturnType<typeof createFinanceService>
let ownerTokenA!: string
let cashierTokenA!: string
let ownerTokenB!: string

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE
      journal_lines,
      journal_entries,
      idempotency_keys,
      purchase_payments,
      purchase_items,
      purchases,
      suppliers,
      accounts,
      stocks,
      stock_movements,
      products,
      sales,
      receivables,
      branches,
      users,
      user_businesses,
      businesses
    RESTART IDENTITY CASCADE
  `)

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, 'AP-A'), ($2, 'AP-B') ON CONFLICT (id) DO NOTHING`,
    [BUSINESS_A, BUSINESS_B]
  )
  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'Branch A', true), ($3, $4, 'Branch B', true) ON CONFLICT (id) DO NOTHING`,
    [BRANCH_A, BUSINESS_A, BRANCH_B, BUSINESS_B]
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
       VALUES ($1, $2, $3, $4, $5, 'IDR', true, now(), 1)
       ON CONFLICT (business_id, code) DO NOTHING`,
      [randomUUID(), businessId, acc.code, acc.name, acc.type]
    )
  }
}

async function seedSupplier(businessId: string): Promise<string> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO suppliers (id, business_id, code, name, contact, phone, email, category, term, status, server_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [id, businessId, `SUP-API-${randomUUID().slice(0, 8)}`, 'API Supplier', null, null, null, null, 'Tempo 30', 'aktif', 1, '2026-01-01', '2026-01-01']
  )
  return id
}

async function seedPurchase(
  businessId: string,
  supplierId: string,
  branchId: string,
  status: string,
  paidMinor = 0,
  outstandingMinor = 500000
): Promise<string> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO purchases (id, business_id, branch_id, supplier_id, code, date, due_date, supplier_term, status, total_minor, paid_minor, outstanding_minor, received_minor, note, server_version, created_at, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (id) DO NOTHING`,
    [id, businessId, branchId, supplierId, `API-PO-${randomUUID().slice(0, 8)}`, '2026-01-01', '2026-01-30', 'Tempo 30', status, 500000, paidMinor, outstandingMinor, 500000, null, 1, '2026-01-01', '2026-01-01', null]
  )
  return id
}

async function seedPaymentViaRepository(
  purchaseId: string,
  businessId: string,
  branchId: string,
  amount: number,
  reference = 'REF-API',
  idempotencyKey?: string
): Promise<string> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO purchase_payments (id, business_id, purchase_id, branch_id, amount_minor, method, reference, idempotency_key, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
    [id, businessId, purchaseId, branchId, amount, 'bank_transfer', reference, idempotencyKey ?? `api_pay_${randomUUID()}`]
  )
  return id
}

async function getJournalBySource(
  sourceType: string,
  sourceId: string,
  businessId: string = BUSINESS_A
): Promise<any> {
  const res = await pool.query(
    `SELECT * FROM journal_entries WHERE business_id = $1 AND source_type = $2 AND source_id = $3`,
    [businessId, sourceType, sourceId]
  )
  return res.rows[0] || null
}

async function getJournalLines(journalId: string): Promise<any[]> {
  const res = await pool.query(
    `SELECT jl.*, a.type AS account_type FROM journal_lines jl
     JOIN accounts a ON a.id = jl.account_id
     WHERE jl.journal_entry_id = $1 ORDER BY jl.id`,
    [journalId]
  )
  return res.rows
}

async function seedOwnerA(): Promise<string> {
  const user = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER', email: 'owner-a@test.local' })
  const auth = await authenticateTestUser(app, user.email, user.password, BUSINESS_A)
  return auth.accessToken
}

async function seedCashierA(): Promise<string> {
  const user = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER', email: 'cashier-a@test.local' })
  const auth = await authenticateTestUser(app, user.email, user.password, BUSINESS_A)
  return auth.accessToken
}

async function seedOwnerB(): Promise<string> {
  const user = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER', email: 'owner-b@test.local' })
  const auth = await authenticateTestUser(app, user.email, user.password, BUSINESS_B)
  return auth.accessToken
}

beforeAll(async () => {
  const dbUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.PAYABLE_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)

  const migrationsDir = path.resolve(__dirname, '../migrations')
  await runMigrations(pool, migrationsDir)

  app = createApp(pool)
  service = createFinanceService(pool)

  await resetDatabase()
  ownerTokenA = await seedOwnerA()
  cashierTokenA = await seedCashierA()
  ownerTokenB = await seedOwnerB()
})

beforeEach(async () => {
  await resetDatabase()

  ownerTokenA = await seedOwnerA()
  cashierTokenA = await seedCashierA()
  ownerTokenB = await seedOwnerB()
})

afterAll(async () => {
  await pool.end()
})

describe('9C.7E Payable Routes (payable_routes.ts) — PAY-API-XX', () => {
  // POST /v1/payables/postings/payable
  it('PAY-API-001: posting payable invoice OWNER', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    const res = await request(app)
      .post('/v1/payables/postings/payable')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: purchaseId })

    expect(res.status).toBe(201)
    expect(res.body.journalId).toBeDefined()
    expect(res.body.sourceId).toBe(purchaseId)
  })

  it('PAY-API-002: posting payable invoice CASHIER forbidden', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    const res = await request(app)
      .post('/v1/payables/postings/payable')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({ purchase_id: purchaseId })

    expect(res.status).toBe(403)
  })

  it('PAY-API-003: invalid purchase state rejected', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'sent')

    const res = await request(app)
      .post('/v1/payables/postings/payable')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: purchaseId })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_STATE')
  })

  it('PAY-API-004: missing purchase not found', async () => {
    const res = await request(app)
      .post('/v1/payables/postings/payable')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: randomUUID() })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('PAY-API-005: tenant isolation', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    const res = await request(app)
      .post('/v1/payables/postings/payable')
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .send({ purchase_id: purchaseId })

    expect(res.status).toBe(404)
  })

  it('PAY-API-006: idempotent payable posting returns same journal', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    const res1 = await request(app)
      .post('/v1/payables/postings/payable')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: purchaseId })

    const res2 = await request(app)
      .post('/v1/payables/postings/payable')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: purchaseId })

    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)
    expect(res2.body.journalId).toBe(res1.body.journalId)
  })

  it('PAY-API-007: invalid UUID rejected', async () => {
    const res = await request(app)
      .post('/v1/payables/postings/payable')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: 'not-a-uuid' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  // POST /v1/payables/postings/purchase-payment
  it('PAY-API-008: post purchase payment creates PURCHASE_PAYMENT journal', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')
    await service.postPurchaseInvoice(purchaseId, BUSINESS_A)

    const paymentId = await seedPaymentViaRepository(purchaseId, BUSINESS_A, BRANCH_A, 300000)

    const res = await request(app)
      .post('/v1/payables/postings/purchase-payment')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ payment_id: paymentId })

    expect(res.status).toBe(201)
    expect(res.body.journalId).toBeDefined()
    expect(res.body.sourceId).toBe(paymentId)

    const journal = await getJournalBySource('PURCHASE_PAYMENT', paymentId)
    expect(journal).not.toBeNull()
    expect(journal.source_type).toBe('PURCHASE_PAYMENT')
  })

  it('PAY-API-009: purchase payment journal balanced', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')
    await service.postPurchaseInvoice(purchaseId, BUSINESS_A)

    const paymentId = await seedPaymentViaRepository(purchaseId, BUSINESS_A, BRANCH_A, 300000)

    const res = await request(app)
      .post('/v1/payables/postings/purchase-payment')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ payment_id: paymentId })

    const lines = await getJournalLines(res.body.journalId)
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit_minor), 0)
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit_minor), 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(300000)
  })

  it('PAY-API-010: purchase payment invalid UUID rejected', async () => {
    const res = await request(app)
      .post('/v1/payables/postings/purchase-payment')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ payment_id: 'not-a-uuid' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('PAY-API-011: purchase payment CASHIER forbidden', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')
    await service.postPurchaseInvoice(purchaseId, BUSINESS_A)

    const paymentId = await seedPaymentViaRepository(purchaseId, BUSINESS_A, BRANCH_A, 300000)

    const res = await request(app)
      .post('/v1/payables/postings/purchase-payment')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({ payment_id: paymentId })

    expect(res.status).toBe(403)
  })

  // POST /v1/payables/reversals/purchase-payment
  it('PAY-API-012: reverse purchase payment OWNER', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received', 300000, 200000)
    await service.postPurchaseInvoice(purchaseId, BUSINESS_A)

    const paymentId = await seedPaymentViaRepository(purchaseId, BUSINESS_A, BRANCH_A, 300000)
    await service.postPurchasePayment(paymentId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/payables/reversals/purchase-payment')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ payment_id: paymentId })

    expect(res.status).toBe(201)
    expect(res.body.reversalId).toBeDefined()
  })

  it('PAY-API-013: reverse purchase payment CASHIER forbidden', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')
    await service.postPurchaseInvoice(purchaseId, BUSINESS_A)

    const paymentId = await seedPaymentViaRepository(purchaseId, BUSINESS_A, BRANCH_A, 300000)
    await service.postPurchasePayment(paymentId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/payables/reversals/purchase-payment')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({ payment_id: paymentId })

    expect(res.status).toBe(403)
  })

  it('PAY-API-014: second reversal rejected', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received', 300000, 200000)
    await service.postPurchaseInvoice(purchaseId, BUSINESS_A)

    const paymentId = await seedPaymentViaRepository(purchaseId, BUSINESS_A, BRANCH_A, 300000)
    await service.postPurchasePayment(paymentId, BUSINESS_A)

    await request(app)
      .post('/v1/payables/reversals/purchase-payment')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ payment_id: paymentId })
      .expect(201)

    const res = await request(app)
      .post('/v1/payables/reversals/purchase-payment')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ payment_id: paymentId })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('ALREADY_REVERSED')
  })

  it('PAY-API-015: reverse payment invalid UUID rejected', async () => {
    const res = await request(app)
      .post('/v1/payables/reversals/purchase-payment')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ payment_id: 'not-a-uuid' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  // Authentication
  it('PAY-API-016: unauthenticated request rejected', async () => {
    const res = await request(app)
      .post('/v1/payables/postings/payable')
      .send({ purchase_id: randomUUID() })

    expect(res.status).toBe(401)
  })

  it('PAY-API-017: PAYABLE journal balanced after invoice posting via payable routes', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    const res = await request(app)
      .post('/v1/payables/postings/payable')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: purchaseId })

    const lines = await getJournalLines(res.body.journalId)
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit_minor), 0)
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit_minor), 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(500000)

    const inventoryLine = lines.find((l) => l.account_type === 'inventory')
    const payableLine = lines.find((l) => l.account_type === 'payable')
    expect(inventoryLine).toBeDefined()
    expect(payableLine).toBeDefined()
    expect(Number(inventoryLine!.debit_minor)).toBe(500000)
    expect(Number(payableLine!.credit_minor)).toBe(500000)
  })
})
