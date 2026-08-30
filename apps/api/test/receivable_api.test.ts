import path from 'path'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { Pool, PoolClient } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { seedTestUser, authenticateTestUser } from './auth_helper'
import { accountRepository } from '../src/repositories/account_repository'
import { journalRepository } from '../src/repositories/journal_repository'
import { receivableRepository } from '../src/repositories/receivable_repository'
import { customerPaymentRepository } from '../src/repositories/customer_payment_repository'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'
const BRANCH_B = '22222222-2222-4222-8222-222222222222'

let pool!: Pool
let client!: PoolClient
let app!: ReturnType<typeof createApp>
let ownerTokenA!: string
let ownerTokenB!: string
let cashierTokenA!: string

let customerIdA!: string

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE
      journal_lines,
      journal_entries,
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
    `INSERT INTO businesses (id, name) VALUES ($1, 'Business A'), ($2, 'Business B') ON CONFLICT (id) DO NOTHING`,
    [BUSINESS_A, BUSINESS_B]
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

  customerIdA = randomUUID()
  await pool.query(
    `INSERT INTO customers (id, business_id, name) VALUES ($1, $2, 'AR API Customer') ON CONFLICT (id) DO NOTHING`,
    [customerIdA, BUSINESS_A]
  )
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

async function createCreditSale(
  overrides: {
    total_minor?: number
    paid_minor?: number
    customer_id?: string | null
    payment_method?: string
    receipt_number?: string
  } = {}
): Promise<string> {
  const saleId = randomUUID()
  const cid = 'customer_id' in overrides ? (overrides.customer_id ?? null) : customerIdA
  await pool.query(
    `INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      saleId,
      BUSINESS_A,
      BRANCH_A,
      overrides.receipt_number ?? `SALE-${saleId.slice(0, 8)}`,
      overrides.total_minor ?? 100000,
      0,
      0,
      overrides.total_minor ?? 100000,
      overrides.payment_method ?? 'cash',
      overrides.paid_minor ?? 0,
      0,
      null,
      cid,
      '2026-01-01',
      '2026-01-01',
      '2026-01-01',
    ]
  )
  return saleId
}

async function createAndPostCreditSale(
  overrides?: {
    total_minor?: number
    paid_minor?: number
    payment_method?: string
  }
): Promise<{ saleId: string; receivableId: string }> {
  const saleId = await createCreditSale({
    total_minor: overrides?.total_minor ?? 100000,
    paid_minor: overrides?.paid_minor ?? 30000,
    customer_id: customerIdA,
    payment_method: overrides?.payment_method ?? 'cash',
  })

  const res = await request(app)
    .post('/v1/finance/postings/sale')
    .set('Authorization', `Bearer ${ownerTokenA}`)
    .send({ sale_id: saleId })
    .expect(201)

  expect(res.body.receivableId).toBeDefined()
  return { saleId, receivableId: res.body.receivableId }
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
  client = await pool.connect()
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
  client.release()
  await pool.end()
})

describe('9C.6G AR API Endpoints', () => {
  describe('AR-API-001: GET /v1/receivables lists receivables', () => {
    it('AR-API-001: lists receivables for business', async () => {
      await createAndPostCreditSale()
      await createAndPostCreditSale()

      const res = await request(app)
        .get('/v1/receivables')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)

      expect(res.body.total).toBe(2)
      expect(res.body.rows.length).toBe(2)
    })
  })

  describe('AR-API-002: GET /v1/receivables is scoped to tenant', () => {
    it('AR-API-002: business B cannot see business A receivables', async () => {
      await createAndPostCreditSale()

      const res = await request(app)
        .get('/v1/receivables')
        .set('Authorization', `Bearer ${ownerTokenB}`)
        .expect(200)

      expect(res.body.total).toBe(0)
      expect(res.body.rows.length).toBe(0)
    })
  })

  describe('AR-API-003: GET /v1/receivables/:id returns receivable', () => {
    it('AR-API-003: returns receivable by id', async () => {
      const { receivableId } = await createAndPostCreditSale()

      const res = await request(app)
        .get(`/v1/receivables/${receivableId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)

      expect(res.body.id).toBe(receivableId)
      expect(res.body.status).toBe('OPEN')
      expect(res.body.outstanding_minor).toBe(70000)
    })
  })

  describe('AR-API-004: GET /v1/receivables/:id 404 for not found', () => {
    it('AR-API-004: returns 404 for nonexistent receivable', async () => {
      await request(app)
        .get(`/v1/receivables/${randomUUID()}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(404)
    })
  })

  describe('AR-API-005: GET /v1/receivables/:id invalid UUID', () => {
    it('AR-API-005: returns 400 for invalid UUID', async () => {
      await request(app)
        .get('/v1/receivables/not-a-uuid')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(400)
    })
  })

  describe('AR-API-006: GET /v1/receivables/sale/:saleId returns receivable', () => {
    it('AR-API-006: returns receivable by sale_id', async () => {
      const { saleId, receivableId } = await createAndPostCreditSale()

      const res = await request(app)
        .get(`/v1/receivables/sale/${saleId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)

      expect(res.body.id).toBe(receivableId)
    })
  })

  describe('AR-API-007: GET /v1/receivables/sale/:saleId 404 when no receivable', () => {
    it('AR-API-007: returns 404 for sale without receivable', async () => {
      const saleId = await createCreditSale({ paid_minor: 100000, total_minor: 100000 })

      await request(app)
        .get(`/v1/receivables/sale/${saleId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(404)
    })
  })

  describe('AR-API-008: GET /v1/receivables/:id/payments lists payments', () => {
    it('AR-API-008: lists customer payments for a receivable', async () => {
      const { receivableId } = await createAndPostCreditSale()

      await request(app)
        .post(`/v1/receivables/${receivableId}/collections`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          amount_minor: 30000,
          method: 'cash',
          customer_id: customerIdA,
        })
        .expect(201)

      const res = await request(app)
        .get(`/v1/receivables/${receivableId}/payments`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)

      expect(res.body.total).toBe(1)
      expect(res.body.rows.length).toBe(1)
      expect(res.body.rows[0].amount_minor).toBe(30000)
    })
  })

  describe('AR-API-009: GET /v1/receivables/:id/payments 400 invalid UUID', () => {
    it('AR-API-009: returns 400 for invalid UUID', async () => {
      await request(app)
        .get('/v1/receivables/not-a-uuid/payments')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(400)
    })
  })

  describe('AR-API-010: POST /v1/receivables/postings/receivable posts receivable', () => {
    it('AR-API-010: posts receivable journal', async () => {
      const { receivableId } = await createAndPostCreditSale()

      const res = await request(app)
        .post('/v1/receivables/postings/receivable')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ receivable_id: receivableId })
        .expect(201)

      expect(res.body.journalId).toBeDefined()

      const journal = await pool.query(
        `SELECT source_type, status FROM journal_entries WHERE id = $1`,
        [res.body.journalId]
      )
      expect(journal.rows[0].source_type).toBe('RECEIVABLE')
      expect(journal.rows[0].status).toBe('posted')
    })
  })

  describe('AR-API-011: POST /v1/receivables/postings/receivable idempotency', () => {
    it('AR-API-011: replaying returns same journal', async () => {
      const { receivableId } = await createAndPostCreditSale()

      const res1 = await request(app)
        .post('/v1/receivables/postings/receivable')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ receivable_id: receivableId })
        .expect(201)

      const res2 = await request(app)
        .post('/v1/receivables/postings/receivable')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ receivable_id: receivableId })
        .expect(201)

      expect(res1.body.journalId).toBe(res2.body.journalId)
    })
  })

  describe('AR-API-012: POST /v1/receivables/postings/receivable invalid UUID', () => {
    it('AR-API-012: returns 400 for invalid UUID', async () => {
      await request(app)
        .post('/v1/receivables/postings/receivable')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ receivable_id: 'not-a-uuid' })
        .expect(400)
    })
  })

  describe('AR-API-013: POST /v1/receivables/postings/receivable 404 not found', () => {
    it('AR-API-013: returns 404 for nonexistent receivable', async () => {
      await request(app)
        .post('/v1/receivables/postings/receivable')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ receivable_id: randomUUID() })
        .expect(404)
    })
  })

  describe('AR-API-014: POST /v1/receivables/postings/receivable cashier forbidden', () => {
    it('AR-API-014: CASHIER cannot post receivable', async () => {
      const { receivableId } = await createAndPostCreditSale()

      await request(app)
        .post('/v1/receivables/postings/receivable')
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({ receivable_id: receivableId })
        .expect(403)
    })
  })

  describe('AR-API-015: POST /v1/receivables/:id/collections collects payment', () => {
    it('AR-API-015: collects partial payment and updates receivable', async () => {
      const { receivableId } = await createAndPostCreditSale()

      const res = await request(app)
        .post(`/v1/receivables/${receivableId}/collections`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          amount_minor: 70000,
          method: 'cash',
          customer_id: customerIdA,
        })
        .expect(201)

      expect(res.body.paymentId).toBeDefined()
      expect(res.body.journalId).toBeDefined()
      expect(res.body.newStatus).toBe('PAID')

      const receivable = await pool.query(
        `SELECT paid_minor, outstanding_minor, status FROM receivables WHERE id = $1`,
        [receivableId]
      )
      expect(receivable.rows[0].paid_minor).toBe(70000)
      expect(receivable.rows[0].outstanding_minor).toBe(0)
      expect(receivable.rows[0].status).toBe('PAID')
    })
  })

  describe('AR-API-016: POST /v1/receivables/:id/collections PARTIAL status', () => {
    it('AR-API-016: partial payment sets PARTIAL status', async () => {
      const { receivableId } = await createAndPostCreditSale()

      const res = await request(app)
        .post(`/v1/receivables/${receivableId}/collections`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          amount_minor: 30000,
          method: 'cash',
          customer_id: customerIdA,
        })
        .expect(201)

      expect(res.body.newStatus).toBe('PARTIAL')
    })
  })

  describe('AR-API-017: POST /v1/receivables/:id/collections invalid UUID', () => {
    it('AR-API-017: returns 400 for invalid UUID', async () => {
      await request(app)
        .post('/v1/receivables/not-a-uuid/collections')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ amount_minor: 1000, method: 'cash', customer_id: customerIdA })
        .expect(400)
    })
  })

  describe('AR-API-018: POST /v1/receivables/:id/collections overpayment', () => {
    it('AR-API-018: returns 400 for overpayment', async () => {
      const { receivableId } = await createAndPostCreditSale()

      await request(app)
        .post(`/v1/receivables/${receivableId}/collections`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          amount_minor: 100000,
          method: 'cash',
          customer_id: customerIdA,
        })
        .expect(400)
    })
  })

  describe('AR-API-019: POST /v1/receivables/:id/collections unsupported method', () => {
    it('AR-API-019: returns 400 for unsupported method', async () => {
      const { receivableId } = await createAndPostCreditSale()

      await request(app)
        .post(`/v1/receivables/${receivableId}/collections`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          amount_minor: 10000,
          method: 'crypto',
          customer_id: customerIdA,
        })
        .expect(400)
    })
  })

  describe('AR-API-020: POST /v1/receivables/:id/collections cashier forbidden', () => {
    it('AR-API-020: CASHIER cannot collect payment', async () => {
      const { receivableId } = await createAndPostCreditSale()

      await request(app)
        .post(`/v1/receivables/${receivableId}/collections`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({
          amount_minor: 30000,
          method: 'cash',
          customer_id: customerIdA,
        })
        .expect(403)
    })
  })

  describe('AR-API-021: POST /v1/receivables/payments/:paymentId/reversals reverses payment', () => {
    it('AR-API-021: reverses a customer payment', async () => {
      const { receivableId } = await createAndPostCreditSale()

      const payRes = await request(app)
        .post(`/v1/receivables/${receivableId}/collections`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          amount_minor: 70000,
          method: 'cash',
          customer_id: customerIdA,
        })
        .expect(201)

      const reversalRes = await request(app)
        .post(`/v1/receivables/payments/${payRes.body.paymentId}/reversals`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(201)

      expect(reversalRes.body.reversalId).toBeDefined()

      const paymentJournal = await pool.query(
        `SELECT status FROM journal_entries WHERE source_type = 'CUSTOMER_PAYMENT' AND source_id = $1`,
        [payRes.body.paymentId]
      )
      expect(paymentJournal.rows[0].status).toBe('reversed')

      const receivable = await pool.query(
        `SELECT status, paid_minor FROM receivables WHERE id = $1`,
        [receivableId]
      )
      expect(receivable.rows[0].status).toBe('OPEN')
      expect(Number(receivable.rows[0].paid_minor)).toBe(0)
    })
  })

  describe('AR-API-022: POST /v1/receivables/:id/reversals credit_sale reverses', () => {
    it('AR-API-022: reverses credit sale and receivable', async () => {
      const { receivableId, saleId } = await createAndPostCreditSale()

       const res = await request(app)
        .post(`/v1/receivables/${receivableId}/reversals`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ type: 'credit_sale', sale_id: saleId })
        .expect(201)

      expect(res.body.reversalIds).toHaveLength(2)

      const receivable = await pool.query(
        `SELECT status FROM receivables WHERE id = $1`,
        [receivableId]
      )
      expect(receivable.rows[0].status).toBe('REVERSED')

      const receivableJournal = await pool.query(
        `SELECT status FROM journal_entries WHERE business_id = $1 AND source_type = 'RECEIVABLE' AND source_id = $2`,
        [BUSINESS_A, receivableId]
      )
      expect(receivableJournal.rows[0].status).toBe('reversed')

      const saleJournal = await pool.query(
        `SELECT status FROM journal_entries WHERE business_id = $1 AND source_type = 'SALE' AND source_id = $2`,
        [BUSINESS_A, saleId]
      )
      expect(saleJournal.rows[0].status).toBe('reversed')
    })
  })

  describe('AR-API-023: POST /v1/receivables/:id/reversals fails with active payments', () => {
    it('AR-API-023: cannot reverse credit sale with active customer payments', async () => {
      const { receivableId, saleId } = await createAndPostCreditSale()

      await request(app)
        .post(`/v1/receivables/${receivableId}/collections`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          amount_minor: 70000,
          method: 'cash',
          customer_id: customerIdA,
        })
        .expect(201)

      await request(app)
        .post(`/v1/receivables/${receivableId}/reversals`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ type: 'credit_sale', sale_id: saleId })
        .expect(409)
    })
  })

  describe('AR-API-024: GET /v1/receivables/:id payments with bank method', () => {
    it('AR-API-024: collects payment via bank_transfer', async () => {
      const { receivableId } = await createAndPostCreditSale()

      const res = await request(app)
        .post(`/v1/receivables/${receivableId}/collections`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          amount_minor: 50000,
          method: 'bank_transfer',
          customer_id: customerIdA,
        })
        .expect(201)

      expect(res.body.newStatus).toBe('PARTIAL')

      const payment = await pool.query(
        `SELECT method FROM customer_payments WHERE id = $1`,
        [res.body.paymentId]
      )
      expect(payment.rows[0].method).toBe('bank_transfer')
    })
  })

  describe('AR-API-025: GET /v1/receivables filter by status', () => {
    it('AR-API-025: filters receivables by status=PAID', async () => {
      const { receivableId: r1 } = await createAndPostCreditSale()
      const { receivableId: r2 } = await createAndPostCreditSale()

      await request(app)
        .post(`/v1/receivables/${r1}/collections`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          amount_minor: 70000,
          method: 'cash',
          customer_id: customerIdA,
        })
        .expect(201)

      const res = await request(app)
        .get('/v1/receivables')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .query({ status: 'PAID' })
        .expect(200)

      expect(res.body.total).toBe(1)
      expect(res.body.rows.length).toBe(1)
      expect(res.body.rows[0].id).toBe(r1)
    })
  })
})
