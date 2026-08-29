import path from 'path'
import { randomUUID } from 'crypto'
import { Pool, PoolClient } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { incomeRepository, IncomeMethod } from '../src/repositories/income_repository'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'
const BRANCH_B = '22222222-2222-4222-8222-222222222222'

let pool!: Pool
let client!: PoolClient

beforeAll(async () => {
  const dbUrl =
    process.env.INCOME_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)
  await runMigrations(pool, path.resolve(__dirname, '../migrations'))

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1,'INC A'),($2,'INC B') ON CONFLICT (id) DO NOTHING`,
    [BUSINESS_A, BUSINESS_B]
  )
  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1,$2,'BA',true),($3,$4,'BB',true) ON CONFLICT (id) DO NOTHING`,
    [BRANCH_A, BUSINESS_A, BRANCH_B, BUSINESS_B]
  )
  await pool.query(`TRUNCATE TABLE incomes RESTART IDENTITY CASCADE`)

  client = await pool.connect()
})

afterAll(async () => {
  await client.release()
  await pool.end()
})

async function rawInsert(
  businessId: string,
  status: 'draft' | 'posted' | 'reversed',
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const id = randomUUID()
  await client.query(
    `INSERT INTO incomes (id, business_id, branch_id, date, amount_minor, method, category, reference, description, status, server_version, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,now(),now())`,
    [
      id,
      businessId,
      overrides.branch_id ?? null,
      overrides.date ?? '2026-01-01',
      overrides.amount_minor ?? 1000,
      (overrides.method as IncomeMethod) ?? 'cash',
      overrides.category ?? null,
      overrides.reference ?? null,
      overrides.description ?? 'raw',
      status,
    ]
  )
  return id
}

