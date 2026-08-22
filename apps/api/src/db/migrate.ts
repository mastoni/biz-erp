import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { Client } from 'pg'
import { createPool } from './pool'
import { logger } from '../utils/logger'

export async function runMigrations(_pool: any, migrationsDir?: string): Promise<void> {
  const dir = migrationsDir ?? path.resolve(process.cwd(), 'migrations')
  
  // Create a dedicated client for migrations
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
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
  const { loadEnv } = require('../config/env')
  const env = loadEnv()
  const pool = createPool(env.databaseUrl)

  runMigrations(pool)
    .then(() => {
      return pool.end()
    })
    .catch(async (error) => {
      logger.error({ err: error }, 'Migration failed')
      await pool.end()
      process.exit(1)
    })
}