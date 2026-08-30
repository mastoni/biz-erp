import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { Client } from 'pg'
import { logger } from '../utils/logger'

export async function runMigrations(_pool?: any, migrationsDir?: string): Promise<void> {
  const dir = migrationsDir ?? path.resolve(process.cwd(), 'migrations')
  
  const connectionString =
    (_pool && typeof _pool === 'object' && _pool.options && _pool.options.connectionString) ||
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL

  // Create a dedicated client for migrations
  const client = new Client({
    connectionString,
  })
  
  await client.connect()

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
        logger.info(`Applied migration: ${file}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    await client.end()
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Database migrations completed successfully.')
      process.exit(0)
    })
    .catch((error) => {
      logger.error({ err: error }, 'Migration failed')
      process.exit(1)
    })
}