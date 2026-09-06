import path from 'path'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createJwtService, JwtService } from '../src/services/jwt_service'
import { createWalletService } from '../src/services/wallet_service'
import { createPlatformService } from '../src/services/platform_service'
import { createAuditService } from '../src/services/audit_service'
import { seedTestUser } from './auth_helper'

const BUSINESS_A = '11111111-aaaa-4111-8aaa-111111111111'
const BUSINESS_B = '22222222-bbbb-4222-8bbb-222222222222'
const BUSINESS_INACTIVE = '33333333-cccc-4333-8ccc-333333333333'

let pool: Pool
let app: ReturnType<typeof createApp>
let jwtService: JwtService
let ownerTokenA: string
let ownerTokenB: string
let superAdminToken: string

async function cleanData(): Promise<void> {
  await pool.query(`
    UPDATE businesses SET account_customer_id = NULL WHERE id IN ('${BUSINESS_A}', '${BUSINESS_B}', '${BUSINESS_INACTIVE}');
    UPDATE subscriptions SET account_customer_id = NULL WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}', '${BUSINESS_INACTIVE}');
    DELETE FROM wallet_ledgers WHERE wallet_id IN (
      SELECT id FROM wallet_accounts WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}', '${BUSINESS_INACTIVE}')
    );
    DELETE FROM top_up_intents WHERE wallet_id IN (
      SELECT id FROM wallet_accounts WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}', '${BUSINESS_INACTIVE}')
    );
    DELETE FROM wallet_accounts WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}', '${BUSINESS_INACTIVE}');
    DELETE FROM subscriptions WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}', '${BUSINESS_INACTIVE}');
    DELETE FROM devices WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}', '${BUSINESS_INACTIVE}');
    DELETE FROM branches WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}', '${BUSINESS_INACTIVE}');
    DELETE FROM user_businesses WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}', '${BUSINESS_INACTIVE}');
    DELETE FROM businesses WHERE id IN ('${BUSINESS_A}', '${BUSINESS_B}', '${BUSINESS_INACTIVE}');
    DELETE FROM account_customers WHERE code LIKE 'TEST-ACC-%';
  `)
}

beforeAll(async () => {
  const dbUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)

  const migrationsDir = path.resolve(__dirname, '../migrations')
  await runMigrations(pool, migrationsDir)

  const jwtSecret = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
  const jwtIssuer = process.env.JWT_ISSUER || 'biz-erp-api'
  const jwtAudience = process.env.JWT_AUDIENCE || 'biz-erp-client'
  jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)

  app = createApp(pool)
})

afterAll(async () => {
  await cleanData()
  await pool.end()
})

