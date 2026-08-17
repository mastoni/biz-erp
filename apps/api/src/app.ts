import cors from 'cors'
import cookieParser from 'cookie-parser'
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
import { httpLogger } from './utils/logger'
import { initSentry } from './utils/sentry'
import { loadEnv } from './config/env'

export function createApp(pool: Pool): Express {
  const env = loadEnv()
  initSentry(env)

  const app = express()

  // Trust the first hop (Nginx reverse proxy) to correctly set X-Forwarded-For
  app.set('trust proxy', 1)

  app.use(helmet({
    hsts: false, // Do not enable HSTS yet because production HTTPS is not active
    contentSecurityPolicy: false, // CSP rules are mostly irrelevant for this JSON API
    crossOriginEmbedderPolicy: false,
    frameguard: false,
    referrerPolicy: false,
    xContentTypeOptions: false
  }))
  app.use(cookieParser())
  app.use(cors({
    credentials: true,
    origin: (origin, callback) => {
      const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []
      
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true)
      
      // Allow if we are not in production and no CORS_ORIGINS are explicitly defined
      const isProduction = process.env.NODE_ENV === 'production' || env.nodeEnv === 'production'
      if (!isProduction && allowedOrigins.length === 0) {
        return callback(null, true)
      }

      // Check if origin is in allowed list
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true)
      }

      callback(new Error('Not allowed by CORS'))
    }
  }))
  app.use(express.json({ limit: '2mb' }))

  app.use(requestId)
  app.use(httpLogger)

  app.use('/health', createHealthRouter(pool))
  app.use('/v1/auth', createAuthRouter(pool))
  app.use('/v1/sync/products', createProductSyncRouter(pool))
  app.use('/v1/sync/sales', createSalesSyncRouter(pool))

  app.use(notFound)
  app.use(errorHandler)

  return app
}
