import path from 'path'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'

let pool!: Pool
let businessId!: string
let branchId!: string

beforeAll(async () => {
  const dbUrl =
    process.env.EXPENSE_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)

  const migrationsDir = path.resolve(__dirname, '../migrations')
  await runMigrations(pool, migrationsDir)

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, 'EXP Business') ON CONFLICT (id) DO NOTHING`,
    [BUSINESS_A]
  )
  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'EXP Branch', true) ON CONFLICT (id) DO NOTHING`,
    [BRANCH_A, BUSINESS_A]
  )
  businessId = BUSINESS_A
  branchId = BRANCH_A
})

afterAll(async () => {
  await pool.end()
})

async function insertExpense(overrides: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO expenses (id, business_id, branch_id, date, amount_minor, method, category, reference, description, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      overrides.business_id ?? businessId,
      overrides.branch_id ?? null,
      overrides.date ?? '2026-01-01',
      overrides.amount_minor ?? 1000,
      overrides.method ?? 'cash',
      overrides.category ?? null,
      overrides.reference ?? null,
      overrides.description ?? 'EXP test',
      overrides.status ?? 'draft',
    ]
  )
  return id
}

describe('9C.4C Expense schema', () => {
  it('EXP-001: expenses table exists', async () => {
    const res = await pool.query("SELECT to_regclass('public.expenses') AS t")
    expect(res.rows[0].t).not.toBeNull()
  })

  it('EXP-002: business_id required', async () => {
    await expect(
      pool.query(
        `INSERT INTO expenses (id, branch_id, date, amount_minor, method, description)
         VALUES ($1, NULL, '2026-01-01', 1000, 'cash', 'x')`,
        [randomUUID()]
      )
    ).rejects.toThrow()
  })

  it('EXP-003: branch_id nullable', async () => {
    await expect(insertExpense({ branch_id: null })).resolves.toBeDefined()
  })

  it('EXP-004: amount_minor > 0', async () => {
    await expect(insertExpense({ amount_minor: 1000 })).resolves.toBeDefined()
    await expect(insertExpense({ amount_minor: 0 })).rejects.toThrow()
    await expect(insertExpense({ amount_minor: -5 })).rejects.toThrow()
  })

  it('EXP-005: valid payment method accepted', async () => {
    for (const m of ['cash', 'bank_transfer', 'debit', 'credit']) {
      await expect(insertExpense({ method: m })).resolves.toBeDefined()
    }
  })

  it('EXP-006: invalid payment method rejected', async () => {
    await expect(insertExpense({ method: 'mobile' })).rejects.toThrow()
    await expect(insertExpense({ method: 'qris' })).rejects.toThrow()
  })

  it('EXP-007: valid status accepted', async () => {
    for (const s of ['draft', 'posted', 'reversed']) {
      await expect(insertExpense({ status: s })).resolves.toBeDefined()
    }
  })

  it('EXP-008: invalid status rejected', async () => {
    await expect(insertExpense({ status: 'approved' })).rejects.toThrow()
  })

  it('EXP-009: server_version >= 1', async () => {
    await expect(insertExpense({})).resolves.toBeDefined()
    await expect(
      pool.query(
        `INSERT INTO expenses (id, business_id, date, amount_minor, method, description, server_version)
         VALUES ($1, $2, '2026-01-01', 1000, 'cash', 'x', 0)`,
        [randomUUID(), businessId]
      )
    ).rejects.toThrow()
  })

  it('EXP-010: description required', async () => {
    await expect(
      pool.query(
        `INSERT INTO expenses (id, business_id, date, amount_minor, method)
         VALUES ($1, $2, '2026-01-01', 1000, 'cash')`,
        [randomUUID(), businessId]
      )
    ).rejects.toThrow()
  })

  it('EXP-011: category nullable', async () => {
    await expect(insertExpense({ category: null })).resolves.toBeDefined()
    await expect(insertExpense({ category: 'Operational' })).resolves.toBeDefined()
  })

  it('EXP-012: reference nullable', async () => {
    await expect(insertExpense({ reference: null })).resolves.toBeDefined()
    await expect(insertExpense({ reference: 'INV-1' })).resolves.toBeDefined()
  })

  it('EXP-013: deleted_at nullable', async () => {
    const id = await insertExpense({})
    await expect(
      pool.query(`UPDATE expenses SET deleted_at = now() WHERE id = $1`, [id])
    ).resolves.toBeDefined()
  })

  it('EXP-014: tenant foreign key', async () => {
    await expect(insertExpense({ business_id: businessId })).resolves.toBeDefined()
    await expect(insertExpense({ business_id: randomUUID() })).rejects.toThrow()
  })

  it('EXP-015: branch foreign key', async () => {
    await expect(insertExpense({ branch_id: branchId })).resolves.toBeDefined()
    await expect(insertExpense({ branch_id: randomUUID() })).rejects.toThrow()
  })

  it('EXP-016: soft-delete compatible index', async () => {
    const res = await pool.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_expenses_business_branch'`
    )
    expect(res.rows.length).toBe(1)
    expect(res.rows[0].indexdef).toMatch(/deleted_at is null/i)
  })

  it('EXP-017: business+branch index exists', async () => {
    const res = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'expenses' AND indexname = 'idx_expenses_business_branch'`
    )
    expect(res.rows.length).toBe(1)
  })
})
