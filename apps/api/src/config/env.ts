export interface Env {
  port: number
  databaseUrl: string
  nodeEnv: string
}

export function loadEnv(): Env {
  const port = Number(process.env.PORT || 8080)
  const databaseUrl = process.env.DATABASE_URL
  const nodeEnv = process.env.NODE_ENV || 'development'

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  // Safety checks
  if (nodeEnv === 'staging') {
    if (!databaseUrl.includes('staging') || databaseUrl.includes('production')) {
      throw new Error('DATABASE_URL safety check failed: staging environment requires a staging database url')
    }
  }

  return {
    port,
    databaseUrl,
    nodeEnv
  }
}
