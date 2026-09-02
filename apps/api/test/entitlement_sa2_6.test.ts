import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'
import { Express } from 'express'
import { createJwtService } from '../src/services/jwt_service'
import { hashPassword } from '../src/services/password_service'

describe('SA-2.6 Entitlement Enforcer', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>

  const BUSINESS_A = randomUUID() // Has ACTIVE ERP
  const BUSINESS_B = randomUUID() // NO ERP
  const BUSINESS_C = randomUUID() // CANCELLED ERP
  const USER_ID = randomUUID()

  const SUPER_USER_ID = randomUUID()
  const JWT_SECRET = 'insecure-test-secret-that-is-at-least-32-chars-long'
  const JWT_ISSUER = 'biz-erp-api'
  const JWT_AUDIENCE = 'biz-erp-client'

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET
    process.env.JWT_ISSUER = JWT_ISSUER
    process.env.JWT_AUDIENCE = JWT_AUDIENCE

    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    app = createApp(pool)

    jwtService = createJwtService(JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE)

    // Seed User
    const hashed = await hashPassword('password123')
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [USER_ID, 'test@entitlement.com', hashed, 'ACTIVE'])
    await pool.query('INSERT INTO users (id, email, password_hash, status, platform_role) VALUES ($1, $2, $3, $4, $5)', [SUPER_USER_ID, 'super@entitlement.com', hashed, 'ACTIVE', 'SUPER_ADMIN'])

    // Seed Businesses
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant A', 'ACTIVE')", [BUSINESS_A])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant B', 'ACTIVE')", [BUSINESS_B])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant C', 'ACTIVE')", [BUSINESS_C])

    // Seed Memberships
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_ID, BUSINESS_A])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_ID, BUSINESS_B])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_ID, BUSINESS_C])

    // Ensure a plan exists
    await pool.query(`
      INSERT INTO plans (code, name, family, tier, billing_cycle, pricing, type, status, service_code)
      VALUES ('test_erp_sub', 'Test ERP', 'ERP_PLAN', 'PRO', 'MONTHLY', '{"base_price":100}', 'STANDALONE', 'ACTIVE', 'ERP')
      ON CONFLICT (code) DO UPDATE SET service_code = 'ERP'
    `)

    // Sub A: ACTIVE
    await pool.query(`
      INSERT INTO subscriptions (id, business_id, plan_code, family_code, source, status, unit_price, discount, tax, final_price, currency, billing_cycle)
      VALUES ($1, $2, 'test_erp_sub', 'ERP_PLAN', 'DIRECT', 'ACTIVE', 100000, 0, 0, 100000, 'IDR', 'MONTHLY')
    `, [randomUUID(), BUSINESS_A])

    // Sub C: CANCELLED
    await pool.query(`
      INSERT INTO subscriptions (id, business_id, plan_code, family_code, source, status, unit_price, discount, tax, final_price, currency, billing_cycle)
      VALUES ($1, $2, 'test_erp_sub', 'ERP_PLAN', 'DIRECT', 'CANCELLED', 100000, 0, 0, 100000, 'IDR', 'MONTHLY')
    `, [randomUUID(), BUSINESS_C])
  })

  afterAll(async () => {
    await pool.query('DELETE FROM subscriptions WHERE business_id IN ($1, $2, $3)', [BUSINESS_A, BUSINESS_B, BUSINESS_C])
    await pool.query('DELETE FROM user_businesses WHERE user_id = $1', [USER_ID])
    await pool.query('DELETE FROM businesses WHERE id IN ($1, $2, $3)', [BUSINESS_A, BUSINESS_B, BUSINESS_C])
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [USER_ID, SUPER_USER_ID])
    await pool.end()
  })

  it('A. authenticated tenant + ACTIVE ERP subscription -> allowed (200 or business validation)', async () => {
    const token = jwtService.signAccessToken({
      sub: USER_ID,
      business_id: BUSINESS_A,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    // /v1/products requires ERP entitlement
    const res = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${token}`)
    
    // We expect 200 OK (empty list)
    expect(res.status).toBe(200)
  })

  it('B. authenticated tenant + no ERP subscription -> 403 ENTITLEMENT_REQUIRED', async () => {
    const token = jwtService.signAccessToken({
      sub: USER_ID,
      business_id: BUSINESS_B, // Tenant B has no sub
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    const res = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_B}`)
      .set('Authorization', `Bearer ${token}`)
    
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ENTITLEMENT_REQUIRED')
  })

  it('C. authenticated tenant + ACTIVE ISP_MANAGEMENT subscription (non-ERP) -> 403 on ERP route', async () => {
    const BUSINESS_ISP = randomUUID()
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'ISP Tenant', 'ACTIVE')", [BUSINESS_ISP])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_ID, BUSINESS_ISP])

    await pool.query(`
      INSERT INTO plans (code, name, family, tier, billing_cycle, pricing, type, status, service_code)
      VALUES ('test_isp_plan', 'ISP Plan', 'INTERNET_PLAN', 'PRO', 'MONTHLY', '{"base_price":200}', 'STANDALONE', 'ACTIVE', 'ISP_MANAGEMENT')
      ON CONFLICT (code) DO UPDATE SET service_code = 'ISP_MANAGEMENT'
    `)

    await pool.query(`
      INSERT INTO subscriptions (id, business_id, plan_code, family_code, source, status, unit_price, discount, tax, final_price, currency, billing_cycle)
      VALUES ($1, $2, 'test_isp_plan', 'INTERNET_PLAN', 'DIRECT', 'ACTIVE', 200000, 0, 0, 200000, 'IDR', 'MONTHLY')
    `, [randomUUID(), BUSINESS_ISP])

    const token = jwtService.signAccessToken({
      sub: USER_ID,
      business_id: BUSINESS_ISP,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    // Accessing ERP-protected route should fail with 403
    const res = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_ISP}`)
      .set('Authorization', `Bearer ${token}`)
    
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ENTITLEMENT_REQUIRED')

    // But accessing /v1/subscriptions should succeed
    const subRes = await request(app)
      .get(`/v1/subscriptions?business_id=${BUSINESS_ISP}`)
      .set('Authorization', `Bearer ${token}`)
    expect(subRes.status).toBe(200)

    // Clean up
    await pool.query('DELETE FROM subscriptions WHERE business_id = $1', [BUSINESS_ISP])
    await pool.query('DELETE FROM user_businesses WHERE business_id = $1', [BUSINESS_ISP])
    await pool.query('DELETE FROM businesses WHERE id = $1', [BUSINESS_ISP])
  })

  it('D. CCTV entitlement remains independent and does not grant ERP access', async () => {
    const BUSINESS_CCTV = randomUUID()
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'CCTV Tenant', 'ACTIVE')", [BUSINESS_CCTV])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_ID, BUSINESS_CCTV])

    await pool.query(`
      INSERT INTO plans (code, name, family, tier, billing_cycle, pricing, type, status, service_code)
      VALUES ('test_cctv_plan', 'CCTV Plan', 'CCTV_PLAN', 'PRO', 'MONTHLY', '{"base_price":150}', 'STANDALONE', 'ACTIVE', 'CCTV_MANAGEMENT')
      ON CONFLICT (code) DO UPDATE SET service_code = 'CCTV_MANAGEMENT'
    `)

    await pool.query(`
      INSERT INTO subscriptions (id, business_id, plan_code, family_code, source, status, unit_price, discount, tax, final_price, currency, billing_cycle)
      VALUES ($1, $2, 'test_cctv_plan', 'CCTV_PLAN', 'DIRECT', 'ACTIVE', 150000, 0, 0, 150000, 'IDR', 'MONTHLY')
    `, [randomUUID(), BUSINESS_CCTV])

    const token = jwtService.signAccessToken({
      sub: USER_ID,
      business_id: BUSINESS_CCTV,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    const res = await request(app)
      .get('/v1/inventory')
      .set('Authorization', `Bearer ${token}`)
    
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ENTITLEMENT_REQUIRED')

    // Clean up
    await pool.query('DELETE FROM subscriptions WHERE business_id = $1', [BUSINESS_CCTV])
    await pool.query('DELETE FROM user_businesses WHERE business_id = $1', [BUSINESS_CCTV])
    await pool.query('DELETE FROM businesses WHERE id = $1', [BUSINESS_CCTV])
  })

  it('E. authenticated tenant + CANCELLED ERP subscription -> 403', async () => {
    const token = jwtService.signAccessToken({
      sub: USER_ID,
      business_id: BUSINESS_C, // Tenant C is cancelled
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    const res = await request(app)
      .get('/v1/products')
      .set('Authorization', `Bearer ${token}`)
    
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ENTITLEMENT_REQUIRED')
  })

  it('F. canonical services table contains approved taxonomy', async () => {
    const res = await pool.query('SELECT code, name, category, service_type, lifecycle_status FROM services ORDER BY code')
    const serviceCodes = res.rows.map(r => r.code)
    expect(serviceCodes).toContain('ERP')
    expect(serviceCodes).toContain('ISP_MANAGEMENT')
    expect(serviceCodes).toContain('CCTV_MANAGEMENT')
    expect(serviceCodes).toContain('WA_GATEWAY')
    expect(serviceCodes).toContain('AUTOPOST')
  })

  it('G. missing/invalid JWT -> 401', async () => {
    const res = await request(app)
      .get('/v1/products')
    expect(res.status).toBe(401)
  })

  it('H. client attempts to supply another business_id -> must NOT change entitlement context', async () => {
    // Tenant B (No ERP) tries to access by passing Tenant A's business_id in query
    const token = jwtService.signAccessToken({
      sub: USER_ID,
      business_id: BUSINESS_B,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    const res = await request(app)
      .get(`/v1/products?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${token}`)
    
    // Auth MW prevents query business_id mismatch, or Entitlement MW strictly uses jwt claims.
    expect(res.status).toBe(403)
  })

  it('J. /v1/subscriptions remains accessible to authenticated tenant without requiring ERP entitlement', async () => {
    const token = jwtService.signAccessToken({
      sub: USER_ID,
      business_id: BUSINESS_B, // No ERP
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    const res = await request(app)
      .get(`/v1/subscriptions?business_id=${BUSINESS_B}`)
      .set('Authorization', `Bearer ${token}`)
    
    // Should pass auth and entitlement checks. (Returns 200 with subscriptions list)
    expect(res.status).toBe(200)
  })

  it('K. platform scope remains outside tenant entitlement checks', async () => {
    const token = jwtService.signAccessToken({
      sub: SUPER_USER_ID,
      scope: 'platform',
      role: 'SUPER_ADMIN',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    const res = await request(app)
      .get('/v1/platform/businesses') // accessing a platform route
      .set('Authorization', `Bearer ${token}`)
    
    expect(res.status).toBe(200)
  })
})
