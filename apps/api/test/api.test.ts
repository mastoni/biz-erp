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

const BUSINESS_A = '11111111-1111-4111-8111-111111111111'
const BUSINESS_B = '22222222-2222-4222-8222-222222222222'
const BRANCH_A = '11111111-1111-4111-8111-111111111112'
const BRANCH_B = '22222222-2222-4222-8222-222222222223'

let pool!: Pool
let app!: Express
let tokenA!: string
let tokenB!: string

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      stock_movements,
      stocks,
      branches,
      sale_items,
      sales,
      idempotency_keys,
      products,
      businesses
    RESTART IDENTITY CASCADE
  `)

  await pool.query(
    `
      INSERT INTO businesses (id, name)
      VALUES ($1, $2), ($3, $4)
      ON CONFLICT (id) DO NOTHING
    `,
    [BUSINESS_A, 'Business A', BUSINESS_B, 'Business B']
  )

  await pool.query(
    `
      INSERT INTO branches (id, business_id, name)
      VALUES ($1, $2, 'Main Branch A'), ($3, $4, 'Main Branch B')
      ON CONFLICT (id) DO NOTHING
    `,
    [BRANCH_A, BUSINESS_A, BRANCH_B, BUSINESS_B]
  )
}

async function seedProduct(
  businessId: string,
  options: {
    name?: string
    barcode?: string | null
    priceMinor?: number
    serverVersion?: number
    branchId?: string
    stockQuantity?: number
  } = {}
): Promise<string> {
  const id = randomUUID()

  await pool.query(
    `
      INSERT INTO products (
        id,
        business_id,
        name,
        description,
        price_minor,
        category,
        barcode,
        is_active,
        server_version,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, now(), now())
    `,
    [id, businessId, options.name ?? `Product ${id.slice(0, 8)}`, null, options.priceMinor ?? 10000, null, options.barcode ?? null, options.serverVersion ?? 1]
  )

  const branchId = options.branchId ?? (businessId === BUSINESS_A ? BRANCH_A : BRANCH_B)
  const stockQuantity = options.stockQuantity ?? 100
  await pool.query(
    `
      INSERT INTO stocks (id, business_id, branch_id, product_id, quantity, server_version, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 1, now(), now())
      ON CONFLICT (business_id, branch_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity
    `,
    [randomUUID(), businessId, branchId, id, stockQuantity]
  )

  return id
}

function makeSaleBatch(productId: string | null, businessId = BUSINESS_A, branchId?: string): any {
  const effectiveBranchId = branchId ?? (businessId === BUSINESS_A ? BRANCH_A : BRANCH_B)
  return {
    business_id: businessId,
    items: [
      {
        idempotency_key: randomUUID(),
        request_hash: randomUUID(),
        sale: {
          id: randomUUID(),
          receipt_number: `INV-${randomUUID()}`,
          subtotal_minor: 10000,
          discount_minor: 0,
          tax_minor: 0,
          total_minor: 10000,
          payment_method: 'cash',
          paid_minor: 10000,
          change_minor: 0,
          cashier_id: 'cashier-1',
          branch_id: effectiveBranchId,
          created_at: new Date().toISOString(),
          client_created_at: new Date().toISOString()
        },
        sale_items: [
          {
            product_id: productId,
            product_name: 'Test Product',
            quantity: 1,
            unit_price_minor: 10000,
            subtotal_minor: 10000
          }
        ]
      }
    ]
  }
}

async function countRows(table: string): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`)
  return Number(result.rows[0].count)
}

beforeAll(async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for integration tests')
  }

  pool = createPool(databaseUrl)
  await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
  app = createApp(pool)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await resetDatabase()

  const userA = await seedTestUser(pool, BUSINESS_A)
  const authA = await authenticateTestUser(app, userA.email, userA.password, BUSINESS_A)
  tokenA = authA.accessToken

  const userB = await seedTestUser(pool, BUSINESS_B)
  const authB = await authenticateTestUser(app, userB.email, userB.password, BUSINESS_B)
  tokenB = authB.accessToken
})

