export interface Env {
  port: number
  databaseUrl: string
  nodeEnv: string
  corsAllowedOrigins: string[]
  sentryDsn?: string
  sentryEnvironment: string
  sentryRelease?: string
  sentryTracesSampleRate: number
  sentryProfilesSampleRate: number
}

export function loadEnv(): Env {
  const port = Number(process.env.PORT || 8080)
  const databaseUrl = process.env.DATABASE_URL
  const nodeEnv = process.env.NODE_ENV || 'development'

  const corsOriginsEnv = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean)

  let defaultCorsOrigins: string[]
  if (nodeEnv === 'production') {
    defaultCorsOrigins = ['https://erp.skmnetwork.com']
  } else if (nodeEnv === 'staging') {
    defaultCorsOrigins = ['http://localhost:3000', 'https://staging-erp.skmnetwork.com']
  } else {
    defaultCorsOrigins = ['http://localhost:3000']
  }

  const corsAllowedOrigins = corsOriginsEnv.length > 0 ? corsOriginsEnv : defaultCorsOrigins

  const sentryDsn = process.env.SENTRY_DSN
  const sentryEnvironment = process.env.SENTRY_ENVIRONMENT || nodeEnv
  const sentryRelease = process.env.SENTRY_RELEASE
  
  let sentryTracesSampleRate = 0
  if (process.env.SENTRY_TRACES_SAMPLE_RATE) {
    const parsed = Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      sentryTracesSampleRate = parsed
    }
  } else if (nodeEnv === 'production') {
    sentryTracesSampleRate = 0.05
  } else if (nodeEnv === 'staging') {
    sentryTracesSampleRate = 0.1
  }
  
  let sentryProfilesSampleRate = 0
  if (process.env.SENTRY_PROFILES_SAMPLE_RATE) {
    const parsed = Number(process.env.SENTRY_PROFILES_SAMPLE_RATE)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      sentryProfilesSampleRate = parsed
    }
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  // Safety checks
  if (nodeEnv === 'staging') {
    if (!databaseUrl.includes('staging') || databaseUrl.includes('production')) {
      throw new Error('DATABASE_URL safety check failed: staging environment requires a staging database url')
    }
  }

  if (nodeEnv === 'production') {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET must be set in the environment in production')
    }
  }

  return {
    port,
    databaseUrl,
    nodeEnv,
    corsAllowedOrigins,
    sentryDsn,
    sentryEnvironment,
    sentryRelease,
    sentryTracesSampleRate,
    sentryProfilesSampleRate
  }
}
