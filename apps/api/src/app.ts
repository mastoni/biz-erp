import cors from 'cors'
import express, { Express } from 'express'
import { Pool } from 'pg'
import { errorHandler } from './middleware/error_handler'
import { notFound } from './middleware/not_found'
import { requestId } from './middleware/request_id'
import { createHealthRouter } from './routes/health_routes'
import { createProductSyncRouter } from './routes/product_sync_routes'
import { createSalesSyncRouter } from './routes/sales_sync_routes'

export function createApp(pool: Pool): Express {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors())
  app.use(express.json({ limit: '2mb' }))
  app.use(requestId)

  app.use('/health', createHealthRouter(pool))
  app.use('/v1/sync/products', createProductSyncRouter(pool))
  app.use('/v1/sync/sales', createSalesSyncRouter(pool))

  app.use(notFound)
  app.use(errorHandler)

  return app
}
