import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { seedTestUser, authenticateTestUser } from './auth_helper'
import path from 'path'

describe('Phase 4.1.40F-3: Subscription Linkage & Account Customer Ownership', () => {
  let pool: Pool
  let app: any

  const BUSINESS_1_ID = '11111111-1111-4111-8111-111111111111'
  const BUSINESS_2_ID = '22222222-2222-4222-8222-222222222222'
  const BUSINESS_LEGACY_ID = '33333333-3333-4333-8333-333333333333'

  const AC_1_ID = 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'
  const AC_2_ID = 'bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb'

  let ownerToken1: string
  let ownerToken2: string
  let ownerTokenLegacy: string

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    app = createApp(pool)

    await pool.query(`
      TRUNCATE TABLE
        subscriptions,
        subscription_families,
        plans,
        user_businesses,
        refresh_tokens,
        businesses,
        account_customer_users,
        account_customers,
        customers,
        users
      RESTART IDENTITY CASCADE
    `)

    // Seed subscription families
    await pool.query(`
      INSERT INTO subscription_families (code, name, replacement_policy, description) VALUES
      ('ERP_PLAN', 'ERP Plan', 'REPLACEABLE', 'Core ERP plans'),
      ('CCTV_PLAN', 'CCTV Plan', 'REPLACEABLE', 'CCTV plans'),
      ('CLOUD_STORAGE_PLAN', 'Cloud Storage Plan', 'ADDITIVE', 'Cloud storage plans')
      ON CONFLICT (code) DO NOTHING
    `)

    // Seed plans
    await pool.query(`
      INSERT INTO plans (
        code, name, family, tier, billing_cycle, pricing, type, status, limits, trial_days, is_published, display_order, version
      ) VALUES
      ('PLAN_ERP_PRO', 'ERP Pro', 'ERP_PLAN', 'PRO', 'MONTHLY', '{"base_price": 250000, "currency": "IDR"}', 'STANDALONE', 'ACTIVE', '{"max_branches": 5}', 14, TRUE, 1, 1),
      ('PLAN_CCTV_BASIC', 'CCTV Basic', 'CCTV_PLAN', 'BASIC', 'MONTHLY', '{"base_price": 50000, "currency": "IDR"}', 'STANDALONE', 'ACTIVE', '{}', 0, TRUE, 2, 1),
      ('PLAN_CLOUD_100GB', 'Cloud Storage 100GB', 'CLOUD_STORAGE_PLAN', 'TIER_1', 'MONTHLY', '{"base_price": 30000, "currency": "IDR"}', 'STANDALONE', 'ACTIVE', '{}', 0, TRUE, 3, 1)
      ON CONFLICT (code) DO NOTHING
    `)

    // 1. Seed Account Customer 1 and Business 1
    await pool.query(`
      INSERT INTO account_customers (id, code, name, account_type, billing_email, status)
      VALUES ($1, 'ACC-000001-AAAAAA', 'Business One Corp', 'BUSINESS', 'owner1@biz1.com', 'ACTIVE')
    `, [AC_1_ID])

    await pool.query(`
      INSERT INTO businesses (id, name, account_customer_id, status)
      VALUES ($1, 'Business One', $2, 'ACTIVE')
    `, [BUSINESS_1_ID, AC_1_ID])

    // 2. Seed Account Customer 2 and Business 2
    await pool.query(`
      INSERT INTO account_customers (id, code, name, account_type, billing_email, status)
      VALUES ($1, 'ACC-000002-BBBBBB', 'Business Two Corp', 'BUSINESS', 'owner2@biz2.com', 'ACTIVE')
    `, [AC_2_ID])

    await pool.query(`
      INSERT INTO businesses (id, name, account_customer_id, status)
      VALUES ($1, 'Business Two', $2, 'ACTIVE')
    `, [BUSINESS_2_ID, AC_2_ID])

    // 3. Seed Legacy Business (no account_customer_id)
    await pool.query(`
      INSERT INTO businesses (id, name, account_customer_id, status)
      VALUES ($1, 'Legacy Business', NULL, 'ACTIVE')
    `, [BUSINESS_LEGACY_ID])

    // Setup Auth users
    const u1 = await seedTestUser(pool, BUSINESS_1_ID, { email: 'owner1@biz1.com', role: 'OWNER', withSubscription: false })
    const a1 = await authenticateTestUser(app, u1.email, u1.password, BUSINESS_1_ID)
    ownerToken1 = a1.accessToken

    const u2 = await seedTestUser(pool, BUSINESS_2_ID, { email: 'owner2@biz2.com', role: 'OWNER', withSubscription: false })
    const a2 = await authenticateTestUser(app, u2.email, u2.password, BUSINESS_2_ID)
    ownerToken2 = a2.accessToken

    const u3 = await seedTestUser(pool, BUSINESS_LEGACY_ID, { email: 'owner3@bizlegacy.com', role: 'OWNER', withSubscription: false })
    const a3 = await authenticateTestUser(app, u3.email, u3.password, BUSINESS_LEGACY_ID)
    ownerTokenLegacy = a3.accessToken
  }, 60000)

  afterAll(async () => {
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query(`DELETE FROM subscriptions; DELETE FROM customers;`)
  })

  it('SUB-AC-001: creating a subscription for an Account Customer-linked business sets subscriptions.account_customer_id', async () => {
    const res = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerToken1}`)
      .send({
        business_id: BUSINESS_1_ID,
        plan_code: 'PLAN_ERP_PRO',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 250000,
        discount: 0,
        tax: 0,
        final_price: 250000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY'
      })

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.business_id).toBe(BUSINESS_1_ID)
    expect(res.body.account_customer_id).toBe(AC_1_ID)
    expect(res.body.status).toBe('PENDING')

    // Verify directly in DB
    const dbSub = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [res.body.id])
    expect(dbSub.rows.length).toBe(1)
    expect(dbSub.rows[0].account_customer_id).toBe(AC_1_ID)
    expect(dbSub.rows[0].business_id).toBe(BUSINESS_1_ID)
  })

  it('SUB-AC-002: creating a subscription for an unlinked legacy business preserves account_customer_id as null without failure', async () => {
    const res = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenLegacy}`)
      .send({
        business_id: BUSINESS_LEGACY_ID,
        plan_code: 'PLAN_ERP_PRO',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 250000,
        discount: 0,
        tax: 0,
        final_price: 250000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY'
      })

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.business_id).toBe(BUSINESS_LEGACY_ID)
    expect(res.body.account_customer_id).toBeNull()

    // Verify in DB
    const dbSub = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [res.body.id])
    expect(dbSub.rows[0].account_customer_id).toBeNull()
  })

  it('SUB-AC-003: subscription lifecycle transitions preserve account_customer_id on the record', async () => {
    // 1. Create subscription
    const createRes = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerToken1}`)
      .send({
        business_id: BUSINESS_1_ID,
        plan_code: 'PLAN_ERP_PRO',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 250000,
        discount: 0,
        tax: 0,
        final_price: 250000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY'
      })
    expect(createRes.status).toBe(201)
    const subId = createRes.body.id

    // 2. Activate (PENDING -> ACTIVE)
    const actRes = await request(app)
      .post(`/v1/subscriptions/${subId}/activate`)
      .set('Authorization', `Bearer ${ownerToken1}`)
    expect(actRes.status).toBe(200)
    expect(actRes.body.status).toBe('ACTIVE')
    expect(actRes.body.account_customer_id).toBe(AC_1_ID)

    // Verify in DB
    let dbSub = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [subId])
    expect(dbSub.rows[0].status).toBe('ACTIVE')
    expect(dbSub.rows[0].account_customer_id).toBe(AC_1_ID)

    // 3. Suspend (ACTIVE -> SUSPENDED)
    const suspRes = await request(app)
      .post(`/v1/subscriptions/${subId}/suspend`)
      .set('Authorization', `Bearer ${ownerToken1}`)
    expect(suspRes.status).toBe(200)
    expect(suspRes.body.status).toBe('SUSPENDED')
    expect(suspRes.body.account_customer_id).toBe(AC_1_ID)

    dbSub = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [subId])
    expect(dbSub.rows[0].status).toBe('SUSPENDED')
    expect(dbSub.rows[0].account_customer_id).toBe(AC_1_ID)

    // 4. Cancel (SUSPENDED -> CANCELLED)
    const cancelRes = await request(app)
      .post(`/v1/subscriptions/${subId}/cancel`)
      .set('Authorization', `Bearer ${ownerToken1}`)
    expect(cancelRes.status).toBe(200)
    expect(cancelRes.body.status).toBe('CANCELLED')
    expect(cancelRes.body.account_customer_id).toBe(AC_1_ID)

    dbSub = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [subId])
    expect(dbSub.rows[0].status).toBe('CANCELLED')
    expect(dbSub.rows[0].account_customer_id).toBe(AC_1_ID)
  })

  it('SUB-AC-004: multi-tenant isolation guarantees no cross-tenant subscription leakage or mutation', async () => {
    // Create subscription for Business 1
    const sub1Res = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerToken1}`)
      .send({
        business_id: BUSINESS_1_ID,
        plan_code: 'PLAN_ERP_PRO',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 250000,
        discount: 0,
        tax: 0,
        final_price: 250000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY'
      })
    expect(sub1Res.status).toBe(201)
    const sub1Id = sub1Res.body.id

    // Create subscription for Business 2
    const sub2Res = await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerToken2}`)
      .send({
        business_id: BUSINESS_2_ID,
        plan_code: 'PLAN_ERP_PRO',
        family_code: 'ERP_PLAN',
        source: 'DIRECT',
        unit_price: 250000,
        discount: 0,
        tax: 0,
        final_price: 250000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY'
      })
    expect(sub2Res.status).toBe(201)
    const sub2Id = sub2Res.body.id

    // Verify Business 1 cannot access Business 2's subscription
    const crossGet = await request(app)
      .get(`/v1/subscriptions/${sub2Id}`)
      .set('Authorization', `Bearer ${ownerToken1}`)
    expect(crossGet.status).toBe(404)

    // Verify Business 1 cannot activate Business 2's subscription
    const crossAct = await request(app)
      .post(`/v1/subscriptions/${sub2Id}/activate`)
      .set('Authorization', `Bearer ${ownerToken1}`)
    expect(crossAct.status).toBe(404)

    // Verify listing for Business 1 only returns Business 1's subscription
    const listRes1 = await request(app)
      .get(`/v1/subscriptions?business_id=${BUSINESS_1_ID}`)
      .set('Authorization', `Bearer ${ownerToken1}`)
    expect(listRes1.status).toBe(200)
    expect(listRes1.body.items.length).toBe(1)
    expect(listRes1.body.items[0].id).toBe(sub1Id)
    expect(listRes1.body.items[0].account_customer_id).toBe(AC_1_ID)
  })

  it('SUB-AC-005: confirms CRM customers table is completely untouched during subscription operations', async () => {
    // Seed 1 CRM customer in the tenant CRM table
    await pool.query(`
      INSERT INTO customers (id, business_id, name, phone, email)
      VALUES ('cccccccc-1111-4ccc-8ccc-cccccccccccc', $1, 'Retail Store Walk-in Customer', '081234567890', 'customer@retail.com')
    `, [BUSINESS_1_ID])

    const crmBefore = await pool.query('SELECT * FROM customers')
    expect(crmBefore.rows.length).toBe(1)

    // Create subscription
    await request(app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${ownerToken1}`)
      .send({
        business_id: BUSINESS_1_ID,
        plan_code: 'PLAN_CLOUD_100GB',
        family_code: 'CLOUD_STORAGE_PLAN',
        source: 'DIRECT',
        unit_price: 30000,
        discount: 0,
        tax: 0,
        final_price: 30000,
        currency: 'IDR',
        billing_cycle: 'MONTHLY'
      })

    const crmAfter = await pool.query('SELECT * FROM customers')
    expect(crmAfter.rows.length).toBe(1)
    expect(crmAfter.rows[0].id).toBe('cccccccc-1111-4ccc-8ccc-cccccccccccc')
    expect(crmAfter.rows[0].name).toBe('Retail Store Walk-in Customer')
  })
})
