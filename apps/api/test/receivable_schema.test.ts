import path from 'path'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'

let pool!: Pool
let businessId!: string
let branchId!: string
let saleId!: string
let customerId!: string

beforeAll(async () => {
  const dbUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.RECEIVABLE_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)

  const migrationsDir = path.resolve(__dirname, '../migrations')
  await runMigrations(pool, migrationsDir)

  businessId = BUSINESS_A
  branchId = BRANCH_A

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, 'AR Business A') ON CONFLICT (id) DO NOTHING`,
    [businessId]
  )
  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, 'AR Business B') ON CONFLICT (id) DO NOTHING`,
    [BUSINESS_B]
  )
  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'AR Branch A', true) ON CONFLICT (id) DO NOTHING`,
    [branchId, businessId]
  )

  customerId = randomUUID()
  await pool.query(
    `INSERT INTO customers (id, business_id, name) VALUES ($1, $2, 'AR Customer') ON CONFLICT (id) DO NOTHING`,
    [customerId, businessId]
  )

  saleId = randomUUID()
  await pool.query(
    `INSERT INTO sales (id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, paid_minor, change_minor, cashier_id, customer_id, created_at, client_created_at, server_created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT (id) DO NOTHING`,
    [saleId, businessId, branchId, `AR-SALE-${saleId.slice(0,8)}`, 100000, 0, 0, 100000, 'cash', 0, 0, null, customerId, '2026-01-01', '2026-01-01', '2026-01-01']
  )
})

beforeEach(async () => {
  await pool.query(`UPDATE receivables SET deleted_at = now() WHERE business_id = $1 AND deleted_at IS NULL`, [businessId])
  await pool.query(`TRUNCATE customer_payments, journal_entries, journal_lines RESTART IDENTITY CASCADE`)
})

afterAll(async () => {
  await pool.end()
})

async function insertReceivable(overrides: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID()
  const amount = Number(overrides.amount_minor ?? 100000)
  let paid = Number(overrides.paid_minor ?? 0)
  let outstanding = overrides.outstanding_minor != null ? Number(overrides.outstanding_minor) : undefined

  // maintain balance invariant: paid + outstanding = amount
  if (outstanding === undefined) {
    outstanding = amount - paid
  } else if (paid === 0 && outstanding === amount) {
    // balance matches, ok
  }
  // If both paid and outstanding provided, trust the caller for AR-009 negative test
  if (overrides.paid_minor === undefined && overrides.outstanding_minor !== undefined) {
    paid = amount - outstanding
  }

  await pool.query(
    `INSERT INTO receivables (id, business_id, sale_id, customer_id, branch_id, amount_minor, paid_minor, outstanding_minor, date, reference, description, status, server_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      overrides.business_id ?? businessId,
      overrides.sale_id ?? saleId,
      overrides.customer_id ?? customerId,
      overrides.branch_id ?? branchId,
      amount,
      paid,
      outstanding,
      overrides.date ?? '2026-01-01',
      overrides.reference ?? null,
      overrides.description ?? 'AR test',
      overrides.status ?? 'OPEN',
      overrides.server_version ?? 1,
    ]
  )
  return id
}