beforeEach(async () => {
  await cleanData()

  // 1. Seed Business A (ACTIVE)
  await pool.query(
    `INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant A Corp', 'ACTIVE')
     ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE'`,
    [BUSINESS_A]
  )

  // 2. Seed Business B (ACTIVE)
  await pool.query(
    `INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant B Corp', 'ACTIVE')
     ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE'`,
    [BUSINESS_B]
  )

  // 3. Seed Business Inactive (PENDING_REVIEW)
  await pool.query(
    `INSERT INTO businesses (id, name, status) VALUES ($1, 'Inactive Tenant Corp', 'PENDING_REVIEW')
     ON CONFLICT (id) DO UPDATE SET status = 'PENDING_REVIEW'`,
    [BUSINESS_INACTIVE]
  )

  // 4. Seed Tokens
  const ownerUserA = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  ownerTokenA = jwtService.signAccessToken({
    sub: ownerUserA.userId,
    business_id: BUSINESS_A,
    role: 'OWNER',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  const ownerUserB = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER' })
  ownerTokenB = jwtService.signAccessToken({
    sub: ownerUserB.userId,
    business_id: BUSINESS_B,
    role: 'OWNER',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  const superAdminUser = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  superAdminToken = jwtService.signAccessToken({
    sub: superAdminUser.userId,
    scope: 'platform',
    role: 'SUPER_ADMIN',
    session_id: randomUUID(),
    jti: randomUUID()
  })
})

describe('Digital Wallet Tenant Account Initialization Gate', () => {
  it('Scenario A: ACTIVE business with missing wallet initializes wallet account', async () => {
    const walletService = createWalletService(pool)
    const wallet = await walletService.ensureTenantWallet(BUSINESS_A)

    expect(wallet).toBeDefined()
    expect(wallet.business_id).toBe(BUSINESS_A)
    expect(wallet.currency).toBe('IDR')
    expect(wallet.status).toBe('ACTIVE')
    expect(Number(wallet.balance)).toBe(0)
  })

  it('Scenario B: ACTIVE business with existing wallet does not create duplicate', async () => {
    const walletService = createWalletService(pool)
    const wallet1 = await walletService.ensureTenantWallet(BUSINESS_A)
    const wallet2 = await walletService.ensureTenantWallet(BUSINESS_A)

    expect(wallet1.id).toBe(wallet2.id)

    const dbRows = await pool.query('SELECT * FROM wallet_accounts WHERE business_id = $1', [BUSINESS_A])
    expect(dbRows.rows.length).toBe(1)
  })

  it('Scenario C: repeated initialization is idempotent', async () => {
    const walletService = createWalletService(pool)
    const results = await Promise.all([
      walletService.ensureTenantWallet(BUSINESS_A),
      walletService.ensureTenantWallet(BUSINESS_A),
      walletService.ensureTenantWallet(BUSINESS_A),
    ])

    const ids = new Set(results.map(r => r.id))
    expect(ids.size).toBe(1)

    const dbRows = await pool.query('SELECT * FROM wallet_accounts WHERE business_id = $1', [BUSINESS_A])
    expect(dbRows.rows.length).toBe(1)
  })

  it('Scenario D: tenant isolation - Tenant A cannot initialize or access Tenant B wallet', async () => {
    // Tenant A accesses GET /v1/wallets
    const resA = await request(app)
      .get('/v1/wallets')
      .set('Authorization', `Bearer ${ownerTokenA}`)

    expect(resA.status).toBe(200)
    expect(resA.body.items.length).toBe(1)
    const walletAId = resA.body.items[0].id
    expect(resA.body.items[0].business_id).toBe(BUSINESS_A)

    // Tenant B accesses GET /v1/wallets
    const resB = await request(app)
      .get('/v1/wallets')
      .set('Authorization', `Bearer ${ownerTokenB}`)

    expect(resB.status).toBe(200)
    expect(resB.body.items.length).toBe(1)
    const walletBId = resB.body.items[0].id
    expect(resB.body.items[0].business_id).toBe(BUSINESS_B)

    expect(walletAId).not.toBe(walletBId)

    // Tenant A attempts to access Tenant B wallet directly -> 404
    const resCross = await request(app)
      .get(`/v1/wallets/${walletBId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)

    expect(resCross.status).toBe(404)
  })

  it('Scenario E: initial wallet balance is exactly zero', async () => {
    const walletService = createWalletService(pool)
    const wallet = await walletService.ensureTenantWallet(BUSINESS_A)

    expect(Number(wallet.balance)).toBe(0)

    const res = await request(app)
      .get(`/v1/wallets/${wallet.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)

    expect(res.status).toBe(200)
    expect(Number(res.body.balance)).toBe(0)
  })

  it('Scenario F: initialization produces NO CREDIT ledger entries', async () => {
    const walletService = createWalletService(pool)
    const wallet = await walletService.ensureTenantWallet(BUSINESS_A)

    const ledgers = await pool.query('SELECT * FROM wallet_ledgers WHERE wallet_id = $1', [wallet.id])
    expect(ledgers.rows.length).toBe(0)
  })

  it('Scenario G: initialization produces NO financial transactions or GL mutations', async () => {
    const walletService = createWalletService(pool)
    const wallet = await walletService.ensureTenantWallet(BUSINESS_A)

    // Verify no top_up_intents
    const intents = await pool.query('SELECT * FROM top_up_intents WHERE wallet_id = $1', [wallet.id])
    expect(intents.rows.length).toBe(0)

    // Verify no journal entries/ledgers
    const ledgers = await pool.query('SELECT * FROM wallet_ledgers WHERE wallet_id = $1', [wallet.id])
    expect(ledgers.rows.length).toBe(0)
  })

  it('Scenario H: inactive/unapproved tenant cannot have a wallet created', async () => {
    const walletService = createWalletService(pool)
    await expect(walletService.ensureTenantWallet(BUSINESS_INACTIVE)).rejects.toThrow(
      /Business not found or not active/i
    )

    const dbRows = await pool.query('SELECT * FROM wallet_accounts WHERE business_id = $1', [BUSINESS_INACTIVE])
    expect(dbRows.rows.length).toBe(0)
  })

  it('Scenario I: concurrent initialization creates exactly one wallet account', async () => {
    const walletService = createWalletService(pool)
    
    // Simulate 5 simultaneous requests attempting to ensure wallet
    const results = await Promise.all([
      walletService.ensureTenantWallet(BUSINESS_A),
      walletService.ensureTenantWallet(BUSINESS_A),
      walletService.ensureTenantWallet(BUSINESS_A),
      walletService.ensureTenantWallet(BUSINESS_A),
      walletService.ensureTenantWallet(BUSINESS_A),
    ])

    const ids = new Set(results.map(r => r.id))
    expect(ids.size).toBe(1)

    const dbRows = await pool.query('SELECT * FROM wallet_accounts WHERE business_id = $1', [BUSINESS_A])
    expect(dbRows.rows.length).toBe(1)
  })

  it('Scenario J: existing tenant accessing GET /v1/wallets gets auto-initialized wallet (lazy hook)', async () => {
    // Before call: 0 wallet accounts
    const initialRows = await pool.query('SELECT * FROM wallet_accounts WHERE business_id = $1', [BUSINESS_A])
    expect(initialRows.rows.length).toBe(0)

    // When Tenant A navigates to /wallet -> triggers GET /v1/wallets
    const res = await request(app)
      .get('/v1/wallets')
      .set('Authorization', `Bearer ${ownerTokenA}`)

    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].business_id).toBe(BUSINESS_A)
    expect(res.body.items[0].currency).toBe('IDR')
    expect(res.body.items[0].status).toBe('ACTIVE')
    expect(Number(res.body.items[0].balance)).toBe(0)

    // After call: exactly 1 wallet in DB
    const afterRows = await pool.query('SELECT * FROM wallet_accounts WHERE business_id = $1', [BUSINESS_A])
    expect(afterRows.rows.length).toBe(1)
    expect(afterRows.rows[0].id).toBe(res.body.items[0].id)
  })

  it('Scenario K: Platform business approval automatically initializes wallet account', async () => {
    const platformService = createPlatformService(pool)

    // Create a new pending business
    const newBizId = randomUUID()
    await pool.query(
      `INSERT INTO businesses (id, name, status) VALUES ($1, 'Pending Biz Corp', 'PENDING_REVIEW')`,
      [newBizId]
    )

    // Approve the business
    const adminUser = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
    await platformService.approveBusiness(newBizId, adminUser.userId)

    // Verify wallet exists for the newly approved business
    const walletRows = await pool.query('SELECT * FROM wallet_accounts WHERE business_id = $1', [newBizId])
    expect(walletRows.rows.length).toBe(1)
    expect(walletRows.rows[0].currency).toBe('IDR')
    expect(walletRows.rows[0].status).toBe('ACTIVE')
    expect(Number(walletRows.rows[0].balance)).toBe(0)

    // Cleanup
    await pool.query('DELETE FROM wallet_accounts WHERE business_id = $1', [newBizId])
    await pool.query('DELETE FROM user_businesses WHERE business_id = $1', [newBizId])
    await pool.query('DELETE FROM businesses WHERE id = $1', [newBizId])
  })
})
