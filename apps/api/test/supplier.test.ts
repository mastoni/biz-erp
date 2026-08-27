import path from 'path'
import { randomUUID, createHash } from 'crypto'
import type { Express } from 'express'
import { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { seedTestUser, authenticateTestUser } from './auth_helper'
import { generateSupplierCode } from '../src/dto/supplier_dto'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUSINESS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUSINESS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

// Valid enum values from blueprint
const VALID_TERMS = ['Tunai', 'Tempo 14', 'Tempo 30'] as const
const VALID_STATUSES = ['aktif', 'nonaktif'] as const

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let pool!: Pool
let app!: Express
let ownerTokenA!: string
let cashierTokenA!: string
let ownerTokenB!: string

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      idempotency_keys,
      suppliers,
      customers,
      sale_items,
      sales,
      products,
      stocks,
      stock_movements,
      branches,
      refresh_tokens,
      user_businesses,
      users,
      businesses
    RESTART IDENTITY CASCADE
  `)

  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, $2), ($3, $4) ON CONFLICT (id) DO NOTHING`,
    [BUSINESS_A, 'Business A', BUSINESS_B, 'Business B']
  )
}

async function seedSupplier(
  businessId: string,
  options: {
    name?: string
    code?: string
    contact?: string | null
    phone?: string | null
    email?: string | null
    category?: string | null
    term?: 'Tunai' | 'Tempo 14' | 'Tempo 30'
    status?: 'aktif' | 'nonaktif'
    serverVersion?: number
  } = {}
): Promise<string> {
  const id = randomUUID()
  const serverVersion = options.serverVersion ?? 1
  const name = options.name ?? `Supplier ${id.slice(0, 8)}`
  const code = options.code ?? generateSupplierCode(name)
  await pool.query(
    `INSERT INTO suppliers (id, business_id, code, name, contact, phone, email, category, term, status, server_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())`,
    [
      id,
      businessId,
      code,
      name,
      options.contact ?? null,
      options.phone ?? null,
      options.email ?? null,
      options.category ?? null,
      options.term ?? 'Tunai',
      options.status ?? 'aktif',
      serverVersion,
    ]
  )
  return id
}

// ---------------------------------------------------------------------------
// Request hash helpers (must match server-side canonical computation)
// ---------------------------------------------------------------------------

function computeCreateHash(body: Record<string, any>): string {
  const hashStr = `create|${body.business_id}|${body.id}|${body.name}|${body.contact ?? 'null'}|${body.phone ?? 'null'}|${body.email ?? 'null'}|${body.category ?? 'null'}|${body.term ?? 'Tunai'}|${body.status ?? 'aktif'}`
  return createHash('sha256').update(hashStr).digest('hex')
}

function computeUpdateHash(body: Record<string, any>, supplierId: string): string {
  const hashStr = `update|${body.business_id}|${supplierId}|${body.expected_server_version}|${body.name ?? 'null'}|${body.contact ?? 'null'}|${body.phone ?? 'null'}|${body.email ?? 'null'}|${body.category ?? 'null'}|${body.term ?? 'null'}|${body.status ?? 'null'}`
  return createHash('sha256').update(hashStr).digest('hex')
}

function computeDeleteHash(businessId: string, supplierId: string): string {
  const hashStr = `delete|${businessId}|${supplierId}`
  return createHash('sha256').update(hashStr).digest('hex')
}

// Helper for legacy tests that want valid requests without manual idempotency
function makeCreateBody(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: randomUUID(),
    business_id: BUSINESS_A,
    name: 'Test Supplier',
    contact: null,
    phone: null,
    email: null,
    category: null,
    term: 'Tunai',
    status: 'aktif',
    ...overrides,
  }
}

