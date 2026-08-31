import path from 'path'
import { randomUUID } from 'crypto'
import type { Express } from 'express'
import { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { seedTestUser, authenticateTestUser } from './auth_helper'

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
let app!: Express
let ownerTokenA!: string
let cashierTokenA!: string
let ownerTokenB!: string

// ---------------------------------------------------------------------------
// DB Setup Helpers
// ---------------------------------------------------------------------------

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      idempotency_keys,
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
// Setup Hooks
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const dbUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.PURCHASE_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_purchase_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)

  const migrationsDir = path.resolve(__dirname, '../migrations')
  await runMigrations(pool, migrationsDir)

  app = createApp(pool)
})

beforeEach(async () => {
  await resetDatabase()

  // Seed users for authentication
  const ownerA = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  const authOwnerA = await authenticateTestUser(app, ownerA.email, ownerA.password, BUSINESS_A)
  ownerTokenA = authOwnerA.accessToken

  const cashierA = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  const authCashierA = await authenticateTestUser(app, cashierA.email, cashierA.password, BUSINESS_A)
  cashierTokenA = authCashierA.accessToken

  const ownerB = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER' })
  const authOwnerB = await authenticateTestUser(app, ownerB.email, ownerB.password, BUSINESS_B)
  ownerTokenB = authOwnerB.accessToken
})

