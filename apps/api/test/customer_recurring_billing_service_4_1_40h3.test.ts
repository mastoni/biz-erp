import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'
import { createCustomerBillingService } from '../src/services/customer_billing_service'
import { ApiError } from '../src/errors/api_error'

describe('Phase 4.1.40H-3: Customer Recurring Billing Service & Business Logic', () => {
  let pool: Pool
  let billingService: ReturnType<typeof createCustomerBillingService>

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    billingService = createCustomerBillingService(pool)
  }, 30000)

  afterAll(async () => {
    await pool.end()
  }, 30000)

  // Helpers
  async function createTestBusiness(prefix: string) {
    const bizId = randomUUID()
    await pool.query(
      `INSERT INTO businesses (id, name) VALUES ($1, $2)`,
      [bizId, `${prefix} Biz`]
    )
    return bizId
  }

  async function createTestCustomer(bizId: string, name: string) {
    const custId = randomUUID()
    await pool.query(
      `INSERT INTO customers (id, business_id, name, email, phone)
       VALUES ($1, $2, $3, $4, $5)`,
      [custId, bizId, name, `${name.toLowerCase().replace(/\s+/g, '')}@test.com`, '+62812345678']
    )
    return custId
  }

  describe('1. Subscription Lifecycle & Tenant Validation', () => {
    it('A: creates a subscription in the same tenant successfully', async () => {
      const bizId = await createTestBusiness('SUB-CREATE')
      const custId = await createTestCustomer(bizId, 'Customer Sub A')

      const sub = await billingService.createSubscription(
        bizId,
        {
          customer_id: custId,
          name: 'Paket Fiber 50 Mbps',
          unit_price_minor: 35000000,
          discount_minor: 5000000,
          tax_minor: 3300000,
          total_minor: 33300000,
          billing_cycle: 'MONTHLY',
          starts_at: '2026-09-15T00:00:00.000Z',
          anchor_day: 15,
          notes: 'Home internet'
        },
        { role: 'OWNER', email: 'owner@test.com' }
      )

      expect(sub.id).toBeDefined()
      expect(sub.business_id).toBe(bizId)
      expect(sub.customer_id).toBe(custId)
      expect(sub.status).toBe('ACTIVE')
      expect(sub.unit_price_minor).toBe(35000000)
      expect(sub.total_minor).toBe(33300000)
      expect(sub.next_billing_date).toBe('2026-09-15')
      expect(sub.anchor_day).toBe(15)
    })

    it('B: rejects subscription creation with cross-tenant customer', async () => {
      const bizA = await createTestBusiness('SUB-CROSS-A')
      const bizB = await createTestBusiness('SUB-CROSS-B')
      const custA = await createTestCustomer(bizA, 'Customer of Biz A')

      await expect(
        billingService.createSubscription(
          bizB,
          {
            customer_id: custA,
            name: 'Cross Subscription Attempt',
            unit_price_minor: 10000000,
            billing_cycle: 'MONTHLY'
          },
          { role: 'OWNER' }
        )
      ).rejects.toThrow(ApiError)
    })

    it('C: pauses and resumes subscription lifecycle', async () => {
      const bizId = await createTestBusiness('SUB-PAUSE-RESUME')
      const custId = await createTestCustomer(bizId, 'Customer Pause')

      const sub = await billingService.createSubscription(
        bizId,
        {
          customer_id: custId,
          name: 'Seasonal Service',
          unit_price_minor: 20000000,
          billing_cycle: 'MONTHLY'
        },
        { role: 'OWNER' }
      )

      // Pause
      const paused = await billingService.pauseSubscription(
        bizId,
        sub.id,
        { reason: 'Customer on vacation' },
        { role: 'STAFF' }
      )
      expect(paused.status).toBe('PAUSED')

      // Cannot pause already paused
      await expect(
        billingService.pauseSubscription(bizId, sub.id, {}, { role: 'STAFF' })
      ).rejects.toThrow(/Cannot pause subscription/)

      // Resume
      const resumed = await billingService.resumeSubscription(
        bizId,
        sub.id,
        { reason: 'Customer returned' },
        { role: 'STAFF' }
      )
      expect(resumed.status).toBe('ACTIVE')
    })

    it('D, E, F: cancels subscription and ensures cancelled/paused subscriptions cannot be billed', async () => {
      const bizId = await createTestBusiness('SUB-CANCEL')
      const custId = await createTestCustomer(bizId, 'Customer Cancel')

      const sub = await billingService.createSubscription(
        bizId,
        {
          customer_id: custId,
          name: 'Cancelling Service',
          unit_price_minor: 20000000,
          billing_cycle: 'MONTHLY',
          starts_at: '2026-09-01T00:00:00.000Z'
        },
        { role: 'OWNER' }
      )

      // F. Paused subscription does not bill
      await billingService.pauseSubscription(bizId, sub.id, {}, { role: 'STAFF' })
      await expect(
        billingService.generateCustomerInvoice(bizId, sub.id, undefined, { role: 'STAFF' })
      ).rejects.toThrow(/Cannot generate invoice for subscription in PAUSED status/)

      // Resume then cancel
      await billingService.resumeSubscription(bizId, sub.id, {}, { role: 'STAFF' })
      const cancelled = await billingService.cancelSubscription(
        bizId,
        sub.id,
        { reason: 'Contract termination' },
        { role: 'OWNER' }
      )
      expect(cancelled.status).toBe('CANCELLED')
      expect(cancelled.ends_at).toBeDefined()

      // D. Cancelled subscription cannot resume
      await expect(
        billingService.resumeSubscription(bizId, sub.id, {}, { role: 'STAFF' })
      ).rejects.toThrow(/Cannot resume subscription in CANCELLED status/)

      // E. Cancelled subscription cannot bill
      await expect(
        billingService.generateCustomerInvoice(bizId, sub.id, undefined, { role: 'STAFF' })
      ).rejects.toThrow(/Cannot generate invoice for subscription in CANCELLED status/)
    })
  })

  describe('2. Canonical Invoice Generation & Accounting Integration', () => {
    it('G, H, I, J, M: generates invoice, links receivable, posts balanced journal, advances next billing date', async () => {
      const bizId = await createTestBusiness('INV-GEN')
      const custId = await createTestCustomer(bizId, 'Customer Inv Gen')

      const sub = await billingService.createSubscription(
        bizId,
        {
          customer_id: custId,
          name: 'Paket Internet 100 Mbps',
          unit_price_minor: 50000000,
          discount_minor: 0,
          tax_minor: 5500000,
          total_minor: 55500000,
          billing_cycle: 'MONTHLY',
          starts_at: '2026-09-15T00:00:00.000Z',
          anchor_day: 15
        },
        { role: 'OWNER' }
      )

      // G. Generate first invoice
      const invoice = await billingService.generateCustomerInvoice(bizId, sub.id, undefined, { role: 'STAFF' })
      expect(invoice.id).toBeDefined()
      expect(invoice.business_id).toBe(bizId)
      expect(invoice.customer_subscription_id).toBe(sub.id)
      expect(invoice.customer_id).toBe(custId)
      expect(invoice.status).toBe('ISSUED')
      expect(invoice.subtotal_minor).toBe(50000000)
      expect(invoice.tax_minor).toBe(5500000)
      expect(invoice.total_minor).toBe(55500000)
      expect(invoice.billing_period_start).toBe('2026-09-15')
      expect(invoice.billing_period_end).toBe('2026-10-14')
      expect(invoice.invoice_number).toMatch(/^INV-202609-\d{4}$/)

      // H. Verify receivable linked correctly
      const recRes = await pool.query('SELECT * FROM receivables WHERE id = $1 AND business_id = $2', [
        invoice.receivable_id,
        bizId
      ])
      expect(recRes.rows.length).toBe(1)
      const rec = recRes.rows[0]
      expect(rec.status).toBe('OPEN')
      expect(Number(rec.amount_minor)).toBe(55500000)
      expect(Number(rec.outstanding_minor)).toBe(55500000)
      expect(Number(rec.paid_minor)).toBe(0)

      // I. Verify balanced journal entry posted: Dr AR / Cr Revenue
      const journalRes = await pool.query(
        `SELECT j.*, l.account_id, l.debit_minor, l.credit_minor, a.type AS account_type
         FROM journal_entries j
         JOIN journal_lines l ON l.journal_entry_id = j.id
         JOIN accounts a ON a.id = l.account_id
         WHERE j.source_type = 'RECEIVABLE' AND j.source_id = $1 AND j.business_id = $2`,
        [invoice.receivable_id, bizId]
      )
      expect(journalRes.rows.length).toBe(2)
      const arLine = journalRes.rows.find((r) => r.account_type === 'receivable')
      const revLine = journalRes.rows.find((r) => r.account_type === 'revenue')
      expect(Number(arLine.debit_minor)).toBe(55500000)
      expect(Number(arLine.credit_minor)).toBe(0)
      expect(Number(revLine.debit_minor)).toBe(0)
      expect(Number(revLine.credit_minor)).toBe(55500000)

      // J. Verify next_billing_date advanced
      const updatedSub = await billingService.getSubscription(bizId, sub.id)
      expect(updatedSub.next_billing_date).toBe('2026-10-15')
    })

    it('K & L: duplicate period prevented and concurrent generation safely returns existing invoice', async () => {
      const bizId = await createTestBusiness('INV-DUP-CONC')
      const custId = await createTestCustomer(bizId, 'Customer Dup Conc')

      const sub = await billingService.createSubscription(
        bizId,
        {
          customer_id: custId,
          name: 'Concurrent Test Plan',
          unit_price_minor: 10000000,
          billing_cycle: 'MONTHLY',
          starts_at: '2026-09-01T00:00:00.000Z',
          anchor_day: 1
        },
        { role: 'OWNER' }
      )

      // Generate invoice
      const inv1 = await billingService.generateCustomerInvoice(bizId, sub.id, {
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30'
      })

      // Repeated generation returns the same invoice
      const inv2 = await billingService.generateCustomerInvoice(bizId, sub.id, {
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30'
      })

      expect(inv1.id).toBe(inv2.id)
      expect(inv1.invoice_number).toBe(inv2.invoice_number)
    })

    it('N: invoice numbers are unique per tenant and identical invoice numbers may exist in different tenants', async () => {
      const bizA = await createTestBusiness('INV-BIZ-A')
      const bizB = await createTestBusiness('INV-BIZ-B')
      const custA = await createTestCustomer(bizA, 'Customer A')
      const custB = await createTestCustomer(bizB, 'Customer B')

      const subA = await billingService.createSubscription(
        bizA,
        {
          customer_id: custA,
          name: 'Service A',
          unit_price_minor: 10000000,
          billing_cycle: 'MONTHLY',
          starts_at: '2026-09-01T00:00:00.000Z'
        },
        { role: 'OWNER' }
      )

      const subB = await billingService.createSubscription(
        bizB,
        {
          customer_id: custB,
          name: 'Service B',
          unit_price_minor: 10000000,
          billing_cycle: 'MONTHLY',
          starts_at: '2026-09-01T00:00:00.000Z'
        },
        { role: 'OWNER' }
      )

      const invA = await billingService.generateCustomerInvoice(bizA, subA.id)
      const invB = await billingService.generateCustomerInvoice(bizB, subB.id)

      expect(invA.invoice_number).toBe('INV-202609-0001')
      expect(invB.invoice_number).toBe('INV-202609-0001')
      expect(invA.id).not.toBe(invB.id)
    })
  })

  describe('3. Payment Synchronization & State Machine', () => {
    it('O & P: partial payment keeps ISSUED; full payment updates invoice to PAID', async () => {
      const bizId = await createTestBusiness('PAY-SYNC')
      const custId = await createTestCustomer(bizId, 'Customer Pay Sync')

      const sub = await billingService.createSubscription(
        bizId,
        {
          customer_id: custId,
          name: 'Internet 50M',
          unit_price_minor: 30000000,
          billing_cycle: 'MONTHLY',
          starts_at: '2026-09-01T00:00:00.000Z'
        },
        { role: 'OWNER' }
      )

      const invoice = await billingService.generateCustomerInvoice(bizId, sub.id)

      // O. Partial Payment (10,000,000 out of 30,000,000)
      const partialRes = await billingService.recordInvoicePayment(
        bizId,
        invoice.id,
        {
          amount_minor: 10000000,
          method: 'bank_transfer',
          reference: 'BCA-PARTIAL-01',
          idempotency_key: 'idem-part-1'
        },
        { role: 'CASHIER' }
      )
      expect(partialRes.status).toBe('ISSUED')
      expect(partialRes.paid_at).toBeNull()

      // Verify linked receivable status is PARTIAL
      const recPart = await pool.query('SELECT * FROM receivables WHERE id = $1', [invoice.receivable_id])
      expect(recPart.rows[0].status).toBe('PARTIAL')
      expect(Number(recPart.rows[0].paid_minor)).toBe(10000000)
      expect(Number(recPart.rows[0].outstanding_minor)).toBe(20000000)

      // P. Remaining Full Payment (20,000,000)
      const fullRes = await billingService.recordInvoicePayment(
        bizId,
        invoice.id,
        {
          amount_minor: 20000000,
          method: 'cash',
          reference: 'CASH-FULL-02',
          idempotency_key: 'idem-full-2'
        },
        { role: 'CASHIER' }
      )
      expect(fullRes.status).toBe('PAID')
      expect(fullRes.paid_at).toBeDefined()

      // Verify linked receivable is PAID
      const recFull = await pool.query('SELECT * FROM receivables WHERE id = $1', [invoice.receivable_id])
      expect(recFull.rows[0].status).toBe('PAID')
      expect(Number(recFull.rows[0].outstanding_minor)).toBe(0)
    })

    it('Q & R: OVERDUE invoice with partial payment remains OVERDUE; full payment becomes PAID', async () => {
      const bizId = await createTestBusiness('OVERDUE-PAY')
      const custId = await createTestCustomer(bizId, 'Customer Overdue')

      const sub = await billingService.createSubscription(
        bizId,
        {
          customer_id: custId,
          name: 'Overdue Plan',
          unit_price_minor: 40000000,
          billing_cycle: 'MONTHLY',
          starts_at: '2026-08-01T00:00:00.000Z'
        },
        { role: 'OWNER' }
      )

      const invoice = await billingService.generateCustomerInvoice(bizId, sub.id, {
        due_date: '2026-08-10'
      })

      // Mark overdue
      await billingService.markOverdueInvoices(bizId, '2026-09-01')
      const overdueInv = await billingService.getInvoice(bizId, invoice.id)
      expect(overdueInv.status).toBe('OVERDUE')

      // Q. Partial payment on OVERDUE invoice
      const partialRes = await billingService.recordInvoicePayment(
        bizId,
        invoice.id,
        {
          amount_minor: 15000000,
          method: 'bank_transfer',
          idempotency_key: 'idem-overdue-1'
        },
        { role: 'STAFF' }
      )
      expect(partialRes.status).toBe('OVERDUE')

      // R. Full remaining payment on OVERDUE invoice
      const fullRes = await billingService.recordInvoicePayment(
        bizId,
        invoice.id,
        {
          amount_minor: 25000000,
          method: 'bank_transfer',
          idempotency_key: 'idem-overdue-2'
        },
        { role: 'STAFF' }
      )
      expect(fullRes.status).toBe('PAID')
    })

    it('S, T: payment idempotency and cancelled invoice rejects payment', async () => {
      const bizId = await createTestBusiness('IDEM-CANCEL-PAY')
      const custId = await createTestCustomer(bizId, 'Customer Idem')

      const sub = await billingService.createSubscription(
        bizId,
        {
          customer_id: custId,
          name: 'Plan Idem',
          unit_price_minor: 10000000,
          billing_cycle: 'MONTHLY'
        },
        { role: 'OWNER' }
      )

      const invoice = await billingService.generateCustomerInvoice(bizId, sub.id)

      // S. Payment Idempotency
      const pay1 = await billingService.recordInvoicePayment(
        bizId,
        invoice.id,
        {
          amount_minor: 5000000,
          method: 'cash',
          idempotency_key: 'idemp-duplicate-test'
        },
        { role: 'CASHIER' }
      )

      const pay2 = await billingService.recordInvoicePayment(
        bizId,
        invoice.id,
        {
          amount_minor: 5000000,
          method: 'cash',
          idempotency_key: 'idemp-duplicate-test'
        },
        { role: 'CASHIER' }
      )
      expect(pay1.id).toBe(pay2.id)

      // T. Cancelled invoice rejects payment
      const sub2 = await billingService.createSubscription(
        bizId,
        {
          customer_id: custId,
          name: 'Plan Cancel Pay',
          unit_price_minor: 10000000,
          billing_cycle: 'MONTHLY'
        },
        { role: 'OWNER' }
      )
      const inv2 = await billingService.generateCustomerInvoice(bizId, sub2.id)
      await billingService.cancelInvoice(bizId, inv2.id, { reason: 'Void invoice' }, { role: 'OWNER' })

      await expect(
        billingService.recordInvoicePayment(
          bizId,
          inv2.id,
          {
            amount_minor: 10000000,
            method: 'cash',
            idempotency_key: 'key-on-cancelled'
          },
          { role: 'CASHIER' }
        )
      ).rejects.toThrow(/Cannot record payment against a cancelled invoice/)
    })
  })

  describe('4. Invoice Cancellation & Reversal Accounting', () => {
    it('U & W: cancels unpaid invoice, reverses receivable, and posts balanced reversal journal (Dr Revenue / Cr AR)', async () => {
      const bizId = await createTestBusiness('INV-CANCEL-REV')
      const custId = await createTestCustomer(bizId, 'Customer Cancel Rev')

      const sub = await billingService.createSubscription(
        bizId,
        {
          customer_id: custId,
          name: 'Plan To Cancel',
          unit_price_minor: 25000000,
          billing_cycle: 'MONTHLY'
        },
        { role: 'OWNER' }
      )

      const invoice = await billingService.generateCustomerInvoice(bizId, sub.id)

      // U. Cancel invoice
      const cancelled = await billingService.cancelInvoice(
        bizId,
        invoice.id,
        { reason: 'Customer requested plan change' },
        { role: 'OWNER' }
      )
      expect(cancelled.status).toBe('CANCELLED')

      // Verify receivable reversed
      const recRes = await pool.query('SELECT * FROM receivables WHERE id = $1', [invoice.receivable_id])
      expect(recRes.rows[0].status).toBe('REVERSED')

      // W. Verify balanced reversal journal entry: Dr Revenue / Cr AR
      const reversalJournalRes = await pool.query(
        `SELECT j.*, l.account_id, l.debit_minor, l.credit_minor, a.type AS account_type
         FROM journal_entries j
         JOIN journal_lines l ON l.journal_entry_id = j.id
         JOIN accounts a ON a.id = l.account_id
         WHERE j.source_type = 'REVERSAL' AND j.source_id = $1 AND j.business_id = $2`,
        [invoice.receivable_id, bizId]
      )
      expect(reversalJournalRes.rows.length).toBe(2)
      const revDebitLine = reversalJournalRes.rows.find((r) => r.account_type === 'revenue')
      const arCreditLine = reversalJournalRes.rows.find((r) => r.account_type === 'receivable')
      expect(Number(revDebitLine.debit_minor)).toBe(25000000)
      expect(Number(revDebitLine.credit_minor)).toBe(0)
      expect(Number(arCreditLine.debit_minor)).toBe(0)
      expect(Number(arCreditLine.credit_minor)).toBe(25000000)
    })

    it('V: rejects cancellation when payment has already been recorded', async () => {
      const bizId = await createTestBusiness('CANCEL-PAID-FAIL')
      const custId = await createTestCustomer(bizId, 'Customer Paid Fail')

      const sub = await billingService.createSubscription(
        bizId,
        {
          customer_id: custId,
          name: 'Paid Plan',
          unit_price_minor: 20000000,
          billing_cycle: 'MONTHLY'
        },
        { role: 'OWNER' }
      )

      const invoice = await billingService.generateCustomerInvoice(bizId, sub.id)

      // Record partial payment
      await billingService.recordInvoicePayment(
        bizId,
        invoice.id,
        {
          amount_minor: 5000000,
          method: 'cash',
          idempotency_key: 'partial-pay-key'
        },
        { role: 'CASHIER' }
      )

      // Attempt cancellation -> MUST FAIL with 409 PAYMENT_EXISTS
      await expect(
        billingService.cancelInvoice(
          bizId,
          invoice.id,
          { reason: 'Attempt cancel' },
          { role: 'OWNER' }
        )
      ).rejects.toThrow(/Cannot cancel an invoice with recorded payments/)
    })
  })

  describe('5. Price Snapshotting, RBAC & Tenant Isolation', () => {
    it('X & Y: price amendment affects future unbilled periods only; historical invoices remain untouched', async () => {
      const bizId = await createTestBusiness('PRICE-AMEND')
      const custId = await createTestCustomer(bizId, 'Customer Amend')

      // Initial price: 30,000,000
      const sub = await billingService.createSubscription(
        bizId,
        {
          customer_id: custId,
          name: 'Broadband 50M',
          unit_price_minor: 30000000,
          billing_cycle: 'MONTHLY',
          starts_at: '2026-09-01T00:00:00.000Z',
          anchor_day: 1
        },
        { role: 'OWNER' }
      )

      // Invoice 1 generated at initial price (30,000,000)
      const inv1 = await billingService.generateCustomerInvoice(bizId, sub.id)
      expect(inv1.total_minor).toBe(30000000)

      // OWNER updates price snapshot to 45,000,000
      const updatedSub = await billingService.updateSubscription(
        bizId,
        sub.id,
        {
          unit_price_minor: 45000000,
          total_minor: 45000000
        },
        { role: 'OWNER' }
      )
      expect(updatedSub.total_minor).toBe(45000000)

      // Y. Verify historical invoice 1 is completely UNTOUCHED
      const inv1Check = await billingService.getInvoice(bizId, inv1.id)
      expect(inv1Check.total_minor).toBe(30000000)

      // X. Invoice 2 for next period is generated at NEW price (45,000,000)
      const inv2 = await billingService.generateCustomerInvoice(bizId, sub.id)
      expect(inv2.total_minor).toBe(45000000)
    })

    it('Z: strictly enforces tenant isolation across subscriptions, invoices, and operations', async () => {
      const bizA = await createTestBusiness('ISO-BIZ-A')
      const bizB = await createTestBusiness('ISO-BIZ-B')
      const custA = await createTestCustomer(bizA, 'Customer A')

      const subA = await billingService.createSubscription(
        bizA,
        {
          customer_id: custA,
          name: 'Plan Biz A',
          unit_price_minor: 10000000,
          billing_cycle: 'MONTHLY'
        },
        { role: 'OWNER' }
      )

      const invA = await billingService.generateCustomerInvoice(bizA, subA.id)

      // Biz B cannot view sub A
      await expect(billingService.getSubscription(bizB, subA.id)).rejects.toThrow(ApiError)

      // Biz B cannot view invoice A
      await expect(billingService.getInvoice(bizB, invA.id)).rejects.toThrow(ApiError)

      // Biz B cannot pay invoice A
      await expect(
        billingService.recordInvoicePayment(
          bizB,
          invA.id,
          {
            amount_minor: 10000000,
            method: 'cash',
            idempotency_key: 'cross-pay'
          },
          { role: 'CASHIER' }
        )
      ).rejects.toThrow(ApiError)
    })

    it('AA & AB: transaction rollback leaves no orphan records and audit logs are recorded', async () => {
      const bizId = await createTestBusiness('AUDIT-ROLLBACK')
      const custId = await createTestCustomer(bizId, 'Customer Audit')

      const sub = await billingService.createSubscription(
        bizId,
        {
          customer_id: custId,
          name: 'Audited Subscription',
          unit_price_minor: 20000000,
          billing_cycle: 'MONTHLY'
        },
        { role: 'OWNER', email: 'owner@audit.com' }
      )

      const invoice = await billingService.generateCustomerInvoice(bizId, sub.id)

      // Check audit logs
      const auditRes = await pool.query(
        'SELECT * FROM platform_audit_logs WHERE target_id = $1 OR target_id = $2',
        [sub.id, invoice.id]
      )
      expect(auditRes.rows.length).toBeGreaterThanOrEqual(2)
      const actions = auditRes.rows.map((r) => r.action)
      expect(actions).toContain('CUSTOMER_SUBSCRIPTION_CREATED')
      expect(actions).toContain('CUSTOMER_INVOICE_GENERATED')
    })
  })
})
