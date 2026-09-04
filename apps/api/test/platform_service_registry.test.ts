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

const BUSINESS_A = randomUUID()

const JWT_SECRET = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
const JWT_ISSUER = process.env.JWT_ISSUER || 'biz-erp-api'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'biz-erp-client'

describe('Phase SA-2.5 Platform Service Registry API', () => {
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
    await pool.query('DELETE FROM service_dependencies')
    await pool.query('DELETE FROM plan_modules')
    await pool.query('DELETE FROM platform_payments')
    await pool.query('DELETE FROM platform_invoices')
    await pool.query('DELETE FROM subscriptions')
    await pool.query('DELETE FROM plans')
    await pool.query('DELETE FROM services')
    await pool.query('DELETE FROM user_businesses')
    await pool.query('DELETE FROM users')
    await pool.query('DELETE FROM businesses')
    await pool.query(
      `INSERT INTO businesses (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [BUSINESS_A, 'Business A']
    )
  })

  async function seedPlatformUser(role: 'PLATFORM_ADMIN' | 'SUPER_ADMIN', email: string): Promise<string> {
    const id = randomUUID()
    const hash = await hashPassword('password123')
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status, platform_role) VALUES ($1, $2, $3, $4, $5)',
      [id, email, hash, 'ACTIVE', role]
    )
    return id
  }

  async function platformLogin(email: string): Promise<string> {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email, password: 'password123' })
    expect(res.status).toBe(200)
    return res.body.access_token
  }

  async function tenantLogin(): Promise<string> {
    const id = randomUUID()
    const hash = await hashPassword('password123')
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)',
      [id, 'tenant@example.com', hash, 'ACTIVE']
    )
    await pool.query(
      'INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, $3, $4)',
      [id, BUSINESS_A, 'OWNER', 'ACTIVE']
    )
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'tenant@example.com', password: 'password123' })
    expect(res.status).toBe(200)
    return res.body.access_token
  }

  it('rejects tenant tokens with 403 WRONG_SCOPE', async () => {
    const tenantToken = await tenantLogin()
    const res = await request(app)
      .get('/v1/platform/services')
      .set('Authorization', `Bearer ${tenantToken}`)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('WRONG_SCOPE')
  })

  it('CRUD service lifecycle by SUPER_ADMIN', async () => {
    await seedPlatformUser('SUPER_ADMIN', 'super@platform.com')
    const token = await platformLogin('super@platform.com')

    // 1. Create a service
    const createRes = await request(app)
      .post('/v1/platform/services')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: 'ERP',
        name: 'Enterprise Resource Planning',
        category: 'SOFTWARE',
        service_type: 'INTERNAL'
      })
    expect(createRes.status).toBe(201)
    expect(createRes.body.service.code).toBe('ERP')
    expect(createRes.body.service.lifecycle_status).toBe('DRAFT')

    // 2. Prevent duplicate service code
    const dupRes = await request(app)
      .post('/v1/platform/services')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: 'ERP',
        name: 'Another ERP',
        category: 'SOFTWARE'
      })
    expect(dupRes.status).toBe(409)

    // 3. Update service
    const updateRes = await request(app)
      .patch('/v1/platform/services/ERP')
      .set('Authorization', `Bearer ${token}`)
      .send({
        lifecycle_status: 'ACTIVE',
        public_visibility: true
      })
    expect(updateRes.status).toBe(200)
    expect(updateRes.body.service.lifecycle_status).toBe('ACTIVE')
    expect(updateRes.body.service.public_visibility).toBe(true)

    // 4. Get list of services
    const listRes = await request(app)
      .get('/v1/platform/services')
      .set('Authorization', `Bearer ${token}`)
    expect(listRes.status).toBe(200)
    expect(listRes.body.items).toHaveLength(1)
    expect(listRes.body.items[0].code).toBe('ERP')
  })

  it('handles service dependencies correctly and prevents circular/self', async () => {
    await seedPlatformUser('PLATFORM_ADMIN', 'admin@platform.com')
    const token = await platformLogin('admin@platform.com')

    // Create 3 services
    await request(app).post('/v1/platform/services').set('Authorization', `Bearer ${token}`)
      .send({ code: 'DEVICE_SERVICE', name: 'Device', category: 'INFRA' })
    await request(app).post('/v1/platform/services').set('Authorization', `Bearer ${token}`)
      .send({ code: 'CCTV', name: 'CCTV', category: 'IOT' })
    await request(app).post('/v1/platform/services').set('Authorization', `Bearer ${token}`)
      .send({ code: 'NOTIFICATION', name: 'Notif', category: 'INFRA' })

    // Valid dependency
    const updateCCTV = await request(app)
      .patch('/v1/platform/services/CCTV')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dependencies: [
          { depends_on: 'DEVICE_SERVICE', type: 'REQUIRED' }
        ]
      })
    expect(updateCCTV.status).toBe(200)

    const cctvGet = await request(app)
      .get('/v1/platform/services/CCTV')
      .set('Authorization', `Bearer ${token}`)
    expect(cctvGet.body.dependencies).toHaveLength(1)
    expect(cctvGet.body.dependencies[0].depends_on_service_code).toBe('DEVICE_SERVICE')

    // Self dependency
    const selfDep = await request(app)
      .patch('/v1/platform/services/DEVICE_SERVICE')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dependencies: [
          { depends_on: 'DEVICE_SERVICE' }
        ]
      })
    expect(selfDep.status).toBe(400)
    expect(selfDep.body.error.message).toMatch(/Self dependency is not allowed/i)

    // Circular dependency (CCTV -> DEVICE_SERVICE, now try DEVICE_SERVICE -> CCTV)
    const circDep = await request(app)
      .patch('/v1/platform/services/DEVICE_SERVICE')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dependencies: [
          { depends_on: 'CCTV' }
        ]
      })
    expect(circDep.status).toBe(400)
    expect(circDep.body.error.message).toMatch(/Circular dependency/i)
  })

  it('validates required fields and enum values', async () => {
    await seedPlatformUser('PLATFORM_ADMIN', 'admin2@platform.com')
    const token = await platformLogin('admin2@platform.com')

    const res1 = await request(app)
      .post('/v1/platform/services')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: 'TEST',
        name: 'Test',
        category: 'CAT',
        service_type: 'INVALID_TYPE'
      })
    expect(res1.status).toBe(400)
    expect(res1.body.error.message).toMatch(/Invalid service_type/i)

    const res2 = await request(app)
      .post('/v1/platform/services')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: 'T', // too short
        name: 'Test',
        category: 'CAT'
      })
    expect(res2.status).toBe(400)
    expect(res2.body.error.message).toMatch(/code must be 3-50/i)
  })
})
