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
    [BRANCH_A, BUSINESS_A, BRANCH_B, BUSINESS_B]
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
      options.category ?? null,
      options.barcode ?? null,
      options.isActive ?? true,
      options.serverVersion ?? 1,
    ]
  )

  return id
}

async function seedStock(
  businessId: string,
  branchId: string,
  productId: string,
  quantity: number
): Promise<void> {
  await pool.query(
    `
      INSERT INTO stocks (id, business_id, branch_id, product_id, quantity, server_version, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 1, now(), now())
      ON CONFLICT (business_id, branch_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity
    `,
    [randomUUID(), businessId, branchId, productId, quantity]
  )
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

describe('Phase 3B.2 Product Read Capabilities', () => {
  // ---------------------------------------------------------------------------
  // PRODUCT-READ-001: product list without filters
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-001 product list without filters returns all active products for tenant', async () => {
    await seedProduct(BUSINESS_A, { name: 'Product A1' })
    await seedProduct(BUSINESS_A, { name: 'Product A2' })
    await seedProduct(BUSINESS_B, { name: 'Product B1' })

    const res = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(2)
    expect(res.body.total).toBe(2)
    expect(res.body.limit).toBe(50)
    expect(res.body.offset).toBe(0)
    expect(res.body.has_more).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-READ-002: search by product name
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-002 search by product name', async () => {
    await seedProduct(BUSINESS_A, { name: 'Widget Pro 3000' })
    await seedProduct(BUSINESS_A, { name: 'Gadget Basic' })

    const res = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_A}&search=Widget`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].name).toBe('Widget Pro 3000')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-READ-003: search by SKU
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-003 search by SKU', async () => {
    await seedProduct(BUSINESS_A, { name: 'Product A', sku: 'SKU-001' })
    await seedProduct(BUSINESS_A, { name: 'Product B', sku: 'SKU-002' })

    const res = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_A}&search=SKU-001`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].sku).toBe('SKU-001')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-READ-004: search by barcode
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-004 search by barcode', async () => {
    await seedProduct(BUSINESS_A, { name: 'Product A', barcode: 'BC-001' })
    await seedProduct(BUSINESS_A, { name: 'Product B', barcode: 'BC-002' })

    const res = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_A}&search=BC-001`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].barcode).toBe('BC-001')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-READ-005: exact category filter
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-005 exact category filter', async () => {
    await seedProduct(BUSINESS_A, { name: 'Product A', category: 'Electronics' })
    await seedProduct(BUSINESS_A, { name: 'Product B', category: 'Food' })
    await seedProduct(BUSINESS_A, { name: 'Product C', category: 'Electronics' })

    const res = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_A}&category=Electronics`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(2)
    expect(res.body.items.every((p: any) => p.category === 'Electronics')).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-READ-006: pagination remains correct
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-006 pagination with limit and offset', async () => {
    await seedProduct(BUSINESS_A, { name: 'Product 1' })
    await seedProduct(BUSINESS_A, { name: 'Product 2' })
    await seedProduct(BUSINESS_A, { name: 'Product 3' })
    await seedProduct(BUSINESS_A, { name: 'Product 4' })

    const res = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_A}&limit=2&offset=1`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(2)
    expect(res.body.total).toBe(4)
    expect(res.body.limit).toBe(2)
    expect(res.body.offset).toBe(1)
    expect(res.body.has_more).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-READ-007: GET product by ID
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-007 GET product by ID', async () => {
    const productId = await seedProduct(BUSINESS_A, {
      name: 'Detailed Product',
      sku: 'SKU-DET-001',
      costMinor: 5000,
      category: 'Test',
      barcode: 'BC-DET',
    })

    const res = await request(app)
      .get(`/v1/products/${productId}?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.id).toBe(productId)
    expect(res.body.business_id).toBe(BUSINESS_A)
    expect(res.body.name).toBe('Detailed Product')
    expect(res.body.sku).toBe('SKU-DET-001')
    expect(res.body.cost_minor).toBe(5000)
    expect(res.body.category).toBe('Test')
    expect(res.body.barcode).toBe('BC-DET')
    expect(res.body.is_active).toBe(true)
    expect(typeof res.body.server_version).toBe('number')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-READ-008: product from another tenant → 404
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-008 product from another tenant returns 404', async () => {
    const productId = await seedProduct(BUSINESS_A, { name: 'Product A' })

    const res = await request(app)
      .get(`/v1/products/${productId}?business_id=${BUSINESS_B}`)
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .expect(404)

    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-READ-009: invalid product UUID → 400
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-009 invalid product UUID returns 400', async () => {
    const res = await request(app)
      .get(`/v1/products/not-a-uuid?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-READ-010: branch stock for valid tenant + branch + product
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-010 branch stock for valid tenant + branch + product', async () => {
    const productId = await seedProduct(BUSINESS_A, { name: 'Stocked Product' })
    await seedStock(BUSINESS_A, BRANCH_A, productId, 250)

    const res = await request(app)
      .get(`/v1/inventory/stock?business_id=${BUSINESS_A}&branch_id=${BRANCH_A}&product_id=${productId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.product_id).toBe(productId)
    expect(res.body.branch_id).toBe(BRANCH_A)
    expect(res.body.quantity).toBe(250)
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-READ-011: foreign branch cannot read stock
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-011 foreign branch cannot read stock (cross-tenant)', async () => {
    const productId = await seedProduct(BUSINESS_A, { name: 'Product A' })
    await seedStock(BUSINESS_A, BRANCH_A, productId, 100)

    // Business B trying to read Business A's branch stock
    const res = await request(app)
      .get(`/v1/inventory/stock?business_id=${BUSINESS_B}&branch_id=${BRANCH_A}&product_id=${productId}`)
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .expect(403)

    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-READ-012: missing stock row handled safely
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-012 missing stock row handled safely (returns zero)', async () => {
    const productId = await seedProduct(BUSINESS_A, { name: 'No Stock Product' })

    const res = await request(app)
      .get(`/v1/inventory/stock?business_id=${BUSINESS_A}&branch_id=${BRANCH_A}&product_id=${productId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.product_id).toBe(productId)
    expect(res.body.branch_id).toBe(BRANCH_A)
    expect(res.body.quantity).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-READ-013: Mobile product sync cursor behavior remains unchanged
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-013 Mobile product sync cursor behavior remains unchanged', async () => {
    await seedProduct(BUSINESS_A, { name: 'Sync Product 1', serverVersion: 1 })
    await seedProduct(BUSINESS_A, { name: 'Sync Product 2', serverVersion: 3 })
    await seedProduct(BUSINESS_A, { name: 'Sync Product 3', serverVersion: 5 })

    // First pull — after_version=0
    const res1 = await request(app)
      .get(`/v1/sync/products?business_id=${BUSINESS_A}&after_version=0&limit=100`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res1.body.items).toHaveLength(3)
    expect(res1.body.current_version).toBe(5)
    expect(res1.body.has_more).toBe(false)

    // Second pull — use current_version as after_version (cursor advances)
    const res2 = await request(app)
      .get(`/v1/sync/products?business_id=${BUSINESS_A}&after_version=5&limit=100`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res2.body.items).toHaveLength(0)
    expect(res2.body.current_version).toBe(5)
    expect(res2.body.has_more).toBe(false)

    // Filter query on operational endpoint does NOT affect sync version
    const res3 = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_A}&search=Nonexistent`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res3.body.items).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-READ-014: current_version remains correct after filtered reads
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-014 current_version remains correct after filtered reads', async () => {
    await seedProduct(BUSINESS_A, { name: 'Filter Product 1', serverVersion: 7 })
    await seedProduct(BUSINESS_A, { name: 'Filter Product 2', serverVersion: 10 })

    // Operational filtered read
    const filtered = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_A}&category=Electronics`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(filtered.body.items).toHaveLength(0)
    expect(filtered.body.total).toBe(0)

    // Sync endpoint unaffected — returns current_version
    const sync = await request(app)
      .get(`/v1/sync/products?business_id=${BUSINESS_A}&after_version=0&limit=100`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(sync.body.items).toHaveLength(2)
    expect(sync.body.current_version).toBe(10)
  })

  // ---------------------------------------------------------------------------
  // PRODUCT-READ-015: existing product create/update tests remain green
  // ---------------------------------------------------------------------------
  it('PRODUCT-READ-015 existing product create/update remain green', async () => {
    const idempotencyKey = randomUUID()

    // Create product via sync endpoint (includes sku/cost_minor)
    const createRes = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Integration Product',
        price_minor: 15000,
        sku: 'SKU-INT-001',
        cost_minor: 8000,
      })
      .expect(201)

    expect(createRes.body.sku).toBe('SKU-INT-001')
    expect(createRes.body.cost_minor).toBe(8000)
    expect(createRes.body.server_version).toBe(1)

    const productId = createRes.body.id

    // Update product via sync endpoint
    const updateRes = await request(app)
      .put(`/v1/sync/products/${productId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: BUSINESS_A,
        expected_server_version: 1,
        sku: 'SKU-UPDATED',
        cost_minor: 9000,
      })
      .expect(200)

    expect(updateRes.body.sku).toBe('SKU-UPDATED')
    expect(updateRes.body.cost_minor).toBe(9000)
    expect(updateRes.body.server_version).toBe(2)

    // Read via operational endpoint
    const detailRes = await request(app)
      .get(`/v1/products/${productId}?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(detailRes.body.sku).toBe('SKU-UPDATED')
    expect(detailRes.body.cost_minor).toBe(9000)
  })

  // ---------------------------------------------------------------------------
  // BONUS: CASHIER can read products list (RBAC read for both OWNER and CASHIER)
  // ---------------------------------------------------------------------------
  it('BONUS-001 CASHIER can read product list', async () => {
    await seedProduct(BUSINESS_A, { name: 'Cashier Product' })

    const res = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(1)
  })

  // ---------------------------------------------------------------------------
  // BONUS: CASHIER can read product detail
  // ---------------------------------------------------------------------------
  it('BONUS-002 CASHIER can read product detail', async () => {
    const productId = await seedProduct(BUSINESS_A, { name: 'Cashier Detail Product' })

    const res = await request(app)
      .get(`/v1/products/${productId}?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .expect(200)

    expect(res.body.id).toBe(productId)
  })

  // ---------------------------------------------------------------------------
  // BONUS: barcode exact filter (not search)
  // ---------------------------------------------------------------------------
  it('BONUS-003 barcode exact filter', async () => {
    await seedProduct(BUSINESS_A, { name: 'Product A', barcode: 'BC-EXACT' })
    await seedProduct(BUSINESS_A, { name: 'Product B', barcode: 'BC-OTHER' })

    const res = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_A}&barcode=BC-EXACT`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].barcode).toBe('BC-EXACT')
  })

  // ---------------------------------------------------------------------------
  // BONUS: combined search + category filter
  // ---------------------------------------------------------------------------
  it('BONUS-004 combined search + category filter', async () => {
    await seedProduct(BUSINESS_A, { name: 'Widget Electronics', category: 'Electronics', sku: 'SKU-W1' })
    await seedProduct(BUSINESS_A, { name: 'Widget Food', category: 'Food', sku: 'SKU-W2' })
    await seedProduct(BUSINESS_A, { name: 'Gadget Electronics', category: 'Electronics', sku: 'SKU-G1' })

    const res = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_A}&search=Widget&category=Electronics`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].name).toBe('Widget Electronics')
  })
})
