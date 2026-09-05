import path from 'path'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { seedTestUser } from './auth_helper'
import { createJwtService, JwtService } from '../src/services/jwt_service'

const BUSINESS_A = '11111111-aaaa-4111-8aaa-111111111111'
const BUSINESS_B = '22222222-bbbb-4222-8bbb-222222222222'
const BRANCH_A = '33333333-aaaa-4333-8aaa-333333333333'
const BRANCH_B = '44444444-bbbb-4444-8bbb-444444444444'

let pool!: Pool
let app!: ReturnType<typeof createApp>
let jwtService!: JwtService
let ownerTokenA!: string
let staffTokenA!: string
let cashierTokenA!: string
let ownerTokenB!: string

async function cleanOperationalData(): Promise<void> {
  await pool.query(`
    TRUNCATE
      customer_invoices,
      customer_subscriptions,
      tenant_invoice_counters,
      customer_payments,
      receivables,
      journal_lines,
      journal_entries,
      customers
    RESTART IDENTITY CASCADE
  `)
}

async function seedCustomer(businessId: string, name = 'John Customer'): Promise<string> {
  const customerId = randomUUID()
  await pool.query(
    `INSERT INTO customers (id, business_id, name, email, phone)
     VALUES ($1, $2, $3, $4, '+628123456789')`,
    [customerId, businessId, name, `${name.toLowerCase().replace(/\s+/g, '')}@example.com`]
  )
  return customerId
}

