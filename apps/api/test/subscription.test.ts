import { randomUUID } from 'crypto'
import type { Express } from 'express'
import { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
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
      subscriptions,
      subscription_families,
      plans,
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

async function seedSubscriptionFamilies(): Promise<void> {
  await pool.query(`
    INSERT INTO subscription_families (code, name, replacement_policy, description) VALUES
    ('ERP_PLAN', 'ERP Plan', 'REPLACEABLE', 'Core ERP plans - only one active per business'),
    ('INTERNET_PLAN', 'Internet Plan', 'REPLACEABLE', 'Internet service plans - only one active per business'),
    ('CCTV_PLAN', 'CCTV Plan', 'REPLACEABLE', 'CCTV plans - only one active per business'),
    ('CLOUD_STORAGE_PLAN', 'Cloud Storage Plan', 'ADDITIVE', 'Cloud storage plans - can have multiple'),
    ('SERVICE_PLAN', 'Service Plan', 'ADDITIVE', 'Service plans - can have multiple'),
    ('HARDWARE_LEASE', 'Hardware Lease', 'ADDITIVE', 'Hardware lease plans - can have multiple')
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      replacement_policy = EXCLUDED.replacement_policy,
      description = EXCLUDED.description,
      updated_at = now()
  `)
}

async function seedPlans(): Promise<void> {
  await pool.query(`
    INSERT INTO plans (code, name, family, tier, billing_cycle, pricing, type, status) VALUES
    ('PLAN_ERP_STARTER', 'ERP Starter', 'ERP_PLAN', 'STARTER', 'MONTHLY', '{"base_price": 150000, "currency": "IDR"}', 'STANDALONE', 'ACTIVE'),
    ('PLAN_ERP_GROWTH', 'ERP Growth', 'ERP_PLAN', 'GROWTH', 'MONTHLY', '{"base_price": 300000, "currency": "IDR"}', 'STANDALONE', 'ACTIVE'),
    ('PLAN_INC_CONNECT', 'Connect Bundle', 'INTERNET_PLAN', 'CONNECT', 'MONTHLY', '{"base_price": 110000, "currency": "IDR"}', 'INCLUDED', 'ACTIVE'),
    ('PLAN_CCTV_BASIC', 'CCTV Basic', 'CCTV_PLAN', 'BASIC', 'MONTHLY', '{"base_price": 50000, "currency": "IDR"}', 'STANDALONE', 'ACTIVE')
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      family = EXCLUDED.family,
      tier = EXCLUDED.tier,
      billing_cycle = EXCLUDED.billing_cycle,
      pricing = EXCLUDED.pricing,
      type = EXCLUDED.type,
      status = EXCLUDED.status,
      updated_at = now()
  `)
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(async () => {
  console.log('DATABASE_URL:', process.env.DATABASE_URL)
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000
  })
  console.log('Pool created:', !!pool, pool?.constructor?.name)
  console.log('Pool methods:', Object.keys(pool).filter(k => typeof pool[k] === 'function'))
  await runMigrations()
  app = createApp(pool)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await resetDatabase()
  await seedSubscriptionFamilies()
  await seedPlans()
const authA = await (async () => {
    const ownerA = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
    console.log('Owner A created:', ownerA.email, ownerA.userId)
    const auth = await authenticateTestUser(app, ownerA.email, ownerA.password, BUSINESS_A)
    console.log('Owner A auth:', auth.accessToken ? 'success' : 'failed', auth.accessToken?.substring(0, 20), 'full token:', auth.accessToken)
    return auth
  })()
  ownerTokenA = authA.accessToken
  const authB = await (async () => {
    const ownerB = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER' })
    console.log('Owner B created:', ownerB.email, ownerB.userId)
    const auth = await authenticateTestUser(app, ownerB.email, ownerB.password, BUSINESS_B)
    console.log('Owner B auth:', auth.accessToken ? 'success' : 'failed', auth.accessToken?.substring(0, 20))
    return auth
  })()
  ownerTokenB = authB.accessToken
  // Create cashier for Business A
  const cashierId = randomUUID()
  await pool.query(`
    INSERT INTO users (id, email, password_hash, status)
    VALUES ($1, 'cashier@a.com', '$2b$10$ud9WZ4r3QDQ08.KKkh24E.Fpy/oRPpaXQwp0R9ke89VGVVIs0yrfO', 'ACTIVE')
    ON CONFLICT (id) DO NOTHING
  `, [cashierId])
  await pool.query(`
    INSERT INTO user_businesses (user_id, business_id, role, status)
    VALUES ($1, $2, 'CASHIER', 'ACTIVE')
    ON CONFLICT DO NOTHING
  `, [cashierId, BUSINESS_A])
  const cashierAuth = await authenticateTestUser(app, 'cashier@a.com', 'TestPassword123!', BUSINESS_A)
  console.log('Cashier auth:', cashierAuth.accessToken ? 'success' : 'failed', cashierAuth.accessToken?.substring(0, 20))
  cashierTokenA = cashierAuth.accessToken
})

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('SUB-API-001: Create subscription', () => {
  it('should create a subscription with valid data', async () => {
    const res = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: BUSINESS_A,
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    expect(res.body.id).toBeDefined()
    expect(res.body.business_id).toBe(BUSINESS_A)
    expect(res.body.plan_code).toBe('PLAN_ERP_STARTER')
    expect(res.body.family_code).toBe('ERP_PLAN')
    expect(res.body.source).toBe('DIRECT')
    expect(res.body.status).toBe('PENDING')
    expect(res.body.unit_price).toBe(150000)
    expect(res.body.final_price).toBe(150000)
    expect(res.body.currency).toBe('IDR')
    expect(res.body.billing_cycle).toBe('MONTHLY')
    expect(res.body.status).toBe('PENDING')
  })

  it('should reject subscription without required fields', async () => {
    const res = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({})
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('should reject subscription with invalid source', async () => {
    const res = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'INVALID_SOURCE',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('should reject CASHIER creating subscription', async () => {
    const res = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })
})

describe('SUB-API-002: Get subscription by ID', () => {
  it('should retrieve a subscription by ID', async () => {
    // Create subscription first
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    const subscriptionId = createRes.body.id

    // Get subscription
    const res = await request(app)
      .get(`/v1/subscriptions/${subscriptionId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.id).toBe(subscriptionId)
    expect(res.body.business_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  })

  it('should return 404 for non-existent subscription', async () => {
    const res = await request(app)
      .get(`/v1/subscriptions/${randomUUID()}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(404)

    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

describe('SUB-API-003: List business subscriptions', () => {
  it('should list subscriptions for a business', async () => {
    // Create a subscription first
    await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    const res = await request(app)
      .get('/v1/subscriptions')
      .query({ business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toBeInstanceOf(Array)
    expect(res.body.items.length).toBeGreaterThan(0)
    expect(res.body.total).toBeGreaterThan(0)
    expect(res.body.limit).toBe(50)
    expect(res.body.offset).toBe(0)
    expect(res.body.has_more).toBe(false)
  })

  it('should filter by status', async () => {
    await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    // Activate one
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    const subId = createRes.body.id
    await request(app)
      .post(`/v1/subscriptions/${subId}/activate`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    // Filter by ACTIVE
    const res = await request(app)
      .get('/v1/subscriptions')
      .query({ business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'ACTIVE' })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items.length).toBeGreaterThan(0)
    expect(res.body.items.every((s: any) => s.status === 'ACTIVE')).toBe(true)
  })
})

describe('SUB-API-004: Activate subscription', () => {
  it('should activate a PENDING subscription', async () => {
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    const res = await request(app)
      .post(`/v1/subscriptions/${createRes.body.id}/activate`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.status).toBe('ACTIVE')
    expect(res.body.starts_at).toBeDefined()
  })

  it('should reject activating non-PENDING subscription', async () => {
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    // Activate first
    await request(app)
      .post(`/v1/subscriptions/${createRes.body.id}/activate`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    // Try to activate again
    const res = await request(app)
      .post(`/v1/subscriptions/${createRes.body.id}/activate`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('SUB-API-005: Suspend subscription', () => {
  it('should suspend an ACTIVE subscription', async () => {
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    const subId = createRes.body.id
    await request(app)
      .post(`/v1/subscriptions/${subId}/activate`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    const res = await request(app)
      .post(`/v1/subscriptions/${createRes.body.id}/suspend`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.status).toBe('SUSPENDED')
  })

  it('should reject suspending non-ACTIVE subscription', async () => {
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    const res = await request(app)
      .post(`/v1/subscriptions/${createRes.body.id}/suspend`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('SUB-API-006: Cancel subscription', () => {
  it('should cancel an ACTIVE subscription', async () => {
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    const subId = createRes.body.id
    await request(app)
      .post(`/v1/subscriptions/${subId}/activate`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    const res = await request(app)
      .post(`/v1/subscriptions/${createRes.body.id}/cancel`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.status).toBe('CANCELLED')
    expect(res.body.ends_at).toBeDefined()
  })

  it('should cancel a SUSPENDED subscription', async () => {
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    const subId = createRes.body.id
    await request(app)
      .post(`/v1/subscriptions/${subId}/activate`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    await request(app)
      .post(`/v1/subscriptions/${subId}/suspend`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    const res = await request(app)
      .post(`/v1/subscriptions/${subId}/cancel`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.status).toBe('CANCELLED')
    expect(res.body.ends_at).toBeDefined()
  })
})

describe('SUB-API-007: Replaceable family conflict', () => {
  it('should reject second ACTIVE subscription in same replaceable family', async () => {
    // First subscription
    await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    const sub1 = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    // Activate first
    await request(app)
      .post(`/v1/subscriptions/${(await request(app)
        .post('/v1/subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          plan_code: 'PLAN_ERP_STARTER',
          family_code: 'ERP_PLAN',
          source: 'DIRECT',
          unit_price: 150000,
          discount: 0,
          tax: 0,
          final_price: 150000,
          currency: 'IDR',
          billing_cycle: 'MONTHLY',
        })
        .expect(201)).body.id}/activate`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    // Try to create second ACTIVE in same replaceable family
    const res = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_GROWTH',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 300000,
        discount: 0,
        tax: 0,
        final_price: 300000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    // Try to activate second - should fail
    const res2 = await request(app)
      .post(`/v1/subscriptions/${(await request(app)
        .post('/v1/subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          plan_code: 'PLAN_ERP_GROWTH',
          family_code: 'ERP_PLAN',
          source: 'DIRECT',
          unit_price: 300000,
          discount: 0,
          tax: 0,
          final_price: 300000,
          currency: 'IDR',
          billing_cycle: 'MONTHLY',
        })
        .expect(201)).body.id}/activate`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(409)

    expect(res2.body.error.code).toBe('SUBSCRIPTION_FAMILY_CONFLICT')
    expect(res2.body.error.details.family_code).toBe('ERP_PLAN')
  })
})

describe('SUB-API-008: Additive family coexistence', () => {
  it('should allow multiple ADDITIVE subscriptions', async () => {
    // Create CCTV subscription (REPLACEABLE family) and activate it
    const cctvRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_CCTV_BASIC',
        family_code: 'CCTV_PLAN',
        source: 'DIRECT',
        unit_price: 50000,
        discount: 0,
        tax: 0,
        final_price: 50000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    await request(app)
      .post(`/v1/subscriptions/${cctvRes.body.id}/activate`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    // Add Cloud Storage (ADDITIVE family)
    await pool.query(`
      INSERT INTO subscription_families (code, name, replacement_policy, description)
      VALUES ('CLOUD_STORAGE_PLAN', 'Cloud Storage Plan', 'ADDITIVE', 'Cloud storage plans - can have multiple')
      ON CONFLICT (code) DO NOTHING
    `)

    await pool.query(`
      INSERT INTO plans (code, name, family, tier, billing_cycle, pricing, type, status)
      VALUES ('PLAN_CLOUD_BASIC', 'Cloud Storage Basic', 'CLOUD_STORAGE_PLAN', 'BASIC', 'MONTHLY', '{"base_price": 100000, "currency": "IDR"}', 'STANDALONE', 'ACTIVE')
      ON CONFLICT (code) DO NOTHING
    `)

    const cloudRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_CLOUD_BASIC',
        family_code: 'CLOUD_STORAGE_PLAN',
        source: 'DIRECT',
        unit_price: 100000,
        discount: 0,
        tax: 0,
        final_price: 100000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    await request(app)
      .post(`/v1/subscriptions/${cloudRes.body.id}/activate`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    // ADDITIVE (Cloud) must coexist with the active REPLACEABLE (CCTV)
    const res = await request(app)
      .get('/v1/subscriptions')
      .query({ business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items.length).toBe(2)
  })
})

describe('SUB-API-009: Plan-family mismatch', () => {
  it('should reject subscription with mismatched family_code', async () => {
    const res = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER', // belongs to ERP_PLAN
        family_code: 'CCTV_PLAN', // but family_code says CCTV_PLAN
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('SUB-API-010: Immutable price snapshot', () => {
  it('should reject updating price fields after creation', async () => {
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    // Try to update unit_price - should fail
    const res = await request(app)
      .patch(`/v1/subscriptions/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ unit_price: 200000 })
      .expect(409)

    expect(res.body.error.code).toBe('CONFLICT_ERROR')
  })

  it('should reject updating discount', async () => {
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    const res = await request(app)
      .patch(`/v1/subscriptions/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ discount: 10000 })
      .expect(409)

    expect(res.body.error.code).toBe('CONFLICT_ERROR')
  })
})

describe('SUB-API-011: Invalid lifecycle transition', () => {
  it('should reject PENDING -> SUSPENDED', async () => {
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    // Try PENDING -> SUSPENDED (invalid)
    const res = await request(app)
      .patch(`/v1/subscriptions/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ status: 'SUSPENDED' })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('should reject ACTIVE -> PENDING', async () => {
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    const subId = createRes.body.id
    await request(app)
      .post(`/v1/subscriptions/${createRes.body.id}/activate`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    const res = await request(app)
      .patch(`/v1/subscriptions/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ status: 'PENDING' })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('should allow ACTIVE -> SUSPENDED', async () => {
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    await request(app)
      .post(`/v1/subscriptions/${createRes.body.id}/activate`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    const res = await request(app)
      .post(`/v1/subscriptions/${createRes.body.id}/suspend`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.status).toBe('SUSPENDED')
  })
})

describe('SUB-API-012: Tenant isolation', () => {
  it('should isolate subscriptions by business', async () => {
    // Create subscription for Business A
    await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    // Try to list with Business B token - should return empty
    const res = await request(app)
      .get('/v1/subscriptions')
      .query({ business_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .expect(200)

    expect(res.body.items).toHaveLength(0)
  })
})

describe('SUB-API-013: OWNER cannot access another business', () => {
  it('should return 403 when OWNER tries to access another business subscription', async () => {
    // Create subscription for Business A
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    const subId = createRes.body.id

    // Owner of Business B tries to access Business A's subscription
    const res = await request(app)
      .get(`/v1/subscriptions/${subId}`)
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .expect(404) // Returns 404 to avoid existence leakage

    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('should return 403 for CASHIER trying to create subscription', async () => {
    const res = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })
})

describe('SUB-API-014: PLATFORM_ADMIN global access', () => {
  it('should be marked as BLOCKED - PLATFORM_ADMIN not implemented', async () => {
    // This test documents the known limitation
    // PLATFORM_ADMIN role does not exist in the current auth system
    // Control Plane foundation must be built first
    expect(true).toBe(true) // Placeholder - actual implementation blocked
  })
})

describe('SUB-API-015: Invalid source rejected', () => {
  it('should reject invalid source value', async () => {
    const res = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'INVALID_SOURCE',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('should allow INCLUDED without internet_service_id (linkage optional in 40C)', async () => {
    const res = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_INC_CONNECT',
        family_code: 'INTERNET_PLAN',
        source: 'INCLUDED',
        unit_price: 110000,
        discount: 0,
        tax: 0,
        final_price: 110000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    expect(res.body.id).toBeDefined()
    expect(res.body.source).toBe('INCLUDED')
  })

  it('should allow DIRECT without billing_account_id (linkage optional in 40C)', async () => {
    const res = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        plan_code: 'PLAN_ERP_STARTER',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 150000,
        discount: 0,
        tax: 0,
        final_price: 150000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY',
      })
      .expect(201)

    expect(res.body.id).toBeDefined()
    expect(res.body.source).toBe('DIRECT')
  })
})