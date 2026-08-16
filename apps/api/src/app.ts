import cors from 'cors'
import express, { Express } from 'express'
import helmet from 'helmet'
import { Pool } from 'pg'
import { errorHandler } from './middleware/error_handler'
import { notFound } from './middleware/not_found'
import { requestId } from './middleware/request_id'
import { createHealthRouter } from './routes/health_routes'
import { createAuthRouter } from './routes/auth_routes'
import { createProductSyncRouter } from './routes/product_sync_routes'
import { createSalesSyncRouter } from './routes/sales_sync_routes'

export function createApp(pool: Pool): Express {
  const app = express()

  // Trust the first hop (Nginx reverse proxy) to correctly set X-Forwarded-For
  app.set('trust proxy', 1)

  app.use(helmet({
    hsts: false, // Do not enable HSTS yet because production HTTPS is not active
    contentSecurityPolicy: false, // CSP rules are mostly irrelevant for this JSON API
    crossOriginEmbedderPolicy: false,
    frameguard: {
      action: 'deny'
    }
  }))
  app.use(cors())
  app.use(express.json({ limit: '2mb' }))
  app.use(requestId)

  app.use('/health', createHealthRouter(pool))
  app.use('/v1/auth', createAuthRouter(pool))
  app.use('/v1/sync/products', createProductSyncRouter(pool))
  app.use('/v1/sync/sales', createSalesSyncRouter(pool))

  app.use(notFound)
  app.use(errorHandler)

  return app
}
