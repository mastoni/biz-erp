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

let pool!: Pool
let app!: Express
let ownerTokenA!: string
let ownerTokenB!: string
let cashierTokenA!: string

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
      refresh_tokens,
      user_businesses,
      users,
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
    sku?: string | null
    priceMinor?: number
    costMinor?: number | null
    barcode?: string | null
    serverVersion?: number
    isActive?: boolean
  } = {}
): Promise<string> {
  const id = randomUUID()

  await pool.query(
    `
      INSERT INTO products (
        id, business_id, name, description, sku, price_minor, cost_minor,
        category, barcode, is_active, server_version, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
    `,
    [
      id, businessId,
      options.name ?? `Product ${id.slice(0, 8)}`,
      null,
      options.sku ?? null,
      options.priceMinor ?? 10000,
      options.costMinor ?? null,
      null,
      options.barcode ?? null,
      options.isActive ?? true,
      options.serverVersion ?? 1,
    ]
  )

  return id
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

  const ownerA = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  const authA = await authenticateTestUser(app, ownerA.email, ownerA.password, BUSINESS_A)
  ownerTokenA = authA.accessToken

  const ownerB = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER' })
  const authB = await authenticateTestUser(app, ownerB.email, ownerB.password, BUSINESS_B)
  ownerTokenB = authB.accessToken

  const cashierA = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  const authCashierA = await authenticateTestUser(app, cashierA.email, cashierA.password, BUSINESS_A)
  cashierTokenA = authCashierA.accessToken
})

describe('Phase 3B.1 Product Master Contract', () => {
  // ---------------------------------------------------------------------------
  // PRODUCT-001: SKU nullable accepted
  // ---------------------------------------------------------------------------
  it('PRODUCT-001 SKU nullable accepted on create', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'No SKU Product',
        price_minor: 5000,
      })
      .expect(201)

    expect(res.body.sku).toBeNull()
    expect(res.body.name).toBe('No SKU Product')
    expect(res.body.price_minor).toBe(5000)
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-002: SKU unique within tenant
  // ---------------------------------------------------------------------------
  it('PRODUCT-002 SKU unique within tenant — different SKU accepted', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Product SKU 1',
        price_minor: 5000,
        sku: 'SKU-001',
      })
      .expect(201)

    expect(res.body.sku).toBe('SKU-001')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-003: Same SKU allowed in different tenants
  // ---------------------------------------------------------------------------
  it('PRODUCT-003 same SKU allowed in different tenants', async () => {
    // Create product with SKU in Business A
    const sku = 'SKU-SHARED-001'
    await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Product A with SKU',
        price_minor: 5000,
        sku,
      })
      .expect(201)

    // Create product with same SKU in Business B — should succeed
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_B,
        id: randomUUID(),
        name: 'Product B with SKU',
        price_minor: 3000,
        sku,
      })
      .expect(201)

    expect(res.body.sku).toBe(sku)
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-004: Duplicate SKU rejected
  // ---------------------------------------------------------------------------
  it('PRODUCT-004 duplicate SKU within same tenant rejected', async () => {
    const sku = 'SKU-DUP-001'

    // Create first product with SKU
    await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'First Product',
        price_minor: 5000,
        sku,
      })
      .expect(201)

    // Create second product with same SKU — should fail with 409
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Second Product',
        price_minor: 3000,
        sku,
      })
      .expect(409)

    expect(res.body.error.code).toBe('SKU_CONFLICT')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-005: cost_minor nullable
  // ---------------------------------------------------------------------------
  it('PRODUCT-005 cost_minor nullable accepted on create', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Product without cost',
        price_minor: 5000,
      })
      .expect(201)

    expect(res.body.cost_minor).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-006: cost_minor zero accepted
  // ---------------------------------------------------------------------------
  it('PRODUCT-006 cost_minor zero accepted', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Product zero cost',
        price_minor: 5000,
        cost_minor: 0,
      })
      .expect(201)

    expect(res.body.cost_minor).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-007: negative cost rejected
  // ---------------------------------------------------------------------------
  it('PRODUCT-007 negative cost_minor rejected', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Negative Cost Product',
        price_minor: 5000,
        cost_minor: -100,
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details?.cost_minor).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-008: current_version returned in sync response
  // ---------------------------------------------------------------------------
  it('PRODUCT-008 current_version returned in sync response', async () => {
    await seedProduct(BUSINESS_A, { name: 'Product V1', serverVersion: 1 })
    await seedProduct(BUSINESS_A, { name: 'Product V2', serverVersion: 5 })

    const res = await request(app)
      .get(`/v1/sync/products?business_id=${BUSINESS_A}&after_version=0&limit=100`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items).toHaveLength(2)
    expect(typeof res.body.current_version).toBe('number')
    expect(res.body.current_version).toBe(5)
    expect(typeof res.body.has_more).toBe('boolean')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-009: Mobile contract — response uses current_version (not next_version)
  // ---------------------------------------------------------------------------
  it('PRODUCT-009 sync response uses current_version field (mobile contract)', async () => {
    await seedProduct(BUSINESS_A, { name: 'Product', serverVersion: 3 })

    const res = await request(app)
      .get(`/v1/sync/products?business_id=${BUSINESS_A}&after_version=0&limit=100`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    // Mobile reads json['current_version'] — must be present
    expect(res.body.current_version).toBe(3)
    // obsolete field must not be present
    expect(res.body.next_version).toBeUndefined()
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-010: optimistic locking preserved
  // ---------------------------------------------------------------------------
  it('PRODUCT-010 optimistic locking preserved on update', async () => {
    const productId = await seedProduct(BUSINESS_A, { name: 'Lock Test', serverVersion: 1 })

    // Update with correct version — success
    const res1 = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: BUSINESS_A,
        name: 'Lock Test Updated',
        expected_server_version: 1,
      })
      .expect(200)

    expect(res1.body.name).toBe('Lock Test Updated')
    expect(res1.body.server_version).toBe(2)

    // Update with stale version — conflict
    const res2 = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: BUSINESS_A,
        name: 'Conflict Update',
        expected_server_version: 1,
      })
      .expect(409)

    expect(res2.body.error.code).toBe('VERSION_CONFLICT')
    expect(res2.body.error.details.current_server_version).toBe(2)
    expect(res2.body.error.details.current_product).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // BONUS: SKU + cost_minor returned in product response after create
  // ---------------------------------------------------------------------------
  it('PRODUCT-011 full product create returns sku and cost_minor', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Full Product',
        price_minor: 15000,
        sku: 'SKU-FULL-001',
        cost_minor: 10000,
      })
      .expect(201)

    expect(res.body.sku).toBe('SKU-FULL-001')
    expect(res.body.cost_minor).toBe(10000)
    expect(res.body.price_minor).toBe(15000)
  })

  // ---------------------------------------------------------------------------
  // BONUS: SKU + cost_minor updated via PUT
  // ---------------------------------------------------------------------------
  it('PRODUCT-012 update sku and cost_minor on existing product', async () => {
    const productId = await seedProduct(BUSINESS_A, {
      name: 'Update Test',
      sku: 'SKU-OLD',
      costMinor: 5000,
      serverVersion: 1,
    })

    const res = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: BUSINESS_A,
        expected_server_version: 1,
        sku: 'SKU-NEW',
        cost_minor: 7000,
      })
      .expect(200)

    expect(res.body.sku).toBe('SKU-NEW')
    expect(res.body.cost_minor).toBe(7000)
    expect(res.body.server_version).toBe(2)
  })
})
