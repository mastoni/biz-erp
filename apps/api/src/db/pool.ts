import { Pool, types } from 'pg'

// Parse PostgreSQL BIGINT (OID 20) into JavaScript number.
// BizERP values such as price_minor are expected to remain within Number.MAX_SAFE_INTEGER.
types.setTypeParser(20, (value) => parseInt(value, 10))

export function createPool(connectionString?: string): Pool {
  return new Pool({
    connectionString: connectionString ?? process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000
  })
}