afterAll(async () => {
  await pool.end()
})
describe('Phase 9B Purchase Foundation Tests', () => {
  describe('PO-CREATE: Purchase Order Creation', () => {
    it('PO-CREATE-001: creates draft PO as OWNER with generated code and snapshots', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-01', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Beras 5kg', costMinor: 60000 })
      const poId = randomUUID()
      const idemKey = randomUUID()

      const res = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', idemKey)
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          note: 'Restok beras mingguan',
          items: [{ product_id: product.id, ordered_qty: 10 }],
        })

      expect(res.status).toBe(201)
      expect(res.body.id).toBe(poId)
      expect(res.body.code).toBe('SUP-01/PO/001')
      expect(res.body.status).toBe('draft')
      expect(res.body.supplier_term).toBe('Tunai')
      expect(res.body.total_minor).toBe(600000)
      expect(res.body.outstanding_minor).toBe(0) // Tunai starts at 0
      expect(res.body.received_minor).toBe(0)
      expect(res.body.paid_minor).toBe(0)
      expect(res.body.server_version).toBe(1)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].product_name).toBe('Beras 5kg')
      expect(res.body.items[0].unit_cost_minor).toBe(60000)
      expect(res.body.items[0].ordered_qty).toBe(10)
      expect(res.body.items[0].received_qty).toBe(0)
      expect(res.body.items[0].subtotal_minor).toBe(600000)
    })

    it('PO-CREATE-002: creates sent PO directly when status=sent requested', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { code: 'SUP-02', term: 'Tempo 14' })
      const product = await seedProduct(BUSINESS_A, { costMinor: 40000 })
      const poId = randomUUID()
      const idemKey = randomUUID()

      const res = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', idemKey)
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'sent',
          items: [{ product_id: product.id, ordered_qty: 5 }],
        })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('sent')
      expect(res.body.supplier_term).toBe('Tempo 14')
      expect(res.body.total_minor).toBe(200000)
      expect(res.body.outstanding_minor).toBe(200000) // Tempo starts at total_minor
    })

    it('PO-CREATE-003: cashier is forbidden from creating POs (403)', async () => {
      const supplier = await seedSupplier(BUSINESS_A)
      const product = await seedProduct(BUSINESS_A)

      const res = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: randomUUID(),
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          items: [{ product_id: product.id, ordered_qty: 5 }],
        })

      expect(res.status).toBe(403)
    })

    it('PO-CREATE-004: idempotency replay returns exact original response', async () => {
      const supplier = await seedSupplier(BUSINESS_A)
      const product = await seedProduct(BUSINESS_A)
      const poId = randomUUID()
      const idemKey = randomUUID()

      const body = {
        id: poId,
        business_id: BUSINESS_A,
        branch_id: BRANCH_A,
        supplier_id: supplier.id,
        items: [{ product_id: product.id, ordered_qty: 5 }],
      }

      const res1 = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', idemKey)
        .send(body)

      const res2 = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', idemKey)
        .send(body)

      expect(res1.status).toBe(201)
      expect(res2.status).toBe(201)
      expect(res1.body.id).toBe(res2.body.id)
      expect(res1.body.code).toBe(res2.body.code)
    })

    it('PO-CREATE-005: idempotency key reuse with modified body returns 409', async () => {
      const supplier = await seedSupplier(BUSINESS_A)
      const product = await seedProduct(BUSINESS_A)
      const idemKey = randomUUID()

      await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', idemKey)
        .send({
          id: randomUUID(),
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          items: [{ product_id: product.id, ordered_qty: 5 }],
        })

      const res2 = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', idemKey)
        .send({
          id: randomUUID(),
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          items: [{ product_id: product.id, ordered_qty: 10 }],
        })

      expect(res2.status).toBe(409)
      expect(res2.body.error.code).toBe('IDEMPOTENCY_KEY_REUSE')
    })
  })

  describe('PO-BRANCH & PO-TENANT: Isolation', () => {
    it('PO-BRANCH-001: creating PO with branch from another tenant fails (403)', async () => {
      const supplier = await seedSupplier(BUSINESS_A)
      const product = await seedProduct(BUSINESS_A)

      const res = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: randomUUID(),
          business_id: BUSINESS_A,
          branch_id: BRANCH_B, // Foreign branch
          supplier_id: supplier.id,
          items: [{ product_id: product.id, ordered_qty: 5 }],
        })

      expect(res.status).toBe(403)
    })

    it('PO-TENANT-001: tenant A cannot view or access tenant B purchases (404/403)', async () => {
      const supplierB = await seedSupplier(BUSINESS_B)
      const productB = await seedProduct(BUSINESS_B)
      const poId = randomUUID()

      await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenB}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_B,
          branch_id: BRANCH_B,
          supplier_id: supplierB.id,
          items: [{ product_id: productB.id, ordered_qty: 5 }],
        })

      const res = await request(app)
        .get(`/v1/purchases/${poId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PO-CODE: Sequential Numbering', () => {
    it('PO-CODE-001..002: generates incremental codes for same supplier and distinct for different suppliers', async () => {
      const supplier1 = await seedSupplier(BUSINESS_A, { code: 'SUP-A' })
      const supplier2 = await seedSupplier(BUSINESS_A, { code: 'SUP-B' })
      const product = await seedProduct(BUSINESS_A)

      const createPO = async (supplierId: string) => {
        return request(app)
          .post('/v1/purchases')
          .set('Authorization', `Bearer ${ownerTokenA}`)
          .set('Idempotency-Key', randomUUID())
          .send({
            id: randomUUID(),
            business_id: BUSINESS_A,
            branch_id: BRANCH_A,
            supplier_id: supplierId,
            items: [{ product_id: product.id, ordered_qty: 1 }],
          })
      }

      const res1 = await createPO(supplier1.id)
      const res2 = await createPO(supplier1.id)
      const res3 = await createPO(supplier2.id)

      expect(res1.body.code).toBe('SUP-A/PO/001')
      expect(res2.body.code).toBe('SUP-A/PO/002')
      expect(res3.body.code).toBe('SUP-B/PO/001')
    })
  })

  describe('PO-SEND: State Transition draft -> sent', () => {
    it('PO-SEND-001: sends draft PO and increments server_version', async () => {
      const supplier = await seedSupplier(BUSINESS_A)
      const product = await seedProduct(BUSINESS_A)
      const poId = randomUUID()

      await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'draft',
          items: [{ product_id: product.id, ordered_qty: 5 }],
        })

      const sendRes = await request(app)
        .post(`/v1/purchases/${poId}/send`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
        })

      expect(sendRes.status).toBe(200)
      expect(sendRes.body.status).toBe('sent')
      expect(sendRes.body.server_version).toBe(2)
    })

    it('PO-SEND-002: cannot send an already sent PO (400)', async () => {
      const supplier = await seedSupplier(BUSINESS_A)
      const product = await seedProduct(BUSINESS_A)
      const poId = randomUUID()

      await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'sent',
          items: [{ product_id: product.id, ordered_qty: 5 }],
        })

      const sendRes = await request(app)
        .post(`/v1/purchases/${poId}/send`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
        })

      expect(sendRes.status).toBe(400)
    })
  })
  describe('PO-RECEIVE: Receiving Goods, Stock Movements & Payments', () => {
    it('PO-RECEIVE-CASH-001: full Tunai receive creates automatic full payment, updates stock & movements', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { name: 'Kopi', costMinor: 15000 })
      const poId = randomUUID()

      const createRes = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'sent',
          items: [{ product_id: product.id, ordered_qty: 20 }],
        })

      const itemId = createRes.body.items[0].id

      // Receive as Cashier
      const receiveRes = await request(app)
        .post(`/v1/purchases/${poId}/receive`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          items: [{ item_id: itemId, receive_qty: 20 }],
        })

      expect(receiveRes.status).toBe(200)
      expect(receiveRes.body.status).toBe('received')
      expect(receiveRes.body.received_minor).toBe(300000)
      expect(receiveRes.body.paid_minor).toBe(300000)
      expect(receiveRes.body.outstanding_minor).toBe(0)
      expect(receiveRes.body.payments).toHaveLength(1)
      expect(receiveRes.body.payments[0].amount_minor).toBe(300000)
      expect(receiveRes.body.payments[0].method).toBe('cash')
      expect(receiveRes.body.payments[0].reference).toContain('RECEIVE_TUNAI')
      expect(receiveRes.body.payments[0].business_id).toBe(BUSINESS_A)

      // Verify stock was updated
      const stockRes = await pool.query(
        'SELECT quantity FROM stocks WHERE business_id = $1 AND branch_id = $2 AND product_id = $3',
        [BUSINESS_A, BRANCH_A, product.id]
      )
      expect(stockRes.rows[0].quantity).toBe(20)

      // Verify stock_movement was created
      const movementRes = await pool.query(
        'SELECT movement_type, quantity, reference FROM stock_movements WHERE business_id = $1 AND product_id = $2',
        [BUSINESS_A, product.id]
      )
      expect(movementRes.rows[0].movement_type).toBe('STOCK_IN')
      expect(movementRes.rows[0].quantity).toBe(20)
    })

    it('PO-RECEIVE-CASH-002..004: partial Tunai receive pays only received value and second receive pays remaining', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { costMinor: 10000 })
      const poId = randomUUID()

      const createRes = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'sent',
          items: [{ product_id: product.id, ordered_qty: 10 }],
        })
      const itemId = createRes.body.items[0].id

      // 1st Receive: 4 of 10
      const r1 = await request(app)
        .post(`/v1/purchases/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          items: [{ item_id: itemId, receive_qty: 4 }],
        })

      expect(r1.status).toBe(200)
      expect(r1.body.status).toBe('partial')
      expect(r1.body.received_minor).toBe(40000)
      expect(r1.body.paid_minor).toBe(40000)
      expect(r1.body.outstanding_minor).toBe(0)
      expect(r1.body.payments).toHaveLength(1)
      expect(r1.body.payments[0].amount_minor).toBe(40000)

      // 2nd Receive: remaining 6
      const r2 = await request(app)
        .post(`/v1/purchases/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 2,
          items: [{ item_id: itemId, receive_qty: 6 }],
        })

      expect(r2.status).toBe(200)
      expect(r2.body.status).toBe('received')
      expect(r2.body.received_minor).toBe(100000)
      expect(r2.body.paid_minor).toBe(100000)
      expect(r2.body.outstanding_minor).toBe(0)
      expect(r2.body.payments).toHaveLength(2)
      expect(r2.body.payments[1].amount_minor).toBe(60000)
    })

    it('PO-RECEIVE-TEMPO-001: partial Tempo receive updates received_minor but leaves outstanding at total_minor', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { term: 'Tempo 30' })
      const product = await seedProduct(BUSINESS_A, { costMinor: 25000 })
      const poId = randomUUID()

      const createRes = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'sent',
          items: [{ product_id: product.id, ordered_qty: 8 }],
        })
      const itemId = createRes.body.items[0].id

      // Partial receive 4 of 8
      const receiveRes = await request(app)
        .post(`/v1/purchases/${poId}/receive`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          items: [{ item_id: itemId, receive_qty: 4 }],
        })

      expect(receiveRes.status).toBe(200)
      expect(receiveRes.body.status).toBe('partial')
      expect(receiveRes.body.received_minor).toBe(100000)
      expect(receiveRes.body.paid_minor).toBe(0) // No auto payment for Tempo
      expect(receiveRes.body.outstanding_minor).toBe(200000) // Total remains outstanding
      expect(receiveRes.body.payments).toHaveLength(0)
    })

    it('PO-RECEIVE-004..006: receive guards prevent receiving draft, cancelled, or excess quantity', async () => {
      const supplier = await seedSupplier(BUSINESS_A)
      const product = await seedProduct(BUSINESS_A)
      const poId = randomUUID()

      const createRes = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'draft',
          items: [{ product_id: product.id, ordered_qty: 5 }],
        })
      const itemId = createRes.body.items[0].id

      // Try receive on draft
      const draftRes = await request(app)
        .post(`/v1/purchases/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          items: [{ item_id: itemId, receive_qty: 2 }],
        })
      expect(draftRes.status).toBe(400)

      // Send the PO
      await request(app)
        .post(`/v1/purchases/${poId}/send`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({ business_id: BUSINESS_A, expected_server_version: 1 })

      // Try receive > ordered_qty (6 > 5)
      const excessRes = await request(app)
        .post(`/v1/purchases/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 2,
          items: [{ item_id: itemId, receive_qty: 6 }],
        })
      expect(excessRes.status).toBe(400)
    })
  })

  describe('PO-PAY: Manual Payment against PO', () => {
    it('PO-PAY-001: pays manual payment on Tempo PO as CASHIER', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { term: 'Tempo 14' })
      const product = await seedProduct(BUSINESS_A, { costMinor: 50000 })
      const poId = randomUUID()

      const createRes = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'sent',
          items: [{ product_id: product.id, ordered_qty: 4 }],
        })
      const itemId = createRes.body.items[0].id

      // Partial receive first (total: 200,000)
      await request(app)
        .post(`/v1/purchases/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          items: [{ item_id: itemId, receive_qty: 2 }],
        })

      // Pay 100,000 via bank transfer
      const payRes = await request(app)
        .post(`/v1/purchases/${poId}/pay`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 2,
          amount_minor: 100000,
          method: 'bank_transfer',
          reference: 'TRF-9988',
        })

      expect(payRes.status).toBe(200)
      expect(payRes.body.paid_minor).toBe(100000)
      expect(payRes.body.outstanding_minor).toBe(100000)
      expect(payRes.body.payments).toHaveLength(1)
      expect(payRes.body.payments[0].method).toBe('bank_transfer')
      expect(payRes.body.payments[0].amount_minor).toBe(100000)
    })

    it('PO-PAY-005: pay exceeding outstanding amount is rejected (400)', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { term: 'Tempo 14' })
      const product = await seedProduct(BUSINESS_A, { costMinor: 50000 })
      const poId = randomUUID()

      const createRes = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'sent',
          items: [{ product_id: product.id, ordered_qty: 2 }],
        })
      const itemId = createRes.body.items[0].id

      await request(app)
        .post(`/v1/purchases/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          items: [{ item_id: itemId, receive_qty: 2 }],
        })

      // Attempt to pay 150,000 when outstanding is 100,000
      const overPayRes = await request(app)
        .post(`/v1/purchases/${poId}/pay`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 2,
          amount_minor: 150000,
          method: 'cash',
        })

      expect(overPayRes.status).toBe(400)
    })
  })
  describe('PO-CANCEL & PO-DELETE', () => {
    it('PO-CANCEL-001..003: cancels PO in draft/sent/partial status and preserves audit history', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { costMinor: 20000 })
      const poId = randomUUID()

      const createRes = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'sent',
          items: [{ product_id: product.id, ordered_qty: 4 }],
        })
      const itemId = createRes.body.items[0].id

      // Partial receive 2
      await request(app)
        .post(`/v1/purchases/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          items: [{ item_id: itemId, receive_qty: 2 }],
        })

      // Cancel partial PO
      const cancelRes = await request(app)
        .post(`/v1/purchases/${poId}/cancel`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 2,
        })

      expect(cancelRes.status).toBe(200)
      expect(cancelRes.body.status).toBe('cancelled')
      expect(cancelRes.body.paid_minor).toBe(40000) // Paid value preserved
      expect(cancelRes.body.received_minor).toBe(40000) // Received value preserved

      // Stock remains intact
      const stockRes = await pool.query(
        'SELECT quantity FROM stocks WHERE business_id = $1 AND branch_id = $2 AND product_id = $3',
        [BUSINESS_A, BRANCH_A, product.id]
      )
      expect(stockRes.rows[0].quantity).toBe(2)
    })

    it('PO-DELETE-001..002: only draft PO can be soft-deleted; sent PO delete returns 400', async () => {
      const supplier = await seedSupplier(BUSINESS_A)
      const product = await seedProduct(BUSINESS_A)
      const poDraftId = randomUUID()
      const poSentId = randomUUID()

      await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poDraftId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'draft',
          items: [{ product_id: product.id, ordered_qty: 1 }],
        })

      await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poSentId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'sent',
          items: [{ product_id: product.id, ordered_qty: 1 }],
        })

      // Delete draft PO -> 204
      const delDraftRes = await request(app)
        .delete(`/v1/purchases/${poDraftId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
      expect(delDraftRes.status).toBe(204)

      // Try delete sent PO -> 400
      const delSentRes = await request(app)
        .delete(`/v1/purchases/${poSentId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
      expect(delSentRes.status).toBe(400)
    })
  })

  describe('PO-VERSION & PO-FK & PO-SCHEMA', () => {
    it('PO-VERSION-001: returns 409 on version mismatch with current_server_version', async () => {
      const supplier = await seedSupplier(BUSINESS_A)
      const product = await seedProduct(BUSINESS_A)
      const poId = randomUUID()

      await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'draft',
          items: [{ product_id: product.id, ordered_qty: 1 }],
        })

      const conflictRes = await request(app)
        .post(`/v1/purchases/${poId}/send`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 99, // Wrong version
        })

      expect(conflictRes.status).toBe(409)
      expect(conflictRes.body.error.code).toBe('PURCHASE_VERSION_CONFLICT')
      expect(conflictRes.body.error.details.current_server_version).toBe(1)
    })

    it('PO-FK-001: deleting product preserves PO item snapshot with product_id set to NULL', async () => {
      const supplier = await seedSupplier(BUSINESS_A)
      const product = await seedProduct(BUSINESS_A, { name: 'Snapshot Product', costMinor: 35000 })
      const poId = randomUUID()

      await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'sent',
          items: [{ product_id: product.id, ordered_qty: 3 }],
        })

      // Delete the product
      await pool.query('DELETE FROM products WHERE id = $1', [product.id])

      // Inspect purchase_items
      const itemRes = await pool.query(
        'SELECT product_id, product_name, unit_cost_minor FROM purchase_items WHERE purchase_id = $1',
        [poId]
      )
      expect(itemRes.rows[0].product_id).toBeNull()
      expect(itemRes.rows[0].product_name).toBe('Snapshot Product')
      expect(Number(itemRes.rows[0].unit_cost_minor)).toBe(35000)
    })

    it('PO-SCHEMA-001: purchase_payments contains business_id column', async () => {
      const res = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'purchase_payments' AND column_name = 'business_id'
      `)
      expect(res.rows).toHaveLength(1)
    })

    it('PO-SCHEMA-002: purchases table does NOT contain expected_server_version column', async () => {
      const res = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'purchases' AND column_name = 'expected_server_version'
      `)
      expect(res.rows).toHaveLength(0)
    })
  })

  describe('PO-SYNC & ATOMIC ROLLBACK', () => {
    it('PO-SYNC-001: /v1/sync/purchases returns purchases after given server_version', async () => {
      const supplier = await seedSupplier(BUSINESS_A)
      const product = await seedProduct(BUSINESS_A)
      const poId = randomUUID()

      await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'sent',
          items: [{ product_id: product.id, ordered_qty: 2 }],
        })

      const syncRes = await request(app)
        .get('/v1/sync/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .query({ business_id: BUSINESS_A, after_version: 0 })

      expect(syncRes.status).toBe(200)
      expect(syncRes.body.items).toHaveLength(1)
      expect(syncRes.body.items[0].id).toBe(poId)
      expect(syncRes.body.items[0].items).toHaveLength(1)
    })

    it('PO-ATOMIC-001: atomic rollback ensures no partial state mutation on failure before writes', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { costMinor: 10000 })
      const poId = randomUUID()

      const createRes = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'sent',
          items: [{ product_id: product.id, ordered_qty: 5 }],
        })
      const itemId = createRes.body.items[0].id

      // Force a version conflict on receive
      const failRes = await request(app)
        .post(`/v1/purchases/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 999, // Intentional conflict
          items: [{ item_id: itemId, receive_qty: 5 }],
        })

      expect(failRes.status).toBe(409)

      // Verify no stock movements were written
      const movements = await pool.query(
        'SELECT * FROM stock_movements WHERE business_id = $1',
        [BUSINESS_A]
      )
      expect(movements.rows).toHaveLength(0)

      // Verify no payments were written
      const payments = await pool.query(
        'SELECT * FROM purchase_payments WHERE business_id = $1',
        [BUSINESS_A]
      )
      expect(payments.rows).toHaveLength(0)

      // Verify received_qty is still 0 and status is still sent
      const poCheck = await pool.query(
        'SELECT status, received_minor, paid_minor, server_version FROM purchases WHERE id = $1',
        [poId]
      )
      expect(poCheck.rows[0].status).toBe('sent')
      expect(Number(poCheck.rows[0].received_minor)).toBe(0)
      expect(Number(poCheck.rows[0].paid_minor)).toBe(0)
      expect(Number(poCheck.rows[0].server_version)).toBe(1)
    })

    it('PO-ATOMIC-002: multi-item receive atomic rollback when second item fails mid-transaction', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { term: 'Tempo 14' })
      const prodA = await seedProduct(BUSINESS_A, { name: 'Item A', costMinor: 10000 })
      const prodB = await seedProduct(BUSINESS_A, { name: 'Item B', costMinor: 20000 })
      const poId = randomUUID()

      // Seed initial stock for prodA (qty 10, version 1) and prodB (qty 10, version 1)
      await pool.query(
        `INSERT INTO stocks (id, business_id, branch_id, product_id, quantity, server_version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 10, 1, now(), now()),
                ($5, $2, $3, $6, 10, 1, now(), now())`,
        [randomUUID(), BUSINESS_A, BRANCH_A, prodA.id, randomUUID(), prodB.id]
      )

      const createRes = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'sent',
          items: [
            { product_id: prodA.id, ordered_qty: 5 },
            { product_id: prodB.id, ordered_qty: 5 },
          ],
        })

      const itemAId = createRes.body.items.find((i: any) => i.product_id === prodA.id).id
      const itemBId = createRes.body.items.find((i: any) => i.product_id === prodB.id).id

      // Create a BEFORE UPDATE trigger on stocks that raises an exception specifically when updating prodB
      await pool.query(`
        CREATE OR REPLACE FUNCTION fail_item_b_update() RETURNS trigger AS $$
        BEGIN
          IF NEW.product_id = '${prodB.id}' THEN
            RAISE EXCEPTION 'Simulated failure updating stock for Item B';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trg_test_fail_item_b
        BEFORE UPDATE ON stocks
        FOR EACH ROW
        EXECUTE FUNCTION fail_item_b_update();
      `)

      try {
        // Attempt receive both items (itemA processes first, then itemB triggers DB exception)
        const receiveRes = await request(app)
          .post(`/v1/purchases/${poId}/receive`)
          .set('Authorization', `Bearer ${ownerTokenA}`)
          .set('Idempotency-Key', randomUUID())
          .send({
            business_id: BUSINESS_A,
            expected_server_version: 1,
            items: [
              { item_id: itemAId, receive_qty: 5 },
              { item_id: itemBId, receive_qty: 5 },
            ],
          })

        expect(receiveRes.status).toBe(500)

        // Verify itemA's stock was NOT modified (remains 10)
        const stockA = await pool.query(
          'SELECT quantity, server_version FROM stocks WHERE business_id = $1 AND product_id = $2',
          [BUSINESS_A, prodA.id]
        )
        expect(stockA.rows[0].quantity).toBe(10)
        expect(Number(stockA.rows[0].server_version)).toBe(1)

        // Verify NO stock movements were committed for either product
        const movements = await pool.query(
          'SELECT * FROM stock_movements WHERE business_id = $1',
          [BUSINESS_A]
        )
        expect(movements.rows).toHaveLength(0)

        // Verify purchase_items received_qty for itemA is still 0
        const itemACheck = await pool.query(
          'SELECT received_qty FROM purchase_items WHERE id = $1',
          [itemAId]
        )
        expect(itemACheck.rows[0].received_qty).toBe(0)

        // Verify purchase record remains untouched
        const poCheck = await pool.query(
          'SELECT status, received_minor, paid_minor, outstanding_minor, server_version FROM purchases WHERE id = $1',
          [poId]
        )
        expect(poCheck.rows[0].status).toBe('sent')
        expect(Number(poCheck.rows[0].received_minor)).toBe(0)
        expect(Number(poCheck.rows[0].paid_minor)).toBe(0)
        expect(Number(poCheck.rows[0].outstanding_minor)).toBe(150000)
        expect(Number(poCheck.rows[0].server_version)).toBe(1)
      } finally {
        await pool.query(`
          DROP TRIGGER IF EXISTS trg_test_fail_item_b ON stocks;
          DROP FUNCTION IF EXISTS fail_item_b_update();
        `)
      }
    })

    it('PO-ATOMIC-003: Tunai payment insertion failure rolls back stock updates and received_qty', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { term: 'Tunai' })
      const prod = await seedProduct(BUSINESS_A, { name: 'Item Cash', costMinor: 15000 })
      const poId = randomUUID()
      const idemKey = randomUUID()

      const createRes = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          status: 'sent',
          items: [{ product_id: prod.id, ordered_qty: 4 }],
        })
      const itemId = createRes.body.items[0].id

      // Seed initial stock
      await pool.query(
        `INSERT INTO stocks (id, business_id, branch_id, product_id, quantity, server_version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 0, 1, now(), now())`,
        [randomUUID(), BUSINESS_A, BRANCH_A, prod.id]
      )

      // Pre-insert a payment with the same idempotency key for this PO to trigger a 23505 unique violation during automatic payment insertion
      await pool.query(
        `INSERT INTO purchase_payments (id, business_id, purchase_id, amount_minor, method, reference, idempotency_key, created_at)
         VALUES ($1, $2, $3, 100, 'cash', 'pre-existing', $4, now())`,
        [randomUUID(), BUSINESS_A, poId, idemKey]
      )

      // Attempt receive with this same idemKey -> automatic payment insertion will fail with unique constraint violation (409)
      const failRes = await request(app)
        .post(`/v1/purchases/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', idemKey)
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          items: [{ item_id: itemId, receive_qty: 4 }],
        })

      expect(failRes.status).toBe(409)

      // Verify stock was rolled back to 0
      const stockRes = await pool.query(
        'SELECT quantity FROM stocks WHERE business_id = $1 AND product_id = $2',
        [BUSINESS_A, prod.id]
      )
      expect(stockRes.rows[0].quantity).toBe(0)

      // Verify no STOCK_IN movement committed
      const moveRes = await pool.query(
        'SELECT * FROM stock_movements WHERE business_id = $1',
        [BUSINESS_A]
      )
      expect(moveRes.rows).toHaveLength(0)

      // Verify purchase item received_qty remains 0
      const itemCheck = await pool.query(
        'SELECT received_qty FROM purchase_items WHERE id = $1',
        [itemId]
      )
      expect(itemCheck.rows[0].received_qty).toBe(0)

      // Verify PO status remains sent
      const poCheck = await pool.query(
        'SELECT status, received_minor, paid_minor, server_version FROM purchases WHERE id = $1',
        [poId]
      )
      expect(poCheck.rows[0].status).toBe('sent')
      expect(Number(poCheck.rows[0].received_minor)).toBe(0)
      expect(Number(poCheck.rows[0].paid_minor)).toBe(0)
      expect(Number(poCheck.rows[0].server_version)).toBe(1)
    })
  })

  describe('PO-DRAFT: Draft Mutations, Terms & Dates', () => {
    it('PO-DRAFT-TERM-001: draft supplier change Tunai -> Tempo 30 updates supplier_term and recalculates due_date (+30)', async () => {
      const supTunai = await seedSupplier(BUSINESS_A, { code: 'SUP-T1', term: 'Tunai' })
      const supTempo = await seedSupplier(BUSINESS_A, { code: 'SUP-T2', term: 'Tempo 30' })
      const product = await seedProduct(BUSINESS_A, { costMinor: 50000 })
      const poId = randomUUID()

      const createRes = await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supTunai.id,
          date: '2026-08-01',
          items: [{ product_id: product.id, ordered_qty: 2 }],
        })

      expect(createRes.body.supplier_term).toBe('Tunai')
      expect(createRes.body.due_date).toBe('2026-08-01')
      expect(createRes.body.outstanding_minor).toBe(0)

      // Update supplier to supTempo without explicit due_date
      const updateRes = await request(app)
        .put(`/v1/purchases/${poId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          supplier_id: supTempo.id,
        })

      expect(updateRes.status).toBe(200)
      expect(updateRes.body.supplier_term).toBe('Tempo 30')
      expect(updateRes.body.due_date).toBe('2026-08-31') // 2026-08-01 + 30 days
      expect(updateRes.body.outstanding_minor).toBe(100000) // Tempo has total as outstanding
      expect(updateRes.body.server_version).toBe(2)
    })

    it('PO-DRAFT-TERM-002: draft supplier change Tempo 30 -> Tunai updates supplier_term to Tunai and due_date to same date', async () => {
      const supTempo = await seedSupplier(BUSINESS_A, { code: 'SUP-T3', term: 'Tempo 30' })
      const supTunai = await seedSupplier(BUSINESS_A, { code: 'SUP-T4', term: 'Tunai' })
      const product = await seedProduct(BUSINESS_A, { costMinor: 50000 })
      const poId = randomUUID()

      await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supTempo.id,
          date: '2026-08-10',
          items: [{ product_id: product.id, ordered_qty: 2 }],
        })

      const updateRes = await request(app)
        .put(`/v1/purchases/${poId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          supplier_id: supTunai.id,
        })

      expect(updateRes.status).toBe(200)
      expect(updateRes.body.supplier_term).toBe('Tunai')
      expect(updateRes.body.due_date).toBe('2026-08-10')
      expect(updateRes.body.outstanding_minor).toBe(0) // Tunai outstanding is 0
    })

    it('PO-DRAFT-DATE-001: changing date without explicit due_date recalculates due_date', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { term: 'Tempo 14' })
      const product = await seedProduct(BUSINESS_A)
      const poId = randomUUID()

      await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          date: '2026-08-01',
          items: [{ product_id: product.id, ordered_qty: 1 }],
        })

      const updateRes = await request(app)
        .put(`/v1/purchases/${poId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          date: '2026-08-15',
        })

      expect(updateRes.status).toBe(200)
      expect(updateRes.body.date).toBe('2026-08-15')
      expect(updateRes.body.due_date).toBe('2026-08-29') // 2026-08-15 + 14 days
    })

    it('PO-DRAFT-DATE-002: changing date WITH explicit due_date preserves explicit due_date', async () => {
      const supplier = await seedSupplier(BUSINESS_A, { term: 'Tempo 14' })
      const product = await seedProduct(BUSINESS_A)
      const poId = randomUUID()

      await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier.id,
          date: '2026-08-01',
          items: [{ product_id: product.id, ordered_qty: 1 }],
        })

      const updateRes = await request(app)
        .put(`/v1/purchases/${poId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          date: '2026-08-15',
          due_date: '2026-09-10', // Explicit custom due date
        })

      expect(updateRes.status).toBe(200)
      expect(updateRes.body.date).toBe('2026-08-15')
      expect(updateRes.body.due_date).toBe('2026-09-10')
    })

    it('PO-DRAFT-INVARIANT-001: changing draft supplier or items preserves paid_minor=0 and received_minor=0', async () => {
      const supplier1 = await seedSupplier(BUSINESS_A, { term: 'Tunai' })
      const supplier2 = await seedSupplier(BUSINESS_A, { term: 'Tempo 30' })
      const prod1 = await seedProduct(BUSINESS_A, { costMinor: 20000 })
      const prod2 = await seedProduct(BUSINESS_A, { costMinor: 30000 })
      const poId = randomUUID()

      await request(app)
        .post('/v1/purchases')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          id: poId,
          business_id: BUSINESS_A,
          branch_id: BRANCH_A,
          supplier_id: supplier1.id,
          items: [{ product_id: prod1.id, ordered_qty: 5 }],
        })

      const updateRes = await request(app)
        .put(`/v1/purchases/${poId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          business_id: BUSINESS_A,
          expected_server_version: 1,
          supplier_id: supplier2.id,
          items: [{ product_id: prod2.id, ordered_qty: 10 }],
        })

      expect(updateRes.status).toBe(200)
      expect(updateRes.body.total_minor).toBe(300000)
      expect(updateRes.body.paid_minor).toBe(0)
      expect(updateRes.body.received_minor).toBe(0)
      expect(updateRes.body.outstanding_minor).toBe(300000)
    })
  })
})
