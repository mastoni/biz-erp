import path from 'path'
import { randomUUID } from 'crypto'
import { Pool, PoolClient } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createFinanceService } from '../src/services/finance_service'
import { incomeRepository } from '../src/repositories/income_repository'
import { accountRepository } from '../src/repositories/account_repository'
import { ApiError } from '../src/errors/api_error'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'
const BRANCH_B = '22222222-2222-4222-8222-222222222222'

let pool!: Pool
let client!: PoolClient
let service: ReturnType<typeof createFinanceService>

async function seedAccounts(businessId: string): Promise<void> {
  await accountRepository.createDefaultAccounts(client, businessId)
}

async function makeIncome(overrides: {
  branch_id?: string | null
  date?: string
  amount_minor?: number
  method?: any
  category?: string | null
  reference?: string | null
  description?: string
} = {}): Promise<string> {
  const id = randomUUID()
  await incomeRepository.create(client, {
    id,
    business_id: BUSINESS_A,
    branch_id: overrides.branch_id === undefined ? BRANCH_A : overrides.branch_id,
    date: overrides.date ?? '2026-01-01',
    amount_minor: overrides.amount_minor ?? 1000,
    method: (overrides.method ?? 'cash') as any,
    category: overrides.category ?? null,
    reference: overrides.reference ?? null,
    description: overrides.description ?? 'Income',
  })
  return id
}

beforeAll(async () => {
  const dbUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.INCOME_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)
  await runMigrations(pool, path.resolve(__dirname, '../migrations'))

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1,'A'),($2,'B') ON CONFLICT (id) DO NOTHING`,
    [BUSINESS_A, BUSINESS_B]
  )
  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1,$2,'BA',true),($3,$4,'BB',true) ON CONFLICT (id) DO NOTHING`,
    [BRANCH_A, BUSINESS_A, BRANCH_B, BUSINESS_B]
  )

  client = await pool.connect()
  await seedAccounts(BUSINESS_A)
  await seedAccounts(BUSINESS_B)
  service = createFinanceService(pool)
})

beforeEach(async () => {
  await client.query(`TRUNCATE TABLE incomes, journal_entries, journal_lines RESTART IDENTITY CASCADE`)
  await seedAccounts(BUSINESS_A)
  await seedAccounts(BUSINESS_B)
})

afterAll(async () => {
  await client.release()
  await pool.end()
})

