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

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let pool!: Pool
let app!: Express
let ownerTokenA!: string
let cashierTokenA!: string
let ownerTokenB!: string

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      customers,
      sale_items,
      sales,
      idempotency_keys,
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
}

async function seedCustomer(
  businessId: string,
  options: { name?: string; phone?: string | null; email?: string | null } = {}
): Promise<string> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO customers (id, business_id, name, phone, email, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, now(), now())`,
    [
      id,
      businessId,
      options.name ?? `Customer ${id.slice(0, 8)}`,
      options.phone ?? null,
      options.email ?? null,
    ]
  )
  return id
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

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

  // OWNER for Business A
  const ownerA = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  const authOwnerA = await authenticateTestUser(app, ownerA.email, ownerA.password, BUSINESS_A)
  ownerTokenA = authOwnerA.accessToken

  // CASHIER for Business A
  const cashierA = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  const authCashierA = await authenticateTestUser(app, cashierA.email, cashierA.password, BUSINESS_A)
  cashierTokenA = authCashierA.accessToken

  // OWNER for Business B
  const ownerB = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER' })
  const authOwnerB = await authenticateTestUser(app, ownerB.email, ownerB.password, BUSINESS_B)
  ownerTokenB = authOwnerB.accessToken
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 4.1.11B Customer API', () => {

  // ---- CUSTOMER-001: OWNER can list customers ----
  it('CUSTOMER-001 OWNER can list customers', async () => {
    await seedCustomer(BUSINESS_A, { name: 'Alice' })
    await seedCustomer(BUSINESS_A, { name: 'Bob' })

    const res = await request(app)
      .get(`/v1/customers?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items).toHaveLength(2)
    expect(typeof res.body.total).toBe('number')
    expect(res.body.total).toBe(2)
    expect(typeof res.body.limit).toBe('number')
    expect(typeof res.body.offset).toBe('number')
    expect(typeof res.body.has_more).toBe('boolean')
  })

  // ---- CUSTOMER-002: CASHIER can list customers ----
  it('CUSTOMER-002 CASHIER can list customers', async () => {
    await seedCustomer(BUSINESS_A, { name: 'Charlie' })

    const res = await request(app)
      .get(`/v1/customers?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .expect(200)

    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items).toHaveLength(1)
  })

  // ---- CUSTOMER-003: OWNER can create customer ----
  it('CUSTOMER-003 OWNER can create customer', async () => {
    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: BUSINESS_A,
        name: 'Dana',
        phone: '+62812345678',
        email: 'dana@example.com',
      })
      .expect(201)

    expect(res.body.id).toBeDefined()
    expect(res.body.business_id).toBe(BUSINESS_A)
    expect(res.body.name).toBe('Dana')
    expect(res.body.phone).toBe('+62812345678')
    expect(res.body.email).toBe('dana@example.com')
    expect(res.body.created_at).toBeDefined()
    expect(res.body.updated_at).toBeDefined()
    expect(res.body.deleted_at).toBeUndefined()
  })

  // ---- CUSTOMER-004: CASHIER cannot create ----
  it('CUSTOMER-004 CASHIER create customer returns 403', async () => {
    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({ business_id: BUSINESS_A, name: 'Eve' })
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })

  // ---- CUSTOMER-005: OWNER can update customer ----
  it('CUSTOMER-005 OWNER can update customer', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'Frank' })

    const res = await request(app)
      .put(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ business_id: BUSINESS_A, name: 'Frank Updated', email: 'frank@example.com' })
      .expect(200)

    expect(res.body.id).toBe(id)
    expect(res.body.name).toBe('Frank Updated')
    expect(res.body.email).toBe('frank@example.com')
  })

  // ---- CUSTOMER-006: CASHIER cannot update ----
  it('CUSTOMER-006 CASHIER update customer returns 403', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'Grace' })

    const res = await request(app)
      .put(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({ business_id: BUSINESS_A, name: 'Grace Updated' })
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })

  // ---- CUSTOMER-007: OWNER can soft-delete customer ----
  it('CUSTOMER-007 OWNER can soft-delete customer', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'Heidi' })

    await request(app)
      .delete(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(204)

    // Confirm it's gone from detail
    await request(app)
      .get(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(404)
  })

  // ---- CUSTOMER-008: CASHIER cannot delete ----
  it('CUSTOMER-008 CASHIER delete customer returns 403', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'Ivan' })

    const res = await request(app)
      .delete(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })

  // ---- CUSTOMER-009: cross-tenant access returns 404 ----
  it('CUSTOMER-009 cross-tenant customer access returns 404', async () => {
    // Seed a customer in Business B
    const idInB = await seedCustomer(BUSINESS_B, { name: 'Judy' })

    // Owner of Business A tries to access Business B customer by id
    await request(app)
      .get(`/v1/customers/${idInB}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(404)
  })

  // ---- CUSTOMER-010: business_id mismatch returns 403 ----
  it('CUSTOMER-010 business_id mismatch in list returns 403', async () => {
    const res = await request(app)
      .get(`/v1/customers?business_id=${BUSINESS_B}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(403)

    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  // ---- CUSTOMER-011: empty name rejected ----
  it('CUSTOMER-011 empty name on create returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ business_id: BUSINESS_A, name: '   ' })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.name).toBeDefined()
  })

  // ---- CUSTOMER-012: invalid email rejected ----
  it('CUSTOMER-012 invalid email on create returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ business_id: BUSINESS_A, name: 'Karl', email: 'not-an-email' })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.email).toBeDefined()
  })

  // ---- CUSTOMER-013: pagination works ----
  it('CUSTOMER-013 list pagination returns correct page', async () => {
    // Seed 5 customers
    for (let i = 0; i < 5; i++) {
      await seedCustomer(BUSINESS_A, { name: `Customer ${i}` })
    }

    // Page 1: limit=2, offset=0
    const page1 = await request(app)
      .get(`/v1/customers?business_id=${BUSINESS_A}&limit=2&offset=0`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(page1.body.items).toHaveLength(2)
    expect(page1.body.total).toBe(5)
    expect(page1.body.limit).toBe(2)
    expect(page1.body.offset).toBe(0)
    expect(page1.body.has_more).toBe(true)

    // Page 3: limit=2, offset=4 (last page, 1 item)
    const page3 = await request(app)
      .get(`/v1/customers?business_id=${BUSINESS_A}&limit=2&offset=4`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(page3.body.items).toHaveLength(1)
    expect(page3.body.has_more).toBe(false)
  })

  // ---- CUSTOMER-014: missing customer returns 404 ----
  it('CUSTOMER-014 detail for nonexistent customer returns 404', async () => {
    const fakeId = randomUUID()

    const res = await request(app)
      .get(`/v1/customers/${fakeId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(404)

    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  // ---- CUSTOMER-015: soft-deleted customer excluded ----
  it('CUSTOMER-015 soft-deleted customer excluded from list', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'Laura' })
    await seedCustomer(BUSINESS_A, { name: 'Mike' })

    // Soft-delete Laura
    await request(app)
      .delete(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(204)

    // List should show only Mike
    const res = await request(app)
      .get(`/v1/customers?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.total).toBe(1)
    expect(res.body.items[0].name).toBe('Mike')
  })

  // ---- CUSTOMER-016: X-Request-Id present ----
  it('CUSTOMER-016 X-Request-Id present on customer responses', async () => {
    const res = await request(app)
      .get(`/v1/customers?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.headers['x-request-id']).toBeDefined()
    expect(typeof res.headers['x-request-id']).toBe('string')
    expect(res.headers['x-request-id'].length).toBeGreaterThan(0)
  })
})
