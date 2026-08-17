import 'dotenv/config'
import { createApp } from './app'
import { loadEnv } from './config/env'
import { createPool } from './db/pool'
import { logger } from './utils/logger'

async function main(): Promise<void> {
  const env = loadEnv()
  const pool = createPool(env.databaseUrl)
  const app = createApp(pool)

  const host = process.env.HOST || '127.0.0.1'
  const server = app.listen(env.port, host, () => {
    logger.info(`BizERP API listening on port ${env.port} (${host})`)
  })

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...')
    server.close(async () => {
      await pool.end()
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start server')
  process.exit(1)
})
