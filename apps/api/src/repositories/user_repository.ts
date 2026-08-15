import { Pool } from 'pg'

export interface PublicUser {
  id: string
  email: string
  status: string
  created_at: string
  updated_at: string
}

export interface InternalUser extends PublicUser {
  password_hash: string
}

export interface UserRepository {
  findByEmail(email: string): Promise<InternalUser | null>
  findById(id: string): Promise<PublicUser | null>
}

export function createUserRepository(pool: Pool): UserRepository {
  return {
    async findByEmail(email: string): Promise<InternalUser | null> {
      const normalizedEmail = email.trim().toLowerCase()
      const result = await pool.query(
        `SELECT id, email, password_hash, status, created_at, updated_at
         FROM users
         WHERE email = $1`,
        [normalizedEmail]
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as InternalUser
    },

    async findById(id: string): Promise<PublicUser | null> {
      const result = await pool.query(
        `SELECT id, email, status, created_at, updated_at
         FROM users
         WHERE id = $1`,
        [id]
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as PublicUser
    }
  }
}
