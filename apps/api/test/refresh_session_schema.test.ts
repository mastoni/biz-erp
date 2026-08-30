import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { Pool } from 'pg'
import path from 'path'
import { randomUUID } from 'crypto'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'

// Phase 4.1.41B-4a: Refresh Session Schema Foundation (DB contract tests).
// Pure schema tests — no login/refresh behavior is exercised here.

describe('Phase 4.1.41B-4a Refresh Session Schema Foundation', () => {
  let pool: Pool

  const BUSINESS = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  let userId: string

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
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
      [BUSINESS, 'Business E']
    )
    userId = randomUUID()
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)',
      [userId, 'user@test.com', 'hash', 'ACTIVE']
    )
  })

  const insertSession = (businessId: string | null, scope: string) =>
    pool.query(
      `INSERT INTO refresh_tokens (id, user_id, business_id, token_hash, scope, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + interval '30 days')`,
      [randomUUID(), userId, businessId, `hash_${randomUUID()}`, scope]
    )

  it('RS-001 inserting a refresh row without scope defaults to tenant', async () => {
    await pool.query(
      `INSERT INTO refresh_tokens (id, user_id, business_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '30 days')`,
      [randomUUID(), userId, BUSINESS, `hash_${randomUUID()}`]
    )
    const r = await pool.query('SELECT scope FROM refresh_tokens')
    expect(r.rows[0].scope).toBe('tenant')
  })

  it('RS-002 existing tenant rows remain business-bound (scope=tenant, business_id set)', async () => {
    await insertSession(BUSINESS, 'tenant')
    const r = await pool.query('SELECT business_id, scope FROM refresh_tokens')
    expect(r.rows[0].business_id).toBe(BUSINESS)
    expect(r.rows[0].scope).toBe('tenant')
  })

  it('RS-003 platform row may have business_id NULL', async () => {
    await expect(insertSession(null, 'platform')).resolves.toBeDefined()
    const r = await pool.query('SELECT business_id, scope FROM refresh_tokens WHERE scope = $1', ['platform'])
    expect(r.rows[0].business_id).toBeNull()
    expect(r.rows[0].scope).toBe('platform')
  })

  it('RS-004 invalid scope is rejected by DB CHECK', async () => {
    await expect(insertSession(BUSINESS, 'admin')).rejects.toMatchObject({ code: '23514' })
  })

  it('RS-005 explicit NULL scope is rejected (NOT NULL)', async () => {
    await expect(insertSession(BUSINESS, null as unknown as string)).rejects.toMatchObject({ code: '23502' })
  })

  it('RS-006 DB permits tenant row with NULL business_id, but app contract binds it', async () => {
    // The schema no longer forces business_id; the application layer (refresh_token_service)
    // still requires a business_id for tenant sessions. This test proves the column is nullable.
    await expect(insertSession(null, 'tenant')).resolves.toBeDefined()
    const r = await pool.query('SELECT business_id, scope FROM refresh_tokens WHERE scope = $1', ['tenant'])
    expect(r.rows[0].business_id).toBeNull()
  })
})