function makeUpdateBody(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    business_id: BUSINESS_A,
    expected_server_version: 1,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for integration tests')
  }
  pool = createPool(databaseUrl)
  await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
  app = createApp(pool)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await resetDatabase()

  // OWNER for Business A
  const ownerA = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
  const authOwnerA = await authenticateTestUser(app, ownerA.email, ownerA.password, BUSINESS_A)
  ownerTokenA = authOwnerA.accessToken

  // CASHIER for Business A
  const cashierA = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER' })
  const authCashierA = await authenticateTestUser(app, cashierA.email, cashierA.password, BUSINESS_A)
  cashierTokenA = authCashierA.accessToken

  // OWNER for Business B
  const ownerB = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER' })
  const authOwnerB = await authenticateTestUser(app, ownerB.email, ownerB.password, BUSINESS_B)
  ownerTokenB = authOwnerB.accessToken
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 9A — Supplier API', () => {

  // ---- SUPPLIER-001: OWNER can create supplier ----
  it('SUPPLIER-001 OWNER can create supplier', async () => {
    const body = makeCreateBody({ name: 'UD Makmur Sembako', contact: 'Pak Darmawan', phone: '0812-2745-9012', email: 'order@makmur.id', category: 'Sembako' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .post('/v1/suppliers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(201)

    expect(res.body.id).toBe(body.id)
    expect(res.body.business_id).toBe(BUSINESS_A)
    expect(res.body.name).toBe('UD Makmur Sembako')
    expect(res.body.code).toBe('UMS')
    expect(res.body.contact).toBe('Pak Darmawan')
    expect(res.body.phone).toBe('0812-2745-9012')
    expect(res.body.email).toBe('order@makmur.id')
    expect(res.body.category).toBe('Sembako')
    expect(res.body.term).toBe('Tunai')
    expect(res.body.status).toBe('aktif')
    expect(res.body.server_version).toBe(1)
    expect(res.body.created_at).toBeDefined()
    expect(res.body.updated_at).toBeDefined()
    expect(res.body.deleted_at).toBeNull()
    // P0 contract: NO balance/rating/lastOrder fields
    expect(res.body).not.toHaveProperty('balance')
    expect(res.body).not.toHaveProperty('rating')
    expect(res.body).not.toHaveProperty('last_order')
    expect(res.body).not.toHaveProperty('lastOrder')
  })

  // ---- SUPPLIER-002: OWNER can read supplier ----
  it('SUPPLIER-002 OWNER can read supplier by id', async () => {
    const id = await seedSupplier(BUSINESS_A, { name: 'CV Tirta Kencana', code: 'TRK' })

    const res = await request(app)
      .get(`/v1/suppliers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.id).toBe(id)
    expect(res.body.business_id).toBe(BUSINESS_A)
    expect(res.body.code).toBe('TRK')
    expect(res.body.name).toBe('CV Tirta Kencana')
    expect(res.body.term).toBe('Tunai')
    expect(res.body.status).toBe('aktif')
  })

  // ---- SUPPLIER-003: OWNER can list suppliers ----
  it('SUPPLIER-003 OWNER can list suppliers', async () => {
    await seedSupplier(BUSINESS_A, { name: 'UD Makmur Sembako' })
    await seedSupplier(BUSINESS_A, { name: 'CV Tirta Kencana', term: 'Tempo 14' })

    const res = await request(app)
      .get(`/v1/suppliers?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items).toHaveLength(2)
    expect(typeof res.body.total).toBe('number')
    expect(res.body.total).toBe(2)
    expect(typeof res.body.limit).toBe('number')
    expect(typeof res.body.offset).toBe('number')
    expect(typeof res.body.has_more).toBe('boolean')
    expect(res.body.summary).toBeDefined()
    expect(res.body.summary.total_suppliers).toBe(2)
    expect(res.body.summary.active_suppliers).toBe(2)
    expect(res.body.summary.inactive_suppliers).toBe(0)
  })

  // ---- SUPPLIER-004: OWNER can update supplier ----
  it('SUPPLIER-004 OWNER can update supplier', async () => {
    const id = await seedSupplier(BUSINESS_A, { name: 'UD Makmur Sembako', term: 'Tunai' })

    const body = makeUpdateBody({ name: 'UD Makmur Sembako Updated', term: 'Tempo 30' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .put(`/v1/suppliers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(200)

    expect(res.body.id).toBe(id)
    expect(res.body.name).toBe('UD Makmur Sembako Updated')
    expect(res.body.term).toBe('Tempo 30')
    expect(res.body.server_version).toBe(2)
  })

  // ---- SUPPLIER-005: DELETE = soft delete ----
  it('SUPPLIER-005 DELETE soft-deletes supplier', async () => {
    const id = await seedSupplier(BUSINESS_A, { name: 'UD Makmur Sembako' })
    const idempotencyKey = randomUUID()

    await request(app)
      .delete(`/v1/suppliers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .expect(204)

    // Confirm it's gone from detail
    await request(app)
      .get(`/v1/suppliers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(404)
  })

  // ---- SUPPLIER-006: deleted supplier absent from normal list ----
  it('SUPPLIER-006 soft-deleted supplier excluded from list', async () => {
    const toDelete = await seedSupplier(BUSINESS_A, { name: 'UD Makmur Sembako' })
    await seedSupplier(BUSINESS_A, { name: 'CV Tirta Kencana' })

    const idempotencyKey = randomUUID()
    await request(app)
      .delete(`/v1/suppliers/${toDelete}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .expect(204)

    const res = await request(app)
      .get(`/v1/suppliers?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.total).toBe(1)
    expect(res.body.items[0].name).toBe('CV Tirta Kencana')
  })

  // ---- SUPPLIER-007: tenant isolation ----
  it('SUPPLIER-007 Business A cannot see Business B suppliers in list', async () => {
    await seedSupplier(BUSINESS_A, { name: 'Supplier A' })
    await seedSupplier(BUSINESS_B, { name: 'Supplier B' })

    const res = await request(app)
      .get(`/v1/suppliers?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].name).toBe('Supplier A')
  })

  // ---- SUPPLIER-008: foreign tenant mutation blocked ----
  it('SUPPLIER-008 Business B supplier cannot be mutated by Business A owner', async () => {
    const idInB = await seedSupplier(BUSINESS_B, { name: 'Supplier B' })

    const body = makeUpdateBody({ name: 'Hacked', business_id: BUSINESS_B })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .put(`/v1/suppliers/${idInB}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(403)

    expect(res.body.error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  // ---- SUPPLIER-009: CASHIER read allowed ----
  it('SUPPLIER-009 CASHIER can read suppliers', async () => {
    await seedSupplier(BUSINESS_A, { name: 'Supplier For Cashier' })

    const res = await request(app)
      .get(`/v1/suppliers?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].name).toBe('Supplier For Cashier')
  })

  // ---- SUPPLIER-010: CASHIER mutation blocked ----
  it('SUPPLIER-010 CASHIER cannot create supplier', async () => {
    const body = makeCreateBody({ name: 'Cashier Supplier' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .post('/v1/suppliers')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(403)

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })

  // ---- SUPPLIER-011: OWNER mutation allowed ----
  it('SUPPLIER-011 OWNER can create, update, and delete', async () => {
    const id = randomUUID()
    const createBody = makeCreateBody({ id, name: 'OWNER Test Supplier' })
    const createKey = randomUUID()

    // Create
    await request(app)
      .post('/v1/suppliers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', createKey)
      .send(createBody)
      .expect(201)

    // Update
    const updateBody = makeUpdateBody({ name: 'OWNER Test Supplier Updated' })
    const updateKey = randomUUID()
    await request(app)
      .put(`/v1/suppliers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', updateKey)
      .send(updateBody)
      .expect(200)

    // Delete
    const deleteKey = randomUUID()
    await request(app)
      .delete(`/v1/suppliers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', deleteKey)
      .expect(204)
  })

  // ---- SUPPLIER-012: invalid UUID ----
  it('SUPPLIER-012 invalid supplier id returns 400', async () => {
    const body = makeCreateBody({ id: 'not-a-uuid' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .post('/v1/suppliers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.id).toBeDefined()
  })

  // ---- SUPPLIER-013: missing name ----
  it('SUPPLIER-013 empty name on create returns 400', async () => {
    const body = makeCreateBody({ name: '   ' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .post('/v1/suppliers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.name).toBeDefined()
  })

  // ---- SUPPLIER-014: invalid term ----
  it('SUPPLIER-014 invalid term on create returns 400', async () => {
    const body = makeCreateBody({ term: 'COD' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .post('/v1/suppliers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.term).toBeDefined()
  })

  // ---- SUPPLIER-015: invalid status ----
  it('SUPPLIER-015 invalid status on create returns 400', async () => {
    const body = makeCreateBody({ status: 'pending' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .post('/v1/suppliers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.status).toBeDefined()
  })

  // ---- SUPPLIER-016: idempotent create ----
  it('SUPPLIER-016 idempotent create returns same response on retry', async () => {
    const body = makeCreateBody({ name: 'Idempotent Supplier' })
    const idempotencyKey = randomUUID()

    // First request
    const res1 = await request(app)
      .post('/v1/suppliers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(201)

    // Second request with same key
    const res2 = await request(app)
      .post('/v1/suppliers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(201)

    expect(res2.body.id).toBe(res1.body.id)
    expect(res2.body.code).toBe(res1.body.code)
    expect(res2.body.name).toBe(res1.body.name)
  })

  // ---- SUPPLIER-017: idempotency key reuse conflict ----
  it('SUPPLIER-017 idempotency key reuse with different body returns 409', async () => {
    const body1 = makeCreateBody({ name: 'Supplier A' })
    const idempotencyKey = randomUUID()

    // First request — creates successfully
    await request(app)
      .post('/v1/suppliers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body1)
      .expect(201)

    // Second request — same key, different body
    const body2 = makeCreateBody({ name: 'Supplier B' })
    const res = await request(app)
      .post('/v1/suppliers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body2)
      .expect(409)

    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSE')
  })

  // ---- SUPPLIER-018: optimistic locking ----
  it('SUPPLIER-018 update with stale server_version returns 409 VERSION_CONFLICT', async () => {
    const id = await seedSupplier(BUSINESS_A, { name: 'Lock Test' })

    // Simulate concurrent modification: bump version directly
    await pool.query('UPDATE suppliers SET server_version = server_version + 1, name = \'Modified\' WHERE id = $1', [id])

    const body = makeUpdateBody({ expected_server_version: 1, name: 'Stale Update' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .put(`/v1/suppliers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(409)

    expect(res.body.error.code).toBe('SUPPLIER_VERSION_CONFLICT')
    expect(res.body.error.details.current_server_version).toBe(2)
  })

  // ---- SUPPLIER-019: server_version increments once ----
  it('SUPPLIER-019 server_version increments by exactly 1 on update', async () => {
    const id = await seedSupplier(BUSINESS_A, { name: 'Version Test', serverVersion: 5 })

    const body = makeUpdateBody({ expected_server_version: 5, name: 'Version Test Updated' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .put(`/v1/suppliers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(200)

    expect(res.body.server_version).toBe(6)
  })

  // ---- SUPPLIER-020: sync incremental pull ----
  it('SUPPLIER-020 sync returns items after version threshold', async () => {
    await seedSupplier(BUSINESS_A, { name: 'Supplier Old', serverVersion: 1 })
    await seedSupplier(BUSINESS_A, { name: 'Supplier New', serverVersion: 5 })

    const res = await request(app)
      .get(`/v1/sync/suppliers?business_id=${BUSINESS_A}&after_version=0`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items).toHaveLength(2)
    expect(res.body.current_version).toBe(5)
    expect(typeof res.body.has_more).toBe('boolean')
  })

  // ---- SUPPLIER-021: sync tombstone ----
  it('SUPPLIER-021 sync returns tombstone after soft delete', async () => {
    const id = await seedSupplier(BUSINESS_A, { name: 'To Be Deleted', serverVersion: 1 })

    // Soft-delete
    const idempotencyKey = randomUUID()
    await request(app)
      .delete(`/v1/suppliers/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .expect(204)

    // Sync should return the tombstone
    const res = await request(app)
      .get(`/v1/sync/suppliers?business_id=${BUSINESS_A}&after_version=0`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].id).toBe(id)
    expect(res.body.items[0].status).toBe('nonaktif')
    expect(res.body.items[0].deleted_at).not.toBeNull()
  })

  // ---- SUPPLIER-022: supplier code deterministic ----
  it('SUPPLIER-022 code is deterministically generated from name', async () => {
    expect(generateSupplierCode('UD Makmur Sembako')).toBe('UMS')
    expect(generateSupplierCode('CV Tirta Kencana')).toBe('CTK')
    expect(generateSupplierCode('PT Snack Nusantara')).toBe('PSN')
    expect(generateSupplierCode('UD Berkah Farm')).toBe('UBF')
    expect(generateSupplierCode('CV Sinar Higienis')).toBe('CSH')
    expect(generateSupplierCode('PT Griya Bersih')).toBe('PGB')
    expect(generateSupplierCode('UD Roti Melati')).toBe('URM')
    expect(generateSupplierCode('CV Kawista Jaya')).toBe('CKJ')

    // Verify created supplier has the deterministic code
    const body = makeCreateBody({ name: 'UD Makmur Sembako' })
    const idempotencyKey = randomUUID()

    const res = await request(app)
      .post('/v1/suppliers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(201)

    expect(res.body.code).toBe('UMS')
  })

  // ---- SUPPLIER-023: supplier code uniqueness / collision ----
  it('SUPPLIER-023 duplicate code returns 409 SUPPLIER_CODE_CONFLICT', async () => {
    // First supplier: "UD Makmur Sembako" → code "UMS"
    const body1 = makeCreateBody({ name: 'UD Makmur Sembako' })
    const key1 = randomUUID()
    await request(app)
      .post('/v1/suppliers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', key1)
      .send(body1)
      .expect(201)

    // Second supplier with different name but same generated code
    const body2 = makeCreateBody({ name: 'Ud Makmur Sembako' }) // same code "UMS"
    const key2 = randomUUID()
    const res = await request(app)
      .post('/v1/suppliers')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('Idempotency-Key', key2)
      .send(body2)
      .expect(409)

    expect(res.body.error.code).toBe('SUPPLIER_CODE_CONFLICT')
    expect(res.body.error.details.code).toBe('UMS')
  })

  // ---- X-Request-Id present ----
  it('X-Request-Id header present on supplier responses', async () => {
    const res = await request(app)
      .get(`/v1/suppliers?business_id=${BUSINESS_A}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)

    expect(res.headers['x-request-id']).toBeDefined()
    expect(typeof res.headers['x-request-id']).toBe('string')
    expect(res.headers['x-request-id'].length).toBeGreaterThan(0)
  })
})
