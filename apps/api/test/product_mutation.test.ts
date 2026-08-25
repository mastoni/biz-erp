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
      businesses,
      users,
      user_businesses
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
      VALUES ($1, $2, 'Branch A'), ($3, $4, 'Branch B')
      ON CONFLICT (id) DO NOTHING
    `,
    [BRANCH_A, BUSINESS_A, BRANCH_A, BUSINESS_B]
  )
}

async function seedProduct(
  businessId: string,
  options: {
    name?: string
    sku?: string | null
    priceMinor?: number
    costMinor?: number | null
    category?: string | null
    barcode?: string | null
    isActive?: boolean
    serverVersion?: number
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
      options.category ?? null,
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

describe('Phase 3B.3 Product Mutation Semantics', () => {
  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-001: valid create
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-001 valid create succeeds with all fields', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Valid Product',
        price_minor: 15000,
        sku: 'SKU-VALID-001',
        cost_minor: 8000,
        category: 'Electronics',
        barcode: 'BC-VALID',
      })
      .expect(201)

    expect(res.body.name).toBe('Valid Product')
    expect(res.body.sku).toBe('SKU-VALID-001')
    expect(res.body.cost_minor).toBe(8000)
    expect(res.body.price_minor).toBe(15000)
    expect(res.body.category).toBe('Electronics')
    expect(res.body.barcode).toBe('BC-VALID')
    expect(res.body.is_active).toBe(true)
    expect(res.body.server_version).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-002: missing name
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-002 missing name returns validation error', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        price_minor: 15000,
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details?.name).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-003: invalid price
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-003 invalid price returns validation error', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Bad Price Product',
        price_minor: -500,
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details?.price_minor).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-004: negative cost
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-004 negative cost_minor returns validation error', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Negative Cost',
        price_minor: 15000,
        cost_minor: -100,
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details?.cost_minor).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-005: duplicate SKU same tenant
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-005 duplicate SKU within same tenant rejected', async () => {
    const sku = 'SKU-DUP-005'

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
  // PRODUCT-MUT-006: duplicate barcode same tenant
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-006 duplicate barcode within same tenant rejected', async () => {
    const barcode = 'BC-DUP-006'

    await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'First Product',
        price_minor: 5000,
        barcode,
      })
      .expect(201)

    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Second Product',
        price_minor: 3000,
        barcode,
      })
      .expect(409)

    expect(res.body.error.code).toBe('BARCODE_CONFLICT')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-007: same SKU different tenant
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-007 same SKU allowed in different tenants', async () => {
    const sku = 'SKU-SHARED-007'

    const resA = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Product A',
        price_minor: 5000,
        sku,
      })
      .expect(201)

    expect(resA.body.sku).toBe(sku)

    const resB = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_B,
        id: randomUUID(),
        name: 'Product B',
        price_minor: 3000,
        sku,
      })
      .expect(201)

    expect(resB.body.sku).toBe(sku)
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-008: update SKU/cost
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-008 update SKU and cost_minor', async () => {
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
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-009: clear nullable fields
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-009 clear nullable fields (sku, cost_minor, barcode, category)', async () => {
    const productId = await seedProduct(BUSINESS_A, {
      name: 'Clear Test',
      sku: 'SKU-CLEAR',
      costMinor: 5000,
      barcode: 'BC-CLEAR',
      category: 'TestCat',
      serverVersion: 1,
    })

    const res = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: BUSINESS_A,
        expected_server_version: 1,
        sku: null,
        cost_minor: null,
        barcode: null,
        category: null,
      })
      .expect(200)

    expect(res.body.sku).toBeNull()
    expect(res.body.cost_minor).toBeNull()
    expect(res.body.barcode).toBeNull()
    expect(res.body.category).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-010: stale server_version → VERSION_CONFLICT
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-010 stale server_version rejected with VERSION_CONFLICT', async () => {
    const productId = await seedProduct(BUSINESS_A, {
      name: 'Version Test',
      serverVersion: 5,
    })

    const res = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: BUSINESS_A,
        expected_server_version: 1,
        name: 'Updated Name',
      })
      .expect(409)

    expect(res.body.error.code).toBe('VERSION_CONFLICT')
    expect(res.body.error.details.current_server_version).toBe(5)
    expect(res.body.error.details.current_product).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-011: correct version increments once
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-011 server_version increments exactly once per update', async () => {
    const productId = await seedProduct(BUSINESS_A, {
      name: 'Increment Test',
      serverVersion: 3,
    })

    const res = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: BUSINESS_A,
        expected_server_version: 3,
        name: 'Updated Name',
      })
      .expect(200)

    expect(res.body.server_version).toBe(4)
    expect(res.body.name).toBe('Updated Name')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-012: deactivate
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-012 deactivate sets is_active=false', async () => {
    const productId = await seedProduct(BUSINESS_A, {
      name: 'Deactivate Test',
      isActive: true,
      serverVersion: 1,
    })

    const res = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: BUSINESS_A,
        expected_server_version: 1,
        is_active: false,
      })
      .expect(200)

    expect(res.body.is_active).toBe(false)
    expect(res.body.server_version).toBe(2)
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-013: deactivated product remains readable
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-013 deactivated product remains readable via GET by ID', async () => {
    const productId = await seedProduct(BUSINESS_A, {
      name: 'Remains Readable',
      isActive: true,
      serverVersion: 1,
    })

    // Deactivate
    await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: BUSINESS_A,
        expected_server_version: 1,
        is_active: false,
      })
      .expect(200)

    // Read back — should still be accessible
    const res = await request(app)
      .get(`/v1/products/${productId}?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.id).toBe(productId)
    expect(res.body.is_active).toBe(false)
    expect(res.body.name).toBe('Remains Readable')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-014: CASHIER cannot mutate
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-014 CASHIER cannot create products', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Cashier Product',
        price_minor: 5000,
      })
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })

  it('PRODUCT-MUT-014b CASHIER cannot update products', async () => {
    const productId = await seedProduct(BUSINESS_A, { name: 'Cashier Update Test', serverVersion: 1 })

    const res = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({
        business_id: BUSINESS_A,
        expected_server_version: 1,
        name: 'Updated by Cashier',
      })
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-015: foreign tenant cannot mutate
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-015 foreign tenant cannot create products with different business_id', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Foreign Product',
        price_minor: 5000,
      })
      .expect(403)

    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  it('PRODUCT-MUT-015b foreign tenant cannot update products in other tenant', async () => {
    const productId = await seedProduct(BUSINESS_A, { name: 'Foreign Update Target', serverVersion: 1 })

    const res = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .send({
        business_id: BUSINESS_A,
        expected_server_version: 1,
        name: 'Updated by Foreign Tenant',
      })
      .expect(403)

    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-MUT-016: hard DELETE unsupported
  // ---------------------------------------------------------------------------
  it('PRODUCT-MUT-016 hard DELETE not supported (no DELETE route)', async () => {
    const productId = await seedProduct(BUSINESS_A, { name: 'No Delete Test', serverVersion: 1 })

    await request(app)
      .delete(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(404)

    // Verify product still exists
    const res = await request(app)
      .get(`/v1/products/${productId}?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.id).toBe(productId)
  })

  // ---------------------------------------------------------------------------
  // BONUS: Idempotency on create
  // ---------------------------------------------------------------------------
  it('BONUS-001 idempotent create returns same product on retry', async () => {
    const idempotencyKey = randomUUID()
    const payload = {
      business_id: BUSINESS_A,
      id: randomUUID(),
      name: 'Idempotent Product',
      price_minor: 5000,
    }

    const res1 = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201)

    const res2 = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201)

    expect(res1.body.id).toBe(res2.body.id)
    expect(res1.body.name).toBe(res2.body.name)
  })

  // ---------------------------------------------------------------------------
  // BONUS: product sync cursor/version unaffected by mutations
  // ---------------------------------------------------------------------------
  it('BONUS-002 sync cursor/version reflects mutations', async () => {
    const productId = await seedProduct(BUSINESS_A, { name: 'Cursor Product', serverVersion: 1 })

    // Initial sync
    const sync1 = await request(app)
      .get(`/v1/sync/products?business_id=${BUSINESS_A}&after_version=0&limit=100`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(sync1.body.current_version).toBe(1)
    expect(sync1.body.items).toHaveLength(1)

    // Update product
    await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: BUSINESS_A,
        expected_server_version: 1,
        name: 'Updated Cursor Product',
      })
      .expect(200)

    // Sync after update — should reflect new version
    const sync2 = await request(app)
      .get(`/v1/sync/products?business_id=${BUSINESS_A}&after_version=1&limit=100`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(sync2.body.items).toHaveLength(1)
    expect(sync2.body.items[0].name).toBe('Updated Cursor Product')
    expect(sync2.body.items[0].server_version).toBe(2)
    expect(sync2.body.current_version).toBe(2)
  })

  // ---------------------------------------------------------------------------
  // BONUS: invalid product UUID for update returns 400
  // ---------------------------------------------------------------------------
  it('BONUS-003 invalid UUID for update returns 400', async () => {
    const res = await request(app)
      .put('/v1/sync/products/not-a-uuid')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: BUSINESS_A,
        expected_server_version: 1,
        name: 'Updated',
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
