import { Pool, PoolClient } from 'pg'

export interface Business {
  id: string
  name: string
  created_at: string
}

export interface BusinessRepository {
  create(client: PoolClient, id: string, name: string): Promise<Business>
}

export function createBusinessRepository(pool: Pool): BusinessRepository {
  return {
    async create(client: PoolClient, id: string, name: string): Promise<Business> {
      const result = await client.query(
        `INSERT INTO businesses (id, name, created_at)
         VALUES ($1, $2, now())
         RETURNING id, name, created_at`,
        [id, name]
      )
      return result.rows[0] as Business
    }
  }
}
