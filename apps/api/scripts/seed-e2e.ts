import 'dotenv/config'
import { Pool } from 'pg'

async function main() {
  const nodeEnv = process.env.NODE_ENV || 'development'

  if (nodeEnv === 'production') {
    console.error('REFUSED: seed-e2e.ts must NEVER run in production.')
    process.exit(1)
  }

  console.log('E2E seed - development use only. Proceeding...')

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  const BUSINESS_ID = '11111111-1111-1111-1111-111111111111'
  const PRODUCT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
  const PRODUCT_NAME = 'E2E Deterministic Product'
  const PRICE_MINOR = 10000

  try {
    await pool.query(
      'INSERT INTO businesses (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [BUSINESS_ID, 'E2E Test Business']
    )

    // 1. Seed Product A
    await pool.query(`
      INSERT INTO products (id, business_id, name, description, price_minor, category, barcode, is_active, server_version, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, now(), now())
      ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active, price_minor = EXCLUDED.price_minor, name = EXCLUDED.name, updated_at = now()
    `, [
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      BUSINESS_ID,
      'E2E Deterministic Product',
      'Deterministic fixture for E2E testing',
      10000,
      'E2E',
      'E2E-BARCODE-001',
      true
    ])

    // 2. Seed Product B
    await pool.query(`
      INSERT INTO products (id, business_id, name, description, price_minor, category, barcode, is_active, server_version, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 2, now(), now())
      ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active, price_minor = EXCLUDED.price_minor, name = EXCLUDED.name, updated_at = now()
    `, [
      'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
      BUSINESS_ID,
      'Scenario B Product',
      'Test B',
      20000,
      'E2E',
      'E2E-BARCODE-002',
      true
    ])

    console.log('E2E FIXTURE READY')
    console.log('Business: 11111111-1111-1111-1111-111111111111')
    console.log('Product A: aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    console.log('Product B: bbbbbbbb-cccc-4ddd-8eee-ffffffffffff')
  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
