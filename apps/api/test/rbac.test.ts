import path from 'path'
import { randomUUID } from 'crypto'
import type { Express } from 'express'
import { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { seedTestUser, authenticateTestUser } from './auth_helper'

const BUSINESS_A = '11111111-1111-4111-8111-111111111111'
const BUSINESS_B = '22222222-2222-4222-8222-222222222222'
const BRANCH_A = '11111111-1111-4111-8111-111111111112'

let pool!: Pool
let app!: Express
let ownerToken!: string
let cashierToken!: string
let ownerBToken!: string
let suspendedUserToken!: string
let revokedUserToken!: string
let cashierRefreshToken!: string

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      stock_movements,
      stocks,
      branches,
      sale_items,
      sales,
      idempotency_keys,
      products,
      refresh_tokens,
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

  await pool.query(
    `
      INSERT INTO branches (id, business_id, name)
      VALUES ($1, $2, 'Main Branch A')
      ON CONFLICT (id) DO NOTHING
    `,
    [BRANCH_A, BUSINESS_A]
  )
}

beforeAll(async () => {
  pool = createPool(process.env.DATABASE_URL || 'postgres://bizerp:bizerp@localhost:54320/bizerp')
  await runMigrations(pool, path.join(__dirname, '../migrations'))
  app = createApp(pool)
})

afterAll(async () => {
  if (pool) {
    await pool.end()
  }
})

beforeEach(async () => {
  await resetDatabase()

  // Seed OWNER for Business A
  const owner = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  const ownerAuth = await authenticateTestUser(app, owner.email, owner.password, BUSINESS_A)
  ownerToken = ownerAuth.accessToken

  // Seed CASHIER for Business A
  const cashier = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  const cashierAuth = await authenticateTestUser(app, cashier.email, cashier.password, BUSINESS_A)
  cashierToken = cashierAuth.accessToken
  cashierRefreshToken = cashierAuth.refreshToken

  // Seed OWNER for Business B
  const ownerB = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER' })
  const ownerBAuth = await authenticateTestUser(app, ownerB.email, ownerB.password, BUSINESS_B)
  ownerBToken = ownerBAuth.accessToken

  // Seed Suspended User
  const suspended = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  const suspendedAuth = await authenticateTestUser(app, suspended.email, suspended.password, BUSINESS_A)
  suspendedUserToken = suspendedAuth.accessToken
  await pool.query('UPDATE users SET status = $1 WHERE email = $2', ['SUSPENDED', suspended.email])

  // Seed Revoked Membership User
  const revoked = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  const revokedAuth = await authenticateTestUser(app, revoked.email, revoked.password, BUSINESS_A)
  revokedUserToken = revokedAuth.accessToken
  await pool.query('UPDATE user_businesses SET status = $1 WHERE user_id = (SELECT id FROM users WHERE email = $2)', ['REVOKED', revoked.email])
})

