import 'dotenv/config'
import { createApp } from './app'
import { loadEnv } from './config/env'
import { createPool } from './db/pool'

async function main(): Promise<void> {
  const env = loadEnv()
  const pool = createPool(env.databaseUrl)
  const app = createApp(pool)

  const host = process.env.HOST || '127.0.0.1'
  const server = app.listen(env.port, host, () => {
    console.log(`BizERP API listening on port ${env.port} (${host})`)
  })

  const shutdown = async (): Promise<void> => {
    console.log('Shutting down...')
    server.close(async () => {
      await pool.end()
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error('Failed to start server', error)
  process.exit(1)
})
