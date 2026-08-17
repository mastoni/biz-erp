import pino from 'pino'
import pinoHttp from 'pino-http'
import { randomUUID } from 'crypto'

const isDev = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging' && process.env.NODE_ENV !== 'test'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: '@biz-erp/api'
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard'
    }
  } : undefined,
  redact: {
    paths: [
      'password',
      'password_hash',
      'access_token',
      'refresh_token',
      'authorization',
      'cookie',
      'JWT_SECRET',
      'DATABASE_URL',
      'POSTGRES_PASSWORD',
      'req.headers.authorization',
      'req.headers.Authorization',
      'req.headers.cookie',
      'req.headers.access_token',
      'req.headers.refresh_token',
      'req.body',
      'res.body',
      '*.password',
      '*.password_hash',
      '*.access_token',
      '*.refresh_token',
      '*.authorization',
      '*.cookie',
      '*.JWT_SECRET',
      '*.DATABASE_URL',
      '*.POSTGRES_PASSWORD'
    ],
    censor: '[REDACTED]'
  }
})

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    return (res.getHeader('x-request-id') as string) || (req.headers['x-request-id'] as string) || randomUUID()
  },
  customProps: (req, res) => {
    return {
      request_id: res.getHeader('x-request-id')
    }
  },
  autoLogging: {
    ignore: (req) => req.url === '/health'
  }
})
