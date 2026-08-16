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
import { createRefreshTokenService } from '../src/services/refresh_token_service'
import { createUserRepository } from '../src/repositories/user_repository'

describe('Phase 4.0.7 Refresh API', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>
  let refreshTokenService: ReturnType<typeof createRefreshTokenService>

  const BUSINESS_A = randomUUID()
  const BUSINESS_B = randomUUID()

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    }

    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    app = createApp(pool)

    const jwtSecret = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
    const jwtIssuer = process.env.JWT_ISSUER || 'biz-erp-api'
    const jwtAudience = process.env.JWT_AUDIENCE || 'biz-erp-client'
    jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
    refreshTokenService = createRefreshTokenService(pool)
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
      `
        INSERT INTO businesses (id, name)
        VALUES ($1, $2), ($3, $4)
        ON CONFLICT (id) DO NOTHING
      `,
      [BUSINESS_A, 'Business A', BUSINESS_B, 'Business B']
    )
  })

  async function seedUser(email: string, status: string = 'ACTIVE'): Promise<string> {
    const id = randomUUID()
    const passwordHash = await hashPassword('pass123')
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)',
      [id, email, passwordHash, status]
    )
    return id
  }

  async function seedMembership(userId: string, businessId: string, role: string = 'OWNER', status: string = 'ACTIVE'): Promise<void> {
    await pool.query(
      'INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, $3, $4)',
      [userId, businessId, role, status]
    )
  }

  it('AUTH-REFRESH-001 valid refresh returns 200', async () => {
    const userId = await seedUser('refresh1@test.com')
    await seedMembership(userId, BUSINESS_A)

    const { refreshToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken })

    expect(res.status).toBe(200)
    expect(res.body.access_token).toBeDefined()
    expect(res.body.refresh_token).toBeDefined()
    expect(res.body.refresh_token).not.toBe(refreshToken)
    expect(res.body.expires_in).toBe(900)
  })

  it('AUTH-REFRESH-002 new access token verifies', async () => {
    const userId = await seedUser('refresh2@test.com')
    await seedMembership(userId, BUSINESS_A, 'CASHIER')

    const { refreshToken, session } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken })

    const claims = jwtService.verifyAccessToken(res.body.access_token)
    expect(claims.sub).toBe(userId)
    expect(claims.business_id).toBe(BUSINESS_A)
    expect(claims.role).toBe('CASHIER')
    expect(claims.session_id).toBeDefined()
    expect(claims.session_id).not.toBe(session.id)
    expect(claims.jti).toBeDefined()
  })

  it('AUTH-REFRESH-003 new refresh token returned', async () => {
    const userId = await seedUser('refresh3@test.com')
    await seedMembership(userId, BUSINESS_A)

    const { refreshToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken })

    expect(res.body.refresh_token).toBeDefined()
    expect(res.body.refresh_token).not.toBe(refreshToken)
  })

  it('AUTH-REFRESH-004 old refresh token rejected after rotation', async () => {
    const userId = await seedUser('refresh4@test.com')
    await seedMembership(userId, BUSINESS_A)

    const { refreshToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)

    // First rotation
    await request(app).post('/v1/auth/refresh').send({ refresh_token: refreshToken })

    // Second rotation with OLD token
    const res2 = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken })

    expect(res2.status).toBe(401)
    expect(res2.body.error.code).toBe('INVALID_REFRESH_TOKEN')
  })

  it('AUTH-REFRESH-005 unknown refresh token rejected', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: 'some-random-unknown-token' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN')
  })

  it('AUTH-REFRESH-006 expired refresh token rejected', async () => {
    const userId = await seedUser('refresh6@test.com')
    await seedMembership(userId, BUSINESS_A)

    const { refreshToken, session } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)

    // manually expire the session in the db
    await pool.query('UPDATE refresh_tokens SET expires_at = $1 WHERE id = $2', [new Date(Date.now() - 10000), session.id])

    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN')
  })

  it('AUTH-REFRESH-007 revoked refresh token rejected', async () => {
    const userId = await seedUser('refresh7@test.com')
    await seedMembership(userId, BUSINESS_A)

    const { refreshToken, session } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)

    await refreshTokenService.revokeRefreshToken(refreshToken)

    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN')
  })

  it('AUTH-REFRESH-008 business membership still active', async () => {
    const userId = await seedUser('refresh8@test.com')
    await seedMembership(userId, BUSINESS_A)

    const { refreshToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken })

    expect(res.status).toBe(200)
  })

  it('AUTH-REFRESH-009 revoked membership rejected', async () => {
    const userId = await seedUser('refresh9@test.com')
    await seedMembership(userId, BUSINESS_A)

    const { refreshToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)

    // Revoke the membership directly in DB
    await pool.query('UPDATE user_businesses SET status = $1 WHERE user_id = $2 AND business_id = $3', ['REVOKED', userId, BUSINESS_A])

    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  it('AUTH-REFRESH-010 JWT claims correct after refresh', async () => {
    const userId = await seedUser('refresh10@test.com')
    await seedMembership(userId, BUSINESS_A, 'CASHIER')

    const { refreshToken, session } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken })

    const claims = jwtService.verifyAccessToken(res.body.access_token)
    expect(claims.sub).toBe(userId)
    expect(claims.business_id).toBe(BUSINESS_A)
    expect(claims.role).toBe('CASHIER')
    expect(claims.session_id).toBeDefined()
    expect(claims.session_id).not.toBe(session.id)
  })

  it('AUTH-REFRESH-011 concurrent same-token requests produce one success', async () => {
    const userId = await seedUser('refresh11@test.com')
    await seedMembership(userId, BUSINESS_A)

    const { refreshToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)

    // Fire two requests concurrently
    const [res1, res2] = await Promise.all([
      request(app).post('/v1/auth/refresh').send({ refresh_token: refreshToken }),
      request(app).post('/v1/auth/refresh').send({ refresh_token: refreshToken })
    ])

    const statuses = [res1.status, res2.status].sort()
    // One must succeed, one must fail with 401
    expect(statuses).toEqual([200, 401])
  })

  it('AUTH-REFRESH-012 no raw token appears in logs', async () => {
    const userId = await seedUser('refresh12@test.com')
    await seedMembership(userId, BUSINESS_A)

    const { refreshToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken })

    expect(JSON.stringify(res.body)).not.toContain(refreshToken)
  })

  it('AUTH-REFRESH-013 malformed request body handled safely', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({}) // missing refresh_token

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN')

    const res2 = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: 123 }) // wrong type

    expect(res2.status).toBe(401)
    expect(res2.body.error.code).toBe('INVALID_REFRESH_TOKEN')
  })

  it('AUTH-REFRESH-014 refresh endpoint does not require X-Demo-Business-Id', async () => {
    const userId = await seedUser('refresh14@test.com')
    await seedMembership(userId, BUSINESS_A)

    const { refreshToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/refresh')
      // not sending X-Demo-Business-Id
      .send({ refresh_token: refreshToken })

    expect(res.status).toBe(200)
    expect(res.body.access_token).toBeDefined()
  })
})
