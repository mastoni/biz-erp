export interface Env {
  port: number
  databaseUrl: string
  nodeEnv: string
}

export function loadEnv(): Env {
  const port = Number(process.env.PORT || 8080)
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  return {
    port,
    databaseUrl,
    nodeEnv: process.env.NODE_ENV || 'development'
  }
}
