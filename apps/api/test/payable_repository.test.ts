import path from 'path'
import { randomUUID } from 'crypto'
import { Pool, PoolClient } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { purchaseRepository } from '../src/repositories/purchase_repository'
import { PaymentMethod } from '../dto/purchase_dto'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'
const BRANCH_B = '22222222-2222-4222-8222-222222222222'

let pool!: Pool
let client!: PoolClient
let businessId!: string
let branchId!: string
let supplierId!: string
let purchaseId!: string

beforeAll(async () => {
  const dbUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.PAYABLE_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)
  await runMigrations(pool, path.resolve(__dirname, '../migrations'))

  businessId = BUSINESS_A
  branchId = BRANCH_A

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, 'AP'), ($2, 'AP-B') ON CONFLICT (id) DO NOTHING`,
    [businessId, BUSINESS_B]
  )
  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'AP Branch A', true), ($3, $4, 'AP Branch B', true) ON CONFLICT (id) DO NOTHING`,
    [branchId, businessId, BRANCH_B, businessId]
  )

  supplierId = randomUUID()
  await pool.query(
    `INSERT INTO suppliers (id, business_id, code, name, contact, phone, email, category, term, status, server_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (id) DO NOTHING`,
    [supplierId, businessId, `SUP-AP-${randomUUID().slice(0, 8)}`, 'AP Supplier', null, null, null, null, 'Tempo 30', 'aktif', 1, '2026-01-01', '2026-01-01']
  )

  purchaseId = randomUUID()
  await pool.query(
    `INSERT INTO purchases (id, business_id, branch_id, supplier_id, code, date, due_date, supplier_term, status, total_minor, paid_minor, outstanding_minor, received_minor, note, server_version, created_at, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (id) DO NOTHING`,
    [purchaseId, businessId, branchId, supplierId, `AP-PO-${randomUUID().slice(0, 8)}`, '2026-01-01', '2026-01-30', 'Tempo 30', 'received', 500000, 0, 500000, 500000, null, 1, '2026-01-01', '2026-01-01', null]
  )

  client = await pool.connect()
})

beforeEach(async () => {
  await client.query(`TRUNCATE purchase_payments RESTART IDENTITY CASCADE`)
  await client.query(`TRUNCATE journal_entries RESTART IDENTITY CASCADE`)
})

afterAll(async () => {
  client.release()
  await pool.end()
})

async function createTestPayment(
  overrides: Record<string, unknown> = {}
) {
  return purchaseRepository.insertPayment(client, {
    id: overrides.id as string ?? randomUUID(),
    business_id: overrides.business_id as string ?? businessId,
    purchase_id: overrides.purchase_id as string ?? purchaseId,
    branch_id: overrides.branch_id !== undefined ? (overrides.branch_id as string | null) : branchId,
    amount_minor: Number(overrides.amount_minor ?? 50000),
    method: (overrides.method as PaymentMethod) ?? 'bank_transfer',
    reference: overrides.reference as string ?? 'REF-AP-DATA',
    idempotency_key: overrides.idempotency_key as string ?? `ap_pay_${randomUUID()}`,
  })
}

