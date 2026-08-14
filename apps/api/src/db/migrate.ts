import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { createPool } from './pool'

export async function runMigrations(pool: Pool, migrationsDir?: string): Promise<void> {
  const dir = migrationsDir ?? path.resolve(process.cwd(), 'migrations')
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    const appliedResult = await client.query('SELECT version FROM schema_migrations')
    const applied = new Set(appliedResult.rows.map((row) => row.version as string))

    const files = fs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.sql'))
      .sort()

    for (const file of files) {
      if (applied.has(file)) {
        continue
      }

      const sql = fs.readFileSync(path.join(dir, file), 'utf8')

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`Applied migration: ${file}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    client.release()
  }
}

if (require.main === module) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const pool = createPool(databaseUrl)

  runMigrations(pool)
    .then(() => {
      console.log('Migration completed')
      return pool.end()
    })
    .catch(async (error) => {
      console.error('Migration failed', error)
      await pool.end()
      process.exit(1)
    })
}
