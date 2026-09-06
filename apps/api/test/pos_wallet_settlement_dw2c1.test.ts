import path from 'path'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'

let pool: Pool

beforeAll(async () => {
  const dbUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)

  const migrationsDir = path.resolve(__dirname, '../migrations')
  await runMigrations(pool, migrationsDir)
}, 30000)

afterAll(async () => {
  await pool.end()
}, 30000)

describe('Phase DW-2C1 — POS Wallet Settlement Schema Foundation (Migration 055)', () => {
  it('verifies Migration 055 applies cleanly and idempotently', async () => {
    // Re-run migration SQL directly to verify complete idempotency and rerun-safety
    const migrationSql = `
      DO $$
      BEGIN
          ALTER TABLE wallet_ledgers DROP CONSTRAINT IF EXISTS wallet_ledgers_transaction_type_check;
          ALTER TABLE wallet_ledgers ADD CONSTRAINT wallet_ledgers_transaction_type_check
              CHECK (transaction_type IN (
                  'TOP_UP', 'DEBIT', 'CREDIT', 'TRANSFER', 'REFUND', 'REVERSAL', 'FEE', 'ADJUSTMENT', 'INVOICE_PAYMENT', 'POS_PAYMENT'
              ));

          ALTER TABLE sales
              ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallet_accounts(id) ON DELETE SET NULL;

          CREATE INDEX IF NOT EXISTS idx_sales_wallet_id ON sales(wallet_id);
      END $$;
    `
    await expect(pool.query(migrationSql)).resolves.toBeDefined()
  })

  it('verifies sales.wallet_id column exists with nullable default for legacy records', async () => {
    const colRes = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'sales' AND column_name = 'wallet_id'
    `)
    expect(colRes.rows.length).toBe(1)
    expect(colRes.rows[0].column_name).toBe('wallet_id')
    expect(colRes.rows[0].data_type).toBe('uuid')
    expect(colRes.rows[0].is_nullable).toBe('YES')
  })

  it('verifies idx_sales_wallet_id index exists on sales(wallet_id)', async () => {
    const idxRes = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'sales' AND indexname = 'idx_sales_wallet_id'
    `)
    expect(idxRes.rows.length).toBe(1)
    expect(idxRes.rows[0].indexdef).toContain('wallet_id')
  })

  it('verifies sales.wallet_id enforces foreign key constraint to wallet_accounts(id)', async () => {
    const businessId = randomUUID()
    const nonExistentWalletId = randomUUID()
    const saleId = randomUUID()

    await pool.query(`INSERT INTO businesses (id, name) VALUES ($1, $2)`, [businessId, 'DW2C1 Test Business'])

    // Attempting to insert a sale with a non-existent wallet_id must fail FK check
    await expect(
      pool.query(
        `INSERT INTO sales (
          id, business_id, receipt_number, total_minor, wallet_id, created_at, server_created_at
        ) VALUES ($1, $2, $3, $4, $5, now(), now())`,
        [saleId, businessId, `TRX-INVALID-WAL-${Date.now()}`, 10000, nonExistentWalletId]
      )
    ).rejects.toThrow(/violates foreign key constraint/)
  })

  it('verifies sales accepts NULL wallet_id (legacy backward compatibility)', async () => {
    const businessId = randomUUID()
    const saleId = randomUUID()

    await pool.query(`INSERT INTO businesses (id, name) VALUES ($1, $2)`, [businessId, 'DW2C1 Legacy Business'])

    const res = await pool.query(
      `INSERT INTO sales (
        id, business_id, receipt_number, total_minor, wallet_id, created_at, server_created_at
      ) VALUES ($1, $2, $3, $4, NULL, now(), now())
      RETURNING id, wallet_id`,
      [saleId, businessId, `TRX-LEGACY-${Date.now()}`, 25000]
    )

    expect(res.rows[0].id).toBe(saleId)
    expect(res.rows[0].wallet_id).toBeNull()
  })

  it('verifies sales accepts valid wallet_accounts reference', async () => {
    const businessId = randomUUID()
    const accountCustomerId = randomUUID()
    const walletId = randomUUID()
    const saleId = randomUUID()

    await pool.query(`INSERT INTO businesses (id, name) VALUES ($1, $2)`, [businessId, 'DW2C1 Wallet Business'])
    await pool.query(
      `INSERT INTO account_customers (id, name, code, account_type, status) VALUES ($1, $2, $3, 'INDIVIDUAL', 'ACTIVE')`,
      [accountCustomerId, 'DW2C1 Customer', `CUST-${Date.now()}`]
    )
    await pool.query(
      `INSERT INTO wallet_accounts (id, account_customer_id, business_id, wallet_number, currency, status, balance)
       VALUES ($1, $2, $3, $4, 'IDR', 'ACTIVE', 100000)`,
      [walletId, accountCustomerId, businessId, `WAL-${Date.now()}`]
    )

    const res = await pool.query(
      `INSERT INTO sales (
        id, business_id, receipt_number, total_minor, payment_method, paid_minor, change_minor, wallet_id, created_at, server_created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
      RETURNING id, wallet_id, payment_method`,
      [saleId, businessId, `TRX-WALLET-${Date.now()}`, 50000, 'wallet', 50000, 0, walletId]
    )

    expect(res.rows[0].id).toBe(saleId)
    expect(res.rows[0].wallet_id).toBe(walletId)
    expect(res.rows[0].payment_method).toBe('wallet')
  })

  it('verifies wallet_ledgers accepts POS_PAYMENT transaction type', async () => {
    const businessId = randomUUID()
    const accountCustomerId = randomUUID()
    const walletId = randomUUID()
    const ledgerId = randomUUID()
    const idemKey = `idem-pos-${randomUUID()}`

    await pool.query(`INSERT INTO businesses (id, name) VALUES ($1, $2)`, [businessId, 'DW2C1 Ledger Business'])
    await pool.query(
      `INSERT INTO account_customers (id, name, code, account_type, status) VALUES ($1, $2, $3, 'INDIVIDUAL', 'ACTIVE')`,
      [accountCustomerId, 'DW2C1 AC Ledger', `CUST-L-${Date.now()}`]
    )
    await pool.query(
      `INSERT INTO wallet_accounts (id, account_customer_id, business_id, wallet_number, currency, status, balance)
       VALUES ($1, $2, $3, $4, 'IDR', 'ACTIVE', 50000)`,
      [walletId, accountCustomerId, businessId, `WAL-L-${Date.now()}`]
    )

    const ledgerRes = await pool.query(
      `INSERT INTO wallet_ledgers (
        id, wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
        currency, reference_type, reference_id, idempotency_key, actor_scope, description
      ) VALUES (
        $1, $2, 'POS_PAYMENT', 'DEBIT', 20000, 50000, 30000,
        'IDR', 'SALE', 'sale-uuid-123', $3, 'tenant', 'POS Checkout Test'
      )
      RETURNING id, transaction_type, entry_type, amount`,
      [ledgerId, walletId, idemKey]
    )

    expect(ledgerRes.rows[0].id).toBe(ledgerId)
    expect(ledgerRes.rows[0].transaction_type).toBe('POS_PAYMENT')
    expect(ledgerRes.rows[0].entry_type).toBe('DEBIT')
    expect(Number(ledgerRes.rows[0].amount)).toBe(20000)
  })

  it('verifies all existing wallet transaction types remain valid', async () => {
    const existingTypes = [
      'TOP_UP',
      'DEBIT',
      'CREDIT',
      'TRANSFER',
      'REFUND',
      'REVERSAL',
      'FEE',
      'ADJUSTMENT',
      'INVOICE_PAYMENT',
      'POS_PAYMENT'
    ]

    const businessId = randomUUID()
    const accountCustomerId = randomUUID()
    const walletId = randomUUID()

    await pool.query(`INSERT INTO businesses (id, name) VALUES ($1, $2)`, [businessId, 'DW2C1 Multi-Type Business'])
    await pool.query(
      `INSERT INTO account_customers (id, name, code, account_type, status) VALUES ($1, $2, $3, 'INDIVIDUAL', 'ACTIVE')`,
      [accountCustomerId, 'DW2C1 Multi-Type AC', `CUST-M-${Date.now()}`]
    )
    await pool.query(
      `INSERT INTO wallet_accounts (id, account_customer_id, business_id, wallet_number, currency, status, balance)
       VALUES ($1, $2, $3, $4, 'IDR', 'ACTIVE', 1000000)`,
      [walletId, accountCustomerId, businessId, `WAL-M-${Date.now()}`]
    )

    for (const txType of existingTypes) {
      const ledgerId = randomUUID()
      const idemKey = `idem-type-${txType}-${randomUUID()}`
      const entryType = ['TOP_UP', 'CREDIT', 'REFUND', 'REVERSAL', 'ADJUSTMENT'].includes(txType) ? 'CREDIT' : 'DEBIT'
      const amount = 1000
      const balanceBefore = 500000
      const balanceAfter = entryType === 'CREDIT' ? balanceBefore + amount : balanceBefore - amount

      const res = await pool.query(
        `INSERT INTO wallet_ledgers (
          id, wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
          currency, reference_type, reference_id, idempotency_key, actor_scope, description
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          'IDR', 'TEST', 'test-ref', $8, 'system', $9
        )
        RETURNING transaction_type`,
        [ledgerId, walletId, txType, entryType, amount, balanceBefore, balanceAfter, idemKey, `Testing ${txType}`]
      )

      expect(res.rows[0].transaction_type).toBe(txType)
    }
  })

  it('verifies invalid transaction types are strictly rejected by check constraint', async () => {
    const businessId = randomUUID()
    const accountCustomerId = randomUUID()
    const walletId = randomUUID()
    const ledgerId = randomUUID()
    const idemKey = `idem-invalid-${randomUUID()}`

    await pool.query(`INSERT INTO businesses (id, name) VALUES ($1, $2)`, [businessId, 'DW2C1 Reject Business'])
    await pool.query(
      `INSERT INTO account_customers (id, name, code, account_type, status) VALUES ($1, $2, $3, 'INDIVIDUAL', 'ACTIVE')`,
      [accountCustomerId, 'DW2C1 Reject AC', `CUST-R-${Date.now()}`]
    )
    await pool.query(
      `INSERT INTO wallet_accounts (id, account_customer_id, business_id, wallet_number, currency, status, balance)
       VALUES ($1, $2, $3, $4, 'IDR', 'ACTIVE', 50000)`,
      [walletId, accountCustomerId, businessId, `WAL-R-${Date.now()}`]
    )

    await expect(
      pool.query(
        `INSERT INTO wallet_ledgers (
          id, wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
          currency, reference_type, reference_id, idempotency_key, actor_scope, description
        ) VALUES (
          $1, $2, 'UNAUTHORIZED_CUSTOM_TYPE', 'DEBIT', 1000, 50000, 49000,
          'IDR', 'TEST', 'test-ref', $3, 'system', 'Invalid type'
        )`,
        [ledgerId, walletId, idemKey]
      )
    ).rejects.toThrow(/wallet_ledgers_transaction_type_check/)
  })
})
