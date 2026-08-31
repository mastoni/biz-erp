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

describe('9C.7F Payable API + E2E', () => {
  // ===========================================================================
  // Purchase invoice posting
  // ===========================================================================

  it('AP-API-001: posting purchase invoice OWNER', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    const res = await request(app)
      .post('/v1/finance/postings/purchase')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: purchaseId })

    expect(res.status).toBe(201)
    expect(res.body.journalId).toBeDefined()
    expect(res.body.sourceId).toBe(purchaseId)
  })

  it('AP-API-002: posting purchase invoice CASHIER forbidden', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    const res = await request(app)
      .post('/v1/finance/postings/purchase')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({ purchase_id: purchaseId })

    expect(res.status).toBe(403)
  })

  it('AP-API-003: invalid purchase state rejected (sent)', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'sent')

    const res = await request(app)
      .post('/v1/finance/postings/purchase')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: purchaseId })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_STATE')
  })

  it('AP-API-003b: invalid purchase state rejected (draft)', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'draft')

    const res = await request(app)
      .post('/v1/finance/postings/purchase')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: purchaseId })

    expect(res.status).toBe(400)
  })

  it('AP-API-004: missing purchase not found', async () => {
    const res = await request(app)
      .post('/v1/finance/postings/purchase')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: randomUUID() })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('AP-API-005: tenant isolation', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    const res = await request(app)
      .post('/v1/finance/postings/purchase')
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .send({ purchase_id: purchaseId })

    expect(res.status).toBe(404)
  })

  it('AP-API-006: branch propagation in PAYABLE journal', async () => {
    const branchB = randomUUID()
    await pool.query(
      `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'API Branch B', true) ON CONFLICT (id) DO NOTHING`,
      [branchB, BUSINESS_A]
    )
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, branchB, 'received')

    const res = await request(app)
      .post('/v1/finance/postings/purchase')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: purchaseId })

    expect(res.status).toBe(201)
    const journal = await getJournalBySource('PAYABLE', purchaseId)
    expect(journal.branch_id).toBe(branchB)
  })

  it('AP-API-007: idempotent payable posting returns same journal', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    const res1 = await request(app)
      .post('/v1/finance/postings/purchase')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: purchaseId })

    const res2 = await request(app)
      .post('/v1/finance/postings/purchase')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: purchaseId })

    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)
    expect(res2.body.journalId).toBe(res1.body.journalId)
  })

  // ===========================================================================
  // Purchase payment (E2E: service-level)
  // ===========================================================================

  it('AP-API-008: postPurchasePayment creates journal', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')
    await service.postPurchaseInvoice(purchaseId, BUSINESS_A)

    const paymentId = await seedPaymentViaRepository(purchaseId, BUSINESS_A, BRANCH_A, 300000)
    const result = await service.postPurchasePayment(paymentId, BUSINESS_A)

    expect(result.journalId).toBeDefined()
    expect(result.sourceId).toBe(paymentId)

    const journal = await getJournalBySource('PURCHASE_PAYMENT', paymentId)
    expect(journal).not.toBeNull()
    expect(journal.source_id).toBe(paymentId)
    expect(journal.source_type).toBe('PURCHASE_PAYMENT')
  })

  it('AP-API-009: payment journal balanced', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')
    await service.postPurchaseInvoice(purchaseId, BUSINESS_A)

    const paymentId = await seedPaymentViaRepository(purchaseId, BUSINESS_A, BRANCH_A, 300000)
    const result = await service.postPurchasePayment(paymentId, BUSINESS_A)

    const lines = await getJournalLines(result.journalId)
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit_minor), 0)
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit_minor), 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(300000)
  })

  it('AP-API-010: payment branch inherited from purchase', async () => {
    const branchB = randomUUID()
    await pool.query(
      `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'API Branch B', true) ON CONFLICT (id) DO NOTHING`,
      [branchB, BUSINESS_A]
    )
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, branchB, 'received')
    await service.postPurchaseInvoice(purchaseId, BUSINESS_A)

    const paymentId = await seedPaymentViaRepository(purchaseId, BUSINESS_A, branchB, 100000)
    await service.postPurchasePayment(paymentId, BUSINESS_A)

    const journal = await getJournalBySource('PURCHASE_PAYMENT', paymentId)
    expect(journal.branch_id).toBe(branchB)
  })

  it('AP-API-011: payment posting idempotent', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')
    await service.postPurchaseInvoice(purchaseId, BUSINESS_A)

    const paymentId = await seedPaymentViaRepository(purchaseId, BUSINESS_A, BRANCH_A, 250000)
    const result1 = await service.postPurchasePayment(paymentId, BUSINESS_A)
    const result2 = await service.postPurchasePayment(paymentId, BUSINESS_A)
    expect(result2.journalId).toBe(result1.journalId)
  })

  // ===========================================================================
  // Payment reversal
  // ===========================================================================

  async function setupInvoiceAndPayment(
    businessId: string,
    branchId: string,
    amount: number
  ): Promise<{ purchaseId: string; paymentId: string; journalId: string }> {
    const supplier = await seedSupplier(businessId)
    const purchaseId = await seedPurchase(businessId, supplier, branchId, 'received', amount, 500000 - amount)
    await service.postPurchaseInvoice(purchaseId, businessId)

    const paymentId = await seedPaymentViaRepository(purchaseId, businessId, branchId, amount)
    const result = await service.postPurchasePayment(paymentId, businessId)
    return { purchaseId, paymentId, journalId: result.journalId }
  }

  it('AP-API-012: reverse payment OWNER', async () => {
    const { paymentId } = await setupInvoiceAndPayment(BUSINESS_A, BRANCH_A, 300000)

    const res = await request(app)
      .post('/v1/finance/reversals/purchase-payment')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ payment_id: paymentId })

    expect(res.status).toBe(201)
    expect(res.body.reversalId).toBeDefined()
  })

  it('AP-API-013: reverse payment CASHIER forbidden', async () => {
    const { paymentId } = await setupInvoiceAndPayment(BUSINESS_A, BRANCH_A, 300000)

    const res = await request(app)
      .post('/v1/finance/reversals/purchase-payment')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({ payment_id: paymentId })

    expect(res.status).toBe(403)
  })

  it('AP-API-014: payment row unchanged after reversal', async () => {
    const { paymentId } = await setupInvoiceAndPayment(BUSINESS_A, BRANCH_A, 200000)

    const before = await pool.query(
      `SELECT amount_minor, method, reference FROM purchase_payments WHERE id = $1`,
      [paymentId]
    )

    await service.reversePurchasePayment(paymentId, BUSINESS_A)

    const after = await pool.query(
      `SELECT amount_minor, method, reference FROM purchase_payments WHERE id = $1`,
      [paymentId]
    )
    expect(after.rows[0].amount_minor).toBe(before.rows[0].amount_minor)
    expect(after.rows[0].method).toBe(before.rows[0].method)
    expect(after.rows[0].reference).toBe(before.rows[0].reference)
  })

  it('AP-API-015: purchase settlement restored after reversal', async () => {
    const { purchaseId, paymentId } = await setupInvoiceAndPayment(BUSINESS_A, BRANCH_A, 300000)

    const before = await pool.query(`SELECT paid_minor FROM purchases WHERE id = $1`, [purchaseId])
    expect(Number(before.rows[0].paid_minor)).toBe(300000)

    await service.reversePurchasePayment(paymentId, BUSINESS_A)

    const after = await pool.query(
      `SELECT paid_minor, outstanding_minor FROM purchases WHERE id = $1`,
      [purchaseId]
    )
    expect(Number(after.rows[0].paid_minor)).toBe(0)
    expect(Number(after.rows[0].outstanding_minor)).toBe(500000)
  })

  it('AP-API-016: second reversal rejected', async () => {
    const { paymentId } = await setupInvoiceAndPayment(BUSINESS_A, BRANCH_A, 200000)
    await service.reversePurchasePayment(paymentId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/finance/reversals/purchase-payment')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ payment_id: paymentId })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('ALREADY_REVERSED')
  })

  it('AP-API-017: invalid UUID rejected', async () => {
    const res = await request(app)
      .post('/v1/finance/postings/purchase')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: 'not-a-uuid' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('AP-API-018: unauthenticated request', async () => {
    const res = await request(app)
      .post('/v1/finance/postings/purchase')
      .send({ purchase_id: randomUUID() })

    expect(res.status).toBe(401)
  })

  it('AP-API-019: missing inventory account -> 500 CONFIG_ERROR', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    await pool.query(`DELETE FROM accounts WHERE business_id = $1 AND type = 'inventory'`, [BUSINESS_A])

    const res = await request(app)
      .post('/v1/finance/postings/purchase')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ purchase_id: purchaseId })

    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('CONFIG_ERROR')
  })

  // ===========================================================================
  // Accounting correctness
  // ===========================================================================

  it('AP-API-020: PAYABLE journal balanced', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    const result = await service.postPurchaseInvoice(purchaseId, BUSINESS_A)
    const journal = await getJournalBySource('PAYABLE', purchaseId)
    expect(journal.status).toBe('posted')

    const lines = await getJournalLines(result.journalId)
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit_minor), 0)
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit_minor), 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(500000)
  })

  it('AP-API-021: PAYABLE journal Debit=Inventory Credit=AccountsPayable', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    const result = await service.postPurchaseInvoice(purchaseId, BUSINESS_A)
    const lines = await getJournalLines(result.journalId)

    const inventoryLine = lines.find((l) => l.account_type === 'inventory')
    const payableLine = lines.find((l) => l.account_type === 'payable')

    expect(inventoryLine).toBeDefined()
    expect(payableLine).toBeDefined()
    expect(Number(inventoryLine.debit_minor)).toBe(500000)
    expect(Number(inventoryLine.credit_minor)).toBe(0)
    expect(Number(payableLine.debit_minor)).toBe(0)
    expect(Number(payableLine.credit_minor)).toBe(500000)
  })

  it('AP-API-022: no inventory quantity mutation after invoice posting', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    const beforeStock = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total FROM stocks WHERE business_id = $1`,
      [BUSINESS_A]
    )
    const beforeQty = Number(beforeStock.rows[0].total)

    await service.postPurchaseInvoice(purchaseId, BUSINESS_A)

    const afterStock = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total FROM stocks WHERE business_id = $1`,
      [BUSINESS_A]
    )
    expect(Number(afterStock.rows[0].total)).toBe(beforeQty)
  })

  it('AP-API-023: no sales mutation after invoice posting', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    await pool.query(
      `INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
       VALUES ($1, $2, $3, $4, 5, 0, 0, 5, 'cash', 0, 0, null, null, now(), now(), now())`,
      [randomUUID(), BUSINESS_A, BRANCH_A, 'SALE-AP']
    )

    const beforeSales = (await pool.query(`SELECT COUNT(*) FROM sales WHERE business_id = $1`, [BUSINESS_A])).rows[0].count

    await service.postPurchaseInvoice(purchaseId, BUSINESS_A)

    const afterSales = (await pool.query(`SELECT COUNT(*) FROM sales WHERE business_id = $1`, [BUSINESS_A])).rows[0].count
    expect(afterSales).toBe(beforeSales)
  })

  it('AP-API-024: no receivable mutation after invoice posting', async () => {
    const supplier = await seedSupplier(BUSINESS_A)
    const purchaseId = await seedPurchase(BUSINESS_A, supplier, BRANCH_A, 'received')

    const customerId = randomUUID()
    const saleId = randomUUID()
    await pool.query(
      `INSERT INTO customers (id, business_id, name, phone, email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now()) ON CONFLICT (id) DO NOTHING`,
      [customerId, BUSINESS_A, 'Test Customer', null, null]
    )
    await pool.query(
      `INSERT INTO sales (id, business_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, created_at, client_created_at, server_created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())`,
      [saleId, BUSINESS_A, 'SALE-AP', 100000, 0, 0, 100000, 'cash', 0, 0, null, '2026-01-01']
    )
    await pool.query(
      `INSERT INTO receivables (id, business_id, sale_id, customer_id, branch_id, amount_minor, paid_minor, outstanding_minor, date, reference, description, status, server_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), null, 'test', 'OPEN', 1)`,
      [randomUUID(), BUSINESS_A, saleId, customerId, null, 100000, 0, 100000]
    )

    const beforeAr = (await pool.query(`SELECT COUNT(*) FROM receivables WHERE business_id = $1`, [BUSINESS_A])).rows[0].count

    await service.postPurchaseInvoice(purchaseId, BUSINESS_A)

    const afterAr = (await pool.query(`SELECT COUNT(*) FROM receivables WHERE business_id = $1`, [BUSINESS_A])).rows[0].count
    expect(afterAr).toBe(beforeAr)
  })
})
