import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { Pool } from 'pg'
import path from 'path'
import { randomUUID } from 'crypto'
import { createJwtService } from '../src/services/jwt_service'
import { ApiError } from '../src/errors/api_error'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const secret = 'supersecretkeythatisatleast32characterslong'
const issuer = 'biz-erp-api'
const audience = 'biz-erp-client'
// Align the app's JWT env with this test's service so app-issued tokens verify.
process.env.JWT_SECRET = secret
process.env.JWT_ISSUER = issuer
process.env.JWT_AUDIENCE = audience
const jwtService = createJwtService(secret, issuer, audience)

describe('Phase 4.1.41B-2 JWT scope model', () => {
  const base = () => ({
    sub: randomUUID(),
    session_id: randomUUID(),
    jti: randomUUID()
  })

  it('SCOPE-001 tenant token carries explicit tenant scope', () => {
    const token = jwtService.signAccessToken({ ...base(), scope: 'tenant', business_id: randomUUID(), role: 'OWNER' })
    const decoded = jwtService.verifyAccessToken(token)
    expect(decoded.scope).toBe('tenant')
    expect(decoded.business_id).toBeDefined()
  })

  it('SCOPE-002 platform token has no business_id', () => {
    const token = jwtService.signAccessToken({ ...base(), scope: 'platform', role: 'PLATFORM_ADMIN' })
    const decoded = jwtService.verifyAccessToken(token)
    expect(decoded.scope).toBe('platform')
    expect(decoded.business_id).toBeUndefined()
    expect(decoded.role).toBe('PLATFORM_ADMIN')
  })

  it('SCOPE-003 tenant token missing business_id is rejected', () => {
    const token = jwt.sign(
      { sub: base().sub, scope: 'tenant', role: 'OWNER', session_id: base().session_id, jti: base().jti },
      secret,
      { algorithm: 'HS256', expiresIn: '15m', issuer, audience }
    )
    expect(() => jwtService.verifyAccessToken(token)).toThrowError(ApiError)
  })

  it('SCOPE-004 platform token containing business_id is rejected', () => {
    const token = jwtService.signAccessToken({ ...base(), scope: 'platform', business_id: randomUUID(), role: 'PLATFORM_ADMIN' })
    expect(() => jwtService.verifyAccessToken(token)).toThrowError(new ApiError(403, 'INVALID_PLATFORM_TOKEN', 'Platform token must not contain a business_id'))
  })

  it('SCOPE-005 invalid scope is rejected', () => {
    const token = jwt.sign(
      { sub: base().sub, scope: 'unknown', session_id: base().session_id, jti: base().jti },
      secret,
      { algorithm: 'HS256', expiresIn: '15m', issuer, audience }
    )
    expect(() => jwtService.verifyAccessToken(token)).toThrowError(ApiError)
  })

  it('SCOPE-006 OWNER can never become a platform token', () => {
    const token = jwtService.signAccessToken({ ...base(), scope: 'platform', role: 'OWNER' })
    expect(() => jwtService.verifyAccessToken(token)).toThrowError(ApiError)
  })

  it('SCOPE-007 PLATFORM_ADMIN token is valid', () => {
    const token = jwtService.signAccessToken({ ...base(), scope: 'platform', role: 'PLATFORM_ADMIN' })
    expect(jwtService.verifyAccessToken(token).role).toBe('PLATFORM_ADMIN')
  })

  it('SCOPE-008 SUPER_ADMIN token is valid', () => {
    const token = jwtService.signAccessToken({ ...base(), scope: 'platform', role: 'SUPER_ADMIN' })
    const decoded = jwtService.verifyAccessToken(token)
    expect(decoded.role).toBe('SUPER_ADMIN')
    expect(decoded.scope).toBe('platform')
  })

  it('SCOPE-009 legacy token without scope defaults to tenant', () => {
    const token = jwt.sign(
      { sub: base().sub, business_id: randomUUID(), role: 'OWNER', session_id: base().session_id, jti: base().jti },
      secret,
      { algorithm: 'HS256', expiresIn: '15m', issuer, audience }
    )
    const decoded = jwtService.verifyAccessToken(token)
    expect(decoded.scope).toBe('tenant')
  })

  it('SCOPE-010 legacy token is never platform', () => {
    const token = jwt.sign(
      { sub: base().sub, business_id: randomUUID(), role: 'OWNER', session_id: base().session_id, jti: base().jti },
      secret,
      { algorithm: 'HS256', expiresIn: '15m', issuer, audience }
    )
    const decoded = jwtService.verifyAccessToken(token)
    expect(decoded.scope).toBe('tenant')
    expect(decoded.scope).not.toBe('platform')
  })
})

describe('Phase 4.1.41B-2 refresh preserves scope + role (tenant)', () => {
  let pool: Pool
  let app: Express

  const BUSINESS = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

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
      TRUNCATE TABLE user_businesses, refresh_tokens, users, businesses
      RESTART IDENTITY CASCADE
    `)
    await pool.query(
      `INSERT INTO businesses (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [BUSINESS, 'Business D']
    )
    const userId = randomUUID()
    const hash = await import('../src/services/password_service').then((m) => m.hashPassword('SecurePass123!'))
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)',
      [userId, 'ownerd@test.com', hash, 'ACTIVE']
    )
    await pool.query(
      'INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, $3, $4)',
      [userId, BUSINESS, 'OWNER', 'ACTIVE']
    )
  })

  it('SCOPE-011 refreshed tenant token preserves scope=tenant and role=OWNER', async () => {
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'ownerd@test.com', password: 'SecurePass123!' })
    expect(loginRes.status).toBe(200)
    const accessToken = loginRes.body.access_token

    const refreshRes = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: loginRes.body.refresh_token })
    expect(refreshRes.status).toBe(200)

    const before = jwtService.verifyAccessToken(accessToken)
    const after = jwtService.verifyAccessToken(refreshRes.body.access_token)

    expect(before.scope).toBe('tenant')
    expect(after.scope).toBe('tenant')
    expect(after.role).toBe(before.role)
  })
})
