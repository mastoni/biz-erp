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

    await pool.query(
      'INSERT INTO products (id, business_id, name, description, price_minor, category, barcode, is_active, server_version, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now()) ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active, price_minor = EXCLUDED.price_minor, name = EXCLUDED.name, updated_at = now()',
      [
        PRODUCT_ID,
        BUSINESS_ID,
        PRODUCT_NAME,
        'Deterministic fixture for E2E testing',
        PRICE_MINOR,
        'E2E',
        'E2E-BARCODE-001',
        true,
        1
      ]
    )

    console.log('E2E FIXTURE READY')
    console.log('Business: ' + BUSINESS_ID)
    console.log('Product:  ' + PRODUCT_ID)
    console.log('Name:     ' + PRODUCT_NAME)
    console.log('Price:    ' + PRICE_MINOR)
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
