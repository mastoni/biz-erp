import path from 'path'
import { randomUUID, createHash } from 'crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createSalesSyncService } from '../src/services/sales_sync_service'
import { createCustomerBillingService } from '../src/services/customer_billing_service'
import { createFinanceService } from '../src/services/finance_service'
import { createWalletService } from '../src/services/wallet_service'
import { createWalletReconciliationService } from '../src/services/wallet_reconciliation_service'
import { accountRepository } from '../src/repositories/account_repository'
import { ApiError } from '../src/errors/api_error'

let pool: Pool
let salesSyncService: ReturnType<typeof createSalesSyncService>
let customerBillingService: ReturnType<typeof createCustomerBillingService>
let financeService: ReturnType<typeof createFinanceService>
let walletService: ReturnType<typeof createWalletService>
let reconciliationService: ReturnType<typeof createWalletReconciliationService>

beforeAll(async () => {
  const dbUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)

  const migrationsDir = path.resolve(__dirname, '../migrations')
  await runMigrations(pool, migrationsDir)

  walletService = createWalletService(pool)
  salesSyncService = createSalesSyncService(pool, walletService)
  customerBillingService = createCustomerBillingService(pool, walletService)
  financeService = createFinanceService(pool)
  reconciliationService = createWalletReconciliationService(pool, walletService)
}, 30000)

afterAll(async () => {
  await pool.end()
}, 30000)

interface TestFixture {
  businessId: string
  branchId: string
  productId: string
  accountCustomerId: string
  customerId: string
  walletId: string
  subscriptionId: string
  userId: string
}

