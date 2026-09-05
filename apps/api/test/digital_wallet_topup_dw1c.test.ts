import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import crypto from 'crypto'
import { randomUUID } from 'crypto'
import { createWalletService } from '../src/services/wallet_service'
import { createTopUpIntentService } from '../src/services/top_up_intent_service'
import { createPaymentGatewayService } from '../src/services/payment_gateway_service'
import { createAuditService } from '../src/services/audit_service'

describe('Phase DW-1C: Digital Wallet Top-Up Intent & Webhook Bridge', () => {
  let pool: Pool
  let walletService: ReturnType<typeof createWalletService>
  let topUpService: ReturnType<typeof createTopUpIntentService>
  let paymentGatewayService: ReturnType<typeof createPaymentGatewayService>
  let auditService: ReturnType<typeof createAuditService>

  const serverKey = process.env.MIDTRANS_SERVER_KEY || 'test-midtrans-server-key-skmnet'

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    auditService = createAuditService(pool)
    walletService = createWalletService(pool, auditService)
    topUpService = createTopUpIntentService(pool, auditService)
    paymentGatewayService = createPaymentGatewayService(pool)
  })

  afterAll(async () => {
    await pool.end()
  })

  async function createTestAccountCustomer(): Promise<string> {
    const code = `ACC-DW1C-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const res = await pool.query(
      `INSERT INTO account_customers (code, name, account_type, billing_email)
       VALUES ($1, 'DW-1C Client', 'INDIVIDUAL', 'dw1c@test.com')
       RETURNING id`,
      [code]
    )
    return res.rows[0].id
  }

  function createMidtransSignature(orderId: string, statusCode: string, grossAmount: string): string {
    const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`
    return crypto.createHash('sha512').update(raw).digest('hex')
  }

  describe('1. Top-Up Intent Creation & Validation', () => {
    it('DW-1C-001: creates top-up intent with correct fee, total payable, and expiration', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      const intent = await topUpService.createIntent({
        wallet_id: wallet.id,
        account_customer_id: acId,
        amount: 200000,
        fee_amount: 3000,
        payment_method: 'qris',
        expires_in_hours: 12,
        actor_scope: 'customer'
      })

      expect(intent.id).toBeDefined()
      expect(intent.intent_number).toMatch(/^TOP-/)
      expect(intent.wallet_id).toBe(wallet.id)
      expect(intent.account_customer_id).toBe(acId)
      expect(intent.amount).toBe(200000)
      expect(intent.fee_amount).toBe(3000)
      expect(intent.total_payable).toBe(203000)
      expect(intent.status).toBe('PENDING')
      expect(intent.currency).toBe('IDR')
      expect(intent.expires_at).toBeDefined()

      // Verify audit log
      const auditRes = await pool.query(
        `SELECT * FROM platform_audit_logs WHERE target_id = $1 AND action = 'WALLET_TOPUP_INTENT_CREATED'`,
        [intent.id]
      )
      expect(auditRes.rows.length).toBe(1)
      expect(auditRes.rows[0].service_code).toBe('DIGITAL_WALLET')
    })

    it('DW-1C-002: rejects intent creation when account customer does not own wallet', async () => {
      const ac1 = await createTestAccountCustomer()
      const ac2 = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: ac1 })

      await expect(
        topUpService.createIntent({
          wallet_id: wallet.id,
          account_customer_id: ac2, // Wrong customer
          amount: 50000
        })
      ).rejects.toThrow(/OWNERSHIP_MISMATCH|does not belong/)
    })

    it('DW-1C-003: rejects intent creation on inactive or closed wallet', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })
      await walletService.freezeAccount(wallet.id)

      await expect(
        topUpService.createIntent({
          wallet_id: wallet.id,
          account_customer_id: acId,
          amount: 50000
        })
      ).rejects.toThrow(/WALLET_NOT_ACTIVE|status/)
    })

    it('DW-1C-004: rejects non-positive top-up amount and currency mismatch', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      await expect(
        topUpService.createIntent({
          wallet_id: wallet.id,
          account_customer_id: acId,
          amount: 0
        })
      ).rejects.toThrow(/Top-up amount must be strictly greater than zero|INVALID_AMOUNT/)

      await expect(
        topUpService.createIntent({
          wallet_id: wallet.id,
          account_customer_id: acId,
          amount: 50000,
          currency: 'EUR'
        })
      ).rejects.toThrow(/does not match wallet currency|CURRENCY_MISMATCH/)
    })
  })

  describe('2. Direct Authoritative Settlement & Idempotency', () => {
    it('DW-1C-005: authoritatively settles intent, atomically credits wallet, and records TOP_UP ledger', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      const intent = await topUpService.createIntent({
        wallet_id: wallet.id,
        account_customer_id: acId,
        amount: 300000,
        fee_amount: 2500
      })

      const settleRes = await topUpService.settleIntent({
        intent_number: intent.intent_number,
        payment_reference: 'MIDTRANS-TRX-999',
        gateway_transaction_id: 'GW-TRX-999',
        paid_amount: 300000,
        actor_scope: 'system'
      })

      expect(settleRes.already_processed).toBe(false)
      expect(settleRes.intent.status).toBe('SUCCEEDED')
      expect(settleRes.intent.settled_at).toBeDefined()
      expect(settleRes.intent.payment_reference).toBe('MIDTRANS-TRX-999')
      expect(settleRes.wallet_mutation.account.balance).toBe(300000)
      expect(settleRes.wallet_mutation.ledger.transaction_type).toBe('TOP_UP')
      expect(settleRes.wallet_mutation.ledger.entry_type).toBe('CREDIT')
      expect(settleRes.wallet_mutation.ledger.amount).toBe(300000)

      // Verify audit event
      const auditRes = await pool.query(
        `SELECT * FROM platform_audit_logs WHERE target_id = $1 AND action = 'WALLET_TOPUP_SUCCEEDED'`,
        [intent.id]
      )
      expect(auditRes.rows.length).toBe(1)
    })

    it('DW-1C-006: repeated settlement of already succeeded intent is idempotent and does not double-credit', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      const intent = await topUpService.createIntent({
        wallet_id: wallet.id,
        account_customer_id: acId,
        amount: 100000
      })

      // Settle once
      const call1 = await topUpService.settleIntent({
        intent_number: intent.intent_number,
        payment_reference: 'REF-IDEM-1'
      })
      expect(call1.already_processed).toBe(false)
      expect(call1.wallet_mutation.account.balance).toBe(100000)

      // Settle again
      const call2 = await topUpService.settleIntent({
        intent_number: intent.intent_number,
        payment_reference: 'REF-IDEM-1'
      })
      expect(call2.already_processed).toBe(true)

      const finalWallet = await walletService.getAccountById(wallet.id)
      expect(finalWallet.balance).toBe(100000)

      const ledgers = await walletService.listLedgers({ wallet_id: wallet.id })
      expect(ledgers.total).toBe(1)
    })

    it('DW-1C-007: rejects settlement with insufficient paid amount or currency mismatch', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      const intent = await topUpService.createIntent({
        wallet_id: wallet.id,
        account_customer_id: acId,
        amount: 50000
      })

      await expect(
        topUpService.settleIntent({
          intent_number: intent.intent_number,
          payment_reference: 'REF-UNDERPAID',
          paid_amount: 40000 // Less than 50k
        })
      ).rejects.toThrow(/AMOUNT_MISMATCH|less than/)

      await expect(
        topUpService.settleIntent({
          intent_number: intent.intent_number,
          payment_reference: 'REF-CURR-ERR',
          currency: 'USD'
        })
      ).rejects.toThrow(/Paid currency \(USD\) does not match intent currency|CURRENCY_MISMATCH/)
    })
  })

  describe('3. Lifecycle Transitions (Fail, Expire, Cancel)', () => {
    it('DW-1C-008: fails intent without altering wallet balance', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      const intent = await topUpService.createIntent({
        wallet_id: wallet.id,
        account_customer_id: acId,
        amount: 75000
      })

      const failed = await topUpService.failIntent(intent.intent_number, 'User payment expired')
      expect(failed.status).toBe('FAILED')

      const currentWallet = await walletService.getAccountById(wallet.id)
      expect(currentWallet.balance).toBe(0)
    })

    it('DW-1C-009: cancels pending intent and prevents subsequent settlement', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      const intent = await topUpService.createIntent({
        wallet_id: wallet.id,
        account_customer_id: acId,
        amount: 80000
      })

      const cancelled = await topUpService.cancelIntent(intent.intent_number)
      expect(cancelled.status).toBe('CANCELLED')

      await expect(
        topUpService.settleIntent({
          intent_number: intent.intent_number,
          payment_reference: 'REF-CANCELLED'
        })
      ).rejects.toThrow(/Cannot settle top-up intent in status|INVALID_INTENT_STATUS/)
    })
  })

  describe('4. Webhook Bridge Integration', () => {
    it('DW-1C-010: processes verified Midtrans webhook for top-up intent and credits wallet', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      const intent = await topUpService.createIntent({
        wallet_id: wallet.id,
        account_customer_id: acId,
        amount: 500000,
        fee_amount: 0
      })

      const grossAmount = '500000'
      const statusCode = '200'
      const signature = createMidtransSignature(intent.intent_number, statusCode, grossAmount)

      const webhookPayload = {
        order_id: intent.intent_number,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signature,
        transaction_status: 'settlement',
        transaction_id: `MIDTRANS-TRX-${Date.now()}`,
        payment_type: 'bank_transfer'
      }

      const result = await paymentGatewayService.processMidtransWebhook(webhookPayload)
      expect(result.status).toBe('PROCESSED')
      expect(result.intent_id).toBe(intent.id)

      // Verify wallet credited
      const updatedWallet = await walletService.getAccountById(wallet.id)
      expect(updatedWallet.balance).toBe(500000)

      // Verify intent succeeded
      const updatedIntent = await topUpService.getIntentByNumber(intent.intent_number)
      expect(updatedIntent.status).toBe('SUCCEEDED')
    })

    it('DW-1C-011: rejects unverified Midtrans webhook signature with 401', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      const intent = await topUpService.createIntent({
        wallet_id: wallet.id,
        account_customer_id: acId,
        amount: 100000
      })

      const invalidPayload = {
        order_id: intent.intent_number,
        status_code: '200',
        gross_amount: '100000',
        signature_key: 'INVALID_SIGNATURE_KEY_ATTEMPT',
        transaction_status: 'settlement',
        transaction_id: 'TRX-INVALID'
      }

      await expect(
        paymentGatewayService.processMidtransWebhook(invalidPayload)
      ).rejects.toThrow(/INVALID_SIGNATURE|signature verification failed/)

      // Verify wallet was not credited
      const checkWallet = await walletService.getAccountById(wallet.id)
      expect(checkWallet.balance).toBe(0)
    })

    it('DW-1C-012: duplicate webhook delivery is safely ignored without double-crediting', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      const intent = await topUpService.createIntent({
        wallet_id: wallet.id,
        account_customer_id: acId,
        amount: 250000
      })

      const grossAmount = '250000'
      const statusCode = '200'
      const signature = createMidtransSignature(intent.intent_number, statusCode, grossAmount)
      const transactionId = `MIDTRANS-DUP-${Date.now()}`

      const webhookPayload = {
        order_id: intent.intent_number,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signature,
        transaction_status: 'settlement',
        transaction_id: transactionId
      }

      // Delivery 1
      const res1 = await paymentGatewayService.processMidtransWebhook(webhookPayload)
      expect(res1.status).toBe('PROCESSED')

      // Delivery 2 (Identical webhook event)
      const res2 = await paymentGatewayService.processMidtransWebhook(webhookPayload)
      expect(res2.status).toBe('ALREADY_PROCESSED')

      const finalWallet = await walletService.getAccountById(wallet.id)
      expect(finalWallet.balance).toBe(250000)
    })

    it('DW-1C-013: handles concurrent duplicate webhook delivery without race condition', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      const intent = await topUpService.createIntent({
        wallet_id: wallet.id,
        account_customer_id: acId,
        amount: 150000
      })

      const grossAmount = '150000'
      const statusCode = '200'
      const signature = createMidtransSignature(intent.intent_number, statusCode, grossAmount)
      const transactionId = `MIDTRANS-RACE-${Date.now()}`

      const webhookPayload = {
        order_id: intent.intent_number,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signature,
        transaction_status: 'settlement',
        transaction_id: transactionId
      }

      // Fire 3 simultaneous webhooks for same event
      const promises = Array.from({ length: 3 }, () =>
        paymentGatewayService.processMidtransWebhook(webhookPayload)
      )

      const results = await Promise.all(promises)
      expect(results.length).toBe(3)

      const finalWallet = await walletService.getAccountById(wallet.id)
      expect(finalWallet.balance).toBe(150000)

      const ledgers = await walletService.listLedgers({ wallet_id: wallet.id })
      expect(ledgers.total).toBe(1)
    })
  })
})
