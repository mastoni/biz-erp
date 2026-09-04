import cors from 'cors'
import cookieParser from 'cookie-parser'
import express, { Express } from 'express'
import helmet from 'helmet'
import { Pool } from 'pg'
import { errorHandler } from './middleware/error_handler'
import { notFound } from './middleware/not_found'
import { requestId } from './middleware/request_id'
import { createRequireActiveTenant, requireEntitlement } from './middleware/auth'
import { createJwtService } from './services/jwt_service'
import { createHealthRouter } from './routes/health_routes'
import { createAuthRouter } from './routes/auth_routes'
import { createProductSyncRouter } from './routes/product_sync_routes'
import { createProductRoutes } from './routes/product_routes'
import { createSalesSyncRouter } from './routes/sales_sync_routes'
import { createBranchRoutes } from './routes/branch_routes'
import { createInventoryRoutes } from './routes/inventory_routes'
import { createCustomerRoutes } from './routes/customer_routes'
import { createUsersRoutes } from './routes/users_routes'
import { createDashboardRoutes } from './routes/dashboard_routes'
import { createReportsRoutes } from './routes/reports_routes'
import { createCustomerSyncRouter } from './routes/customer_sync_routes'
import { createSubscriptionRoutes } from './routes/subscription_routes'
import { createProvisioningRoutes } from './routes/provisioning_routes'
import { createIspRoutes } from './routes/isp_routes'
import { createAiCsRoutes } from './routes/ai_cs_routes'
import { createPlatformRoutes } from './routes/platform_routes'
import { createPlatformWebhookRoutes } from './routes/platform_webhook_routes'
import { createPublicRoutes } from './routes/public_routes'
import { createMediaRoutes } from './routes/media_routes'
import { createStoreSettingsRoutes } from './routes/store_settings_routes'
import { createSupplierRoutes } from './routes/supplier_routes'
import { createSupplierSyncRouter } from './routes/supplier_sync_routes'
import { createPurchaseRoutes } from './routes/purchase_routes'
import { createPurchaseSyncRouter } from './routes/purchase_sync_routes'
import { createFinanceRoutes } from './routes/finance_routes'
import { createFinanceReportingRoutes } from './routes/finance_reporting_routes'
import { createReceivableRoutes } from './routes/receivable_routes'
import { createPayableRoutes } from './routes/payable_routes'
import { createExpenseRoutes } from './routes/expense_routes'
import { createIncomeRoutes } from './routes/income_routes'
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
      'X-Request-ID',
      'Idempotency-Key',
      'X-Auth-Context'
    ],
    exposedHeaders: ['X-Request-Id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  }))
  app.use(express.json({ limit: '2mb' }))

  app.use(requestId)
  app.use(httpLogger)

  const jwtSecret = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
  const jwtIssuer = process.env.JWT_ISSUER || 'biz-erp-api'
  const jwtAudience = process.env.JWT_AUDIENCE || 'biz-erp-client'
  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)

  app.use('/health', createHealthRouter(pool))
  app.use('/v1', createRequireActiveTenant(jwtService, pool))
  app.use('/v1/auth', createAuthRouter(pool))

  const requireERP = requireEntitlement(jwtService, pool, 'ERP')

  app.use('/v1/sync/products', requireERP, createProductSyncRouter(pool))
  app.use('/v1/products', requireERP, createProductRoutes(pool))
  app.use('/v1/sync/sales', requireERP, createSalesSyncRouter(pool))
  app.use('/v1/branches', requireERP, createBranchRoutes(pool))
  app.use('/v1/inventory', requireERP, createInventoryRoutes(pool))
  app.use('/v1/customers', requireERP, createCustomerRoutes(pool))
  app.use('/v1/users', requireERP, createUsersRoutes(pool))
  app.use('/v1/dashboard', requireERP, createDashboardRoutes(pool))
  app.use('/v1/reports', requireERP, createReportsRoutes(pool))
  app.use('/v1/sync/customers', requireERP, createCustomerSyncRouter(pool))
  app.use('/v1/media', requireERP, createMediaRoutes(pool))
  app.use('/v1/settings', requireERP, createStoreSettingsRoutes(pool))
  app.use('/v1/suppliers', requireERP, createSupplierRoutes(pool))
  app.use('/v1/sync/suppliers', requireERP, createSupplierSyncRouter(pool))
  app.use('/v1/purchases', requireERP, createPurchaseRoutes(pool))
  app.use('/v1/sync/purchases', requireERP, createPurchaseSyncRouter(pool))

  app.use('/v1/finance', requireERP, createFinanceRoutes(pool))
  app.use('/v1/finance/reports', requireERP, createFinanceReportingRoutes(pool))
  app.use('/v1/receivables', requireERP, createReceivableRoutes(pool))
  app.use('/v1/payables', requireERP, createPayableRoutes(pool))
  app.use('/v1/expenses', requireERP, createExpenseRoutes(pool))
  app.use('/v1/incomes', requireERP, createIncomeRoutes(pool))

  app.use('/v1/subscriptions', createSubscriptionRoutes(pool))
  app.use('/v1/provisioning', createProvisioningRoutes(pool))
  app.use('/v1/isp', createIspRoutes(pool))
  app.use('/v1/ai-cs', createAiCsRoutes(pool))
  app.use('/v1/platform/webhooks', createPlatformWebhookRoutes(pool))
  app.use('/v1/platform', createPlatformRoutes(pool))
  app.use('/v1/public', createPublicRoutes(pool))

  app.use(notFound)
  app.use(errorHandler)

  return app
}
