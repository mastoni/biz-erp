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
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.INCOME_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)

  const migrationsDir = path.resolve(__dirname, '../migrations')
  await runMigrations(pool, migrationsDir)

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, 'INC Business') ON CONFLICT (id) DO NOTHING`,
    [BUSINESS_A]
  )
  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'INC Branch', true) ON CONFLICT (id) DO NOTHING`,
    [BRANCH_A, BUSINESS_A]
  )
  businessId = BUSINESS_A
  branchId = BRANCH_A
})

afterAll(async () => {
  await pool.end()
})

async function insertIncome(overrides: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO incomes (id, business_id, branch_id, date, amount_minor, method, category, reference, description, status)
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
      overrides.description ?? 'INC test',
      overrides.status ?? 'draft',
    ]
  )
  return id
}

describe('9C.5B Income schema', () => {
  it('INC-001: incomes table exists', async () => {
    const res = await pool.query("SELECT to_regclass('public.incomes') AS t")
    expect(res.rows[0].t).not.toBeNull()
  })

  it('INC-002: business_id required', async () => {
    await expect(
      pool.query(
        `INSERT INTO incomes (id, branch_id, date, amount_minor, method, description)
         VALUES ($1, NULL, '2026-01-01', 1000, 'cash', 'x')`,
        [randomUUID()]
      )
    ).rejects.toThrow()
  })

  it('INC-003: branch_id nullable', async () => {
    await expect(insertIncome({ branch_id: null })).resolves.toBeDefined()
  })

  it('INC-004: amount_minor > 0', async () => {
    await expect(insertIncome({ amount_minor: 1000 })).resolves.toBeDefined()
    await expect(insertIncome({ amount_minor: 0 })).rejects.toThrow()
    await expect(insertIncome({ amount_minor: -5 })).rejects.toThrow()
  })

  it('INC-005: cash method accepted', async () => {
    await expect(insertIncome({ method: 'cash' })).resolves.toBeDefined()
  })

  it('INC-006: bank_transfer method accepted', async () => {
    await expect(insertIncome({ method: 'bank_transfer' })).resolves.toBeDefined()
  })

  it('INC-007: debit method accepted', async () => {
    await expect(insertIncome({ method: 'debit' })).resolves.toBeDefined()
  })

  it('INC-008: credit method accepted', async () => {
    await expect(insertIncome({ method: 'credit' })).resolves.toBeDefined()
  })

  it('INC-009: invalid method rejected', async () => {
    await expect(insertIncome({ method: 'mobile' })).rejects.toThrow()
    await expect(insertIncome({ method: 'qris' })).rejects.toThrow()
  })

  it('INC-010: draft status accepted', async () => {
    await expect(insertIncome({ status: 'draft' })).resolves.toBeDefined()
  })

  it('INC-011: posted status accepted', async () => {
    await expect(insertIncome({ status: 'posted' })).resolves.toBeDefined()
  })

  it('INC-012: reversed status accepted', async () => {
    await expect(insertIncome({ status: 'reversed' })).resolves.toBeDefined()
  })

  it('INC-013: invalid status rejected', async () => {
    await expect(insertIncome({ status: 'approved' })).rejects.toThrow()
  })

  it('INC-014: server_version >= 1', async () => {
    await expect(insertIncome({})).resolves.toBeDefined()
    await expect(
      pool.query(
        `INSERT INTO incomes (id, business_id, date, amount_minor, method, description, server_version)
         VALUES ($1, $2, '2026-01-01', 1000, 'cash', 'x', 0)`,
        [randomUUID(), businessId]
      )
    ).rejects.toThrow()
  })

  it('INC-015: description required', async () => {
    await expect(
      pool.query(
        `INSERT INTO incomes (id, business_id, date, amount_minor, method)
         VALUES ($1, $2, '2026-01-01', 1000, 'cash')`,
        [randomUUID(), businessId]
      )
    ).rejects.toThrow()
  })

  it('INC-016: category nullable', async () => {
    await expect(insertIncome({ category: null })).resolves.toBeDefined()
    await expect(insertIncome({ category: 'Operational' })).resolves.toBeDefined()
  })

  it('INC-017: reference nullable', async () => {
    await expect(insertIncome({ reference: null })).resolves.toBeDefined()
    await expect(insertIncome({ reference: 'INV-1' })).resolves.toBeDefined()
  })

  it('INC-018: deleted_at nullable', async () => {
    const id = await insertIncome({})
    await expect(
      pool.query(`UPDATE incomes SET deleted_at = now() WHERE id = $1`, [id])
    ).resolves.toBeDefined()
  })

  it('INC-019: tenant foreign key', async () => {
    await expect(insertIncome({ business_id: businessId })).resolves.toBeDefined()
    await expect(insertIncome({ business_id: randomUUID() })).rejects.toThrow()
  })

  it('INC-020: branch foreign key', async () => {
    await expect(insertIncome({ branch_id: branchId })).resolves.toBeDefined()
    await expect(insertIncome({ branch_id: randomUUID() })).rejects.toThrow()
  })

  it('INC-021: soft-delete compatible index', async () => {
    const res = await pool.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_incomes_business_branch'`
    )
    expect(res.rows.length).toBe(1)
    expect(res.rows[0].indexdef).toMatch(/deleted_at is null/i)
  })

  it('INC-022: date index exists', async () => {
    const res = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'incomes' AND indexname = 'idx_incomes_business_date'`
    )
    expect(res.rows.length).toBe(1)
  })
})
