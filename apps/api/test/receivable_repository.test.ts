import path from 'path'
import { randomUUID } from 'crypto'
import { Pool, PoolClient } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import {
  receivableRepository,
  ReceivableStatus,
} from '../src/repositories/receivable_repository'
import {
  customerPaymentRepository,
  PaymentMethod,
} from '../src/repositories/customer_payment_repository'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'
const BRANCH_B = '22222222-2222-4222-8222-222222222222'

let pool!: Pool
let client!: PoolClient
let businessId!: string
let branchId!: string
let saleId!: string
let customerId!: string

beforeAll(async () => {
  const dbUrl =
    process.env.RECEIVABLE_REPOSITORY_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)
  await runMigrations(pool, path.resolve(__dirname, '../migrations'))

  businessId = BUSINESS_A
  branchId = BRANCH_A

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, 'AR'), ($2, 'AR-B') ON CONFLICT (id) DO NOTHING`,
    [businessId, BUSINESS_B]
  )
  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'BA', true), ($3, $4, 'BB', true) ON CONFLICT (id) DO NOTHING`,
    [branchId, businessId, BRANCH_B, businessId]
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
    [saleId, businessId, branchId, `ar-sale-${saleId.slice(0, 8)}`, 100000, 0, 0, 100000, 'cash', 0, 0, null, customerId, '2026-01-01', '2026-01-01', '2026-01-01']
  )

  client = await pool.connect()
})

beforeEach(async () => {
  await client.query(`UPDATE receivables SET deleted_at = now() WHERE business_id = $1 AND deleted_at IS NULL`, [businessId])
  await client.query(`TRUNCATE customer_payments RESTART IDENTITY CASCADE`)
  await client.query(`TRUNCATE journal_entries RESTART IDENTITY CASCADE`)
})

afterAll(async () => {
  await client.release()
  await pool.end()
})

async function createTestReceivable(
  businessIdArg: string = businessId,
  overrides: Record<string, unknown> = {}
) {
  return receivableRepository.create(client, {
    id: overrides.id as string ?? randomUUID(),
    business_id: businessIdArg,
    sale_id: overrides.sale_id as string ?? saleId,
    customer_id: overrides.customer_id as string ?? customerId,
    branch_id: (overrides.branch_id !== undefined ? overrides.branch_id : branchId) as string | null,
    amount_minor: Number(overrides.amount_minor ?? 100000),
    paid_minor: Number(overrides.paid_minor ?? 0),
    outstanding_minor: Number(overrides.outstanding_minor ?? 100000),
    date: overrides.date as string ?? '2026-01-01',
    reference: overrides.reference as string | null ?? null,
    description: overrides.description as string ?? 'AR test',
    status: (overrides.status as ReceivableStatus) ?? 'OPEN',
  })
}

async function createTestPayment(
  receivableId: string,
  businessIdArg: string = businessId,
  overrides: Record<string, unknown> = {}
) {
  return customerPaymentRepository.create(client, {
    id: overrides.id as string ?? randomUUID(),
    business_id: businessIdArg,
    receivable_id: receivableId,
    customer_id: overrides.customer_id as string ?? customerId,
    branch_id: (overrides.branch_id !== undefined ? overrides.branch_id : branchId) as string | null,
    amount_minor: Number(overrides.amount_minor ?? 50000),
    method: (overrides.method as PaymentMethod) ?? 'cash',
    reference: overrides.reference as string | null ?? null,
    idempotency_key: overrides.idempotency_key as string ?? `ar_pay_${randomUUID()}`,
  })
}

