import path from 'path'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createJwtService, JwtService } from '../src/services/jwt_service'
import { seedTestUser } from './auth_helper'

const BUSINESS_A = '11111111-aaaa-4111-8aaa-111111111111'
const BUSINESS_B = '22222222-bbbb-4222-8bbb-222222222222'

let pool: Pool
let app: ReturnType<typeof createApp>
let jwtService: JwtService

let superAdminToken: string
let ownerTokenA: string
let staffTokenA: string
let cashierTokenA: string
let ownerTokenB: string
let customerToken: string

let customerUserId: string
let accountCustomerA: string
let accountCustomerB: string
let accountCustomerC: string

let walletA: string
let walletB: string

async function cleanWalletData(): Promise<void> {
  await pool.query(`
    UPDATE businesses SET account_customer_id = NULL WHERE id IN ('${BUSINESS_A}', '${BUSINESS_B}');
    UPDATE subscriptions SET account_customer_id = NULL WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}');
    DELETE FROM wallet_ledgers WHERE wallet_id IN (
      SELECT id FROM wallet_accounts WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}')
      OR account_customer_id IN (SELECT id FROM account_customers WHERE code LIKE 'ACC-A-%' OR code LIKE 'ACC-B-%' OR code LIKE 'ACC-C-%')
    );
    DELETE FROM top_up_intents WHERE wallet_id IN (
      SELECT id FROM wallet_accounts WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}')
      OR account_customer_id IN (SELECT id FROM account_customers WHERE code LIKE 'ACC-A-%' OR code LIKE 'ACC-B-%' OR code LIKE 'ACC-C-%')
    );
    DELETE FROM wallet_accounts WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}')
      OR account_customer_id IN (SELECT id FROM account_customers WHERE code LIKE 'ACC-A-%' OR code LIKE 'ACC-B-%' OR code LIKE 'ACC-C-%');
    DELETE FROM account_customer_users WHERE account_customer_id IN (
      SELECT id FROM account_customers WHERE code LIKE 'ACC-A-%' OR code LIKE 'ACC-B-%' OR code LIKE 'ACC-C-%'
    );
    DELETE FROM account_customers WHERE code LIKE 'ACC-A-%' OR code LIKE 'ACC-B-%' OR code LIKE 'ACC-C-%';
    DELETE FROM devices WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}');
    DELETE FROM branches WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}');
    DELETE FROM user_businesses WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}');
    DELETE FROM subscriptions WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}');
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
  await cleanWalletData()
  await pool.end()
})

beforeEach(async () => {
  await cleanWalletData()

  // 1. Seed account customers
  accountCustomerA = randomUUID()
  const codeA = `ACC-A-${randomUUID().substring(0, 8)}`
  await pool.query(
    `INSERT INTO account_customers (id, code, name, account_type, status)
     VALUES ($1, $2, 'Tenant A Customer', 'BUSINESS', 'ACTIVE')`,
    [accountCustomerA, codeA]
  )

  accountCustomerB = randomUUID()
  const codeB = `ACC-B-${randomUUID().substring(0, 8)}`
  await pool.query(
    `INSERT INTO account_customers (id, code, name, account_type, status)
     VALUES ($1, $2, 'Tenant B Customer', 'BUSINESS', 'ACTIVE')`,
    [accountCustomerB, codeB]
  )

  accountCustomerC = randomUUID()
  const codeC = `ACC-C-${randomUUID().substring(0, 8)}`
  await pool.query(
    `INSERT INTO account_customers (id, code, name, account_type, status)
     VALUES ($1, $2, 'End Customer Individual', 'INDIVIDUAL', 'ACTIVE')`,
    [accountCustomerC, codeC]
  )

  // 2. Seed businesses linked to account customers
  await pool.query(
    `INSERT INTO businesses (id, name, status, account_customer_id)
     VALUES ($1, 'Tenant A Corp', 'ACTIVE', $3), ($2, 'Tenant B Corp', 'ACTIVE', $4)
     ON CONFLICT (id) DO UPDATE SET account_customer_id = EXCLUDED.account_customer_id, status = 'ACTIVE'`,
    [BUSINESS_A, BUSINESS_B, accountCustomerA, accountCustomerB]
  )

  // 3. Seed tenant users & tokens
  const ownerUserA = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  ownerTokenA = jwtService.signAccessToken({
    sub: ownerUserA.userId,
    business_id: BUSINESS_A,
    role: 'OWNER',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  const staffUserA = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  staffTokenA = jwtService.signAccessToken({
    sub: staffUserA.userId,
    business_id: BUSINESS_A,
    role: 'STAFF',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  const cashierUserA = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  cashierTokenA = jwtService.signAccessToken({
    sub: cashierUserA.userId,
    business_id: BUSINESS_A,
    role: 'CASHIER',
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

  // 4. Seed SUPER_ADMIN token (Platform scope)
  const superAdminUser = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  superAdminToken = jwtService.signAccessToken({
    sub: superAdminUser.userId,
    scope: 'platform',
    role: 'SUPER_ADMIN',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  // 5. Seed customer user & token
  const custUser = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  customerUserId = custUser.userId
  await pool.query(
    `INSERT INTO account_customer_users (account_customer_id, user_id, role, status)
     VALUES ($1, $2, 'PRIMARY_CONTACT', 'ACTIVE')`,
    [accountCustomerC, customerUserId]
  )

  customerToken = jwtService.signAccessToken({
    sub: customerUserId,
    business_id: BUSINESS_A,
    role: 'CUSTOMER',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  // 6. Create initial wallets via SUPER_ADMIN route
  const resA = await request(app)
    .post('/v1/wallets')
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send({
      account_customer_id: accountCustomerA,
      business_id: BUSINESS_A,
      currency: 'IDR'
    })
  expect(resA.status).toBe(201)
  walletA = resA.body.id

  const resB = await request(app)
    .post('/v1/wallets')
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send({
      account_customer_id: accountCustomerB,
      business_id: BUSINESS_B,
      currency: 'IDR'
    })
  expect(resB.status).toBe(201)
  walletB = resB.body.id
})

describe('DW-1D: Digital Wallet API Endpoints & RBAC Matrix', () => {
  // ---------------------------------------------------------------------------
  // 1. POST /v1/wallets — Creation & Platform Authorization
  // ---------------------------------------------------------------------------
  it('DW-1D-001: SUPER_ADMIN can create a wallet account', async () => {
    const res = await request(app)
      .post('/v1/wallets')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        account_customer_id: accountCustomerC,
        currency: 'IDR'
      })

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.account_customer_id).toBe(accountCustomerC)
    expect(res.body.currency).toBe('IDR')
    expect(res.body.status).toBe('ACTIVE')
    expect(res.body.balance).toBe(0)
  })

  it('DW-1D-002: OWNER, STAFF, CASHIER, and CUSTOMER are denied from creating wallets', async () => {
    const payload = { account_customer_id: accountCustomerA, currency: 'IDR' }

    const resOwner = await request(app).post('/v1/wallets').set('Authorization', `Bearer ${ownerTokenA}`).send(payload)
    expect(resOwner.status).toBe(403)

    const resStaff = await request(app).post('/v1/wallets').set('Authorization', `Bearer ${staffTokenA}`).send(payload)
    expect(resStaff.status).toBe(403)

    const resCashier = await request(app).post('/v1/wallets').set('Authorization', `Bearer ${cashierTokenA}`).send(payload)
    expect(resCashier.status).toBe(403)

    const resCustomer = await request(app).post('/v1/wallets').set('Authorization', `Bearer ${customerToken}`).send(payload)
    expect(resCustomer.status).toBe(403)
  })

  it('DW-1D-003: Duplicate customer + currency wallet creation returns 409 Conflict', async () => {
    const res = await request(app)
      .post('/v1/wallets')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        account_customer_id: accountCustomerA,
        currency: 'IDR'
      })

    expect(res.status).toBe(409)
    expect(res.body.error?.code || res.body.code).toBe('WALLET_ALREADY_EXISTS')
  })

  // ---------------------------------------------------------------------------
  // 2. GET /v1/wallets — List Wallets & Scope Isolation
  // ---------------------------------------------------------------------------
  it('DW-1D-004: SUPER_ADMIN sees all wallets across the platform', async () => {
    const res = await request(app)
      .get('/v1/wallets')
      .set('Authorization', `Bearer ${superAdminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.items.length).toBeGreaterThanOrEqual(2)
    const walletIds = res.body.items.map((w: any) => w.id)
    expect(walletIds).toContain(walletA)
    expect(walletIds).toContain(walletB)
  })

  it('DW-1D-005: OWNER sees only their tenant wallets', async () => {
    const resA = await request(app)
      .get('/v1/wallets')
      .set('Authorization', `Bearer ${ownerTokenA}`)

    expect(resA.status).toBe(200)
    expect(resA.body.items.length).toBe(1)
    expect(resA.body.items[0].id).toBe(walletA)

    const resB = await request(app)
      .get('/v1/wallets')
      .set('Authorization', `Bearer ${ownerTokenB}`)

    expect(resB.status).toBe(200)
    expect(resB.body.items.length).toBe(1)
    expect(resB.body.items[0].id).toBe(walletB)
  })

  it('DW-1D-006: STAFF and CASHIER cannot list wallets', async () => {
    const resStaff = await request(app).get('/v1/wallets').set('Authorization', `Bearer ${staffTokenA}`)
    expect(resStaff.status).toBe(403)

    const resCashier = await request(app).get('/v1/wallets').set('Authorization', `Bearer ${cashierTokenA}`)
    expect(resCashier.status).toBe(403)
  })

  // ---------------------------------------------------------------------------
  // 3. GET /v1/wallets/:id — Single Wallet Lookup & Cross-Tenant Boundary
  // ---------------------------------------------------------------------------
  it('DW-1D-007: OWNER A cannot view Tenant B wallet (returns 404 to avoid leaking existence)', async () => {
    const res = await request(app)
      .get(`/v1/wallets/${walletB}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)

    expect(res.status).toBe(404)
    expect(res.body.error?.code || res.body.code).toBe('WALLET_NOT_FOUND')
  })

  it('DW-1D-008: OWNER A can view own Tenant A wallet', async () => {
    const res = await request(app)
      .get(`/v1/wallets/${walletA}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(walletA)
    expect(res.body.business_id).toBe(BUSINESS_A)
  })

  // ---------------------------------------------------------------------------
  // 4. POST /v1/wallets/:id/topup-intents — Top-Up Intent Creation
  // ---------------------------------------------------------------------------
  it('DW-1D-009: OWNER creates top-up intent for own wallet without altering balance', async () => {
    const res = await request(app)
      .post(`/v1/wallets/${walletA}/topup-intents`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        amount: 5000000,
        fee_amount: 5000
      })

    expect(res.status).toBe(201)
    expect(res.body.intent_number).toMatch(/^TOP-\d{8}-\d{4}$/)
    expect(res.body.amount).toBe(5000000)
    expect(res.body.fee_amount).toBe(5000)
    expect(res.body.total_payable).toBe(5005000)
    expect(res.body.status).toBe('PENDING')

    // Verify wallet balance is unchanged
    const walletRes = await request(app).get(`/v1/wallets/${walletA}`).set('Authorization', `Bearer ${ownerTokenA}`)
    expect(walletRes.body.balance).toBe(0)
  })

  it('DW-1D-010: OWNER A cannot create top-up intent on Tenant B wallet (404)', async () => {
    const res = await request(app)
      .post(`/v1/wallets/${walletB}/topup-intents`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ amount: 1000000 })

    expect(res.status).toBe(404)
  })

  it('DW-1D-011: Top-up intent rejects invalid amounts (non-integer, <= 0)', async () => {
    const resNegative = await request(app)
      .post(`/v1/wallets/${walletA}/topup-intents`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ amount: -100 })
    expect(resNegative.status).toBe(400)

    const resDecimal = await request(app)
      .post(`/v1/wallets/${walletA}/topup-intents`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ amount: 100.5 })
    expect(resDecimal.status).toBe(400)
  })

  // ---------------------------------------------------------------------------
  // 5. POST /v1/wallets/:id/credit — Direct Credit (SUPER_ADMIN only)
  // ---------------------------------------------------------------------------
  it('DW-1D-012: SUPER_ADMIN can direct-credit wallet; OWNER cannot', async () => {
    // OWNER attempt denied
    const ownerRes = await request(app)
      .post(`/v1/wallets/${walletA}/credit`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        amount: 10000000,
        reason: 'Unauthorized credit',
        idempotency_key: 'owner-credit-fail-1'
      })
    expect(ownerRes.status).toBe(403)

    // SUPER_ADMIN credit succeeds
    const adminRes = await request(app)
      .post(`/v1/wallets/${walletA}/credit`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        amount: 10000000,
        reason: 'Initial platform seed',
        idempotency_key: 'admin-credit-succ-1'
      })

    expect(adminRes.status).toBe(200)
    expect(adminRes.body.account.balance).toBe(10000000)
    expect(adminRes.body.ledger.transaction_type).toBe('CREDIT')
  })

  // ---------------------------------------------------------------------------
  // 6. POST /v1/wallets/:id/debit — Debit Operations & Isolation
  // ---------------------------------------------------------------------------
  it('DW-1D-013: OWNER debits own wallet; Tenant A cannot debit Tenant B wallet', async () => {
    // 1. Seed balance on walletA
    await request(app)
      .post(`/v1/wallets/${walletA}/credit`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        amount: 2000000,
        reason: 'Fund wallet A',
        idempotency_key: 'fund-a-1'
      })

    // 2. OWNER A debits walletA
    const debitRes = await request(app)
      .post(`/v1/wallets/${walletA}/debit`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        amount: 500000,
        reason: 'Payment for services',
        idempotency_key: 'debit-a-1'
      })

    expect(debitRes.status).toBe(200)
    expect(debitRes.body.account.balance).toBe(1500000)
    expect(debitRes.body.ledger.transaction_type).toBe('DEBIT')

    // 3. OWNER A attempts to debit walletB (rejected 404)
    const crossDebit = await request(app)
      .post(`/v1/wallets/${walletB}/debit`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        amount: 100000,
        reason: 'Malicious debit attempt',
        idempotency_key: 'cross-debit-1'
      })
    expect(crossDebit.status).toBe(404)
  })

  it('DW-1D-014: Debit idempotency replay returns original mutation without double debit', async () => {
    await request(app)
      .post(`/v1/wallets/${walletA}/credit`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        amount: 1000000,
        reason: 'Fund wallet',
        idempotency_key: 'fund-idemp-1'
      })

    const debit1 = await request(app)
      .post(`/v1/wallets/${walletA}/debit`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        amount: 300000,
        reason: 'Payment',
        idempotency_key: 'idemp-debit-key-1'
      })
    expect(debit1.status).toBe(200)
    expect(debit1.body.account.balance).toBe(700000)
    expect(debit1.body.already_processed).toBe(false)

    // Replay with identical idempotency key
    const debit2 = await request(app)
      .post(`/v1/wallets/${walletA}/debit`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        amount: 300000,
        reason: 'Payment',
        idempotency_key: 'idemp-debit-key-1'
      })
    expect(debit2.status).toBe(200)
    expect(debit2.body.account.balance).toBe(700000)
    expect(debit2.body.already_processed).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // 7. GET /v1/wallets/:id/ledger — Read-only Ledger Query
  // ---------------------------------------------------------------------------
  it('DW-1D-015: Ledger query enforces tenant boundaries and pagination', async () => {
    // Populate ledger entries
    await request(app)
      .post(`/v1/wallets/${walletA}/credit`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ amount: 1000000, reason: 'Credit 1', idempotency_key: 'ledg-c-1' })

    await request(app)
      .post(`/v1/wallets/${walletA}/debit`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ amount: 200000, reason: 'Debit 1', idempotency_key: 'ledg-d-1' })

    // OWNER A queries walletA ledger
    const ledgerA = await request(app)
      .get(`/v1/wallets/${walletA}/ledger`)
      .set('Authorization', `Bearer ${ownerTokenA}`)

    expect(ledgerA.status).toBe(200)
    expect(ledgerA.body.items.length).toBe(2)
    expect(ledgerA.body.items[0].transaction_type).toBe('DEBIT') // newest first
    expect(ledgerA.body.items[1].transaction_type).toBe('CREDIT')

    // OWNER A cannot query walletB ledger
    const ledgerB = await request(app)
      .get(`/v1/wallets/${walletB}/ledger`)
      .set('Authorization', `Bearer ${ownerTokenA}`)

    expect(ledgerB.status).toBe(404)
  })

  // ---------------------------------------------------------------------------
  // 8. Freeze / Unfreeze / Reverse Lifecycle
  // ---------------------------------------------------------------------------
  it('DW-1D-016: SUPER_ADMIN freezes and unfreezes wallet; mutations blocked while frozen', async () => {
    // Fund wallet
    await request(app)
      .post(`/v1/wallets/${walletA}/credit`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ amount: 1000000, reason: 'Pre-freeze fund', idempotency_key: 'freeze-fund-1' })

    // OWNER cannot freeze
    const ownerFreeze = await request(app)
      .post(`/v1/wallets/${walletA}/freeze`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ reason: 'Malicious freeze' })
    expect(ownerFreeze.status).toBe(403)

    // SUPER_ADMIN freezes
    const freezeRes = await request(app)
      .post(`/v1/wallets/${walletA}/freeze`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason: 'Compliance investigation' })
    expect(freezeRes.status).toBe(200)
    expect(freezeRes.body.status).toBe('FROZEN')

    // Debiting frozen wallet fails
    const debitFrozen = await request(app)
      .post(`/v1/wallets/${walletA}/debit`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ amount: 100000, reason: 'Should fail', idempotency_key: 'frozen-debit-1' })
    expect(debitFrozen.status).toBe(400)
    expect(debitFrozen.body.error?.code || debitFrozen.body.code).toBe('WALLET_FROZEN')

    // SUPER_ADMIN unfreezes
    const unfreezeRes = await request(app)
      .post(`/v1/wallets/${walletA}/unfreeze`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason: 'Investigation completed' })
    expect(unfreezeRes.status).toBe(200)
    expect(unfreezeRes.body.status).toBe('ACTIVE')

    // Debit now succeeds
    const debitUnfrozen = await request(app)
      .post(`/v1/wallets/${walletA}/debit`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ amount: 100000, reason: 'Should succeed', idempotency_key: 'unfrozen-debit-1' })
    expect(debitUnfrozen.status).toBe(200)
  })

  it('DW-1D-017: SUPER_ADMIN can reverse a debit transaction creating a compensating ledger entry', async () => {
    // 1. Credit 500k
    await request(app)
      .post(`/v1/wallets/${walletA}/credit`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ amount: 500000, reason: 'Fund', idempotency_key: 'rev-fund-1' })

    // 2. Debit 200k
    const debitRes = await request(app)
      .post(`/v1/wallets/${walletA}/debit`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ amount: 200000, reason: 'Wrong charge', idempotency_key: 'rev-debit-1' })
    expect(debitRes.body.account.balance).toBe(300000)
    const ledgerEntryId = debitRes.body.ledger.id

    // 3. OWNER cannot reverse
    const ownerRev = await request(app)
      .post(`/v1/wallets/${walletA}/reverse`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ ledger_entry_id: ledgerEntryId, reason: 'Undo', idempotency_key: 'rev-owner-1' })
    expect(ownerRev.status).toBe(403)

    // 4. SUPER_ADMIN reverses
    const adminRev = await request(app)
      .post(`/v1/wallets/${walletA}/reverse`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ ledger_entry_id: ledgerEntryId, reason: 'Customer refund reversal', idempotency_key: 'rev-admin-1' })

    expect(adminRev.status).toBe(200)
    expect(adminRev.body.account.balance).toBe(500000)
    expect(adminRev.body.ledger.transaction_type).toBe('REVERSAL')
    expect(adminRev.body.ledger.entry_type).toBe('CREDIT')
  })

  // ---------------------------------------------------------------------------
  // 9. Unauthenticated & Malformed Request Rejections
  // ---------------------------------------------------------------------------
  it('DW-1D-018: Unauthenticated requests are rejected with 401 UNAUTHORIZED', async () => {
    const resNoAuth = await request(app).get('/v1/wallets')
    expect(resNoAuth.status).toBe(401)

    const resBadToken = await request(app).get('/v1/wallets').set('Authorization', 'Bearer invalid-token')
    expect(resBadToken.status).toBe(401)
  })
})
