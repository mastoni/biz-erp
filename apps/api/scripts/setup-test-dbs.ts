import 'dotenv/config'
import { Client } from 'pg'

// Creates the per-suite isolated test databases used by the integration tests.
// Tables/schema are NEVER created here; they are provisioned by `runMigrations`
// (the repository's existing migration mechanism) when each suite boots.
//
// Usage:
//   npm run test:setup-dbs
//
// Override the admin/postgres connection with TEST_DB_ADMIN_URL if needed.

const TEST_DATABASES = [
  'biz_erp_finance_test',
  'biz_erp_purchase_test',
  'biz_erp_supplier_test',
]

async function main() {
  const adminUrl =
    process.env.TEST_DB_ADMIN_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/postgres'

  const client = new Client({ connectionString: adminUrl })
  await client.connect()

  try {
    for (const db of TEST_DATABASES) {
      try {
        await client.query(`CREATE DATABASE "${db}"`)
        // eslint-disable-next-line no-console
        console.log(`Created test database: ${db}`)
      } catch (err: any) {
        if (err?.code === '42P04') {
          // eslint-disable-next-line no-console
          console.log(`Test database already exists: ${db}`)
        } else {
          throw err
        }
      }
    }
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
