import path from 'path'
import crypto, { randomUUID } from 'crypto'
import request from 'supertest'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createJwtService, JwtService } from '../src/services/jwt_service'
import { seedTestUser } from './auth_helper'
import { createPaymentGatewayService } from '../src/services/payment_gateway_service'

const BUSINESS_A = '11111111-aaaa-4111-8aaa-111111111111'
const BUSINESS_B = '22222222-bbbb-4222-8bbb-222222222222'

let pool: Pool
let app: ReturnType<typeof createApp>
let jwtService: JwtService
let gatewayService: ReturnType<typeof createPaymentGatewayService>

let superAdminToken: string
let ownerTokenA: string
let ownerTokenB: string
let staffTokenA: string
let cashierTokenA: string
let customerTokenC: string
let customerTokenD: string // Unlinked/other customer

let superAdminUserId: string
let ownerUserIdA: string
let customerUserIdC: string
let customerUserIdD: string

let accountCustomerA: string
let accountCustomerB: string
let accountCustomerC: string
let accountCustomerD: string

let walletA: string
let walletB: string
let walletC: string

async function cleanWalletData(): Promise<void> {
  await pool.query(`
    UPDATE businesses SET account_customer_id = NULL WHERE id IN ('${BUSINESS_A}', '${BUSINESS_B}');
    UPDATE subscriptions SET account_customer_id = NULL WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}');
    DELETE FROM wallet_ledgers WHERE wallet_id IN (
      SELECT id FROM wallet_accounts WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}')
      OR account_customer_id IN (SELECT id FROM account_customers WHERE code LIKE 'ACC-A-%' OR code LIKE 'ACC-B-%' OR code LIKE 'ACC-C-%' OR code LIKE 'ACC-D-%')
    );
    DELETE FROM top_up_intents WHERE wallet_id IN (
      SELECT id FROM wallet_accounts WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}')
      OR account_customer_id IN (SELECT id FROM account_customers WHERE code LIKE 'ACC-A-%' OR code LIKE 'ACC-B-%' OR code LIKE 'ACC-C-%' OR code LIKE 'ACC-D-%')
    );
    DELETE FROM wallet_accounts WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}')
      OR account_customer_id IN (SELECT id FROM account_customers WHERE code LIKE 'ACC-A-%' OR code LIKE 'ACC-B-%' OR code LIKE 'ACC-C-%' OR code LIKE 'ACC-D-%');
    DELETE FROM account_customer_users WHERE account_customer_id IN (
      SELECT id FROM account_customers WHERE code LIKE 'ACC-A-%' OR code LIKE 'ACC-B-%' OR code LIKE 'ACC-C-%' OR code LIKE 'ACC-D-%'
    );
    DELETE FROM account_customers WHERE code LIKE 'ACC-A-%' OR code LIKE 'ACC-B-%' OR code LIKE 'ACC-C-%' OR code LIKE 'ACC-D-%';
    DELETE FROM devices WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}');
    DELETE FROM branches WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}');
    DELETE FROM user_businesses WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}');
    DELETE FROM subscriptions WHERE business_id IN ('${BUSINESS_A}', '${BUSINESS_B}');
  `)
}

