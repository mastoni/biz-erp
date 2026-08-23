import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { Pool } from 'pg'
import path from 'path'
import { randomUUID } from 'crypto'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'

// Phase 4.1.41B-1: Platform Identity Foundation (DB-level contract tests).
// Pure storage tests — no JWT / auth / API behavior is exercised here.

describe('Phase 4.1.41B-1 Platform Identity Foundation', () => {
  let pool: Pool

  const BUSINESS = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    }
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
  })

  afterAll(async () => {
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE user_businesses, refresh_tokens, users, businesses
      RESTART IDENTITY CASCADE
    `)
    await pool.query(
      `INSERT INTO businesses (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [BUSINESS, 'Business C']
    )
  })

  const insertUser = (platformRole: string | null) =>
    pool.query(
      `INSERT INTO users (id, email, password_hash, status, platform_role)
       VALUES ($1, $2, 'hash', 'ACTIVE', $3)`,
      [randomUUID(), `${randomUUID()}@test.com`, platformRole]
    )

  const insertMembership = (userId: string, role: string, businessId: string | null) =>
    pool.query(
      `INSERT INTO user_businesses (user_id, business_id, role, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [userId, businessId, role]
    )

  it('PI-001 existing OWNER tenant user keeps platform_role NULL and role OWNER', async () => {
    const userId = randomUUID()
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, 'hash', 'ACTIVE')`,
      [userId, 'owner@test.com']
    )
    await insertMembership(userId, 'OWNER', BUSINESS)

    const user = await pool.query('SELECT platform_role FROM users WHERE id = $1', [userId])
    const membership = await pool.query(
      'SELECT role FROM user_businesses WHERE user_id = $1',
      [userId]
    )
    expect(user.rows[0].platform_role).toBeNull()
    expect(membership.rows[0].role).toBe('OWNER')
  })

  it('PI-002 existing CASHIER tenant user keeps platform_role NULL and role CASHIER', async () => {
    const userId = randomUUID()
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, 'hash', 'ACTIVE')`,
      [userId, 'cashier@test.com']
    )
    await insertMembership(userId, 'CASHIER', BUSINESS)

    const user = await pool.query('SELECT platform_role FROM users WHERE id = $1', [userId])
    const membership = await pool.query(
      'SELECT role FROM user_businesses WHERE user_id = $1',
      [userId]
    )
    expect(user.rows[0].platform_role).toBeNull()
    expect(membership.rows[0].role).toBe('CASHIER')
  })

  it('PI-003 platform_role NULL is a valid value', async () => {
    await expect(insertUser(null)).resolves.toBeDefined()
  })

  it('PI-004 PLATFORM_ADMIN is a valid platform role', async () => {
    await expect(insertUser('PLATFORM_ADMIN')).resolves.toBeDefined()
    const r = await pool.query(
      "SELECT platform_role FROM users WHERE platform_role = 'PLATFORM_ADMIN'"
    )
    expect(r.rows).toHaveLength(1)
  })

  it('PI-005 SUPER_ADMIN is a valid platform role', async () => {
    await expect(insertUser('SUPER_ADMIN')).resolves.toBeDefined()
    const r = await pool.query(
      "SELECT platform_role FROM users WHERE platform_role = 'SUPER_ADMIN'"
    )
    expect(r.rows).toHaveLength(1)
  })

  it('PI-006 invalid platform role is rejected by DB CHECK', async () => {
    await expect(insertUser('ADMIN')).rejects.toMatchObject({ code: '23514' })
  })

  it('PI-007 platform user can exist WITHOUT user_businesses membership', async () => {
    const userId = randomUUID()
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status, platform_role)
       VALUES ($1, $2, 'hash', 'ACTIVE', 'PLATFORM_ADMIN')`,
      [userId, 'platformadmin@test.com']
    )
    const membership = await pool.query(
      'SELECT * FROM user_businesses WHERE user_id = $1',
      [userId]
    )
    expect(membership.rows).toHaveLength(0)
  })

  it('PI-008 user_businesses still rejects NULL business_id', async () => {
    const userId = randomUUID()
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, 'hash', 'ACTIVE')`,
      [userId, 'nobiz@test.com']
    )
    await expect(insertMembership(userId, 'OWNER', null)).rejects.toMatchObject({
      code: '23502',
    })
  })

  it('PI-009 user_businesses role remains OWNER/CASHIER only', async () => {
    const userId = randomUUID()
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, 'hash', 'ACTIVE')`,
      [userId, 'tenantonly@test.com']
    )
    await expect(insertMembership(userId, 'PLATFORM_ADMIN', BUSINESS)).rejects.toMatchObject({
      code: '23514',
    })
    await expect(insertMembership(userId, 'INVALID', BUSINESS)).rejects.toMatchObject({
      code: '23514',
    })
    await expect(insertMembership(userId, null as unknown as string, BUSINESS)).rejects.toMatchObject({
      code: '23502',
    })
  })
})
