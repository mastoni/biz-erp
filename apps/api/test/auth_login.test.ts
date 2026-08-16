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

describe('Phase 4.0.6 Login API', () => {
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

  async function seedUser(email: string, passwordHash: string, status: string = 'ACTIVE'): Promise<string> {
    const id = randomUUID()
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

  it('AUTH-LOGIN-001 valid login with single business', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const userId = await seedUser('single@test.com', hash)
    await seedMembership(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'single@test.com', password })

    expect(res.status).toBe(200)
    expect(res.body.access_token).toBeDefined()
    expect(res.body.refresh_token).toBeDefined()
    expect(res.body.user).toBeDefined()
    expect(res.body.user.id).toBe(userId)
    expect(res.body.user.email).toBe('single@test.com')
    expect(res.body.business).toBeDefined()
    expect(res.body.business.id).toBe(BUSINESS_A)
    expect(res.body.business.name).toBe('Business A')
    expect(res.body.role).toBe('OWNER')
    expect(res.body.expires_in).toBe(900)
  })

  it('AUTH-LOGIN-002 invalid password', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const userId = await seedUser('wrongpass@test.com', hash)
    await seedMembership(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'wrongpass@test.com', password: 'wrong' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('AUTH-LOGIN-003 unknown email', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'unknown@test.com', password: 'password123' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('AUTH-LOGIN-004 suspended user', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const userId = await seedUser('suspended@test.com', hash, 'SUSPENDED')
    await seedMembership(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'suspended@test.com', password })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('AUTH-LOGIN-005 active business membership', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const userId = await seedUser('active@test.com', hash)
    await seedMembership(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'active@test.com', password, business_id: BUSINESS_A })

    expect(res.status).toBe(200)
    expect(res.body.business.id).toBe(BUSINESS_A)
  })

  it('AUTH-LOGIN-006 revoked membership', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const userId = await seedUser('revoked@test.com', hash)
    await seedMembership(userId, BUSINESS_A, 'OWNER', 'REVOKED')

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'revoked@test.com', password, business_id: BUSINESS_A })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  it('AUTH-LOGIN-007 business selection required when multiple businesses exist', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const userId = await seedUser('multi@test.com', hash)
    await seedMembership(userId, BUSINESS_A)
    await seedMembership(userId, BUSINESS_B)

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'multi@test.com', password })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('BUSINESS_SELECTION_REQUIRED')
  })

  it('AUTH-LOGIN-008 valid selected business', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const userId = await seedUser('multi@test.com', hash)
    await seedMembership(userId, BUSINESS_A)
    await seedMembership(userId, BUSINESS_B)

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'multi@test.com', password, business_id: BUSINESS_B })

    expect(res.status).toBe(200)
    expect(res.body.business.id).toBe(BUSINESS_B)
  })

  it('AUTH-LOGIN-009 wrong business selection rejected', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const userId = await seedUser('single@test.com', hash)
    await seedMembership(userId, BUSINESS_A) // only has A

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'single@test.com', password, business_id: BUSINESS_B }) // request B

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  it('AUTH-LOGIN-010 access token verifies', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const userId = await seedUser('token@test.com', hash)
    await seedMembership(userId, BUSINESS_A, 'CASHIER')

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'token@test.com', password })

    expect(res.status).toBe(200)
    
    const accessToken = res.body.access_token
    const claims = jwtService.verifyAccessToken(accessToken)

    expect(claims.sub).toBe(userId)
    expect(claims.business_id).toBe(BUSINESS_A)
    expect(claims.role).toBe('CASHIER')
    expect(claims.session_id).toBeDefined()
  })

  it('AUTH-LOGIN-011 refresh session created', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const userId = await seedUser('refresh@test.com', hash)
    await seedMembership(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'refresh@test.com', password })

    expect(res.status).toBe(200)

    const accessToken = res.body.access_token
    const claims = jwtService.verifyAccessToken(accessToken)

    const sessionsRes = await pool.query('SELECT * FROM refresh_tokens WHERE id = $1', [claims.session_id])
    expect(sessionsRes.rows.length).toBe(1)
    expect(sessionsRes.rows[0].user_id).toBe(userId)
    expect(sessionsRes.rows[0].business_id).toBe(BUSINESS_A)
  })

  it('AUTH-LOGIN-012 response contains no password_hash', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const userId = await seedUser('nopass@test.com', hash)
    await seedMembership(userId, BUSINESS_A)

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'nopass@test.com', password })

    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body)).not.toContain('password_hash')
    expect(JSON.stringify(res.body)).not.toContain(hash)
  })

  it('AUTH-LOGIN-013 role comes from membership', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const userId = await seedUser('cashier@test.com', hash)
    await seedMembership(userId, BUSINESS_A, 'CASHIER') // Not owner

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'cashier@test.com', password, role: 'OWNER' }) // trying to escalate

    expect(res.status).toBe(200)
    expect(res.body.role).toBe('CASHIER')
  })

  it('AUTH-LOGIN-014 business_id comes from membership', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const userId = await seedUser('multi2@test.com', hash)
    await seedMembership(userId, BUSINESS_A)
    await seedMembership(userId, BUSINESS_B)

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'multi2@test.com', password, business_id: BUSINESS_A })

    expect(res.status).toBe(200)
    expect(res.body.business.id).toBe(BUSINESS_A)
  })
})
