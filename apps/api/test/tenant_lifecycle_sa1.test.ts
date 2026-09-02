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

describe('Phase SA-1: Tenant Lifecycle & Registration Approval Gate', { timeout: 30000 }, () => {
  let pool: Pool
  let app: Express

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    app = createApp(pool)
  }, 30000)

  afterAll(async () => {
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        user_businesses,
        refresh_tokens,
        subscriptions,
        products,
        branches,
        businesses,
        users
      RESTART IDENTITY CASCADE
    `)

    await pool.query(`
      INSERT INTO services (code, name, category, service_type, owner, lifecycle_status, public_visibility)
      VALUES
        ('ERP', 'Enterprise Resource Planning', 'OPERATIONS', 'INTERNAL', 'PLATFORM', 'ACTIVE', FALSE),
        ('ISP_MANAGEMENT', 'ISP Management System', 'OPERATIONS', 'INTERNAL', 'PLATFORM', 'ACTIVE', FALSE),
        ('CCTV_MANAGEMENT', 'CCTV Management', 'PROTECTION', 'HYBRID', 'PLATFORM', 'ACTIVE', FALSE),
        ('WA_GATEWAY', 'WhatsApp Gateway', 'COMMUNICATIONS', 'HYBRID', 'PLATFORM', 'DRAFT', FALSE),
        ('AUTOPOST', 'AI AutoPost', 'MARKETING', 'EXTERNAL', 'PLATFORM', 'DRAFT', FALSE)
      ON CONFLICT (code) DO NOTHING
    `)

    await pool.query(`
      INSERT INTO plans (code, name, family, tier, billing_cycle, pricing, type, status, service_code)
      VALUES ('test_sa1_erp_plan', 'ERP Plan', 'ERP_PLAN', 'PRO', 'MONTHLY', '{"base_price":100}', 'STANDALONE', 'ACTIVE', 'ERP')
      ON CONFLICT (code) DO UPDATE SET service_code = 'ERP'
    `)
  }, 30000)

  async function seedPlatformAdmin(email = 'superadmin@skmnetwork.com'): Promise<string> {
    const id = randomUUID()
    const hash = await hashPassword('password123')
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status, platform_role) VALUES ($1, $2, $3, $4, $5)',
      [id, email, hash, 'ACTIVE', 'SUPER_ADMIN']
    )
    const res = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email, password: 'password123' })
    expect(res.status).toBe(200)
    return res.body.access_token
  }

  it('1. Registration creates business in PENDING_REVIEW status', async () => {
    const regRes = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'owner1@example.com',
        password: 'password123',
        business_name: 'Warung Kopi Maju'
      })

    expect(regRes.status).toBe(201)
    expect(regRes.body.business_id).toBeDefined()
    expect(regRes.body.user_id).toBeDefined()

    const bizInDb = await pool.query('SELECT * FROM businesses WHERE id = $1', [regRes.body.business_id])
    expect(bizInDb.rows.length).toBe(1)
    expect(bizInDb.rows[0].status).toBe('PENDING_REVIEW')
    expect(bizInDb.rows[0].owner_user_id).toBe(regRes.body.user_id)
  })

  it('2. Tenant in PENDING_REVIEW can login but operational ERP endpoints are blocked', async () => {
    const regRes = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'owner2@example.com',
        password: 'password123',
        business_name: 'Toko Elektronik Pending'
      })

    const businessId = regRes.body.business_id

    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'owner2@example.com',
        password: 'password123'
      })

    expect(loginRes.status).toBe(200)
    expect(loginRes.body.business.status).toBe('PENDING_REVIEW')
    const tenantToken = loginRes.body.access_token

    // Attempting to access products endpoint
    const prodRes = await request(app)
      .get(`/v1/products?business_id=${businessId}`)
      .set('Authorization', `Bearer ${tenantToken}`)

    expect(prodRes.status).toBe(403)
    expect(prodRes.body.error.code).toBe('BUSINESS_PENDING_APPROVAL')
  })

  it('3. Superadmin approves PENDING_REVIEW tenant -> transitions to ACTIVE and unblocks ERP', async () => {
    const adminToken = await seedPlatformAdmin()

    const regRes = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'owner3@example.com',
        password: 'password123',
        business_name: 'Resto Sukses Bersama'
      })

    const businessId = regRes.body.business_id

    // Approve tenant via Superadmin API
    const approveRes = await request(app)
      .post(`/v1/platform/businesses/${businessId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(approveRes.status).toBe(200)
    expect(approveRes.body.business.status).toBe('ACTIVE')
    expect(approveRes.body.business.approved_at).toBeDefined()

    // Tenant login
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'owner3@example.com',
        password: 'password123'
      })

    const tenantToken = loginRes.body.access_token

    await pool.query(`
      INSERT INTO subscriptions (business_id, plan_code, family_code, source, status, unit_price, discount, tax, final_price, currency, billing_cycle)
      VALUES ($1, 'test_sa1_erp_plan', 'ERP_PLAN', 'DIRECT', 'ACTIVE', 100000, 0, 0, 100000, 'IDR', 'MONTHLY')
    `, [businessId])

    // Operational request now succeeds
    const prodRes = await request(app)
      .get(`/v1/products?business_id=${businessId}`)
      .set('Authorization', `Bearer ${tenantToken}`)

    expect(prodRes.status).toBe(200)

    // Cannot approve already active business
    const secondApprove = await request(app)
      .post(`/v1/platform/businesses/${businessId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(secondApprove.status).toBe(400)
    expect(secondApprove.body.error.code).toBe('INVALID_STATE_TRANSITION')
  })

  it('4. Superadmin rejects PENDING_REVIEW tenant with reason', async () => {
    const adminToken = await seedPlatformAdmin()

    const regRes = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'badactor@example.com',
        password: 'password123',
        business_name: 'Usaha Bodong'
      })

    const businessId = regRes.body.business_id

    // Reject without reason fails
    const failReject = await request(app)
      .post(`/v1/platform/businesses/${businessId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})

    expect(failReject.status).toBe(400)

    // Reject with reason succeeds
    const rejectRes = await request(app)
      .post(`/v1/platform/businesses/${businessId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Identitas usaha tidak valid' })

    expect(rejectRes.status).toBe(200)
    expect(rejectRes.body.business.status).toBe('REJECTED')
    expect(rejectRes.body.business.rejected_reason).toBe('Identitas usaha tidak valid')

    // Tenant login shows REJECTED status and ERP is blocked
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'badactor@example.com',
        password: 'password123'
      })

    expect(loginRes.status).toBe(200)
    expect(loginRes.body.business.status).toBe('REJECTED')

    const prodRes = await request(app)
      .get(`/v1/products?business_id=${businessId}`)
      .set('Authorization', `Bearer ${loginRes.body.access_token}`)

    expect(prodRes.status).toBe(403)
    expect(prodRes.body.error.code).toBe('BUSINESS_REJECTED')
  })

  it('5. Superadmin suspends ACTIVE tenant -> blocks ERP; reactivates -> unblocks ERP', async () => {
    const adminToken = await seedPlatformAdmin()

    const regRes = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'owner5@example.com',
        password: 'password123',
        business_name: 'Cafe Nusantara'
      })

    const businessId = regRes.body.business_id

    // Approve first
    await request(app)
      .post(`/v1/platform/businesses/${businessId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)

    // Suspend with reason
    const suspRes = await request(app)
      .post(`/v1/platform/businesses/${businessId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Tunggakan pembayaran lebih dari 30 hari' })

    expect(suspRes.status).toBe(200)
    expect(suspRes.body.business.status).toBe('SUSPENDED')

    // Tenant login
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'owner5@example.com',
        password: 'password123'
      })

    const tenantToken = loginRes.body.access_token

    await pool.query(`
      INSERT INTO subscriptions (business_id, plan_code, family_code, source, status, unit_price, discount, tax, final_price, currency, billing_cycle)
      VALUES ($1, 'test_sa1_erp_plan', 'ERP_PLAN', 'DIRECT', 'ACTIVE', 100000, 0, 0, 100000, 'IDR', 'MONTHLY')
    `, [businessId])

    // ERP is blocked with BUSINESS_SUSPENDED
    const prodRes = await request(app)
      .get(`/v1/products?business_id=${businessId}`)
      .set('Authorization', `Bearer ${tenantToken}`)

    expect(prodRes.status).toBe(403)
    expect(prodRes.body.error.code).toBe('BUSINESS_SUSPENDED')

    // Reactivate tenant
    const reactRes = await request(app)
      .post(`/v1/platform/businesses/${businessId}/reactivate`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(reactRes.status).toBe(200)
    expect(reactRes.body.business.status).toBe('ACTIVE')

    // ERP is unblocked
    const prodRes2 = await request(app)
      .get(`/v1/products?business_id=${businessId}`)
      .set('Authorization', `Bearer ${tenantToken}`)

    expect(prodRes2.status).toBe(200)
  })

  it('6. Tenant token is rejected on Platform routes (WRONG_SCOPE)', async () => {
    const regRes = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'owner6@example.com',
        password: 'password123',
        business_name: 'Toko Test RBAC'
      })

    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'owner6@example.com',
        password: 'password123'
      })

    const tenantToken = loginRes.body.access_token

    const platRes = await request(app)
      .get('/v1/platform/businesses')
      .set('Authorization', `Bearer ${tenantToken}`)

    expect(platRes.status).toBe(403)
    expect(platRes.body.error.code).toBe('WRONG_SCOPE')
  })

  it('7. GET /v1/platform/businesses supports status filtering, search, and summary counts', async () => {
    const adminToken = await seedPlatformAdmin()

    // Register 2 businesses
    await request(app).post('/v1/auth/register').send({
      email: 'a@example.com',
      password: 'password123',
      business_name: 'Alfa Mart'
    })
    const regB = await request(app).post('/v1/auth/register').send({
      email: 'b@example.com',
      password: 'password123',
      business_name: 'Beta Store'
    })

    // Approve 1
    await request(app)
      .post(`/v1/platform/businesses/${regB.body.business_id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)

    const listRes = await request(app)
      .get('/v1/platform/businesses')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(listRes.status).toBe(200)
    expect(listRes.body.items.length).toBe(2)
    expect(listRes.body.summary).toBeDefined()
    expect(listRes.body.summary.pending_count).toBe(1)
    expect(listRes.body.summary.active_count).toBe(1)
    expect(listRes.body.summary.total).toBe(2)

    // Filter by PENDING_REVIEW
    const pendingRes = await request(app)
      .get('/v1/platform/businesses?status=PENDING_REVIEW')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(pendingRes.status).toBe(200)
    expect(pendingRes.body.items.length).toBe(1)
    expect(pendingRes.body.items[0].name).toBe('Alfa Mart')

    // Search by name
    const searchRes = await request(app)
      .get('/v1/platform/businesses?search=Beta')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(searchRes.status).toBe(200)
    expect(searchRes.body.items.length).toBe(1)
    expect(searchRes.body.items[0].name).toBe('Beta Store')
  })

  it('8. GET /v1/platform/businesses/:id returns detailed statistics', async () => {
    const adminToken = await seedPlatformAdmin()

    const regRes = await request(app).post('/v1/auth/register').send({
      email: 'details@example.com',
      password: 'password123',
      business_name: 'Detail Shop'
    })

    const detailRes = await request(app)
      .get(`/v1/platform/businesses/${regRes.body.business_id}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(detailRes.status).toBe(200)
    expect(detailRes.body.name).toBe('Detail Shop')
    expect(detailRes.body.status).toBe('PENDING_REVIEW')
    expect(detailRes.body.owner_email).toBe('details@example.com')
    expect(detailRes.body.branch_count).toBe(0)
  })
})
