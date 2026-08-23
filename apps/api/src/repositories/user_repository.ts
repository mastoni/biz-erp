import { Pool, PoolClient } from 'pg'

export type PlatformRole = 'PLATFORM_ADMIN' | 'SUPER_ADMIN'

export interface PublicUser {
  id: string
  email: string
  status: string
  created_at: string
  updated_at: string
  platformRole: PlatformRole | null
}

export interface InternalUser extends PublicUser {
  password_hash: string
}

export interface BusinessUser {
  id: string
  email: string
  status: string
  created_at: string
  updated_at: string
  role: 'OWNER' | 'CASHIER'
}

export interface UserRepository {
  findByEmail(email: string): Promise<InternalUser | null>
  findById(client: Pool | PoolClient, id: string): Promise<PublicUser | null>
  findByBusiness(client: PoolClient, businessId: string): Promise<BusinessUser[]>
}

export function createUserRepository(pool: Pool): UserRepository {
  return {
    async findByEmail(email: string): Promise<InternalUser | null> {
      const normalizedEmail = email.trim().toLowerCase()
      const result = await pool.query(
        `SELECT id, email, password_hash, status, created_at, updated_at, platform_role
         FROM users
         WHERE email = $1`,
        [normalizedEmail]
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as InternalUser
    },

    async findById(client: Pool | PoolClient, id: string): Promise<PublicUser | null> {
      const result = await client.query(
        `SELECT id, email, status, created_at, updated_at, platform_role
         FROM users
         WHERE id = $1`,
        [id]
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as PublicUser
    },

    async findByBusiness(client: PoolClient, businessId: string): Promise<BusinessUser[]> {
      const result = await client.query(
        `SELECT u.id, u.email, u.status, u.created_at, u.updated_at, ub.role
         FROM users u
         JOIN user_businesses ub ON ub.user_id = u.id
         WHERE ub.business_id = $1
           AND ub.status = 'ACTIVE'
           AND u.status = 'ACTIVE'
         ORDER BY u.created_at ASC`,
        [businessId]
      )

      return result.rows as BusinessUser[]
    }
  }
}