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
import { createBranchRoutes } from './routes/branch_routes'
import { createInventoryRoutes } from './routes/inventory_routes'
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
      if (origin === undefined) {
        // Allow requests with no Origin header (mobile apps, curl, server-to-server)
        return callback(null, true)
      }

      const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
        : env.corsAllowedOrigins

      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      callback(new Error('Not allowed by CORS'))
    },
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Client-Type',
      'X-Request-ID'
    ],
    exposedHeaders: ['X-Request-Id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  }))
  app.use(express.json({ limit: '2mb' }))

  app.use(requestId)
  app.use(httpLogger)

  app.use('/health', createHealthRouter(pool))
  app.use('/v1/auth', createAuthRouter(pool))
  app.use('/v1/sync/products', createProductSyncRouter(pool))
  app.use('/v1/sync/sales', createSalesSyncRouter(pool))
  app.use('/v1/branches', createBranchRoutes(pool))
  app.use('/v1/inventory', createInventoryRoutes(pool))

  app.use(notFound)
  app.use(errorHandler)

  return app
}
