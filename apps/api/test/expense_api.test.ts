import path from 'path'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { seedTestUser, authenticateTestUser } from './auth_helper'
import { ApiError } from '../src/errors/api_error'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BRANCH_A = '11111111-1111-4111-8111-111111111111'
const BRANCH_B = '22222222-2222-4222-8222-222222222222'

let pool!: Pool
let app!: ReturnType<typeof createApp>
let ownerTokenA!: string
let ownerTokenB!: string
let cashierTokenA!: string

async function resetDatabase(): Promise<void> {
  await pool.query(
    `TRUNCATE
       expenses, journal_lines, journal_entries, accounts,
       purchase_payments, purchase_items, purchases, suppliers,
       customers, sale_items, sales, products, stocks, stock_movements,
       branches, refresh_tokens, user_businesses, users, businesses
       RESTART IDENTITY CASCADE`
  )

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, 'Business A'), ($2, 'Business B') ON CONFLICT (id) DO NOTHING`,
    [BUSINESS_A, BUSINESS_B]
  )

  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES
     ($1, $2, 'Branch A', true), ($3, $4, 'Branch B', true)
     ON CONFLICT (id) DO NOTHING`,
    [BRANCH_A, BUSINESS_A, BRANCH_B, BUSINESS_B]
  )

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
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'IDR', true, now(), 1)
       ON CONFLICT (business_id, code) DO NOTHING`,
      [BUSINESS_A, acc.code, acc.name, acc.type]
    )
    await pool.query(
      `INSERT INTO accounts (id, business_id, code, name, type, currency, active, created_at, server_version)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'IDR', true, now(), 1)
       ON CONFLICT (business_id, code) DO NOTHING`,
      [BUSINESS_B, acc.code, acc.name, acc.type]
    )
  }
}

async function seedTokens(): Promise<void> {
  const ownerA = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  const authA = await authenticateTestUser(app, ownerA.email, ownerA.password, BUSINESS_A)
  ownerTokenA = authA.accessToken

  const ownerB = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER' })
  const authB = await authenticateTestUser(app, ownerB.email, ownerB.password, BUSINESS_B)
  ownerTokenB = authB.accessToken

  const cashierA = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  const authC = await authenticateTestUser(app, cashierA.email, cashierA.password, BUSINESS_A)
  cashierTokenA = authC.accessToken
}

interface CreatedExpense {
  id: string
  server_version: number
  status: string
}

async function createExpense(token: string, overrides: Record<string, unknown> = {}): Promise<CreatedExpense> {
  const res = await request(app)
    .post('/v1/expenses')
    .set('Authorization', `Bearer ${token}`)
    .send({
      date: '2026-01-15',
      amount_minor: 2500,
      method: 'cash',
      description: 'Office supplies',
      branch_id: BRANCH_A,
      ...overrides,
    })
    .expect(201)

  return res.body as CreatedExpense
}

beforeAll(async () => {
  const dbUrl =
    process.env.EXPENSE_DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)
  await runMigrations(pool, path.resolve(__dirname, '../migrations'))
  app = createApp(pool)
})

beforeEach(async () => {
  await resetDatabase()
  await seedTokens()
})

afterAll(async () => {
  await pool.end()
})

describe('9C.4F Expense API routes', () => {
  it('EXP-API-001: GET expenses OWNER', async () => {
    await createExpense(ownerTokenA)
    const res = await request(app)
      .get('/v1/expenses')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.total).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(res.body.rows)).toBe(true)
    expect(res.body.rows[0].business_id).toBe(BUSINESS_A)
  })

  it('EXP-API-002: GET expenses CASHIER', async () => {
    await createExpense(ownerTokenA)
    const res = await request(app)
      .get('/v1/expenses')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .expect(200)

    expect(res.body.total).toBeGreaterThanOrEqual(1)
  })

  it('EXP-API-003: unauthenticated GET -> 401', async () => {
    const res = await request(app).get('/v1/expenses').expect(401)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  it('EXP-API-004: POST draft OWNER -> 201', async () => {
    const res = await request(app)
      .post('/v1/expenses')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        date: '2026-01-15',
        amount_minor: 2500,
        method: 'cash',
        description: 'Office supplies',
        branch_id: BRANCH_A,
      })
      .expect(201)

    expect(res.body.status).toBe('draft')
    expect(res.body.server_version).toBe(1)
    expect(res.body.branch_id).toBe(BRANCH_A)
  })

  it('EXP-API-005: POST draft CASHIER -> 403', async () => {
    await request(app)
      .post('/v1/expenses')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({
        date: '2026-01-15',
        amount_minor: 2500,
        method: 'cash',
        description: 'x',
      })
      .expect(403)
  })

  it('EXP-API-006: tenant isolation', async () => {
    await createExpense(ownerTokenB, { branch_id: BRANCH_B })
    const res = await request(app)
      .get('/v1/expenses')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.rows.every((e: any) => e.business_id === BUSINESS_A)).toBe(true)
  })

  it('EXP-API-007: branch filter', async () => {
    await createExpense(ownerTokenA, { branch_id: BRANCH_A })
    await createExpense(ownerTokenA, { branch_id: BRANCH_B })

    const res = await request(app)
      .get('/v1/expenses')
      .query({ branch_id: BRANCH_A })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.rows.every((e: any) => e.branch_id === BRANCH_A)).toBe(true)
    expect(res.body.total).toBe(1)
  })

  it('EXP-API-008: GET detail', async () => {
    const created = await createExpense(ownerTokenA)
    const res = await request(app)
      .get(`/v1/expenses/${created.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.id).toBe(created.id)
    expect(res.body.method).toBe('cash')
    expect(res.body.amount_minor).toBe(2500)
  })

  it('EXP-API-009: 404 detail', async () => {
    const res = await request(app)
      .get(`/v1/expenses/${randomUUID()}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(404)

    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('EXP-API-010: invalid amount', async () => {
    const res = await request(app)
      .post('/v1/expenses')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        date: '2026-01-15',
        amount_minor: 0,
        method: 'cash',
        description: 'x',
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('EXP-API-011: invalid method', async () => {
    const res = await request(app)
      .post('/v1/expenses')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        date: '2026-01-15',
        amount_minor: 2500,
        method: 'mobile',
        description: 'x',
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('EXP-API-012: missing description', async () => {
    const res = await request(app)
      .post('/v1/expenses')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        date: '2026-01-15',
        amount_minor: 2500,
        method: 'cash',
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('EXP-API-013: PATCH draft', async () => {
    const created = await createExpense(ownerTokenA)
    const res = await request(app)
      .patch(`/v1/expenses/${created.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        expected_server_version: created.server_version,
        description: 'Updated description',
      })
      .expect(200)

    expect(res.body.description).toBe('Updated description')
    expect(res.body.server_version).toBe(2)
  })

  it('EXP-API-014: PATCH non-draft rejected', async () => {
    const created = await createExpense(ownerTokenA)
    await request(app)
      .post('/v1/finance/postings/expense')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ expense_id: created.id })
      .expect(201)

    const res = await request(app)
      .patch(`/v1/expenses/${created.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        expected_server_version: 1,
        description: 'nope',
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('EXP-API-015: stale version -> 409', async () => {
    const created = await createExpense(ownerTokenA)
    const res = await request(app)
      .patch(`/v1/expenses/${created.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        expected_server_version: 999,
        description: 'stale',
      })
      .expect(409)

    expect(res.body.error.code).toBe('VERSION_CONFLICT')
  })

  it('EXP-API-016: DELETE draft', async () => {
    const created = await createExpense(ownerTokenA)
    await request(app)
      .delete(`/v1/expenses/${created.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(204)

    await request(app)
      .get(`/v1/expenses/${created.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(404)
  })

  it('EXP-API-017: DELETE posted rejected', async () => {
    const created = await createExpense(ownerTokenA)
    await request(app)
      .post('/v1/finance/postings/expense')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ expense_id: created.id })
      .expect(201)

    const res = await request(app)
      .delete(`/v1/expenses/${created.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('EXP-API-018: POST expense OWNER', async () => {
    const created = await createExpense(ownerTokenA)
    const res = await request(app)
      .post('/v1/finance/postings/expense')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ expense_id: created.id })
      .expect(201)

    expect(res.body.journalId).toBeDefined()
    expect(res.body.sourceId).toBe(created.id)
  })

  it('EXP-API-019: POST expense CASHIER -> 403', async () => {
    const created = await createExpense(ownerTokenA)
    await request(app)
      .post('/v1/finance/postings/expense')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({ expense_id: created.id })
      .expect(403)
  })

  it('EXP-API-020: post missing expense -> 404', async () => {
    const res = await request(app)
      .post('/v1/finance/postings/expense')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ expense_id: randomUUID() })
      .expect(404)

    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('EXP-API-021: post already-posted expense idempotent', async () => {
    const created = await createExpense(ownerTokenA)
    const first = await request(app)
      .post('/v1/finance/postings/expense')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ expense_id: created.id })
      .expect(201)

    const second = await request(app)
      .post('/v1/finance/postings/expense')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ expense_id: created.id })
      .expect(201)

    expect(second.body.journalId).toBe(first.body.journalId)
  })

  it('EXP-API-022: source conflict -> 409', async () => {
    const created = await createExpense(ownerTokenA)
    const posted = await request(app)
      .post('/v1/finance/postings/expense')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ expense_id: created.id })
      .expect(201)

    await request(app)
      .post('/v1/finance/reversals')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ journal_id: posted.body.journalId })
      .expect(201)

    const res = await request(app)
      .post('/v1/finance/postings/expense')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ expense_id: created.id })
      .expect(409)

    expect(res.body.error.code).toBe('SOURCE_CONFLICT')
  })

  it('EXP-API-023: branch optional', async () => {
    const res = await request(app)
      .post('/v1/expenses')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        date: '2026-01-15',
        amount_minor: 2500,
        method: 'cash',
        description: 'No branch',
      })
      .expect(201)

    expect(res.body.branch_id).toBeNull()
  })

  it('EXP-API-024: tenant mismatch rejected', async () => {
    const res = await request(app)
      .post('/v1/expenses')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        business_id: BUSINESS_B,
        date: '2026-01-15',
        amount_minor: 2500,
        method: 'cash',
        description: 'x',
      })
      .expect(403)

    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  it('EXP-API-025: pagination validation', async () => {
    const res = await request(app)
      .get('/v1/expenses')
      .query({ limit: 'not-a-number' })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
