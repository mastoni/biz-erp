import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import path from 'path'
import { randomUUID } from 'crypto'
import { createJwtService } from '../src/services/jwt_service'
import { ApiError } from '../src/errors/api_error'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import request from 'supertest'

const secret = 'supersecretkeythatisatleast32characterslong'
const issuer = 'biz-erp-api'
const audience = 'biz-erp-client'
// Align the app's JWT env with this test's service.
process.env.JWT_SECRET = secret
process.env.JWT_ISSUER = issuer
process.env.JWT_AUDIENCE = audience
const jwtService = createJwtService(secret, issuer, audience)

describe('Phase 4.1.41B-3 Platform/Tenant middleware boundary', () => {
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

  const platformToken = (role: 'PLATFORM_ADMIN' | 'SUPER_ADMIN', withBusinessId = false) =>
    jwtService.signAccessToken({
      sub: randomUUID(),
      scope: 'platform',
      business_id: withBusinessId ? randomUUID() : undefined,
      role,
      session_id: randomUUID(),
      jti: randomUUID()
    })

  const tenantToken = (role: 'OWNER' | 'CASHIER') =>
    jwtService.signAccessToken({
      sub: randomUUID(),
      scope: 'tenant',
      business_id: randomUUID(),
      role,
      session_id: randomUUID(),
      jti: randomUUID()
    })

  const legacyToken = () => {
    // No scope claim -> must be treated as tenant, never platform.
    const jwt = require('jsonwebtoken')
    return jwt.sign(
      { sub: randomUUID(), business_id: randomUUID(), role: 'OWNER', session_id: randomUUID(), jti: randomUUID() },
      secret,
      { algorithm: 'HS256', expiresIn: '15m', issuer, audience }
    )
  }

  it('PLAT-001 valid PLATFORM_ADMIN token -> platform route -> 200', async () => {
    const res = await request(app)
      .get('/v1/platform/context')
      .set('Authorization', `Bearer ${platformToken('PLATFORM_ADMIN')}`)
    expect(res.status).toBe(200)
    expect(res.body.scope).toBe('platform')
    expect(res.body.role).toBe('PLATFORM_ADMIN')
  })

  it('PLAT-002 valid SUPER_ADMIN token -> platform route -> 200', async () => {
    const res = await request(app)
      .get('/v1/platform/context')
      .set('Authorization', `Bearer ${platformToken('SUPER_ADMIN')}`)
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('SUPER_ADMIN')
  })

  it('PLAT-003 OWNER token -> platform route -> 403 WRONG_SCOPE', async () => {
    const res = await request(app)
      .get('/v1/platform/context')
      .set('Authorization', `Bearer ${tenantToken('OWNER')}`)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('WRONG_SCOPE')
  })

  it('PLAT-004 CASHIER token -> platform route -> 403 WRONG_SCOPE', async () => {
    const res = await request(app)
      .get('/v1/platform/context')
      .set('Authorization', `Bearer ${tenantToken('CASHIER')}`)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('WRONG_SCOPE')
  })

  it('PLAT-005 tenant token -> platform route -> 403 WRONG_SCOPE', async () => {
    const res = await request(app)
      .get('/v1/platform/context')
      .set('Authorization', `Bearer ${tenantToken('OWNER')}`)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('WRONG_SCOPE')
  })

  it('PLAT-006 platform token -> tenant route -> 403 WRONG_SCOPE', async () => {
    const res = await request(app)
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${platformToken('PLATFORM_ADMIN')}`)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('WRONG_SCOPE')
  })

  it('PLAT-007 legacy token without scope -> platform route -> 403 WRONG_SCOPE', async () => {
    const res = await request(app)
      .get('/v1/platform/context')
      .set('Authorization', `Bearer ${legacyToken()}`)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('WRONG_SCOPE')
  })

  it('PLAT-008 invalid JWT -> 401 INVALID_TOKEN', async () => {
    const res = await request(app)
      .get('/v1/platform/context')
      .set('Authorization', 'Bearer not.a.real.token')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  it('PLAT-009 platform token with business_id -> rejected', async () => {
    const res = await request(app)
      .get('/v1/platform/context')
      .set('Authorization', `Bearer ${platformToken('PLATFORM_ADMIN', true)}`)
    expect(res.status).toBe(403)
  })

  it('PLAT-010 platform route does not populate req.businessId', async () => {
    const res = await request(app)
      .get('/v1/platform/context')
      .set('Authorization', `Bearer ${platformToken('PLATFORM_ADMIN')}`)
    expect(res.status).toBe(200)
    expect(res.body.businessId).toBeNull()
  })
})
