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
    process.env.RECEIVABLE_SERVICE_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)
  await runMigrations(pool, path.resolve(__dirname, '../migrations'))

  businessId = BUSINESS_A
  branchId = BRANCH_A

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, 'AR Service Business A'), ($2, 'AR Service Business B') ON CONFLICT (id) DO NOTHING`,
    [businessId, BUSINESS_B]
  )
  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'Branch A', true) ON CONFLICT (id) DO NOTHING`,
    [branchId, businessId]
  )

  customerId = randomUUID()
  await pool.query(
    `INSERT INTO customers (id, business_id, name) VALUES ($1, $2, 'Service Customer') ON CONFLICT (id) DO NOTHING`,
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

async function createSale(overrides: {
  total_minor?: number
  paid_minor?: number
  customer_id?: string | null
  payment_method?: string
  receipt_number?: string
} = {}): Promise<string> {
  const saleId = randomUUID()
  const cid = 'customer_id' in overrides ? (overrides.customer_id ?? null) : customerId
  await pool.query(
    `INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      saleId,
      businessId,
      branchId,
      overrides.receipt_number ?? `SALE-${saleId.slice(0, 8)}`,
      overrides.total_minor ?? 100000,
      0,
      0,
      overrides.total_minor ?? 100000,
      overrides.payment_method ?? 'cash',
      overrides.paid_minor ?? 0,
      0,
      null,
      cid,
      '2026-01-01',
      '2026-01-01',
      '2026-01-01',
    ]
  )
  return saleId
}

function getService() {
  return createFinanceService(pool)
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
  return res.rows[0].type
}

async function getAccountTypesForLines(lines: Array<{ account_id: string }>) {
  return Promise.all(lines.map((l) => getAccountType(l.account_id)))
}

describe('9C.6D AR Service', () => {
  it('AR-SVC-001: fully-paid sale unchanged', async () => {
    const saleId = await createSale({ total_minor: 100000, paid_minor: 100000 })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    expect(result.receivableId).toBeNull()

    const saleJournal = await client.query(
      `SELECT source_type, status FROM journal_entries WHERE id = $1`,
      [result.journalId]
    )
    expect(saleJournal.rows[0].source_type).toBe('SALE')
    expect(saleJournal.rows[0].status).toBe('posted')

    const lines = await getJournalLines(result.journalId)
    const revenueCredit = lines.find((l) => l.credit_minor > 0)
    expect(revenueCredit!.credit_minor).toBe(100000)
  })

  it('AR-SVC-002: credit sale requires customer', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: null,
    })
    const service = getService()
    await expect(service.postSale(saleId, businessId)).rejects.toThrow(/customer/)
  })

  it('AR-SVC-003: credit sale SALE journal cash portion', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
      payment_method: 'cash',
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    const lines = await getJournalLines(result.journalId)
    const types = await getAccountTypesForLines(lines)
    const cashLine = lines.find((_l, i) => types[i] === 'cash')
    expect(cashLine!.debit_minor).toBe(30000)
  })

  it('AR-SVC-004: credit sale RECEIVABLE journal', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    expect(result.receivableId).toBeDefined()

    const receivableJournal = await client.query(
      `SELECT id FROM journal_entries WHERE business_id = $1 AND source_type = 'RECEIVABLE' AND source_id = $2`,
      [businessId, result.receivableId]
    )
    expect(receivableJournal.rows.length).toBe(1)

    const revLines = await getJournalLines(receivableJournal.rows[0].id)
    const types = await getAccountTypesForLines(revLines)
    const arLine = revLines.find((_l, i) => types[i] === 'receivable')
    expect(arLine!.debit_minor).toBe(70000)

    const revCredit = revLines.find((_l, i) => types[i] === 'revenue')
    expect(revCredit!.credit_minor).toBe(70000)
  })

  it('AR-SVC-005: revenue-once', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    await service.postSale(saleId, businessId)

    const revenueJournals = await client.query(
      `SELECT je.id FROM journal_entries je
       JOIN journal_lines jl ON jl.journal_entry_id = je.id
       WHERE je.business_id = $1 AND je.status = 'posted'
       AND jl.account_id IN (SELECT id FROM accounts WHERE business_id = $1 AND type = 'revenue')`,
      [businessId]
    )

    let totalRevenueCredit = 0
    for (const je of revenueJournals.rows) {
      const lines = await getJournalLines(je.id)
      for (const l of lines) {
        totalRevenueCredit += Number(l.credit_minor)
      }
    }
    expect(totalRevenueCredit).toBe(100000)
  })

  it('AR-SVC-006: receivable amount correct', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    const rev = await client.query(
      `SELECT amount_minor, paid_minor, outstanding_minor, status FROM receivables WHERE id = $1`,
      [result.receivableId]
    )
    expect(rev.rows[0].amount_minor).toBe(70000)
    expect(rev.rows[0].paid_minor).toBe(0)
    expect(rev.rows[0].outstanding_minor).toBe(70000)
    expect(rev.rows[0].status).toBe('OPEN')
  })

  it('AR-SVC-007: receivable branch copied', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    const rev = await client.query(`SELECT branch_id FROM receivables WHERE id = $1`, [result.receivableId])
    expect(rev.rows[0].branch_id).toBe(branchId)
  })

  it('AR-SVC-008: receivable customer copied', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    const rev = await client.query(`SELECT customer_id FROM receivables WHERE id = $1`, [result.receivableId])
    expect(rev.rows[0].customer_id).toBe(customerId)
  })

  it('AR-SVC-009: posted credit sale replay idempotent', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result1 = await service.postSale(saleId, businessId)
    const result2 = await service.postSale(saleId, businessId)

    expect(result1.journalId).toBe(result2.journalId)
    expect(result1.receivableId).toBe(result2.receivableId)
  })

  it('AR-SVC-010: duplicate credit sale prevented', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    await service.postSale(saleId, businessId)

    const saleJournal = await client.query(
      `SELECT COUNT(*)::int AS count FROM journal_entries WHERE business_id = $1 AND source_type = 'SALE' AND source_id = $2`,
      [businessId, saleId]
    )
    expect(saleJournal.rows[0].count).toBe(1)
  })

  it('AR-SVC-011: source inconsistency rejected', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })

    await pool.query(
      `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
       VALUES ($1, $2, $3, '2026-01-01', 'SALE', $4, null, 'inconsistent', 'draft', now(), 1)`,
      [randomUUID(), businessId, branchId, saleId]
    )

    const service = getService()
    await expect(service.postSale(saleId, businessId)).rejects.toThrow(/inconsistent/)
  })

  it('AR-SVC-012: partial collection', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    const paymentResult = await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      30000,
      'cash',
      customerId,
      'PARTIAL-PAY',
      '2026-01-02'
    )

    expect(paymentResult.newStatus).toBe('PARTIAL')

    const rev = await client.query(
      `SELECT paid_minor, outstanding_minor, status FROM receivables WHERE id = $1`,
      [result.receivableId]
    )
    expect(rev.rows[0].paid_minor).toBe(30000)
    expect(rev.rows[0].outstanding_minor).toBe(40000)
    expect(rev.rows[0].status).toBe('PARTIAL')
  })

  it('AR-SVC-013: full collection', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    const paymentResult = await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      70000,
      'bank_transfer',
      customerId,
      'FULL-PAY'
    )

    expect(paymentResult.newStatus).toBe('PAID')

    const rev = await client.query(
      `SELECT paid_minor, outstanding_minor, status FROM receivables WHERE id = $1`,
      [result.receivableId]
    )
    expect(rev.rows[0].paid_minor).toBe(70000)
    expect(rev.rows[0].outstanding_minor).toBe(0)
    expect(rev.rows[0].status).toBe('PAID')
  })

  it('AR-SVC-014: overpayment rejected', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    await expect(
      service.collectCustomerPayment(
        result.receivableId!,
        businessId,
        80000,
        'cash',
        customerId,
        'OVERPAY'
      )
    ).rejects.toThrow(/exceeds outstanding/)
  })

  it('AR-SVC-015: wrong customer rejected', async () => {
    const wrongCustomerId = randomUUID()
    await pool.query(
      `INSERT INTO customers (id, business_id, name) VALUES ($1, $2, 'Other Customer') ON CONFLICT (id) DO NOTHING`,
      [wrongCustomerId, businessId]
    )

    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    await expect(
      service.collectCustomerPayment(
        result.receivableId!,
        businessId,
        30000,
        'cash',
        wrongCustomerId,
        'WRONG-CUSTOMER'
      )
    ).rejects.toThrow(/Customer mismatch/)
  })

  it('AR-SVC-016: tenant isolation', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    await expect(
      service.collectCustomerPayment(
        result.receivableId!,
        BUSINESS_B,
        30000,
        'cash',
        customerId,
        'TENANT-TEST'
      )
    ).rejects.toThrow(/Receivable not found/)
  })

  it('AR-SVC-017: branch inherited', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    const paymentResult = await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      30000,
      'cash',
      customerId,
      'BRANCH-PAY'
    )

    const payment = await client.query(
      `SELECT branch_id FROM customer_payments WHERE id = $1`,
      [paymentResult.paymentId]
    )
    expect(payment.rows[0].branch_id).toBe(branchId)
  })

  it('AR-SVC-018: payment source_id = payment.id', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    const paymentResult = await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      30000,
      'cash',
      customerId,
      'SOURCE-ID-TEST'
    )

    const journal = await client.query(
      `SELECT source_type, source_id FROM journal_entries WHERE id = $1`,
      [paymentResult.journalId]
    )
    expect(journal.rows[0].source_type).toBe('CUSTOMER_PAYMENT')
    expect(journal.rows[0].source_id).toBe(paymentResult.paymentId)
  })

  it('AR-SVC-019: duplicate payment idempotent', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    const res1 = await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      30000,
      'cash',
      customerId,
      'SAME-KEY'
    )
    const res2 = await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      30000,
      'cash',
      customerId,
      'SAME-KEY'
    )

    expect(res1.paymentId).toBe(res2.paymentId)
    expect(res1.journalId).toBe(res2.journalId)
  })

  it('AR-SVC-020: payment version update', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      30000,
      'cash',
      customerId,
      'VERSION-UPDATE'
    )

    const rev = await client.query(
      `SELECT server_version FROM receivables WHERE id = $1`,
      [result.receivableId]
    )
    expect(rev.rows[0].server_version).toBeGreaterThan(1)
  })

  it('AR-SVC-021: OPEN -> PARTIAL', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      30000,
      'cash',
      customerId,
      'OPEN-PARTIAL'
    )

    const rev = await client.query(`SELECT status FROM receivables WHERE id = $1`, [result.receivableId])
    expect(rev.rows[0].status).toBe('PARTIAL')
  })

  it('AR-SVC-022: PARTIAL -> PAID', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      30000,
      'cash',
      customerId,
      'FIRST-PAYMENT'
    )

    await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      40000,
      'bank_transfer',
      customerId,
      'SECOND-PAYMENT'
    )

    const rev = await client.query(`SELECT status FROM receivables WHERE id = $1`, [result.receivableId])
    expect(rev.rows[0].status).toBe('PAID')
  })

  it('AR-SVC-023: reversed receivable rejects collection', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    await client.query(
      `UPDATE receivables SET status = 'REVERSED', server_version = server_version + 1 WHERE id = $1`,
      [result.receivableId]
    )

    await expect(
      service.collectCustomerPayment(
        result.receivableId!,
        businessId,
        30000,
        'cash',
        customerId,
        'REVERSED-REJECT'
      )
    ).rejects.toThrow(/reversed/)
  })

  it('AR-SVC-024: cash mapping', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
      payment_method: 'cash',
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    const paymentResult = await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      30000,
      'cash',
      customerId,
      'CASH-MAP'
    )

    const lines = await getJournalLines(paymentResult.journalId)
    const types = await getAccountTypesForLines(lines)
    const cashLine = lines.find((_l, i) => types[i] === 'cash')
    expect(cashLine!.debit_minor).toBe(30000)
  })

  it('AR-SVC-025: bank_transfer mapping', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
      payment_method: 'cash',
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    const paymentResult = await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      30000,
      'bank_transfer',
      customerId,
      'BANK-MAP'
    )

    const lines = await getJournalLines(paymentResult.journalId)
    const types = await getAccountTypesForLines(lines)
    const bankLine = lines.find((_l, i) => types[i] === 'bank')
    expect(bankLine!.debit_minor).toBe(30000)
  })

  it('AR-SVC-026: debit mapping', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    const paymentResult = await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      30000,
      'debit',
      customerId,
      'DEBIT-MAP'
    )

    const lines = await getJournalLines(paymentResult.journalId)
    const types = await getAccountTypesForLines(lines)
    const bankLine = lines.find((_l, i) => types[i] === 'bank')
    expect(bankLine!.debit_minor).toBe(30000)
  })

  it('AR-SVC-027: credit mapping', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    const paymentResult = await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      30000,
      'credit',
      customerId,
      'CREDIT-MAP'
    )

    const lines = await getJournalLines(paymentResult.journalId)
    const types = await getAccountTypesForLines(lines)
    const bankLine = lines.find((_l, i) => types[i] === 'bank')
    expect(bankLine!.debit_minor).toBe(30000)
  })

  it('AR-SVC-028: no inventory mutation', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()

    const beforeStock = await client.query(`SELECT COUNT(*)::int AS count FROM stocks WHERE business_id = $1`, [businessId])

    await service.postSale(saleId, businessId)

    const afterStock = await client.query(`SELECT COUNT(*)::int AS count FROM stocks WHERE business_id = $1`, [businessId])
    expect(Number(afterStock.rows[0].count)).toBe(Number(beforeStock.rows[0].count))
  })

  it('AR-SVC-029: no expense/income mutation', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()

    const beforeExp = await client.query(`SELECT COUNT(*)::int AS count FROM expenses WHERE business_id = $1`, [businessId])
    const beforeInc = await client.query(`SELECT COUNT(*)::int AS count FROM incomes WHERE business_id = $1`, [businessId])

    await service.postSale(saleId, businessId)

    const afterExp = await client.query(`SELECT COUNT(*)::int AS count FROM expenses WHERE business_id = $1`, [businessId])
    const afterInc = await client.query(`SELECT COUNT(*)::int AS count FROM incomes WHERE business_id = $1`, [businessId])
    expect(Number(afterExp.rows[0].count)).toBe(Number(beforeExp.rows[0].count))
    expect(Number(afterInc.rows[0].count)).toBe(Number(beforeInc.rows[0].count))
  })

  it('AR-SVC-030: accounting balance', async () => {
    const saleId = await createSale({
      total_minor: 100000,
      paid_minor: 30000,
      customer_id: customerId,
    })
    const service = getService()
    const result = await service.postSale(saleId, businessId)

    await service.collectCustomerPayment(
      result.receivableId!,
      businessId,
      70000,
      'cash',
      customerId,
      'BALANCE-PAY'
    )

    const balance = await client.query(
      `SELECT
         SUM(jl.debit_minor) AS total_debit,
         SUM(jl.credit_minor) AS total_credit
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.business_id = $1 AND je.status = 'posted'`,
      [businessId]
    )

    expect(Number(balance.rows[0].total_debit)).toBe(Number(balance.rows[0].total_credit))
  })
})
