import path from 'path'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'

let pool!: Pool
let businessId!: string
let branchId!: string
let supplierId!: string
let purchaseId!: string

beforeAll(async () => {
  const dbUrl =
    process.env.PAYABLE_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)

  const migrationsDir = path.resolve(__dirname, '../migrations')
  await runMigrations(pool, migrationsDir)

  businessId = BUSINESS_A
  branchId = BRANCH_A

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, 'AP Business') ON CONFLICT (id) DO NOTHING`,
    [businessId]
  )
  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'AP Branch', true) ON CONFLICT (id) DO NOTHING`,
    [branchId, businessId]
  )

  supplierId = randomUUID()
  const supplierCode = `SUP-AP-${randomUUID().slice(0, 8)}`
  await pool.query(
    `INSERT INTO suppliers (id, business_id, code, name, contact, phone, email, category, term, status, server_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (id) DO NOTHING`,
    [supplierId, businessId, supplierCode, 'AP Supplier', null, null, null, null, 'Tempo 30', 'aktif', 1, '2026-01-01', '2026-01-01']
  )

  purchaseId = randomUUID()
  const purchaseCode = `AP-PO-${randomUUID().slice(0, 8)}`
  await pool.query(
    `INSERT INTO purchases (id, business_id, branch_id, supplier_id, code, date, due_date, supplier_term, status, total_minor, paid_minor, outstanding_minor, received_minor, note, server_version, created_at, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (id) DO NOTHING`,
    [purchaseId, businessId, branchId, supplierId, purchaseCode, '2026-01-01', '2026-01-30', 'Tempo 30', 'received', 500000, 0, 500000, 500000, null, 1, '2026-01-01', '2026-01-01', null]
  )
})

beforeEach(async () => {
  await pool.query(`TRUNCATE purchase_payments, journal_entries, journal_lines RESTART IDENTITY CASCADE`)
})

afterAll(async () => {
  await pool.end()
})

async function insertJournalEntry(sourceType: string): Promise<string> {
  const jeId = randomUUID()
  await pool.query(
    `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', now(), 1)`,
     [jeId, businessId, branchId, '2026-01-01', sourceType, randomUUID(), 'ref', 'AP test journal']
  )
  return jeId
}

async function insertPurchasePayment(overrides: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO purchase_payments (id, business_id, purchase_id, branch_id, amount_minor, method, reference, idempotency_key, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
    [
      id,
      businessId,
      purchaseId,
      overrides.branch_id ?? null,
      100000,
      'bank_transfer',
      'REF-AP',
      `ap_key_${id}`,
    ]
  )
  return id
}

