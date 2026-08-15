import path from 'path'
import { randomUUID } from 'crypto'
import type { Express } from 'express'
import { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'

const BUSINESS_A = '11111111-1111-4111-8111-111111111111'
const BUSINESS_B = '22222222-2222-4222-8222-222222222222'

let pool!: Pool
let app!: Express

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
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
}

async function seedProduct(
  businessId: string,
  options: {
    name?: string
    barcode?: string | null
    priceMinor?: number
    serverVersion?: number
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

  return id
}

function makeSaleBatch(productId: string | null, businessId = BUSINESS_A): any {
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

    const res = await request(app).get(`/v1/sync/products?business_id=${BUSINESS_A}`).set('X-Demo-Business-Id', BUSINESS_A).expect(200)

    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items).toHaveLength(2)
    expect(typeof res.body.next_version).toBe('number')
    expect(typeof res.body.has_more).toBe('boolean')
  })

  it('API-004 product pull respects after_version cursor', async () => {
    await seedProduct(BUSINESS_A, { serverVersion: 1 })
    const productV5 = await seedProduct(BUSINESS_A, { serverVersion: 5 })

    const res = await request(app).get(`/v1/sync/products?business_id=${BUSINESS_A}&after_version=1`).set('X-Demo-Business-Id', BUSINESS_A).expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].id).toBe(productV5)
    expect(res.body.items[0].server_version).toBe(5)
    expect(res.body.next_version).toBe(5)
  })

  it('API-005 product pull enforces tenant isolation', async () => {
    await seedProduct(BUSINESS_A, { name: 'A product' })
    await seedProduct(BUSINESS_B, { name: 'B product' })

    const resA = await request(app).get(`/v1/sync/products?business_id=${BUSINESS_A}`).set('X-Demo-Business-Id', BUSINESS_A).expect(200)

    const resB = await request(app).get(`/v1/sync/products?business_id=${BUSINESS_B}`).set('X-Demo-Business-Id', BUSINESS_B).expect(200)

    expect(resA.body.items).toHaveLength(1)
    expect(resB.body.items).toHaveLength(1)
    expect(resA.body.items[0].name).toBe('A product')
    expect(resB.body.items[0].name).toBe('B product')
  })

  it('API-006 product update succeeds with correct expected_server_version', async () => {
    const productId = await seedProduct(BUSINESS_A, { name: 'Old Name' })

    const res = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('X-Demo-Business-Id', BUSINESS_A)
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
      .set('X-Demo-Business-Id', BUSINESS_A)
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
      .set('X-Demo-Business-Id', BUSINESS_A)
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

    const res = await request(app).post('/v1/sync/sales/batch').set('X-Demo-Business-Id', BUSINESS_A).send(body).expect(200)

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

    await request(app).post('/v1/sync/sales/batch').set('X-Demo-Business-Id', BUSINESS_A).send(body).expect(400)

    expect(await countRows('sales')).toBe(0)
    expect(await countRows('sale_items')).toBe(0)
  })

  it('API-011 idempotent retry returns stored response without duplicate sale', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const body = makeSaleBatch(productId)

    const first = await request(app).post('/v1/sync/sales/batch').set('X-Demo-Business-Id', BUSINESS_A).send(body).expect(200)

    const second = await request(app).post('/v1/sync/sales/batch').set('X-Demo-Business-Id', BUSINESS_A).send(body).expect(200)

    expect(first.body.results[0].status).toBe('created')
    expect(second.body.results[0].status).toBe('replayed')
    expect(second.body.results[0].sale_id).toBe(first.body.results[0].sale_id)

    expect(await countRows('sales')).toBe(1)
    expect(await countRows('sale_items')).toBe(1)
  })

  it('API-012 idempotency hash mismatch returns IDEMPOTENCY_KEY_REUSE', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const body = makeSaleBatch(productId)

    await request(app).post('/v1/sync/sales/batch').set('X-Demo-Business-Id', BUSINESS_A).send(body).expect(200)

    const retry = JSON.parse(JSON.stringify(body))
    retry.items[0].request_hash = 'different-hash'

    const res = await request(app).post('/v1/sync/sales/batch').set('X-Demo-Business-Id', BUSINESS_A).send(retry).expect(409)

    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSE')
    expect(await countRows('sales')).toBe(1)
  })

  it('API-013 sales batch rejects cross-tenant product reference', async () => {
    const productB = await seedProduct(BUSINESS_B)
    const body = makeSaleBatch(productB, BUSINESS_A)

    await request(app).post('/v1/sync/sales/batch').set('X-Demo-Business-Id', BUSINESS_A).send(body).expect(400)

    expect(await countRows('sales')).toBe(0)
  })

  it('API-014 sales are append-only at database level', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const body = makeSaleBatch(productId)

    await request(app).post('/v1/sync/sales/batch').set('X-Demo-Business-Id', BUSINESS_A).send(body).expect(200)

    const saleResult = await pool.query('SELECT id FROM sales LIMIT 1')
    const saleId = saleResult.rows[0].id as string

    await expect(pool.query('UPDATE sales SET receipt_number = $1 WHERE id = $2', ['HACKED', saleId])).rejects.toThrow(/append-only/i)

    await expect(pool.query('DELETE FROM sales WHERE id = $1', [saleId])).rejects.toThrow(/append-only/i)
  })

  it('API-015 invalid product UUID returns validation error', async () => {
    const res = await request(app)
      .put('/v1/sync/products/not-a-uuid')
      .set('X-Demo-Business-Id', BUSINESS_A)
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
      .set('X-Demo-Business-Id', BUSINESS_A)
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

    const res = await request(app).post('/v1/sync/sales/batch').set('X-Demo-Business-Id', BUSINESS_A).send(body).expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('API-018 missing required sale fields returns validation error', async () => {
    const productId = await seedProduct(BUSINESS_A)
    const body = makeSaleBatch(productId)
    delete body.items[0].sale.receipt_number

    const res = await request(app).post('/v1/sync/sales/batch').set('X-Demo-Business-Id', BUSINESS_A).send(body).expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
