import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { Express } from 'express'
import fs from 'fs'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { logger } from '../src/utils/logger'

class MemoryStream {
  public logs: any[] = []
  
  write(chunk: any) {
    this.logs.push(JSON.parse(chunk.toString()))
  }
  
  clear() {
    this.logs = []
  }
}

describe('Phase 4.0.14G.1 Observability and Logging', () => {
  let app: Express
  let pool: Pool
  let memoryStream: MemoryStream
  let originalWriteSync: any

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-at-least-32-chars-long'
    process.env.JWT_ISSUER = process.env.JWT_ISSUER || 'biz-erp-api'
    process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'biz-erp-client'
    const databaseUrl = process.env.TEST_DATABASE_URL ?? (process.env.DATABASE_URL || 'postgres://bizerp:bizerp@localhost:54320/bizerp')
    process.env.DATABASE_URL = databaseUrl
    pool = createPool(databaseUrl)
    app = createApp(pool)

    memoryStream = new MemoryStream()

    originalWriteSync = fs.writeSync
    // @ts-ignore
    fs.writeSync = function (fd: number, buffer: any, ...args: any[]) {
      if (fd === 1 || fd === 2) {
        try {
          const str = buffer.toString()
          if (str.startsWith('{')) {
            memoryStream.logs.push(JSON.parse(str))
          }
        } catch (e) {}
      }
      return originalWriteSync(fd, buffer, ...args)
    }
  })

  beforeEach(() => {
    if (memoryStream) memoryStream.clear()
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    if (originalWriteSync) {
      fs.writeSync = originalWriteSync
    }
    await pool.end()
  })

  it('OBS-LOG-001 valid UUIDv4 X-Request-ID is preserved', async () => {
    const id = '123e4567-e89b-42d3-a456-426614174000'
    const res = await request(app)
      .get('/health')
      .set('x-request-id', id)
      
    expect(res.status).toBe(200)
    expect(res.headers['x-request-id']).toBe(id)
  })

  it('OBS-LOG-002 invalid X-Request-ID is replaced', async () => {
    const id = 'invalid-id!@#'
    const res = await request(app)
      .get('/health')
      .set('x-request-id', id)
      
    expect(res.status).toBe(200)
    expect(res.headers['x-request-id']).not.toBe(id)
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('OBS-LOG-003 missing X-Request-ID generates one', async () => {
    const res = await request(app)
      .get('/health')
      
    expect(res.status).toBe(200)
    expect(res.headers['x-request-id']).toBeDefined()
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('OBS-LOG-004 response contains canonical X-Request-ID', async () => {
    const res = await request(app)
      .get('/health')
    expect(res.headers['x-request-id']).toBeDefined()
  })

  it('OBS-LOG-005 password never appears in captured logs', async () => {
    memoryStream.clear()
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'owner@businessa.com', password: 'SuperSecretPassword123!' })
      
    const logStr = JSON.stringify(memoryStream.logs)
    expect(logStr).not.toContain('SuperSecretPassword123!')
  })

  it('OBS-LOG-006 Authorization/JWT never appears in logs', async () => {
    memoryStream.clear()
    const res = await request(app)
      .get('/v1/sync/products')
      .set('Authorization', 'Bearer THIS_IS_A_SECRET_JWT_TOKEN')
      
    const logStr = JSON.stringify(memoryStream.logs)
    expect(logStr).not.toContain('THIS_IS_A_SECRET_JWT_TOKEN')
  })

  it('OBS-LOG-007 DATABASE_URL / database credentials never appear in logs', async () => {
    memoryStream.clear()
    await request(app)
      .post('/v1/auth/login')
      .send({ DATABASE_URL: 'postgres://secret:password@host/db' })
      
    const logStr = JSON.stringify(memoryStream.logs)
    expect(logStr).not.toContain('postgres://secret:password@host/db')
  })

  it('OBS-LOG-008 500 error log includes request_id', async () => {
    vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('SIMULATED_DB_CRASH'))
    const errorSpy = vi.spyOn(logger, 'error')
    
    const reqId = '123e4567-e89b-42d3-a456-426614174001'
    const res = await request(app)
      .post('/v1/auth/login')
      .set('x-request-id', reqId)
      .send({ email: 'test@test.com', password: 'test' })

    expect(res.status).toBe(500)
    
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'Unhandled internal error',
        request_id: reqId,
        err: expect.any(Error)
      })
    )
  })

  it('OBS-LOG-009 client response does not expose stack trace', async () => {
    vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('SIMULATED_DB_CRASH'))

    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'test@test.com', password: 'test' })

    expect(res.status).toBe(500)
    expect(res.body.error).toBeDefined()
    expect(res.body.error.message).toBe('Internal server error')
    expect(JSON.stringify(res.body)).not.toContain('SIMULATED_DB_CRASH')
    expect(JSON.stringify(res.body)).not.toContain('Error:')
    expect(JSON.stringify(res.body)).not.toContain('node_modules')
  })
})
