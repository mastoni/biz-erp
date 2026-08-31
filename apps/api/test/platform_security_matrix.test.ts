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

// Phase 4.1.41B-6: Security integration audit of the full platform
// identity / auth / control-plane chain. Focuses ONLY on security cases
// not already covered by PA/CTX/RSVC/platform_middleware suites.

const BUSINESS_A = randomUUID()
const BUSINESS_B = randomUUID()

const JWT_SECRET = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
const JWT_ISSUER = process.env.JWT_ISSUER || 'biz-erp-api'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'biz-erp-client'

const sign = (payload: Record<string, unknown>, opts: jwt.SignOptions = {}) =>
  jwt.sign(payload, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, ...opts })

describe('Phase 4.1.41B-6 Platform Security Matrix', () => {
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
        businesses,
        users
      RESTART IDENTITY CASCADE
    `)
    await pool.query(
      `INSERT INTO businesses (id, name) VALUES ($1, $2), ($3, $4) ON CONFLICT (id) DO NOTHING`,
      [BUSINESS_A, 'Business A', BUSINESS_B, 'Business B']
    )
  })

  async function seedUser(email: string, platformRole: 'PLATFORM_ADMIN' | 'SUPER_ADMIN' | null): Promise<string> {
    const id = randomUUID()
    const hash = await hashPassword('password123')
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status, platform_role) VALUES ($1, $2, $3, $4, $5)',
      [id, email, hash, 'ACTIVE', platformRole]
    )
    return id
  }

  async function seedTenant(email: string, businessId: string, role: 'OWNER' | 'CASHIER'): Promise<string> {
    const id = await seedUser(email, null)
    await pool.query(
      'INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, $3, $4)',
      [id, businessId, role, 'ACTIVE']
    )
    return id
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

  // Real logins for valid-context tokens.
  async function platformLogin(email: string): Promise<string> {
    const res = await request(app).post('/v1/auth/login').set('x-auth-context', 'platform').send({ email, password: 'password123' })
    expect(res.status).toBe(200)
    return res.body.access_token
  }
  async function tenantLogin(email: string): Promise<string> {
    const res = await request(app).post('/v1/auth/login').send({ email, password: 'password123' })
    expect(res.status).toBe(200)
    return res.body.access_token
  }

  // ---------------------------------------------------------------------------
  // A. TENANT TOKEN -> TENANT ROUTES
  // ---------------------------------------------------------------------------
  it('A. OWNER tenant token allowed on tenant route', async () => {
    await seedTenant('owner@test.com', BUSINESS_A, 'OWNER')
    const token = await tenantLogin('owner@test.com')
    const res = await request(app).get('/v1/auth/me').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.business.id).toBe(BUSINESS_A)
  })

  it('A. CASHIER tenant token allowed on tenant route', async () => {
    await seedTenant('cashier@test.com', BUSINESS_A, 'CASHIER')
    const token = await tenantLogin('cashier@test.com')
    const res = await request(app).get('/v1/auth/me').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.business.id).toBe(BUSINESS_A)
  })

  // ---------------------------------------------------------------------------
  // B. TENANT TOKEN -> PLATFORM ROUTES
  // ---------------------------------------------------------------------------
  it('B. CASHIER tenant token rejected on platform route (WRONG_SCOPE)', async () => {
    await seedTenant('cashier2@test.com', BUSINESS_A, 'CASHIER')
    const token = await tenantLogin('cashier2@test.com')
    const res = await request(app).get('/v1/platform/businesses').set(auth(token))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('WRONG_SCOPE')
  })

  it('B. OWNER tenant token rejected on platform route (WRONG_SCOPE)', async () => {
    await seedTenant('owner2@test.com', BUSINESS_A, 'OWNER')
    const token = await tenantLogin('owner2@test.com')
    const res = await request(app).get('/v1/platform/businesses').set(auth(token))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('WRONG_SCOPE')
  })

  it('B. legacy (no-scope) tenant token rejected on platform route (WRONG_SCOPE)', async () => {
    const legacy = sign({ sub: randomUUID(), business_id: BUSINESS_A, role: 'OWNER', session_id: 's', jti: 'j' })
    const res = await request(app).get('/v1/platform/businesses').set(auth(legacy))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('WRONG_SCOPE')
  })

  // ---------------------------------------------------------------------------
  // C. PLATFORM TOKEN -> PLATFORM ROUTES
  // ---------------------------------------------------------------------------
  it('C. PLATFORM_ADMIN token allowed on platform route', async () => {
    await seedUser('padm@test.com', 'PLATFORM_ADMIN')
    const token = await platformLogin('padm@test.com')
    const res = await request(app).get('/v1/platform/context').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('PLATFORM_ADMIN')
  })

  it('C. SUPER_ADMIN token allowed on platform route', async () => {
    await seedUser('psup@test.com', 'SUPER_ADMIN')
    const token = await platformLogin('psup@test.com')
    const res = await request(app).get('/v1/platform/context').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('SUPER_ADMIN')
  })

  // ---------------------------------------------------------------------------
  // D. PLATFORM TOKEN -> TENANT ROUTES
  // ---------------------------------------------------------------------------
  it('D. PLATFORM_ADMIN token rejected on tenant route (WRONG_SCOPE)', async () => {
    await seedUser('padm2@test.com', 'PLATFORM_ADMIN')
    const token = await platformLogin('padm2@test.com')
    const res = await request(app).get(`/v1/subscriptions?business_id=${BUSINESS_A}`).set(auth(token))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('WRONG_SCOPE')
  })

  it('D. SUPER_ADMIN token rejected on tenant route (WRONG_SCOPE)', async () => {
    await seedUser('psup2@test.com', 'SUPER_ADMIN')
    const token = await platformLogin('psup2@test.com')
    const res = await request(app).get(`/v1/subscriptions?business_id=${BUSINESS_A}`).set(auth(token))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('WRONG_SCOPE')
  })

  // ---------------------------------------------------------------------------
  // E. INVALID AUTH
  // ---------------------------------------------------------------------------
  it('E. invalid JWT rejected (401 INVALID_TOKEN)', async () => {
    const res = await request(app).get('/v1/platform/businesses').set(auth('garbage.token.value'))
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  it('E. expired JWT rejected (401 INVALID_TOKEN)', async () => {
    const expired = sign({ sub: randomUUID(), scope: 'platform', role: 'PLATFORM_ADMIN', session_id: 's', jti: 'j' }, { expiresIn: '-1s' })
    const res = await request(app).get('/v1/platform/businesses').set(auth(expired))
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  // ---------------------------------------------------------------------------
  // F. PLATFORM TOKEN INTEGRITY
  // ---------------------------------------------------------------------------
  it('F. platform token carrying business_id rejected (INVALID_PLATFORM_TOKEN)', async () => {
    const bad = sign({ sub: randomUUID(), scope: 'platform', role: 'PLATFORM_ADMIN', business_id: BUSINESS_A, session_id: 's', jti: 'j' })
    const res = await request(app).get('/v1/platform/businesses').set(auth(bad))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('INVALID_PLATFORM_TOKEN')
  })

  it('F. platform token carrying CASHIER role rejected (FORBIDDEN)', async () => {
    const bad = sign({ sub: randomUUID(), scope: 'platform', role: 'CASHIER', session_id: 's', jti: 'j' })
    const res = await request(app).get('/v1/platform/businesses').set(auth(bad))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('F. platform token carrying OWNER role rejected (FORBIDDEN)', async () => {
    const bad = sign({ sub: randomUUID(), scope: 'platform', role: 'OWNER', session_id: 's', jti: 'j' })
    const res = await request(app).get('/v1/platform/businesses').set(auth(bad))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  // ---------------------------------------------------------------------------
  // G. TENANT TOKEN INTEGRITY
  // ---------------------------------------------------------------------------
  it('G. tenant token without business_id rejected (INVALID_TOKEN)', async () => {
    const bad = sign({ sub: randomUUID(), scope: 'tenant', role: 'OWNER', session_id: 's', jti: 'j' })
    const res = await request(app).get('/v1/auth/me').set(auth(bad))
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  it('G. tenant token carrying PLATFORM_ADMIN role rejected (INVALID_TOKEN)', async () => {
    const bad = sign({ sub: randomUUID(), scope: 'tenant', role: 'PLATFORM_ADMIN', business_id: BUSINESS_A, session_id: 's', jti: 'j' })
    const res = await request(app).get('/v1/auth/me').set(auth(bad))
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  it('G. tenant token carrying SUPER_ADMIN role rejected (INVALID_TOKEN)', async () => {
    const bad = sign({ sub: randomUUID(), scope: 'tenant', role: 'SUPER_ADMIN', business_id: BUSINESS_A, session_id: 's', jti: 'j' })
    const res = await request(app).get('/v1/auth/me').set(auth(bad))
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  // ---------------------------------------------------------------------------
  // H. LOGIN CONTEXT
  // ---------------------------------------------------------------------------
  it('H. invalid x-auth-context value rejected (400 VALIDATION_ERROR)', async () => {
    await seedUser('invctx@test.com', 'PLATFORM_ADMIN')
    const res = await request(app).post('/v1/auth/login').set('x-auth-context', 'bogus').send({ email: 'invctx@test.com', password: 'password123' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  // ---------------------------------------------------------------------------
  // Endpoint matrix: all 6 platform endpoints reject tenant token, accept platform
  // ---------------------------------------------------------------------------
  const PLATFORM_ENDPOINTS = [
    '/v1/platform/context',
    '/v1/platform/businesses',
    '/v1/platform/modules',
    '/v1/platform/plans',
    '/v1/platform/bundles',
    '/v1/platform/subscriptions'
  ]

  it('ENDPOINT MATRIX. every platform endpoint rejects tenant token (WRONG_SCOPE)', async () => {
    await seedTenant('matrix_t@test.com', BUSINESS_A, 'OWNER')
    const token = await tenantLogin('matrix_t@test.com')
    for (const ep of PLATFORM_ENDPOINTS) {
      const res = await request(app).get(ep).set(auth(token))
      expect(res.status, ep).toBe(403)
      expect(res.body.error.code, ep).toBe('WRONG_SCOPE')
    }
  })

  it('ENDPOINT MATRIX. every platform endpoint accepts platform token', async () => {
    await seedUser('matrix_p@test.com', 'PLATFORM_ADMIN')
    const token = await platformLogin('matrix_p@test.com')
    for (const ep of PLATFORM_ENDPOINTS) {
      const res = await request(app).get(ep).set(auth(token))
      expect(res.status, ep).toBe(200)
    }
  })

  it('ENDPOINT MATRIX. platform reads do not reuse req.businessId', async () => {
    await seedUser('matrix_p2@test.com', 'PLATFORM_ADMIN')
    const token = await platformLogin('matrix_p2@test.com')
    const res = await request(app).get('/v1/platform/context').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.businessId).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // J. TENANT ISOLATION
  // ---------------------------------------------------------------------------
  it('J. tenant A cannot access tenant B data (BUSINESS_ACCESS_DENIED)', async () => {
    await seedTenant('isotenant@test.com', BUSINESS_A, 'OWNER')
    const token = await tenantLogin('isoTenant@test.com')
    const res = await request(app).get(`/v1/subscriptions?business_id=${BUSINESS_B}`).set(auth(token))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  it('J. platform login does NOT grant implicit tenant membership', async () => {
    const id = await seedUser('isoplatform@test.com', 'PLATFORM_ADMIN')
    await platformLogin('isoPlatform@test.com')
    const res = await pool.query('SELECT * FROM user_businesses WHERE user_id = $1', [id])
    expect(res.rows.length).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // DATABASE INVARIANTS (read-only verification, no schema change)
  // ---------------------------------------------------------------------------
  it('DB INVARIANT. refresh_tokens.scope constrained to tenant|platform and business_id nullable', async () => {
    const r = await pool.query(
      "SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='refresh_tokens'::regclass AND contype='c'"
    )
    const scopeCheck = r.rows.find((c: any) => c.conname === 'refresh_tokens_scope_check')
    expect(scopeCheck).toBeDefined()
    expect(scopeCheck.def).toContain("'tenant'")
    expect(scopeCheck.def).toContain("'platform'")
    const nullable = await pool.query(
      `SELECT is_nullable FROM information_schema.columns WHERE table_name='refresh_tokens' AND column_name='business_id'`
    )
    expect(nullable.rows[0].is_nullable).toBe('YES')
  })

  it('DB INVARIANT. users.platform_role exists and is nullable', async () => {
    const r = await pool.query(
      `SELECT is_nullable FROM information_schema.columns WHERE table_name='users' AND column_name='platform_role'`
    )
    expect(r.rows.length).toBe(1)
    expect(r.rows[0].is_nullable).toBe('YES')
  })

  it('DB INVARIANT. user_businesses.role constrained and business_id NOT NULL', async () => {
    const r = await pool.query(
      "SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='user_businesses'::regclass AND contype='c'"
    )
    const roleCheck = r.rows.find((c: any) => c.conname === 'user_businesses_role_check')
    expect(roleCheck).toBeDefined()
    expect(roleCheck.def).toContain("'OWNER'")
    expect(roleCheck.def).toContain("'CASHIER'")
    const nn = await pool.query(
      `SELECT is_nullable FROM information_schema.columns WHERE table_name='user_businesses' AND column_name='business_id'`
    )
    expect(nn.rows[0].is_nullable).toBe('NO')
  })
})
