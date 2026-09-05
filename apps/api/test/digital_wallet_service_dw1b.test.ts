import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'
import { createWalletService } from '../src/services/wallet_service'
import { createAuditService } from '../src/services/audit_service'

describe('Phase DW-1B: Digital Wallet Core Ledger Engine & Service Layer', () => {
  let pool: Pool
  let walletService: ReturnType<typeof createWalletService>
  let auditService: ReturnType<typeof createAuditService>

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    auditService = createAuditService(pool)
    walletService = createWalletService(pool, auditService)
  })

  afterAll(async () => {
    await pool.end()
  })

  async function createTestAccountCustomer(): Promise<string> {
    const code = `ACC-DW1B-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const res = await pool.query(
      `INSERT INTO account_customers (code, name, account_type, billing_email)
       VALUES ($1, 'DW-1B Client', 'BUSINESS', 'dw1b@test.com')
       RETURNING id`,
      [code]
    )
    return res.rows[0].id
  }

  async function createTestBusiness(): Promise<string> {
    const res = await pool.query(
      `INSERT INTO businesses (id, name, created_at)
       VALUES ($1, 'DW-1B Merchant', now())
       RETURNING id`,
      [randomUUID()]
    )
    return res.rows[0].id
  }

  describe('1. Wallet Account Lifecycle & Lookup', () => {
    it('DW-1B-001: creates wallet account and logs audit event', async () => {
      const acId = await createTestAccountCustomer()
      const account = await walletService.createAccount({
        account_customer_id: acId,
        currency: 'IDR',
        actor_id: randomUUID(),
        actor_scope: 'platform'
      })

      expect(account.id).toBeDefined()
      expect(account.account_customer_id).toBe(acId)
      expect(account.currency).toBe('IDR')
      expect(account.status).toBe('ACTIVE')
      expect(account.balance).toBe(0)
      expect(account.server_version).toBe(1)
      expect(account.wallet_number).toMatch(/^WAL-/)

      // Verify audit log
      const auditRes = await pool.query(
        `SELECT * FROM platform_audit_logs WHERE target_id = $1 AND action = 'WALLET_ACCOUNT_CREATED'`,
        [account.id]
      )
      expect(auditRes.rows.length).toBe(1)
      expect(auditRes.rows[0].service_code).toBe('DIGITAL_WALLET')
    })

    it('DW-1B-002: rejects duplicate wallet creation for same customer and currency', async () => {
      const acId = await createTestAccountCustomer()
      await walletService.createAccount({
        account_customer_id: acId,
        currency: 'IDR'
      })

      await expect(
        walletService.createAccount({
          account_customer_id: acId,
          currency: 'IDR'
        })
      ).rejects.toThrow(/already exists|WALLET_ALREADY_EXISTS/)
    })

    it('DW-1B-003: retrieves wallet by id and resolves customer wallet by currency', async () => {
      const acId = await createTestAccountCustomer()
      const created = await walletService.createAccount({ account_customer_id: acId })

      const byId = await walletService.getAccountById(created.id)
      expect(byId.id).toBe(created.id)

      const byCust = await walletService.getAccountByCustomerAndCurrency(acId, 'IDR')
      expect(byCust?.id).toBe(created.id)

      await expect(walletService.getAccountById(randomUUID())).rejects.toThrow(/not found|WALLET_NOT_FOUND/)
    })

    it('DW-1B-004: lists wallets with status and tenant filters', async () => {
      const acId = await createTestAccountCustomer()
      const bizId = await createTestBusiness()

      const w = await walletService.createAccount({
        account_customer_id: acId,
        business_id: bizId
      })

      const list = await walletService.listAccounts({ business_id: bizId })
      expect(list.total).toBeGreaterThanOrEqual(1)
      expect(list.items.some((it) => it.id === w.id)).toBe(true)
    })
  })

  describe('2. Credit, Debit, and Balance Arithmetic', () => {
    it('DW-1B-005: executes atomic credit mutation, increases balance, and increments version', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })
      const idKey = `IDEM-CREDIT-${Date.now()}`

      const result = await walletService.credit({
        wallet_id: wallet.id,
        amount: 150000,
        reference_type: 'TOP_UP_INTENT',
        reference_id: 'TOP-123',
        idempotency_key: idKey,
        actor_scope: 'customer',
        description: 'Customer deposit'
      })

      expect(result.already_processed).toBe(false)
      expect(result.account.balance).toBe(150000)
      expect(result.account.server_version).toBe(2)
      expect(result.ledger.amount).toBe(150000)
      expect(result.ledger.balance_before).toBe(0)
      expect(result.ledger.balance_after).toBe(150000)
      expect(result.ledger.entry_type).toBe('CREDIT')

      // Verify audit log
      const auditRes = await pool.query(
        `SELECT * FROM platform_audit_logs WHERE target_id = $1 AND action = 'WALLET_CREDITED'`,
        [wallet.id]
      )
      expect(auditRes.rows.length).toBe(1)
    })

    it('DW-1B-006: executes atomic debit mutation, decreases balance, and increments version', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      // Initial credit of 100k
      await walletService.credit({
        wallet_id: wallet.id,
        amount: 100000,
        reference_type: 'ADJUSTMENT',
        reference_id: 'INIT',
        idempotency_key: `IDEM-INIT-${Date.now()}`,
        actor_scope: 'system',
        description: 'Initial funds'
      })

      // Debit 40k
      const debitRes = await walletService.debit({
        wallet_id: wallet.id,
        amount: 40000,
        reference_type: 'PLATFORM_INVOICE',
        reference_id: 'INV-101',
        idempotency_key: `IDEM-DEBIT-${Date.now()}`,
        actor_scope: 'system',
        description: 'Invoice settlement'
      })

      expect(debitRes.already_processed).toBe(false)
      expect(debitRes.account.balance).toBe(60000)
      expect(debitRes.account.server_version).toBe(3)
      expect(debitRes.ledger.amount).toBe(40000)
      expect(debitRes.ledger.balance_before).toBe(100000)
      expect(debitRes.ledger.balance_after).toBe(60000)
      expect(debitRes.ledger.entry_type).toBe('DEBIT')
    })

    it('DW-1B-007: rejects debit exceeding available balance (INSUFFICIENT_FUNDS)', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      await walletService.credit({
        wallet_id: wallet.id,
        amount: 50000,
        reference_type: 'ADJUSTMENT',
        reference_id: 'INIT',
        idempotency_key: `IDEM-FUNDS-${Date.now()}`,
        actor_scope: 'system',
        description: 'Initial balance'
      })

      await expect(
        walletService.debit({
          wallet_id: wallet.id,
          amount: 50001,
          reference_type: 'POS_SALE',
          reference_id: 'SALE-1',
          idempotency_key: `IDEM-OVER-${Date.now()}`,
          actor_scope: 'tenant',
          description: 'Overdraft attempt'
        })
      ).rejects.toThrow(/Insufficient wallet balance|INSUFFICIENT_FUNDS/)

      // Verify balance did not change
      const current = await walletService.getAccountById(wallet.id)
      expect(current.balance).toBe(50000)
    })

    it('DW-1B-008: rejects non-positive mutation amount and currency mismatch', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      await expect(
        walletService.credit({
          wallet_id: wallet.id,
          amount: 0,
          reference_type: 'REF',
          reference_id: '1',
          idempotency_key: `IDEM-ZERO-${Date.now()}`,
          actor_scope: 'system',
          description: 'Zero'
        })
      ).rejects.toThrow(/Mutation amount must be strictly greater than zero|INVALID_AMOUNT/)

      await expect(
        walletService.credit({
          wallet_id: wallet.id,
          amount: 1000,
          currency: 'USD',
          reference_type: 'REF',
          reference_id: '1',
          idempotency_key: `IDEM-CURR-${Date.now()}`,
          actor_scope: 'system',
          description: 'USD mismatch'
        })
      ).rejects.toThrow(/does not match wallet currency|CURRENCY_MISMATCH/)
    })
  })

  describe('3. Lifecycle State Transitions & Freeze/Close Restrictions', () => {
    it('DW-1B-009: freezes wallet and blocks debits while allowing status inquiry', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      await walletService.credit({
        wallet_id: wallet.id,
        amount: 25000,
        reference_type: 'ADJ',
        reference_id: '1',
        idempotency_key: `IDEM-FRZ-INIT-${Date.now()}`,
        actor_scope: 'system',
        description: 'Funded'
      })

      const frozen = await walletService.freezeAccount(wallet.id)
      expect(frozen.status).toBe('FROZEN')

      // Debit must be blocked on frozen wallet
      await expect(
        walletService.debit({
          wallet_id: wallet.id,
          amount: 5000,
          reference_type: 'INV',
          reference_id: '1',
          idempotency_key: `IDEM-FRZ-DEB-${Date.now()}`,
          actor_scope: 'system',
          description: 'Debit frozen'
        })
      ).rejects.toThrow(/Wallet account is frozen|WALLET_FROZEN/)

      // Unfreeze restored debits
      const unfrozen = await walletService.unfreezeAccount(wallet.id)
      expect(unfrozen.status).toBe('ACTIVE')

      const debitRes = await walletService.debit({
        wallet_id: wallet.id,
        amount: 5000,
        reference_type: 'INV',
        reference_id: '1',
        idempotency_key: `IDEM-FRZ-DEB2-${Date.now()}`,
        actor_scope: 'system',
        description: 'Debit unfrozen'
      })
      expect(debitRes.account.balance).toBe(20000)
    })

    it('DW-1B-010: prevents closing wallet with non-zero balance', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      await walletService.credit({
        wallet_id: wallet.id,
        amount: 10000,
        reference_type: 'ADJ',
        reference_id: '1',
        idempotency_key: `IDEM-CLS-${Date.now()}`,
        actor_scope: 'system',
        description: 'Funded'
      })

      await expect(walletService.closeAccount(wallet.id)).rejects.toThrow(
        /NON_ZERO_BALANCE|remaining balance/
      )
    })

    it('DW-1B-011: closes empty wallet and blocks all subsequent mutations', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      const closed = await walletService.closeAccount(wallet.id)
      expect(closed.status).toBe('CLOSED')

      await expect(
        walletService.credit({
          wallet_id: wallet.id,
          amount: 5000,
          reference_type: 'ADJ',
          reference_id: '1',
          idempotency_key: `IDEM-CLS-MUT-${Date.now()}`,
          actor_scope: 'system',
          description: 'Mutate closed'
        })
      ).rejects.toThrow(/Wallet account is closed|WALLET_CLOSED/)
    })
  })

  describe('4. Idempotency Invariants', () => {
    it('DW-1B-012: returns existing result on identical idempotency replay without mutating balance', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })
      const idKey = `IDEM-REPLAY-${Date.now()}`

      const call1 = await walletService.credit({
        wallet_id: wallet.id,
        amount: 75000,
        reference_type: 'TOP_UP_INTENT',
        reference_id: 'TOP-REPLAY',
        idempotency_key: idKey,
        actor_scope: 'customer',
        description: 'Replay test'
      })
      expect(call1.already_processed).toBe(false)
      expect(call1.account.balance).toBe(75000)

      // Replay exact same request
      const call2 = await walletService.credit({
        wallet_id: wallet.id,
        amount: 75000,
        reference_type: 'TOP_UP_INTENT',
        reference_id: 'TOP-REPLAY',
        idempotency_key: idKey,
        actor_scope: 'customer',
        description: 'Replay test'
      })
      expect(call2.already_processed).toBe(true)
      expect(call2.account.balance).toBe(75000)
      expect(call2.ledger.id).toBe(call1.ledger.id)

      // Verify only 1 ledger row exists
      const ledgers = await walletService.listLedgers({ wallet_id: wallet.id })
      expect(ledgers.total).toBe(1)
    })

    it('DW-1B-013: rejects replay with same idempotency key but different payload (409 Conflict)', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })
      const idKey = `IDEM-MISMATCH-${Date.now()}`

      await walletService.credit({
        wallet_id: wallet.id,
        amount: 50000,
        reference_type: 'TOP_UP_INTENT',
        reference_id: 'TOP-1',
        idempotency_key: idKey,
        actor_scope: 'customer',
        description: 'Original payload'
      })

      // Try different amount with same key
      await expect(
        walletService.credit({
          wallet_id: wallet.id,
          amount: 60000,
          reference_type: 'TOP_UP_INTENT',
          reference_id: 'TOP-1',
          idempotency_key: idKey,
          actor_scope: 'customer',
          description: 'Tampered amount'
        })
      ).rejects.toThrow(/Idempotency key has already been used|IDEMPOTENCY_PAYLOAD_MISMATCH/)
    })
  })

  describe('5. Concurrency & Pessimistic Row Locking', () => {
    it('DW-1B-014: serializes concurrent debits and prevents overdraft / negative balance', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })

      // Initial credit of 100k
      await walletService.credit({
        wallet_id: wallet.id,
        amount: 100000,
        reference_type: 'ADJ',
        reference_id: '1',
        idempotency_key: `IDEM-CONCUR-INIT-${Date.now()}`,
        actor_scope: 'system',
        description: 'Concurrent initial'
      })

      // Launch 5 parallel debits of 30k each (Total requested: 150k, Available: 100k)
      // Exactly 3 debits must succeed (3 * 30k = 90k, 10k remaining), and 2 must fail with INSUFFICIENT_FUNDS
      const promises = Array.from({ length: 5 }, (_, i) =>
        walletService
          .debit({
            wallet_id: wallet.id,
            amount: 30000,
            reference_type: 'POS_SALE',
            reference_id: `CONCUR-SALE-${i}`,
            idempotency_key: `IDEM-PARALLEL-${Date.now()}-${i}`,
            actor_scope: 'tenant',
            description: `Parallel debit ${i}`
          })
          .then((res) => ({ success: true, balance: res.account.balance }))
          .catch((err) => ({ success: false, error: err.message }))
      )

      const results = await Promise.all(promises)
      const successCount = results.filter((r) => r.success).length
      const failureCount = results.filter((r) => !r.success).length

      expect(successCount).toBe(3)
      expect(failureCount).toBe(2)

      const finalAccount = await walletService.getAccountById(wallet.id)
      expect(finalAccount.balance).toBe(10000)
    })

    it('DW-1B-015: handles concurrent requests with identical idempotency key safely', async () => {
      const acId = await createTestAccountCustomer()
      const wallet = await walletService.createAccount({ account_customer_id: acId })
      const sharedKey = `IDEM-RACE-${Date.now()}`

      // Run 3 simultaneous identical credit requests
      const promises = Array.from({ length: 3 }, () =>
        walletService.credit({
          wallet_id: wallet.id,
          amount: 50000,
          reference_type: 'TOP_UP_INTENT',
          reference_id: 'RACE-1',
          idempotency_key: sharedKey,
          actor_scope: 'customer',
          description: 'Race credit'
        })
      )

      const results = await Promise.all(promises)
      expect(results.length).toBe(3)

      const finalAccount = await walletService.getAccountById(wallet.id)
      // Balance must be exactly 50000, not 150000
      expect(finalAccount.balance).toBe(50000)

      const ledgers = await walletService.listLedgers({ wallet_id: wallet.id })
      expect(ledgers.total).toBe(1)
    })
  })
})