async function insertCustomerPayment(overrides: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID()
  let receivableId = overrides.receivable_id as string | undefined
  if (!receivableId) {
    receivableId = await insertReceivable({ amount_minor: 100000, outstanding_minor: 100000, paid_minor: 0 })
  }
  await pool.query(
    `INSERT INTO customer_payments (id, business_id, receivable_id, customer_id, branch_id, amount_minor, method, reference, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      overrides.business_id ?? businessId,
      receivableId,
      overrides.customer_id ?? customerId,
      overrides.branch_id ?? branchId,
      overrides.amount_minor ?? 50000,
      overrides.method ?? 'cash',
      overrides.reference ?? null,
      overrides.idempotency_key ?? `ar_pay_${id}`,
    ]
  )
  return id
}

describe('9C.6C Receivable Schema', () => {
  it('AR-001: receivables table exists', async () => {
    const res = await pool.query("SELECT to_regclass('public.receivables') AS t")
    expect(res.rows[0].t).not.toBeNull()
  })

  it('AR-002: receivable tenant FK', async () => {
    await expect(insertReceivable({ business_id: businessId })).resolves.toBeDefined()
    await expect(insertReceivable({ business_id: randomUUID() })).rejects.toThrow()
  })

  it('AR-003: receivable sale FK', async () => {
    await expect(insertReceivable({ sale_id: saleId })).resolves.toBeDefined()
    await expect(insertReceivable({ sale_id: randomUUID() })).rejects.toThrow()
  })

  it('AR-004: receivable customer FK', async () => {
    await expect(insertReceivable({ customer_id: customerId })).resolves.toBeDefined()
    await expect(insertReceivable({ customer_id: randomUUID() })).rejects.toThrow()
  })

  it('AR-005: receivable branch nullable', async () => {
    await expect(insertReceivable({ branch_id: null })).resolves.toBeDefined()
  })

  it('AR-006: amount > 0', async () => {
    await expect(insertReceivable({ amount_minor: 1000 })).resolves.toBeDefined()
    await expect(insertReceivable({ amount_minor: 0 })).rejects.toThrow()
    await expect(insertReceivable({ amount_minor: -5 })).rejects.toThrow()
  })

  it('AR-007: paid >= 0', async () => {
    await expect(insertReceivable({ paid_minor: 0 })).resolves.toBeDefined()
    await expect(insertReceivable({ paid_minor: 500 })).resolves.toBeDefined()
    await expect(insertReceivable({ paid_minor: -1 })).rejects.toThrow()
  })

  it('AR-008: outstanding >= 0', async () => {
    await expect(insertReceivable({ outstanding_minor: 0 })).resolves.toBeDefined()
    await expect(insertReceivable({ outstanding_minor: 500 })).resolves.toBeDefined()
    await expect(insertReceivable({ outstanding_minor: -1 })).rejects.toThrow()
  })

  it('AR-009: balance invariant (paid + outstanding = amount)', async () => {
    await expect(insertReceivable({ amount_minor: 1000, paid_minor: 0, outstanding_minor: 1000 })).resolves.toBeDefined()
    await expect(insertReceivable({ amount_minor: 1000, paid_minor: 500, outstanding_minor: 500 })).resolves.toBeDefined()
    await expect(insertReceivable({ amount_minor: 1000, paid_minor: 400, outstanding_minor: 500 })).rejects.toThrow()
  })

  it('AR-010: valid statuses', async () => {
    for (const s of ['OPEN', 'PARTIAL', 'PAID', 'REVERSED']) {
      await expect(insertReceivable({ status: s })).resolves.toBeDefined()
    }
  })

  it('AR-011: invalid status rejected', async () => {
    await expect(insertReceivable({ status: 'CANCELLED' })).rejects.toThrow()
    await expect(insertReceivable({ status: 'closed' })).rejects.toThrow()
  })

  it('AR-012: server_version >= 1', async () => {
    await expect(insertReceivable({ server_version: 1 })).resolves.toBeDefined()
    await expect(insertReceivable({ server_version: 0 })).rejects.toThrow()
  })

  it('AR-013: customer_payments table exists', async () => {
    const res = await pool.query("SELECT to_regclass('public.customer_payments') AS t")
    expect(res.rows[0].t).not.toBeNull()
  })

  it('AR-014: payment amount > 0', async () => {
    await expect(insertCustomerPayment({ amount_minor: 100 })).resolves.toBeDefined()
    await expect(insertCustomerPayment({ amount_minor: 0 })).rejects.toThrow()
    await expect(insertCustomerPayment({ amount_minor: -1 })).rejects.toThrow()
  })

  it('AR-015: valid methods', async () => {
    for (const m of ['cash', 'bank_transfer', 'debit', 'credit']) {
      await expect(insertCustomerPayment({ method: m })).resolves.toBeDefined()
    }
  })

  it('AR-016: invalid method rejected', async () => {
    await expect(insertCustomerPayment({ method: 'mobile' })).rejects.toThrow()
    await expect(insertCustomerPayment({ method: 'qris' })).rejects.toThrow()
  })

  it('AR-017: payment customer FK', async () => {
    await expect(insertCustomerPayment({ customer_id: customerId })).resolves.toBeDefined()
    await expect(insertCustomerPayment({ customer_id: randomUUID() })).rejects.toThrow()
  })

  it('AR-018: payment branch nullable', async () => {
    await expect(insertCustomerPayment({ branch_id: null })).resolves.toBeDefined()
  })

  it('AR-019: payment receivable FK', async () => {
    const rid = await insertReceivable({})
    await expect(insertCustomerPayment({ receivable_id: rid })).resolves.toBeDefined()
    await expect(insertCustomerPayment({ receivable_id: randomUUID() })).rejects.toThrow()
  })

  it('AR-020: payment idempotency uniqueness', async () => {
    const key = `ar_key_${randomUUID()}`
    await expect(insertCustomerPayment({ idempotency_key: key })).resolves.toBeDefined()
    await expect(insertCustomerPayment({ idempotency_key: key })).rejects.toThrow()
  })

  it('AR-021: payment UPDATE rejected', async () => {
    const id = await insertCustomerPayment({})
    await expect(
      pool.query(`UPDATE customer_payments SET amount_minor = 999 WHERE id = $1`, [id])
    ).rejects.toThrow()
  })

  it('AR-022: payment DELETE rejected', async () => {
    const id = await insertCustomerPayment({})
    await expect(
      pool.query(`DELETE FROM customer_payments WHERE id = $1`, [id])
    ).rejects.toThrow()
  })

  it('AR-023: source_type RECEIVABLE accepted', async () => {
    const id = randomUUID()
    const jeId = randomUUID()
    await pool.query(
      `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', now(), 1)`,
      [jeId, businessId, branchId, '2026-01-01', 'RECEIVABLE', id, 'ref-ar-023', 'RECEIVABLE journal']
    )
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('RECEIVABLE')
  })

  it('AR-024: source_type CUSTOMER_PAYMENT accepted', async () => {
    const id = randomUUID()
    const jeId = randomUUID()
    await pool.query(
      `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', now(), 1)`,
      [jeId, businessId, branchId, '2026-01-01', 'CUSTOMER_PAYMENT', id, 'ref-ar-024', 'CUSTOMER_PAYMENT journal']
    )
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('CUSTOMER_PAYMENT')
  })

  it('AR-025: old PURCHASE_PAYMENT still accepted', async () => {
    const id = randomUUID()
    const jeId = randomUUID()
    await pool.query(
      `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', now(), 1)`,
      [jeId, businessId, branchId, '2026-01-01', 'PURCHASE_PAYMENT', id, 'ref-ar-025', 'old journal']
    )
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('PURCHASE_PAYMENT')
  })

  it('AR-026: old EXPENSE still accepted', async () => {
    const id = randomUUID()
    const jeId = randomUUID()
    await pool.query(
      `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', now(), 1)`,
      [jeId, businessId, branchId, '2026-01-01', 'EXPENSE', id, 'ref-ar-026', 'old journal']
    )
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('EXPENSE')
  })

  it('AR-027: old INCOME still accepted', async () => {
    const id = randomUUID()
    const jeId = randomUUID()
    await pool.query(
      `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', now(), 1)`,
      [jeId, businessId, branchId, '2026-01-01', 'INCOME', id, 'ref-ar-027', 'old journal']
    )
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('INCOME')
  })

  it('AR-028: REVERSAL still accepted', async () => {
    const id = randomUUID()
    const jeId = randomUUID()
    await pool.query(
      `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', now(), 1)`,
      [jeId, businessId, branchId, '2026-01-01', 'REVERSAL', id, 'ref-ar-028', 'reversal journal']
    )
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('REVERSAL')
  })

  it('AR-029: SALE still accepted', async () => {
    const id = randomUUID()
    const jeId = randomUUID()
    await pool.query(
      `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', now(), 1)`,
      [jeId, businessId, branchId, '2026-01-01', 'SALE', id, 'ref-ar-029', 'sale journal']
    )
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('SALE')
  })

  it('AR-030: receivable physical DELETE protected', async () => {
    const id = await insertReceivable({})
    await expect(
      pool.query(`DELETE FROM receivables WHERE id = $1`, [id])
    ).rejects.toThrow()
  })
})
