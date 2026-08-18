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
let tokenAOwner!: string
let tokenACashier!: string
let tokenBOwner!: string

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
}

async function seedProduct(businessId: string): Promise<string> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO products (id, business_id, name, price_minor, is_active, server_version, created_at, updated_at)
     VALUES ($1, $2, $3, 100, TRUE, 1, now(), now())`,
    [id, businessId, `Product ${id.substring(0,8)}`]
  )
  return id
}

describe('Inventory MVP V1 API', () => {
  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL!)
    
    const dbName = pool.options.database
    if (dbName === 'biz_erp_prod' || dbName === 'biz_erp_prod_clone') {
      throw new Error('TESTS MUST NOT RUN ON PRODUCTION DB. Check your DATABASE_URL.')
    }
    await runMigrations(pool)
    app = createApp(pool)
  })

  afterAll(async () => {
    await pool.end()
  })

  beforeEach(async () => {
    await resetDatabase()

    const u1 = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
    const { accessToken: ta } = await authenticateTestUser(app, u1.email, u1.password, BUSINESS_A)
    tokenAOwner = ta

    const u2 = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
    const { accessToken: tc } = await authenticateTestUser(app, u2.email, u2.password, BUSINESS_A)
    tokenACashier = tc

    const u3 = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER' })
    const { accessToken: tb } = await authenticateTestUser(app, u3.email, u3.password, BUSINESS_B)
    tokenBOwner = tb
  })

  describe('Branch Foundation & Isolation', () => {
    it('should create a branch and isolate by tenant', async () => {
      // create branch in business A
      const b1 = await request(app)
        .post('/v1/branches')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .send({
          id: randomUUID(),
          business_id: BUSINESS_A,
          name: 'Branch A1'
        })
        .expect(201)

      expect(b1.body.name).toBe('Branch A1')

      // create branch in business B
      const b2 = await request(app)
        .post('/v1/branches')
        .set('Authorization', `Bearer ${tokenBOwner}`)
        .send({
          id: randomUUID(),
          business_id: BUSINESS_B,
          name: 'Branch B1'
        })
        .expect(201)

      // tenant A cannot fetch tenant B's branches
      const resA = await request(app)
        .get('/v1/branches')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .query({ business_id: BUSINESS_A })
        .expect(200)

      expect(resA.body.items).toHaveLength(1)
      expect(resA.body.items[0].id).toBe(b1.body.id)

      // Business B token trying to create for Business A
      await request(app)
        .post('/v1/branches')
        .set('Authorization', `Bearer ${tokenBOwner}`)
        .send({
          id: randomUUID(),
          business_id: BUSINESS_A,
          name: 'Branch Hacker'
        })
        .expect(403)
    })
  })

  describe('RBAC (OWNER vs CASHIER)', () => {
    let branchId: string
    let productId: string

    beforeEach(async () => {
      branchId = randomUUID()
      await request(app)
        .post('/v1/branches')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .send({ id: branchId, business_id: BUSINESS_A, name: 'Store A' })
        
      productId = await seedProduct(BUSINESS_A)
    })

    it('cashier can read branches and stocks, but not movements', async () => {
      // Read branches
      await request(app)
        .get('/v1/branches')
        .set('Authorization', `Bearer ${tokenACashier}`)
        .query({ business_id: BUSINESS_A })
        .expect(200)

      // Read stocks
      await request(app)
        .get('/v1/inventory/stocks')
        .set('Authorization', `Bearer ${tokenACashier}`)
        .query({ business_id: BUSINESS_A, branch_id: branchId })
        .expect(200)

      // Read movements - Denied
      await request(app)
        .get('/v1/inventory/movements')
        .set('Authorization', `Bearer ${tokenACashier}`)
        .query({ business_id: BUSINESS_A, branch_id: branchId })
        .expect(403)
    })

    it('cashier cannot adjust stock', async () => {
      await request(app)
        .post('/v1/inventory/adjustment')
        .set('Authorization', `Bearer ${tokenACashier}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          branch_id: branchId,
          product_id: productId,
          quantity_change: 10,
          expected_server_version: 0
        })
        .expect(403)
    })
  })

  describe('Inventory Adjustments (Concurrency, Negative Stock, Isolation, Idempotency)', () => {
    let branchId: string
    let productId: string

    beforeEach(async () => {
      branchId = randomUUID()
      await request(app)
        .post('/v1/branches')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .send({ id: branchId, business_id: BUSINESS_A, name: 'Store A' })
        
      productId = await seedProduct(BUSINESS_A)
    })

    it('creates new stock and prevents negative stock', async () => {
      // Negative new stock
      await request(app)
        .post('/v1/inventory/adjustment')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          branch_id: branchId,
          product_id: productId,
          quantity_change: -5,
          expected_server_version: 0
        })
        .expect(400)

      // Valid new stock
      const res = await request(app)
        .post('/v1/inventory/adjustment')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          branch_id: branchId,
          product_id: productId,
          quantity_change: 10,
          expected_server_version: 0
        })
        .expect(201)
      
      expect(res.body.stock.quantity).toBe(10)
      expect(res.body.stock.server_version).toBe(1)
      expect(res.body.movement.quantity).toBe(10)
      expect(res.body.movement.movement_type).toBe('ADJUSTMENT')
    })

    it('handles idempotent replays and detects conflicts', async () => {
      const ikey = randomUUID()
      const payload = {
        business_id: BUSINESS_A,
        branch_id: branchId,
        product_id: productId,
        quantity_change: 15,
        expected_server_version: 0
      }

      // First call
      const res1 = await request(app)
        .post('/v1/inventory/adjustment')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('Idempotency-Key', ikey)
        .send(payload)
        .expect(201)

      // Second call same payload -> 200 Replay
      const res2 = await request(app)
        .post('/v1/inventory/adjustment')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('Idempotency-Key', ikey)
        .send(payload)
        .expect(200) // The code we wrote returns 200 for replayed

      expect(res2.body.stock.quantity).toBe(15)

      // Same key, different payload -> 409
      await request(app)
        .post('/v1/inventory/adjustment')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('Idempotency-Key', ikey)
        .send({ ...payload, quantity_change: 20 })
        .expect(409)
    })

    it('handles optimistic concurrency successfully', async () => {
      await request(app)
        .post('/v1/inventory/adjustment')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          branch_id: branchId,
          product_id: productId,
          quantity_change: 10,
          expected_server_version: 0
        })
        .expect(201)

      // Concurrent adjustment
      const p1 = request(app)
        .post('/v1/inventory/adjustment')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          branch_id: branchId,
          product_id: productId,
          quantity_change: 5,
          expected_server_version: 1
        })
      const p2 = request(app)
        .post('/v1/inventory/adjustment')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          branch_id: branchId,
          product_id: productId,
          quantity_change: 2,
          expected_server_version: 1
        })

      const [r1, r2] = await Promise.all([p1, p2])

      // One should succeed (201), one should fail (409)
      const statuses = [r1.status, r2.status]
      expect(statuses).toContain(201)
      expect(statuses).toContain(409)

      // Total quantity should be 10 + successful amount (5 or 2)
      const getRes = await request(app)
        .get('/v1/inventory/stocks')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .query({ business_id: BUSINESS_A, branch_id: branchId })

      const finalQuantity = getRes.body.items[0].quantity
      expect([12, 15]).toContain(finalQuantity)
      expect(getRes.body.items[0].server_version).toBe(2)
    })

    it('prevents cross business adjustment (product isolation)', async () => {
      // Business B trying to adjust Business A product
      await request(app)
        .post('/v1/inventory/adjustment')
        .set('Authorization', `Bearer ${tokenBOwner}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_B,
          branch_id: branchId, // this branch is Business A
          product_id: productId, // this product is Business A
          quantity_change: 10,
          expected_server_version: 0
        })
        .expect(400) // Should say Branch not found (isolated query)
    })

    it('stock creation race is prevented via unique constraint', async () => {
      // Mock two creations with version 0 simultaneously
      const p1 = request(app)
        .post('/v1/inventory/adjustment')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('Idempotency-Key', randomUUID())
        .send({ business_id: BUSINESS_A, branch_id: branchId, product_id: productId, quantity_change: 10, expected_server_version: 0 })
        
      const p2 = request(app)
        .post('/v1/inventory/adjustment')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('Idempotency-Key', randomUUID())
        .send({ business_id: BUSINESS_A, branch_id: branchId, product_id: productId, quantity_change: 20, expected_server_version: 0 })

      const [r1, r2] = await Promise.all([p1, p2])
      const statuses = [r1.status, r2.status]
      expect(statuses).toContain(201)
      expect(statuses).toContain(409) // Second one hits unique violation constraint
    })

    it('enforces immutable movements', async () => {
      // create stock
      const res = await request(app)
        .post('/v1/inventory/adjustment')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          business_id: BUSINESS_A,
          branch_id: branchId,
          product_id: productId,
          quantity_change: 10,
          expected_server_version: 0
        })
        .expect(201)
        
      const movementId = res.body.movement.id
      
      // Attempt manual UPDATE on db
      await expect(
        pool.query(`UPDATE stock_movements SET quantity = 99 WHERE id = $1`, [movementId])
      ).rejects.toThrow(/stock_movements tables are append-only/)

      // Attempt manual DELETE on db
      await expect(
        pool.query(`DELETE FROM stock_movements WHERE id = $1`, [movementId])
      ).rejects.toThrow(/stock_movements tables are append-only/)
    })
  })
})