async function setupFixture(initialBalance = 1000000): Promise<TestFixture> {
  const businessId = randomUUID()
  const branchId = randomUUID()
  const productId = randomUUID()
  const accountCustomerId = randomUUID()
  const customerId = randomUUID()
  const walletId = randomUUID()
  const userId = randomUUID()

  await pool.query(
    `INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, 'hash', 'ACTIVE')`,
    [userId, `user-${Date.now()}-${randomUUID().slice(0, 4)}@test.com`]
  )

  await pool.query(
    `INSERT INTO account_customers (id, name, code, account_type, status) VALUES ($1, $2, $3, 'INDIVIDUAL', 'ACTIVE')`,
    [accountCustomerId, 'Recon Customer', `CUST-R-${Date.now()}-${randomUUID().slice(0, 4)}`]
  )

  await pool.query(`INSERT INTO businesses (id, name, account_customer_id) VALUES ($1, $2, $3)`, [
    businessId,
    `Fixture Biz ${Date.now()}-${randomUUID().slice(0, 4)}`,
    accountCustomerId
  ])

  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'Main Branch', TRUE)`,
    [branchId, businessId]
  )

  await pool.query(
    `INSERT INTO products (id, business_id, name, price_minor, is_active) VALUES ($1, $2, 'Recon Product', 50000, TRUE)`,
    [productId, businessId]
  )

  await pool.query(
    `INSERT INTO stocks (id, business_id, branch_id, product_id, quantity, server_version) VALUES ($1, $2, $3, $4, 100, 1)`,
    [randomUUID(), businessId, branchId, productId]
  )

  await pool.query(
    `INSERT INTO customers (id, business_id, name) VALUES ($1, $2, 'Tenant Customer')`,
    [customerId, businessId]
  )

  await pool.query(
    `INSERT INTO wallet_accounts (id, account_customer_id, business_id, wallet_number, currency, status, balance)
     VALUES ($1, $2, $3, $4, 'IDR', 'ACTIVE', $5)`,
    [walletId, accountCustomerId, businessId, `WAL-R-${Date.now()}-${randomUUID().slice(0, 4)}`, initialBalance]
  )

  // Accounting chart of accounts
  await accountRepository.createDefaultAccounts(pool as any, businessId)

  // Customer subscription via canonical customerBillingService
  const sub = await customerBillingService.createSubscription(
    businessId,
    {
      customer_id: customerId,
      name: 'Broadband 50 Mbps',
      unit_price_minor: 150000,
      discount_minor: 0,
      tax_minor: 0,
      total_minor: 150000,
      billing_cycle: 'MONTHLY',
      starts_at: '2026-09-01T00:00:00.000Z',
      anchor_day: 1
    },
    { role: 'OWNER', email: 'owner@test.com', userId }
  )

  return {
    businessId,
    branchId,
    productId,
    accountCustomerId,
    customerId,
    walletId,
    subscriptionId: sub.id,
    userId
  }
}

describe('Phase DW-2D — Wallet Settlement Reconciliation Engine & Compensating Reversals', () => {
  // ---------------------------------------------------------------------------
  // 1. Clean / Reconciled Settlements
  // ---------------------------------------------------------------------------
  it('reconciles clean POS sale and customer invoice settlements without discrepancies', async () => {
    const fixture = await setupFixture(1000000)

    // 1A. Settle POS sale with wallet
    const saleId = randomUUID()
    const idempotencyKey = `idem-pos-recon-${Date.now()}`
    const requestHash = createHash('sha256').update(idempotencyKey).digest('hex')

    await salesSyncService.syncBatch(
      {
        business_id: fixture.businessId,
        items: [
          {
            idempotency_key: idempotencyKey,
            request_hash: requestHash,
            sale: {
              id: saleId,
              receipt_number: `RCPT-CLEAN-${Date.now()}`,
              subtotal_minor: 50000,
              discount_minor: 0,
              tax_minor: 0,
              total_minor: 50000,
              payment_method: 'wallet',
              paid_minor: 50000,
              change_minor: 0,
              branch_id: fixture.branchId,
              wallet_id: fixture.walletId
            },
            sale_items: [
              {
                id: randomUUID(),
                product_id: fixture.productId,
                product_name: 'Recon Product',
                quantity: 1,
                unit_price_minor: 50000,
                subtotal_minor: 50000
              }
            ]
          }
        ]
      },
      fixture.businessId
    )

    // 1B. Settle Customer Invoice with wallet
    const invoice = await customerBillingService.generateCustomerInvoice(
      fixture.businessId,
      fixture.subscriptionId,
      {},
      { userId: fixture.userId, role: 'OWNER' }
    )

    await customerBillingService.recordInvoicePayment(
      fixture.businessId,
      invoice.id,
      {
        amount_minor: invoice.total_minor,
        method: 'wallet',
        wallet_id: fixture.walletId,
        idempotency_key: `pay-inv-clean-${Date.now()}`
      },
      { userId: fixture.userId, role: 'OWNER' }
    )

    // Run reconciliation
    const summary = await reconciliationService.reconcileSettlements(fixture.businessId)

    expect(summary.business_id).toBe(fixture.businessId)
    expect(summary.total_discrepancies).toBe(0)
    expect(summary.status).toBe('RECONCILED')
    expect(summary.total_reconciled_settlements).toBeGreaterThanOrEqual(2)
    expect(summary.discrepancies.length).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // 2. Discrepancy Detection: INVOICE_LEDGER_ORPHAN
  // ---------------------------------------------------------------------------
  it('detects INVOICE_LEDGER_ORPHAN when an invoice or sale has wallet payment recorded but no ledger debit exists', async () => {
    const fixture = await setupFixture(500000)

    // Create an invoice marked PAID and customer payment recorded with 'wallet', but intentionally omit wallet_ledgers row
    const invoice = await customerBillingService.generateCustomerInvoice(
      fixture.businessId,
      fixture.subscriptionId,
      {},
      { userId: fixture.userId, role: 'OWNER' }
    )

    const paymentId = randomUUID()
    await pool.query(
      `INSERT INTO customer_payments (id, business_id, receivable_id, customer_id, amount_minor, method, reference, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, 'wallet', 'dummy-orphan-ref', $6, now())`,
      [paymentId, fixture.businessId, invoice.receivable_id, fixture.customerId, 150000, `idem-orphan-${Date.now()}`]
    )

    await pool.query(
      `UPDATE customer_invoices SET status = 'PAID', paid_at = now() WHERE id = $1`,
      [invoice.id]
    )

    const summary = await reconciliationService.reconcileSettlements(fixture.businessId, { domain: 'CUSTOMER_INVOICE' })

    expect(summary.status).toBe('DISCREPANCIES_FOUND')
    expect(summary.total_discrepancies).toBe(1)
    expect(summary.discrepancy_breakdown.invoice_ledger_orphans).toBe(1)
    expect(summary.discrepancies[0].discrepancy_type).toBe('INVOICE_LEDGER_ORPHAN')
    expect(summary.discrepancies[0].reference_id).toBe(invoice.id)
  })

  // ---------------------------------------------------------------------------
  // 3. Discrepancy Detection: WALLET_PAYMENT_UNSETTLED
  // ---------------------------------------------------------------------------
  it('detects WALLET_PAYMENT_UNSETTLED when a wallet ledger debit exists but the invoice/sale was never completed/paid', async () => {
    const fixture = await setupFixture(500000)

    // Create an invoice in ISSUED status
    const invoice = await customerBillingService.generateCustomerInvoice(
      fixture.businessId,
      fixture.subscriptionId,
      {},
      { userId: fixture.userId, role: 'OWNER' }
    )

    // Insert a debit wallet_ledger pointing to the invoice, but leave invoice as ISSUED
    const orphanLedgerId = randomUUID()
    await pool.query(
      `INSERT INTO wallet_ledgers (
        id, wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
        currency, reference_type, reference_id, idempotency_key, actor_scope, description
      ) VALUES ($1, $2, 'INVOICE_PAYMENT', 'DEBIT', 150000, 500000, 350000, 'IDR', 'CUSTOMER_INVOICE', $3, $4, 'tenant', 'Unsettled Debit')`,
      [orphanLedgerId, fixture.walletId, invoice.id, `unsettled-idem-${Date.now()}`]
    )

    const summary = await reconciliationService.reconcileSettlements(fixture.businessId, { domain: 'CUSTOMER_INVOICE' })

    expect(summary.status).toBe('DISCREPANCIES_FOUND')
    expect(summary.total_discrepancies).toBe(1)
    expect(summary.discrepancy_breakdown.wallet_payment_unsettled).toBe(1)
    expect(summary.discrepancies[0].discrepancy_type).toBe('WALLET_PAYMENT_UNSETTLED')
  })

  // ---------------------------------------------------------------------------
  // 4. Discrepancy Detection: AMOUNT_MISMATCH
  // ---------------------------------------------------------------------------
  it('detects AMOUNT_MISMATCH when invoice total and wallet ledger debit amount disagree', async () => {
    const fixture = await setupFixture(500000)

    const invoice = await customerBillingService.generateCustomerInvoice(
      fixture.businessId,
      fixture.subscriptionId,
      {},
      { userId: fixture.userId, role: 'OWNER' }
    )

    const ledgerId = randomUUID()
    // Invoice total is 150000, but ledger debit is only 100000
    await pool.query(
      `INSERT INTO wallet_ledgers (
        id, wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
        currency, reference_type, reference_id, idempotency_key, actor_scope, description
      ) VALUES ($1, $2, 'INVOICE_PAYMENT', 'DEBIT', 100000, 500000, 400000, 'IDR', 'CUSTOMER_INVOICE', $3, $4, 'tenant', 'Mismatch Debit')`,
      [ledgerId, fixture.walletId, invoice.id, `mismatch-idem-${Date.now()}`]
    )

    await pool.query(
      `INSERT INTO customer_payments (id, business_id, receivable_id, customer_id, amount_minor, method, reference, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, 150000, 'wallet', $5, $6, now())`,
      [randomUUID(), fixture.businessId, invoice.receivable_id, fixture.customerId, ledgerId, `pay-mismatch-${Date.now()}`]
    )

    await pool.query(
      `UPDATE customer_invoices SET status = 'PAID', paid_at = now(), payment_reference = $1 WHERE id = $2`,
      [ledgerId, invoice.id]
    )

    const summary = await reconciliationService.reconcileSettlements(fixture.businessId, { domain: 'CUSTOMER_INVOICE' })

    expect(summary.status).toBe('DISCREPANCIES_FOUND')
    expect(summary.total_discrepancies).toBe(1)
    expect(summary.discrepancy_breakdown.amount_mismatches).toBe(1)
    expect(summary.discrepancies[0].discrepancy_type).toBe('AMOUNT_MISMATCH')
    expect(summary.discrepancies[0].expected_amount_minor).toBe(150000)
    expect(summary.discrepancies[0].actual_amount_minor).toBe(100000)
    expect(summary.discrepancies[0].difference_minor).toBe(50000)
  })

  // ---------------------------------------------------------------------------
  // 5. Tenant Isolation
  // ---------------------------------------------------------------------------
  it('enforces strict tenant isolation during reconciliation and refund operations', async () => {
    const fixtureA = await setupFixture(500000)
    const fixtureB = await setupFixture(500000)

    // Issue invoice on Business B
    const invoiceB = await customerBillingService.generateCustomerInvoice(
      fixtureB.businessId,
      fixtureB.subscriptionId,
      {},
      { userId: fixtureB.userId, role: 'OWNER' }
    )

    await customerBillingService.recordInvoicePayment(
      fixtureB.businessId,
      invoiceB.id,
      {
        amount_minor: invoiceB.total_minor,
        method: 'wallet',
        wallet_id: fixtureB.walletId,
        idempotency_key: `pay-inv-bizb-${Date.now()}`
      },
      { userId: fixtureB.userId, role: 'OWNER' }
    )

    // Business A reconciles — should not see Business B's data
    const summaryA = await reconciliationService.reconcileSettlements(fixtureA.businessId)
    expect(summaryA.total_settlements_scanned).toBe(0)

    // Business A attempts to refund Business B's invoice — must fail with 404
    await expect(
      reconciliationService.refundInvoiceSettlement(
        fixtureA.businessId,
        invoiceB.id,
        {
          reason: 'Unauthorized refund attempt',
          idempotency_key: `cross-tenant-refund-${Date.now()}`
        },
        { actorId: fixtureA.userId, actorScope: 'tenant', actorRole: 'OWNER' }
      )
    ).rejects.toThrow(ApiError)
  })

  // ---------------------------------------------------------------------------
  // 6. Compensating Refund for Customer Invoice
  // ---------------------------------------------------------------------------
  it('executes atomic compensating refund for wallet-settled customer invoice with GL reversal and audit', async () => {
    const initialBalance = 500000
    const fixture = await setupFixture(initialBalance)

    // 1. Issue & pay invoice
    const invoice = await customerBillingService.generateCustomerInvoice(
      fixture.businessId,
      fixture.subscriptionId,
      {},
      { userId: fixture.userId, role: 'OWNER' }
    )

    await customerBillingService.recordInvoicePayment(
      fixture.businessId,
      invoice.id,
      {
        amount_minor: invoice.total_minor,
        method: 'wallet',
        wallet_id: fixture.walletId,
        idempotency_key: `pay-inv-for-refund-${Date.now()}`
      },
      { userId: fixture.userId, role: 'OWNER' }
    )

    // Wallet balance after payment
    const walletAfterPayment = await walletService.getAccountById(fixture.walletId)
    expect(walletAfterPayment.balance).toBe(initialBalance - 150000)

    // 2. Perform compensating refund
    const refundIdemKey = `refund-inv-idem-${Date.now()}`
    const refundResult = await reconciliationService.refundInvoiceSettlement(
      fixture.businessId,
      invoice.id,
      {
        reason: 'Customer requested plan cancellation',
        idempotency_key: refundIdemKey
      },
      { actorId: fixture.userId, actorScope: 'tenant', actorRole: 'OWNER' }
    )

    expect(refundResult.success).toBe(true)
    expect(refundResult.refund_type).toBe('CUSTOMER_INVOICE')
    expect(refundResult.amount_minor).toBe(150000)
    expect(refundResult.reversal_journal_id).toBeDefined()

    // 3. Verify wallet balance restored
    const walletAfterRefund = await walletService.getAccountById(fixture.walletId)
    expect(walletAfterRefund.balance).toBe(initialBalance)

    // 4. Verify wallet ledger entry
    const ledgerRes = await pool.query(`SELECT * FROM wallet_ledgers WHERE id = $1`, [refundResult.refund_ledger_id])
    const ledger = ledgerRes.rows[0]
    expect(ledger.entry_type).toBe('CREDIT')
    expect(ledger.transaction_type).toBe('REFUND')
    expect(Number(ledger.amount)).toBe(150000)

    // 5. Verify invoice status updated
    const invRes = await pool.query(`SELECT status FROM customer_invoices WHERE id = $1`, [invoice.id])
    expect(invRes.rows[0].status).toBe('CANCELLED')

    // 6. Verify audit log emitted
    const auditRes = await pool.query(
      `SELECT * FROM platform_audit_logs WHERE action = 'CUSTOMER_INVOICE_WALLET_REFUNDED' AND target_id = $1`,
      [invoice.id]
    )
    expect(auditRes.rows.length).toBeGreaterThan(0)
    expect(auditRes.rows[0].status).toBe('SUCCESS')
  })

  // ---------------------------------------------------------------------------
  // 7. Compensating Refund for POS Sale
  // ---------------------------------------------------------------------------
  it('executes atomic compensating refund for wallet-settled POS sale with GL reversal and audit', async () => {
    const initialBalance = 200000
    const fixture = await setupFixture(initialBalance)

    const saleId = randomUUID()
    const idempotencyKey = `idem-pos-refund-${Date.now()}`
    const requestHash = createHash('sha256').update(idempotencyKey).digest('hex')

    await salesSyncService.syncBatch(
      {
        business_id: fixture.businessId,
        items: [
          {
            idempotency_key: idempotencyKey,
            request_hash: requestHash,
            sale: {
              id: saleId,
              receipt_number: `RCPT-REF-${Date.now()}`,
              subtotal_minor: 50000,
              discount_minor: 0,
              tax_minor: 0,
              total_minor: 50000,
              payment_method: 'wallet',
              paid_minor: 50000,
              change_minor: 0,
              branch_id: fixture.branchId,
              wallet_id: fixture.walletId
            },
            sale_items: [
              {
                id: randomUUID(),
                product_id: fixture.productId,
                product_name: 'Recon Product',
                quantity: 1,
                unit_price_minor: 50000,
                subtotal_minor: 50000
              }
            ]
          }
        ]
      },
      fixture.businessId
    )

    // Wallet balance after POS sale
    const walletAfterSale = await walletService.getAccountById(fixture.walletId)
    expect(walletAfterSale.balance).toBe(initialBalance - 50000)

    // Perform POS sale refund
    const refundIdemKey = `refund-sale-idem-${Date.now()}`
    const refundResult = await reconciliationService.refundSaleSettlement(
      fixture.businessId,
      saleId,
      {
        reason: 'Customer returned coffee beans',
        idempotency_key: refundIdemKey
      },
      { actorId: fixture.userId, actorScope: 'tenant', actorRole: 'OWNER' }
    )

    expect(refundResult.success).toBe(true)
    expect(refundResult.refund_type).toBe('POS_SALE')
    expect(refundResult.amount_minor).toBe(50000)
    expect(refundResult.reversal_journal_id).toBeDefined()

    // Wallet balance restored
    const walletAfterRefund = await walletService.getAccountById(fixture.walletId)
    expect(walletAfterRefund.balance).toBe(initialBalance)

    // Audit log emitted
    const auditRes = await pool.query(
      `SELECT * FROM platform_audit_logs WHERE action = 'POS_SALE_WALLET_REFUNDED' AND target_id = $1`,
      [saleId]
    )
    expect(auditRes.rows.length).toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------------------
  // 8. Idempotency on Refunds
  // ---------------------------------------------------------------------------
  it('handles duplicate refund requests idempotently without double crediting wallet balance', async () => {
    const initialBalance = 500000
    const fixture = await setupFixture(initialBalance)

    const invoice = await customerBillingService.generateCustomerInvoice(
      fixture.businessId,
      fixture.subscriptionId,
      {},
      { userId: fixture.userId, role: 'OWNER' }
    )

    await customerBillingService.recordInvoicePayment(
      fixture.businessId,
      invoice.id,
      {
        amount_minor: invoice.total_minor,
        method: 'wallet',
        wallet_id: fixture.walletId,
        idempotency_key: `pay-inv-idem-${Date.now()}`
      },
      { userId: fixture.userId, role: 'OWNER' }
    )

    const sharedRefundKey = `shared-refund-key-${Date.now()}`

    // First refund attempt
    const res1 = await reconciliationService.refundInvoiceSettlement(
      fixture.businessId,
      invoice.id,
      { reason: 'First refund', idempotency_key: sharedRefundKey },
      { actorId: fixture.userId, actorScope: 'tenant', actorRole: 'OWNER' }
    )

    // Second refund attempt with same idempotency key
    const res2 = await reconciliationService.refundInvoiceSettlement(
      fixture.businessId,
      invoice.id,
      { reason: 'First refund', idempotency_key: sharedRefundKey },
      { actorId: fixture.userId, actorScope: 'tenant', actorRole: 'OWNER' }
    )

    expect(res2.already_refunded).toBe(true)
    expect(res2.refund_ledger_id).toBe(res1.refund_ledger_id)

    // Verify wallet balance was only credited ONCE
    const finalWallet = await walletService.getAccountById(fixture.walletId)
    expect(finalWallet.balance).toBe(initialBalance)
  })

  // ---------------------------------------------------------------------------
  // 9. Reconciliation Audit Event Emission
  // ---------------------------------------------------------------------------
  it('emits WALLET_SETTLEMENT_RECONCILED audit event upon reconciliation run', async () => {
    const fixture = await setupFixture(500000)

    await reconciliationService.reconcileSettlements(
      fixture.businessId,
      {},
      { actorId: fixture.userId, actorScope: 'tenant', actorRole: 'OWNER' }
    )

    const auditRes = await pool.query(
      `SELECT * FROM platform_audit_logs
       WHERE action = 'WALLET_SETTLEMENT_RECONCILED' AND target_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [fixture.businessId]
    )

    expect(auditRes.rows.length).toBe(1)
    expect(auditRes.rows[0].status).toBe('SUCCESS')
    expect(auditRes.rows[0].actor_id).toBe(fixture.userId)
  })
})
