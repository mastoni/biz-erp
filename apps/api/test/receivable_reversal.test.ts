import path from 'path'
import { randomUUID } from 'crypto'
import { Pool, PoolClient } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createFinanceService } from '../src/services/finance_service'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'

let pool!: Pool
let client!: PoolClient
let businessId!: string
let branchId!: string
let customerId!: string

beforeAll(async () => {
  const dbUrl =
    process.env.RECEIVABLE_REVERSAL_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)
  await runMigrations(pool, path.resolve(__dirname, '../migrations'))

  businessId = BUSINESS_A
  branchId = BRANCH_A

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, 'Rev Business A'), ($2, 'Rev Business B') ON CONFLICT (id) DO NOTHING`,
    [businessId, BUSINESS_B]
  )
  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'Branch A', true) ON CONFLICT (id) DO NOTHING`,
    [branchId, businessId]
  )

  customerId = randomUUID()
  await pool.query(
    `INSERT INTO customers (id, business_id, name) VALUES ($1, $2, 'Rev Customer') ON CONFLICT (id) DO NOTHING`,
    [customerId, businessId]
  )

  const accounts = [
    { type: 'cash', code: '100', name: 'Cash' },
    { type: 'bank', code: '101', name: 'Bank' },
    { type: 'receivable', code: '110', name: 'Accounts Receivable' },
    { type: 'revenue', code: '500', name: 'Revenue' },
  ]
  for (const acc of accounts) {
    await pool.query(
      `INSERT INTO accounts (id, business_id, code, name, type, currency, active, created_at, server_version)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'IDR', true, now(), 1)
       ON CONFLICT (business_id, code) DO NOTHING`,
      [businessId, acc.code, acc.name, acc.type]
    )
  }

  client = await pool.connect()
})

beforeEach(async () => {
  await client.query(`UPDATE receivables SET deleted_at = now() WHERE business_id = $1 AND deleted_at IS NULL`, [businessId])
  await client.query(`TRUNCATE customer_payments, journal_entries, journal_lines RESTART IDENTITY CASCADE`)
})

afterAll(async () => {
  await client.release()
  await pool.end()
})

