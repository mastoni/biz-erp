import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'
import { Express } from 'express'
import { createJwtService } from '../src/services/jwt_service'
import { hashPassword } from '../src/services/password_service'

describe('Phase: Platform Billing Lifecycle Completion API', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>

  const SUPER_ADMIN_ID = randomUUID()
  const TENANT_USER_ID = randomUUID()
  const BUSINESS_ID = randomUUID()
  let subscriptionId: string

  const JWT_SECRET = 'insecure-test-secret-that-is-at-least-32-chars-long'
  const JWT_ISSUER = 'biz-erp-api'
  const JWT_AUDIENCE = 'biz-erp-client'

  let superToken: string
  let tenantToken: string

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET
    process.env.JWT_ISSUER = JWT_ISSUER
    process.env.JWT_AUDIENCE = JWT_AUDIENCE

    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    app = createApp(pool)

    jwtService = createJwtService(JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE)

    // Seed Superadmin user
    const hashed = await hashPassword('password123')
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status, platform_role) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (id) DO UPDATE SET platform_role = 'SUPER_ADMIN'`,
      [SUPER_ADMIN_ID, 'superadmin@billing.com', hashed, 'ACTIVE', 'SUPER_ADMIN']
    )

    // Seed Tenant user & business
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_USER_ID, 'tenant@billing.com', hashed, 'ACTIVE']
    )
    await pool.query(
      `INSERT INTO businesses (id, name, status) 
       VALUES ($1, 'Tenant Billing Toko', 'ACTIVE') 
       ON CONFLICT (id) DO NOTHING`,
      [BUSINESS_ID]
    )
    await pool.query(
      `INSERT INTO user_businesses (user_id, business_id, role, status) 
       VALUES ($1, $2, 'OWNER', 'ACTIVE') 
       ON CONFLICT (user_id, business_id) DO NOTHING`,
      [TENANT_USER_ID, BUSINESS_ID]
    )

    // Seed Plan & Subscription Family
    await pool.query(
      `INSERT INTO subscription_families (code, name, replacement_policy)
       VALUES ('ERP_PLAN', 'ERP Plan', 'REPLACEABLE')
       ON CONFLICT (code) DO NOTHING`
    )

    await pool.query(
      `INSERT INTO plans (code, name, family, tier, billing_cycle, type, pricing, limits, status, is_published, version)
       VALUES ('ERP_PRO_MONTHLY', 'ERP Pro Monthly', 'ERP_PLAN', 'STANDARD', 'MONTHLY', 'STANDALONE',
               '{"base_price": 500000, "final_price": 500000, "discount": 0, "tax": 0, "currency": "IDR"}',
               '{"max_branches": 5, "max_users": 10}', 'ACTIVE', TRUE, 1)
       ON CONFLICT (code) DO NOTHING`
    )

    superToken = jwtService.signAccessToken({
      sub: SUPER_ADMIN_ID,
      scope: 'platform',
      role: 'SUPER_ADMIN',
      session_id: randomUUID(),
      jti: randomUUID(),
    })

    tenantToken = jwtService.signAccessToken({
      sub: TENANT_USER_ID,
      business_id: BUSINESS_ID,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID(),
    })
  })

  afterAll(async () => {
    await pool.query('DELETE FROM platform_payments')
    await pool.query('DELETE FROM platform_invoices')
    await pool.query('DELETE FROM subscriptions WHERE business_id = $1', [BUSINESS_ID])
    await pool.query('DELETE FROM user_businesses WHERE user_id = $1', [TENANT_USER_ID])
    await pool.query('DELETE FROM businesses WHERE id = $1', [BUSINESS_ID])
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [SUPER_ADMIN_ID, TENANT_USER_ID])
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM platform_payments')
    await pool.query('DELETE FROM platform_invoices')
    await pool.query('DELETE FROM subscriptions WHERE business_id = $1', [BUSINESS_ID])

    // Create a fresh test subscription
    const subRes = await pool.query(
      `INSERT INTO subscriptions (
         business_id, plan_code, family_code, source, status,
         starts_at, ends_at, unit_price, discount, tax, final_price,
         currency, billing_cycle
       ) VALUES (
         $1, 'ERP_PRO_MONTHLY', 'ERP_PLAN', 'DIRECT', 'PENDING',
         now(), null, 500000, 0, 0, 500000, 'IDR', 'MONTHLY'
       ) RETURNING id`,
      [BUSINESS_ID]
    )
    subscriptionId = subRes.rows[0].id
  })

  describe('1. Platform Authorization & Scope Protection', () => {
    it('allows SUPER_ADMIN platform token on platform invoice routes', async () => {
      const res = await request(app)
        .get('/v1/platform/invoices')
        .set('Authorization', `Bearer ${superToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.items)).toBe(true)
    })

    it('rejects tenant tokens with 403 WRONG_SCOPE', async () => {
      const res = await request(app)
        .get('/v1/platform/invoices')
        .set('Authorization', `Bearer ${tenantToken}`)

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('WRONG_SCOPE')
    })

    it('rejects unauthenticated requests with 401 INVALID_TOKEN', async () => {
      const res = await request(app)
        .get('/v1/platform/invoices')

      expect(res.status).toBe(401)
    })
  })

  describe('2. Invoice Generation & Idempotency', () => {
    it('generates an invoice with correct pricing, period, and status for a subscription', async () => {
      const res = await request(app)
        .post('/v1/platform/invoices/generate')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          subscription_id: subscriptionId,
        })

      expect(res.status).toBe(201)
      expect(res.body.invoice).toBeDefined()
      expect(res.body.invoice.subscription_id).toBe(subscriptionId)
      expect(res.body.invoice.business_id).toBe(BUSINESS_ID)
      expect(res.body.invoice.plan_code).toBe('ERP_PRO_MONTHLY')
      expect(Number(res.body.invoice.total_amount)).toBe(500000)
      expect(res.body.invoice.currency).toBe('IDR')
      expect(res.body.invoice.status).toBe('ISSUED')
      expect(res.body.invoice.invoice_number).toMatch(/^INV-PLT-\d{6}-\d{4}$/)
      expect(res.body.invoice.due_date).toBeDefined()
    })

    it('re-generating invoice for the same billing period is idempotent and does not create duplicates', async () => {
      const customStart = '2026-10-01T00:00:00.000Z'

      // First call
      const res1 = await request(app)
        .post('/v1/platform/invoices/generate')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          subscription_id: subscriptionId,
          custom_period_start: customStart,
        })
      expect(res1.status).toBe(201)
      const invoice1Id = res1.body.invoice.id

      // Second call (same period)
      const res2 = await request(app)
        .post('/v1/platform/invoices/generate')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          subscription_id: subscriptionId,
          custom_period_start: customStart,
        })
      expect(res2.status).toBe(201)
      const invoice2Id = res2.body.invoice.id

      // Must be identical ID
      expect(invoice2Id).toBe(invoice1Id)

      // Verify count in DB is exactly 1
      const countRes = await pool.query(
        'SELECT COUNT(*) FROM platform_invoices WHERE subscription_id = $1',
        [subscriptionId]
      )
      expect(Number(countRes.rows[0].count)).toBe(1)
    })
  })

  describe('3. Payment Recording & Subscription Renewal/Activation', () => {
    it('records payment, transitions invoice to PAID, and activates PENDING subscription', async () => {
      // 1. Generate invoice
      const genRes = await request(app)
        .post('/v1/platform/invoices/generate')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ subscription_id: subscriptionId })
      const invoiceId = genRes.body.invoice.id

      // 2. Record payment
      const payRes = await request(app)
        .post(`/v1/platform/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          payment_method: 'MANUAL_BANK_TRANSFER',
          payment_reference: 'BCA-TRF-987654',
          notes: 'Pembayaran langganan bulan pertama',
        })

      expect(payRes.status).toBe(200)
      expect(payRes.body.invoice.status).toBe('PAID')
      expect(payRes.body.invoice.payment_reference).toBe('BCA-TRF-987654')
      expect(payRes.body.payment.amount).toBe(500000)

      // 3. Verify subscription is now ACTIVE with updated ends_at
      const subRes = await pool.query('SELECT status, ends_at FROM subscriptions WHERE id = $1', [subscriptionId])
      expect(subRes.rows[0].status).toBe('ACTIVE')
      expect(subRes.rows[0].ends_at).not.toBeNull()

      // 4. Verify audit event was logged
      const auditRes = await pool.query(
        "SELECT * FROM platform_audit_logs WHERE target_id = $1 AND action = 'PLATFORM_PAYMENT_RECORDED'",
        [invoiceId]
      )
      expect(auditRes.rows.length).toBeGreaterThanOrEqual(1)
    })

    it('rejects recording payment on already paid invoice with 400 INVOICE_ALREADY_PAID', async () => {
      // Generate invoice
      const genRes = await request(app)
        .post('/v1/platform/invoices/generate')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ subscription_id: subscriptionId })
      const invoiceId = genRes.body.invoice.id

      // First payment
      await request(app)
        .post(`/v1/platform/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ payment_method: 'MANUAL_BANK_TRANSFER' })

      // Second payment
      const res = await request(app)
        .post(`/v1/platform/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ payment_method: 'MANUAL_BANK_TRANSFER' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVOICE_ALREADY_PAID')
    })
  })

  describe('4. Invoice Inspection & Querying', () => {
    it('retrieves invoice detail with payments history and subscription metadata', async () => {
      // Generate and pay invoice
      const genRes = await request(app)
        .post('/v1/platform/invoices/generate')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ subscription_id: subscriptionId })
      const invoiceId = genRes.body.invoice.id

      await request(app)
        .post(`/v1/platform/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          payment_method: 'MANUAL_BANK_TRANSFER',
          payment_reference: 'REF-DETAIL-123',
        })

      const detailRes = await request(app)
        .get(`/v1/platform/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${superToken}`)

      expect(detailRes.status).toBe(200)
      expect(detailRes.body.id).toBe(invoiceId)
      expect(detailRes.body.business_name).toBe('Tenant Billing Toko')
      expect(detailRes.body.plan_name).toBe('ERP Pro Monthly')
      expect(Array.isArray(detailRes.body.payments)).toBe(true)
      expect(detailRes.body.payments.length).toBe(1)
      expect(detailRes.body.payments[0].payment_reference).toBe('REF-DETAIL-123')
    })
  })
})
