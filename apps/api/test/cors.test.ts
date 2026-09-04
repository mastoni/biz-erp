import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { randomUUID } from 'crypto'

const BUSINESS_A = '22222222-2222-4222-8222-222222222222'

describe('CORS Compatibility', () => {
  let pool: Pool

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long'
    process.env.JWT_ISSUER = 'test-issuer'
    process.env.JWT_AUDIENCE = 'test-audience'

    const databaseUrl = process.env.TEST_DATABASE_URL ?? (process.env.DATABASE_URL || 'postgres://bizerp:bizerp@localhost:54320/bizerp')
    process.env.DATABASE_URL = databaseUrl
    pool = createPool(databaseUrl)

    await pool.query(`
      INSERT INTO businesses (id, name)
      VALUES ($1, $2)
      ON CONFLICT (id) DO NOTHING
    `, [BUSINESS_A, 'CORS Test Business'])
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('development environment defaults', () => {
    let app: any
    let originalNodeEnv: string | undefined
    let originalCors: string | undefined

    beforeAll(() => {
      originalNodeEnv = process.env.NODE_ENV
      originalCors = process.env.CORS_ALLOWED_ORIGINS
      delete process.env.CORS_ALLOWED_ORIGINS
      process.env.NODE_ENV = 'development'
      app = createApp(pool)
    })

    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv
      process.env.CORS_ALLOWED_ORIGINS = originalCors
    })

    it('CORS-001: localhost:3000 allowed', async () => {
      const res = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
      expect(res.status).toBe(204)
    })

    it('CORS-005: credentialed request does not receive wildcard *', async () => {
      const res = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')

      expect(res.headers['access-control-allow-origin']).not.toBe('*')
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    })

    it('CORS-006: OPTIONS login preflight succeeds', async () => {
      const res = await request(app)
        .options('/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
      expect(res.headers['access-control-allow-credentials']).toBe('true')
      expect(res.status).toBe(204)
    })

    it('CORS-007: OPTIONS refresh preflight succeeds', async () => {
      const res = await request(app)
        .options('/v1/auth/refresh')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
      expect(res.headers['access-control-allow-credentials']).toBe('true')
      expect(res.status).toBe(204)
    })

    it('CORS-008: X-Request-ID exposed', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000')

      expect(res.headers['access-control-expose-headers']).toContain('X-Request-Id')
      expect(res.headers['x-request-id']).toBeDefined()
    })

    it('CORS-009: Authorization allowed request header', async () => {
      const res = await request(app)
        .options('/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Authorization, Content-Type, X-Client-Type, X-Request-ID')

      const allowHeaders = res.headers['access-control-allow-headers']
      expect(allowHeaders).toContain('Authorization')
      expect(allowHeaders).toContain('Content-Type')
      expect(res.status).toBe(204)
    })

    it('CORS-010: credentials=true', async () => {
      const res = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')

      expect(res.headers['access-control-allow-credentials']).toBe('true')
    })

    it('CORS-004: unknown origin rejected', async () => {
      const res = await request(app)
        .options('/health')
        .set('Origin', 'https://evil.example.com')
        .set('Access-Control-Request-Method', 'GET')

      expect(res.headers['access-control-allow-origin']).toBeUndefined()
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('CORS-011: null origin rejected', async () => {
      const res = await request(app)
        .options('/health')
        .set('Origin', 'null')
        .set('Access-Control-Request-Method', 'GET')

      expect(res.headers['access-control-allow-origin']).toBeUndefined()
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('CORS-012: no-Origin request allowed', async () => {
      const res = await request(app)
        .get('/health')

      expect(res.headers['access-control-allow-origin']).toBeUndefined()
      expect(res.status).toBe(200)
    })
  })

  describe('staging environment defaults', () => {
    let app: any
    let originalNodeEnv: string | undefined
    let originalCors: string | undefined
    let originalDbUrl: string | undefined

    beforeAll(() => {
      originalNodeEnv = process.env.NODE_ENV
      originalCors = process.env.CORS_ALLOWED_ORIGINS
      originalDbUrl = process.env.DATABASE_URL
      process.env.NODE_ENV = 'staging'
      process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000,https://staging-erp.skmnetwork.com'
      process.env.DATABASE_URL = 'postgres://bizerp:bizerp@localhost:54320/bizerp_staging'
      app = createApp(pool)
    })

    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv
      process.env.CORS_ALLOWED_ORIGINS = originalCors
      process.env.DATABASE_URL = originalDbUrl
    })

    it('CORS-002: staging ERP origin allowed', async () => {
      const res = await request(app)
        .options('/health')
        .set('Origin', 'https://staging-erp.skmnetwork.com')
        .set('Access-Control-Request-Method', 'GET')

      expect(res.headers['access-control-allow-origin']).toBe('https://staging-erp.skmnetwork.com')
      expect(res.status).toBe(204)
    })
  })

  describe('production environment defaults', () => {
    let app: any
    let originalNodeEnv: string | undefined
    let originalCors: string | undefined

    beforeAll(() => {
      originalNodeEnv = process.env.NODE_ENV
      originalCors = process.env.CORS_ALLOWED_ORIGINS
      process.env.NODE_ENV = 'production'
      delete process.env.CORS_ALLOWED_ORIGINS
      app = createApp(pool)
    })

    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv
      process.env.CORS_ALLOWED_ORIGINS = originalCors
    })

    it('CORS-003: production ERP origin allowed', async () => {
      const res = await request(app)
        .options('/health')
        .set('Origin', 'https://erp.skmnetwork.com')
        .set('Access-Control-Request-Method', 'GET')

      expect(res.headers['access-control-allow-origin']).toBe('https://erp.skmnetwork.com')
      expect(res.status).toBe(204)
    })

    it('CORS-013: production landing apex origin allowed', async () => {
      const res = await request(app)
        .options('/v1/public/showcase?section=ERP_PLANS')
        .set('Origin', 'https://skmnetwork.com')
        .set('Access-Control-Request-Method', 'GET')

      expect(res.headers['access-control-allow-origin']).toBe('https://skmnetwork.com')
      expect(res.status).toBe(204)
    })

    it('CORS-014: production landing www origin allowed', async () => {
      const res = await request(app)
        .options('/v1/public/showcase?section=ERP_PLANS')
        .set('Origin', 'https://www.skmnetwork.com')
        .set('Access-Control-Request-Method', 'GET')

      expect(res.headers['access-control-allow-origin']).toBe('https://www.skmnetwork.com')
      expect(res.status).toBe(204)
    })

    it('CORS-015: unauthorized origin rejected in production', async () => {
      const res = await request(app)
        .get('/v1/public/showcase?section=ERP_PLANS')
        .set('Origin', 'https://unauthorized-domain.com')

      expect(res.headers['access-control-allow-origin']).toBeUndefined()
      expect(res.status).toBe(500)
    })
  })
})
