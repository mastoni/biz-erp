import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'

describe('Registration Commercial Intent & Catalog Resolution Flow', () => {
  let pool: Pool
  let app: any

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    }

    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    app = createApp(pool)
  })

  afterAll(async () => {
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        subscriptions,
        bundle_items,
        bundles,
        plan_modules,
        plans,
        showcase_items,
        user_businesses,
        refresh_tokens,
        users,
        businesses
      RESTART IDENTITY CASCADE
    `)

    // Seed canonical ERP plans
    await pool.query(`
      INSERT INTO plans (
        code, name, family, tier, billing_cycle, pricing, type, status, limits, trial_days, is_published, display_order, version
      ) VALUES (
        'ERP_BASIC_MONTHLY',
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
      ), (
        'ERP_PRO_MONTHLY',
        'ERP Pro Bulanan',
        'ERP_PLAN',
        'PRO',
        'MONTHLY',
        '{"base_price": 249000, "discount": 0, "tax": 0, "final_price": 249000, "currency": "IDR"}',
        'STANDALONE',
        'ACTIVE',
        '{"max_branches": 5, "max_users": 10}',
        0,
        TRUE,
        2,
        1
      ), (
        'INACTIVE_PLAN',
        'Inactive Plan',
        'ERP_PLAN',
        'BASIC',
        'MONTHLY',
        '{"base_price": 50000, "discount": 0, "tax": 0, "final_price": 50000, "currency": "IDR"}',
        'STANDALONE',
        'DRAFT',
        '{}',
        0,
        FALSE,
        99,
        1
      )
    `)

    // Seed canonical bundle
    await pool.query(`
      INSERT INTO bundles (
        code, name, pricing, target_segment, installation_required, presentation_metadata, status
      ) VALUES (
        'BUNDLE_RETAIL_STARTER',
        'Bundel Usaha Ritel',
        '{"one_time": 250000, "monthly": 399000, "commitment_months": 12}',
        'UMKM Ritel',
        TRUE,
        '{"display_name": "Paket Ritel Lengkap", "description": "ERP + Internet Broadband"}',
        'ACTIVE'
      )
    `)

    await pool.query(`
      INSERT INTO bundle_items (bundle_code, item_type, item_code, quantity, required)
      VALUES ('BUNDLE_RETAIL_STARTER', 'PLAN', 'ERP_BASIC_MONTHLY', 1, TRUE)
    `)
  })

  it('COMM-001 generic registration without plan/bundle succeeds without subscription', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'generic@example.com',
        password: 'SecurePassword123!',
        business_name: 'Generic Business'
      })

    expect(res.status).toBe(201)
    expect(res.body.user_id).toBeDefined()
    expect(res.body.business_id).toBeDefined()

    const subs = await pool.query('SELECT * FROM subscriptions WHERE business_id = $1', [res.body.business_id])
    expect(subs.rows.length).toBe(0)
  })

  it('COMM-002 registration with valid plan_code creates business and initial subscription', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'plan-reg@example.com',
        password: 'SecurePassword123!',
        business_name: 'Plan Reg Store',
        plan_code: 'ERP_BASIC_MONTHLY'
      })

    expect(res.status).toBe(201)
    expect(res.body.business_id).toBeDefined()

    const subs = await pool.query('SELECT * FROM subscriptions WHERE business_id = $1', [res.body.business_id])
    expect(subs.rows.length).toBe(1)
    const sub = subs.rows[0]
    expect(sub.plan_code).toBe('ERP_BASIC_MONTHLY')
    expect(sub.family_code).toBe('ERP_PLAN')
    expect(sub.status).toBe('PENDING')
    expect(Number(sub.final_price)).toBe(99000)
    expect(sub.trial_ends_at).toBeDefined()
    expect(sub.metadata.registered_via).toBe('LANDING_CONVERSION')
    expect(sub.metadata.plan_name).toBe('ERP Basic Bulanan')
  })

  it('COMM-003 registration with valid bundle_code creates business and initial subscription', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'bundle-reg@example.com',
        password: 'SecurePassword123!',
        business_name: 'Bundle Reg Store',
        bundle_code: 'BUNDLE_RETAIL_STARTER'
      })

    expect(res.status).toBe(201)
    expect(res.body.business_id).toBeDefined()

    const subs = await pool.query('SELECT * FROM subscriptions WHERE business_id = $1', [res.body.business_id])
    expect(subs.rows.length).toBe(1)
    const sub = subs.rows[0]
    expect(sub.plan_code).toBe('ERP_BASIC_MONTHLY')
    expect(sub.metadata.bundle_code).toBe('BUNDLE_RETAIL_STARTER')
    expect(sub.metadata.bundle_name).toBe('Bundel Usaha Ritel')
  })

  it('COMM-004 registration with invalid plan_code is rejected with VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'invalid-plan@example.com',
        password: 'SecurePassword123!',
        business_name: 'Invalid Plan Store',
        plan_code: 'NON_EXISTENT_PLAN'
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.plan_code).toContain('NON_EXISTENT_PLAN')

    // Ensure rollback: user and business not created
    const users = await pool.query('SELECT * FROM users WHERE email = $1', ['invalid-plan@example.com'])
    expect(users.rows.length).toBe(0)
  })

  it('COMM-005 registration with inactive/draft plan_code is rejected', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'draft-plan@example.com',
        password: 'SecurePassword123!',
        business_name: 'Draft Plan Store',
        plan_code: 'INACTIVE_PLAN'
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('COMM-006 public commercial resolve endpoint resolves valid plan', async () => {
    const res = await request(app)
      .get('/v1/public/commercial/resolve?plan=ERP_BASIC_MONTHLY')

    expect(res.status).toBe(200)
    expect(res.body.type).toBe('PLAN')
    expect(res.body.code).toBe('ERP_BASIC_MONTHLY')
    expect(res.body.name).toBe('ERP Basic Bulanan')
    expect(res.body.pricing.final_price).toBe(99000)
  })

  it('COMM-007 public commercial resolve endpoint resolves valid bundle', async () => {
    const res = await request(app)
      .get('/v1/public/commercial/resolve?bundle=BUNDLE_RETAIL_STARTER')

    expect(res.status).toBe(200)
    expect(res.body.type).toBe('BUNDLE')
    expect(res.body.code).toBe('BUNDLE_RETAIL_STARTER')
    expect(res.body.name).toBe('Bundel Usaha Ritel')
  })

  it('COMM-008 public commercial resolve endpoint returns 404 for unknown/inactive plan', async () => {
    const res = await request(app)
      .get('/v1/public/commercial/resolve?plan=UNKNOWN_PLAN_123')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