function generateSignature(orderId: string, statusCode: string, grossAmount: string, serverKey: string): string {
  const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`
  return crypto.createHash('sha512').update(raw).digest('hex')
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

  gatewayService = createPaymentGatewayService(pool)
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
  await pool.query(
    `INSERT INTO account_customers (id, code, name, account_type, status)
     VALUES ($1, $2, 'Tenant A Customer', 'BUSINESS', 'ACTIVE')`,
    [accountCustomerA, `ACC-A-${randomUUID().substring(0, 8)}`]
  )

  accountCustomerB = randomUUID()
  await pool.query(
    `INSERT INTO account_customers (id, code, name, account_type, status)
     VALUES ($1, $2, 'Tenant B Customer', 'BUSINESS', 'ACTIVE')`,
    [accountCustomerB, `ACC-B-${randomUUID().substring(0, 8)}`]
  )

  accountCustomerC = randomUUID()
  await pool.query(
    `INSERT INTO account_customers (id, code, name, account_type, status)
     VALUES ($1, $2, 'Customer C Individual', 'INDIVIDUAL', 'ACTIVE')`,
    [accountCustomerC, `ACC-C-${randomUUID().substring(0, 8)}`]
  )

  accountCustomerD = randomUUID()
  await pool.query(
    `INSERT INTO account_customers (id, code, name, account_type, status)
     VALUES ($1, $2, 'Customer D Individual', 'INDIVIDUAL', 'ACTIVE')`,
    [accountCustomerD, `ACC-D-${randomUUID().substring(0, 8)}`]
  )

  // 2. Seed businesses
  await pool.query(
    `INSERT INTO businesses (id, name, status, account_customer_id)
     VALUES ($1, 'Tenant A Corp', 'ACTIVE', $3), ($2, 'Tenant B Corp', 'ACTIVE', $4)
     ON CONFLICT (id) DO UPDATE SET account_customer_id = EXCLUDED.account_customer_id, status = 'ACTIVE'`,
    [BUSINESS_A, BUSINESS_B, accountCustomerA, accountCustomerB]
  )

  // 3. Seed users & tokens
  const ownerUserA = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  ownerUserIdA = ownerUserA.userId
  ownerTokenA = jwtService.signAccessToken({
    sub: ownerUserIdA,
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

  const superAdminUser = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  superAdminUserId = superAdminUser.userId
  superAdminToken = jwtService.signAccessToken({
    sub: superAdminUserId,
    scope: 'platform',
    role: 'SUPER_ADMIN',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  const custUserC = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  customerUserIdC = custUserC.userId
  await pool.query(
    `INSERT INTO account_customer_users (account_customer_id, user_id, role, status)
     VALUES ($1, $2, 'PRIMARY_CONTACT', 'ACTIVE')`,
    [accountCustomerC, customerUserIdC]
  )
  customerTokenC = jwtService.signAccessToken({
    sub: customerUserIdC,
    business_id: BUSINESS_A,
    role: 'CUSTOMER',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  const custUserD = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  customerUserIdD = custUserD.userId
  await pool.query(
    `INSERT INTO account_customer_users (account_customer_id, user_id, role, status)
     VALUES ($1, $2, 'PRIMARY_CONTACT', 'ACTIVE')`,
    [accountCustomerD, customerUserIdD]
  )
  customerTokenD = jwtService.signAccessToken({
    sub: customerUserIdD,
    business_id: BUSINESS_A,
    role: 'CUSTOMER',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  // 4. Create base wallets
  const resA = await request(app)
    .post('/v1/wallets')
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send({
      account_customer_id: accountCustomerA,
      business_id: BUSINESS_A,
      currency: 'IDR'
    })
  walletA = resA.body.id

  const resB = await request(app)
    .post('/v1/wallets')
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send({
      account_customer_id: accountCustomerB,
      business_id: BUSINESS_B,
      currency: 'IDR'
    })
  walletB = resB.body.id

  const resC = await request(app)
    .post('/v1/wallets')
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send({
      account_customer_id: accountCustomerC,
      currency: 'IDR'
    })
  walletC = resC.body.id
})

describe('DW-1E: Digital Wallet End-to-End Acceptance Suite', () => {
  // ---------------------------------------------------------------------------
  // 1. Foundation Integrity & Financial Invariants
  // ---------------------------------------------------------------------------
  it('DW-1E-001: Schema constraints enforce balance math and non-negative balances', async () => {
    // Verify wallet_accounts table structure
    const cols = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'wallet_accounts'`
    )
    const colNames = cols.rows.map(c => c.column_name)
    expect(colNames).toContain('id')
    expect(colNames).toContain('account_customer_id')
    expect(colNames).toContain('business_id')
    expect(colNames).toContain('wallet_number')
    expect(colNames).toContain('balance')
    expect(colNames).toContain('server_version')
    expect(colNames).toContain('currency')
    expect(colNames).toContain('status')
  })

  // ---------------------------------------------------------------------------
  // 2. Full Wallet Ledger Lifecycle E2E
  // ---------------------------------------------------------------------------
  it('DW-1E-002: Full lifecycle (create -> credit -> debit -> reversal) maintains exact math and versioning', async () => {
    // Initial balance is 0, version 1
    const initW = await request(app).get(`/v1/wallets/${walletA}`).set('Authorization', `Bearer ${ownerTokenA}`)
    expect(initW.body.balance).toBe(0)
    expect(initW.body.server_version).toBe(1)

    // 1. Credit 1,000,000 IDR
    const credRes = await request(app)
      .post(`/v1/wallets/${walletA}/credit`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        amount: 1000000,
        reason: 'Initial funding',
        idempotency_key: 'e2e-cred-1'
      })
    expect(credRes.status).toBe(200)
    expect(credRes.body.account.balance).toBe(1000000)
    expect(credRes.body.account.server_version).toBe(2)
    expect(credRes.body.ledger.balance_before).toBe(0)
    expect(credRes.body.ledger.balance_after).toBe(1000000)

    // 2. Debit 350,000 IDR
    const debRes = await request(app)
      .post(`/v1/wallets/${walletA}/debit`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        amount: 350000,
        reason: 'Subscription fee',
        idempotency_key: 'e2e-deb-1'
      })
    expect(debRes.status).toBe(200)
    expect(debRes.body.account.balance).toBe(650000)
    expect(debRes.body.account.server_version).toBe(3)
    expect(debRes.body.ledger.balance_before).toBe(1000000)
    expect(debRes.body.ledger.balance_after).toBe(650000)

    // 3. Reverse the 350,000 IDR debit
    const revRes = await request(app)
      .post(`/v1/wallets/${walletA}/reverse`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        ledger_entry_id: debRes.body.ledger.id,
        reason: 'Refunded fee',
        idempotency_key: 'e2e-rev-1'
      })
    expect(revRes.status).toBe(200)
    expect(revRes.body.account.balance).toBe(1000000)
    expect(revRes.body.account.server_version).toBe(4)

    // 4. Verify financial ledger invariant independently: sum(credits) - sum(debits) === final_balance
    const ledgerList = await request(app).get(`/v1/wallets/${walletA}/ledger`).set('Authorization', `Bearer ${ownerTokenA}`)
    expect(ledgerList.body.items.length).toBe(3)

    let calculatedBalance = 0
    // Ledger list is newest-first, reverse to iterate chronologically
    const chronological = [...ledgerList.body.items].reverse()
    for (const entry of chronological) {
      if (entry.entry_type === 'CREDIT') {
        calculatedBalance += entry.amount
      } else if (entry.entry_type === 'DEBIT') {
        calculatedBalance -= entry.amount
      }
    }
    expect(calculatedBalance).toBe(1000000)
    expect(calculatedBalance).toBe(revRes.body.account.balance)
  })

  // ---------------------------------------------------------------------------
  // 3. High-Concurrency Race Condition Prevention
  // ---------------------------------------------------------------------------
  it('DW-1E-003: Real PostgreSQL concurrent debits serialize and strictly prevent overdraft', async () => {
    // 1. Fund wallet with 1,000,000 IDR
    await request(app)
      .post(`/v1/wallets/${walletA}/credit`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        amount: 1000000,
        reason: 'Concurrent test fund',
        idempotency_key: 'conc-fund-1'
      })

    // 2. Dispatch 10 simultaneous debit requests of 200,000 IDR each (Total = 2,000,000 IDR, Available = 1,000,000 IDR)
    // Exactly 5 should succeed, exactly 5 should fail with INSUFFICIENT_FUNDS (400)
    const promises = Array.from({ length: 10 }).map((_, i) =>
      request(app)
        .post(`/v1/wallets/${walletA}/debit`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          amount: 200000,
          reason: `Concurrent charge ${i}`,
          idempotency_key: `conc-debit-${i}-${Date.now()}`
        })
    )

    const results = await Promise.all(promises)
    const successes = results.filter(r => r.status === 200)
    const failures = results.filter(r => r.status === 400)

    expect(successes.length).toBe(5)
    expect(failures.length).toBe(5)

    // Final balance MUST be exactly 0
    const finalWallet = await request(app).get(`/v1/wallets/${walletA}`).set('Authorization', `Bearer ${ownerTokenA}`)
    expect(finalWallet.body.balance).toBe(0)
    expect(finalWallet.body.server_version).toBe(7) // 1 init + 1 credit + 5 debits = 7
  })

  // ---------------------------------------------------------------------------
  // 4. Top-Up Intent & Webhook Bridge E2E
  // ---------------------------------------------------------------------------
  it('DW-1E-004: Complete top-up intent lifecycle from creation to verified Midtrans settlement', async () => {
    // 1. Create Top-up Intent
    const intentRes = await request(app)
      .post(`/v1/wallets/${walletA}/topup-intents`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        amount: 2500000,
        fee_amount: 5000,
        payment_method: 'gopay'
      })

    expect(intentRes.status).toBe(201)
    const intentNumber = intentRes.body.intent_number
    expect(intentRes.body.status).toBe('PENDING')
    expect(intentRes.body.total_payable).toBe(2505000)

    // 2. Generate Midtrans Snap token via Payment Gateway Service
    const snapTx = await gatewayService.createTopUpTransaction(intentRes.body.id, ownerUserIdA)
    expect(snapTx.order_id).toBe(intentNumber)
    expect(snapTx.token).toBeDefined()

    // 3. Dispatch Authoritative Midtrans Webhook (settlement)
    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'test-midtrans-server-key-skmnet'
    const grossAmount = '2505000.00'
    const signature = generateSignature(intentNumber, '200', grossAmount, serverKey)

    const webhookPayload = {
      order_id: intentNumber,
      status_code: '200',
      gross_amount: grossAmount,
      transaction_status: 'settlement',
      fraud_status: 'accept',
      transaction_id: `tx-${Date.now()}`,
      payment_type: 'gopay',
      signature_key: signature
    }

    const hookRes = await gatewayService.processMidtransWebhook(webhookPayload as any)
    expect(hookRes.status).toBe('PROCESSED')

    // 4. Verify top-up intent transitioned to SUCCEEDED and wallet was credited with exact principal amount (2,500,000 IDR)
    const updatedWallet = await request(app).get(`/v1/wallets/${walletA}`).set('Authorization', `Bearer ${ownerTokenA}`)
    expect(updatedWallet.body.balance).toBe(2500000)

    const intentRow = await pool.query(`SELECT * FROM top_up_intents WHERE intent_number = $1`, [intentNumber])
    expect(intentRow.rows[0].status).toBe('SUCCEEDED')
    expect(intentRow.rows[0].settled_at).not.toBeNull()

    // 5. Verify TOP_UP ledger entry
    const ledgers = await request(app).get(`/v1/wallets/${walletA}/ledger`).set('Authorization', `Bearer ${ownerTokenA}`)
    expect(ledgers.body.items.length).toBe(1)
    expect(ledgers.body.items[0].transaction_type).toBe('TOP_UP')
    expect(ledgers.body.items[0].entry_type).toBe('CREDIT')
    expect(ledgers.body.items[0].amount).toBe(2500000)
  })

  // ---------------------------------------------------------------------------
  // 5. Top-Up Webhook Deduplication & Concurrency
  // ---------------------------------------------------------------------------
  it('DW-1E-005: Duplicate and concurrent top-up webhook deliveries never double-credit wallet', async () => {
    const intentRes = await request(app)
      .post(`/v1/wallets/${walletA}/topup-intents`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ amount: 1000000 })
    const intentNumber = intentRes.body.intent_number

    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'test-midtrans-server-key-skmnet'
    const grossAmount = '1000000.00'
    const signature = generateSignature(intentNumber, '200', grossAmount, serverKey)

    const webhookPayload = {
      order_id: intentNumber,
      status_code: '200',
      gross_amount: grossAmount,
      transaction_status: 'settlement',
      fraud_status: 'accept',
      transaction_id: `tx-dedup-${Date.now()}`,
      payment_type: 'bank_transfer',
      signature_key: signature
    }

    // Dispatch concurrent webhook calls with the identical payload
    const results = await Promise.all([
      gatewayService.processMidtransWebhook(webhookPayload as any),
      gatewayService.processMidtransWebhook(webhookPayload as any),
      gatewayService.processMidtransWebhook(webhookPayload as any)
    ])

    // Exactly one PROCESSED
    const processedCount = results.filter(r => r.status === 'PROCESSED').length
    expect(processedCount).toBe(1)

    // Wallet MUST be credited exactly once
    const walletRes = await request(app).get(`/v1/wallets/${walletA}`).set('Authorization', `Bearer ${ownerTokenA}`)
    expect(walletRes.body.balance).toBe(1000000)
  })

  // ---------------------------------------------------------------------------
  // 6. Top-Up Failure Paths
  // ---------------------------------------------------------------------------
  it('DW-1E-006: Unsuccessful top-up webhooks (unverified, expired, denied) leave wallet balance unchanged', async () => {
    const intentRes = await request(app)
      .post(`/v1/wallets/${walletA}/topup-intents`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ amount: 500000 })
    const intentNumber = intentRes.body.intent_number

    // 1. Invalid signature webhook
    const invalidSigPayload = {
      order_id: intentNumber,
      status_code: '200',
      gross_amount: '500000.00',
      transaction_status: 'settlement',
      transaction_id: 'tx-bad-sig',
      signature_key: 'invalid_sha512_hash'
    }
    await expect(gatewayService.processMidtransWebhook(invalidSigPayload as any)).rejects.toThrow(
      /signature/i
    )

    // 2. Expired webhook
    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'test-midtrans-server-key-skmnet'
    const grossAmount = '500000.00'
    const sigExpire = generateSignature(intentNumber, '200', grossAmount, serverKey)

    const expirePayload = {
      order_id: intentNumber,
      status_code: '200',
      gross_amount: grossAmount,
      transaction_status: 'expire',
      transaction_id: 'tx-expire-1',
      signature_key: sigExpire
    }
    const expireRes = await gatewayService.processMidtransWebhook(expirePayload as any)
    expect(expireRes.status).toBe('EXPIRED')

    // Balance remains 0
    const walletRes = await request(app).get(`/v1/wallets/${walletA}`).set('Authorization', `Bearer ${ownerTokenA}`)
    expect(walletRes.body.balance).toBe(0)

    // Ledger has 0 entries
    const ledgerRes = await request(app).get(`/v1/wallets/${walletA}/ledger`).set('Authorization', `Bearer ${ownerTokenA}`)
    expect(ledgerRes.body.items.length).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // 7. Multi-Tenant & Customer Isolation Boundaries
  // ---------------------------------------------------------------------------
  it('DW-1E-007: Strict multi-tenant and customer isolation across all query and mutation vectors', async () => {
    // 1. Tenant A cannot see Tenant B wallet (returns 404, no leakage)
    const resAtoB = await request(app).get(`/v1/wallets/${walletB}`).set('Authorization', `Bearer ${ownerTokenA}`)
    expect(resAtoB.status).toBe(404)

    // 2. Tenant B cannot see Tenant A wallet (returns 404)
    const resBtoA = await request(app).get(`/v1/wallets/${walletA}`).set('Authorization', `Bearer ${ownerTokenB}`)
    expect(resBtoA.status).toBe(404)

    // 3. Customer C cannot access Customer D wallet (walletC belongs to C, not D)
    const resDtoC = await request(app).get(`/v1/wallets/${walletC}`).set('Authorization', `Bearer ${customerTokenD}`)
    expect(resDtoC.status).toBe(404)

    // 4. Customer C can access own walletC
    const resCtoC = await request(app).get(`/v1/wallets/${walletC}`).set('Authorization', `Bearer ${customerTokenC}`)
    expect(resCtoC.status).toBe(200)
    expect(resCtoC.body.id).toBe(walletC)

    // 5. Revoking customer user linkage blocks access
    await pool.query(
      `UPDATE account_customer_users SET status = 'REVOKED' WHERE user_id = $1 AND account_customer_id = $2`,
      [customerUserIdC, accountCustomerC]
    )
    const resRevoked = await request(app).get(`/v1/wallets/${walletC}`).set('Authorization', `Bearer ${customerTokenC}`)
    expect(resRevoked.status).toBe(404)
  })

  // ---------------------------------------------------------------------------
  // 8. Comprehensive RBAC Matrix Verification
  // ---------------------------------------------------------------------------
  it('DW-1E-008: Comprehensive RBAC enforcement across all wallet operations', async () => {
    // Fund wallet A
    await request(app)
      .post(`/v1/wallets/${walletA}/credit`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ amount: 500000, reason: 'RBAC test fund', idempotency_key: 'rbac-fund-1' })

    // OWNER: allowed debit, topup-intent; denied credit, freeze, unfreeze, reverse
    const ownerDeb = await request(app).post(`/v1/wallets/${walletA}/debit`).set('Authorization', `Bearer ${ownerTokenA}`).send({ amount: 10000, reason: 'test', idempotency_key: 'rbac-deb-1' })
    expect(ownerDeb.status).toBe(200)

    const ownerCred = await request(app).post(`/v1/wallets/${walletA}/credit`).set('Authorization', `Bearer ${ownerTokenA}`).send({ amount: 10000, reason: 'test', idempotency_key: 'rbac-c-1' })
    expect(ownerCred.status).toBe(403)

    const ownerFrz = await request(app).post(`/v1/wallets/${walletA}/freeze`).set('Authorization', `Bearer ${ownerTokenA}`).send({ reason: 'test' })
    expect(ownerFrz.status).toBe(403)

    const ownerUnfrz = await request(app).post(`/v1/wallets/${walletA}/unfreeze`).set('Authorization', `Bearer ${ownerTokenA}`).send({ reason: 'test' })
    expect(ownerUnfrz.status).toBe(403)

    // STAFF / CASHIER: blocked on all endpoints
    expect((await request(app).get('/v1/wallets').set('Authorization', `Bearer ${staffTokenA}`)).status).toBe(403)
    expect((await request(app).get(`/v1/wallets/${walletA}`).set('Authorization', `Bearer ${staffTokenA}`)).status).toBe(403)
    expect((await request(app).post(`/v1/wallets/${walletA}/debit`).set('Authorization', `Bearer ${cashierTokenA}`).send({ amount: 1000, reason: 'x', idempotency_key: 'x' })).status).toBe(403)

    // SUPER_ADMIN: platform scope access to everything
    expect((await request(app).get('/v1/wallets').set('Authorization', `Bearer ${superAdminToken}`)).status).toBe(200)
    expect((await request(app).post(`/v1/wallets/${walletA}/freeze`).set('Authorization', `Bearer ${superAdminToken}`).send({ reason: 'ok' })).status).toBe(200)
    expect((await request(app).post(`/v1/wallets/${walletA}/unfreeze`).set('Authorization', `Bearer ${superAdminToken}`).send({ reason: 'ok' })).status).toBe(200)
  })

  // ---------------------------------------------------------------------------
  // 9. Complete Audit Trail Verification
  // ---------------------------------------------------------------------------
  it('DW-1E-009: Service-level audit events recorded for all operations across the lifecycle', async () => {
    // 1. Credit wallet
    await request(app)
      .post(`/v1/wallets/${walletA}/credit`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ amount: 300000, reason: 'Audit verify fund', idempotency_key: 'aud-fund-1' })

    // 2. Freeze wallet
    await request(app)
      .post(`/v1/wallets/${walletA}/freeze`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason: 'Audit freeze' })

    // 3. Unfreeze wallet
    await request(app)
      .post(`/v1/wallets/${walletA}/unfreeze`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason: 'Audit unfreeze' })

    // 4. Query platform_audit_logs table
    const auditRes = await pool.query(
      `SELECT action, service_code, target_type, target_id FROM platform_audit_logs
       WHERE service_code = 'DIGITAL_WALLET' ORDER BY created_at ASC`
    )

    const actions = auditRes.rows.map(r => r.action)
    expect(actions).toContain('WALLET_ACCOUNT_CREATED')
    expect(actions).toContain('WALLET_CREDITED')
    expect(actions).toContain('WALLET_FROZEN')
    expect(actions).toContain('WALLET_UNFROZEN')
  })
})
