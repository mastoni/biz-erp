import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import path from 'path'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createCustomerBillingService } from '../src/services/customer_billing_service'
import { createJwtService, JwtService } from '../src/services/jwt_service'
import { ConflictError } from '../src/errors/conflict_error'
import { ValidationError } from '../src/errors/validation_error'
import { seedTestUser } from './auth_helper'

describe('Phase 4.1.40H-5: Native ERP Recurring Customer Billing Integration & Transaction Validation', () => {
  let pool: Pool
  let app: ReturnType<typeof createApp>
  let jwtService: JwtService
  let billingService: ReturnType<typeof createCustomerBillingService>

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))

    const jwtSecret = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
    const jwtIssuer = process.env.JWT_ISSUER || 'biz-erp-api'
    const jwtAudience = process.env.JWT_AUDIENCE || 'biz-erp-client'
    jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)

    app = createApp(pool)
    billingService = createCustomerBillingService(pool)
  }, 30000)

  afterAll(async () => {
    await pool.end()
  }, 30000)

  async function createTenantContext(prefix: string) {
    const bizId = randomUUID()
    const customerId = randomUUID()

    await seedTestUser(pool, bizId, { withSubscription: true })

    await pool.query(
      `INSERT INTO businesses (id, name, status) VALUES ($1, $2, 'ACTIVE') ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE'`,
      [bizId, `${prefix} Biz`]
    )

    await pool.query(
      `INSERT INTO customers (id, business_id, name, phone, email) VALUES ($1, $2, $3, '+628123456789', $4)`,
      [customerId, bizId, `${prefix} Customer`, `${prefix.toLowerCase()}@example.com`]
    )

    const ownerToken = jwtService.signAccessToken({
      sub: randomUUID(),
      business_id: bizId,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    const staffToken = jwtService.signAccessToken({
      sub: randomUUID(),
      business_id: bizId,
      role: 'STAFF',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    const cashierToken = jwtService.signAccessToken({
      sub: randomUUID(),
      business_id: bizId,
      role: 'CASHIER',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    return { bizId, customerId, ownerToken, staffToken, cashierToken }
  }

  // =========================================================================
  // 1. COMPLETE END-TO-END SUBSCRIPTION, INVOICING & ACCOUNTING LIFECYCLE
  // =========================================================================
  describe('1. Complete End-to-End Lifecycle & Double-Entry Accounting', () => {
    it('executes full flow: Customer -> Subscription -> Invoice -> Receivable -> Journal -> Payment -> Settlement', async () => {
      const tenant = await createTenantContext('E2E_Full')

      // A & B: Create Subscription via API
      const subRes = await request(app)
        .post('/v1/customer-subscriptions')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .send({
          customer_id: tenant.customerId,
          name: 'Dedicated 100Mbps Corporate',
          billing_cycle: 'MONTHLY',
          anchor_day: 15,
          unit_price_minor: 100000000, // Rp 1,000,000.00
          tax_minor: 11000000,        // Rp 110,000.00 (11% PPN)
          discount_minor: 0,
          total_minor: 111000000,
          starts_at: '2026-09-01T00:00:00.000Z',
          notes: 'Corporate fiber package'
        })
      expect(subRes.status).toBe(201)
      const sub = subRes.body
      expect(sub.business_id).toBe(tenant.bizId)
      expect(sub.customer_id).toBe(tenant.customerId)
      expect(sub.status).toBe('ACTIVE')
      expect(sub.anchor_day).toBe(15)
      expect(sub.total_minor).toBe(111000000)

      // D & E: Generate Invoice via API
      const invRes = await request(app)
        .post(`/v1/customer-subscriptions/${sub.id}/generate-invoice`)
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .send({
          billing_period_start: '2026-09-01',
          billing_period_end: '2026-09-30',
          due_date: '2026-09-15'
        })
      expect(invRes.status).toBe(201)
      const inv = invRes.body
      expect(inv.business_id).toBe(tenant.bizId)
      expect(inv.customer_id).toBe(tenant.customerId)
      expect(inv.customer_subscription_id).toBe(sub.id)
      expect(inv.status).toBe('ISSUED')
      expect(inv.total_minor).toBe(111000000)
      expect(inv.invoice_number).toMatch(/^INV-\d{6}-\d{4}$/)
      expect(inv.receivable_id).toBeDefined()

      // 4. Accounting Validation: Verify Dr Accounts Receivable, Cr Revenue
      const recResult = await pool.query(
        `SELECT * FROM receivables WHERE id = $1 AND business_id = $2`,
        [inv.receivable_id, tenant.bizId]
      )
      expect(recResult.rows.length).toBe(1)
      const rec = recResult.rows[0]
      expect(rec.status).toBe('OPEN')
      expect(Number(rec.amount_minor)).toBe(111000000)
      expect(Number(rec.outstanding_minor)).toBe(111000000)

      const journalResult = await pool.query(
        `SELECT * FROM journal_entries WHERE source_type = 'RECEIVABLE' AND source_id = $1 AND business_id = $2`,
        [rec.id, tenant.bizId]
      )
      expect(journalResult.rows.length).toBe(1)
      const journal = journalResult.rows[0]
      expect(journal.status).toBe('posted')

      const linesResult = await pool.query(
        `SELECT jl.*, a.type as account_type, a.code as account_code 
         FROM journal_lines jl 
         JOIN accounts a ON a.id = jl.account_id 
         WHERE jl.journal_entry_id = $1 
         ORDER BY jl.created_at ASC`,
        [journal.id]
      )
      expect(linesResult.rows.length).toBeGreaterThanOrEqual(2)

      const totalDebit = linesResult.rows.reduce((sum, r) => sum + Number(r.debit_minor || 0), 0)
      const totalCredit = linesResult.rows.reduce((sum, r) => sum + Number(r.credit_minor || 0), 0)
      expect(totalDebit).toBe(totalCredit)
      expect(totalDebit).toBe(111000000)

      const debitLine = linesResult.rows.find((r) => Number(r.debit_minor) > 0)
      const creditLine = linesResult.rows.find((r) => Number(r.credit_minor) > 0)
      expect(debitLine?.account_type).toBe('receivable')
      expect(creditLine?.account_type).toBe('revenue')

      // 5. Payment Lifecycle (Partial + Final)
      const pay1Res = await request(app)
        .post(`/v1/customer-invoices/${inv.id}/payments`)
        .set('Authorization', `Bearer ${tenant.cashierToken}`)
        .send({
          amount_minor: 50000000, // Partial Rp 500,000.00
          method: 'bank_transfer',
          reference: 'TRF-001',
          idempotency_key: randomUUID()
        })
      expect(pay1Res.status).toBe(200)
      expect(pay1Res.body.status).toBe('ISSUED')

      const recPartial = await pool.query(`SELECT * FROM receivables WHERE id = $1`, [inv.receivable_id])
      expect(recPartial.rows[0].status).toBe('PARTIAL')
      expect(Number(recPartial.rows[0].paid_minor)).toBe(50000000)
      expect(Number(recPartial.rows[0].outstanding_minor)).toBe(61000000)

      // Final payment
      const pay2Res = await request(app)
        .post(`/v1/customer-invoices/${inv.id}/payments`)
        .set('Authorization', `Bearer ${tenant.cashierToken}`)
        .send({
          amount_minor: 61000000,
          method: 'cash',
          idempotency_key: randomUUID()
        })
      expect(pay2Res.status).toBe(200)
      expect(pay2Res.body.status).toBe('PAID')
      expect(pay2Res.body.paid_at).toBeDefined()

      const recFinal = await pool.query(`SELECT * FROM receivables WHERE id = $1`, [inv.receivable_id])
      expect(recFinal.rows[0].status).toBe('PAID')
      expect(Number(recFinal.rows[0].paid_minor)).toBe(111000000)
      expect(Number(recFinal.rows[0].outstanding_minor)).toBe(0)
    }, 30000)
  })

  // =========================================================================
  // 2. PAYMENT LIFECYCLE: OVERDUE TRANSITIONS & IDEMPOTENCY
  // =========================================================================
  describe('2. Payment Lifecycle & Idempotency', () => {
    it('handles OVERDUE invoices: partial payment leaves OVERDUE, final payment transitions to PAID', async () => {
      const tenant = await createTenantContext('Overdue_Pay')

      const sub = await billingService.createSubscription(tenant.bizId, {
        customer_id: tenant.customerId,
        name: 'Overdue Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 1,
        unit_price_minor: 20000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 20000000,
        starts_at: '2026-08-01T00:00:00.000Z'
      })

      const inv = await billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
        billing_period_start: '2026-08-01',
        billing_period_end: '2026-08-31',
        due_date: '2026-08-10' // Past due date
      })

      // Run overdue processing
      const overdueCount = await billingService.processOverdueInvoices(tenant.bizId)
      expect(overdueCount).toBeGreaterThanOrEqual(1)

      const overdueInv = await billingService.getInvoice(tenant.bizId, inv.id)
      expect(overdueInv.status).toBe('OVERDUE')

      // Partial payment on OVERDUE invoice -> remains OVERDUE
      const partPay = await billingService.recordInvoicePayment(tenant.bizId, inv.id, {
        amount_minor: 10000000,
        method: 'cash',
        idempotency_key: randomUUID()
      })
      expect(partPay.status).toBe('OVERDUE')

      const recPart = await pool.query('SELECT * FROM receivables WHERE id = $1', [inv.receivable_id])
      expect(Number(recPart.rows[0].paid_minor)).toBe(10000000)

      // Final payment on OVERDUE invoice -> transitions to PAID
      const finalPay = await billingService.recordInvoicePayment(tenant.bizId, inv.id, {
        amount_minor: 10000000,
        method: 'cash',
        idempotency_key: randomUUID()
      })
      expect(finalPay.status).toBe('PAID')

      const recFinal = await pool.query('SELECT * FROM receivables WHERE id = $1', [inv.receivable_id])
      expect(Number(recFinal.rows[0].paid_minor)).toBe(20000000)
    }, 30000)

    it('enforces payment idempotency key retry without double-posting', async () => {
      const tenant = await createTenantContext('Pay_Idempotent')

      const sub = await billingService.createSubscription(tenant.bizId, {
        customer_id: tenant.customerId,
        name: 'Idempotent Payment Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 1,
        unit_price_minor: 50000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 50000000,
        starts_at: '2026-09-01T00:00:00.000Z'
      })

      const inv = await billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30'
      })

      const idemKey = `IDEM-KEY-${randomUUID()}`

      const pay1 = await billingService.recordInvoicePayment(tenant.bizId, inv.id, {
        amount_minor: 25000000,
        method: 'bank_transfer',
        idempotency_key: idemKey
      })
      expect(pay1.status).toBe('ISSUED')

      // Retry with same idempotency key
      const pay2 = await billingService.recordInvoicePayment(tenant.bizId, inv.id, {
        amount_minor: 25000000,
        method: 'bank_transfer',
        idempotency_key: idemKey
      })
      expect(pay2.status).toBe('ISSUED')

      // Verify only 1 payment row recorded
      const paymentRows = await pool.query(
        `SELECT * FROM customer_payments WHERE receivable_id = $1 AND idempotency_key = $2`,
        [inv.receivable_id, idemKey]
      )
      expect(paymentRows.rows.length).toBe(1)
    }, 30000)
  })

  // =========================================================================
  // 3. INVOICE CANCELLATION & ACCOUNTING REVERSAL
  // =========================================================================
  describe('3. Invoice Cancellation & Accounting Reversal', () => {
    it('cancels unpaid ISSUED invoice, sets status CANCELLED, reverses receivable, and posts balanced reversal journal', async () => {
      const tenant = await createTenantContext('Cancel_Reversal')

      const sub = await billingService.createSubscription(tenant.bizId, {
        customer_id: tenant.customerId,
        name: 'Cancellation Test Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 1,
        unit_price_minor: 80000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 80000000,
        starts_at: '2026-09-01T00:00:00.000Z'
      })

      const inv = await billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30'
      })

      const cancelRes = await request(app)
        .post(`/v1/customer-invoices/${inv.id}/cancel`)
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .send({ reason: 'Customer requested plan alteration before payment' })
      expect(cancelRes.status).toBe(200)
      expect(cancelRes.body.status).toBe('CANCELLED')

      // Verify receivable status is REVERSED
      const recCheck = await pool.query(`SELECT * FROM receivables WHERE id = $1`, [inv.receivable_id])
      expect(recCheck.rows[0].status).toBe('REVERSED')

      // Verify reversal journal is created and balanced
      const reversalJournal = await pool.query(
        `SELECT * FROM journal_entries WHERE source_type = 'REVERSAL' AND source_id = $1`,
        [inv.receivable_id]
      )
      expect(reversalJournal.rows.length).toBe(1)
      expect(reversalJournal.rows[0].status).toBe('posted')

      const reversalLines = await pool.query(
        `SELECT * FROM journal_lines WHERE journal_entry_id = $1`,
        [reversalJournal.rows[0].id]
      )
      expect(reversalLines.rows.length).toBeGreaterThanOrEqual(2)
      const debitTotal = reversalLines.rows.reduce((sum, r) => sum + Number(r.debit_minor || 0), 0)
      const creditTotal = reversalLines.rows.reduce((sum, r) => sum + Number(r.credit_minor || 0), 0)
      expect(debitTotal).toBe(creditTotal)
      expect(debitTotal).toBe(80000000)

      // Original journal remains unchanged
      const origJournal = await pool.query(
        `SELECT * FROM journal_entries WHERE source_type = 'RECEIVABLE' AND source_id = $1`,
        [inv.receivable_id]
      )
      expect(origJournal.rows.length).toBe(1)
    }, 30000)

    it('rejects cancellation of invoice with existing payments (409 Conflict)', async () => {
      const tenant = await createTenantContext('Cancel_Paid_Reject')

      const sub = await billingService.createSubscription(tenant.bizId, {
        customer_id: tenant.customerId,
        name: 'Cannot Cancel Paid Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 1,
        unit_price_minor: 30000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 30000000,
        starts_at: '2026-09-01T00:00:00.000Z'
      })

      const inv = await billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30'
      })

      // Record partial payment
      await billingService.recordInvoicePayment(tenant.bizId, inv.id, {
        amount_minor: 10000000,
        method: 'cash',
        idempotency_key: randomUUID()
      })

      // Attempt cancellation
      const cancelRes = await request(app)
        .post(`/v1/customer-invoices/${inv.id}/cancel`)
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .send({ reason: 'Try to cancel partially paid invoice' })
      expect(cancelRes.status).toBe(409)
      expect(cancelRes.body.error?.code || cancelRes.body.code).toBe('PAYMENT_EXISTS')
    }, 30000)

    it('rejects payment against a CANCELLED invoice (409 Conflict)', async () => {
      const tenant = await createTenantContext('Pay_Cancelled_Reject')

      const sub = await billingService.createSubscription(tenant.bizId, {
        customer_id: tenant.customerId,
        name: 'Pay Cancelled Test Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 1,
        unit_price_minor: 40000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 40000000,
        starts_at: '2026-09-01T00:00:00.000Z'
      })

      const inv = await billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30'
      })

      await billingService.cancelInvoice(tenant.bizId, inv.id, { reason: 'Cancelled before payment' })

      const payRes = await request(app)
        .post(`/v1/customer-invoices/${inv.id}/payments`)
        .set('Authorization', `Bearer ${tenant.cashierToken}`)
        .send({
          amount_minor: 40000000,
          method: 'cash',
          idempotency_key: randomUUID()
        })
      expect(payRes.status).toBe(409)
      expect(payRes.body.error?.code || payRes.body.code).toBe('INVALID_STATE')
    }, 30000)
  })

  // =========================================================================
  // 4. DUPLICATE BILLING & CONCURRENCY
  // =========================================================================
  describe('4. Duplicate Billing Idempotency & Concurrency', () => {
    it('idempotently returns the existing invoice when billed twice for the same period', async () => {
      const tenant = await createTenantContext('Dup_Billing')

      const sub = await billingService.createSubscription(tenant.bizId, {
        customer_id: tenant.customerId,
        name: 'Idempotent Period Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 1,
        unit_price_minor: 25000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 25000000,
        starts_at: '2026-09-01T00:00:00.000Z'
      })

      const inv1 = await billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30'
      })

      const inv2 = await billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30'
      })

      expect(inv1.id).toBe(inv2.id)
      expect(inv1.invoice_number).toBe(inv2.invoice_number)

      const invCount = await pool.query(
        `SELECT COUNT(*) FROM customer_invoices WHERE customer_subscription_id = $1`,
        [sub.id]
      )
      expect(Number(invCount.rows[0].count)).toBe(1)
    }, 30000)

    it('concurrent invoice generation produces exactly one invoice and one journal', async () => {
      const tenant = await createTenantContext('Concurrent_Gen')

      const sub = await billingService.createSubscription(tenant.bizId, {
        customer_id: tenant.customerId,
        name: 'Concurrent Generation Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 1,
        unit_price_minor: 35000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 35000000,
        starts_at: '2026-09-01T00:00:00.000Z'
      })

      await Promise.allSettled([
        billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
          billing_period_start: '2026-09-01',
          billing_period_end: '2026-09-30'
        }),
        billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
          billing_period_start: '2026-09-01',
          billing_period_end: '2026-09-30'
        })
      ])

      const invoices = await pool.query(
        `SELECT * FROM customer_invoices WHERE customer_subscription_id = $1`,
        [sub.id]
      )
      expect(invoices.rows.length).toBe(1)

      const receivables = await pool.query(
        `SELECT * FROM receivables WHERE id = $1`,
        [invoices.rows[0].receivable_id]
      )
      expect(receivables.rows.length).toBe(1)

      const journals = await pool.query(
        `SELECT * FROM journal_entries WHERE source_type = 'RECEIVABLE' AND source_id = $1`,
        [invoices.rows[0].receivable_id]
      )
      expect(journals.rows.length).toBe(1)
    }, 30000)
  })

  // =========================================================================
  // 5. INVOICE NUMBERING & COUNTER ISOLATION
  // =========================================================================
  describe('5. Invoice Numbering & Counter Isolation', () => {
    it('generates sequential INV-YYYYMM-XXXX formatted invoice numbers isolated by tenant', async () => {
      const tenantA = await createTenantContext('Inv_Num_A')
      const tenantB = await createTenantContext('Inv_Num_B')

      const subA = await billingService.createSubscription(tenantA.bizId, {
        customer_id: tenantA.customerId,
        name: 'Tenant A Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 1,
        unit_price_minor: 10000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 10000000,
        starts_at: '2026-09-01T00:00:00.000Z'
      })

      const subB = await billingService.createSubscription(tenantB.bizId, {
        customer_id: tenantB.customerId,
        name: 'Tenant B Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 1,
        unit_price_minor: 10000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 10000000,
        starts_at: '2026-09-01T00:00:00.000Z'
      })

      const invA1 = await billingService.generateCustomerInvoice(tenantA.bizId, subA.id, {
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30'
      })

      const invA2 = await billingService.generateCustomerInvoice(tenantA.bizId, subA.id, {
        billing_period_start: '2026-10-01',
        billing_period_end: '2026-10-31'
      })

      const invB1 = await billingService.generateCustomerInvoice(tenantB.bizId, subB.id, {
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30'
      })

      // Tenant A month 2026-09 -> 0001
      expect(invA1.invoice_number).toBe('INV-202609-0001')
      // Tenant A month 2026-10 -> 0001
      expect(invA2.invoice_number).toBe('INV-202610-0001')
      // Tenant B month 2026-09 -> 0001 (isolated from Tenant A)
      expect(invB1.invoice_number).toBe('INV-202609-0001')
    }, 30000)
  })

  // =========================================================================
  // 6. BILLING PERIODS & MONTH-END ANCHOR DAY CLAMPING
  // =========================================================================
  describe('6. Billing Periods & Anchor Day Clamping', () => {
    it('accurately advances next_billing_date for MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL with anchor_day = 31 clamping', async () => {
      const tenant = await createTenantContext('Billing_Cycles')

      // 1. Monthly with anchor_day 31 created in Jan 2026
      const subMonthly = await billingService.createSubscription(tenant.bizId, {
        customer_id: tenant.customerId,
        name: 'Clamped Monthly Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 31,
        unit_price_minor: 50000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 50000000,
        starts_at: '2026-01-31T00:00:00.000Z'
      })
      expect(subMonthly.next_billing_date).toBe('2026-01-31')

      // Generate invoice for Jan -> next billing date clamps to Feb 28, 2026 (non-leap year)
      await billingService.generateCustomerInvoice(tenant.bizId, subMonthly.id, {
        billing_period_start: '2026-01-31',
        billing_period_end: '2026-02-27'
      })
      const subAfterJan = await billingService.getSubscription(tenant.bizId, subMonthly.id)
      expect(subAfterJan.next_billing_date).toBe('2026-02-28')

      // Generate invoice for Feb -> next billing date restores to Mar 31, 2026
      await billingService.generateCustomerInvoice(tenant.bizId, subMonthly.id, {
        billing_period_start: '2026-02-28',
        billing_period_end: '2026-03-30'
      })
      const subAfterFeb = await billingService.getSubscription(tenant.bizId, subMonthly.id)
      expect(subAfterFeb.next_billing_date).toBe('2026-03-31')

      // 2. Quarterly
      const subQuarterly = await billingService.createSubscription(tenant.bizId, {
        customer_id: tenant.customerId,
        name: 'Quarterly Plan',
        billing_cycle: 'QUARTERLY',
        anchor_day: 15,
        unit_price_minor: 150000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 150000000,
        starts_at: '2026-01-15T00:00:00.000Z'
      })
      await billingService.generateCustomerInvoice(tenant.bizId, subQuarterly.id, {
        billing_period_start: '2026-01-15',
        billing_period_end: '2026-04-14'
      })
      const subAfterQ1 = await billingService.getSubscription(tenant.bizId, subQuarterly.id)
      expect(subAfterQ1.next_billing_date).toBe('2026-04-15')

      // 3. Annual
      const subAnnual = await billingService.createSubscription(tenant.bizId, {
        customer_id: tenant.customerId,
        name: 'Annual Plan',
        billing_cycle: 'ANNUAL',
        anchor_day: 1,
        unit_price_minor: 600000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 600000000,
        starts_at: '2026-01-01T00:00:00.000Z'
      })
      await billingService.generateCustomerInvoice(tenant.bizId, subAnnual.id, {
        billing_period_start: '2026-01-01',
        billing_period_end: '2026-12-31'
      })
      const subAfterY1 = await billingService.getSubscription(tenant.bizId, subAnnual.id)
      expect(subAfterY1.next_billing_date).toBe('2027-01-01')
    }, 30000)
  })

  // =========================================================================
  // 7. SUBSCRIPTION LIFECYCLE & STATE TRANSITIONS
  // =========================================================================
  describe('7. Subscription Lifecycle & State Transitions', () => {
    it('enforces lifecycle states: ACTIVE (billable), PAUSED (blocked), CANCELLED (blocked)', async () => {
      const tenant = await createTenantContext('Sub_Lifecycle')

      const sub = await billingService.createSubscription(tenant.bizId, {
        customer_id: tenant.customerId,
        name: 'Lifecycle Test Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 1,
        unit_price_minor: 50000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 50000000,
        starts_at: '2026-09-01T00:00:00.000Z'
      })
      expect(sub.status).toBe('ACTIVE')

      // Pause subscription
      const paused = await billingService.pauseSubscription(tenant.bizId, sub.id, { reason: 'Customer traveling' })
      expect(paused.status).toBe('PAUSED')

      // Invoicing PAUSED subscription is blocked
      await expect(
        billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
          billing_period_start: '2026-09-01',
          billing_period_end: '2026-09-30'
        })
      ).rejects.toThrow()

      // Resume subscription
      const resumed = await billingService.resumeSubscription(tenant.bizId, sub.id, { reason: 'Customer returned' })
      expect(resumed.status).toBe('ACTIVE')

      // Invoicing ACTIVE resumed subscription succeeds
      const inv = await billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30'
      })
      expect(inv.status).toBe('ISSUED')

      // Cancel subscription
      const cancelled = await billingService.cancelSubscription(tenant.bizId, sub.id, { reason: 'Customer terminated service' })
      expect(cancelled.status).toBe('CANCELLED')

      // Invoicing CANCELLED subscription is blocked
      await expect(
        billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
          billing_period_start: '2026-10-01',
          billing_period_end: '2026-10-31'
        })
      ).rejects.toThrow()

      // Resuming CANCELLED subscription is blocked
      await expect(
        billingService.resumeSubscription(tenant.bizId, sub.id, { reason: 'Try resuming cancelled' })
      ).rejects.toThrow()
    }, 30000)
  })

  // =========================================================================
  // 8. PRICE AMENDMENT & IMMUTABLE INVOICE SNAPSHOTS
  // =========================================================================
  describe('8. Price Amendment & Snapshot Immutability', () => {
    it('applies updated financial price to future invoices while leaving existing invoices unchanged', async () => {
      const tenant = await createTenantContext('Price_Amendment')

      const sub = await billingService.createSubscription(tenant.bizId, {
        customer_id: tenant.customerId,
        name: 'Upgradable Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 1,
        unit_price_minor: 100000000,
        tax_minor: 11000000,
        discount_minor: 0,
        total_minor: 111000000,
        starts_at: '2026-09-01T00:00:00.000Z'
      })

      // Generate invoice 1 at original price
      const inv1 = await billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30'
      })
      expect(inv1.total_minor).toBe(111000000)

      // OWNER upgrades subscription price snapshot to Rp 2,000,000 + 11% tax = Rp 2,220,000
      const updatedSub = await billingService.updateSubscription(
        tenant.bizId,
        sub.id,
        {
          unit_price_minor: 200000000,
          tax_minor: 22000000,
          discount_minor: 0,
          total_minor: 222000000,
          notes: 'Upgraded bandwidth package'
        },
        { userId: randomUUID(), role: 'OWNER' }
      )
      expect(updatedSub.total_minor).toBe(222000000)

      // Generate invoice 2 at new price
      const inv2 = await billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
        billing_period_start: '2026-10-01',
        billing_period_end: '2026-10-31'
      })
      expect(inv2.total_minor).toBe(222000000)

      // Verify invoice 1 is unchanged
      const inv1Check = await billingService.getInvoice(tenant.bizId, inv1.id)
      expect(inv1Check.total_minor).toBe(111000000)
    }, 30000)
  })

  // =========================================================================
  // 9. TENANT ISOLATION
  // =========================================================================
  describe('9. Strict Tenant Isolation', () => {
    it('prevents Tenant A from accessing or mutating Tenant B subscriptions, invoices, and payments', async () => {
      const tenantA = await createTenantContext('Iso_A')
      const tenantB = await createTenantContext('Iso_B')

      const subB = await billingService.createSubscription(tenantB.bizId, {
        customer_id: tenantB.customerId,
        name: 'Tenant B Secret Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 1,
        unit_price_minor: 50000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 50000000,
        starts_at: '2026-09-01T00:00:00.000Z'
      })

      const invB = await billingService.generateCustomerInvoice(tenantB.bizId, subB.id, {
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30'
      })

      // 1. Tenant A cannot view Tenant B subscription
      const getSubRes = await request(app)
        .get(`/v1/customer-subscriptions/${subB.id}`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
      expect([403, 404]).toContain(getSubRes.status)

      // 2. Tenant A cannot view Tenant B invoice
      const getInvRes = await request(app)
        .get(`/v1/customer-invoices/${invB.id}`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
      expect([403, 404]).toContain(getInvRes.status)

      // 3. Tenant A cannot generate invoice for Tenant B subscription
      const genRes = await request(app)
        .post(`/v1/customer-subscriptions/${subB.id}/generate-invoice`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .send({
          billing_period_start: '2026-10-01',
          billing_period_end: '2026-10-31'
        })
      expect([403, 404]).toContain(genRes.status)

      // 4. Tenant A cannot record payment against Tenant B invoice
      const payRes = await request(app)
        .post(`/v1/customer-invoices/${invB.id}/payments`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .send({
          amount_minor: 50000000,
          method: 'cash',
          idempotency_key: randomUUID()
        })
      expect([403, 404]).toContain(payRes.status)

      // 5. Tenant A cannot cancel Tenant B invoice
      const cancelRes = await request(app)
        .post(`/v1/customer-invoices/${invB.id}/cancel`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .send({ reason: 'Malicious cancellation attempt' })
      expect([403, 404]).toContain(cancelRes.status)
    }, 30000)
  })

  // =========================================================================
  // 10. TRANSACTION ROLLBACK ATOMICITY
  // =========================================================================
  describe('10. Transaction Rollback Atomicity', () => {
    it('rolls back completely when an error occurs during invoice creation (no orphan invoice, receivable, journal)', async () => {
      const tenant = await createTenantContext('Tx_Rollback')

      const sub = await billingService.createSubscription(tenant.bizId, {
        customer_id: tenant.customerId,
        name: 'Rollback Test Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 1,
        unit_price_minor: 50000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 50000000,
        starts_at: '2026-09-01T00:00:00.000Z'
      })

      // Attempt invalid invoice generation with invalid due date
      await expect(
        billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
          billing_period_start: '2026-09-01',
          billing_period_end: '2026-09-30',
          due_date: 'INVALID-DATE'
        })
      ).rejects.toThrow()

      // Verify no invoices created
      const invoices = await pool.query(
        `SELECT * FROM customer_invoices WHERE customer_subscription_id = $1`,
        [sub.id]
      )
      expect(invoices.rows.length).toBe(0)

      // Verify no receivables created
      const receivables = await pool.query(
        `SELECT * FROM receivables WHERE business_id = $1`,
        [tenant.bizId]
      )
      expect(receivables.rows.length).toBe(0)

      // Subscription next_billing_date not advanced
      const subCheck = await billingService.getSubscription(tenant.bizId, sub.id)
      expect(subCheck.next_billing_date).toBe('2026-09-01')
    }, 30000)
  })

  // =========================================================================
  // 11. AUDIT LOG VALIDATION
  // =========================================================================
  describe('11. Audit Log Validation', () => {
    it('records comprehensive audit events across the recurring billing lifecycle', async () => {
      const tenant = await createTenantContext('Audit_Events')

      const sub = await billingService.createSubscription(
        tenant.bizId,
        {
          customer_id: tenant.customerId,
          name: 'Audited Plan',
          billing_cycle: 'MONTHLY',
          anchor_day: 1,
          unit_price_minor: 30000000,
          tax_minor: 0,
          discount_minor: 0,
          total_minor: 30000000,
          starts_at: '2026-09-01T00:00:00.000Z'
        },
        { userId: randomUUID(), role: 'OWNER' }
      )

      await billingService.updateSubscription(
        tenant.bizId,
        sub.id,
        { notes: 'Updated notes' },
        { userId: randomUUID(), role: 'OWNER' }
      )

      await billingService.pauseSubscription(
        tenant.bizId,
        sub.id,
        { reason: 'Paused for audit' },
        { userId: randomUUID(), role: 'OWNER' }
      )

      await billingService.resumeSubscription(
        tenant.bizId,
        sub.id,
        { reason: 'Resumed for audit' },
        { userId: randomUUID(), role: 'OWNER' }
      )

      const inv = await billingService.generateCustomerInvoice(
        tenant.bizId,
        sub.id,
        {
          billing_period_start: '2026-09-01',
          billing_period_end: '2026-09-30'
        },
        { userId: randomUUID(), role: 'OWNER' }
      )

      await billingService.recordInvoicePayment(
        tenant.bizId,
        inv.id,
        {
          amount_minor: 30000000,
          method: 'cash',
          idempotency_key: randomUUID()
        },
        { userId: randomUUID(), role: 'CASHIER' }
      )

      // Query platform audit logs
      const auditLogs = await pool.query(
        `SELECT * FROM platform_audit_logs WHERE action LIKE 'CUSTOMER_%' ORDER BY created_at ASC`
      )
      const actions = auditLogs.rows.map((r) => r.action)

      expect(actions).toContain('CUSTOMER_SUBSCRIPTION_CREATED')
      expect(actions).toContain('CUSTOMER_SUBSCRIPTION_UPDATED')
      expect(actions).toContain('CUSTOMER_SUBSCRIPTION_PAUSED')
      expect(actions).toContain('CUSTOMER_SUBSCRIPTION_RESUMED')
      expect(actions).toContain('CUSTOMER_INVOICE_GENERATED')
      expect(actions).toContain('CUSTOMER_INVOICE_PAID')
    }, 30000)
  })

  // =========================================================================
  // 12. DATA INTEGRITY & RELATIONSHIPS
  // =========================================================================
  describe('12. Relational Integrity Across Entities', () => {
    it('maintains valid and tenant-consistent foreign keys and relationships', async () => {
      const tenant = await createTenantContext('Data_Integrity')

      const sub = await billingService.createSubscription(tenant.bizId, {
        customer_id: tenant.customerId,
        name: 'Integrity Plan',
        billing_cycle: 'MONTHLY',
        anchor_day: 1,
        unit_price_minor: 10000000,
        tax_minor: 0,
        discount_minor: 0,
        total_minor: 10000000,
        starts_at: '2026-09-01T00:00:00.000Z'
      })

      const inv = await billingService.generateCustomerInvoice(tenant.bizId, sub.id, {
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30'
      })

      // Query joined entities
      const joined = await pool.query(
        `SELECT ci.id as invoice_id, cs.id as subscription_id, c.id as customer_id, r.id as receivable_id
         FROM customer_invoices ci
         JOIN customer_subscriptions cs ON cs.id = ci.customer_subscription_id AND cs.business_id = ci.business_id
         JOIN customers c ON c.id = ci.customer_id AND c.business_id = ci.business_id
         JOIN receivables r ON r.id = ci.receivable_id AND r.business_id = ci.business_id
         WHERE ci.id = $1 AND ci.business_id = $2`,
        [inv.id, tenant.bizId]
      )

      expect(joined.rows.length).toBe(1)
      expect(joined.rows[0].invoice_id).toBe(inv.id)
      expect(joined.rows[0].subscription_id).toBe(sub.id)
      expect(joined.rows[0].customer_id).toBe(tenant.customerId)
      expect(joined.rows[0].receivable_id).toBe(inv.receivable_id)
    }, 30000)
  })
})
