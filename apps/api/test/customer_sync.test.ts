import path from 'path'
import { randomUUID } from 'crypto'
import type { Express } from 'express'
import { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { seedTestUser, authenticateTestUser } from './auth_helper'

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

let pool!: Pool
let app!: Express
let ownerTokenA!: string
let cashierTokenA!: string
let ownerTokenB!: string

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      customers,
      sale_items,
      sales,
      idempotency_keys,
      products,
      stocks,
      stock_movements,
      branches,
      refresh_tokens,
      user_businesses,
      users,
      businesses
    RESTART IDENTITY CASCADE
  `)

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, $2), ($3, $4) ON CONFLICT (id) DO NOTHING`,
    [BUSINESS_A, 'Business A', BUSINESS_B, 'Business B']
  )
}

async function seedCustomer(
  businessId: string,
  options: { name?: string; phone?: string | null; email?: string | null; serverVersion?: number } = {}
): Promise<string> {
  const id = randomUUID()
  const serverVersion = options.serverVersion ?? 0
  await pool.query(
    `INSERT INTO customers (id, business_id, name, phone, email, server_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
    [
      id,
      businessId,
      options.name ?? `Customer ${id.slice(0, 8)}`,
      options.phone ?? null,
      options.email ?? null,
      serverVersion,
    ]
  )
  return id
}

beforeAll(async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for integration tests')
  }
  pool = createPool(databaseUrl)
  await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
  app = createApp(pool)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await resetDatabase()

  const ownerA = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  const authOwnerA = await authenticateTestUser(app, ownerA.email, ownerA.password, BUSINESS_A)
  ownerTokenA = authOwnerA.accessToken

  const cashierA = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  const authCashierA = await authenticateTestUser(app, cashierA.email, cashierA.password, BUSINESS_A)
  cashierA.accessToken = authCashierA.accessToken

  const ownerB = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER' })
  const authOwnerB = await authenticateTestUser(app, ownerB.email, ownerB.password, BUSINESS_B)
  ownerTokenB = authOwnerB.accessToken
})

describe('Phase 4.1.38 Customer Sync API', () => {
  it('CUST-SYNC-001 returns customers for current business', async () => {
    await seedCustomer(BUSINESS_A, { name: 'Alice', serverVersion: 1 })
    await seedCustomer(BUSINESS_A, { name: 'Bob', serverVersion: 2 })

    const res = await request(app)
      .get('/v1/sync/customers')
      .query({ business_id: BUSINESS_A, after_version: 0, limit: 50 })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items).toHaveLength(2)
    expect(res.body.has_more).toBe(false)
    expect(typeof res.body.current_version).toBe('number')
  })

  it('CUST-SYNC-002 supports after_version cursor', async () => {
    await seedCustomer(BUSINESS_A, { name: 'Old', serverVersion: 1 })
    await seedCustomer(BUSINESS_A, { name: 'New', serverVersion: 5 })

    const res = await request(app)
      .get('/v1/sync/customers')
      .query({ business_id: BUSINESS_A, after_version: 3, limit: 50 })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].name).toBe('New')
    expect(res.body.current_version).toBe(5)
  })

  it('CUST-SYNC-003 respects limit', async () => {
    for (let i = 0; i < 5; i++) {
      await seedCustomer(BUSINESS_A, { name: `Customer ${i}`, serverVersion: i + 1 })
    }

    const res = await request(app)
      .get('/v1/sync/customers')
      .query({ business_id: BUSINESS_A, after_version: 0, limit: 2 })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(2)
    expect(res.body.has_more).toBe(true)
  })

  it('CUST-SYNC-004 cross-business customer is never returned', async () => {
    await seedCustomer(BUSINESS_B, { name: 'Judy', serverVersion: 1 })

    const res = await request(app)
      .get('/v1/sync/customers')
      .query({ business_id: BUSINESS_A, after_version: 0, limit: 50 })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(0)
  })

  it('CUST-SYNC-005 deleted customer appears as tombstone in sync', async () => {
    await seedCustomer(BUSINESS_A, { name: 'Active', serverVersion: 1 })
    const inactiveId = await seedCustomer(BUSINESS_A, { name: 'Inactive', serverVersion: 2 })
    await pool.query(`UPDATE customers SET deleted_at = now() WHERE id = $1`, [inactiveId])

    const res = await request(app)
      .get('/v1/sync/customers')
      .query({ business_id: BUSINESS_A, after_version: 0, limit: 50 })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    // Both active and deleted (tombstone) customers appear in sync
    expect(res.body.items).toHaveLength(2)
    const active = res.body.items.find((c: any) => c.name === 'Active')
    const inactive = res.body.items.find((c: any) => c.name === 'Inactive')
    expect(active).toBeDefined()
    expect(active.deleted_at).toBeNull()
    expect(inactive).toBeDefined()
    expect(inactive.deleted_at).not.toBeNull()
  })

  it('CUST-SYNC-006 empty result returns valid response', async () => {
    const res = await request(app)
      .get('/v1/sync/customers')
      .query({ business_id: BUSINESS_A, after_version: 0, limit: 50 })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(0)
    expect(res.body.has_more).toBe(false)
    expect(typeof res.body.current_version).toBe('number')
  })

  it('CUST-SYNC-007 invalid cursor/limit is rejected correctly', async () => {
    await request(app)
      .get('/v1/sync/customers')
      .query({ business_id: BUSINESS_A, after_version: -1, limit: 50 })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(400)

    const res = await request(app)
      .get('/v1/sync/customers')
      .query({ business_id: BUSINESS_A, after_version: 0, limit: 0 })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('CUST-SYNC-008 requires proper authentication', async () => {
    await request(app)
      .get('/v1/sync/customers')
      .query({ business_id: BUSINESS_A, after_version: 0, limit: 50 })
      .expect(401)
  })
})