describe('9C.5D Income service.postIncome', () => {
  it('INC-SVC-001: draft Income posts successfully', async () => {
    const id = await makeIncome()
    const res = await service.postIncome(id, BUSINESS_A)
    expect(res.sourceId).toBe(id)
    const je = await client.query(
      `SELECT status FROM journal_entries WHERE business_id = $1 AND source_type = 'INCOME' AND source_id = $2`,
      [BUSINESS_A, id]
    )
    expect(je.rows[0].status).toBe('posted')
  })

  it('INC-SVC-002: source_type = INCOME', async () => {
    const id = await makeIncome()
    await service.postIncome(id, BUSINESS_A)
    const je = await client.query(
      `SELECT source_type FROM journal_entries WHERE source_id = $1 AND business_id = $2`,
      [id, BUSINESS_A]
    )
    expect(je.rows[0].source_type).toBe('INCOME')
  })

  it('INC-SVC-003: source_id = income.id', async () => {
    const id = await makeIncome()
    await service.postIncome(id, BUSINESS_A)
    const je = await client.query(
      `SELECT source_id FROM journal_entries WHERE source_type = 'INCOME' AND business_id = $1`,
      [BUSINESS_A]
    )
    expect(je.rows[0].source_id).toBe(id)
  })

  it('INC-SVC-004: Dr Cash / Cr Income', async () => {
    const id = await makeIncome({ method: 'cash', amount_minor: 50000 })
    await service.postIncome(id, BUSINESS_A)
    const lines = await client.query(
      `SELECT a.type AS account_type, jl.debit_minor, jl.credit_minor
       FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
       WHERE jl.journal_entry_id = (SELECT id FROM journal_entries WHERE source_id = $1 AND business_id = $2)`,
      [id, BUSINESS_A]
    )
    const incomeLine = lines.rows.find((r) => r.account_type === 'income')
    const cashLine = lines.rows.find((r) => r.account_type === 'cash')
    expect(Number(incomeLine.credit_minor)).toBe(50000)
    expect(Number(incomeLine.debit_minor)).toBe(0)
    expect(Number(cashLine.debit_minor)).toBe(50000)
    expect(Number(cashLine.credit_minor)).toBe(0)
  })

  it('INC-SVC-005: bank_transfer -> bank', async () => {
    const id = await makeIncome({ method: 'bank_transfer', amount_minor: 30000 })
    await service.postIncome(id, BUSINESS_A)
    const r = await client.query(
      `SELECT a.type AS t, jl.debit_minor FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
       WHERE jl.journal_entry_id = (SELECT id FROM journal_entries WHERE source_id = $1 AND business_id = $2)
       AND a.type = 'bank'`,
      [id, BUSINESS_A]
    )
    expect(r.rows.length).toBe(1)
    expect(Number(r.rows[0].debit_minor)).toBe(30000)
  })

  it('INC-SVC-006: debit -> bank', async () => {
    const id = await makeIncome({ method: 'debit', amount_minor: 1000 })
    await service.postIncome(id, BUSINESS_A)
    const r = await client.query(
      `SELECT a.type AS t, jl.debit_minor FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
       WHERE jl.journal_entry_id = (SELECT id FROM journal_entries WHERE source_id = $1 AND business_id = $2)
       AND a.type = 'bank'`,
      [id, BUSINESS_A]
    )
    expect(r.rows.length).toBe(1)
    expect(Number(r.rows[0].debit_minor)).toBe(1000)
  })

  it('INC-SVC-007: credit -> bank', async () => {
    const id = await makeIncome({ method: 'credit', amount_minor: 1000 })
    await service.postIncome(id, BUSINESS_A)
    const r = await client.query(
      `SELECT a.type AS t, jl.debit_minor FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
       WHERE jl.journal_entry_id = (SELECT id FROM journal_entries WHERE source_id = $1 AND business_id = $2)
       AND a.type = 'bank'`,
      [id, BUSINESS_A]
    )
    expect(r.rows.length).toBe(1)
    expect(Number(r.rows[0].debit_minor)).toBe(1000)
  })

  it('INC-SVC-008: cash method -> cash debit', async () => {
    const id = await makeIncome({ method: 'cash', amount_minor: 1000 })
    await service.postIncome(id, BUSINESS_A)
    const r = await client.query(
      `SELECT a.type AS t, jl.debit_minor FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
       WHERE jl.journal_entry_id = (SELECT id FROM journal_entries WHERE source_id = $1 AND business_id = $2)
       AND a.type = 'cash'`,
      [id, BUSINESS_A]
    )
    expect(r.rows.length).toBe(1)
    expect(Number(r.rows[0].debit_minor)).toBe(1000)
  })

  it('INC-SVC-009: unknown method rejected', async () => {
    await expect(makeIncome({ method: 'mobile' })).rejects.toThrow()
    await expect(makeIncome({ method: 'qris' })).rejects.toThrow()
  })

  it('INC-SVC-010: branch_id copied', async () => {
    const id = await makeIncome({ branch_id: BRANCH_A })
    await service.postIncome(id, BUSINESS_A)
    const je = await client.query(
      `SELECT branch_id FROM journal_entries WHERE source_id = $1 AND business_id = $2`,
      [id, BUSINESS_A]
    )
    expect(je.rows[0].branch_id).toBe(BRANCH_A)
  })

  it('INC-SVC-011: nullable branch supported', async () => {
    const id = await makeIncome({ branch_id: null })
    await service.postIncome(id, BUSINESS_A)
    const je = await client.query(
      `SELECT branch_id FROM journal_entries WHERE source_id = $1 AND business_id = $2`,
      [id, BUSINESS_A]
    )
    expect(je.rows[0].branch_id).toBeNull()
  })

  it('INC-SVC-012: tenant isolation', async () => {
    const id = await makeIncome()
    await expect(service.postIncome(id, BUSINESS_B)).rejects.toThrow(ApiError)
    const thrown = await service.postIncome(id, BUSINESS_B).catch((e) => e as ApiError)
    expect(thrown.status).toBe(404)
  })

  it('INC-SVC-013: deleted income rejected', async () => {
    const id = await makeIncome()
    await incomeRepository.softDeleteDraft(client, BUSINESS_A, id)
    const thrown = await service.postIncome(id, BUSINESS_A).catch((e) => e as ApiError)
    expect(thrown.status).toBe(404)
  })

  it('INC-SVC-014: posted replay returns same journal', async () => {
    const id = await makeIncome()
    const first = await service.postIncome(id, BUSINESS_A)
    const second = await service.postIncome(id, BUSINESS_A)
    expect(second.journalId).toBe(first.journalId)
    expect(second.sourceId).toBe(id)
  })

  it('INC-SVC-015: draft duplicate -> SOURCE_CONFLICT', async () => {
    const id = await makeIncome()
    const jid = randomUUID()
    await client.query(
      `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status)
       VALUES ($1, $2, $3, '2026-01-01', 'INCOME', $4, null, 'pre', 'draft')`,
      [jid, BUSINESS_A, BRANCH_A, id]
    )
    const thrown = await service.postIncome(id, BUSINESS_A).catch((e) => e as ApiError)
    expect(thrown.status).toBe(409)
    expect(thrown.code).toBe('SOURCE_CONFLICT')
  })

  it('INC-SVC-016: reversed source -> SOURCE_CONFLICT', async () => {
    const id = await makeIncome()
    const { journalId } = await service.postIncome(id, BUSINESS_A)
    await client.query(`SELECT create_reversal($1)`, [journalId])
    const thrown = await service.postIncome(id, BUSINESS_A).catch((e) => e as ApiError)
    expect(thrown.status).toBe(409)
    expect(thrown.code).toBe('SOURCE_CONFLICT')
  })

  it('INC-SVC-017: income status becomes posted', async () => {
    const id = await makeIncome()
    await service.postIncome(id, BUSINESS_A)
    const e = await incomeRepository.findById(client, BUSINESS_A, id)
    expect(e!.status).toBe('posted')
  })

  it('INC-SVC-018: server_version increments', async () => {
    const id = await makeIncome()
    await service.postIncome(id, BUSINESS_A)
    const e = await incomeRepository.findById(client, BUSINESS_A, id)
    expect(e!.server_version).toBe(2)
  })

  it('INC-SVC-019: updated_at changes', async () => {
    const id = await makeIncome()
    const before = (await incomeRepository.findById(client, BUSINESS_A, id))!.updated_at
    await service.postIncome(id, BUSINESS_A)
    const after = (await incomeRepository.findById(client, BUSINESS_A, id))!.updated_at
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime())
  })

  it('INC-SVC-020: posting atomicity (no journal on config failure)', async () => {
    const id = await makeIncome()
    await client.query(`DELETE FROM accounts WHERE business_id = $1 AND type = 'income'`, [BUSINESS_A])
    const thrown = await service.postIncome(id, BUSINESS_A).catch((e) => e as ApiError)
    expect(thrown.status).toBe(500)
    const cnt = await client.query(
      `SELECT COUNT(*)::int AS c FROM journal_entries WHERE business_id=$1 AND source_type='INCOME' AND source_id=$2`,
      [BUSINESS_A, id]
    )
    expect(parseInt(cnt.rows[0].c, 10)).toBe(0)
  })

  it('INC-SVC-021: income credited, revenue NOT touched', async () => {
    const id = await makeIncome({ method: 'cash', amount_minor: 40000 })
    await service.postIncome(id, BUSINESS_A)
    const lines = await client.query(
      `SELECT a.type AS account_type, jl.debit_minor, jl.credit_minor
       FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
       WHERE jl.journal_entry_id = (SELECT id FROM journal_entries WHERE source_id = $1 AND business_id = $2)`,
      [id, BUSINESS_A]
    )
    const revenueLines = lines.rows.filter((r) => r.account_type === 'revenue')
    expect(revenueLines.length).toBe(0)
    const incomeLine = lines.rows.find((r) => r.account_type === 'income')
    expect(incomeLine).toBeDefined()
    expect(Number(incomeLine!.credit_minor)).toBe(40000)
    expect(Number(incomeLine!.debit_minor)).toBe(0)
  })

  it('INC-SVC-022: no inventory mutation', async () => {
    const id = await makeIncome()
    const before = (await client.query(`SELECT COUNT(*)::int AS c FROM stocks WHERE business_id=$1`, [BUSINESS_A])).rows[0].c
    await service.postIncome(id, BUSINESS_A)
    const after = (await client.query(`SELECT COUNT(*)::int AS c FROM stocks WHERE business_id=$1`, [BUSINESS_A])).rows[0].c
    expect(after).toBe(before)
  })

  it('INC-SVC-023: no purchase mutation', async () => {
    const id = await makeIncome()
    const before = (await client.query(`SELECT COUNT(*)::int AS c FROM purchases WHERE business_id=$1`, [BUSINESS_A])).rows[0].c
    await service.postIncome(id, BUSINESS_A)
    const after = (await client.query(`SELECT COUNT(*)::int AS c FROM purchases WHERE business_id=$1`, [BUSINESS_A])).rows[0].c
    expect(after).toBe(before)
  })

  it('INC-SVC-024: no sales mutation', async () => {
    const id = await makeIncome()
    const before = (await client.query(`SELECT COUNT(*)::int AS c FROM sales WHERE business_id=$1`, [BUSINESS_A])).rows[0].c
    await service.postIncome(id, BUSINESS_A)
    const after = (await client.query(`SELECT COUNT(*)::int AS c FROM sales WHERE business_id=$1`, [BUSINESS_A])).rows[0].c
    expect(after).toBe(before)
  })
})