beforeAll(async () => {
  const dbUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)

  const migrationsDir = path.resolve(__dirname, '../migrations')
  await runMigrations(pool, migrationsDir)

  const jwtSecret = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
  const jwtIssuer = process.env.JWT_ISSUER || 'biz-erp-api'
  const jwtAudience = process.env.JWT_AUDIENCE || 'biz-erp-client'
  jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)

  app = createApp(pool)

  await pool.query(`
    TRUNCATE
      customer_invoices,
      customer_subscriptions,
      tenant_invoice_counters,
      customer_payments,
      receivables,
      journal_lines,
      journal_entries,
      customers,
      branches,
      subscriptions,
      user_businesses,
      users,
      businesses
    RESTART IDENTITY CASCADE
  `)

  await pool.query(
    `INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant Alpha', 'ACTIVE'), ($2, 'Tenant Beta', 'ACTIVE') ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE'`,
    [BUSINESS_A, BUSINESS_B]
  )

  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'Branch Alpha', true), ($3, $4, 'Branch Beta', true) ON CONFLICT (id) DO NOTHING`,
    [BRANCH_A, BUSINESS_A, BRANCH_B, BUSINESS_B]
  )

  // Seed test users using seedTestUser which automatically sets up service & plans entitlement
  const ownerA = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER', email: 'owner-a@test.local' })
  ownerTokenA = jwtService.signAccessToken({
    sub: ownerA.userId,
    business_id: BUSINESS_A,
    role: 'OWNER',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  const cashierA = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER', email: 'cashier-a@test.local' })
  cashierTokenA = jwtService.signAccessToken({
    sub: cashierA.userId,
    business_id: BUSINESS_A,
    role: 'CASHIER',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  // Generate tenant-authenticated STAFF token for Tenant A
  staffTokenA = jwtService.signAccessToken({
    sub: randomUUID(),
    business_id: BUSINESS_A,
    role: 'STAFF',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  const ownerB = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER', email: 'owner-b@test.local' })
  ownerTokenB = jwtService.signAccessToken({
    sub: ownerB.userId,
    business_id: BUSINESS_B,
    role: 'OWNER',
    session_id: randomUUID(),
    jti: randomUUID()
  })
}, 30000)

afterAll(async () => {
  await pool.end()
}, 30000)

beforeEach(async () => {
  await cleanOperationalData()
}, 30000)

describe('Phase 4.1.40H-4: Customer Recurring Billing Express Routes & RBAC', () => {
  describe('1. Authentication & Route Guard', () => {
    it('A: requires authentication on customer-subscriptions and customer-invoices', async () => {
      const subRes = await request(app).get('/v1/customer-subscriptions')
      expect(subRes.status).toBe(401)

      const invRes = await request(app).get('/v1/customer-invoices')
      expect(invRes.status).toBe(401)
    })
  })

  describe('2. Subscription Creation & RBAC', () => {
    it('B: OWNER can create subscription', async () => {
      const custId = await seedCustomer(BUSINESS_A, 'Customer Alpha 1')
      const res = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          customer_id: custId,
          name: 'Paket Broadband 100M',
          unit_price_minor: 50000000,
          billing_cycle: 'MONTHLY'
        })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.name).toBe('Paket Broadband 100M')
      expect(res.body.unit_price_minor).toBe(50000000)
    })

    it('C: STAFF can create subscription', async () => {
      const custId = await seedCustomer(BUSINESS_A, 'Customer Alpha 2')
      const res = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          customer_id: custId,
          name: 'Paket Broadband 50M',
          unit_price_minor: 35000000,
          billing_cycle: 'MONTHLY'
        })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
    })

    it('D: CASHIER subscription creation is REJECTED with 403', async () => {
      const custId = await seedCustomer(BUSINESS_A, 'Customer Alpha 3')
      const res = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({
          customer_id: custId,
          name: 'Paket Broadband 20M',
          unit_price_minor: 20000000,
          billing_cycle: 'MONTHLY'
        })

      expect(res.status).toBe(403)
    })
  })

  describe('3. Subscription Updates & Financial Pricing RBAC Distinction', () => {
    it('E: OWNER can update financial pricing snapshot', async () => {
      const custId = await seedCustomer(BUSINESS_A, 'Customer Pricing')
      const createRes = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          customer_id: custId,
          name: 'Old Price Plan',
          unit_price_minor: 20000000,
          billing_cycle: 'MONTHLY'
        })
      const subId = createRes.body.id

      const patchRes = await request(app)
        .patch(`/v1/customer-subscriptions/${subId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          unit_price_minor: 30000000,
          total_minor: 30000000
        })

      expect(patchRes.status).toBe(200)
      expect(patchRes.body.unit_price_minor).toBe(30000000)
    })

    it('F: STAFF attempting financial price update is REJECTED with 403', async () => {
      const custId = await seedCustomer(BUSINESS_A, 'Customer Price Staff')
      const createRes = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          customer_id: custId,
          name: 'Original Price Plan',
          unit_price_minor: 20000000,
          billing_cycle: 'MONTHLY'
        })
      const subId = createRes.body.id

      const patchRes = await request(app)
        .patch(`/v1/customer-subscriptions/${subId}`)
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          unit_price_minor: 40000000
        })

      expect(patchRes.status).toBe(403)
      const errorMsg = patchRes.body.error?.message ?? patchRes.body.message
      expect(errorMsg).toMatch(/Only OWNER may update subscription financial pricing/)
    })

    it('G: STAFF operational update (notes/name) is ALLOWED (200)', async () => {
      const custId = await seedCustomer(BUSINESS_A, 'Customer Op Staff')
      const createRes = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          customer_id: custId,
          name: 'Original Plan',
          unit_price_minor: 20000000,
          billing_cycle: 'MONTHLY'
        })
      const subId = createRes.body.id

      const patchRes = await request(app)
        .patch(`/v1/customer-subscriptions/${subId}`)
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          name: 'Updated Plan Name By Staff',
          notes: 'Customer contacted support for contact change'
        })

      expect(patchRes.status).toBe(200)
      expect(patchRes.body.name).toBe('Updated Plan Name By Staff')
      expect(patchRes.body.notes).toBe('Customer contacted support for contact change')
    })

    it('H: CASHIER subscription mutation is REJECTED with 403', async () => {
      const custId = await seedCustomer(BUSINESS_A, 'Customer Cashier Mut')
      const createRes = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          customer_id: custId,
          name: 'Plan',
          unit_price_minor: 10000000,
          billing_cycle: 'MONTHLY'
        })
      const subId = createRes.body.id

      const patchRes = await request(app)
        .patch(`/v1/customer-subscriptions/${subId}`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({ name: 'Cashier Try' })

      expect(patchRes.status).toBe(403)
    })
  })

  describe('4. Pause, Resume, Cancellation & Invoice Generation RBAC', () => {
    it('I: OWNER subscription cancellation is ALLOWED; J: STAFF cancellation is REJECTED', async () => {
      const custId = await seedCustomer(BUSINESS_A, 'Customer Cancel RBAC')
      const createRes = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          customer_id: custId,
          name: 'Plan To Cancel',
          unit_price_minor: 10000000,
          billing_cycle: 'MONTHLY'
        })
      const subId = createRes.body.id

      // J. STAFF cancel -> 403
      const staffCancel = await request(app)
        .post(`/v1/customer-subscriptions/${subId}/cancel`)
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({ reason: 'Staff try' })
      expect(staffCancel.status).toBe(403)

      // I. OWNER cancel -> 200
      const ownerCancel = await request(app)
        .post(`/v1/customer-subscriptions/${subId}/cancel`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ reason: 'Contract termination' })
      expect(ownerCancel.status).toBe(200)
      expect(ownerCancel.body.status).toBe('CANCELLED')
    })

    it('K, L, M: manual invoice generation allowed for OWNER and STAFF, rejected for CASHIER', async () => {
      const custId = await seedCustomer(BUSINESS_A, 'Customer Bill Run')
      const createRes = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          customer_id: custId,
          name: 'Plan To Bill',
          unit_price_minor: 15000000,
          billing_cycle: 'MONTHLY',
          starts_at: '2026-09-01T00:00:00.000Z'
        })
      const subId = createRes.body.id

      // M. CASHIER bill generation -> 403
      const cashierBill = await request(app)
        .post(`/v1/customer-subscriptions/${subId}/generate-invoice`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({})
      expect(cashierBill.status).toBe(403)

      // L. STAFF bill generation -> 201
      const staffBill = await request(app)
        .post(`/v1/customer-subscriptions/${subId}/generate-invoice`)
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          billing_period_start: '2026-09-01',
          billing_period_end: '2026-09-30'
        })
      expect(staffBill.status).toBe(201)
      expect(staffBill.body.invoice_number).toMatch(/^INV-202609-\d{4}$/)

      // K. OWNER bill generation -> 201
      const ownerBill = await request(app)
        .post(`/v1/customer-subscriptions/${subId}/generate-invoice`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          billing_period_start: '2026-10-01',
          billing_period_end: '2026-10-31'
        })
      expect(ownerBill.status).toBe(201)
    })
  })

  describe('5. Invoices & Payments RBAC and Endpoints', () => {
    it('N: all roles can list and view invoices', async () => {
      const custId = await seedCustomer(BUSINESS_A, 'Customer View Inv')
      const subRes = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          customer_id: custId,
          name: 'Viewable Plan',
          unit_price_minor: 10000000,
          billing_cycle: 'MONTHLY'
        })
      const invRes = await request(app)
        .post(`/v1/customer-subscriptions/${subRes.body.id}/generate-invoice`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({})
      const invId = invRes.body.id

      // OWNER list & view
      const listOwner = await request(app).get('/v1/customer-invoices').set('Authorization', `Bearer ${ownerTokenA}`)
      expect(listOwner.status).toBe(200)
      expect(listOwner.body.items.length).toBeGreaterThanOrEqual(1)

      // STAFF list & view
      const viewStaff = await request(app).get(`/v1/customer-invoices/${invId}`).set('Authorization', `Bearer ${staffTokenA}`)
      expect(viewStaff.status).toBe(200)
      expect(viewStaff.body.id).toBe(invId)

      // CASHIER list & view
      const viewCashier = await request(app).get(`/v1/customer-invoices/${invId}`).set('Authorization', `Bearer ${cashierTokenA}`)
      expect(viewCashier.status).toBe(200)
    })

    it('O: all roles (including CASHIER) can record customer payment', async () => {
      const custId = await seedCustomer(BUSINESS_A, 'Customer Pay All')
      const subRes = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          customer_id: custId,
          name: 'Payable Plan',
          unit_price_minor: 10000000,
          billing_cycle: 'MONTHLY'
        })
      const invRes = await request(app)
        .post(`/v1/customer-subscriptions/${subRes.body.id}/generate-invoice`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({})
      const invId = invRes.body.id

      const payRes = await request(app)
        .post(`/v1/customer-invoices/${invId}/payments`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({
          amount_minor: 10000000,
          method: 'cash',
          reference: 'CASHIER-PAID-01',
          idempotency_key: `idem-cashier-${Date.now()}`
        })

      expect(payRes.status).toBe(200)
      expect(payRes.body.status).toBe('PAID')
    })

    it('P, Q, R: only OWNER may cancel invoice; STAFF & CASHIER are rejected with 403', async () => {
      const custId = await seedCustomer(BUSINESS_A, 'Customer Inv Cancel RBAC')
      const subRes = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          customer_id: custId,
          name: 'Cancel Test Plan',
          unit_price_minor: 10000000,
          billing_cycle: 'MONTHLY'
        })
      const invRes = await request(app)
        .post(`/v1/customer-subscriptions/${subRes.body.id}/generate-invoice`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({})
      const invId = invRes.body.id

      // Q. CASHIER cancel -> 403
      const cancelCashier = await request(app)
        .post(`/v1/customer-invoices/${invId}/cancel`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({ reason: 'Cashier attempt' })
      expect(cancelCashier.status).toBe(403)

      // P. STAFF cancel -> 403
      const cancelStaff = await request(app)
        .post(`/v1/customer-invoices/${invId}/cancel`)
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({ reason: 'Staff attempt' })
      expect(cancelStaff.status).toBe(403)

      // R. OWNER cancel -> 200
      const cancelOwner = await request(app)
        .post(`/v1/customer-invoices/${invId}/cancel`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ reason: 'Owner void invoice' })
      expect(cancelOwner.status).toBe(200)
      expect(cancelOwner.body.status).toBe('CANCELLED')
    })
  })

  describe('6. Validation, Tenant Isolation & Security Hardening', () => {
    it('S: malformed DTO is rejected with 400', async () => {
      const res = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          customer_id: 'not-a-uuid',
          name: 'Bad Plan',
          unit_price_minor: -100
        })

      expect(res.status).toBe(400)
    })

    it('T & U: cross-tenant access to subscriptions and invoices is rejected (404/403)', async () => {
      const custA = await seedCustomer(BUSINESS_A, 'Customer Biz A')
      const subRes = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          customer_id: custA,
          name: 'Biz A Secret Plan',
          unit_price_minor: 10000000,
          billing_cycle: 'MONTHLY'
        })
      const subIdA = subRes.body.id

      const invRes = await request(app)
        .post(`/v1/customer-subscriptions/${subIdA}/generate-invoice`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({})
      const invIdA = invRes.body.id

      // Tenant B cannot GET Subscription A
      const subBGet = await request(app)
        .get(`/v1/customer-subscriptions/${subIdA}`)
        .set('Authorization', `Bearer ${ownerTokenB}`)
      expect(subBGet.status).toBe(404)

      // Tenant B cannot PATCH Subscription A
      const subBPatch = await request(app)
        .patch(`/v1/customer-subscriptions/${subIdA}`)
        .set('Authorization', `Bearer ${ownerTokenB}`)
        .send({ name: 'Hacked Plan' })
      expect(subBPatch.status).toBe(404)

      // Tenant B cannot GET Invoice A
      const invBGet = await request(app)
        .get(`/v1/customer-invoices/${invIdA}`)
        .set('Authorization', `Bearer ${ownerTokenB}`)
      expect(invBGet.status).toBe(404)

      // Tenant B cannot POST payment on Invoice A
      const invBPay = await request(app)
        .post(`/v1/customer-invoices/${invIdA}/payments`)
        .set('Authorization', `Bearer ${ownerTokenB}`)
        .send({
          amount_minor: 10000000,
          method: 'cash',
          idempotency_key: 'hacked-pay'
        })
      expect(invBPay.status).toBe(404)

      // Tenant B cannot cancel Invoice A
      const invBCancel = await request(app)
        .post(`/v1/customer-invoices/${invIdA}/cancel`)
        .set('Authorization', `Bearer ${ownerTokenB}`)
        .send({ reason: 'Hacked cancel' })
      expect(invBCancel.status).toBe(404)
    })

    it('V: client-supplied business_id in payload cannot override tenant context', async () => {
      const custA = await seedCustomer(BUSINESS_A, 'Customer Tenant Override')
      const res = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          business_id: BUSINESS_B, // Client attempts to spoof tenant B
          customer_id: custA,
          name: 'Spoofed Tenant Plan',
          unit_price_minor: 10000000,
          billing_cycle: 'MONTHLY'
        })

      // When payload has mismatched business_id, auth middleware rejects with 403 or server ignores spoof
      expect([201, 403]).toContain(res.status)
      if (res.status === 201) {
        expect(res.body.business_id).toBe(BUSINESS_A)
      }
    })

    it('X: maps domain state conflicts to HTTP 409', async () => {
      const custA = await seedCustomer(BUSINESS_A, 'Customer Conflict')
      const subRes = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          customer_id: custA,
          name: 'Conflict Plan',
          unit_price_minor: 10000000,
          billing_cycle: 'MONTHLY'
        })
      const subId = subRes.body.id

      const invRes = await request(app)
        .post(`/v1/customer-subscriptions/${subId}/generate-invoice`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({})
      const invId = invRes.body.id

      // Pay invoice in full
      await request(app)
        .post(`/v1/customer-invoices/${invId}/payments`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          amount_minor: 10000000,
          method: 'cash',
          idempotency_key: 'full-pay'
        })

      // Attempt payment on already paid invoice -> 409
      const dupPay = await request(app)
        .post(`/v1/customer-invoices/${invId}/payments`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          amount_minor: 5000000,
          method: 'cash',
          idempotency_key: 'over-pay'
        })
      expect(dupPay.status).toBe(409)

      // Attempt cancel on paid invoice -> 409
      const cancelPaid = await request(app)
        .post(`/v1/customer-invoices/${invId}/cancel`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({})
      expect(cancelPaid.status).toBe(409)
    })
  })
})
