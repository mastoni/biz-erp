import path from 'path'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { saleRepository } from '../src/repositories/sale_repository'
import { validateSalesBatch, SalePayload, SaleItemPayload } from '../src/dto/sale_dto'
import { ValidationError } from '../src/errors/validation_error'

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

describe('Phase DW-2C2 — POS Wallet Settlement DTO + Repository', () => {
  const businessId = randomUUID()
  const branchId = randomUUID()
  const productId = randomUUID()
  const accountCustomerId = randomUUID()
  const walletId = randomUUID()

  beforeAll(async () => {
    await pool.query(`INSERT INTO businesses (id, name) VALUES ($1, $2)`, [businessId, 'DW2C2 Test Business'])
    await pool.query(
      `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'Main Branch', TRUE)`,
      [branchId, businessId]
    )
    await pool.query(
      `INSERT INTO products (id, business_id, name, price_minor, is_active) VALUES ($1, $2, 'Test Coffee', 25000, TRUE)`,
      [productId, businessId]
    )
    await pool.query(
      `INSERT INTO account_customers (id, name, code, account_type, status) VALUES ($1, $2, $3, 'INDIVIDUAL', 'ACTIVE')`,
      [accountCustomerId, 'DW2C2 AC', `CUST-DW2C2-${Date.now()}`]
    )
    await pool.query(
      `INSERT INTO wallet_accounts (id, account_customer_id, business_id, wallet_number, currency, status, balance)
       VALUES ($1, $2, $3, $4, 'IDR', 'ACTIVE', 500000)`,
      [walletId, accountCustomerId, businessId, `WAL-DW2C2-${Date.now()}`]
    )
  })

  // ---------------------------------------------------------------------------
  // 1. DTO Validation Tests
  // ---------------------------------------------------------------------------
  describe('DTO Validation (validateSalesBatch)', () => {
    it('accepts valid sale payload with wallet_id', () => {
      const validSaleId = randomUUID()
      const req = {
        business_id: businessId,
        items: [
          {
            idempotency_key: `idem-dto-wal-${Date.now()}`,
            request_hash: 'hash123',
            sale: {
              id: validSaleId,
              receipt_number: `TRX-DTO-WAL-${Date.now()}`,
              subtotal_minor: 25000,
              discount_minor: 0,
              tax_minor: 2750,
              total_minor: 27750,
              payment_method: 'wallet',
              paid_minor: 27750,
              change_minor: 0,
              branch_id: branchId,
              wallet_id: walletId,
              created_at: new Date().toISOString(),
              client_created_at: new Date().toISOString()
            },
            sale_items: [
              {
                product_id: productId,
                product_name: 'Test Coffee',
                quantity: 1,
                unit_price_minor: 25000,
                subtotal_minor: 25000
              }
            ]
          }
        ]
      }

      const validated = validateSalesBatch(req)
      expect(validated.items[0].sale.wallet_id).toBe(walletId)
      expect(validated.items[0].sale.payment_method).toBe('wallet')
    })

    it('accepts legacy sale payload with wallet_id omitted or null', () => {
      const legacySaleId = randomUUID()
      const req = {
        business_id: businessId,
        items: [
          {
            idempotency_key: `idem-dto-legacy-${Date.now()}`,
            request_hash: 'hash-legacy',
            sale: {
              id: legacySaleId,
              receipt_number: `TRX-DTO-LEGACY-${Date.now()}`,
              subtotal_minor: 25000,
              discount_minor: 0,
              tax_minor: 0,
              total_minor: 25000,
              payment_method: 'cash',
              paid_minor: 30000,
              change_minor: 5000,
              branch_id: branchId,
              created_at: new Date().toISOString(),
              client_created_at: new Date().toISOString()
            },
            sale_items: [
              {
                product_id: productId,
                product_name: 'Test Coffee',
                quantity: 1,
                unit_price_minor: 25000,
                subtotal_minor: 25000
              }
            ]
          }
        ]
      }

      const validated = validateSalesBatch(req)
      expect(validated.items[0].sale.wallet_id).toBeNull()
      expect(validated.items[0].sale.payment_method).toBe('cash')
    })

    it('rejects invalid non-UUID wallet_id with ValidationError', () => {
      const req = {
        business_id: businessId,
        items: [
          {
            idempotency_key: `idem-dto-err-${Date.now()}`,
            request_hash: 'hash-err',
            sale: {
              id: randomUUID(),
              receipt_number: `TRX-DTO-ERR-${Date.now()}`,
              subtotal_minor: 25000,
              discount_minor: 0,
              tax_minor: 0,
              total_minor: 25000,
              payment_method: 'wallet',
              paid_minor: 25000,
              change_minor: 0,
              branch_id: branchId,
              wallet_id: 'not-a-valid-uuid',
              created_at: new Date().toISOString(),
              client_created_at: new Date().toISOString()
            },
            sale_items: [
              {
                product_id: productId,
                product_name: 'Test Coffee',
                quantity: 1,
                unit_price_minor: 25000,
                subtotal_minor: 25000
              }
            ]
          }
        ]
      }

      expect(() => validateSalesBatch(req)).toThrow(ValidationError)
    })

    it('preserves valid behavior for all standard payment methods (cash, bank_transfer, debit, credit)', () => {
      const methods = ['cash', 'bank_transfer', 'debit', 'credit', 'qris', 'wallet']

      methods.forEach((method) => {
        const req = {
          business_id: businessId,
          items: [
            {
              idempotency_key: `idem-method-${method}-${Date.now()}`,
              request_hash: `hash-${method}`,
              sale: {
                id: randomUUID(),
                receipt_number: `TRX-${method}-${Date.now()}`,
                subtotal_minor: 10000,
                discount_minor: 0,
                tax_minor: 0,
                total_minor: 10000,
                payment_method: method,
                paid_minor: 10000,
                change_minor: 0,
                branch_id: branchId,
                created_at: new Date().toISOString(),
                client_created_at: new Date().toISOString()
              },
              sale_items: [
                {
                  product_id: productId,
                  product_name: 'Test Coffee',
                  quantity: 1,
                  unit_price_minor: 10000,
                  subtotal_minor: 10000
                }
              ]
            }
          ]
        }

        const validated = validateSalesBatch(req)
        expect(validated.items[0].sale.payment_method).toBe(method)
      })
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Repository Persistence Tests
  // ---------------------------------------------------------------------------
  describe('Repository Persistence (saleRepository)', () => {
    it('persists and retrieves a sale with wallet_id correctly', async () => {
      const saleId = randomUUID()
      const receiptNumber = `TRX-REPO-WAL-${Date.now()}`

      const salePayload: SalePayload = {
        id: saleId,
        receipt_number: receiptNumber,
        subtotal_minor: 25000,
        discount_minor: 0,
        tax_minor: 2750,
        total_minor: 27750,
        payment_method: 'wallet',
        paid_minor: 27750,
        change_minor: 0,
        cashier_id: null,
        customer_id: null,
        branch_id: branchId,
        wallet_id: walletId,
        created_at: new Date().toISOString(),
        client_created_at: new Date().toISOString()
      }

      const itemPayload: SaleItemPayload[] = [
        {
          product_id: productId,
          product_name: 'Test Coffee',
          quantity: 1,
          unit_price_minor: 25000,
          subtotal_minor: 25000
        }
      ]

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const created = await saleRepository.createSaleWithItems(client, businessId, salePayload, itemPayload)
        await client.query('COMMIT')

        expect(created.sale_id).toBe(saleId)
        expect(created.receipt_number).toBe(receiptNumber)

        // Verify findById retrieves wallet_id
        const fetched = await saleRepository.findById(client, businessId, saleId)
        expect(fetched).not.toBeNull()
        expect(fetched?.id).toBe(saleId)
        expect(fetched?.wallet_id).toBe(walletId)
        expect(fetched?.payment_method).toBe('wallet')
        expect(fetched?.total_minor).toBe(27750)
      } finally {
        client.release()
      }
    })

    it('persists and retrieves a legacy sale with null wallet_id correctly', async () => {
      const saleId = randomUUID()
      const receiptNumber = `TRX-REPO-LEGACY-${Date.now()}`

      const salePayload: SalePayload = {
        id: saleId,
        receipt_number: receiptNumber,
        subtotal_minor: 50000,
        discount_minor: 0,
        tax_minor: 0,
        total_minor: 50000,
        payment_method: 'cash',
        paid_minor: 50000,
        change_minor: 0,
        cashier_id: null,
        customer_id: null,
        branch_id: branchId,
        wallet_id: null,
        created_at: new Date().toISOString(),
        client_created_at: new Date().toISOString()
      }

      const itemPayload: SaleItemPayload[] = [
        {
          product_id: productId,
          product_name: 'Test Coffee',
          quantity: 2,
          unit_price_minor: 25000,
          subtotal_minor: 50000
        }
      ]

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const created = await saleRepository.createSaleWithItems(client, businessId, salePayload, itemPayload)
        await client.query('COMMIT')

        expect(created.sale_id).toBe(saleId)

        // Verify findById retrieves null wallet_id
        const fetched = await saleRepository.findById(client, businessId, saleId)
        expect(fetched).not.toBeNull()
        expect(fetched?.id).toBe(saleId)
        expect(fetched?.wallet_id).toBeNull()
        expect(fetched?.payment_method).toBe('cash')

        // Verify findSalesSince includes wallet_id
        const listRes = await saleRepository.findSalesSince(client, businessId, 0, 50, branchId)
        const foundSale = listRes.sales.find((s) => s.id === saleId)
        expect(foundSale).toBeDefined()
        expect(foundSale?.wallet_id).toBeNull()
      } finally {
        client.release()
      }
    })
  })
})
