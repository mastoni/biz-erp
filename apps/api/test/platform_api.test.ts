import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'
import { hashPassword } from '../src/services/password_service'
import { Express } from 'express'
import jwt from 'jsonwebtoken'

// Phase 4.1.41B-5: First read-only Platform Control Plane API.
// Verifies platform auth boundary, platform-wide canonical listings,
// pagination, and that tenant/legacy/invalid tokens are rejected.

const BUSINESS_A = randomUUID()
const BUSINESS_B = randomUUID()

const JWT_SECRET = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
const JWT_ISSUER = process.env.JWT_ISSUER || 'biz-erp-api'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'biz-erp-client'

describe('Phase 4.1.41B-5 Platform Read-Only API', () => {
  let pool: Pool
  let app: Express

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
      TRUNCATE TABLE
        user_businesses,
        refresh_tokens,
        subscriptions,
        bundles,
        plans,
        modules,
        businesses,
        users
      RESTART IDENTITY CASCADE
    `)
    await pool.query(
      `INSERT INTO businesses (id, name) VALUES ($1, $2), ($3, $4) ON CONFLICT (id) DO NOTHING`,
      [BUSINESS_A, 'Business A', BUSINESS_B, 'Business B']
    )
    // Seed catalog (40B canonical) rows.
    await pool.query(
      `INSERT INTO modules (code, name, pillar, category, status)
       VALUES ('MOD_OPS', 'Operations', 'OPERATE', 'OPS', 'ACTIVE')`
    )
    await pool.query(
      `INSERT INTO plans (code, name, family, tier, billing_cycle, pricing, type, status)
       VALUES ('PLAN_CLOUD', 'Cloud', 'CLOUD_STORAGE_PLAN', 'STANDARD', 'MONTHLY',
               '{"base_price":10000,"final_price":10000,"currency":"IDR"}'::jsonb, 'STANDALONE', 'ACTIVE')`
    )
    await pool.query(
      `INSERT INTO bundles (code, name, pricing, status)
       VALUES ('BUNDLE_BASIC', 'Basic', '{"monthly":50000}'::jsonb, 'ACTIVE')`
    )
    // Seed a platform-wide subscription (cross-tenant overview).
    await pool.query(
      `INSERT INTO subscriptions
         (business_id, plan_code, family_code, source, status, unit_price, discount, tax, final_price, currency, billing_cycle)
       VALUES ($1, 'PLAN_CLOUD', 'CLOUD_STORAGE_PLAN', 'DIRECT', 'ACTIVE', 10000, 0, 0, 10000, 'IDR', 'MONTHLY')`,
      [BUSINESS_A]
    )
  })

  async function seedPlatformUser(role: 'PLATFORM_ADMIN' | 'SUPER_ADMIN', email: string): Promise<string> {
    const id = randomUUID()
    const hash = await hashPassword('password123')
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status, platform_role) VALUES ($1, $2, $3, $4, $5)',
      [id, email, hash, 'ACTIVE', role]
    )
    return id
  }

  async function platformLogin(email: string): Promise<string> {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email, password: 'password123' })
    expect(res.status).toBe(200)
    return res.body.access_token
  }

  async function tenantLogin(): Promise<string> {
    const id = randomUUID()
    const hash = await hashPassword('password123')
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [
      id,
      'tenant@test.com',
      hash,
      'ACTIVE'
    ])
    await pool.query('INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, $3, $4)', [
      id,
      BUSINESS_A,
      'OWNER',
      'ACTIVE'
    ])
    const res = await request(app).post('/v1/auth/login').send({ email: 'tenant@test.com', password: 'password123' })
    expect(res.status).toBe(200)
    return res.body.access_token
  }

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

  it('PA-001 platform context works', async () => {
    const userId = await seedPlatformUser('PLATFORM_ADMIN', 'pa1@test.com')
    const token = await platformLogin('pa1@test.com')

    const res = await request(app).get('/v1/platform/context').set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.scope).toBe('platform')
    expect(res.body.role).toBe('PLATFORM_ADMIN')
    expect(res.body.userId).toBe(userId)
    expect(res.body.businessId).toBeNull()
  })

  it('PA-002 SUPER_ADMIN context works', async () => {
    const userId = await seedPlatformUser('SUPER_ADMIN', 'pa2@test.com')
    const token = await platformLogin('pa2@test.com')

    const res = await request(app).get('/v1/platform/context').set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.scope).toBe('platform')
    expect(res.body.role).toBe('SUPER_ADMIN')
    expect(res.body.userId).toBe(userId)
  })

  it('PA-003 tenant token rejected', async () => {
    const token = await tenantLogin()
    const res = await request(app).get('/v1/platform/businesses').set(authHeader(token))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('WRONG_SCOPE')
  })

  it('PA-004 legacy token rejected', async () => {
    // Realistic legacy tenant token: has business_id + tenant role but NO scope
    // claim. It must never be upgraded to platform scope on a platform route.
    const legacy = jwt.sign(
      { sub: randomUUID(), business_id: BUSINESS_A, role: 'OWNER', session_id: 's', jti: 'j' },
      JWT_SECRET,
      { issuer: JWT_ISSUER, audience: JWT_AUDIENCE } as jwt.SignOptions
    )
    const res = await request(app).get('/v1/platform/businesses').set(authHeader(legacy))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('WRONG_SCOPE')
  })

  it('PA-005 invalid token rejected', async () => {
    const res = await request(app).get('/v1/platform/businesses').set(authHeader('not-a-real-token'))
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  it('PA-006 unauthorized platform role rejected', async () => {
    // scope=platform but role is not a platform role -> insufficient role.
    const bad = jwt.sign(
      { sub: randomUUID(), scope: 'platform', role: 'OWNER', session_id: 's', jti: 'j' },
      JWT_SECRET,
      { issuer: JWT_ISSUER, audience: JWT_AUDIENCE } as jwt.SignOptions
    )
    const res = await request(app).get('/v1/platform/businesses').set(authHeader(bad))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('PA-007 businesses platform-wide listing', async () => {
    await seedPlatformUser('PLATFORM_ADMIN', 'pa7@test.com')
    const token = await platformLogin('pa7@test.com')
    const res = await request(app).get('/v1/platform/businesses').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.items.length).toBe(2)
    expect(res.body.total).toBe(2)
    expect(res.body.items[0].id).toBeDefined()
    expect(res.body.items[0].name).toBeDefined()
  })

  it('PA-008 modules platform-wide listing', async () => {
    await seedPlatformUser('PLATFORM_ADMIN', 'pa8@test.com')
    const token = await platformLogin('pa8@test.com')
    const res = await request(app).get('/v1/platform/modules').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.items.length).toBe(1)
    expect(res.body.items[0].code).toBe('MOD_OPS')
  })

  it('PA-009 plans platform-wide listing', async () => {
    await seedPlatformUser('PLATFORM_ADMIN', 'pa9@test.com')
    const token = await platformLogin('pa9@test.com')
    const res = await request(app).get('/v1/platform/plans').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.items.length).toBe(1)
    expect(res.body.items[0].code).toBe('PLAN_CLOUD')
  })

  it('PA-010 bundles platform-wide listing', async () => {
    await seedPlatformUser('PLATFORM_ADMIN', 'pa10@test.com')
    const token = await platformLogin('pa10@test.com')
    const res = await request(app).get('/v1/platform/bundles').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.items.length).toBe(1)
    expect(res.body.items[0].code).toBe('BUNDLE_BASIC')
  })

  it('PA-011 subscriptions platform-wide listing', async () => {
    await seedPlatformUser('PLATFORM_ADMIN', 'pa11@test.com')
    const token = await platformLogin('pa11@test.com')
    const res = await request(app).get('/v1/platform/subscriptions').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.items.length).toBe(1)
    expect(res.body.items[0].business_id).toBe(BUSINESS_A)
    expect(res.body.items[0].plan_code).toBe('PLAN_CLOUD')
    expect(res.body.items[0].plan_family).toBe('CLOUD_STORAGE_PLAN')
  })

  it('PA-012 pagination behavior', async () => {
    await seedPlatformUser('PLATFORM_ADMIN', 'pa12@test.com')
    const token = await platformLogin('pa12@test.com')
    const page = await request(app).get('/v1/platform/businesses?limit=1&offset=0').set(authHeader(token))
    expect(page.status).toBe(200)
    expect(page.body.items.length).toBe(1)
    expect(page.body.limit).toBe(1)
    expect(page.body.offset).toBe(0)
    expect(page.body.has_more).toBe(true)
    expect(page.body.total).toBe(2)

    const page2 = await request(app).get('/v1/platform/businesses?limit=1&offset=1').set(authHeader(token))
    expect(page2.status).toBe(200)
    expect(page2.body.items.length).toBe(1)
    expect(page2.body.offset).toBe(1)
    expect(page2.body.has_more).toBe(false)

    // Bad pagination -> 400
    const bad = await request(app).get('/v1/platform/businesses?limit=999999').set(authHeader(token))
    expect(bad.status).toBe(400)
    expect(bad.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('PA-013 no req.businessId used on platform routes', async () => {
    await seedPlatformUser('PLATFORM_ADMIN', 'pa13@test.com')
    const token = await platformLogin('pa13@test.com')
    const res = await request(app).get('/v1/platform/context').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.businessId).toBeNull()
  })

  it('PA-014 cross-tenant data visible ONLY because caller has platform scope', async () => {
    await seedPlatformUser('PLATFORM_ADMIN', 'pa14@test.com')
    const token = await platformLogin('pa14@test.com')

    // Platform list sees BOTH businesses (cross-tenant).
    const platformRes = await request(app).get('/v1/platform/businesses').set(authHeader(token))
    expect(platformRes.status).toBe(200)
    expect(platformRes.body.total).toBe(2)

    // A tenant token is rejected from platform scope entirely (no cross-tenant leak).
    const tenantToken = await tenantLogin()
    const tenantRes = await request(app).get('/v1/platform/businesses').set(authHeader(tenantToken))
    expect(tenantRes.status).toBe(403)
    expect(tenantRes.body.error.code).toBe('WRONG_SCOPE')
  })
})
