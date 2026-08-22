import path from 'path'
import { randomUUID, createHash } from 'crypto'
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
  options: { name?: string; phone?: string | null; email?: string | null; serverVersion?: number } = {}
): Promise<string> {
  const id = randomUUID()
  const serverVersion = options.serverVersion ?? 1
  await pool.query(
    `INSERT INTO customers (id, business_id, name, phone, email, server_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
    [
      id,
      businessId,
      options.name ?? `Customer ${id.slice(0, 8)}`,
      options.phone ?? null,
      options.email ?? null,
      serverVersion,
    ]
  )
  return id
}

// ---------------------------------------------------------------------------
// Request hash helpers (must match server-side canonical computation)
// ---------------------------------------------------------------------------

function computeCreateHash(body: { business_id: string; id: string; name: string; phone: string | null; email: string | null }): string {
  const hashStr = `create|${body.business_id}|${body.id}|${body.name}|${body.phone ?? 'null'}|${body.email ?? 'null'}`
  return createHash('sha256').update(hashStr).digest('hex')
}

function computeUpdateHash(body: { business_id: string; expected_server_version: number; name?: string; phone?: string | null; email?: string | null }, customerId: string): string {
  const hashStr = `update|${body.business_id}|${customerId}|${body.expected_server_version}|${body.name ?? 'null'}|${body.phone ?? 'null'}|${body.email ?? 'null'}`
  return createHash('sha256').update(hashStr).digest('hex')
}

function computeDeleteHash(businessId: string, customerId: string): string {
  const hashStr = `delete|${businessId}|${customerId}`
  return createHash('sha256').update(hashStr).digest('hex')
}

// Helper for legacy tests to create valid requests with idempotency
function makeCreateBody(overrides: Partial<{ id: string; business_id: string; name: string; phone: string | null; email: string | null }> = {}): { id: string; business_id: string; name: string; phone: string | null; email: string | null } {
  return {
    id: randomUUID(),
    business_id: BUSINESS_A,
    name: 'Test Customer',
    phone: null,
    email: null,
    ...overrides,
  }
}

function makeUpdateBody(overrides: Partial<{ business_id: string; expected_server_version: number; name?: string; phone?: string | null; email?: string | null }> = {}): { business_id: string; expected_server_version: number; name?: string; phone?: string | null; email?: string | null } {
  return {
    business_id: BUSINESS_A,
    expected_server_version: 1,
    ...overrides,
  }
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
    const body = makeCreateBody({ name: 'Dana', phone: '+62812345678', email: 'dana@example.com' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(201)

    expect(res.body.id).toBe(body.id)
    expect(res.body.business_id).toBe(BUSINESS_A)
    expect(res.body.name).toBe('Dana')
    expect(res.body.phone).toBe('+62812345678')
    expect(res.body.email).toBe('dana@example.com')
    expect(res.body.created_at).toBeDefined()
    expect(res.body.updated_at).toBeDefined()
    expect(res.body.deleted_at).toBeNull()
  })

  // ---- CUSTOMER-004: CASHIER cannot create ----
  it('CUSTOMER-004 CASHIER create customer returns 403', async () => {
    const body = makeCreateBody({ name: 'Eve' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })

  // ---- CUSTOMER-005: OWNER can update customer ----
  it('CUSTOMER-005 OWNER can update customer', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'Frank', serverVersion: 1 })

    const body = makeUpdateBody({ name: 'Frank Updated', email: 'frank@example.com' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .put(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(200)

    expect(res.body.id).toBe(id)
    expect(res.body.name).toBe('Frank Updated')
    expect(res.body.email).toBe('frank@example.com')
    expect(res.body.server_version).toBe(2)
  })

  // ---- CUSTOMER-006: CASHIER cannot update ----
  it('CUSTOMER-006 CASHIER update customer returns 403', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'Grace' })

    const body = makeUpdateBody({ name: 'Grace Updated' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .put(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })

  // ---- CUSTOMER-007: OWNER can soft-delete customer ----
  it('CUSTOMER-007 OWNER can soft-delete customer', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'Heidi' })

    const idempotencyKey = randomUUID()

    await request(app)
      .delete(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
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

    const idempotencyKey = randomUUID()

    const res = await request(app)
      .delete(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
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
    const body = makeCreateBody({ name: '   ' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.name).toBeDefined()
  })

  // ---- CUSTOMER-012: invalid email rejected ----
  it('CUSTOMER-012 invalid email on create returns 400 VALIDATION_ERROR', async () => {
    const body = makeCreateBody({ name: 'Karl', email: 'not-an-email' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
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
    const idempotencyKey = randomUUID()
    await request(app)
      .delete(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
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

// ============================================================================
// Phase 4.1.39 Track B0: Customer Mutation Contract Hardening Tests
// ============================================================================

describe('Phase 4.1.39 Track B0 Customer Mutation Contract', () => {

  // ---- B0-01: Customer create success ----
  it('B0-01 customer create success with idempotency key', async () => {
    const idempotencyKey = randomUUID()
    const customerId = randomUUID()
    const body = {
      id: customerId,
      business_id: BUSINESS_A,
      name: 'Test Customer',
      phone: '+62812345678',
      email: 'test@example.com',
    }
    const requestHash = computeCreateHash(body)

    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(201)

    expect(res.body.id).toBe(customerId)
    expect(res.body.business_id).toBe(BUSINESS_A)
    expect(res.body.name).toBe('Test Customer')
    expect(res.body.server_version).toBe(1)
    expect(res.body.deleted_at).toBeNull()
  })

  // ---- B0-02: Duplicate customer id with different idempotency key ----
  it('B0-02 duplicate customer id with different idempotency key returns 409 CUSTOMER_ID_CONFLICT', async () => {
    const customerId = randomUUID()
    const body = {
      id: customerId,
      business_id: BUSINESS_A,
      name: 'Test Customer',
      phone: null,
      email: null,
    }

    // First create
    await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send(body)
      .expect(201)

    // Second create with same id, different idempotency key
    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', randomUUID())
      .send(body)
      .expect(409)

    expect(res.body.error.code).toBe('CUSTOMER_ID_CONFLICT')
    expect(res.body.error.details.existing_customer_id).toBe(customerId)
  })

  // ---- B0-03: Create replay (same idempotency key, same request) ----
  it('B0-03 create replay with same idempotency key returns original response', async () => {
    const idempotencyKey = randomUUID()
    const customerId = randomUUID()
    const body = {
      id: customerId,
      business_id: BUSINESS_A,
      name: 'Replay Test',
      phone: null,
      email: null,
    }
    const requestHash = computeCreateHash(body)

    // First request
    const res1 = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(201)

    // Replay with same key
    const res2 = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(201)

    // Should return identical response
    expect(res2.body).toEqual(res1.body)
  })

  // ---- B0-04: Idempotency key reuse with different request hash ----
  it('B0-04 idempotency key reuse with different payload returns 409 IDEMPOTENCY_KEY_REUSE', async () => {
    const idempotencyKey = randomUUID()
    const customerId1 = randomUUID()
    const customerId2 = randomUUID()

    const body1 = {
      id: customerId1,
      business_id: BUSINESS_A,
      name: 'Customer One',
      phone: null,
      email: null,
    }

    const body2 = {
      id: customerId2,
      business_id: BUSINESS_A,
      name: 'Customer Two',
      phone: null,
      email: null,
    }

    // First request
    await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body1)
      .expect(201)

    // Second request with same key but different payload
    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body2)
      .expect(409)

    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSE')
    expect(res.body.error.details.idempotency_key).toBe(idempotencyKey)
  })

  // ---- B0-05: Update success ----
  it('B0-05 update success with correct expected_server_version', async () => {
    // Seed customer with server_version = 1
    const id = await seedCustomer(BUSINESS_A, { name: 'Original', serverVersion: 1 })

    const idempotencyKey = randomUUID()
    const body = {
      business_id: BUSINESS_A,
      expected_server_version: 1,
      name: 'Updated Name',
    }
    const requestHash = computeUpdateHash(body, id)

    const res = await request(app)
      .put(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(200)

    expect(res.body.id).toBe(id)
    expect(res.body.name).toBe('Updated Name')
    expect(res.body.server_version).toBe(2)
  })

  // ---- B0-06: Stale update conflict ----
  it('B0-06 stale update with wrong expected_server_version returns 409 CUSTOMER_VERSION_CONFLICT', async () => {
    // Seed customer with server_version = 1
    const id = await seedCustomer(BUSINESS_A, { name: 'Original', serverVersion: 1 })

    const idempotencyKey = randomUUID()
    const body = {
      business_id: BUSINESS_A,
      expected_server_version: 999, // Stale version
      name: 'Should Fail',
    }
    const requestHash = computeUpdateHash(body, id)

    const res = await request(app)
      .put(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(409)

    expect(res.body.error.code).toBe('CUSTOMER_VERSION_CONFLICT')
    expect(res.body.error.details.expected_server_version).toBe(999)
    expect(res.body.error.details.current_server_version).toBe(1)
    expect(res.body.error.details.current_customer).toBeDefined()
    expect(res.body.error.details.current_customer.id).toBe(id)
  })

  // ---- B0-07: Update replay ----
  it('B0-07 update replay with same idempotency key returns original response', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'Original', serverVersion: 1 })

    const idempotencyKey = randomUUID()
    const body = {
      business_id: BUSINESS_A,
      expected_server_version: 1,
      name: 'Updated Once',
    }
    const requestHash = computeUpdateHash(body, id)

    // First update
    const res1 = await request(app)
      .put(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(200)

    // Replay with same key
    const res2 = await request(app)
      .put(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(200)

    // Should return identical response (server_version stays at 2)
    expect(res2.body).toEqual(res1.body)
    expect(res2.body.server_version).toBe(2)
  })

  // ---- B0-08: Delete success ----
  it('B0-08 delete success with idempotency key', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'To Delete', serverVersion: 5 })

    const idempotencyKey = randomUUID()
    const requestHash = computeDeleteHash(BUSINESS_A, id)

    await request(app)
      .delete(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .expect(204)

    // Verify deleted (404 on detail)
    await request(app)
      .get(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(404)
  })

  // ---- B0-09: Delete replay ----
  it('B0-09 delete replay with same idempotency key returns 204', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'To Delete', serverVersion: 5 })

    const idempotencyKey = randomUUID()
    const requestHash = computeDeleteHash(BUSINESS_A, id)

    // First delete
    await request(app)
      .delete(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .expect(204)

    // Replay with same key
    await request(app)
      .delete(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .expect(204)
  })

  // ---- B0-10: Cross-business access denied ----
  it('B0-10 cross-business access on create returns 403 BUSINESS_ACCESS_DENIED', async () => {
    const idempotencyKey = randomUUID()
    const body = {
      id: randomUUID(),
      business_id: BUSINESS_B, // Different business
      name: 'Cross Business',
      phone: null,
      email: null,
    }
    const requestHash = computeCreateHash(body)

    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(403)

    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  // ---- B0-11: Tenant isolation ----
  it('B0-11 tenant isolation: cannot access other business customer', async () => {
    // Create customer in Business B
    const idInB = await seedCustomer(BUSINESS_B, { name: 'Business B Customer', serverVersion: 1 })

    // Owner of Business A tries to update Business B customer
    const idempotencyKey = randomUUID()
    const body = {
      business_id: BUSINESS_A, // Owner's business
      expected_server_version: 1,
      name: 'Hack Attempt',
    }
    const requestHash = computeUpdateHash(body, idInB)

    const res = await request(app)
      .put(`/v1/customers/${idInB}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(404) // Returns 404 to avoid existence leakage

    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  // ---- B0-12: Delete increments server_version ----
  it('B0-12 delete increments server_version for sync', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'Version Test', serverVersion: 10 })

    const idempotencyKey = randomUUID()
    const requestHash = computeDeleteHash(BUSINESS_A, id)

    await request(app)
      .delete(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .expect(204)

    // Verify server_version was incremented by checking sync endpoint
    const syncRes = await request(app)
      .get('/v1/sync/customers')
      .query({ business_id: BUSINESS_A, after_version: 9, limit: 50 })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    // Should find the deleted customer (tombstone) at version 11
    const deletedCustomer = syncRes.body.items.find((c: any) => c.id === id)
    expect(deletedCustomer).toBeDefined()
    expect(deletedCustomer.server_version).toBe(11)
    expect(deletedCustomer.deleted_at).not.toBeNull()
  })

  // ---- B0-13: Deleted customer appears in sync as tombstone ----
  it('B0-13 deleted customer appears in sync as tombstone', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'Tombstone Test', serverVersion: 3 })

    const idempotencyKey = randomUUID()
    const requestHash = computeDeleteHash(BUSINESS_A, id)

    await request(app)
      .delete(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .expect(204)

    // Sync should return the tombstone
    const syncRes = await request(app)
      .get('/v1/sync/customers')
      .query({ business_id: BUSINESS_A, after_version: 2, limit: 50 })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    const tombstone = syncRes.body.items.find((c: any) => c.id === id)
    expect(tombstone).toBeDefined()
    expect(tombstone.deleted_at).not.toBeNull()
    expect(tombstone.name).toBe('Tombstone Test')
  })

  // ---- B0-14: Tombstone advances cursor ----
  it('B0-14 tombstone advances sync cursor (current_version)', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'Cursor Test', serverVersion: 5 })

    const idempotencyKey = randomUUID()
    const requestHash = computeDeleteHash(BUSINESS_A, id)

    await request(app)
      .delete(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .expect(204)

    // Sync after delete should have current_version >= 6
    const syncRes = await request(app)
      .get('/v1/sync/customers')
      .query({ business_id: BUSINESS_A, after_version: 0, limit: 50 })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(syncRes.body.current_version).toBeGreaterThanOrEqual(6)
    expect(syncRes.body.has_more).toBe(false)
  })

  // ---- B0-15: Request hash mismatch / reuse behavior ----
  it('B0-15 update with idempotency key reuse and different payload returns 409', async () => {
    const id = await seedCustomer(BUSINESS_A, { name: 'Original', serverVersion: 1 })

    const idempotencyKey = randomUUID()

    // First update
    const body1 = {
      business_id: BUSINESS_A,
      expected_server_version: 1,
      name: 'First Update',
    }
    const hash1 = computeUpdateHash(body1, id)

    await request(app)
      .put(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body1)
      .expect(200)

    // Second update with SAME key but DIFFERENT payload (different name)
    const body2 = {
      business_id: BUSINESS_A,
      expected_server_version: 2, // Note: version is now 2
      name: 'Second Update',
    }
    const hash2 = computeUpdateHash(body2, id)

    const res = await request(app)
      .put(`/v1/customers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body2)
      .expect(409)

    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSE')
  })
})
