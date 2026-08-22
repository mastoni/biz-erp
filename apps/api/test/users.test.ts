import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'
import { hashPassword } from '../src/services/password_service'

describe('Phase 4.1.38 User Management API', () => {
  let pool: Pool
  let app: Express
  let ownerTokenA: string
  let ownerTokenB: string
  let cashierTokenA: string

  const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    }

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
        users,
        businesses
      RESTART IDENTITY CASCADE
    `)

    await pool.query(
      `INSERT INTO businesses (id, name) VALUES ($1, $2), ($3, $4) ON CONFLICT (id) DO NOTHING`,
      [BUSINESS_A, 'Business A', BUSINESS_B, 'Business B']
    )

    const password = 'SecurePass123!'
    const hash = await hashPassword(password)

    const ownerAId = randomUUID()
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)',
      [ownerAId, 'ownera@test.com', hash, 'ACTIVE']
    )
    await pool.query(
      'INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, $3, $4)',
      [ownerAId, BUSINESS_A, 'OWNER', 'ACTIVE']
    )

    const ownerBId = randomUUID()
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)',
      [ownerBId, 'ownerb@test.com', hash, 'ACTIVE']
    )
    await pool.query(
      'INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, $3, $4)',
      [ownerBId, BUSINESS_B, 'OWNER', 'ACTIVE']
    )

    const cashierAId = randomUUID()
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)',
      [cashierAId, 'cashiera@test.com', hash, 'ACTIVE']
    )
    await pool.query(
      'INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, $3, $4)',
      [cashierAId, BUSINESS_A, 'CASHIER', 'ACTIVE']
    )

    const anotherOwnerId = randomUUID()
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)',
      [anotherOwnerId, 'anotherowner@test.com', hash, 'ACTIVE']
    )
    await pool.query(
      'INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, $3, $4)',
      [anotherOwnerId, BUSINESS_A, 'OWNER', 'ACTIVE']
    )

    const login = (email: string, password: string) =>
      request(app).post('/v1/auth/login').send({ email, password })

    const ownerARes = await login('ownera@test.com', password)
    ownerTokenA = ownerARes.body.access_token

    const ownerBRes = await login('ownerb@test.com', password)
    ownerTokenB = ownerBRes.body.access_token

    const cashierARes = await login('cashiera@test.com', password)
    cashierTokenA = cashierARes.body.access_token
  })

  it('USER-001 OWNER can list users in business', async () => {
    const res = await request(app)
      .get('/v1/users')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.total).toBeGreaterThanOrEqual(2)
    const emails = res.body.items.map((u: any) => u.email)
    expect(emails).toContain('ownera@test.com')
    expect(emails).toContain('cashiera@test.com')
  })

  it('USER-002 OWNER can create CASHIER', async () => {
    const res = await request(app)
      .post('/v1/users')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        email: 'newcashier@test.com',
        password: 'SecurePass123!',
        role: 'CASHIER'
      })
      .expect(201)

    expect(res.body.email).toBe('newcashier@test.com')
    expect(res.body.role).toBe('CASHIER')
    expect(res.body.status).toBe('ACTIVE')
  })

  it('USER-003 OWNER can create OWNER', async () => {
    const res = await request(app)
      .post('/v1/users')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        email: 'newowner@test.com',
        password: 'SecurePass123!',
        role: 'OWNER'
      })
      .expect(201)

    expect(res.body.role).toBe('OWNER')
  })

  it('USER-004 OWNER can revoke CASHIER', async () => {
    const listRes = await request(app)
      .get('/v1/users')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    const cashier = listRes.body.items.find((u: any) => u.email === 'cashiera@test.com')

    await request(app)
      .patch(`/v1/users/${cashier.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ status: 'REVOKED' })
      .expect(200)

    const after = await request(app)
      .get('/v1/users')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    const updated = after.body.items.find((u: any) => u.id === cashier.id)
    expect(updated).toBeUndefined()
  })

  it('USER-005 OWNER can revoke another OWNER', async () => {
    const listRes = await request(app)
      .get('/v1/users')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    const anotherOwner = listRes.body.items.find((u: any) => u.email === 'anotherowner@test.com')

    await request(app)
      .patch(`/v1/users/${anotherOwner.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ status: 'REVOKED' })
      .expect(200)
  })

  it('USER-006 OWNER cannot revoke themselves', async () => {
    const listRes = await request(app)
      .get('/v1/users')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    const self = listRes.body.items.find((u: any) => u.email === 'ownera@test.com')

    const res = await request(app)
      .patch(`/v1/users/${self.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ status: 'REVOKED' })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('USER-007 CASHIER cannot access /v1/users', async () => {
    await request(app)
      .get('/v1/users')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .expect(403)
  })

  it('USER-008 CASHIER cannot create user', async () => {
    await request(app)
      .post('/v1/users')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({
        email: 'hacker@test.com',
        password: 'SecurePass123!',
        role: 'CASHIER'
      })
      .expect(403)
  })

  it('USER-009 cross-business user listing returns own business only', async () => {
    const res = await request(app)
      .get('/v1/users')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    const emails = res.body.items.map((u: any) => u.email)
    expect(emails).toContain('ownera@test.com')
    expect(emails).not.toContain('ownerb@test.com')
  })

  it('USER-010 creating user with duplicate email returns error', async () => {
    await request(app)
      .post('/v1/users')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        email: 'ownera@test.com',
        password: 'SecurePass123!',
        role: 'CASHIER'
      })
      .expect(400)
  })
})
