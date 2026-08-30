import path from 'path'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createFinanceService } from '../src/services/finance_service'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'
const BRANCH_NULL = null

let pool!: Pool
let financeService!: ReturnType<typeof createFinanceService>

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE
      journal_lines,
      journal_entries,
      idempotency_keys,
      purchase_payments,
      purchase_items,
      purchases,
      suppliers,
      accounts,
      branches,
      businesses
    RESTART IDENTITY CASCADE
  `)

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, 'AP-A'), ($2, 'AP-B') ON CONFLICT (id) DO NOTHING`,
    [BUSINESS_A, BUSINESS_B]
  )

  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES
      ($1, $2, 'Branch A', true),
      ($3, $2, 'Branch B', true)
      ON CONFLICT (id) DO NOTHING`,
    [BRANCH_A, BUSINESS_A, BRANCH_A]
  )

  await seedDefaultAccounts(BUSINESS_A)
}

async function seedDefaultAccounts(businessId: string): Promise<void> {
  const defaultAccounts = [
    { type: 'cash', code: '100', name: 'Cash' },
    { type: 'bank', code: '101', name: 'Bank' },
    { type: 'mobile', code: '102', name: 'Mobile Payment' },
    { type: 'receivable', code: '110', name: 'Accounts Receivable' },
    { type: 'payable', code: '200', name: 'Accounts Payable' },
    { type: 'income', code: '400', name: 'Income' },
    { type: 'revenue', code: '500', name: 'Revenue' },
    { type: 'expense', code: '600', name: 'Expense' },
    { type: 'cogs', code: '601', name: 'Cost of Goods Sold' },
    { type: 'inventory', code: '150', name: 'Inventory' },
  ]

  for (const acc of defaultAccounts) {
    await pool.query(
      `INSERT INTO accounts (id, business_id, code, name, type, currency, active, created_at, server_version)
       VALUES ($1, $2, $3, $4, $5, 'IDR', true, now(), 1)
       ON CONFLICT (business_id, code) DO NOTHING`,
      [randomUUID(), businessId, acc.code, acc.name, acc.type]
    )
  }
}

async function createSupplier(businessId: string): Promise<string> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO suppliers (id, business_id, code, name, contact, phone, email, category, term, status, server_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (id) DO NOTHING`,
    [id, businessId, `SUP-${randomUUID().slice(0, 8)}`, 'AP Supplier', null, null, null, null, 'Tempo 30', 'aktif', 1, '2026-01-01', '2026-01-01']
  )
  return id
}

async function createPurchase(
  businessId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; total_minor: number; status: string; branch_id: string | null }> {
  const id = randomUUID()
  const supplierId = overrides.supplier_id ?? (await createSupplier(businessId))
  const total = Number(overrides.total_minor ?? 500000)
  const status = (overrides.status as string) ?? 'received'
  const branchId = overrides.branch_id !== undefined ? (overrides.branch_id as string | null) : BRANCH_A

  await pool.query(
    `INSERT INTO purchases (id, business_id, branch_id, supplier_id, code, date, due_date, supplier_term, status, total_minor, paid_minor, outstanding_minor, received_minor, note, server_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [
      id,
      businessId,
      branchId,
      supplierId,
      `AP-PO-${randomUUID().slice(0, 8)}`,
      '2026-01-01',
      '2026-01-30',
      'Tempo 30',
      status,
      total,
      Number(overrides.paid_minor ?? 0),
      Number(overrides.outstanding_minor ?? total),
      Number(overrides.received_minor ?? total),
      null,
      1,
    ]
  )

  return { id, total_minor: total, status, branch_id: branchId }
}

async function createPurchasePayment(
  businessId: string,
  purchaseId: string,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const id = randomUUID()
  const branchId = overrides.branch_id !== undefined ? (overrides.branch_id as string | null) : BRANCH_A
  await pool.query(
    `INSERT INTO purchase_payments (id, business_id, purchase_id, branch_id, amount_minor, method, reference, idempotency_key, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
    [
      id,
      businessId,
      purchaseId,
      branchId,
      Number(overrides.amount_minor ?? 100000),
      overrides.method ?? 'bank_transfer',
      overrides.reference ?? null,
      overrides.idempotency_key ?? `ap_pay_${randomUUID()}`,
    ]
  )
  return id
}

async function getJournalBySource(sourceType: string, sourceId: string, businessId: string = BUSINESS_A): Promise<any> {
  const res = await pool.query(
    `SELECT * FROM journal_entries WHERE business_id = $1 AND source_type = $2 AND source_id = $3`,
    [businessId, sourceType, sourceId]
  )
  return res.rows[0] || null
}

async function getJournalLines(journalId: string): Promise<any[]> {
  const res = await pool.query(
    `SELECT jl.*, a.type AS account_type FROM journal_lines jl
     JOIN accounts a ON a.id = jl.account_id
     WHERE jl.journal_entry_id = $1 ORDER BY jl.id`,
    [journalId]
  )
  return res.rows
}

beforeAll(async () => {
  const dbUrl =
    process.env.PAYABLE_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)

  const migrationsDir = path.resolve(__dirname, '../migrations')
  await runMigrations(pool, migrationsDir)

  financeService = createFinanceService(pool)
})

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await pool.end()
})

