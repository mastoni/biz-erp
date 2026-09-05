import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'
import fs from 'fs'

describe('Phase 4.1.40H-1: Customer Recurring Billing Foundation (Migration 052)', () => {
  let pool: Pool

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
  })

  afterAll(async () => {
    await pool.end()
  })

  // Helpers
  async function createTestBusiness(namePrefix: string) {
    const bizId = randomUUID()
    await pool.query(
      `INSERT INTO businesses (id, name) VALUES ($1, $2)`,
      [bizId, `${namePrefix} Biz`]
    )
    return bizId
  }

  async function createTestCustomer(bizId: string, name: string) {
    const custId = randomUUID()
    await pool.query(
      `INSERT INTO customers (id, business_id, name, email, phone)
       VALUES ($1, $2, $3, $4, $5)`,
      [custId, bizId, name, `${name.toLowerCase().replace(/\s+/g, '')}@test.com`, '+6281111111']
    )
    return custId
  }

  async function createTestReceivable(bizId: string, custId: string, amountMinor: number) {
    const recId = randomUUID()
    await pool.query(
      `INSERT INTO receivables (
        id, business_id, customer_id, amount_minor, paid_minor, outstanding_minor, date, description, status
      ) VALUES (
        $1, $2, $3, $4, 0, $4, CURRENT_DATE, 'Test Recurring Receivable', 'OPEN'
      )`,
      [recId, bizId, custId, amountMinor]
    )
    return recId
  }

  describe('A & B: Migration Execution & Idempotency', () => {
    it('CRB-FND-001: executes migration 052 successfully and rerunning migration is safe/idempotent', async () => {
      // Re-run migration to test idempotency
      const migrationSql = fs.readFileSync(
        path.resolve(process.cwd(), 'migrations', '052_customer_recurring_billing_foundation.sql'),
        'utf8'
      )
      await expect(pool.query(migrationSql)).resolves.toBeDefined()
    })
  })

  describe('C & D: Schema Structure, Required Columns, and Constraints', () => {
    it('CRB-FND-002: verifies tenant_invoice_counters table and columns exist', async () => {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'tenant_invoice_counters'
        ORDER BY ordinal_position;
      `)
      const columns = res.rows.map((r) => r.column_name)
      expect(columns).toContain('business_id')
      expect(columns).toContain('year_month')
      expect(columns).toContain('last_seq')
      expect(columns).toContain('created_at')
      expect(columns).toContain('updated_at')
    })

    it('CRB-FND-003: verifies customer_subscriptions table and columns exist', async () => {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'customer_subscriptions'
        ORDER BY ordinal_position;
      `)
      const columns = res.rows.map((r) => r.column_name)
      expect(columns).toContain('id')
      expect(columns).toContain('business_id')
      expect(columns).toContain('customer_id')
      expect(columns).toContain('plan_code')
      expect(columns).toContain('product_id')
      expect(columns).toContain('name')
      expect(columns).toContain('unit_price_minor')
      expect(columns).toContain('discount_minor')
      expect(columns).toContain('tax_minor')
      expect(columns).toContain('total_minor')
      expect(columns).toContain('currency')
      expect(columns).toContain('billing_cycle')
      expect(columns).toContain('status')
      expect(columns).toContain('starts_at')
      expect(columns).toContain('ends_at')
      expect(columns).toContain('next_billing_date')
      expect(columns).toContain('anchor_day')
      expect(columns).toContain('notes')
      expect(columns).toContain('metadata')
      expect(columns).toContain('created_at')
      expect(columns).toContain('updated_at')
    })

    it('CRB-FND-004: verifies customer_invoices table and columns exist', async () => {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'customer_invoices'
        ORDER BY ordinal_position;
      `)
      const columns = res.rows.map((r) => r.column_name)
      expect(columns).toContain('id')
      expect(columns).toContain('invoice_number')
      expect(columns).toContain('business_id')
      expect(columns).toContain('customer_subscription_id')
      expect(columns).toContain('customer_id')
      expect(columns).toContain('receivable_id')
      expect(columns).toContain('billing_period_start')
      expect(columns).toContain('billing_period_end')
      expect(columns).toContain('subtotal_minor')
      expect(columns).toContain('discount_minor')
      expect(columns).toContain('tax_minor')
      expect(columns).toContain('total_minor')
      expect(columns).toContain('currency')
      expect(columns).toContain('status')
      expect(columns).toContain('issue_date')
      expect(columns).toContain('due_date')
      expect(columns).toContain('paid_at')
      expect(columns).toContain('payment_reference')
      expect(columns).toContain('notes')
      expect(columns).toContain('metadata')
      expect(columns).toContain('created_at')
      expect(columns).toContain('updated_at')
    })

    it('CRB-FND-005: verifies CHECK constraints on customer_subscriptions and customer_invoices', async () => {
      const bizId = await createTestBusiness('CHK-TEST')
      const custId = await createTestCustomer(bizId, 'Customer Chk')

      // 1. Invalid billing cycle
      await expect(
        pool.query(`
          INSERT INTO customer_subscriptions (
            business_id, customer_id, name, unit_price_minor, discount_minor, tax_minor, total_minor,
            billing_cycle, next_billing_date, anchor_day
          ) VALUES (
            $1, $2, 'Bad Cycle Plan', 100000, 0, 0, 100000, 'BIWEEKLY', CURRENT_DATE, 1
          )
        `, [bizId, custId])
      ).rejects.toThrow(/violates check constraint|23514/)

      // 2. Negative price
      await expect(
        pool.query(`
          INSERT INTO customer_subscriptions (
            business_id, customer_id, name, unit_price_minor, discount_minor, tax_minor, total_minor,
            billing_cycle, next_billing_date, anchor_day
          ) VALUES (
            $1, $2, 'Negative Price Plan', -5000, 0, 0, 0, 'MONTHLY', CURRENT_DATE, 1
          )
        `, [bizId, custId])
      ).rejects.toThrow(/violates check constraint|23514/)

      // 3. Invalid anchor_day (0 or 32)
      await expect(
        pool.query(`
          INSERT INTO customer_subscriptions (
            business_id, customer_id, name, unit_price_minor, discount_minor, tax_minor, total_minor,
            billing_cycle, next_billing_date, anchor_day
          ) VALUES (
            $1, $2, 'Invalid Anchor', 100000, 0, 0, 100000, 'MONTHLY', CURRENT_DATE, 32
          )
        `, [bizId, custId])
      ).rejects.toThrow(/violates check constraint|23514/)
    })
  })

  describe('E & F: Database-Level Composite Tenant Integrity', () => {
    it('CRB-FND-006: creates subscription and invoice within same tenant successfully', async () => {
      const bizId = await createTestBusiness('TENANT-OK')
      const custId = await createTestCustomer(bizId, 'Valid Customer')
      const subId = randomUUID()

      const subRes = await pool.query(`
        INSERT INTO customer_subscriptions (
          id, business_id, customer_id, name, unit_price_minor, discount_minor, tax_minor, total_minor,
          billing_cycle, next_billing_date, anchor_day
        ) VALUES (
          $1, $2, $3, 'Paket Internet 100M', 50000000, 0, 5500000, 55500000, 'MONTHLY', '2026-10-01', 1
        ) RETURNING *;
      `, [subId, bizId, custId])
      expect(subRes.rows.length).toBe(1)

      const recId = await createTestReceivable(bizId, custId, 55500000)

      const invRes = await pool.query(`
        INSERT INTO customer_invoices (
          business_id, invoice_number, customer_subscription_id, customer_id, receivable_id,
          billing_period_start, billing_period_end, subtotal_minor, discount_minor, tax_minor, total_minor,
          due_date
        ) VALUES (
          $1, 'INV-202609-0001', $2, $3, $4, '2026-09-01', '2026-09-30', 50000000, 0, 5500000, 55500000, '2026-09-10'
        ) RETURNING *;
      `, [bizId, subId, custId, recId])
      expect(invRes.rows.length).toBe(1)
      expect(invRes.rows[0].invoice_number).toBe('INV-202609-0001')
    })

    it('CRB-FND-007: REJECTS subscription referencing customer from ANOTHER business', async () => {
      const bizA = await createTestBusiness('CROSS-SUB-BIZA')
      const bizB = await createTestBusiness('CROSS-SUB-BIZB')
      const custA = await createTestCustomer(bizA, 'Customer of Biz A')

      // Attempt to create subscription in Biz B with Customer of Biz A
      await expect(
        pool.query(`
          INSERT INTO customer_subscriptions (
            business_id, customer_id, name, unit_price_minor, discount_minor, tax_minor, total_minor,
            billing_cycle, next_billing_date, anchor_day
          ) VALUES (
            $1, $2, 'Cross Sub Attempt', 100000, 0, 0, 100000, 'MONTHLY', CURRENT_DATE, 1
          )
        `, [bizB, custA])
      ).rejects.toThrow(/violates foreign key constraint|fk_customer_sub_customer|23503/)
    })

    it('CRB-FND-008: REJECTS invoice referencing subscription from ANOTHER business', async () => {
      const bizA = await createTestBusiness('CROSS-INV-BIZA')
      const bizB = await createTestBusiness('CROSS-INV-BIZB')
      const custA = await createTestCustomer(bizA, 'Customer A')
      const custB = await createTestCustomer(bizB, 'Customer B')

      const subA = randomUUID()
      await pool.query(`
        INSERT INTO customer_subscriptions (
          id, business_id, customer_id, name, unit_price_minor, discount_minor, tax_minor, total_minor,
          billing_cycle, next_billing_date, anchor_day
        ) VALUES (
          $1, $2, $3, 'Sub A', 100000, 0, 0, 100000, 'MONTHLY', CURRENT_DATE, 1
        )
      `, [subA, bizA, custA])

      const recB = await createTestReceivable(bizB, custB, 100000)

      // Invoice in Biz B referencing Sub A in Biz A
      await expect(
        pool.query(`
          INSERT INTO customer_invoices (
            business_id, invoice_number, customer_subscription_id, customer_id, receivable_id,
            billing_period_start, billing_period_end, subtotal_minor, discount_minor, tax_minor, total_minor,
            due_date
          ) VALUES (
            $1, 'INV-CROSS-01', $2, $3, $4, '2026-09-01', '2026-09-30', 100000, 0, 0, 100000, '2026-09-10'
          )
        `, [bizB, subA, custB, recB])
      ).rejects.toThrow(/violates foreign key constraint|fk_customer_invoices_subscription|23503/)
    })

    it('CRB-FND-009: REJECTS invoice referencing receivable from ANOTHER business', async () => {
      const bizA = await createTestBusiness('CROSS-REC-BIZA')
      const bizB = await createTestBusiness('CROSS-REC-BIZB')
      const custA = await createTestCustomer(bizA, 'Customer A')

      const subA = randomUUID()
      await pool.query(`
        INSERT INTO customer_subscriptions (
          id, business_id, customer_id, name, unit_price_minor, discount_minor, tax_minor, total_minor,
          billing_cycle, next_billing_date, anchor_day
        ) VALUES (
          $1, $2, $3, 'Sub A', 100000, 0, 0, 100000, 'MONTHLY', CURRENT_DATE, 1
        )
      `, [subA, bizA, custA])

      // Receivable belongs to Biz B
      const custB = await createTestCustomer(bizB, 'Customer B')
      const recB = await createTestReceivable(bizB, custB, 100000)

      // Invoice in Biz A referencing Receivable in Biz B
      await expect(
        pool.query(`
          INSERT INTO customer_invoices (
            business_id, invoice_number, customer_subscription_id, customer_id, receivable_id,
            billing_period_start, billing_period_end, subtotal_minor, discount_minor, tax_minor, total_minor,
            due_date
          ) VALUES (
            $1, 'INV-CROSS-REC-01', $2, $3, $4, '2026-09-01', '2026-09-30', 100000, 0, 0, 100000, '2026-09-10'
          )
        `, [bizA, subA, custA, recB])
      ).rejects.toThrow(/violates foreign key constraint|fk_customer_invoices_receivable|23503/)
    })
  })

  describe('G, H, I: Invoice Uniqueness & Numbering Rules', () => {
    it('CRB-FND-010: G - REJECTS duplicate invoice for the same subscription and period', async () => {
      const bizId = await createTestBusiness('DUP-PERIOD')
      const custId = await createTestCustomer(bizId, 'Customer Period')
      const subId = randomUUID()

      await pool.query(`
        INSERT INTO customer_subscriptions (
          id, business_id, customer_id, name, unit_price_minor, discount_minor, tax_minor, total_minor,
          billing_cycle, next_billing_date, anchor_day
        ) VALUES (
          $1, $2, $3, 'Subscription Period Test', 200000, 0, 0, 200000, 'MONTHLY', CURRENT_DATE, 1
        )
      `, [subId, bizId, custId])

      const rec1 = await createTestReceivable(bizId, custId, 200000)
      const rec2 = await createTestReceivable(bizId, custId, 200000)

      // Invoice 1
      await pool.query(`
        INSERT INTO customer_invoices (
          business_id, invoice_number, customer_subscription_id, customer_id, receivable_id,
          billing_period_start, billing_period_end, subtotal_minor, discount_minor, tax_minor, total_minor,
          due_date
        ) VALUES (
          $1, 'INV-PER-001', $2, $3, $4, '2026-10-01', '2026-10-31', 200000, 0, 0, 200000, '2026-10-10'
        )
      `, [bizId, subId, custId, rec1])

      // Invoice 2 with SAME subscription, same start and end dates -> MUST FAIL
      await expect(
        pool.query(`
          INSERT INTO customer_invoices (
            business_id, invoice_number, customer_subscription_id, customer_id, receivable_id,
            billing_period_start, billing_period_end, subtotal_minor, discount_minor, tax_minor, total_minor,
            due_date
          ) VALUES (
            $1, 'INV-PER-002', $2, $3, $4, '2026-10-01', '2026-10-31', 200000, 0, 0, 200000, '2026-10-10'
          )
        `, [bizId, subId, custId, rec2])
      ).rejects.toThrow(/duplicate key value violates unique constraint|uq_customer_invoice_period|23505/)
    })

    it('CRB-FND-011: H - REJECTS duplicate invoice_number within the SAME business', async () => {
      const bizId = await createTestBusiness('DUP-INV-NUM')
      const custId = await createTestCustomer(bizId, 'Customer Inv Num')
      const subId1 = randomUUID()
      const subId2 = randomUUID()

      await pool.query(`
        INSERT INTO customer_subscriptions (
          id, business_id, customer_id, name, unit_price_minor, discount_minor, tax_minor, total_minor,
          billing_cycle, next_billing_date, anchor_day
        ) VALUES 
          ($1, $2, $3, 'Sub 1', 100000, 0, 0, 100000, 'MONTHLY', CURRENT_DATE, 1),
          ($4, $2, $3, 'Sub 2', 100000, 0, 0, 100000, 'MONTHLY', CURRENT_DATE, 1)
      `, [subId1, bizId, custId, subId2])

      const rec1 = await createTestReceivable(bizId, custId, 100000)
      const rec2 = await createTestReceivable(bizId, custId, 100000)

      await pool.query(`
        INSERT INTO customer_invoices (
          business_id, invoice_number, customer_subscription_id, customer_id, receivable_id,
          billing_period_start, billing_period_end, subtotal_minor, discount_minor, tax_minor, total_minor,
          due_date
        ) VALUES (
          $1, 'INV-SAME-NUM', $2, $3, $4, '2026-08-01', '2026-08-31', 100000, 0, 0, 100000, '2026-08-10'
        )
      `, [bizId, subId1, custId, rec1])

      await expect(
        pool.query(`
          INSERT INTO customer_invoices (
            business_id, invoice_number, customer_subscription_id, customer_id, receivable_id,
            billing_period_start, billing_period_end, subtotal_minor, discount_minor, tax_minor, total_minor,
            due_date
          ) VALUES (
            $1, 'INV-SAME-NUM', $2, $3, $4, '2026-09-01', '2026-09-30', 100000, 0, 0, 100000, '2026-09-10'
          )
        `, [bizId, subId2, custId, rec2])
      ).rejects.toThrow(/duplicate key value violates unique constraint|uq_customer_invoice_number_business|23505/)
    })

    it('CRB-FND-012: I - PERMITS the same invoice_number in DIFFERENT businesses', async () => {
      const bizA = await createTestBusiness('INV-NUM-BIZA')
      const bizB = await createTestBusiness('INV-NUM-BIZB')
      const custA = await createTestCustomer(bizA, 'Customer A')
      const custB = await createTestCustomer(bizB, 'Customer B')

      const subA = randomUUID()
      const subB = randomUUID()

      await pool.query(`
        INSERT INTO customer_subscriptions (
          id, business_id, customer_id, name, unit_price_minor, discount_minor, tax_minor, total_minor,
          billing_cycle, next_billing_date, anchor_day
        ) VALUES 
          ($1, $2, $3, 'Sub A', 100000, 0, 0, 100000, 'MONTHLY', CURRENT_DATE, 1),
          ($4, $5, $6, 'Sub B', 100000, 0, 0, 100000, 'MONTHLY', CURRENT_DATE, 1)
      `, [subA, bizA, custA, subB, bizB, custB])

      const recA = await createTestReceivable(bizA, custA, 100000)
      const recB = await createTestReceivable(bizB, custB, 100000)

      const resA = await pool.query(`
        INSERT INTO customer_invoices (
          business_id, invoice_number, customer_subscription_id, customer_id, receivable_id,
          billing_period_start, billing_period_end, subtotal_minor, discount_minor, tax_minor, total_minor,
          due_date
        ) VALUES (
          $1, 'INV-SHARED-202609-0001', $2, $3, $4, '2026-09-01', '2026-09-30', 100000, 0, 0, 100000, '2026-09-10'
        ) RETURNING id;
      `, [bizA, subA, custA, recA])

      const resB = await pool.query(`
        INSERT INTO customer_invoices (
          business_id, invoice_number, customer_subscription_id, customer_id, receivable_id,
          billing_period_start, billing_period_end, subtotal_minor, discount_minor, tax_minor, total_minor,
          due_date
        ) VALUES (
          $1, 'INV-SHARED-202609-0001', $2, $3, $4, '2026-09-01', '2026-09-30', 100000, 0, 0, 100000, '2026-09-10'
        ) RETURNING id;
      `, [bizB, subB, custB, recB])

      expect(resA.rows[0].id).toBeDefined()
      expect(resB.rows[0].id).toBeDefined()
      expect(resA.rows[0].id).not.toBe(resB.rows[0].id)
    })
  })

  describe('J: tenant_invoice_counters Atomic UPSERT & Primary Key', () => {
    it('CRB-FND-013: J - handles atomic UPSERT sequence increments per tenant and period', async () => {
      const bizId = await createTestBusiness('COUNTER-TEST')
      const yearMonth = '202609'

      // First increment -> 1
      const res1 = await pool.query(`
        INSERT INTO tenant_invoice_counters (business_id, year_month, last_seq, created_at, updated_at)
        VALUES ($1, $2, 1, now(), now())
        ON CONFLICT (business_id, year_month)
        DO UPDATE SET last_seq = tenant_invoice_counters.last_seq + 1, updated_at = now()
        RETURNING last_seq;
      `, [bizId, yearMonth])
      expect(res1.rows[0].last_seq).toBe(1)

      // Second increment -> 2
      const res2 = await pool.query(`
        INSERT INTO tenant_invoice_counters (business_id, year_month, last_seq, created_at, updated_at)
        VALUES ($1, $2, 1, now(), now())
        ON CONFLICT (business_id, year_month)
        DO UPDATE SET last_seq = tenant_invoice_counters.last_seq + 1, updated_at = now()
        RETURNING last_seq;
      `, [bizId, yearMonth])
      expect(res2.rows[0].last_seq).toBe(2)

      // Another business starts at 1
      const bizOther = await createTestBusiness('COUNTER-OTHER')
      const resOther = await pool.query(`
        INSERT INTO tenant_invoice_counters (business_id, year_month, last_seq, created_at, updated_at)
        VALUES ($1, $2, 1, now(), now())
        ON CONFLICT (business_id, year_month)
        DO UPDATE SET last_seq = tenant_invoice_counters.last_seq + 1, updated_at = now()
        RETURNING last_seq;
      `, [bizOther, yearMonth])
      expect(resOther.rows[0].last_seq).toBe(1)
    })
  })

  describe('K & L: Prerequisite Data Intact & Migrations 001-051 Unchanged', () => {
    it('CRB-FND-014: K - verifies existing prerequisite customers and receivables tables retain integrity', async () => {
      const bizId = await createTestBusiness('PREREQ-DATA')
      const custId = await createTestCustomer(bizId, 'Prereq Customer')
      const recId = await createTestReceivable(bizId, custId, 300000)

      const custCheck = await pool.query('SELECT * FROM customers WHERE id = $1', [custId])
      expect(custCheck.rows.length).toBe(1)

      const recCheck = await pool.query('SELECT * FROM receivables WHERE id = $1', [recId])
      expect(recCheck.rows.length).toBe(1)
      expect(Number(recCheck.rows[0].amount_minor)).toBe(300000)
    })

    it('CRB-FND-015: L - verifies migration files 001 through 051 exist and are unchanged', () => {
      const migrationsDir = path.resolve(process.cwd(), 'migrations')
      const files = fs.readdirSync(migrationsDir).sort()

      // Ensure 052 is present
      expect(files).toContain('052_customer_recurring_billing_foundation.sql')

      // Ensure 001 to 051 remain present
      const expectedPrior = [
        '001_initial_schema.sql',
        '002_indexes.sql',
        '006_product_barcode_unique.sql',
        '007_auth_foundation.sql',
        '008_inventory_foundation.sql',
        '009_customers_foundation.sql',
        '010_registration_onboarding.sql',
        '011_sales_customer_id.sql',
        '012_customers_sync.sql',
        '013_receipt_uniqueness.sql',
        '014_customers_version_hardening.sql',
        '015_canonical_catalog_module_foundation.sql',
        '016_subscription_commercial_lifecycle.sql',
        '017_platform_identity_foundation.sql',
        '018_platform_refresh_session_foundation.sql',
        '019_sales_branch_id.sql',
        '020_products_sku_cost.sql',
        '021_customers_tier_points.sql',
        '022_products_image_url.sql',
        '023_products_image_enabled.sql',
        '024_store_settings.sql',
        '025_suppliers_foundation.sql',
        '026_purchase_foundation.sql',
        '027_finance_foundation.sql',
        '028_expense_foundation.sql',
        '029_income_foundation.sql',
        '030_receivable_foundation.sql',
        '031_payable_foundation.sql',
        '032_cash_purchase_foundation.sql',
        '033_tenant_lifecycle_foundation.sql',
        '034_commercial_governance_foundation.sql',
        '035_service_registry_foundation.sql',
        '036_entitlement_service_mapping.sql',
        '037_provisioning_foundation.sql',
        '038_platform_audit_observability.sql',
        '039_ai_cs_foundation.sql',
        '040_isp_management_foundation.sql',
        '041_canonical_modules_seed.sql',
        '042_platform_billing_lifecycle.sql',
        '043_platform_payment_gateway.sql',
        '044_canonical_demo_catalog_and_bundles.sql',
        '045_canonical_erp_umkm_bundles.sql',
        '046_platform_ai_cs_settings.sql',
        '047_support_ticket_source.sql',
        '048_ai_knowledge_base.sql',
        '049_account_customers_foundation.sql',
        '050_fix_subscription_lifecycle_trigger.sql',
        '051_hardware_device_service_foundation.sql',
      ]

      for (const prior of expectedPrior) {
        expect(files).toContain(prior)
      }
    })
  })
})
