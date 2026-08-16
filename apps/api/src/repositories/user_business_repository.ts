import { Pool } from 'pg'

export interface UserBusinessMembership {
  user_id: string
  business_id: string
  role: string
  status: string
  created_at: string
  updated_at: string
  business_name: string
}

export interface UserBusinessRepository {
  findActiveMembership(userId: string, businessId: string): Promise<UserBusinessMembership | null>
  listActiveBusinesses(userId: string): Promise<UserBusinessMembership[]>
}

export function createUserBusinessRepository(pool: Pool): UserBusinessRepository {
  return {
    async findActiveMembership(userId: string, businessId: string): Promise<UserBusinessMembership | null> {
      const result = await pool.query(
        `SELECT ub.user_id, ub.business_id, ub.role, ub.status, ub.created_at, ub.updated_at, b.name as business_name
         FROM user_businesses ub
         JOIN users u ON u.id = ub.user_id
         JOIN businesses b ON b.id = ub.business_id
         WHERE ub.user_id = $1 
           AND ub.business_id = $2 
           AND ub.status = 'ACTIVE'
           AND u.status = 'ACTIVE'`,
        [userId, businessId]
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as UserBusinessMembership
    },

    async listActiveBusinesses(userId: string): Promise<UserBusinessMembership[]> {
      const result = await pool.query(
        `SELECT ub.user_id, ub.business_id, ub.role, ub.status, ub.created_at, ub.updated_at, b.name as business_name
         FROM user_businesses ub
         JOIN users u ON u.id = ub.user_id
         JOIN businesses b ON b.id = ub.business_id
         WHERE ub.user_id = $1 
           AND ub.status = 'ACTIVE'
           AND u.status = 'ACTIVE'`,
        [userId]
      )

      return result.rows as UserBusinessMembership[]
    }
  }
}
