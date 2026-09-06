import path from 'path'
import { randomUUID, createHash } from 'crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createSalesSyncService } from '../src/services/sales_sync_service'
import { createFinanceService } from '../src/services/finance_service'
import { createWalletService } from '../src/services/wallet_service'
import { accountRepository } from '../src/repositories/account_repository'

let pool: Pool
let salesSyncService: ReturnType<typeof createSalesSyncService>
let financeService: ReturnType<typeof createFinanceService>
let walletService: ReturnType<typeof createWalletService>

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
  financeService = createFinanceService(pool)
}, 30000)

afterAll(async () => {
  await pool.end()
}, 30000)

interface TestFixture {
  businessId: string
  branchId: string
  productId: string
  accountCustomerId: string
  walletId: string
  cashAccountId: string
  bankAccountId: string
  mobileAccountId: string
  revenueAccountId: string
}

async function setupFixture(initialBalance = 500000, initialStock = 100): Promise<TestFixture> {
  const businessId = randomUUID()
  const branchId = randomUUID()
  const productId = randomUUID()
  const accountCustomerId = randomUUID()
  const walletId = randomUUID()

  await pool.query(`INSERT INTO businesses (id, name) VALUES ($1, $2)`, [businessId, `Fixture Biz ${Date.now()}`])
  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'Main Branch', TRUE)`,
    [branchId, businessId]
  )
  await pool.query(
    `INSERT INTO products (id, business_id, name, price_minor, is_active) VALUES ($1, $2, 'Specialty Coffee', 35000, TRUE)`,
    [productId, businessId]
  )
  await pool.query(
    `INSERT INTO stocks (id, business_id, branch_id, product_id, quantity, server_version) VALUES ($1, $2, $3, $4, $5, 1)`,
    [randomUUID(), businessId, branchId, productId, initialStock]
  )
  await pool.query(
    `INSERT INTO account_customers (id, name, code, account_type, status) VALUES ($1, $2, $3, 'INDIVIDUAL', 'ACTIVE')`,
    [accountCustomerId, 'Fixture Customer', `CUST-F-${Date.now()}-${randomUUID().slice(0, 4)}`]
  )
  await pool.query(
    `INSERT INTO wallet_accounts (id, account_customer_id, business_id, wallet_number, currency, status, balance)
     VALUES ($1, $2, $3, $4, 'IDR', 'ACTIVE', $5)`,
    [walletId, accountCustomerId, businessId, `WAL-F-${Date.now()}-${randomUUID().slice(0, 4)}`, initialBalance]
  )

  // Setup standard accounting chart of accounts for business
  await accountRepository.createDefaultAccounts(pool as any, businessId)
  const cashAcc = await accountRepository.findByType(pool as any, businessId, 'cash')
  const bankAcc = await accountRepository.findByType(pool as any, businessId, 'bank')
  const mobileAcc = await accountRepository.findByType(pool as any, businessId, 'mobile')
  const revAcc = await accountRepository.findByType(pool as any, businessId, 'revenue')

  return {
    businessId,
    branchId,
    productId,
    accountCustomerId,
    walletId,
    cashAccountId: cashAcc!.id,
    bankAccountId: bankAcc!.id,
    mobileAccountId: mobileAcc!.id,
    revenueAccountId: revAcc!.id
  }
}

describe('Phase DW-2C3 — Atomic POS Wallet Settlement Service Integration', () => {
  // ---------------------------------------------------------------------------
  // A & B: Successful wallet POS sale & Mathematical Invariant
  // ---------------------------------------------------------------------------
  it('A & B: processes successful POS wallet checkout atomically with mathematical invariance', async () => {
    const fixture = await setupFixture(100000, 50)
    const saleId = randomUUID()
    const receiptNumber = `TRX-WAL-SUCCESS-${Date.now()}`
    const idempotencyKey = `idem-wal-success-${Date.now()}`
    const requestHash = createHash('sha256').update(idempotencyKey).digest('hex')

    const payload = {
      business_id: fixture.businessId,
      items: [
        {
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          sale: {
            id: saleId,
            receipt_number: receiptNumber,
            subtotal_minor: 35000,
            discount_minor: 0,
            tax_minor: 3850,
            total_minor: 38850,
            payment_method: 'wallet',
            paid_minor: 38850,
            change_minor: 0,
            cashier_id: null,
            customer_id: null,
            branch_id: fixture.branchId,
            wallet_id: fixture.walletId,
            created_at: new Date().toISOString(),
            client_created_at: new Date().toISOString()
          },
          sale_items: [
            {
              product_id: fixture.productId,
              product_name: 'Specialty Coffee',
              quantity: 1,
              unit_price_minor: 35000,
              subtotal_minor: 35000
            }
          ]
        }
      ]
    }

    const res = await salesSyncService.syncBatch(payload, fixture.businessId)
    expect(res.created_count).toBe(1)
    expect(res.results[0].status).toBe('created')
    expect(res.results[0].sale_id).toBe(saleId)

    // 1. Verify Sale Record
    const saleRes = await pool.query(`SELECT * FROM sales WHERE id = $1`, [saleId])
    expect(saleRes.rows.length).toBe(1)
    const saleRow = saleRes.rows[0]
    expect(saleRow.payment_method).toBe('wallet')
    expect(saleRow.wallet_id).toBe(fixture.walletId)
    expect(Number(saleRow.total_minor)).toBe(38850)
    expect(Number(saleRow.paid_minor)).toBe(38850)

    // 2. Verify Wallet Balance & Ledger
    const walletRes = await pool.query(`SELECT * FROM wallet_accounts WHERE id = $1`, [fixture.walletId])
    expect(Number(walletRes.rows[0].balance)).toBe(100000 - 38850)

    const ledgerRes = await pool.query(
      `SELECT * FROM wallet_ledgers WHERE wallet_id = $1 AND transaction_type = 'POS_PAYMENT'`,
      [fixture.walletId]
    )
    expect(ledgerRes.rows.length).toBe(1)
    const ledgerRow = ledgerRes.rows[0]
    expect(ledgerRow.entry_type).toBe('DEBIT')
    expect(Number(ledgerRow.amount)).toBe(38850)
    expect(ledgerRow.reference_type).toBe('SALE')
    expect(ledgerRow.reference_id).toBe(saleId)
    expect(ledgerRow.idempotency_key).toBe(`pos_wallet_${idempotencyKey}`)

    // 3. Verify Inventory Stock Deduction & Movement
    const stockRes = await pool.query(
      `SELECT * FROM stocks WHERE business_id = $1 AND branch_id = $2 AND product_id = $3`,
      [fixture.businessId, fixture.branchId, fixture.productId]
    )
    expect(stockRes.rows[0].quantity).toBe(49)

    const movementRes = await pool.query(
      `SELECT * FROM stock_movements WHERE business_id = $1 AND branch_id = $2 AND product_id = $3`,
      [fixture.businessId, fixture.branchId, fixture.productId]
    )
    expect(movementRes.rows.length).toBe(1)
    expect(movementRes.rows[0].quantity).toBe(-1)
    expect(movementRes.rows[0].movement_type).toBe('SALE')

    // 4. Verify Accounting GL Posting
    const posting = await financeService.postSale(saleId, fixture.businessId)
    expect(posting.journalId).toBeDefined()

    const journalLines = await pool.query(
      `SELECT * FROM journal_lines WHERE journal_entry_id = $1 ORDER BY debit_minor DESC`,
      [posting.journalId]
    )
    expect(journalLines.rows.length).toBe(2)
    // Debit to Mobile (Digital Wallet Clearing)
    expect(journalLines.rows[0].account_id).toBe(fixture.mobileAccountId)
    expect(Number(journalLines.rows[0].debit_minor)).toBe(38850)
    expect(Number(journalLines.rows[0].credit_minor)).toBe(0)
    // Credit to Revenue
    expect(journalLines.rows[1].account_id).toBe(fixture.revenueAccountId)
    expect(Number(journalLines.rows[1].debit_minor)).toBe(0)
    expect(Number(journalLines.rows[1].credit_minor)).toBe(38850)

    // Mathematical Invariant Equation: sale.total_minor == wallet_ledgers.amount == paid_minor == GL amount
    expect(Number(saleRow.total_minor)).toBe(Number(ledgerRow.amount))
    expect(Number(saleRow.paid_minor)).toBe(Number(ledgerRow.amount))
    expect(Number(journalLines.rows[0].debit_minor)).toBe(Number(ledgerRow.amount))
    expect(Number(journalLines.rows[1].credit_minor)).toBe(Number(ledgerRow.amount))
  })

  // ---------------------------------------------------------------------------
  // C: Insufficient wallet balance rolls back everything atomically
  // ---------------------------------------------------------------------------
  it('C: cleanly rolls back sale, inventory, and ledger when wallet balance is insufficient', async () => {
    const fixture = await setupFixture(10000, 20) // Balance is only 10,000, total will be 38,850
    const saleId = randomUUID()
    const receiptNumber = `TRX-INSUFFICIENT-${Date.now()}`
    const idempotencyKey = `idem-insufficient-${Date.now()}`
    const requestHash = createHash('sha256').update(idempotencyKey).digest('hex')

    const payload = {
      business_id: fixture.businessId,
      items: [
        {
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          sale: {
            id: saleId,
            receipt_number: receiptNumber,
            subtotal_minor: 35000,
            discount_minor: 0,
            tax_minor: 3850,
            total_minor: 38850,
            payment_method: 'wallet',
            paid_minor: 38850,
            change_minor: 0,
            cashier_id: null,
            customer_id: null,
            branch_id: fixture.branchId,
            wallet_id: fixture.walletId,
            created_at: new Date().toISOString(),
            client_created_at: new Date().toISOString()
          },
          sale_items: [
            {
              product_id: fixture.productId,
              product_name: 'Specialty Coffee',
              quantity: 1,
              unit_price_minor: 35000,
              subtotal_minor: 35000
            }
          ]
        }
      ]
    }

    await expect(salesSyncService.syncBatch(payload, fixture.businessId)).rejects.toMatchObject({
      status: 400,
      code: 'INSUFFICIENT_BALANCE'
    })

    // Assert zero side-effects:
    // 1. Sale not created
    const saleRes = await pool.query(`SELECT * FROM sales WHERE id = $1`, [saleId])
    expect(saleRes.rows.length).toBe(0)

    // 2. Inventory unchanged
    const stockRes = await pool.query(
      `SELECT * FROM stocks WHERE business_id = $1 AND branch_id = $2 AND product_id = $3`,
      [fixture.businessId, fixture.branchId, fixture.productId]
    )
    expect(stockRes.rows[0].quantity).toBe(20)

    // 3. Wallet balance unchanged
    const walletRes = await pool.query(`SELECT * FROM wallet_accounts WHERE id = $1`, [fixture.walletId])
    expect(Number(walletRes.rows[0].balance)).toBe(10000)

    // 4. No wallet ledger created
    const ledgerRes = await pool.query(`SELECT * FROM wallet_ledgers WHERE wallet_id = $1`, [fixture.walletId])
    expect(ledgerRes.rows.length).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // D: Missing wallet_id rejected cleanly
  // ---------------------------------------------------------------------------
  it('D: rejects wallet payment when wallet_id is missing', async () => {
    const fixture = await setupFixture(100000)
    const saleId = randomUUID()
    const idempotencyKey = `idem-missing-wal-${Date.now()}`
    const requestHash = createHash('sha256').update(idempotencyKey).digest('hex')

    const payload = {
      business_id: fixture.businessId,
      items: [
        {
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          sale: {
            id: saleId,
            receipt_number: `TRX-MISSING-WAL-${Date.now()}`,
            subtotal_minor: 35000,
            discount_minor: 0,
            tax_minor: 0,
            total_minor: 35000,
            payment_method: 'wallet',
            paid_minor: 35000,
            change_minor: 0,
            cashier_id: null,
            customer_id: null,
            branch_id: fixture.branchId,
            wallet_id: null, // missing
            created_at: new Date().toISOString(),
            client_created_at: new Date().toISOString()
          },
          sale_items: [
            {
              product_id: fixture.productId,
              product_name: 'Specialty Coffee',
              quantity: 1,
              unit_price_minor: 35000,
              subtotal_minor: 35000
            }
          ]
        }
      ]
    }

    await expect(salesSyncService.syncBatch(payload, fixture.businessId)).rejects.toThrow(/wallet_id is required/)
  })

  // ---------------------------------------------------------------------------
  // E: Cross-tenant wallet rejected
  // ---------------------------------------------------------------------------
  it('E: rejects cross-tenant wallet settlement attempt with 403', async () => {
    const fixtureA = await setupFixture(100000)
    const fixtureB = await setupFixture(100000)

    const saleId = randomUUID()
    const idempotencyKey = `idem-cross-tenant-${Date.now()}`
    const requestHash = createHash('sha256').update(idempotencyKey).digest('hex')

    const payload = {
      business_id: fixtureA.businessId,
      items: [
        {
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          sale: {
            id: saleId,
            receipt_number: `TRX-CROSS-${Date.now()}`,
            subtotal_minor: 35000,
            discount_minor: 0,
            tax_minor: 0,
            total_minor: 35000,
            payment_method: 'wallet',
            paid_minor: 35000,
            change_minor: 0,
            cashier_id: null,
            customer_id: null,
            branch_id: fixtureA.branchId,
            wallet_id: fixtureB.walletId, // Wallet from Tenant B attempted on Tenant A
            created_at: new Date().toISOString(),
            client_created_at: new Date().toISOString()
          },
          sale_items: [
            {
              product_id: fixtureA.productId,
              product_name: 'Specialty Coffee',
              quantity: 1,
              unit_price_minor: 35000,
              subtotal_minor: 35000
            }
          ]
        }
      ]
    }

    await expect(salesSyncService.syncBatch(payload, fixtureA.businessId)).rejects.toMatchObject({
      status: 403,
      code: 'BUSINESS_ACCESS_DENIED'
    })
  })

  // ---------------------------------------------------------------------------
  // F: Frozen / closed wallet rejected
  // ---------------------------------------------------------------------------
  it('F: rejects settlement against frozen wallet with 400', async () => {
    const fixture = await setupFixture(100000)
    await pool.query(`UPDATE wallet_accounts SET status = 'FROZEN' WHERE id = $1`, [fixture.walletId])

    const saleId = randomUUID()
    const idempotencyKey = `idem-frozen-${Date.now()}`
    const requestHash = createHash('sha256').update(idempotencyKey).digest('hex')

    const payload = {
      business_id: fixture.businessId,
      items: [
        {
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          sale: {
            id: saleId,
            receipt_number: `TRX-FROZEN-${Date.now()}`,
            subtotal_minor: 35000,
            discount_minor: 0,
            tax_minor: 0,
            total_minor: 35000,
            payment_method: 'wallet',
            paid_minor: 35000,
            change_minor: 0,
            cashier_id: null,
            customer_id: null,
            branch_id: fixture.branchId,
            wallet_id: fixture.walletId,
            created_at: new Date().toISOString(),
            client_created_at: new Date().toISOString()
          },
          sale_items: [
            {
              product_id: fixture.productId,
              product_name: 'Specialty Coffee',
              quantity: 1,
              unit_price_minor: 35000,
              subtotal_minor: 35000
            }
          ]
        }
      ]
    }

    await expect(salesSyncService.syncBatch(payload, fixture.businessId)).rejects.toMatchObject({
      status: 400,
      code: 'WALLET_FROZEN'
    })
  })

  // ---------------------------------------------------------------------------
  // G: Idempotency: replay and conflict detection
  // ---------------------------------------------------------------------------
  describe('G: Idempotency Handling', () => {
    it('returns cached response on identical replay without duplicate debit', async () => {
      const fixture = await setupFixture(100000)
      const saleId = randomUUID()
      const receiptNumber = `TRX-IDEM-PLAY-${Date.now()}`
      const idempotencyKey = `idem-play-${Date.now()}`
      const requestHash = createHash('sha256').update(idempotencyKey).digest('hex')

      const payload = {
        business_id: fixture.businessId,
        items: [
          {
            idempotency_key: idempotencyKey,
            request_hash: requestHash,
            sale: {
              id: saleId,
              receipt_number: receiptNumber,
              subtotal_minor: 20000,
              discount_minor: 0,
              tax_minor: 0,
              total_minor: 20000,
              payment_method: 'wallet',
              paid_minor: 20000,
              change_minor: 0,
              cashier_id: null,
              customer_id: null,
              branch_id: fixture.branchId,
              wallet_id: fixture.walletId,
              created_at: new Date().toISOString(),
              client_created_at: new Date().toISOString()
            },
            sale_items: [
              {
                product_id: fixture.productId,
                product_name: 'Specialty Coffee',
                quantity: 1,
                unit_price_minor: 20000,
                subtotal_minor: 20000
              }
            ]
          }
        ]
      }

      // First run: creates
      const firstRes = await salesSyncService.syncBatch(payload, fixture.businessId)
      expect(firstRes.created_count).toBe(1)
      expect(firstRes.results[0].status).toBe('created')

      // Second run with same key & hash: replays
      const replayRes = await salesSyncService.syncBatch(payload, fixture.businessId)
      expect(replayRes.replayed_count).toBe(1)
      expect(replayRes.results[0].status).toBe('replayed')
      expect(replayRes.results[0].sale_id).toBe(saleId)

      // Verify wallet was debited EXACTLY ONCE
      const walletRes = await pool.query(`SELECT * FROM wallet_accounts WHERE id = $1`, [fixture.walletId])
      expect(Number(walletRes.rows[0].balance)).toBe(80000)

      const ledgers = await pool.query(`SELECT * FROM wallet_ledgers WHERE wallet_id = $1`, [fixture.walletId])
      expect(ledgers.rows.length).toBe(1)
    })

    it('rejects with 409 Conflict when idempotency key is reused with different request hash', async () => {
      const fixture = await setupFixture(100000)
      const idempotencyKey = `idem-conflict-${Date.now()}`
      const hash1 = 'hash-initial'
      const hash2 = 'hash-mismatch'

      const payload1 = {
        business_id: fixture.businessId,
        items: [
          {
            idempotency_key: idempotencyKey,
            request_hash: hash1,
            sale: {
              id: randomUUID(),
              receipt_number: `TRX-CONF-1-${Date.now()}`,
              subtotal_minor: 10000,
              discount_minor: 0,
              tax_minor: 0,
              total_minor: 10000,
              payment_method: 'wallet',
              paid_minor: 10000,
              change_minor: 0,
              cashier_id: null,
              customer_id: null,
              branch_id: fixture.branchId,
              wallet_id: fixture.walletId,
              created_at: new Date().toISOString(),
              client_created_at: new Date().toISOString()
            },
            sale_items: [
              {
                product_id: fixture.productId,
                product_name: 'Specialty Coffee',
                quantity: 1,
                unit_price_minor: 10000,
                subtotal_minor: 10000
              }
            ]
          }
        ]
      }

      await salesSyncService.syncBatch(payload1, fixture.businessId)

      const payload2 = {
        ...payload1,
        items: [
          {
            ...payload1.items[0],
            request_hash: hash2 // Mismatch hash
          }
        ]
      }

      await expect(salesSyncService.syncBatch(payload2, fixture.businessId)).rejects.toMatchObject({
        status: 409,
        code: 'IDEMPOTENCY_KEY_REUSE'
      })
    })
  })

  // ---------------------------------------------------------------------------
  // H: Concurrency & Overdraft Protection
  // ---------------------------------------------------------------------------
  it('H: serializes concurrent checkouts with zero overdraft', async () => {
    const fixture = await setupFixture(50000, 50) // Wallet balance is 50,000; each checkout costs 30,000 -> only 1 can succeed

    const makeCheckout = (idx: number) => {
      const saleId = randomUUID()
      const idempotencyKey = `idem-concurrent-${idx}-${Date.now()}`
      const requestHash = createHash('sha256').update(idempotencyKey).digest('hex')

      return salesSyncService.syncBatch(
        {
          business_id: fixture.businessId,
          items: [
            {
              idempotency_key: idempotencyKey,
              request_hash: requestHash,
              sale: {
                id: saleId,
                receipt_number: `TRX-CONC-${idx}-${Date.now()}`,
                subtotal_minor: 30000,
                discount_minor: 0,
                tax_minor: 0,
                total_minor: 30000,
                payment_method: 'wallet',
                paid_minor: 30000,
                change_minor: 0,
                cashier_id: null,
                customer_id: null,
                branch_id: fixture.branchId,
                wallet_id: fixture.walletId,
                created_at: new Date().toISOString(),
                client_created_at: new Date().toISOString()
              },
              sale_items: [
                {
                  product_id: fixture.productId,
                  product_name: 'Specialty Coffee',
                  quantity: 1,
                  unit_price_minor: 30000,
                  subtotal_minor: 30000
                }
              ]
            }
          ]
        },
        fixture.businessId
      )
    }

    const results = await Promise.allSettled([makeCheckout(1), makeCheckout(2)])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    expect(fulfilled.length).toBe(1)
    expect(rejected.length).toBe(1)

    // Final balance is exactly 50000 - 30000 = 20000 (never negative)
    const walletRes = await pool.query(`SELECT * FROM wallet_accounts WHERE id = $1`, [fixture.walletId])
    expect(Number(walletRes.rows[0].balance)).toBe(20000)
  })

  // ---------------------------------------------------------------------------
  // I: Existing POS payment methods (cash, bank_transfer, debit, credit)
  // ---------------------------------------------------------------------------
  it('I: preserves existing non-wallet POS checkout methods', async () => {
    const fixture = await setupFixture(0, 100)
    const methods = ['cash', 'bank_transfer', 'debit', 'credit']

    for (const method of methods) {
      const saleId = randomUUID()
      const receiptNumber = `TRX-NONWAL-${method}-${Date.now()}`
      const idempotencyKey = `idem-nonwal-${method}-${Date.now()}`
      const requestHash = createHash('sha256').update(idempotencyKey).digest('hex')

      const payload = {
        business_id: fixture.businessId,
        items: [
          {
            idempotency_key: idempotencyKey,
            request_hash: requestHash,
            sale: {
              id: saleId,
              receipt_number: receiptNumber,
              subtotal_minor: 25000,
              discount_minor: 0,
              tax_minor: 0,
              total_minor: 25000,
              payment_method: method,
              paid_minor: 25000,
              change_minor: 0,
              cashier_id: null,
              customer_id: null,
              branch_id: fixture.branchId,
              wallet_id: null,
              created_at: new Date().toISOString(),
              client_created_at: new Date().toISOString()
            },
            sale_items: [
              {
                product_id: fixture.productId,
                product_name: 'Specialty Coffee',
                quantity: 1,
                unit_price_minor: 25000,
                subtotal_minor: 25000
              }
            ]
          }
        ]
      }

      const res = await salesSyncService.syncBatch(payload, fixture.businessId)
      expect(res.created_count).toBe(1)
      expect(res.results[0].status).toBe('created')

      // Verify finance posting succeeds for all standard methods
      const posting = await financeService.postSale(saleId, fixture.businessId)
      expect(posting.journalId).toBeDefined()
    }
  })
})