async function createCreditSale(overrides: {
  total_minor?: number
  paid_minor?: number
  payment_method?: string
} = {}): Promise<{ saleId: string; receivableId: string }> {
  const saleId = randomUUID()
  const total = overrides.total_minor ?? 100000
  const paid = overrides.paid_minor ?? 30000
  await pool.query(
    `INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      saleId, businessId, branchId, `REV-SALE-${saleId.slice(0, 8)}`,
      total, 0, 0, total,
      overrides.payment_method ?? 'cash',
      paid, 0, null, customerId,
      '2026-01-01', '2026-01-01', '2026-01-01'
    ]
  )

  const service = createFinanceService(pool)
  const result = await service.postSale(saleId, businessId)
  return { saleId, receivableId: result.receivableId! }
}

async function createPayment(
  receivableId: string,
  amountMinor: number,
  method: 'cash' | 'bank_transfer' | 'debit' | 'credit' = 'cash',
  reference?: string
): Promise<{ paymentId: string; journalId: string }> {
  const service = createFinanceService(pool)
  const result = await service.collectCustomerPayment(
    receivableId,
    businessId,
    amountMinor,
    method,
    customerId,
    reference ?? `PAY-${randomUUID().slice(0, 8)}`
  )
  return { paymentId: result.paymentId, journalId: result.journalId }
}

async function getJournalLines(journalId: string) {
  const res = await client.query(
    `SELECT jl.account_id, jl.debit_minor, jl.credit_minor
     FROM journal_lines jl
     WHERE jl.journal_entry_id = $1`,
    [journalId]
  )
  return res.rows
}

async function getAccountType(accountId: string): Promise<string> {
  const res = await client.query(`SELECT type FROM accounts WHERE id = $1`, [accountId])
  return res.rows[0]?.type ?? 'unknown'
}

async function getAccountTypesForLines(lines: Array<{ account_id: string }>) {
  return Promise.all(lines.map((l) => getAccountType(l.account_id)))
}

async function getJournalEntry(journalId: string) {
  const res = await client.query(
    `SELECT id, business_id, branch_id, date, source_type, source_id, status, reversal_of, reversed_by, reversal_of
     FROM journal_entries WHERE id = $1`,
    [journalId]
  )
  return res.rows[0]
}

async function getReceivable(receivableId: string) {
  const res = await client.query(
    `SELECT id, business_id, sale_id, customer_id, branch_id, amount_minor, paid_minor, outstanding_minor, status, server_version, deleted_at
     FROM receivables WHERE id = $1`,
    [receivableId]
  )
  return res.rows[0]
}

async function getPayment(paymentId: string) {
  const res = await client.query(
    `SELECT id, business_id, receivable_id, amount_minor, method, idempotency_key FROM customer_payments WHERE id = $1`,
    [paymentId]
  )
  return res.rows[0]
}

async function findJournalBySource(sourceType: string, sourceId: string) {
  const res = await client.query(
    `SELECT id, status, reversed_by FROM journal_entries WHERE business_id = $1 AND source_type = $2 AND source_id = $3`,
    [businessId, sourceType, sourceId]
  )
  return res.rows[0]
}

describe('9C.6F Receivable Reversal', () => {
  describe('Customer Payment Reversal', () => {
    it('AR-REV-001: customer payment reversal', async () => {
      const { receivableId } = await createCreditSale()
      const { paymentId } = await createPayment(receivableId, 30000, 'cash', 'REV-001')

      const service = createFinanceService(pool)
      const result = await service.reverseCustomerPayment(paymentId, businessId)

      expect(result.reversalId).toBeDefined()

      const reversalJournal = await getJournalEntry(result.reversalId)
      expect(reversalJournal.source_type).toBe('REVERSAL')
      expect(reversalJournal.status).toBe('posted')
      expect(reversalJournal.reversal_of).toBeDefined()
    })

    it('AR-REV-002: payment reversal restores paid', async () => {
      const { receivableId } = await createCreditSale()
      const { paymentId } = await createPayment(receivableId, 30000, 'cash', 'REV-002')

      const revBefore = await getReceivable(receivableId)
      expect(revBefore.paid_minor).toBe(30000)

      const service = createFinanceService(pool)
      await service.reverseCustomerPayment(paymentId, businessId)

      const revAfter = await getReceivable(receivableId)
      expect(revAfter.paid_minor).toBe(0)
    })

    it('AR-REV-003: payment reversal restores outstanding', async () => {
      const { receivableId } = await createCreditSale()
      const { paymentId } = await createPayment(receivableId, 30000, 'cash', 'REV-003')

      const service = createFinanceService(pool)

      const revBefore = await getReceivable(receivableId)
      expect(revBefore.outstanding_minor).toBe(40000)

      await service.reverseCustomerPayment(paymentId, businessId)

      const revAfter = await getReceivable(receivableId)
      expect(revAfter.outstanding_minor).toBe(70000)
    })

    it('AR-REV-004: OPEN restored', async () => {
      const { receivableId } = await createCreditSale()
      const { paymentId } = await createPayment(receivableId, 70000, 'cash', 'REV-004')

      const rev = await getReceivable(receivableId)
      expect(rev.status).toBe('PAID')

      const service = createFinanceService(pool)
      await service.reverseCustomerPayment(paymentId, businessId)

      const revAfter = await getReceivable(receivableId)
      expect(revAfter.status).toBe('OPEN')
    })

    it('AR-REV-005: PARTIAL restored', async () => {
      const { receivableId } = await createCreditSale()

      const revBefore = await getReceivable(receivableId)
      expect(revBefore.status).toBe('OPEN')

      const { paymentId } = await createPayment(receivableId, 30000, 'cash', 'REV-005')

      const revAfterPayment = await getReceivable(receivableId)
      expect(revAfterPayment.status).toBe('PARTIAL')

      const service = createFinanceService(pool)
      await service.reverseCustomerPayment(paymentId, businessId)

      const revAfterReversal = await getReceivable(receivableId)
      expect(revAfterReversal.status).toBe('OPEN')
    })

    it('AR-REV-006: payment row unchanged', async () => {
      const { receivableId } = await createCreditSale()
      const { paymentId } = await createPayment(receivableId, 30000, 'cash', 'REV-006')

      const paymentBefore = await getPayment(paymentId)

      const service = createFinanceService(pool)
      await service.reverseCustomerPayment(paymentId, businessId)

      const paymentAfter = await getPayment(paymentId)
      expect(paymentAfter.amount_minor).toBe(paymentBefore.amount_minor)
      expect(paymentAfter.method).toBe(paymentBefore.method)
      expect(paymentAfter.idempotency_key).toBe(paymentBefore.idempotency_key)
    })

    it('AR-REV-007: payment journal reversed', async () => {
      const { receivableId } = await createCreditSale()
      const { paymentId } = await createPayment(receivableId, 30000, 'cash', 'REV-007')

      const originalJournal = await findJournalBySource('CUSTOMER_PAYMENT', paymentId)
      expect(originalJournal).toBeDefined()

      const service = createFinanceService(pool)
      await service.reverseCustomerPayment(paymentId, businessId)

      const journalAfter = await getJournalEntry(originalJournal.id)
      expect(journalAfter.status).toBe('reversed')
      expect(journalAfter.reversed_by).toBeDefined()
    })

    it('AR-REV-008: reversal journal balanced', async () => {
      const { receivableId } = await createCreditSale()
      const { paymentId } = await createPayment(receivableId, 30000, 'bank_transfer', 'REV-008')

      const service = createFinanceService(pool)
      const result = await service.reverseCustomerPayment(paymentId, businessId)

      const lines = await getJournalLines(result.reversalId)
      let totalDebit = 0
      let totalCredit = 0
      for (const l of lines) {
        totalDebit += Number(l.debit_minor)
        totalCredit += Number(l.credit_minor)
      }
      expect(totalDebit).toBe(totalCredit)
    })

    it('AR-REV-009: second payment reversal rejected', async () => {
      const { receivableId } = await createCreditSale()
      const { paymentId } = await createPayment(receivableId, 30000, 'cash', 'REV-009')

      const service = createFinanceService(pool)
      await service.reverseCustomerPayment(paymentId, businessId)

      await expect(
        service.reverseCustomerPayment(paymentId, businessId)
      ).rejects.toThrow(/already been reversed/)
    })

    it('AR-REV-010: reversed receivable rejects payment reversal', async () => {
      const { receivableId } = await createCreditSale()
      const { paymentId } = await createPayment(receivableId, 30000, 'cash', 'REV-010')

      await client.query(
        `UPDATE receivables SET status = 'REVERSED', server_version = server_version + 1 WHERE id = $1`,
        [receivableId]
      )

      const service = createFinanceService(pool)
      await expect(
        service.reverseCustomerPayment(paymentId, businessId)
      ).rejects.toThrow(/Receivable already reversed/)
    })
  })

  describe('Credit Sale Reversal', () => {
    it('AR-REV-011: credit-sale reversal', async () => {
      const { saleId, receivableId } = await createCreditSale()

      const service = createFinanceService(pool)
      const result = await service.reverseCreditSale(saleId, businessId)

      expect(result.reversalIds).toHaveLength(2)
      expect(result.reversalIds[0]).toBeDefined()
      expect(result.reversalIds[1]).toBeDefined()
    })

    it('AR-REV-012: SALE journal reversed', async () => {
      const { saleId, receivableId } = await createCreditSale()

      const originalJournal = await findJournalBySource('SALE', saleId)
      expect(originalJournal).toBeDefined()
      expect(originalJournal.status).toBe('posted')

      const service = createFinanceService(pool)
      await service.reverseCreditSale(saleId, businessId)

      const journalAfter = await getJournalEntry(originalJournal.id)
      expect(journalAfter.status).toBe('reversed')
      expect(journalAfter.reversed_by).toBeDefined()
    })

    it('AR-REV-013: RECEIVABLE journal reversed', async () => {
      const { saleId, receivableId } = await createCreditSale()

      const originalJournal = await findJournalBySource('RECEIVABLE', receivableId)
      expect(originalJournal).toBeDefined()
      expect(originalJournal.status).toBe('posted')

      const service = createFinanceService(pool)
      await service.reverseCreditSale(saleId, businessId)

      const journalAfter = await getJournalEntry(originalJournal.id)
      expect(journalAfter.status).toBe('reversed')
      expect(journalAfter.reversed_by).toBeDefined()
    })

    it('AR-REV-014: receivable status REVERSED', async () => {
      const { saleId, receivableId } = await createCreditSale()

      const service = createFinanceService(pool)
      await service.reverseCreditSale(saleId, businessId)

      const rev = await getReceivable(receivableId)
      expect(rev.status).toBe('REVERSED')
    })

    it('AR-REV-015: receivable amount preserved', async () => {
      const { saleId, receivableId } = await createCreditSale({ total_minor: 100000, paid_minor: 30000 })

      const revBefore = await getReceivable(receivableId)
      expect(revBefore.amount_minor).toBe(70000)

      const service = createFinanceService(pool)
      await service.reverseCreditSale(saleId, businessId)

      const revAfter = await getReceivable(receivableId)
      expect(revAfter.amount_minor).toBe(70000)
    })

    it('AR-REV-016: receivable balances preserved', async () => {
      const { saleId, receivableId } = await createCreditSale({ total_minor: 100000, paid_minor: 30000 })

      const revBefore = await getReceivable(receivableId)
      expect(revBefore.paid_minor).toBe(0)
      expect(revBefore.outstanding_minor).toBe(70000)

      const service = createFinanceService(pool)
      await service.reverseCreditSale(saleId, businessId)

      const revAfter = await getReceivable(receivableId)
      expect(revAfter.paid_minor).toBe(0)
      expect(revAfter.outstanding_minor).toBe(70000)
    })

    it('AR-REV-017: active payment blocks credit-sale reversal', async () => {
      const { saleId, receivableId } = await createCreditSale()
      await createPayment(receivableId, 30000, 'cash', 'REV-017')

      const service = createFinanceService(pool)
      await expect(
        service.reverseCreditSale(saleId, businessId)
      ).rejects.toThrow(/active customer payments/)
    })

    it('AR-REV-018: all reversals atomic', async () => {
      const { saleId, receivableId } = await createCreditSale()
      await createPayment(receivableId, 30000, 'cash', 'REV-018')

      const service = createFinanceService(pool)
      await expect(
        service.reverseCreditSale(saleId, businessId)
      ).rejects.toThrow(/active customer payments/)

      const receivableAfter = await getReceivable(receivableId)
      expect(receivableAfter.status).toBe('PARTIAL')

      const saleJournal = await findJournalBySource('SALE', saleId)
      const revJournal = await findJournalBySource('RECEIVABLE', receivableId)
      expect(saleJournal.status).toBe('posted')
      expect(revJournal.status).toBe('posted')
    })

    it('AR-REV-019: tenant isolation', async () => {
      const { saleId } = await createCreditSale()

      const service = createFinanceService(pool)
      await expect(
        service.reverseCreditSale(saleId, BUSINESS_B)
      ).rejects.toThrow(/not found/)
    })

    it('AR-REV-020: concurrent reversal protection', async () => {
      const { saleId, receivableId } = await createCreditSale()

      const service = createFinanceService(pool)

      const results: Array<{ ok: boolean; err: string | null }> = []

      await Promise.all([
        service.reverseCreditSale(saleId, businessId).then(
          () => ({ ok: true, err: null }),
          (e: Error) => ({ ok: false, err: e.message })
        ),
        service.reverseCreditSale(saleId, businessId).then(
          () => ({ ok: true, err: null }),
          (e: Error) => ({ ok: false, err: e.message })
        ),
      ]).then(([r1, r2]) => results.push(r1, r2))

      const successes = results.filter((r) => r.ok)
      const failures = results.filter((r) => !r.ok)
      expect(successes.length).toBe(1)
      expect(failures.length).toBe(1)
      expect(results.some((r) => r.err && r.err.includes('already reversed'))).toBe(true)

      const rev = await getReceivable(receivableId)
      expect(rev.status).toBe('REVERSED')
    })
  })
})
