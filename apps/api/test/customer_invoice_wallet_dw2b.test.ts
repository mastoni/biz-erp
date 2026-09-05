import path from 'path'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createJwtService, JwtService } from '../src/services/jwt_service'
import { seedTestUser } from './auth_helper'
import { accountRepository } from '../src/repositories/account_repository'

let pool: Pool
let app: ReturnType<typeof createApp>
let jwtService: JwtService

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
}, 30000)

afterAll(async () => {
  await pool.end()
}, 30000)

interface TestContext {
  businessId: string
  accountCustomerId: string
  walletId: string
  customerId: string
  subscriptionId: string
  ownerToken: string
  staffToken: string
  cashierToken: string
  customerToken: string
  customerUserId: string
  superAdminToken: string
}

async function createTestContext(prefix = 'DW2B'): Promise<TestContext> {
  const businessId = randomUUID()
  const accountCustomerId = randomUUID()
  const walletId = randomUUID()
  const customerId = randomUUID()
  const subscriptionId = randomUUID()

  // 1. Account Customer
  await pool.query(
    `INSERT INTO account_customers (id, code, name, account_type, status)
     VALUES ($1, $2, '${prefix} Account Customer', 'BUSINESS', 'ACTIVE')`,
    [accountCustomerId, `ACC-${prefix}-${randomUUID().substring(0, 8)}`]
  )

  // 2. Business
  await pool.query(
    `INSERT INTO businesses (id, name, status, account_customer_id)
     VALUES ($1, '${prefix} Corp', 'ACTIVE', $2)`,
    [businessId, accountCustomerId]
  )

  // 3. Accounts
  const client = await pool.connect()
  try {
    await accountRepository.createDefaultAccounts(client, businessId)
  } finally {
    client.release()
  }

  // 4. Users
  const ownerUser = await seedTestUser(pool, businessId, { role: 'OWNER' })
  const ownerToken = jwtService.signAccessToken({
    sub: ownerUser.userId,
    business_id: businessId,
    role: 'OWNER',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  const staffUser = await seedTestUser(pool, businessId, { role: 'CASHIER' })
  const staffToken = jwtService.signAccessToken({
    sub: staffUser.userId,
    business_id: businessId,
    role: 'STAFF',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  const cashierUser = await seedTestUser(pool, businessId, { role: 'CASHIER' })
  const cashierToken = jwtService.signAccessToken({
    sub: cashierUser.userId,
    business_id: businessId,
    role: 'CASHIER',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  const superAdminUser = await seedTestUser(pool, businessId, { role: 'OWNER' })
  const superAdminToken = jwtService.signAccessToken({
    sub: superAdminUser.userId,
    scope: 'platform',
    role: 'SUPER_ADMIN',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  // 5. Customer user
  const custUser = await seedTestUser(pool, businessId, { role: 'CASHIER' })
  const customerUserId = custUser.userId
  await pool.query(
    `INSERT INTO account_customer_users (account_customer_id, user_id, role, status)
     VALUES ($1, $2, 'PRIMARY_CONTACT', 'ACTIVE')`,
    [accountCustomerId, customerUserId]
  )
  const customerToken = jwtService.signAccessToken({
    sub: customerUserId,
    business_id: businessId,
    role: 'CUSTOMER',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  // 6. Wallet
  await pool.query(
    `INSERT INTO wallet_accounts (id, account_customer_id, business_id, wallet_number, currency, status, balance)
     VALUES ($1, $2, $3, $4, 'IDR', 'ACTIVE', 5000000)`,
    [walletId, accountCustomerId, businessId, `WAL-${prefix}-${randomUUID().substring(0, 8)}`]
  )

  // 7. Customer & Subscription
  await pool.query(
    `INSERT INTO customers (id, business_id, name, email)
     VALUES ($1, $2, '${prefix} Customer', '${prefix.toLowerCase()}@test.com')`,
    [customerId, businessId]
  )

  await pool.query(
    `INSERT INTO customer_subscriptions (
       id, business_id, customer_id, name, unit_price_minor, discount_minor, tax_minor, total_minor,
       currency, billing_cycle, status, next_billing_date, anchor_day
     ) VALUES (
       $1, $2, $3, 'Fiber 100Mbps', 300000, 0, 0, 300000, 'IDR', 'MONTHLY', 'ACTIVE', '2026-10-01', 1
     )`,
    [subscriptionId, businessId, customerId]
  )

  return {
    businessId,
    accountCustomerId,
    walletId,
    customerId,
    subscriptionId,
    ownerToken,
    staffToken,
    cashierToken,
    customerToken,
    customerUserId,
    superAdminToken
  }
}

async function helperCreateInvoice(
  businessId: string,
  custId: string,
  subId: string,
  amountMinor = 300000
): Promise<{ invoiceId: string; receivableId: string; invoiceNumber: string }> {
  const invoiceId = randomUUID()
  const receivableId = randomUUID()
  const invoiceNumber = `INV-${Date.now()}-${randomUUID().substring(0, 4)}`

  await pool.query(
    `INSERT INTO receivables (
       id, business_id, customer_id, amount_minor, paid_minor, outstanding_minor, date, description, status
     ) VALUES (
       $1, $2, $3, $4, 0, $4, CURRENT_DATE, 'Invoice AR', 'OPEN'
     )`,
    [receivableId, businessId, custId, amountMinor]
  )

  await pool.query(
    `INSERT INTO customer_invoices (
       id, invoice_number, business_id, customer_subscription_id, customer_id, receivable_id,
       billing_period_start, billing_period_end, subtotal_minor, discount_minor, tax_minor, total_minor,
       currency, status, issue_date, due_date
     ) VALUES (
       $1, $2, $3, $4, $5, $6, '2026-09-01', '2026-09-30', $7, 0, 0, $7, 'IDR', 'ISSUED', CURRENT_DATE, '2026-09-15'
     )`,
    [invoiceId, invoiceNumber, businessId, subId, custId, receivableId, amountMinor]
  )

  return { invoiceId, receivableId, invoiceNumber }
}

describe('DW-2B — Customer Invoice Digital Wallet Settlement', () => {
  describe('1. Migration 054 & Schema Verification', () => {
    it('verifies customer_payments allows wallet method and wallet_ledgers allows INVOICE_PAYMENT', async () => {
      const ctx = await createTestContext('MIG054')
      const testPaymentId = randomUUID()
      const testRecId = randomUUID()

      await pool.query(
        `INSERT INTO receivables (id, business_id, customer_id, amount_minor, paid_minor, outstanding_minor, date, description, status)
         VALUES ($1, $2, $3, 1000, 0, 1000, CURRENT_DATE, 'Test', 'OPEN')`,
        [testRecId, ctx.businessId, ctx.customerId]
      )

      await expect(
        pool.query(
          `INSERT INTO customer_payments (id, business_id, receivable_id, customer_id, amount_minor, method, idempotency_key)
           VALUES ($1, $2, $3, $4, 1000, 'wallet', $5)`,
          [testPaymentId, ctx.businessId, testRecId, ctx.customerId, randomUUID()]
        )
      ).resolves.toBeDefined()

      await expect(
        pool.query(
          `INSERT INTO wallet_ledgers (
             wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
             currency, reference_type, reference_id, idempotency_key, actor_scope, description
           ) VALUES (
             $1, 'INVOICE_PAYMENT', 'DEBIT', 1000, 5000000, 4999000, 'IDR', 'CUSTOMER_INVOICE', 'INV-1', $2, 'tenant', 'Test Debit'
           )`,
          [ctx.walletId, randomUUID()]
        )
      ).resolves.toBeDefined()
    })
  })

  describe('2. Atomic Digital Wallet Settlement (Owner Flow)', () => {
    it('successfully settles customer invoice via digital wallet, marks invoice PAID, updates receivable and balances ledger', async () => {
      const ctx = await createTestContext('OWNER')
      const { invoiceId, receivableId } = await helperCreateInvoice(ctx.businessId, ctx.customerId, ctx.subscriptionId, 300000)
      const idempotencyKey = randomUUID()

      const res = await request(app)
        .post(`/v1/customer-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${ctx.ownerToken}`)
        .send({
          amount_minor: 300000,
          method: 'wallet',
          idempotency_key: idempotencyKey,
          wallet_id: ctx.walletId
        })

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(invoiceId)
      expect(res.body.status).toBe('PAID')
      expect(res.body.paid_at).toBeTruthy()
      expect(res.body.payment_reference).toBeTruthy()

      // Verify invoice in DB
      const invRow = (await pool.query(`SELECT * FROM customer_invoices WHERE id = $1`, [invoiceId])).rows[0]
      expect(invRow.status).toBe('PAID')
      expect(invRow.paid_at).toBeTruthy()

      // Verify receivable in DB
      const recRow = (await pool.query(`SELECT * FROM receivables WHERE id = $1`, [receivableId])).rows[0]
      expect(recRow.status).toBe('PAID')
      expect(Number(recRow.paid_minor)).toBe(300000)
      expect(Number(recRow.outstanding_minor)).toBe(0)

      // Verify customer_payments
      const payRow = (await pool.query(`SELECT * FROM customer_payments WHERE receivable_id = $1`, [receivableId])).rows[0]
      expect(payRow.method).toBe('wallet')
      expect(Number(payRow.amount_minor)).toBe(300000)
      expect(payRow.idempotency_key).toBe(idempotencyKey)

      // Verify wallet account balance decreased exactly once (5000000 - 300000 = 4700000)
      const walletRow = (await pool.query(`SELECT * FROM wallet_accounts WHERE id = $1`, [ctx.walletId])).rows[0]
      expect(Number(walletRow.balance)).toBe(4700000)

      // Verify wallet ledger entry
      const ledgerRow = (await pool.query(`SELECT * FROM wallet_ledgers WHERE wallet_id = $1 AND transaction_type = 'INVOICE_PAYMENT'`, [ctx.walletId])).rows[0]
      expect(ledgerRow.transaction_type).toBe('INVOICE_PAYMENT')
      expect(ledgerRow.entry_type).toBe('DEBIT')
      expect(Number(ledgerRow.amount)).toBe(300000)
      expect(Number(ledgerRow.balance_before)).toBe(5000000)
      expect(Number(ledgerRow.balance_after)).toBe(4700000)
      expect(ledgerRow.reference_id).toBe(invoiceId)

      // Verify accounting journal entry is balanced
      const journalRow = (await pool.query(`SELECT * FROM journal_entries WHERE source_type = 'CUSTOMER_PAYMENT' AND source_id = $1`, [payRow.id])).rows[0]
      expect(journalRow.status).toBe('posted')

      const lines = (await pool.query(`SELECT * FROM journal_lines WHERE journal_entry_id = $1`, [journalRow.id])).rows
      expect(lines.length).toBe(2)
      const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit_minor), 0)
      const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit_minor), 0)
      expect(totalDebit).toBe(300000)
      expect(totalCredit).toBe(300000)

      // Verify audit log
      const auditRes = await pool.query(
        `SELECT * FROM platform_audit_logs WHERE action = 'CUSTOMER_INVOICE_WALLET_PAID' AND target_id = $1`,
        [invoiceId]
      )
      expect(auditRes.rows.length).toBeGreaterThan(0)
    }, 20000)
  })

  describe('3. Customer Self-Service Wallet Settlement', () => {
    it('allows authorized CUSTOMER to settle invoice using their linked Account Customer digital wallet', async () => {
      const ctx = await createTestContext('CUST')
      const { invoiceId } = await helperCreateInvoice(ctx.businessId, ctx.customerId, ctx.subscriptionId, 150000)
      const idempotencyKey = randomUUID()

      const res = await request(app)
        .post(`/v1/customer-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${ctx.customerToken}`)
        .send({
          amount_minor: 150000,
          method: 'wallet',
          idempotency_key: idempotencyKey
        })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('PAID')

      const walletRow = (await pool.query(`SELECT * FROM wallet_accounts WHERE id = $1`, [ctx.walletId])).rows[0]
      expect(Number(walletRow.balance)).toBe(4850000)
    }, 20000)
  })

  describe('4. Insufficient Balance Rollback', () => {
    it('returns 400 INSUFFICIENT_BALANCE and makes zero changes if wallet balance is lower than invoice total', async () => {
      const ctx = await createTestContext('INSUFF')
      const { invoiceId, receivableId } = await helperCreateInvoice(ctx.businessId, ctx.customerId, ctx.subscriptionId, 99999999)
      const idempotencyKey = randomUUID()

      const res = await request(app)
        .post(`/v1/customer-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${ctx.ownerToken}`)
        .send({
          amount_minor: 99999999,
          method: 'wallet',
          idempotency_key: idempotencyKey,
          wallet_id: ctx.walletId
        })

      expect(res.status).toBe(400)
      expect(res.body.error?.code).toBe('INSUFFICIENT_BALANCE')

      const invRow = (await pool.query(`SELECT * FROM customer_invoices WHERE id = $1`, [invoiceId])).rows[0]
      expect(invRow.status).toBe('ISSUED')
      expect(invRow.paid_at).toBeNull()

      const recRow = (await pool.query(`SELECT * FROM receivables WHERE id = $1`, [receivableId])).rows[0]
      expect(recRow.status).toBe('OPEN')
      expect(Number(recRow.paid_minor)).toBe(0)

      const payCount = (await pool.query(`SELECT COUNT(*) FROM customer_payments WHERE receivable_id = $1`, [receivableId])).rows[0].count
      expect(Number(payCount)).toBe(0)

      const walletRow = (await pool.query(`SELECT * FROM wallet_accounts WHERE id = $1`, [ctx.walletId])).rows[0]
      expect(Number(walletRow.balance)).toBe(5000000)

      const ledgerCount = (await pool.query(`SELECT COUNT(*) FROM wallet_ledgers WHERE reference_id = $1`, [invoiceId])).rows[0].count
      expect(Number(ledgerCount)).toBe(0)
    }, 20000)
  })

  describe('5. Idempotency & Conflict Handling', () => {
    it('returns deterministic 200 replay when identical payload and idempotency key are submitted', async () => {
      const ctx = await createTestContext('IDEM')
      const { invoiceId } = await helperCreateInvoice(ctx.businessId, ctx.customerId, ctx.subscriptionId, 200000)
      const idempotencyKey = randomUUID()

      const res1 = await request(app)
        .post(`/v1/customer-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${ctx.ownerToken}`)
        .send({
          amount_minor: 200000,
          method: 'wallet',
          idempotency_key: idempotencyKey,
          wallet_id: ctx.walletId
        })
      expect(res1.status).toBe(200)
      expect(res1.body.status).toBe('PAID')

      const res2 = await request(app)
        .post(`/v1/customer-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${ctx.ownerToken}`)
        .send({
          amount_minor: 200000,
          method: 'wallet',
          idempotency_key: idempotencyKey,
          wallet_id: ctx.walletId
        })
      expect(res2.status).toBe(200)
      expect(res2.body.status).toBe('PAID')

      const walletRow = (await pool.query(`SELECT balance FROM wallet_accounts WHERE id = $1`, [ctx.walletId])).rows[0]
      expect(Number(walletRow.balance)).toBe(4800000)
    }, 20000)

    it('returns 409 IDEMPOTENCY_PAYLOAD_MISMATCH when same idempotency key is reused with different amount', async () => {
      const ctx = await createTestContext('MISMATCH')
      const { invoiceId } = await helperCreateInvoice(ctx.businessId, ctx.customerId, ctx.subscriptionId, 200000)
      const idempotencyKey = randomUUID()

      await request(app)
        .post(`/v1/customer-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${ctx.ownerToken}`)
        .send({
          amount_minor: 200000,
          method: 'wallet',
          idempotency_key: idempotencyKey,
          wallet_id: ctx.walletId
        })

      const res2 = await request(app)
        .post(`/v1/customer-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${ctx.ownerToken}`)
        .send({
          amount_minor: 100000,
          method: 'wallet',
          idempotency_key: idempotencyKey,
          wallet_id: ctx.walletId
        })

      expect(res2.status).toBe(409)
      expect(res2.body.error?.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH')
    }, 20000)

    it('returns 409 ALREADY_PAID when new payment is attempted on an already paid invoice', async () => {
      const ctx = await createTestContext('ALREADY')
      const { invoiceId } = await helperCreateInvoice(ctx.businessId, ctx.customerId, ctx.subscriptionId, 200000)

      await request(app)
        .post(`/v1/customer-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${ctx.ownerToken}`)
        .send({
          amount_minor: 200000,
          method: 'wallet',
          idempotency_key: randomUUID(),
          wallet_id: ctx.walletId
        })

      const res = await request(app)
        .post(`/v1/customer-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${ctx.ownerToken}`)
        .send({
          amount_minor: 200000,
          method: 'wallet',
          idempotency_key: randomUUID(),
          wallet_id: ctx.walletId
        })

      expect(res.status).toBe(409)
      expect(res.body.error?.code).toBe('ALREADY_PAID')
    }, 20000)
  })

  describe('6. Security, Isolation & Role Guards', () => {
    it('strictly rejects STAFF and CASHIER from executing wallet invoice payments with 403', async () => {
      const ctx = await createTestContext('ROLES')
      const { invoiceId } = await helperCreateInvoice(ctx.businessId, ctx.customerId, ctx.subscriptionId, 100000)

      const staffRes = await request(app)
        .post(`/v1/customer-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${ctx.staffToken}`)
        .send({
          amount_minor: 100000,
          method: 'wallet',
          idempotency_key: randomUUID(),
          wallet_id: ctx.walletId
        })
      expect(staffRes.status).toBe(403)
      expect(staffRes.body.error?.code).toBe('INSUFFICIENT_PERMISSIONS')

      const cashierRes = await request(app)
        .post(`/v1/customer-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${ctx.cashierToken}`)
        .send({
          amount_minor: 100000,
          method: 'wallet',
          idempotency_key: randomUUID(),
          wallet_id: ctx.walletId
        })
      expect(cashierRes.status).toBe(403)
      expect(cashierRes.body.error?.code).toBe('INSUFFICIENT_PERMISSIONS')
    }, 20000)

    it('enforces tenant isolation and hides invoice existence on cross-tenant attempts', async () => {
      const ctxA = await createTestContext('TENA')
      const ctxB = await createTestContext('TENB')
      const { invoiceId } = await helperCreateInvoice(ctxA.businessId, ctxA.customerId, ctxA.subscriptionId, 100000)

      const res = await request(app)
        .post(`/v1/customer-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${ctxB.ownerToken}`)
        .send({
          amount_minor: 100000,
          method: 'wallet',
          idempotency_key: randomUUID(),
          wallet_id: ctxB.walletId
        })

      expect(res.status).toBe(404)
      expect(res.body.error?.code).toBe('INVOICE_NOT_FOUND')
    }, 20000)

    it('enforces customer isolation: Customer B cannot use Wallet A or settle Customer A invoice', async () => {
      const ctxA = await createTestContext('CUSTA')
      const ctxB = await createTestContext('CUSTB')
      const { invoiceId } = await helperCreateInvoice(ctxA.businessId, ctxA.customerId, ctxA.subscriptionId, 100000)

      const res = await request(app)
        .post(`/v1/customer-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${ctxB.customerToken}`)
        .send({
          amount_minor: 100000,
          method: 'wallet',
          idempotency_key: randomUUID(),
          wallet_id: ctxA.walletId
        })

      expect([403, 404]).toContain(res.status)
    }, 20000)
  })

  describe('7. Concurrency & Exact Settlement', () => {
    it('settles concurrent wallet payment requests on the same invoice exactly once', async () => {
      const ctx = await createTestContext('CONC')
      const { invoiceId } = await helperCreateInvoice(ctx.businessId, ctx.customerId, ctx.subscriptionId, 250000)

      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/v1/customer-invoices/${invoiceId}/payments`)
          .set('Authorization', `Bearer ${ctx.ownerToken}`)
          .send({
            amount_minor: 250000,
            method: 'wallet',
            idempotency_key: `conc-${randomUUID()}`,
            wallet_id: ctx.walletId
          }),
        request(app)
          .post(`/v1/customer-invoices/${invoiceId}/payments`)
          .set('Authorization', `Bearer ${ctx.ownerToken}`)
          .send({
            amount_minor: 250000,
            method: 'wallet',
            idempotency_key: `conc-${randomUUID()}`,
            wallet_id: ctx.walletId
          })
      ])

      const statuses = [res1.status, res2.status].sort()
      expect(statuses[0]).toBe(200)
      expect(statuses[1]).toBe(409)

      const walletRow = (await pool.query(`SELECT balance FROM wallet_accounts WHERE id = $1`, [ctx.walletId])).rows[0]
      expect(Number(walletRow.balance)).toBe(4750000)
    }, 20000)
  })
}, 30000)