describe('9C.5C Income repository', () => {
  it('INC-023: create draft', async () => {
    const e = await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 5000,
      method: 'cash',
      category: null,
      reference: null,
      description: 'Gift',
    })
    expect(e.status).toBe('draft')
    expect(e.server_version).toBe(1)
    expect(e.amount_minor).toBe(5000)
  })

  it('INC-024: tenant isolation', async () => {
    const id = randomUUID()
    await incomeRepository.create(client, {
      id,
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: 'TENANT',
      reference: null,
      description: 'iso',
    })
    expect(await incomeRepository.findById(client, BUSINESS_B, id)).toBeNull()
    const list = await incomeRepository.list(client, BUSINESS_B, { category: 'TENANT' })
    expect(list.total).toBe(0)
  })

  it('INC-025: branch nullable', async () => {
    const noBranch = await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: null,
      reference: null,
      description: 'nb',
    })
    expect((await incomeRepository.findById(client, BUSINESS_A, noBranch.id))!.branch_id).toBeNull()
    const withBranch = await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: BRANCH_A,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: null,
      reference: null,
      description: 'wb',
    })
    expect(
      (await incomeRepository.findById(client, BUSINESS_A, withBranch.id))!.branch_id
    ).toBe(BRANCH_A)
  })

  it('INC-026: branch filter', async () => {
    await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: BRANCH_A,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: 'BRFILTER',
      reference: null,
      description: 'b',
    })
    await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: 'BRFILTER',
      reference: null,
      description: 'nb',
    })
    const list = await incomeRepository.list(client, BUSINESS_A, {
      branchId: BRANCH_A,
      category: 'BRFILTER',
    })
    expect(list.rows.length).toBe(1)
    expect(list.rows[0].branch_id).toBe(BRANCH_A)
  })

  it('INC-027: get by id', async () => {
    const created = await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 777,
      method: 'bank_transfer',
      category: 'GET',
      reference: 'R1',
      description: 'get',
    })
    const found = await incomeRepository.findById(client, BUSINESS_A, created.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
    expect(found!.amount_minor).toBe(777)
  })

  it('INC-028: list excludes deleted', async () => {
    const id = randomUUID()
    await incomeRepository.create(client, {
      id,
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: 'DEL',
      reference: null,
      description: 'd',
    })
    const deleted = await incomeRepository.softDeleteDraft(client, BUSINESS_A, id)
    expect(deleted).not.toBeNull()
    expect(await incomeRepository.findById(client, BUSINESS_A, id)).toBeNull()
    const list = await incomeRepository.list(client, BUSINESS_A, { category: 'DEL' })
    expect(list.total).toBe(0)
  })

  it('INC-029: update draft', async () => {
    const e = await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: 'UPD',
      reference: null,
      description: 'old',
    })
    const updated = await incomeRepository.updateDraft(client, BUSINESS_A, e.id, 1, {
      description: 'new',
      amount_minor: 2222,
    })
    expect(updated).not.toBeNull()
    expect(updated!.description).toBe('new')
    expect(updated!.amount_minor).toBe(2222)
  })

  it('INC-030: update posted rejected', async () => {
    const id = await rawInsert(BUSINESS_A, 'posted', { category: 'UPDP' })
    const res = await incomeRepository.updateDraft(client, BUSINESS_A, id, 1, {
      description: 'x',
    })
    expect(res).toBeNull()
  })

  it('INC-031: update reversed rejected', async () => {
    const id = await rawInsert(BUSINESS_A, 'reversed', { category: 'UPDR' })
    const res = await incomeRepository.updateDraft(client, BUSINESS_A, id, 1, {
      description: 'x',
    })
    expect(res).toBeNull()
  })

  it('INC-032: optimistic locking', async () => {
    const e = await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: 'OL',
      reference: null,
      description: 'o',
    })
    const stale = await incomeRepository.updateDraft(client, BUSINESS_A, e.id, 999, {
      description: 'stale',
    })
    expect(stale).toBeNull()
    const ok = await incomeRepository.updateDraft(client, BUSINESS_A, e.id, 1, {
      description: 'fresh',
    })
    expect(ok).not.toBeNull()
    expect(ok!.description).toBe('fresh')
  })

  it('INC-033: server_version increments', async () => {
    const e = await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: 'SV',
      reference: null,
      description: 's',
    })
    const up = await incomeRepository.updateDraft(client, BUSINESS_A, e.id, 1, {
      description: 's2',
    })
    expect(up!.server_version).toBe(2)
    const del = await incomeRepository.softDeleteDraft(client, BUSINESS_A, e.id)
    expect(del!.server_version).toBe(3)
  })

  it('INC-034: updated_at changes', async () => {
    const e = await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: 'UAT',
      reference: null,
      description: 'u',
    })
    const before = (await incomeRepository.findById(client, BUSINESS_A, e.id))!.updated_at
    await incomeRepository.updateDraft(client, BUSINESS_A, e.id, 1, { description: 'u2' })
    const after = (await incomeRepository.findById(client, BUSINESS_A, e.id))!.updated_at
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime())
  })

  it('INC-035: soft delete draft', async () => {
    const e = await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: 'SD',
      reference: null,
      description: 'sd',
    })
    const del = await incomeRepository.softDeleteDraft(client, BUSINESS_A, e.id)
    expect(del).not.toBeNull()
    expect(del!.deleted_at).not.toBeNull()
  })

  it('INC-036: soft delete posted rejected', async () => {
    const id = await rawInsert(BUSINESS_A, 'posted', { category: 'SDP' })
    expect(await incomeRepository.softDeleteDraft(client, BUSINESS_A, id)).toBeNull()
  })

  it('INC-037: soft delete reversed rejected', async () => {
    const id = await rawInsert(BUSINESS_A, 'reversed', { category: 'SDR' })
    expect(await incomeRepository.softDeleteDraft(client, BUSINESS_A, id)).toBeNull()
  })

  it('INC-038: pagination parameterized', async () => {
    for (let i = 0; i < 3; i++) {
      await incomeRepository.create(client, {
        id: randomUUID(),
        business_id: BUSINESS_A,
        branch_id: null,
        date: '2026-02-01',
        amount_minor: 1000,
        method: 'cash',
        category: 'PAGETEST',
        reference: null,
        description: 'p' + i,
      })
    }
    const first = await incomeRepository.list(client, BUSINESS_A, {
      category: 'PAGETEST',
      limit: 2,
      offset: 0,
    })
    expect(first.rows.length).toBe(2)
    const second = await incomeRepository.list(client, BUSINESS_A, {
      category: 'PAGETEST',
      limit: 2,
      offset: 2,
    })
    expect(second.rows.length).toBe(1)
    const third = await incomeRepository.list(client, BUSINESS_A, {
      category: 'PAGETEST',
      limit: 2,
      offset: 4,
    })
    expect(third.rows.length).toBe(0)
  })

  it('INC-039: category filter', async () => {
    await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: 'OPSCAT',
      reference: null,
      description: 'o',
    })
    await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: 'TRAVCAT',
      reference: null,
      description: 't',
    })
    const list = await incomeRepository.list(client, BUSINESS_A, { category: 'OPSCAT' })
    expect(list.rows.length).toBeGreaterThanOrEqual(1)
    expect(list.rows.every((r) => r.category === 'OPSCAT')).toBe(true)
  })

  it('INC-040: date range filter', async () => {
    await rawInsert(BUSINESS_A, 'draft', { category: 'DATECAT', date: '2026-03-10' })
    await rawInsert(BUSINESS_A, 'draft', { category: 'DATECAT', date: '2026-05-10' })
    const list = await incomeRepository.list(client, BUSINESS_A, {
      category: 'DATECAT',
      date_from: '2026-04-01',
      date_to: '2026-06-01',
    })
    expect(list.rows.length).toBe(1)
    expect(list.rows[0].date).toBe('2026-05-10')
  })

  it('INC-041: search reference/description/category', async () => {
    const id = randomUUID()
    await incomeRepository.create(client, {
      id,
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: 'FOOD',
      reference: 'REFXYZ',
      description: 'lunch income',
    })
    const byRef = await incomeRepository.list(client, BUSINESS_A, { search: 'REFXYZ' })
    expect(byRef.rows.some((r) => r.id === id)).toBe(true)
    const byDesc = await incomeRepository.list(client, BUSINESS_A, { search: 'lunch' })
    expect(byDesc.rows.some((r) => r.id === id)).toBe(true)
    const byCat = await incomeRepository.list(client, BUSINESS_A, { search: 'FOOD' })
    expect(byCat.rows.some((r) => r.id === id)).toBe(true)
  })

  it('INC-042: payment method preserved', async () => {
    const e = await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'bank_transfer',
      category: null,
      reference: null,
      description: 'pm',
    })
    const found = await incomeRepository.findById(client, BUSINESS_A, e.id)
    expect(found!.method).toBe('bank_transfer')
  })

  it('INC-043: amount integer semantics', async () => {
    const e = await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 12345,
      method: 'cash',
      category: null,
      reference: null,
      description: 'amt',
    })
    const found = await incomeRepository.findById(client, BUSINESS_A, e.id)
    expect(found!.amount_minor).toBe(12345)
    expect(Number.isInteger(found!.amount_minor)).toBe(true)
  })

  it('INC-044: findByBusinessAfter tenant scoped', async () => {
    const aId = await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_A,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: 'SYNC',
      reference: null,
      description: 'a',
    }).then((i) => i.id)
    await incomeRepository.create(client, {
      id: randomUUID(),
      business_id: BUSINESS_B,
      branch_id: null,
      date: '2026-02-01',
      amount_minor: 1000,
      method: 'cash',
      category: 'SYNC',
      reference: null,
      description: 'b',
    })
    const rows = await incomeRepository.findByBusinessAfter(client, BUSINESS_A, 0, 100)
    expect(rows.every((r) => r.business_id === BUSINESS_A)).toBe(true)
    expect(rows.some((r) => r.id === aId)).toBe(true)
  })
})
