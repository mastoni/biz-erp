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
import { createProvisioningService, defaultDrivers } from '../src/services/provisioning_service'

describe('Phase SA-2.7: Provisioning Foundation', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>

  const BUSINESS_A = randomUUID()
  const BUSINESS_B = randomUUID()
  const USER_A = randomUUID()
  const USER_B = randomUUID()
  const SUPER_USER = randomUUID()

  const JWT_SECRET = 'insecure-test-secret-that-is-at-least-32-chars-long'
  const JWT_ISSUER = 'biz-erp-api'
  const JWT_AUDIENCE = 'biz-erp-client'

  let tokenA: string
  let tokenB: string
  let platformToken: string
  let subAId: string

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

    // Seed Users
    const hashed = await hashPassword('password123')
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [USER_A, 'owner_a@prov.com', hashed, 'ACTIVE'])
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [USER_B, 'owner_b@prov.com', hashed, 'ACTIVE'])
    await pool.query('INSERT INTO users (id, email, password_hash, status, platform_role) VALUES ($1, $2, $3, $4, $5)', [SUPER_USER, 'super@prov.com', hashed, 'ACTIVE', 'SUPER_ADMIN'])

    // Seed Businesses
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant A', 'ACTIVE')", [BUSINESS_A])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant B', 'ACTIVE')", [BUSINESS_B])

    // Seed Memberships
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_A, BUSINESS_A])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_B, BUSINESS_B])

    // Ensure Canonical Services exist
    await pool.query(`
      INSERT INTO services (code, name, category, service_type, owner, lifecycle_status, public_visibility)
      VALUES
        ('ERP', 'Enterprise Resource Planning', 'OPERATIONS', 'INTERNAL', 'PLATFORM', 'ACTIVE', FALSE),
        ('ISP_MANAGEMENT', 'ISP Management System', 'OPERATIONS', 'INTERNAL', 'PLATFORM', 'ACTIVE', FALSE),
        ('CCTV_MANAGEMENT', 'CCTV Management', 'PROTECTION', 'HYBRID', 'PLATFORM', 'ACTIVE', FALSE),
        ('WA_GATEWAY', 'WhatsApp Gateway', 'COMMUNICATIONS', 'HYBRID', 'PLATFORM', 'DRAFT', FALSE),
        ('AUTOPOST', 'AI AutoPost', 'MARKETING', 'EXTERNAL', 'PLATFORM', 'DRAFT', FALSE)
      ON CONFLICT (code) DO NOTHING
    `)

    // Seed Plan & Subscription for Tenant A (ISP Plan)
    await pool.query(`
      INSERT INTO plans (code, name, family, tier, billing_cycle, pricing, type, status, service_code)
      VALUES ('prov_test_isp_plan', 'ISP Plan', 'INTERNET_PLAN', 'PRO', 'MONTHLY', '{"base_price":200}', 'STANDALONE', 'ACTIVE', 'ISP_MANAGEMENT')
      ON CONFLICT (code) DO UPDATE SET service_code = 'ISP_MANAGEMENT'
    `)

    subAId = randomUUID()
    await pool.query(`
      INSERT INTO subscriptions (id, business_id, plan_code, family_code, source, status, unit_price, discount, tax, final_price, currency, billing_cycle)
      VALUES ($1, $2, 'prov_test_isp_plan', 'INTERNET_PLAN', 'DIRECT', 'ACTIVE', 200000, 0, 0, 200000, 'IDR', 'MONTHLY')
    `, [subAId, BUSINESS_A])

    tokenA = jwtService.signAccessToken({
      sub: USER_A,
      business_id: BUSINESS_A,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID(),
    })

    tokenB = jwtService.signAccessToken({
      sub: USER_B,
      business_id: BUSINESS_B,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID(),
    })

    platformToken = jwtService.signAccessToken({
      sub: SUPER_USER,
      scope: 'platform',
      role: 'SUPER_ADMIN',
      session_id: randomUUID(),
      jti: randomUUID(),
    })
  })

  afterAll(async () => {
    await pool.query('DELETE FROM provisioning_audit_logs WHERE business_id IN ($1, $2)', [BUSINESS_A, BUSINESS_B])
    await pool.query('DELETE FROM provisioning_jobs WHERE business_id IN ($1, $2)', [BUSINESS_A, BUSINESS_B])
    await pool.query('DELETE FROM subscriptions WHERE business_id IN ($1, $2)', [BUSINESS_A, BUSINESS_B])
    await pool.query('DELETE FROM user_businesses WHERE user_id IN ($1, $2)', [USER_A, USER_B])
    await pool.query('DELETE FROM businesses WHERE id IN ($1, $2)', [BUSINESS_A, BUSINESS_B])
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [USER_A, USER_B, SUPER_USER])
    await pool.end()
  })

  // ---------------------------------------------------------------------------
  // 1. Positive Execution
  // ---------------------------------------------------------------------------
  it('PROV-001: Owner creates and executes a provisioning job for ISP_MANAGEMENT', async () => {
    const res = await request(app)
      .post('/v1/provisioning/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        business_id: BUSINESS_A,
        service_code: 'ISP_MANAGEMENT',
        action: 'ACTIVATE',
        subscription_id: subAId,
        payload: { speed_tier: 'TURBO_100' },
      })
      .expect(201)

    expect(res.body.id).toBeDefined()
    expect(res.body.business_id).toBe(BUSINESS_A)
    expect(res.body.service_code).toBe('ISP_MANAGEMENT')
    expect(res.body.action).toBe('ACTIVATE')
    expect(res.body.status).toBe('COMPLETED')
    expect(res.body.result).toBeDefined()
    expect(res.body.result.radius_policy).toBe('ENABLED')
    expect(res.body.result.acs_sync).toBe('SYNCHRONIZED')
    expect(res.body.result.speed_tier).toBe('TURBO_100')
    expect(res.body.completed_at).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // 2. Tenant Isolation - List
  // ---------------------------------------------------------------------------
  it('PROV-002: Tenant listing only returns own provisioning jobs', async () => {
    // Tenant B creates a job
    await request(app)
      .post('/v1/provisioning/jobs')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        business_id: BUSINESS_B,
        service_code: 'WA_GATEWAY',
        action: 'ACTIVATE',
      })
      .expect(201)

    // Tenant A lists jobs
    const resA = await request(app)
      .get('/v1/provisioning/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)

    expect(resA.body.items.length).toBeGreaterThan(0)
    for (const job of resA.body.items) {
      expect(job.business_id).toBe(BUSINESS_A)
    }

    // Tenant B lists jobs
    const resB = await request(app)
      .get('/v1/provisioning/jobs')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200)

    expect(resB.body.items.length).toBe(1)
    expect(resB.body.items[0].business_id).toBe(BUSINESS_B)
  })

  // ---------------------------------------------------------------------------
  // 3. Tenant Isolation - Cross Tenant Retrieval
  // ---------------------------------------------------------------------------
  it('PROV-003: Cross-tenant job retrieval returns 404', async () => {
    // Get Tenant A's job ID
    const listRes = await request(app)
      .get('/v1/provisioning/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)

    const jobA = listRes.body.items[0]

    // Tenant B attempts to get Tenant A's job
    await request(app)
      .get(`/v1/provisioning/jobs/${jobA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404)
  })

  // ---------------------------------------------------------------------------
  // 4. Tenant Isolation - Spoofing business_id in payload
  // ---------------------------------------------------------------------------
  it('PROV-004: Tenant token attempting to provision for another business_id returns 403', async () => {
    const res = await request(app)
      .post('/v1/provisioning/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        business_id: BUSINESS_B, // Mismatch with tokenA
        service_code: 'ISP_MANAGEMENT',
        action: 'ACTIVATE',
      })
      .expect(403)

    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  // ---------------------------------------------------------------------------
  // 5. Idempotency Key
  // ---------------------------------------------------------------------------
  it('PROV-005: Idempotency key prevents duplicate job creation', async () => {
    const key = `idemp-${randomUUID()}`

    const res1 = await request(app)
      .post('/v1/provisioning/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        business_id: BUSINESS_A,
        service_code: 'CCTV_MANAGEMENT',
        action: 'ACTIVATE',
        idempotency_key: key,
      })
      .expect(201)

    const res2 = await request(app)
      .post('/v1/provisioning/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        business_id: BUSINESS_A,
        service_code: 'CCTV_MANAGEMENT',
        action: 'ACTIVATE',
        idempotency_key: key,
      })
      .expect(201)

    expect(res1.body.id).toBe(res2.body.id)
  })

  // ---------------------------------------------------------------------------
  // 6. Validation - Unknown Service Code
  // ---------------------------------------------------------------------------
  it('PROV-006: Unknown service code returns 400 ValidationError', async () => {
    const res = await request(app)
      .post('/v1/provisioning/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        business_id: BUSINESS_A,
        service_code: 'UNKNOWN_SERVICE',
        action: 'ACTIVATE',
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  // ---------------------------------------------------------------------------
  // 7. Validation - Invalid Action
  // ---------------------------------------------------------------------------
  it('PROV-007: Invalid action returns 400 ValidationError', async () => {
    const res = await request(app)
      .post('/v1/provisioning/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        business_id: BUSINESS_A,
        service_code: 'ISP_MANAGEMENT',
        action: 'INVALID_ACTION',
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  // ---------------------------------------------------------------------------
  // 8. Audit Logs
  // ---------------------------------------------------------------------------
  it('PROV-008: GET /v1/provisioning/jobs/:id/logs returns audit history', async () => {
    const jobRes = await request(app)
      .post('/v1/provisioning/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        business_id: BUSINESS_A,
        service_code: 'AUTOPOST',
        action: 'ACTIVATE',
      })
      .expect(201)

    const logsRes = await request(app)
      .get(`/v1/provisioning/jobs/${jobRes.body.id}/logs`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)

    expect(logsRes.body.items).toBeDefined()
    expect(logsRes.body.items.length).toBeGreaterThanOrEqual(2) // CREATED + COMPLETED
    expect(logsRes.body.items[0].status).toBe('PENDING')
    expect(logsRes.body.items[1].status).toBe('COMPLETED')
  })

  // ---------------------------------------------------------------------------
  // 9. Retry Mechanism for Failed Jobs
  // ---------------------------------------------------------------------------
  it('PROV-009: Failed job can be retried and increments attempt counter', async () => {
    // Manually insert a FAILED job
    const jobId = randomUUID()
    await pool.query(
      `INSERT INTO provisioning_jobs (id, business_id, service_code, action, status, attempts, max_attempts, error_message)
       VALUES ($1, $2, 'ISP_MANAGEMENT', 'ACTIVATE', 'FAILED', 1, 3, 'Simulated ACS network timeout')`,
      [jobId, BUSINESS_A]
    )

    // Retry the job
    const retryRes = await request(app)
      .post(`/v1/provisioning/jobs/${jobId}/retry`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)

    expect(retryRes.body.id).toBe(jobId)
    expect(retryRes.body.status).toBe('COMPLETED')
    expect(retryRes.body.attempts).toBe(2)
  })

  // ---------------------------------------------------------------------------
  // 10. Independence from ERP Entitlement
  // ---------------------------------------------------------------------------
  it('PROV-010: Tenant without ERP entitlement can freely access /v1/provisioning/jobs', async () => {
    // Tenant A only has ISP_MANAGEMENT, no ERP subscription
    // Verify ERP endpoint is blocked:
    await request(app)
      .get('/v1/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403)

    // Verify Provisioning endpoint is accessible:
    const res = await request(app)
      .get('/v1/provisioning/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)

    expect(res.body.items).toBeDefined()
  })
})