describe('Phase 3.0.2 API', () => {
  it('API-001 health returns 200 when database is reachable', async () => {
    const res = await request(app).get('/health').expect(200)

    expect(res.body.status).toBe('ok')
    expect(res.body.database).toBe('ok')
    expect(typeof res.body.timestamp).toBe('string')
  })

  it('API-002 health returns 503 when database is unavailable', async () => {
    const brokenPool = {
      query: async () => {
        throw new Error('database down')
      }
    } as unknown as Pool

    const brokenApp = createApp(brokenPool)
    const res = await request(brokenApp).get('/health').expect(503)

    expect(res.body.status).toBe('error')
    expect(res.body.database).toBe('unavailable')
  })

  it('API-003 product pull returns products for tenant', async () => {
    await seedProduct(BUSINESS_A, { name: 'Product A1' })
    await seedProduct(BUSINESS_A, { name: 'Product A2' })

    const res = await request(app).get(`/v1/sync/products?business_id=${BUSINESS_A}`).set('Authorization', `Bearer ${tokenA}`).expect(200)

    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items).toHaveLength(2)
    expect(typeof res.body.next_version).toBe('number')
    expect(typeof res.body.has_more).toBe('boolean')
  })

  it('API-004 product pull respects after_version cursor', async () => {
    await seedProduct(BUSINESS_A, { serverVersion: 1 })
    const productV5 = await seedProduct(BUSINESS_A, { serverVersion: 5 })

    const res = await request(app).get(`/v1/sync/products?business_id=${BUSINESS_A}&after_version=1`).set('Authorization', `Bearer ${tokenA}`).expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].id).toBe(productV5)
    expect(res.body.items[0].server_version).toBe(5)
    expect(res.body.next_version).toBe(5)
  })

  it('API-005 product pull enforces tenant isolation', async () => {
    await seedProduct(BUSINESS_A, { name: 'A product' })
    await seedProduct(BUSINESS_B, { name: 'B product' })

    const resA = await request(app).get(`/v1/sync/products?business_id=${BUSINESS_A}`).set('Authorization', `Bearer ${tokenA}`).expect(200)

    const resB = await request(app).get(`/v1/sync/products?business_id=${BUSINESS_B}`).set('Authorization', `Bearer ${tokenB}`).expect(200)

    expect(resA.body.items).toHaveLength(1)
    expect(resB.body.items).toHaveLength(1)
    expect(resA.body.items[0].name).toBe('A product')
    expect(resB.body.items[0].name).toBe('B product')
  })

  it('API-006 product update succeeds with correct expected_server_version', async () => {
    const productId = await seedProduct(BUSINESS_A, { name: 'Old Name' })

    const res = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        business_id: BUSINESS_A,
        name: 'New Name',
        expected_server_version: 1
      })
      .expect(200)

    expect(res.body.id).toBe(productId)
    expect(res.body.name).toBe('New Name')
  })

  it('API-007 product update returns VERSION_CONFLICT on wrong expected version', async () => {
    const productId = await seedProduct(BUSINESS_A)

    const res = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        business_id: BUSINESS_A,
        name: 'Conflict',
        expected_server_version: 999
      })
      .expect(409)

    expect(res.body.error.code).toBe('VERSION_CONFLICT')
    expect(res.body.error.message).toBe('Product was modified by another device')
    expect(res.body.error.details.expected_server_version).toBe(999)
    expect(res.body.error.details.current_server_version).toBe(1)
    expect(res.body.error.details.current_product).toBeDefined()
    expect(res.body.error.details.current_product.id).toBe(productId)
  })

  it('API-008 product update increments server_version', async () => {
    const productId = await seedProduct(BUSINESS_A, { serverVersion: 1 })

    const res = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        business_id: BUSINESS_A,
        name: 'Incremented',
        expected_server_version: 1
      })
      .expect(200)

    expect(res.body.server_version).toBe(2)
  })

  it('API-009 sales batch success inserts sale and sale_items', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const body = makeSaleBatch(productId)

    const res = await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(body).expect(200)

    expect(res.body.results).toHaveLength(1)
    expect(res.body.results[0].status).toBe('created')
    expect(res.body.created_count).toBe(1)

    expect(await countRows('sales')).toBe(1)
    expect(await countRows('sale_items')).toBe(1)
  })

  it('API-010 sales batch is atomic when one item fails', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const validBatch = makeSaleBatch(productId)
    const invalidItem = JSON.parse(JSON.stringify(validBatch.items[0]))

    invalidItem.idempotency_key = randomUUID()
    invalidItem.request_hash = randomUUID()
    invalidItem.sale.id = randomUUID()
    invalidItem.sale_items[0].product_id = randomUUID()

    const body = {
      business_id: BUSINESS_A,
      items: [validBatch.items[0], invalidItem]
    }

    await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(body).expect(400)

    expect(await countRows('sales')).toBe(0)
    expect(await countRows('sale_items')).toBe(0)
  })

  it('API-011 idempotent retry returns stored response without duplicate sale', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const body = makeSaleBatch(productId)

    const first = await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(body).expect(200)

    const second = await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(body).expect(200)

    expect(first.body.results[0].status).toBe('created')
    expect(second.body.results[0].status).toBe('replayed')
    expect(second.body.results[0].sale_id).toBe(first.body.results[0].sale_id)

    expect(await countRows('sales')).toBe(1)
    expect(await countRows('sale_items')).toBe(1)
  })

  it('API-012 idempotency hash mismatch returns IDEMPOTENCY_KEY_REUSE', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const body = makeSaleBatch(productId)

    await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(body).expect(200)

    const retry = JSON.parse(JSON.stringify(body))
    retry.items[0].request_hash = 'different-hash'

    const res = await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(retry).expect(409)

    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSE')
    expect(await countRows('sales')).toBe(1)
  })

  it('API-013 sales batch rejects cross-tenant product reference', async () => {
    const productB = await seedProduct(BUSINESS_B)
    const body = makeSaleBatch(productB, BUSINESS_A)

    await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(body).expect(400)

    expect(await countRows('sales')).toBe(0)
  })

  it('API-014 sales are append-only at database level', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const body = makeSaleBatch(productId)

    await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(body).expect(200)

    const saleResult = await pool.query('SELECT id FROM sales LIMIT 1')
    const saleId = saleResult.rows[0].id as string

    await expect(pool.query('UPDATE sales SET receipt_number = $1 WHERE id = $2', ['HACKED', saleId])).rejects.toThrow(/append-only/i)

    await expect(pool.query('DELETE FROM sales WHERE id = $1', [saleId])).rejects.toThrow(/append-only/i)
  })

  it('API-015 invalid product UUID returns validation error', async () => {
    const res = await request(app)
      .put('/v1/sync/products/not-a-uuid')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        business_id: BUSINESS_A,
        name: 'Test',
        expected_server_version: 1
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('API-016 negative product price returns validation error', async () => {
    const productId = await seedProduct(BUSINESS_A)

    const res = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        business_id: BUSINESS_A,
        price_minor: -1,
        expected_server_version: 1
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('API-017 invalid sale item quantity returns validation error', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const body = makeSaleBatch(productId)
    body.items[0].sale_items[0].quantity = 0

    const res = await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(body).expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('API-018 missing required sale fields returns validation error', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const body = makeSaleBatch(productId)
    delete body.items[0].sale.receipt_number

    const res = await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(body).expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('API-019 duplicate receipt_number returns RECEIPT_NUMBER_CONFLICT', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const receiptNumber = 'RECEIPT-CONFLICT-TEST'

    const makeFixedReceiptBatch = () => ({
      business_id: BUSINESS_A,
      items: [
        {
          idempotency_key: randomUUID(),
          request_hash: randomUUID(),
          sale: {
            id: randomUUID(),
            receipt_number: receiptNumber,
            subtotal_minor: 10000,
            discount_minor: 0,
            tax_minor: 0,
            total_minor: 10000,
            payment_method: 'cash',
            paid_minor: 10000,
            change_minor: 0,
            cashier_id: 'cashier-1',
            branch_id: BRANCH_A,
            created_at: new Date().toISOString(),
            client_created_at: new Date().toISOString()
          },
          sale_items: [
            {
              product_id: null,
              product_name: 'Test Product',
              quantity: 1,
              unit_price_minor: 10000,
              subtotal_minor: 10000
            }
          ]
        }
      ]
    })

    const first = await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(makeFixedReceiptBatch()).expect(200)
    expect(first.body.results[0].status).toBe('created')
    expect(first.body.results[0].receipt_number).toBe(receiptNumber)

    const second = await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(makeFixedReceiptBatch()).expect(200)
    expect(second.body.results[0].status).toBe('receipt_conflict')
    expect(second.body.results[0].receipt_number).toBe(receiptNumber)

    expect(await countRows('sales')).toBe(1)
    expect(await countRows('idempotency_keys')).toBe(1)
  })

  it('API-020 same idempotency key replay returns replayed', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const receiptNumber = 'RECEIPT-REPLAY-TEST'
    const body = {
      business_id: BUSINESS_A,
      items: [
        {
          idempotency_key: 'fixed-replay-key',
          request_hash: 'fixed-replay-hash',
          sale: {
            id: randomUUID(),
            receipt_number: receiptNumber,
            subtotal_minor: 10000,
            discount_minor: 0,
            tax_minor: 0,
            total_minor: 10000,
            payment_method: 'cash',
            paid_minor: 10000,
            change_minor: 0,
            cashier_id: 'cashier-1',
            branch_id: BRANCH_A,
            created_at: new Date().toISOString(),
            client_created_at: new Date().toISOString()
          },
          sale_items: [
            {
              product_id: productId,
              product_name: 'Test Product',
              quantity: 1,
              unit_price_minor: 10000,
              subtotal_minor: 10000
            }
          ]
        }
      ]
    }

    const first = await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(body).expect(200)
    expect(first.body.results[0].status).toBe('created')

    const second = await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(body).expect(200)
    expect(second.body.results[0].status).toBe('replayed')
    expect(second.body.results[0].receipt_number).toBe(receiptNumber)

    expect(await countRows('sales')).toBe(1)
  })

  it('API-021 different businesses can reuse receipt_number', async () => {
    const productIdA = await seedProduct(BUSINESS_A)
    const productIdB = await seedProduct(BUSINESS_B)
    const receiptNumber = 'RECEIPT-SHARED'

    const bodyA = {
      business_id: BUSINESS_A,
      items: [
        {
          idempotency_key: randomUUID(),
          request_hash: randomUUID(),
          sale: {
            id: randomUUID(),
            receipt_number: receiptNumber,
            subtotal_minor: 10000,
            discount_minor: 0,
            tax_minor: 0,
            total_minor: 10000,
            payment_method: 'cash',
            paid_minor: 10000,
            change_minor: 0,
            cashier_id: 'cashier-1',
            branch_id: BRANCH_A,
            created_at: new Date().toISOString(),
            client_created_at: new Date().toISOString()
          },
          sale_items: [
            {
              product_id: productIdA,
              product_name: 'Test Product A',
              quantity: 1,
              unit_price_minor: 10000,
              subtotal_minor: 10000
            }
          ]
        }
      ]
    }

    const bodyB = {
      business_id: BUSINESS_B,
      items: [
        {
          idempotency_key: randomUUID(),
          request_hash: randomUUID(),
          sale: {
            id: randomUUID(),
            receipt_number: receiptNumber,
            subtotal_minor: 10000,
            discount_minor: 0,
            tax_minor: 0,
            total_minor: 10000,
            payment_method: 'cash',
            paid_minor: 10000,
            change_minor: 0,
            cashier_id: 'cashier-1',
            branch_id: BRANCH_B,
            created_at: new Date().toISOString(),
            client_created_at: new Date().toISOString()
          },
          sale_items: [
            {
              product_id: productIdB,
              product_name: 'Test Product B',
              quantity: 1,
              unit_price_minor: 10000,
              subtotal_minor: 10000
            }
          ]
        }
      ]
    }

    const resA = await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(bodyA).expect(200)
    expect(resA.body.results[0].status).toBe('created')

    const resB = await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenB}`).send(bodyB).expect(200)
    expect(resB.body.results[0].status).toBe('created')

    expect(await countRows('sales')).toBe(2)
  })

  it('API-022 batch continues processing after receipt conflict on one item', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const receiptNumber = 'RECEIPT-BATCH-CONFLICT'

    const makeBatch = (useConflictReceipt: boolean) => ({
      business_id: BUSINESS_A,
      items: [
        {
          idempotency_key: randomUUID(),
          request_hash: randomUUID(),
          sale: {
            id: randomUUID(),
            receipt_number: useConflictReceipt ? receiptNumber : `RECEIPT-${randomUUID()}`,
            subtotal_minor: 10000,
            discount_minor: 0,
            tax_minor: 0,
            total_minor: 10000,
            payment_method: 'cash',
            paid_minor: 10000,
            change_minor: 0,
            cashier_id: 'cashier-1',
            branch_id: BRANCH_A,
            created_at: new Date().toISOString(),
            client_created_at: new Date().toISOString()
          },
          sale_items: [
            {
              product_id: productId,
              product_name: 'Test Product',
              quantity: 1,
              unit_price_minor: 10000,
              subtotal_minor: 10000
            }
          ]
        },
        {
          idempotency_key: randomUUID(),
          request_hash: randomUUID(),
          sale: {
            id: randomUUID(),
            receipt_number: `RECEIPT-OK-${randomUUID()}`,
            subtotal_minor: 20000,
            discount_minor: 0,
            tax_minor: 0,
            total_minor: 20000,
            payment_method: 'transfer',
            paid_minor: 20000,
            change_minor: 0,
            cashier_id: 'cashier-1',
            branch_id: BRANCH_A,
            created_at: new Date().toISOString(),
            client_created_at: new Date().toISOString()
          },
          sale_items: [
            {
              product_id: productId,
              product_name: 'Test Product 2',
              quantity: 2,
              unit_price_minor: 10000,
              subtotal_minor: 20000
            }
          ]
        }
      ]
    })

    // First batch creates two sales (one with receiptNumber, one unique)
    await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(makeBatch(true)).expect(200)

    // Second batch: first item conflicts, second should succeed
    const res = await request(app).post('/v1/sync/sales/batch').set('Authorization', `Bearer ${tokenA}`).send(makeBatch(true)).expect(200)
    expect(res.body.results).toHaveLength(2)
    expect(res.body.results[0].status).toBe('receipt_conflict')
    expect(res.body.results[1].status).toBe('created')
    expect(res.body.created_count).toBe(1)
    expect(await countRows('sales')).toBe(3)
  })

  it('API-023 missing branch_id returns 400 validation error', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const body = makeSaleBatch(productId)
    delete body.items[0].sale.branch_id

    const res = await request(app)
      .post('/v1/sync/sales/batch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(body)
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details['items[0].sale.branch_id']).toBeDefined()
  })

  it('API-024 invalid branch_id UUID returns 400 validation error', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const body = makeSaleBatch(productId)
    body.items[0].sale.branch_id = 'not-a-valid-uuid'

    const res = await request(app)
      .post('/v1/sync/sales/batch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(body)
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details['items[0].sale.branch_id']).toBeDefined()
  })

  it('API-025 valid sale with branch_id deducts stock atomically and creates stock movement', async () => {
    const productId = await seedProduct(BUSINESS_A, { stockQuantity: 50 })
    const body = makeSaleBatch(productId)
    body.items[0].sale_items[0].quantity = 5

    const res = await request(app)
      .post('/v1/sync/sales/batch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(body)
      .expect(200)

    expect(res.body.results[0].status).toBe('created')

    // Verify stock was deducted: 50 - 5 = 45
    const stockRes = await pool.query(
      'SELECT quantity FROM stocks WHERE business_id = $1 AND branch_id = $2 AND product_id = $3',
      [BUSINESS_A, BRANCH_A, productId]
    )
    expect(stockRes.rows[0].quantity).toBe(45)

    // Verify movement was created
    const movementRes = await pool.query(
      'SELECT * FROM stock_movements WHERE business_id = $1 AND branch_id = $2 AND product_id = $3',
      [BUSINESS_A, BRANCH_A, productId]
    )
    expect(movementRes.rows).toHaveLength(1)
    expect(movementRes.rows[0].quantity).toBe(-5)
    expect(movementRes.rows[0].movement_type).toBe('SALE')
  })

  it('API-026 historical sale with branch_id = NULL remains readable via pullSales', async () => {
    const historicalSaleId = randomUUID()
    const now = new Date()

    // Insert historical sale row with branch_id NULL directly into database
    await pool.query(
      `
        INSERT INTO sales (
          id, business_id, branch_id, receipt_number, total_minor,
          payment_method, paid_minor, change_minor, server_created_at
        ) VALUES (
          $1, $2, NULL, $3, $4,
          'CASH', $4, 0, $5
        )
      `,
      [historicalSaleId, BUSINESS_A, 'HISTORICAL-INV-001', 15000, now]
    )

    const res = await request(app)
      .get(`/v1/sync/sales?business_id=${BUSINESS_A}&since=0&limit=100`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)

    expect(Array.isArray(res.body.sales)).toBe(true)
    const found = res.body.sales.find((s: any) => s.id === historicalSaleId)
    expect(found).toBeDefined()
    expect(found.receipt_number).toBe('HISTORICAL-INV-001')
    expect(found.grand_total_minor).toBe(15000)
  })
})
