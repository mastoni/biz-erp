import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'

describe('Phase 4.1.40F-2: Registration & Self-Service Bridge', () => {
  let pool: Pool
  let app: any

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    app = createApp(pool)
  })

  afterAll(async () => {
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query(`
      DELETE FROM subscriptions;
      DELETE FROM bundle_items;
      DELETE FROM bundles;
      DELETE FROM plan_modules;
      DELETE FROM plans;
      DELETE FROM showcase_items;
      DELETE FROM user_businesses;
      DELETE FROM refresh_tokens;
      DELETE FROM customers;
      DELETE FROM businesses;
      DELETE FROM account_customer_users;
      DELETE FROM account_customers;
      DELETE FROM users;
    `)

    // Seed canonical ERP plan for testing
    await pool.query(`
      INSERT INTO plans (
        code, name, family, tier, billing_cycle, pricing, type, status, limits, trial_days, is_published, display_order, version
      ) VALUES (
        'ERP_BASIC_M',
        'ERP Basic Bulanan',
        'ERP_PLAN',
        'BASIC',
        'MONTHLY',
        '{"base_price": 99000, "discount": 0, "tax": 0, "final_price": 99000, "currency": "IDR"}',
        'STANDALONE',
        'ACTIVE',
        '{"max_branches": 1, "max_users": 3}',
        14,
        TRUE,
        1,
        1
      ) ON CONFLICT (code) DO NOTHING
    `)
  })

  it('REG-AC-001: generic registration creates full ownership chain (users -> account_customers -> account_customer_users -> businesses -> user_businesses)', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'ac-chain@test.com',
        password: 'Password123!',
        business_name: 'Toko Rantai Mandiri'
      })

    expect(res.status).toBe(201)
    expect(res.body.user_id).toBeDefined()
    expect(res.body.business_id).toBeDefined()
    expect(res.body.message).toBe('Registration successful. Please log in.')

    const userId = res.body.user_id
    const businessId = res.body.business_id

    // 1. Verify User
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId])
    expect(userRes.rows.length).toBe(1)
    expect(userRes.rows[0].email).toBe('ac-chain@test.com')
    expect(userRes.rows[0].status).toBe('ACTIVE')

    // 2. Verify Business
    const bizRes = await pool.query('SELECT * FROM businesses WHERE id = $1', [businessId])
    expect(bizRes.rows.length).toBe(1)
    expect(bizRes.rows[0].name).toBe('Toko Rantai Mandiri')
    expect(bizRes.rows[0].status).toBe('PENDING_REVIEW')
    expect(bizRes.rows[0].owner_user_id).toBe(userId)
    const accountCustomerId = bizRes.rows[0].account_customer_id
    expect(accountCustomerId).toBeDefined()
    expect(accountCustomerId).not.toBeNull()

    // 3. Verify Account Customer
    const acRes = await pool.query('SELECT * FROM account_customers WHERE id = $1', [accountCustomerId])
    expect(acRes.rows.length).toBe(1)
    expect(acRes.rows[0].name).toBe('Toko Rantai Mandiri')
    expect(acRes.rows[0].account_type).toBe('BUSINESS')
    expect(acRes.rows[0].billing_email).toBe('ac-chain@test.com')
    expect(acRes.rows[0].status).toBe('ACTIVE')
    expect(acRes.rows[0].code).toMatch(/^ACC-\d{6}-[A-F0-9]{6}$/)

    // 4. Verify Account Customer User
    const acuRes = await pool.query(
      'SELECT * FROM account_customer_users WHERE account_customer_id = $1 AND user_id = $2',
      [accountCustomerId, userId]
    )
    expect(acuRes.rows.length).toBe(1)
    expect(acuRes.rows[0].role).toBe('PRIMARY_CONTACT')
    expect(acuRes.rows[0].status).toBe('ACTIVE')

    // 5. Verify User Business Membership
    const ubRes = await pool.query(
      'SELECT * FROM user_businesses WHERE user_id = $1 AND business_id = $2',
      [userId, businessId]
    )
    expect(ubRes.rows.length).toBe(1)
    expect(ubRes.rows[0].role).toBe('OWNER')
    expect(ubRes.rows[0].status).toBe('ACTIVE')
  })

  it('REG-AC-002: plan registration links subscriptions.account_customer_id to the created Account Customer', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'ac-plan@test.com',
        password: 'Password123!',
        business_name: 'Toko Plan Auto',
        plan_code: 'ERP_BASIC_M'
      })

    expect(res.status).toBe(201)
    const businessId = res.body.business_id

    const bizRes = await pool.query('SELECT account_customer_id FROM businesses WHERE id = $1', [businessId])
    const accountCustomerId = bizRes.rows[0].account_customer_id

    const subRes = await pool.query('SELECT * FROM subscriptions WHERE business_id = $1', [businessId])
    expect(subRes.rows.length).toBe(1)
    expect(subRes.rows[0].account_customer_id).toBe(accountCustomerId)
    expect(subRes.rows[0].plan_code).toBe('ERP_BASIC_M')
    expect(subRes.rows[0].status).toBe('PENDING')
  })

  it('REG-AC-003: distinct registrations generate distinct Account Customers and unique codes', async () => {
    const res1 = await request(app).post('/v1/auth/register').send({
      email: 'user1@test.com',
      password: 'Password123!',
      business_name: 'Business Satu'
    })
    const res2 = await request(app).post('/v1/auth/register').send({
      email: 'user2@test.com',
      password: 'Password123!',
      business_name: 'Business Dua'
    })

    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)

    const biz1 = (await pool.query('SELECT account_customer_id FROM businesses WHERE id = $1', [res1.body.business_id])).rows[0]
    const biz2 = (await pool.query('SELECT account_customer_id FROM businesses WHERE id = $1', [res2.body.business_id])).rows[0]

    expect(biz1.account_customer_id).not.toBe(biz2.account_customer_id)

    const ac1 = (await pool.query('SELECT code FROM account_customers WHERE id = $1', [biz1.account_customer_id])).rows[0]
    const ac2 = (await pool.query('SELECT code FROM account_customers WHERE id = $1', [biz2.account_customer_id])).rows[0]

    expect(ac1.code).not.toBe(ac2.code)
  })

  it('REG-AC-004: duplicate email failure cleanly rolls back with zero orphaned account_customers', async () => {
    await request(app).post('/v1/auth/register').send({
      email: 'dup@test.com',
      password: 'Password123!',
      business_name: 'Initial Store'
    }).expect(201)

    const initialAcCount = (await pool.query('SELECT COUNT(*)::int AS cnt FROM account_customers')).rows[0].cnt
    expect(initialAcCount).toBe(1)

    // Attempt duplicate
    const res = await request(app).post('/v1/auth/register').send({
      email: 'dup@test.com',
      password: 'Password123!',
      business_name: 'Second Store'
    })
    expect(res.status).toBe(400)

    const postAcCount = (await pool.query('SELECT COUNT(*)::int AS cnt FROM account_customers')).rows[0].cnt
    expect(postAcCount).toBe(1)
  })

  it('REG-AC-005: invalid plan code rolls back with zero orphaned account_customers', async () => {
    const res = await request(app).post('/v1/auth/register').send({
      email: 'badplan@test.com',
      password: 'Password123!',
      business_name: 'Bad Plan Store',
      plan_code: 'NON_EXISTENT_PLAN_XYZ'
    })
    expect(res.status).toBe(400)

    const users = await pool.query('SELECT * FROM users WHERE email = $1', ['badplan@test.com'])
    expect(users.rows.length).toBe(0)

    const acs = await pool.query('SELECT * FROM account_customers WHERE billing_email = $1', ['badplan@test.com'])
    expect(acs.rows.length).toBe(0)
  })
})