describe('9C.7C Payable Schema', () => {
  // ===========================================================================
  // Source type CHECK constraint
  // ===========================================================================

  it('AP-001: source type PAYABLE accepted', async () => {
    const jeId = await insertJournalEntry('PAYABLE')
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('PAYABLE')
  })

  it('AP-002: source type SALE accepted', async () => {
    const jeId = await insertJournalEntry('SALE')
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('SALE')
  })

  it('AP-003: source type PURCHASE_PAYMENT accepted', async () => {
    const jeId = await insertJournalEntry('PURCHASE_PAYMENT')
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('PURCHASE_PAYMENT')
  })

  it('AP-004: source type EXPENSE accepted', async () => {
    const jeId = await insertJournalEntry('EXPENSE')
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('EXPENSE')
  })

  it('AP-005: source type INCOME accepted', async () => {
    const jeId = await insertJournalEntry('INCOME')
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('INCOME')
  })

  it('AP-006: source type RECEIVABLE accepted', async () => {
    const jeId = await insertJournalEntry('RECEIVABLE')
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('RECEIVABLE')
  })

  it('AP-007: source type CUSTOMER_PAYMENT accepted', async () => {
    const jeId = await insertJournalEntry('CUSTOMER_PAYMENT')
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('CUSTOMER_PAYMENT')
  })

  it('AP-008: source type REVERSAL accepted', async () => {
    const jeId = await insertJournalEntry('REVERSAL')
    const res = await pool.query(`SELECT source_type FROM journal_entries WHERE id = $1`, [jeId])
    expect(res.rows[0].source_type).toBe('REVERSAL')
  })

  // ===========================================================================
  // purchase_payments.branch_id
  // ===========================================================================

  it('AP-009: purchase_payments.branch_id column exists', async () => {
    const res = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'purchase_payments' AND column_name = 'branch_id'`
    )
    expect(res.rows.length).toBe(1)
  })

  it('AP-010: branch_id nullable', async () => {
    const id = await insertPurchasePayment({ branch_id: null })
    const res = await pool.query(`SELECT branch_id FROM purchase_payments WHERE id = $1`, [id])
    expect(res.rows[0].branch_id).toBeNull()
  })

  it('AP-011: branch FK enforced', async () => {
    await expect(
      insertPurchasePayment({ branch_id: randomUUID() })
    ).rejects.toThrow()
  })

  it('AP-012: branch delete protection (ON DELETE RESTRICT)', async () => {
    await insertPurchasePayment({ branch_id: branchId })
    await expect(
      pool.query(`DELETE FROM branches WHERE id = $1`, [branchId])
    ).rejects.toThrow()
  })

  // ===========================================================================
  // Append-only protection
  // ===========================================================================

  it('AP-013: purchase_payments UPDATE rejected', async () => {
    const id = await insertPurchasePayment({})
    await expect(
      pool.query(`UPDATE purchase_payments SET amount_minor = 999 WHERE id = $1`, [id])
    ).rejects.toThrow()
  })

  it('AP-014: purchase_payments DELETE rejected', async () => {
    const id = await insertPurchasePayment({})
    await expect(
      pool.query(`DELETE FROM purchase_payments WHERE id = $1`, [id])
    ).rejects.toThrow()
  })

  // ===========================================================================
  // Data integrity
  // ===========================================================================

  it('AP-015: existing rows preserved (branch_id NULL for legacy)', async () => {
    const id = await insertPurchasePayment({ branch_id: null })
    const res = await pool.query(
      `SELECT id, branch_id, business_id FROM purchase_payments WHERE id = $1`,
      [id]
    )
    expect(res.rows[0].id).toBe(id)
    expect(res.rows[0].branch_id).toBeNull()
    expect(res.rows[0].business_id).toBe(businessId)
  })

  it('AP-016: idempotency uniqueness unchanged', async () => {
    const key = `ap_idem_${randomUUID()}`
    const pay1 = randomUUID()
    await pool.query(
      `INSERT INTO purchase_payments (id, business_id, purchase_id, branch_id, amount_minor, method, reference, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [pay1, businessId, purchaseId, null, 100000, 'bank_transfer', 'REF-AP', key]
    )
    await expect(
      pool.query(
        `INSERT INTO purchase_payments (id, business_id, purchase_id, branch_id, amount_minor, method, reference, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
        [randomUUID(), businessId, purchaseId, null, 100000, 'bank_transfer', 'REF-AP', key]
      )
    ).rejects.toThrow()
  })

  it('AP-017: business_id tenant FK preserved', async () => {
    await expect(
      insertPurchasePayment({ branch_id: null })
    ).resolves.toBeDefined()
    await expect(
      pool.query(
        `INSERT INTO purchase_payments (id, business_id, purchase_id, branch_id, amount_minor, method, reference, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
        [randomUUID(), randomUUID(), purchaseId, null, 100000, 'bank_transfer', 'REF-AP', `ap_tenant_${randomUUID()}`]
      )
    ).rejects.toThrow()
  })

  // ===========================================================================
  // No duplicate entities
  // ===========================================================================

  it('AP-018: no payables table', async () => {
    const res = await pool.query(`SELECT to_regclass('public.payables') AS t`)
    expect(res.rows[0].t).toBeNull()
  })

  it('AP-019: no supplier_payments table', async () => {
    const res = await pool.query(`SELECT to_regclass('public.supplier_payments') AS t`)
    expect(res.rows[0].t).toBeNull()
  })
})
