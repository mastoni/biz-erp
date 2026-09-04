import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import crypto from 'crypto'
import { randomUUID } from 'crypto'
import { Express } from 'express'
import { createJwtService } from '../src/services/jwt_service'
import { hashPassword } from '../src/services/password_service'

describe('Phase 5B — Payment Gateway & Webhook Integration API', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>

  const SUPER_ADMIN_ID = randomUUID()
  const TENANT_USER_ID = randomUUID()
  const BUSINESS_ID = randomUUID()
  let subscriptionId: string
  let testInvoiceId: string
  let testInvoiceNumber: string

  const JWT_SECRET = 'insecure-test-secret-that-is-at-least-32-chars-long'
  const JWT_ISSUER = 'biz-erp-api'
  const JWT_AUDIENCE = 'biz-erp-client'
  const MIDTRANS_SERVER_KEY = 'test-midtrans-server-key-skmnet'

  let superToken: string
  let tenantToken: string

  function computeMidtransSignature(orderId: string, statusCode: string, grossAmount: string): string {
    const raw = `${orderId}${statusCode}${grossAmount}${MIDTRANS_SERVER_KEY}`
    return crypto.createHash('sha512').update(raw).digest('hex')
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET
    process.env.JWT_ISSUER = JWT_ISSUER
    process.env.JWT_AUDIENCE = JWT_AUDIENCE
    process.env.MIDTRANS_SERVER_KEY = MIDTRANS_SERVER_KEY

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
       ON CONFLICT (email) DO UPDATE SET platform_role = 'SUPER_ADMIN', id = $1`,
      [SUPER_ADMIN_ID, `superadmin-${SUPER_ADMIN_ID.slice(0, 8)}@gateway.com`, hashed, 'ACTIVE', 'SUPER_ADMIN']
    )

    // Seed Tenant user & business
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (email) DO UPDATE SET id = $1`,
      [TENANT_USER_ID, `tenant-${TENANT_USER_ID.slice(0, 8)}@gateway.com`, hashed, 'ACTIVE']
    )
    await pool.query(
      `INSERT INTO businesses (id, name, status) 
       VALUES ($1, 'Tenant Gateway Toko', 'ACTIVE') 
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
      `INSERT INTO plans (code, name, family, tier, type, billing_cycle, pricing, limits, status, trial_days, is_published, version)
       VALUES (
         'ERP_GATEWAY_PLAN',
         'ERP Gateway Plan',
         'ERP_PLAN',
         'GROWTH',
         'STANDALONE',
         'MONTHLY',
         '{"base_price": 500000, "final_price": 500000, "currency": "IDR"}',
         '{"max_branches": 5, "max_users": 10}',
         'ACTIVE',
         0,
         true,
         1
       )
       ON CONFLICT (code) DO UPDATE SET pricing = '{"base_price": 500000, "final_price": 500000, "currency": "IDR"}'`
    )

    // Generate tokens
    superToken = jwtService.signAccessToken({
      sub: SUPER_ADMIN_ID,
      scope: 'platform',
      role: 'SUPER_ADMIN',
      session_id: randomUUID(),
      jti: randomUUID(),
    })

    tenantToken = jwtService.signAccessToken({
      sub: TENANT_USER_ID,
      scope: 'tenant',
      business_id: BUSINESS_ID,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID(),
    })
  })

  beforeEach(async () => {
    // Reset subscriptions, invoices, payments, and webhook events
    await pool.query('DELETE FROM platform_payment_webhook_events')
    await pool.query('DELETE FROM platform_payments')
    await pool.query('DELETE FROM platform_invoices')
    await pool.query('DELETE FROM subscriptions')

    // Create a pending subscription
    const subRes = await pool.query(
      `INSERT INTO subscriptions (
         business_id, plan_code, family_code, source, status,
         starts_at, ends_at, unit_price, discount, tax, final_price,
         currency, billing_cycle
       ) VALUES (
         $1, 'ERP_GATEWAY_PLAN', 'ERP_PLAN', 'DIRECT', 'PENDING',
         now(), null, 500000, 0, 0, 500000, 'IDR', 'MONTHLY'
       ) RETURNING id`,
      [BUSINESS_ID]
    )
    subscriptionId = subRes.rows[0].id

    // Generate a platform invoice via API
    const invRes = await request(app)
      .post('/v1/platform/invoices/generate')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ subscription_id: subscriptionId })

    expect(invRes.status).toBe(201)
    testInvoiceId = invRes.body.invoice.id
    testInvoiceNumber = invRes.body.invoice.invoice_number
  })

  afterAll(async () => {
    await pool.end()
  })

  it('PAY-001: Create gateway transaction for valid platform invoice', async () => {
    const res = await request(app)
      .post(`/v1/platform/invoices/${testInvoiceId}/payment-token`)
      .set('Authorization', `Bearer ${superToken}`)

    expect(res.status).toBe(200)
    expect(res.body.transaction).toBeDefined()
    expect(res.body.transaction.order_id).toBe(testInvoiceNumber)
    expect(res.body.transaction.token).toContain('snap-token-')
    expect(res.body.transaction.redirect_url).toContain('midtrans.com')
    expect(res.body.transaction.gross_amount).toBe(500000)
    expect(res.body.transaction.currency).toBe('IDR')
  })

  it('PAY-002: Reject gateway transaction for invalid/unknown invoice', async () => {
    const unknownId = randomUUID()
    const res = await request(app)
      .post(`/v1/platform/invoices/${unknownId}/payment-token`)
      .set('Authorization', `Bearer ${superToken}`)

    expect(res.status).toBe(404)
    expect(res.body.error?.code || res.body.code).toBe('NOT_FOUND')
  })

  it('PAY-003: Valid signed webhook is accepted', async () => {
    const grossAmount = '500000.00'
    const statusCode = '200'
    const signature = computeMidtransSignature(testInvoiceNumber, statusCode, grossAmount)

    const payload = {
      order_id: testInvoiceNumber,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: 'settlement',
      transaction_id: `trx-${randomUUID()}`,
      payment_type: 'bank_transfer',
    }

    const res = await request(app)
      .post('/v1/platform/webhooks/midtrans')
      .send(payload)

    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
    expect(res.body.status).toBe('PROCESSED')
  })

  it('PAY-004: Invalid webhook signature is rejected', async () => {
    const payload = {
      order_id: testInvoiceNumber,
      status_code: '200',
      gross_amount: '500000.00',
      signature_key: 'invalid_sha512_signature_string',
      transaction_status: 'settlement',
      transaction_id: `trx-${randomUUID()}`,
    }

    const res = await request(app)
      .post('/v1/platform/webhooks/midtrans')
      .send(payload)

    expect(res.status).toBe(401)
    expect(res.body.error?.code || res.body.code).toBe('INVALID_SIGNATURE')
  })

  it('PAY-005: Successful webhook records exactly one platform payment', async () => {
    const grossAmount = '500000.00'
    const statusCode = '200'
    const signature = computeMidtransSignature(testInvoiceNumber, statusCode, grossAmount)
    const transactionId = `trx-${randomUUID()}`

    const payload = {
      order_id: testInvoiceNumber,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: 'settlement',
      transaction_id: transactionId,
      payment_type: 'qris',
    }

    const res = await request(app)
      .post('/v1/platform/webhooks/midtrans')
      .send(payload)

    expect(res.status).toBe(200)

    // Verify exactly one payment in database
    const payRes = await pool.query(
      `SELECT * FROM platform_payments WHERE invoice_id = $1`,
      [testInvoiceId]
    )
    expect(payRes.rows.length).toBe(1)
    expect(Number(payRes.rows[0].amount)).toBe(500000)
    expect(payRes.rows[0].payment_reference).toBe(transactionId)
  })

  it('PAY-006: Duplicate webhook does not create duplicate payment', async () => {
    const grossAmount = '500000.00'
    const statusCode = '200'
    const signature = computeMidtransSignature(testInvoiceNumber, statusCode, grossAmount)
    const transactionId = `trx-dedup-${randomUUID()}`

    const payload = {
      order_id: testInvoiceNumber,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: 'settlement',
      transaction_id: transactionId,
    }

    // 1st delivery
    const res1 = await request(app)
      .post('/v1/platform/webhooks/midtrans')
      .send(payload)
    expect(res1.status).toBe(200)
    expect(res1.body.status).toBe('PROCESSED')

    // 2nd delivery (duplicate event)
    const res2 = await request(app)
      .post('/v1/platform/webhooks/midtrans')
      .send(payload)
    expect(res2.status).toBe(200)
    expect(res2.body.status).toBe('ALREADY_PROCESSED')

    // Check payment count remains exactly 1
    const payRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM platform_payments WHERE invoice_id = $1`,
      [testInvoiceId]
    )
    expect(payRes.rows[0].count).toBe(1)
  })

  it('PAY-007: Successful webhook marks invoice PAID', async () => {
    const grossAmount = '500000.00'
    const statusCode = '200'
    const signature = computeMidtransSignature(testInvoiceNumber, statusCode, grossAmount)

    const payload = {
      order_id: testInvoiceNumber,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: 'settlement',
      transaction_id: `trx-${randomUUID()}`,
    }

    await request(app)
      .post('/v1/platform/webhooks/midtrans')
      .send(payload)

    const invRes = await pool.query(
      `SELECT * FROM platform_invoices WHERE id = $1`,
      [testInvoiceId]
    )
    expect(invRes.rows[0].status).toBe('PAID')
    expect(invRes.rows[0].paid_at).not.toBeNull()
  })

  it('PAY-008: Successful webhook activates/extends subscription through existing billing lifecycle', async () => {
    const grossAmount = '500000.00'
    const statusCode = '200'
    const signature = computeMidtransSignature(testInvoiceNumber, statusCode, grossAmount)

    const payload = {
      order_id: testInvoiceNumber,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: 'settlement',
      transaction_id: `trx-${randomUUID()}`,
    }

    await request(app)
      .post('/v1/platform/webhooks/midtrans')
      .send(payload)

    const subRes = await pool.query(
      `SELECT * FROM subscriptions WHERE id = $1`,
      [subscriptionId]
    )
    expect(subRes.rows[0].status).toBe('ACTIVE')
    expect(subRes.rows[0].ends_at).not.toBeNull()
  })

  it('PAY-009: Pending/failed/expired webhook does not mark invoice PAID', async () => {
    const grossAmount = '500000.00'
    const statusCode = '201'
    const signature = computeMidtransSignature(testInvoiceNumber, statusCode, grossAmount)

    const pendingPayload = {
      order_id: testInvoiceNumber,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: 'pending',
      transaction_id: `trx-pending-${randomUUID()}`,
    }

    const res = await request(app)
      .post('/v1/platform/webhooks/midtrans')
      .send(pendingPayload)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('PENDING')

    // Invoice remains ISSUED
    const invRes = await pool.query(
      `SELECT * FROM platform_invoices WHERE id = $1`,
      [testInvoiceId]
    )
    expect(invRes.rows[0].status).toBe('ISSUED')

    // Subscription remains PENDING
    const subRes = await pool.query(
      `SELECT * FROM subscriptions WHERE id = $1`,
      [subscriptionId]
    )
    expect(subRes.rows[0].status).toBe('PENDING')
    expect(subRes.rows[0].ends_at).toBeNull()
  })

  it('PAY-010: Already-paid invoice cannot receive duplicate payment', async () => {
    // 1. Mark invoice as paid first via manual recording
    await pool.query(
      `UPDATE platform_invoices SET status = 'PAID', paid_at = now() WHERE id = $1`,
      [testInvoiceId]
    )

    const grossAmount = '500000.00'
    const statusCode = '200'
    const signature = computeMidtransSignature(testInvoiceNumber, statusCode, grossAmount)

    const payload = {
      order_id: testInvoiceNumber,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: 'settlement',
      transaction_id: `trx-late-${randomUUID()}`,
    }

    const res = await request(app)
      .post('/v1/platform/webhooks/midtrans')
      .send(payload)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('IGNORED_ALREADY_PAID')

    // Verify 0 platform payments created
    const payRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM platform_payments WHERE invoice_id = $1`,
      [testInvoiceId]
    )
    expect(payRes.rows[0].count).toBe(0)
  })

  it('PAY-011: Tenant authentication cannot access platform gateway endpoints', async () => {
    const res = await request(app)
      .post(`/v1/platform/invoices/${testInvoiceId}/payment-token`)
      .set('Authorization', `Bearer ${tenantToken}`)

    expect(res.status).toBe(403)
    expect(res.body.error?.code || res.body.code).toBe('WRONG_SCOPE')
  })

  it('PAY-012: Unauthenticated gateway webhook without valid provider signature is rejected', async () => {
    const payload = {
      order_id: testInvoiceNumber,
      status_code: '200',
      gross_amount: '500000.00',
      // Missing signature_key
      transaction_status: 'settlement',
      transaction_id: `trx-${randomUUID()}`,
    }

    const res = await request(app)
      .post('/v1/platform/webhooks/midtrans')
      .send(payload)

    expect(res.status).toBe(401)
  })

  it('PAY-013: Malformed webhook payload is rejected with 400', async () => {
    const res = await request(app)
      .post('/v1/platform/webhooks/midtrans')
      .send({ invalid: 'payload' })

    expect(res.status).toBe(400)
    expect(res.body.error?.code || res.body.code).toBe('VALIDATION_ERROR')
  })
})