describe('Phase 4.0.13 RBAC Implementation', () => {
  
  it('RBAC-001 OWNER product create allowed', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Test Product',
        price_minor: 1000,
        is_active: true,
        server_version: 0
      })
      .expect(201)

    expect(res.body.id).toBeDefined()
  })

  it('RBAC-002 OWNER product update allowed', async () => {
    const prodId = randomUUID()
    await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ business_id: BUSINESS_A, id: prodId, name: 'Test Product', price_minor: 1000, is_active: true, server_version: 0 })
      .expect(201)

    const res = await request(app)
      .put(`/v1/sync/products/${prodId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ business_id: BUSINESS_A, id: prodId, name: 'Test Product Updated', price_minor: 1500, is_active: true, expected_server_version: 1 })
      .expect(200)

    expect(res.body.id).toBeDefined()
  })

  it('RBAC-003 OWNER product lifecycle allowed', async () => {
    const prodId = randomUUID()
    await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ business_id: BUSINESS_A, id: prodId, name: 'Test Product', price_minor: 1000, is_active: true, server_version: 0 })
      .expect(201)

    const res = await request(app)
      .put(`/v1/sync/products/${prodId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ business_id: BUSINESS_A, id: prodId, name: 'Test Product', price_minor: 1000, is_active: false, expected_server_version: 1 })
      .expect(200)

    expect(res.body.id).toBeDefined()
  })

  it('RBAC-004 OWNER sales pull allowed', async () => {
    const res = await request(app)
      .get(`/v1/sync/sales?business_id=${BUSINESS_A}&since=0&limit=100`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200)

    expect(Array.isArray(res.body.sales)).toBe(true)
  })

  it('RBAC-005 CASHIER product pull allowed', async () => {
    const res = await request(app)
      .get(`/v1/sync/products?business_id=${BUSINESS_A}&since_version=0`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(200)

    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it('RBAC-006 CASHIER sales batch allowed', async () => {
    const res = await request(app)
      .post('/v1/sync/sales/batch')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        business_id: BUSINESS_A,
        items: [
          {
            idempotency_key: randomUUID(),
            request_hash: randomUUID(),
            sale: {
              id: randomUUID(),
              receipt_number: `INV-${randomUUID()}`,
              subtotal_minor: 10000,
              discount_minor: 0,
              tax_minor: 0,
              total_minor: 10000,
              payment_method: 'cash',
              paid_minor: 10000,
              change_minor: 0,
              cashier_id: 'cashier-1',
              branch_id: BRANCH_A,
              created_at: new Date().toISOString(),
              client_created_at: new Date().toISOString()
            },
            sale_items: [
              {
                product_id: null,
                product_name: 'Test Product',
                quantity: 1,
                unit_price_minor: 10000,
                subtotal_minor: 10000
              }
            ]
          }
        ]
      })
      .expect(200)

    expect(Array.isArray(res.body.results)).toBe(true)
  })

  it('RBAC-007 CASHIER product create -> 403 INSUFFICIENT_PERMISSIONS', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${cashierToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Test Product',
        price_minor: 1000,
        is_active: true,
        server_version: 0
      })
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })

  it('RBAC-008 CASHIER product update -> 403 INSUFFICIENT_PERMISSIONS', async () => {
    const res = await request(app)
      .put(`/v1/sync/products/${randomUUID()}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ business_id: BUSINESS_A, id: randomUUID(), name: 'Test Product', price_minor: 1000, is_active: true, expected_server_version: 1 })
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })

  it('RBAC-009 CASHIER product lifecycle -> 403 INSUFFICIENT_PERMISSIONS', async () => {
    const res = await request(app)
      .put(`/v1/sync/products/${randomUUID()}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ business_id: BUSINESS_A, id: randomUUID(), name: 'Test Product', price_minor: 1000, is_active: false, expected_server_version: 1 })
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })

  it('RBAC-010 CASHIER sales pull -> 403 INSUFFICIENT_PERMISSIONS', async () => {
    const res = await request(app)
      .get(`/v1/sync/sales?business_id=${BUSINESS_A}&since=0&limit=100`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })

  it('RBAC-011 body role cannot elevate permissions', async () => {
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${cashierToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Test Product',
        price_minor: 1000,
        is_active: true,
        server_version: 0,
        role: 'OWNER' // Trying to elevate
      })
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })

  it('RBAC-012 cross-tenant request rejected', async () => {
    // OWNER of B tries to access A
    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Test Product',
        price_minor: 1000,
        is_active: true,
        server_version: 0
      })
      .expect(403)

    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  it('RBAC-013 suspended user rejected according to existing auth contract', async () => {
    const suspended = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
    const suspendedAuth = await authenticateTestUser(app, suspended.email, suspended.password, BUSINESS_A)
    await pool.query('UPDATE users SET status = $1 WHERE email = $2', ['SUSPENDED', suspended.email])
    
    // Attempt refresh
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: suspendedAuth.refreshToken })
      .expect(403)
  })

  it('RBAC-014 revoked membership denied after refresh', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: cashierRefreshToken })
      .expect(200)
      
    expect(res.body.access_token).toBeDefined()
    
    await pool.query('UPDATE user_businesses SET status = $1 WHERE role = $2', ['REVOKED', 'CASHIER'])

    const res2 = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: res.body.refresh_token })
      .expect(403)
      
    expect(res2.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  it('RBAC-015 JWT role tampering rejected', async () => {
    const [header, payload, signature] = cashierToken.split('.')
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    decodedPayload.role = 'OWNER'
    const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url')
    const tamperedToken = `${header}.${tamperedPayload}.${signature}`

    const res = await request(app)
      .post('/v1/sync/products')
      .set('Authorization', `Bearer ${tamperedToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        business_id: BUSINESS_A,
        id: randomUUID(),
        name: 'Test Product',
        price_minor: 1000,
        is_active: true,
        server_version: 0
      })
      .expect(401) 

    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })
})