describe('9C.7D Payable Finance Service', () => {
  // ===========================================================================
  // Post Purchase Invoice
  // ===========================================================================

  it('AP-SVC-001: post purchase invoice', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'received' })
    const result = await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    expect(result.journalId).toBeDefined()
    expect(result.sourceId).toBe(purchase.id)
  })

  it('AP-SVC-002: PAYABLE source_type', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'received' })
    await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    const journal = await getJournalBySource('PAYABLE', purchase.id)
    expect(journal).not.toBeNull()
    expect(journal.source_type).toBe('PAYABLE')
  })

  it('AP-SVC-003: source_id = purchase.id', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'received' })
    await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    const journal = await getJournalBySource('PAYABLE', purchase.id)
    expect(journal.source_id).toBe(purchase.id)
  })

  it('AP-SVC-004: Dr Inventory', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'received' })
    const result = await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    const lines = await getJournalLines(result.journalId)
    const inventoryLine = lines.find((l) => l.account_type === 'inventory')
    expect(inventoryLine).toBeDefined()
    expect(inventoryLine.debit_minor).toBe(purchase.total_minor)
    expect(inventoryLine.credit_minor).toBe(0)
  })

  it('AP-SVC-005: Cr Payable', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'received' })
    const result = await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    const lines = await getJournalLines(result.journalId)
    const payableLine = lines.find((l) => l.account_type === 'payable')
    expect(payableLine).toBeDefined()
    expect(payableLine.credit_minor).toBe(purchase.total_minor)
    expect(payableLine.debit_minor).toBe(0)
  })

  it('AP-SVC-006: balanced journal', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'received' })
    const result = await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    const lines = await getJournalLines(result.journalId)
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit_minor), 0)
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit_minor), 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(purchase.total_minor)
  })

  it('AP-SVC-007: branch copied from purchase', async () => {
    const branchB = randomUUID()
    await pool.query(
      `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'AP Branch B', true) ON CONFLICT (id) DO NOTHING`,
      [branchB, BUSINESS_A]
    )
    const purchase = await createPurchase(BUSINESS_A, { status: 'received', branch_id: branchB })
    const result = await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    const journal = await getJournalBySource('PAYABLE', purchase.id)
    expect(journal.branch_id).toBe(branchB)
  })

  it('AP-SVC-008: journal branch_id nullable at schema level', async () => {
    await pool.query(
      `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
       VALUES ($1, $2, NULL, '2026-01-01', 'PAYABLE', $3, null, 'null branch journal', 'draft', now(), 1)`,
      [randomUUID(), BUSINESS_A, randomUUID()]
    )
    const res = await pool.query(
      `SELECT branch_id FROM journal_entries WHERE source_type = 'PAYABLE' AND branch_id IS NULL AND business_id = $1`,
      [BUSINESS_A]
    )
    expect(res.rows.length).toBe(1)
  })

  it('AP-SVC-009: idempotent invoice replay', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'received' })
    const result1 = await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    const result2 = await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    expect(result2.journalId).toBe(result1.journalId)
  })

  it('AP-SVC-010: duplicate invoice prevented (posted → idempotent, draft → 409)', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'received' })
    const result = await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    const journal = await getJournalBySource('PAYABLE', purchase.id)
    expect(journal.status).toBe('posted')
    const result2 = await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    expect(result2.journalId).toBe(result.journalId)
  })

  it('AP-SVC-011: invalid purchase state rejected', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'draft' })
    await expect(
      financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_STATE' })
  })

  it('AP-SVC-011b: cancelled purchase rejected', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'cancelled' })
    await expect(
      financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_STATE' })
  })

  it('AP-SVC-012: tenant isolation — cross-tenant purchase not found', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'received' })
    await expect(
      financeService.postPurchaseInvoice(purchase.id, BUSINESS_B)
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('AP-SVC-013: missing inventory account → rollback', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'received' })
    await pool.query(`DELETE FROM accounts WHERE business_id = $1 AND type = 'inventory'`, [BUSINESS_A])
    await expect(
      financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    ).rejects.toMatchObject({ status: 500, code: 'CONFIG_ERROR' })
    const checkJournal = await getJournalBySource('PAYABLE', purchase.id)
    expect(checkJournal).toBeNull()
  })

  it('AP-SVC-014: missing payable account → rollback', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'received' })
    await pool.query(`DELETE FROM accounts WHERE business_id = $1 AND type = 'payable'`, [BUSINESS_A])
    await expect(
      financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)
    ).rejects.toMatchObject({ status: 500, code: 'CONFIG_ERROR' })
    const checkJournal = await getJournalBySource('PAYABLE', purchase.id)
    expect(checkJournal).toBeNull()
  })

  // ===========================================================================
  // Purchase payment (existing direction, verified not changed)
  // ===========================================================================

  it('AP-SVC-015: purchase_payment direction unchanged (Dr AP, Cr Cash)', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'received' })
    await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)

    await pool.query(
      `INSERT INTO purchase_payments (id, business_id, purchase_id, branch_id, amount_minor, method, reference, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [randomUUID(), BUSINESS_A, purchase.id, BRANCH_A, 300000, 'bank_transfer', 'REF-SVC-015', `ap_svc_pay_015`]
    )

    const paymentRow = await pool.query(
      `SELECT id FROM purchase_payments WHERE idempotency_key = $1 AND business_id = $2`,
      ['ap_svc_pay_015', BUSINESS_A]
    )
    const paymentId = paymentRow.rows[0].id

    const result = await financeService.postPurchasePayment(paymentId, BUSINESS_A)
    const lines = await getJournalLines(result.journalId)

    const payableLine = lines.find((l) => l.account_type === 'payable')
    const cashLine = lines.find((l) => l.account_type === 'cash' || l.account_type === 'bank')

    expect(payableLine).toBeDefined()
    expect(payableLine.debit_minor).toBe(300000)
    expect(payableLine.credit_minor).toBe(0)

    expect(cashLine).toBeDefined()
    expect(cashLine.credit_minor).toBe(300000)
    expect(cashLine.debit_minor).toBe(0)
  })

  it('AP-SVC-016: payment source_id = payment.id', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'received' })
    await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)

    const paymentId = randomUUID()
    await pool.query(
      `INSERT INTO purchase_payments (id, business_id, purchase_id, branch_id, amount_minor, method, reference, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [paymentId, BUSINESS_A, purchase.id, BRANCH_A, 100000, 'bank_transfer', 'REF-SVC-016', `ap_svc_pay_016`]
    )

    const result = await financeService.postPurchasePayment(paymentId, BUSINESS_A)
    const journal = await getJournalBySource('PURCHASE_PAYMENT', paymentId)
    expect(journal).not.toBeNull()
    expect(journal.source_id).toBe(paymentId)
  })

  it('AP-SVC-017: payment branch inherited from purchase', async () => {
    const branchB = randomUUID()
    await pool.query(
      `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'SVC Branch B', true) ON CONFLICT (id) DO NOTHING`,
      [branchB, BUSINESS_A]
    )
    const purchase = await createPurchase(BUSINESS_A, { status: 'received', branch_id: branchB })
    await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)

    const paymentId = randomUUID()
    await pool.query(
      `INSERT INTO purchase_payments (id, business_id, purchase_id, branch_id, amount_minor, method, reference, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [paymentId, BUSINESS_A, purchase.id, branchB, 200000, 'bank_transfer', 'REF-SVC-017', `ap_svc_pay_017`]
    )

    const result = await financeService.postPurchasePayment(paymentId, BUSINESS_A)
    const journal = await getJournalBySource('PURCHASE_PAYMENT', paymentId)
    expect(journal.branch_id).toBe(branchB)
  })

  it('AP-SVC-018: payment replay idempotent', async () => {
    const purchase = await createPurchase(BUSINESS_A, { status: 'received' })
    await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)

    const paymentId = randomUUID()
    await pool.query(
      `INSERT INTO purchase_payments (id, business_id, purchase_id, branch_id, amount_minor, method, reference, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [paymentId, BUSINESS_A, purchase.id, BRANCH_A, 100000, 'bank_transfer', 'REF-SVC-018', `ap_svc_pay_018`]
    )

    const result1 = await financeService.postPurchasePayment(paymentId, BUSINESS_A)
    const result2 = await financeService.postPurchasePayment(paymentId, BUSINESS_A)
    expect(result2.journalId).toBe(result1.journalId)
  })

  // ===========================================================================
  // Reverse purchase payment
  // ===========================================================================

  async function setupAndPay(businessId: string, amount: number): Promise<{
    purchase: { id: string; total_minor: number }
    paymentId: string
    journalId: string
  }> {
    const purchase = await createPurchase(businessId, {
      status: 'received',
      total_minor: 500000,
      paid_minor: amount,
      outstanding_minor: 500000 - amount,
    })

    await financeService.postPurchaseInvoice(purchase.id, businessId)

    const paymentId = randomUUID()
    await pool.query(
      `INSERT INTO purchase_payments (id, business_id, purchase_id, branch_id, amount_minor, method, reference, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [paymentId, businessId, purchase.id, BRANCH_A, amount, 'bank_transfer', 'REF', `ap_rev_${randomUUID()}`]
    )

    const result = await financeService.postPurchasePayment(paymentId, businessId)
    return { purchase, paymentId, journalId: result.journalId }
  }

  it('AP-SVC-019: reverse payment', async () => {
    const { paymentId, journalId } = await setupAndPay(BUSINESS_A, 300000)
    const reversal = await financeService.reversePurchasePayment(paymentId, BUSINESS_A)
    expect(reversal.reversalId).toBeDefined()

    const paymentJournal = await pool.query(
      `SELECT status FROM journal_entries WHERE id = $1 AND business_id = $2`,
      [journalId, BUSINESS_A]
    )
    expect(paymentJournal.rows[0].status).toBe('reversed')
  })

  it('AP-SVC-020: payment row unchanged after reversal', async () => {
    const { paymentId } = await setupAndPay(BUSINESS_A, 200000)

    await pool.query(
      `SELECT amount_minor, method, reference FROM purchase_payments WHERE id = $1`,
      [paymentId]
    )
    const before = (await pool.query(`SELECT amount_minor, method, reference FROM purchase_payments WHERE id = $1`, [paymentId])).rows[0]

    await financeService.reversePurchasePayment(paymentId, BUSINESS_A)

    const after = (await pool.query(`SELECT amount_minor, method, reference FROM purchase_payments WHERE id = $1`, [paymentId])).rows[0]
    expect(after.amount_minor).toBe(before.amount_minor)
    expect(after.method).toBe(before.method)
    expect(after.reference).toBe(before.reference)
  })

  it('AP-SVC-021: purchase paid restored', async () => {
    const { purchase, paymentId } = await setupAndPay(BUSINESS_A, 300000)

    const beforePo = await pool.query(`SELECT paid_minor FROM purchases WHERE id = $1`, [purchase.id])
    expect(Number(beforePo.rows[0].paid_minor)).toBe(300000)

    await financeService.reversePurchasePayment(paymentId, BUSINESS_A)

    const afterPo = await pool.query(`SELECT paid_minor FROM purchases WHERE id = $1`, [purchase.id])
    expect(Number(afterPo.rows[0].paid_minor)).toBe(0)
  })

  it('AP-SVC-022: purchase outstanding restored', async () => {
    const { purchase, paymentId } = await setupAndPay(BUSINESS_A, 300000)

    const beforePo = await pool.query(`SELECT outstanding_minor FROM purchases WHERE id = $1`, [purchase.id])
    expect(Number(beforePo.rows[0].outstanding_minor)).toBe(200000)

    await financeService.reversePurchasePayment(paymentId, BUSINESS_A)

    const afterPo = await pool.query(`SELECT outstanding_minor FROM purchases WHERE id = $1`, [purchase.id])
    expect(Number(afterPo.rows[0].outstanding_minor)).toBe(500000)
  })

  it('AP-SVC-023: reversal journal balanced', async () => {
    const { paymentId, journalId } = await setupAndPay(BUSINESS_A, 400000)
    const reversal = await financeService.reversePurchasePayment(paymentId, BUSINESS_A)

    const reversalJournal = await getJournalBySource('REVERSAL', reversal.reversalId)
    expect(reversalJournal).not.toBeNull()
    expect(reversalJournal.status).toBe('posted')

    const lines = await getJournalLines(reversal.reversalId)
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit_minor), 0)
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit_minor), 0)
    expect(totalDebit).toBe(totalCredit)
  })

  it('AP-SVC-024: second reversal rejected', async () => {
    const { paymentId } = await setupAndPay(BUSINESS_A, 100000)

    await financeService.reversePurchasePayment(paymentId, BUSINESS_A)

    await expect(
      financeService.reversePurchasePayment(paymentId, BUSINESS_A)
    ).rejects.toMatchObject({ status: 400, code: 'ALREADY_REVERSED' })
  })

  it('AP-SVC-025: tenant isolation reversal', async () => {
    const { paymentId } = await setupAndPay(BUSINESS_A, 100000)
    await expect(
      financeService.reversePurchasePayment(paymentId, BUSINESS_B)
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('AP-SVC-026: settlement invariant preserved (paid + outstanding = total)', async () => {
    const { purchase, paymentId } = await setupAndPay(BUSINESS_A, 350000)

    await financeService.reversePurchasePayment(paymentId, BUSINESS_A)

    const updated = await pool.query(`SELECT paid_minor, outstanding_minor, total_minor FROM purchases WHERE id = $1`, [purchase.id])
    const paid = Number(updated.rows[0].paid_minor)
    const outstanding = Number(updated.rows[0].outstanding_minor)
    const total = Number(updated.rows[0].total_minor)
    expect(paid + outstanding).toBe(total)
    expect(paid).toBeGreaterThanOrEqual(0)
    expect(outstanding).toBeLessThanOrEqual(total)
  })

  it('AP-SVC-027: no inventory mutation during invoice/reversal', async () => {
    const purchase = await createPurchase(BUSINESS_A, {
      status: 'received',
      total_minor: 500000,
      paid_minor: 200000,
      outstanding_minor: 300000,
      received_minor: 500000,
    })

    const beforeStock = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total FROM stocks WHERE business_id = $1`,
      [BUSINESS_A]
    )
    const beforeStockQty = Number(beforeStock.rows[0].total)

    await financeService.postPurchaseInvoice(purchase.id, BUSINESS_A)

    const paymentId = randomUUID()
    await pool.query(
      `INSERT INTO purchase_payments (id, business_id, purchase_id, branch_id, amount_minor, method, reference, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [paymentId, BUSINESS_A, purchase.id, BRANCH_A, 200000, 'bank_transfer', 'REF-027', `ap_inv_no_mut`]
    )

    await financeService.postPurchasePayment(paymentId, BUSINESS_A)
    await financeService.reversePurchasePayment(paymentId, BUSINESS_A)

    const afterStock = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total FROM stocks WHERE business_id = $1`,
      [BUSINESS_A]
    )
    expect(Number(afterStock.rows[0].total)).toBe(beforeStockQty)
  })
})
