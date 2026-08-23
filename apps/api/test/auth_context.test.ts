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
import { createJwtService } from '../src/services/jwt_service'

// Phase 4.1.41B-4c: Login / Refresh context selection.
// Covers x-auth-context (tenant|platform), dual identity, mobile rejection,
// platform role re-derivation on refresh, and scope/business_id preservation.

const BUSINESS_A = randomUUID()
const BUSINESS_B = randomUUID()

describe('Phase 4.1.41B-4c Login / Refresh Context', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    app = createApp(pool)

    const jwtSecret = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
    const jwtIssuer = process.env.JWT_ISSUER || 'biz-erp-api'
    const jwtAudience = process.env.JWT_AUDIENCE || 'biz-erp-client'
    jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  })

  afterAll(async () => {
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        user_businesses,
        refresh_tokens,
        users,
        businesses
      RESTART IDENTITY CASCADE
    `)
    await pool.query(
      `INSERT INTO businesses (id, name) VALUES ($1, $2), ($3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [BUSINESS_A, 'Business A', BUSINESS_B, 'Business B']
    )
  })

  async function seedUser(
    email: string,
    password: string,
    opts: { platformRole?: 'PLATFORM_ADMIN' | 'SUPER_ADMIN' | null; status?: string } = {}
  ): Promise<string> {
    const id = randomUUID()
    const hash = await hashPassword(password)
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status, platform_role) VALUES ($1, $2, $3, $4, $5)',
      [id, email, hash, opts.status ?? 'ACTIVE', opts.platformRole ?? null]
    )
    return id
  }

  async function seedMembership(userId: string, businessId: string, role: string = 'OWNER'): Promise<void> {
    await pool.query(
      'INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, $3, $4)',
      [userId, businessId, role, 'ACTIVE']
    )
  }

  const PASS = 'mySecretPassword123'

  it('CTX-001 default login (no header) → tenant', async () => {
    const userId = await seedUser('ctx1@test.com', PASS)
    await seedMembership(userId, BUSINESS_A)

    const res = await request(app).post('/v1/auth/login').send({ email: 'ctx1@test.com', password: PASS })

    expect(res.status).toBe(200)
    const claims = jwtService.verifyAccessToken(res.body.access_token)
    expect(claims.scope).toBe('tenant')
    expect(claims.business_id).toBe(BUSINESS_A)
    expect(res.body.business.id).toBe(BUSINESS_A)
  })

  it('CTX-002 explicit tenant context → tenant', async () => {
    const userId = await seedUser('ctx2@test.com', PASS)
    await seedMembership(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'tenant')
      .send({ email: 'ctx2@test.com', password: PASS })

    expect(res.status).toBe(200)
    const claims = jwtService.verifyAccessToken(res.body.access_token)
    expect(claims.scope).toBe('tenant')
    expect(claims.business_id).toBe(BUSINESS_A)
  })

  it('CTX-003 valid platform user + platform context → platform', async () => {
    const userId = await seedUser('ctx3@test.com', PASS, { platformRole: 'PLATFORM_ADMIN' })

    const res = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email: 'ctx3@test.com', password: PASS })

    expect(res.status).toBe(200)
    const claims = jwtService.verifyAccessToken(res.body.access_token)
    expect(claims.scope).toBe('platform')
    expect(claims.role).toBe('PLATFORM_ADMIN')
    expect(res.body.scope).toBe('platform')
    expect(res.body.role).toBe('PLATFORM_ADMIN')
    expect(res.body.business).toBeUndefined()
  })

  it('CTX-004 dual identity + tenant context → tenant', async () => {
    const userId = await seedUser('ctx4@test.com', PASS, { platformRole: 'SUPER_ADMIN' })
    await seedMembership(userId, BUSINESS_A, 'OWNER')

    const res = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'tenant')
      .send({ email: 'ctx4@test.com', password: PASS })

    expect(res.status).toBe(200)
    const claims = jwtService.verifyAccessToken(res.body.access_token)
    expect(claims.scope).toBe('tenant')
    expect(claims.business_id).toBe(BUSINESS_A)
    expect(claims.role).toBe('OWNER')
  })

  it('CTX-005 dual identity + platform context → platform', async () => {
    const userId = await seedUser('ctx5@test.com', PASS, { platformRole: 'SUPER_ADMIN' })
    await seedMembership(userId, BUSINESS_A, 'OWNER')

    const res = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email: 'ctx5@test.com', password: PASS })

    expect(res.status).toBe(200)
    const claims = jwtService.verifyAccessToken(res.body.access_token)
    expect(claims.scope).toBe('platform')
    expect(claims.role).toBe('SUPER_ADMIN')
    expect(claims.business_id).toBeUndefined()
    expect(res.body.business).toBeUndefined()
  })

  it('CTX-006 platform context without platform_role → 403', async () => {
    const userId = await seedUser('ctx6@test.com', PASS) // no platform_role
    await seedMembership(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email: 'ctx6@test.com', password: PASS })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('PLATFORM_ACCESS_DENIED')
  })

  it('CTX-007 tenant context without business membership → 403 auth failure', async () => {
    const userId = await seedUser('ctx7@test.com', PASS) // no membership

    const res = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'tenant')
      .send({ email: 'ctx7@test.com', password: PASS })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  it('CTX-008 platform token has no business_id', async () => {
    const userId = await seedUser('ctx8@test.com', PASS, { platformRole: 'PLATFORM_ADMIN' })

    const res = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email: 'ctx8@test.com', password: PASS })

    expect(res.status).toBe(200)
    const claims = jwtService.verifyAccessToken(res.body.access_token)
    expect(claims.business_id).toBeUndefined()
    expect(claims.scope).toBe('platform')
  })

  it('CTX-009 tenant token contains business_id', async () => {
    const userId = await seedUser('ctx9@test.com', PASS)
    await seedMembership(userId, BUSINESS_A)

    const res = await request(app).post('/v1/auth/login').send({ email: 'ctx9@test.com', password: PASS })

    expect(res.status).toBe(200)
    const claims = jwtService.verifyAccessToken(res.body.access_token)
    expect(claims.business_id).toBe(BUSINESS_A)
    expect(claims.scope).toBe('tenant')
  })

  it('CTX-010 refresh tenant preserves scope + business_id', async () => {
    const userId = await seedUser('ctx10@test.com', PASS)
    await seedMembership(userId, BUSINESS_A)

    const login = await request(app).post('/v1/auth/login').send({ email: 'ctx10@test.com', password: PASS })
    expect(login.status).toBe(200)
    const refreshToken = login.body.refresh_token

    const res = await request(app).post('/v1/auth/refresh').send({ refresh_token: refreshToken })
    expect(res.status).toBe(200)

    const claims = jwtService.verifyAccessToken(res.body.access_token)
    expect(claims.scope).toBe('tenant')
    expect(claims.business_id).toBe(BUSINESS_A)

    const sessions = await pool.query('SELECT scope, business_id FROM refresh_tokens WHERE id = $1', [claims.session_id])
    expect(sessions.rows[0].scope).toBe('tenant')
    expect(sessions.rows[0].business_id).toBe(BUSINESS_A)
  })

  it('CTX-011 refresh platform preserves scope + NULL business_id', async () => {
    const userId = await seedUser('ctx11@test.com', PASS, { platformRole: 'PLATFORM_ADMIN' })

    const login = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email: 'ctx11@test.com', password: PASS })
    expect(login.status).toBe(200)
    const refreshToken = login.body.refresh_token

    const res = await request(app).post('/v1/auth/refresh').send({ refresh_token: refreshToken })
    expect(res.status).toBe(200)

    const claims = jwtService.verifyAccessToken(res.body.access_token)
    expect(claims.scope).toBe('platform')
    expect(claims.business_id).toBeUndefined()

    const sessions = await pool.query('SELECT scope, business_id FROM refresh_tokens WHERE id = $1', [claims.session_id])
    expect(sessions.rows[0].scope).toBe('platform')
    expect(sessions.rows[0].business_id).toBeNull()
  })

  it('CTX-012 refresh platform role removed → reject', async () => {
    const userId = await seedUser('ctx12@test.com', PASS, { platformRole: 'PLATFORM_ADMIN' })

    const login = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email: 'ctx12@test.com', password: PASS })
    expect(login.status).toBe(200)
    const refreshToken = login.body.refresh_token

    // Demote: remove platform role after session creation.
    await pool.query('UPDATE users SET platform_role = NULL WHERE id = $1', [userId])

    const res = await request(app).post('/v1/auth/refresh').send({ refresh_token: refreshToken })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('PLATFORM_ACCESS_DENIED')
  })

  it('CTX-013 tenant membership removed → refresh reject', async () => {
    const userId = await seedUser('ctx13@test.com', PASS)
    await seedMembership(userId, BUSINESS_A)

    const login = await request(app).post('/v1/auth/login').send({ email: 'ctx13@test.com', password: PASS })
    expect(login.status).toBe(200)
    const refreshToken = login.body.refresh_token

    await pool.query("UPDATE user_businesses SET status = 'REVOKED' WHERE user_id = $1 AND business_id = $2", [
      userId,
      BUSINESS_A
    ])

    const res = await request(app).post('/v1/auth/refresh').send({ refresh_token: refreshToken })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  it('CTX-014 mobile platform context rejected', async () => {
    const userId = await seedUser('ctx14@test.com', PASS, { platformRole: 'PLATFORM_ADMIN' })

    const res = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .set('x-client-type', 'mobile')
      .send({ email: 'ctx14@test.com', password: PASS })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })
})
