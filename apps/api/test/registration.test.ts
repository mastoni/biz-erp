import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'

describe('Phase 4.1.38 Registration API', () => {
  let pool: Pool
  let app: Express

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
  })

  it('REG-001 successful registration creates user + business + membership', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        business_name: 'Toko Baru'
      })

    expect(res.status).toBe(201)
    expect(res.body.user_id).toBeDefined()
    expect(res.body.business_id).toBeDefined()
    expect(res.body.message).toBe('Registration successful. Please log in.')

    const user = await pool.query('SELECT * FROM users WHERE email = $1', ['newuser@example.com'])
    expect(user.rows.length).toBe(1)
    expect(user.rows[0].email).toBe('newuser@example.com')
    expect(user.rows[0].status).toBe('ACTIVE')

    const business = await pool.query('SELECT * FROM businesses WHERE id = $1', [res.body.business_id])
    expect(business.rows.length).toBe(1)
    expect(business.rows[0].name).toBe('Toko Baru')

    const membership = await pool.query(
      'SELECT * FROM user_businesses WHERE user_id = $1 AND business_id = $2',
      [res.body.user_id, res.body.business_id]
    )
    expect(membership.rows.length).toBe(1)
    expect(membership.rows[0].role).toBe('OWNER')
    expect(membership.rows[0].status).toBe('ACTIVE')
  })

  it('REG-002 duplicate email rejected', async () => {
    const email = 'duplicate@example.com'
    const password = 'SecurePass123!'

    await request(app)
      .post('/v1/auth/register')
      .send({ email, password, business_name: 'Business A' })
      .expect(201)

    const res = await request(app)
      .post('/v1/auth/register')
      .send({ email, password, business_name: 'Business B' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.email).toBe('Email is already registered')
  })

  it('REG-003 invalid email format rejected', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'not-an-email',
        password: 'SecurePass123!',
        business_name: 'Business'
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('REG-004 weak password rejected', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'user@example.com',
        password: 'short',
        business_name: 'Business'
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.password).toBe('Password must be at least 8 characters')
  })

  it('REG-005 empty business_name rejected', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'user@example.com',
        password: 'SecurePass123!',
        business_name: '   '
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.business_name).toBe('Business name is required')
  })

  it('REG-006 registered user can log in immediately', async () => {
    const email = 'login-test@example.com'
    const password = 'SecurePass123!'

    await request(app)
      .post('/v1/auth/register')
      .send({ email, password, business_name: 'Login Test Business' })
      .expect(201)

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email, password })

    expect(res.status).toBe(200)
    expect(res.body.access_token).toBeDefined()
    expect(res.body.business.id).toBeDefined()
    expect(res.body.role).toBe('OWNER')
  })

  it('REG-007 login returns correct business_id and OWNER role', async () => {
    const email = 'role-test@example.com'
    const password = 'SecurePass123!'
    const businessName = 'Role Test Business'

    const regRes = await request(app)
      .post('/v1/auth/register')
      .send({ email, password, business_name: businessName })
      .expect(201)

    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({ email, password })

    expect(loginRes.status).toBe(200)
    expect(loginRes.body.business.id).toBe(regRes.body.business_id)
    expect(loginRes.body.role).toBe('OWNER')
  })

  it('REG-008 rate limiter blocks excessive attempts', async () => {
    const email = 'ratelimit@example.com'
    const password = 'SecurePass123!'

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/v1/auth/register')
        .send({ email: `${i}-${email}`, password, business_name: 'Rate Limit Test' })
        .expect(201)
    }

    const res = await request(app)
      .post('/v1/auth/register')
      .send({ email: 'blocked@example.com', password, business_name: 'Blocked Business' })

    expect(res.status).toBe(429)
    expect(res.body.error).toBe('TOO_MANY_REQUESTS')
  })
})