describe('9C.6D Receivable Repository', () => {
  it('AR-031: receivable create', async () => {
    const r = await createTestReceivable()
    expect(r.id).toBeDefined()
    expect(r.business_id).toBe(businessId)
    expect(r.sale_id).toBe(saleId)
    expect(r.customer_id).toBe(customerId)
    expect(r.amount_minor).toBe(100000)
    expect(r.paid_minor).toBe(0)
    expect(r.outstanding_minor).toBe(100000)
    expect(r.status).toBe('OPEN')
    expect(r.server_version).toBe(1)
    expect(r.deleted_at).toBeNull()
  })

  it('AR-032: findById tenant isolation', async () => {
    const r = await createTestReceivable()
    const found = await receivableRepository.findById(client, businessId, r.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(r.id)
    const crossTenant = await receivableRepository.findById(client, BUSINESS_B, r.id)
    expect(crossTenant).toBeNull()
  })

  it('AR-033: findBySale', async () => {
    const r = await createTestReceivable()
    const found = await receivableRepository.findBySale(client, businessId, r.sale_id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(r.id)
  })

  it('AR-034: list', async () => {
    await createTestReceivable()
    await createTestReceivable()
    const list = await receivableRepository.list(client, businessId, {})
    expect(list.rows.length).toBeGreaterThanOrEqual(2)
  })

  it('AR-035: branch filter', async () => {
    await createTestReceivable(businessId, { branch_id: BRANCH_B, description: 'branch-b' })
    const list = await receivableRepository.list(client, businessId, { branchId: BRANCH_B })
    expect(list.rows.length).toBeGreaterThanOrEqual(1)
    expect(list.rows.every((r) => r.branch_id === BRANCH_B)).toBe(true)
  })

  it('AR-036: customer filter', async () => {
    await createTestReceivable(businessId, { customer_id: customerId, description: 'cust-a' })
    const list = await receivableRepository.list(client, businessId, { customerId })
    expect(list.rows.length).toBeGreaterThanOrEqual(1)
    expect(list.rows.every((r) => r.customer_id === customerId)).toBe(true)
  })

  it('AR-037: status filter', async () => {
    await createTestReceivable(businessId, { status: 'PAID' as ReceivableStatus, paid_minor: 100000, outstanding_minor: 0, description: 'paid' })
    const list = await receivableRepository.list(client, businessId, { status: 'PAID' })
    expect(list.rows.length).toBeGreaterThanOrEqual(1)
    expect(list.rows.every((r) => r.status === 'PAID')).toBe(true)
  })

  it('AR-038: date filter', async () => {
    await createTestReceivable(businessId, { date: '2026-03-10', description: 'date-filter' })
    const list = await receivableRepository.list(client, businessId, {
      date_from: '2026-03-01',
      date_to: '2026-03-31',
    })
    expect(list.rows.length).toBeGreaterThanOrEqual(1)
  })

  it('AR-039: pagination', async () => {
    await createTestReceivable()
    await createTestReceivable()
    await createTestReceivable()
    const first = await receivableRepository.list(client, businessId, { limit: 2, offset: 0 })
    expect(first.rows.length).toBe(2)
    const second = await receivableRepository.list(client, businessId, { limit: 2, offset: 2 })
    expect(second.rows.length).toBe(1)
  })

  it('AR-040: soft-delete exclusion', async () => {
    const r = await createTestReceivable()
    await receivableRepository.softDelete(client, businessId, r.id, 1)
    const found = await receivableRepository.findById(client, businessId, r.id)
    expect(found).toBeNull()
    const list = await receivableRepository.list(client, businessId, {})
    expect(list.rows.every((x) => x.id !== r.id)).toBe(true)
  })

  it('AR-041: updateSettlement OPEN', async () => {
    const r = await createTestReceivable()
    const updated = await receivableRepository.updateSettlement(
      client, businessId, r.id, 1, 0, 100000, 'OPEN'
    )
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe('OPEN')
    expect(updated!.paid_minor).toBe(0)
    expect(updated!.outstanding_minor).toBe(100000)
    expect(updated!.server_version).toBe(2)
  })

  it('AR-042: updateSettlement PARTIAL', async () => {
    const r = await createTestReceivable()
    const updated = await receivableRepository.updateSettlement(
      client, businessId, r.id, 1, 30000, 70000, 'PARTIAL'
    )
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe('PARTIAL')
    expect(updated!.paid_minor).toBe(30000)
    expect(updated!.outstanding_minor).toBe(70000)
  })

  it('AR-043: updateSettlement PAID', async () => {
    const r = await createTestReceivable()
    const updated = await receivableRepository.updateSettlement(
      client, businessId, r.id, 1, 100000, 0, 'PAID'
    )
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe('PAID')
    expect(updated!.paid_minor).toBe(100000)
    expect(updated!.outstanding_minor).toBe(0)
  })

  it('AR-044: updateSettlement REVERSED', async () => {
    const r = await createTestReceivable()
    const updated = await receivableRepository.updateSettlement(
      client, businessId, r.id, 1, 0, 100000, 'REVERSED'
    )
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe('REVERSED')
  })

  it('AR-045: amount immutable', async () => {
    const r = await createTestReceivable()
    await receivableRepository.updateSettlement(
      client, businessId, r.id, 1, 50000, 50000, 'PARTIAL'
    )
    const found = await receivableRepository.findById(client, businessId, r.id)
    expect(found!.amount_minor).toBe(100000)
  })

  it('AR-046: optimistic locking', async () => {
    const r = await createTestReceivable()
    const stale = await receivableRepository.updateSettlement(
      client, businessId, r.id, 999, 50000, 50000, 'PARTIAL'
    )
    expect(stale).toBeNull()
    const ok = await receivableRepository.updateSettlement(
      client, businessId, r.id, 1, 50000, 50000, 'PARTIAL'
    )
    expect(ok).not.toBeNull()
  })

  it('AR-047: balance invariant enforced by DB', async () => {
    await expect(
      createTestReceivable(businessId, { amount_minor: 100000, paid_minor: 40000, outstanding_minor: 50000 })
    ).rejects.toThrow()
  })

  it('AR-048: over-settlement rejected by DB', async () => {
    await expect(
      createTestReceivable(businessId, { amount_minor: 100000, paid_minor: 150000, outstanding_minor: -50000 })
    ).rejects.toThrow()
  })

  it('AR-049: soft-delete via updateStatus (OPEN lifecycle)', async () => {
    const r = await createTestReceivable(businessId, { status: 'OPEN' })
    const updated = await receivableRepository.updateStatus(
      client, businessId, r.id, 1, 'REVERSED'
    )
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe('REVERSED')
    expect(updated!.server_version).toBe(2)
  })

  it('AR-050: physical delete rejected', async () => {
    const r = await createTestReceivable()
    await expect(
      client.query(`DELETE FROM receivables WHERE id = $1 AND business_id = $2`, [r.id, businessId])
    ).rejects.toThrow()
  })
})

describe('9C.6D Customer Payment Repository', () => {
  let testReceivableId = ''

  beforeEach(async () => {
    const r = await createTestReceivable()
    testReceivableId = r.id
  })

  it('AR-051: create payment', async () => {
    const p = await createTestPayment(testReceivableId)
    expect(p.id).toBeDefined()
    expect(p.business_id).toBe(businessId)
    expect(p.receivable_id).toBe(testReceivableId)
    expect(p.customer_id).toBe(customerId)
    expect(p.amount_minor).toBe(50000)
    expect(p.method).toBe('cash')
    expect(p.idempotency_key).toBeDefined()
    expect(p.branch_id).toBe(branchId)
  })

  it('AR-052: tenant isolation', async () => {
    const p = await createTestPayment(testReceivableId)
    const found = await customerPaymentRepository.findById(client, businessId, p.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(p.id)
    const crossTenant = await customerPaymentRepository.findById(client, BUSINESS_B, p.id)
    expect(crossTenant).toBeNull()
  })

  it('AR-053: find by idempotency key', async () => {
    const key = `uniq_key_${randomUUID()}`
    await createTestPayment(testReceivableId, businessId, { idempotency_key: key })
    const found = await customerPaymentRepository.findByIdempotencyKey(client, businessId, key)
    expect(found).not.toBeNull()
    expect(found!.idempotency_key).toBe(key)
  })

  it('AR-054: list by receivable', async () => {
    await createTestPayment(testReceivableId)
    await createTestPayment(testReceivableId)
    const list = await customerPaymentRepository.listByReceivable(client, businessId, testReceivableId)
    expect(list.rows.length).toBe(2)
    expect(list.total).toBe(2)
  })

  it('AR-055: payment UPDATE rejected', async () => {
    const p = await createTestPayment(testReceivableId)
    await expect(
      client.query(`UPDATE customer_payments SET amount_minor = 999 WHERE id = $1`, [p.id])
    ).rejects.toThrow()
  })

  it('AR-056: payment DELETE rejected', async () => {
    const p = await createTestPayment(testReceivableId)
    await expect(
      client.query(`DELETE FROM customer_payments WHERE id = $1`, [p.id])
    ).rejects.toThrow()
  })

  it('AR-057: customer preserved', async () => {
    const p = await createTestPayment(testReceivableId, businessId, { customer_id: customerId })
    const found = await customerPaymentRepository.findById(client, businessId, p.id)
    expect(found!.customer_id).toBe(customerId)
  })

  it('AR-058: branch nullable', async () => {
    const p = await createTestPayment(testReceivableId, businessId, { branch_id: null })
    const found = await customerPaymentRepository.findById(client, businessId, p.id)
    expect(found!.branch_id).toBeNull()
  })

  it('AR-059: payment amount > 0', async () => {
    await expect(
      createTestPayment(testReceivableId, businessId, { amount_minor: 100 })
    ).resolves.toBeDefined()
    await expect(
      createTestPayment(testReceivableId, businessId, { amount_minor: 0, idempotency_key: `zero_${randomUUID()}` })
    ).rejects.toThrow()
    await expect(
      createTestPayment(testReceivableId, businessId, { amount_minor: -1, idempotency_key: `neg_${randomUUID()}` })
    ).rejects.toThrow()
  })

  it('AR-060: method validation', async () => {
    for (const m of ['cash', 'bank_transfer', 'debit', 'credit'] as PaymentMethod[]) {
      await expect(
        createTestPayment(testReceivableId, businessId, { method: m, idempotency_key: `m_${m}_${randomUUID()}` })
      ).resolves.toBeDefined()
    }
    await expect(
      createTestPayment(testReceivableId, businessId, { method: 'mobile' as PaymentMethod, idempotency_key: `bad_${randomUUID()}` })
    ).rejects.toThrow()
  })

  it('AR-061: idempotency uniqueness', async () => {
    const key = `dup_${randomUUID()}`
    await expect(createTestPayment(testReceivableId, businessId, { idempotency_key: key })).resolves.toBeDefined()
    await expect(createTestPayment(testReceivableId, businessId, { idempotency_key: key })).rejects.toThrow()
  })
})
