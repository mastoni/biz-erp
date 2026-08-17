import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import request from 'supertest'
import * as Sentry from '@sentry/node'
import { Express } from 'express'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { loadEnv } from '../src/config/env'
import { logger } from '../src/utils/logger'

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  close: vi.fn().mockResolvedValue(true)
}))

describe('Phase 4.0.14G.2 SENTRY BACKEND INTEGRATION', () => {
  let app: Express
  let pool: Pool

  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://bizerp:bizerp@localhost:54320/bizerp'
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long'
    process.env.JWT_ISSUER = 'biz-erp-api'
    process.env.JWT_AUDIENCE = 'biz-erp-client'
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(async () => {
    if (pool) await pool.end()
  })

  it('SENTRY-001 No DSN => app starts and Sentry remains safely disabled', async () => {
    process.env.SENTRY_DSN = ''
    
    const env = loadEnv()
    env.sentryDsn = undefined
    
    const { initSentry } = await import('../src/utils/sentry?SENTRY-001')
    initSentry(env)
    
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('SENTRY-002 Valid DSN => initialized once (SENTRY-015 idempotent)', async () => {
    const env = loadEnv()
    env.sentryDsn = 'https://abc@sentry.io/123'
    
    const { initSentry } = await import('../src/utils/sentry?SENTRY-002')
    initSentry(env)
    initSentry(env)
    
    expect(Sentry.init).toHaveBeenCalledTimes(1)
  })

  it('SENTRY-003/004 Environment and Release correctly assigned', async () => {
    const env = loadEnv()
    env.sentryDsn = 'https://abc@sentry.io/123'
    env.sentryEnvironment = 'staging'
    env.sentryRelease = 'a1b2c3d4'
    
    const { initSentry } = await import('../src/utils/sentry?SENTRY-003')
    initSentry(env)
    
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
      dsn: 'https://abc@sentry.io/123',
      environment: 'staging',
      release: 'a1b2c3d4'
    }))
  })

  describe('PII Redaction (SENTRY-006, 007, 008, 009, 013, 014)', () => {
    let beforeSend: any
    
    beforeEach(async () => {
      const env = loadEnv()
      env.sentryDsn = 'https://test@sentry.io/123'
      const { initSentry } = await import('../src/utils/sentry?REDACTION')
      initSentry(env)
      
      const args = vi.mocked(Sentry.init).mock.calls[0]?.[0] as any
      beforeSend = args?.beforeSend
    })

    it('redacts correctly via beforeSend', () => {
      expect(beforeSend).toBeDefined()
      
      const mockEvent: any = {
        request: {
          headers: {
            'authorization': 'Bearer xyz123',
            'cookie': 'session=secret',
            'x-request-id': 'uuid-123'
          },
          data: {
            password: 'my-super-secret-password',
            nested: {
              refresh_token: 'refresh-xyz',
              database_url: 'postgres://user:pass@host/db',
              safe_field: 'hello'
            }
          }
        },
        breadcrumbs: [
          { message: 'Connecting to postgres://user:pass@host/db' },
          { data: { password_hash: 'bcrypt-hash' } }
        ]
      }
      
      const result = beforeSend(mockEvent)
      
      expect(result.request.headers.authorization).toBe('[REDACTED]')
      expect(result.request.headers.cookie).toBe('[REDACTED]')
      expect(result.request.headers['x-request-id']).toBe('uuid-123')
      
      expect(result.request.data.password).toBe('[REDACTED]')
      expect(result.request.data.nested.refresh_token).toBe('[REDACTED]')
      expect(result.request.data.nested.database_url).toBe('[REDACTED]')
      expect(result.request.data.nested.safe_field).toBe('hello')
      
      expect(result.breadcrumbs[0].message).toBe('[REDACTED]')
      expect(result.breadcrumbs[1].data.password_hash).toBe('[REDACTED]')
    })
  })

  describe('Integration with Express (SENTRY-005, 010, 011, 012, 016)', () => {
    beforeEach(async () => {
      process.env.SENTRY_DSN = 'https://fake@sentry.io/123'
      pool = createPool(process.env.DATABASE_URL || 'postgres://bizerp:bizerp@localhost:54320/bizerp')
      app = createApp(pool)
    })

    it('SENTRY-010 400/401/403/404 not captured as unexpected exceptions', async () => {
      await request(app).post('/v1/auth/login').send({ invalid: 'body' })
      await request(app).post('/v1/auth/refresh').send({ refresh_token: 'invalid' })
      await request(app).get('/v1/sync/invalid_route')
      
      expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('SENTRY-005, SENTRY-011, SENTRY-012, SENTRY-016 500 captured exactly once with request_id', async () => {
      const pinoSpy = vi.spyOn(logger, 'error')
      vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('FATAL_DB_ERROR'))
      
      const reqId = '123e4567-e89b-42d3-a456-426614174002'
      
      const res = await request(app)
        .post('/v1/auth/login')
        .set('x-request-id', reqId)
        .send({ email: 'owner@businessa.com', password: 'ValidPassword123!' })
        
      expect(res.status).toBe(500)
      
      expect(res.body.error.message).toBe('Internal server error')
      expect(JSON.stringify(res.body)).not.toContain('FATAL_DB_ERROR')
      
      expect(Sentry.captureException).toHaveBeenCalledTimes(1)
      
      expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({
        tags: { request_id: reqId }
      }))
      
      expect(pinoSpy).toHaveBeenCalledWith(expect.objectContaining({
        request_id: reqId
      }))
    })
  })
})
