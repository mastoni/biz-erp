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

describe('Phase 4.1.3 Auth Session Restore', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>

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
  })

  afterAll(async () => {
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        user_businesses,
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

  function getValidToken(userId: string, businessId: string, role: 'OWNER' | 'CASHIER' = 'OWNER') {
    return jwtService.signAccessToken({
      sub: userId,
      business_id: businessId,
      role: role,
      session_id: randomUUID(),
      jti: randomUUID()
    })
  }

  it('AUTH-ME-001 valid token returns 200 with canonical DTO', async () => {
    const userId = await seedUser('me1@test.com')
    await seedMembership(userId, BUSINESS_A, 'OWNER')

    const token = getValidToken(userId, BUSINESS_A)

    const res = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.user).toBeDefined()
    expect(res.body.user.id).toBe(userId)
    expect(res.body.user.email).toBe('me1@test.com')
    expect(res.body.user.status).toBe('ACTIVE')
    expect(res.body.business).toBeDefined()
    expect(res.body.business.id).toBe(BUSINESS_A)
    expect(res.body.business.name).toBe('Business A')
    expect(res.body.role).toBe('OWNER')
    
    // Sensitive fields are NOT returned
    expect(res.body.user.password_hash).toBeUndefined()
    expect(res.body.user.password).toBeUndefined()
  })

  it('AUTH-ME-002 without token returns 401', async () => {
    const res = await request(app).get('/v1/auth/me')

    expect(res.status).toBe(401)
  })

  it('AUTH-ME-003 with invalid token returns 401', async () => {
    const res = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer invalid-token`)

    expect(res.status).toBe(401)
  })

  it('AUTH-ME-004 user valid but membership inactive returns 403', async () => {
    const userId = await seedUser('me4@test.com')
    await seedMembership(userId, BUSINESS_A, 'OWNER', 'REVOKED') // revoked membership

    const token = getValidToken(userId, BUSINESS_A)

    const res = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  it('AUTH-ME-005 user not found returns 401', async () => {
    const fakeUserId = randomUUID()
    const token = getValidToken(fakeUserId, BUSINESS_A)

    const res = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(401)
    expect(res.body.error.message).toBe('User not found')
  })

  it('AUTH-ME-006 business not match JWT returns 403 (membership not found)', async () => {
    const userId = await seedUser('me6@test.com')
    await seedMembership(userId, BUSINESS_B, 'OWNER')

    const token = getValidToken(userId, BUSINESS_A)

    const res = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })
})