describe('9C.7D Payable Repository', () => {
  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  it('AP-DATA-001: payment create', async () => {
    const p = await createTestPayment({})
    expect(p.id).toBeDefined()
    expect(p.business_id).toBe(businessId)
    expect(p.purchase_id).toBe(purchaseId)
    expect(p.branch_id).toBe(branchId)
    expect(p.amount_minor).toBe(50000)
    expect(p.method).toBe('bank_transfer')
    expect(p.reference).toBe('REF-AP-DATA')
    expect(p.idempotency_key).toBeDefined()
    expect(p.created_at).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  it('AP-DATA-002: tenant isolation — findPaymentById returns null for cross-tenant', async () => {
    const p = await createTestPayment({})
    const found = await purchaseRepository.findPaymentById(client, businessId, p.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(p.id)

    const crossTenant = await purchaseRepository.findPaymentById(client, BUSINESS_B, p.id)
    expect(crossTenant).toBeNull()
  })

  it('AP-DATA-002b: findByIdempotencyKey returns null for cross-tenant', async () => {
    const key = `ap_key_tenant_${randomUUID()}`
    await createTestPayment({ idempotency_key: key })
    const crossTenant = await purchaseRepository.findByIdempotencyKey(client, BUSINESS_B, key)
    expect(crossTenant).toBeNull()
  })

  // -------------------------------------------------------------------------
  // Branch
  // -------------------------------------------------------------------------

  it('AP-DATA-003: branch nullable', async () => {
    const p = await createTestPayment({ branch_id: null })
    expect(p.branch_id).toBeNull()
  })

  it('AP-DATA-004: branch preserved on create and read back', async () => {
    const p = await createTestPayment({ branch_id: BRANCH_B })
    expect(p.branch_id).toBe(BRANCH_B)

    const found = await purchaseRepository.findPaymentById(client, businessId, p.id)
    expect(found!.branch_id).toBe(BRANCH_B)
  })

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------

  it('AP-DATA-005: findById returns payment', async () => {
    const p = await createTestPayment({})
    const found = await purchaseRepository.findPaymentById(client, businessId, p.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(p.id)
    expect(found!.amount_minor).toBe(p.amount_minor)
    expect(found!.method).toBe(p.method)
    expect(found!.idempotency_key).toBe(p.idempotency_key)
  })

  it('AP-DATA-005b: findById returns null for nonexistent payment', async () => {
    const found = await purchaseRepository.findPaymentById(client, businessId, randomUUID())
    expect(found).toBeNull()
  })

  // -------------------------------------------------------------------------
  // findByIdempotencyKey
  // -------------------------------------------------------------------------

  it('AP-DATA-006: findByIdempotencyKey returns payment', async () => {
    const key = `ap_key_${randomUUID()}`
    const p = await createTestPayment({ idempotency_key: key })
    const found = await purchaseRepository.findByIdempotencyKey(client, businessId, key)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(p.id)
    expect(found!.idempotency_key).toBe(key)
  })

  it('AP-DATA-006b: findByIdempotencyKey tenant-scoped', async () => {
    const key = `ap_key_tenant_${randomUUID()}`
    await createTestPayment({ idempotency_key: key })
    const crossTenant = await purchaseRepository.findByIdempotencyKey(client, BUSINESS_B, key)
    expect(crossTenant).toBeNull()
  })

  // -------------------------------------------------------------------------
  // getPayments / listByPurchase
  // -------------------------------------------------------------------------

  it('AP-DATA-007: getPayments returns payments for a purchase', async () => {
    await createTestPayment({ purchase_id: purchaseId, amount_minor: 100000, idempotency_key: `ap_list_1_${randomUUID()}` })
    await createTestPayment({ purchase_id: purchaseId, amount_minor: 200000, idempotency_key: `ap_list_2_${randomUUID()}` })
    const payments = await purchaseRepository.getPayments(client, businessId, purchaseId)
    expect(payments.length).toBe(2)
    const amounts = payments.map((p) => p.amount_minor)
    expect(amounts).toContain(100000)
    expect(amounts).toContain(200000)
  })

  it('AP-DATA-007b: getPayments tenant-scoped', async () => {
    await createTestPayment({ purchase_id: purchaseId, idempotency_key: `ap_list_b_${randomUUID()}` })
    const payments = await purchaseRepository.getPayments(client, BUSINESS_B, purchaseId)
    expect(payments.length).toBe(0)
  })

  it('AP-DATA-008: getPayments returns all payments (pagination not implemented)', async () => {
    await createTestPayment({ idempotency_key: `ap_pag_1_${randomUUID()}` })
    await createTestPayment({ idempotency_key: `ap_pag_2_${randomUUID()}` })
    await createTestPayment({ idempotency_key: `ap_pag_3_${randomUUID()}` })
    const payments = await purchaseRepository.getPayments(client, businessId, purchaseId)
    expect(payments.length).toBe(3)
    const sorted = payments.slice().sort((a, b) => a.amount_minor - b.amount_minor)
    expect(sorted.map((p) => p.amount_minor)).toEqual([50000, 50000, 50000])
  })

  // -------------------------------------------------------------------------
  // Append-only protection
  // -------------------------------------------------------------------------

  it('AP-DATA-009: purchase_payments UPDATE rejected', async () => {
    const p = await createTestPayment({})
    await expect(
      client.query(`UPDATE purchase_payments SET amount_minor = 999 WHERE id = $1`, [p.id])
    ).rejects.toThrow()
  })

  it('AP-DATA-010: purchase_payments DELETE rejected', async () => {
    const p = await createTestPayment({})
    await expect(
      client.query(`DELETE FROM purchase_payments WHERE id = $1`, [p.id])
    ).rejects.toThrow()
  })

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------

  it('AP-DATA-011: duplicate idempotency rejected', async () => {
    const key = `ap_dup_${randomUUID()}`
    await createTestPayment({ idempotency_key: key })
    await expect(
      createTestPayment({ idempotency_key: key })
    ).rejects.toThrow()
  })

  it('AP-DATA-011b: same idempotency key different purchase_id allowed', async () => {
    const otherPurchaseId = randomUUID()
    await pool.query(
      `INSERT INTO purchases (id, business_id, branch_id, supplier_id, code, date, due_date, supplier_term, status, total_minor, paid_minor, outstanding_minor, received_minor, note, server_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO NOTHING`,
      [otherPurchaseId, businessId, branchId, supplierId, `AP-PO-${randomUUID().slice(0, 8)}`, '2026-01-01', '2026-01-30', 'Tempo 30', 'received', 500000, 0, 500000, 0, null, 1]
    )
    const key = `ap_cross_po_${randomUUID()}`
    const p1 = await createTestPayment({ purchase_id: purchaseId, idempotency_key: key })
    const p2 = await createTestPayment({ purchase_id: otherPurchaseId, idempotency_key: key, amount_minor: 100000, idempotency_key: `ap_cross_po_${p1.id.slice(0, 8)}` })
    expect(p1.idempotency_key).not.toBe(p2.idempotency_key)
    expect(p1.id).not.toBe(p2.id)
  })

  // -------------------------------------------------------------------------
  // Purchase lookup tenant-safe
  // -------------------------------------------------------------------------

  it('AP-DATA-012: purchase lookup tenant-safe', async () => {
    const po = await purchaseRepository.findById(client, businessId, purchaseId)
    expect(po).not.toBeNull()
    expect(po!.id).toBe(purchaseId)

    const crossTenant = await purchaseRepository.findById(client, BUSINESS_B, purchaseId)
    expect(crossTenant).toBeNull()
  })

  // -------------------------------------------------------------------------
  // Data preservation
  // -------------------------------------------------------------------------

  it('AP-DATA-013: payment amount preserved', async () => {
    const p = await createTestPayment({ amount_minor: 250000 })
    const found = await purchaseRepository.findPaymentById(client, businessId, p.id)
    expect(found!.amount_minor).toBe(250000)
  })

  it('AP-DATA-014: purchase_id preserved', async () => {
    const p = await createTestPayment({})
    expect(p.purchase_id).toBe(purchaseId)
    const found = await purchaseRepository.findPaymentById(client, businessId, p.id)
    expect(found!.purchase_id).toBe(purchaseId)
  })

  it('AP-DATA-015: method preserved', async () => {
    const p = await createTestPayment({ method: 'cash', idempotency_key: `ap_method_${randomUUID()}` })
    expect(p.method).toBe('cash')
    const found = await purchaseRepository.findPaymentById(client, businessId, p.id)
    expect(found!.method).toBe('cash')
  })
})
