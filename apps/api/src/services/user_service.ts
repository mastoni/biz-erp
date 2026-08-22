import { Pool, PoolClient } from 'pg'
import { randomUUID } from 'crypto'
import { hashPassword } from './password_service'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { UserDto, UserListResponse, CreateUserRequest, RevokeUserRequest } from '../dto/user_dto'
import { createUserRepository, BusinessUser } from '../repositories/user_repository'
import { withTransaction } from '../db/transaction'

export function createUserService(pool: Pool) {
  const userRepo = createUserRepository(pool)

  return {
    async list(businessId: string): Promise<UserListResponse> {
      return withTransaction(pool, async (client) => {
        const users = await userRepo.findByBusiness(client, businessId)
        const items: UserDto[] = users.map((u: BusinessUser) => ({
          id: u.id,
          email: u.email,
          role: u.role,
          status: u.status,
          created_at: u.created_at,
        }))
        return { items, total: items.length }
      })
    },

    async create(businessId: string, request: CreateUserRequest, actorUserId: string): Promise<UserDto> {
      if (request.email.trim().length === 0) {
        throw new ValidationError('Email is required')
      }
      if (request.password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters')
      }
      if (request.role !== 'OWNER' && request.role !== 'CASHIER') {
        throw new ValidationError('Role must be OWNER or CASHIER')
      }

      const email = request.email.trim().toLowerCase()

      return withTransaction(pool, async (client) => {
        const existing = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [email]
        )

        let userId: string
        if (existing.rows.length > 0) {
          userId = existing.rows[0].id
        } else {
          userId = randomUUID()
          const passwordHash = await hashPassword(request.password)
          await client.query(
            `INSERT INTO users (id, email, password_hash, status, created_at, updated_at)
             VALUES ($1, $2, $3, 'ACTIVE', now(), now())`,
            [userId, email, passwordHash]
          )
        }

        const existingMembership = await client.query(
          'SELECT * FROM user_businesses WHERE user_id = $1 AND business_id = $2',
          [userId, businessId]
        )

        if (existingMembership.rows.length > 0) {
          throw new ValidationError('User already has access to this business')
        }

        await client.query(
          `INSERT INTO user_businesses (user_id, business_id, role, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'ACTIVE', now(), now())`,
          [userId, businessId, request.role]
        )

        const user = await userRepo.findById(client, userId)
        if (!user) {
          throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to create user')
        }

        return {
          id: user.id,
          email: user.email,
          role: request.role,
          status: user.status,
          created_at: user.created_at,
        }
      })
    },

    async revoke(businessId: string, targetUserId: string, actorUserId: string): Promise<void> {
      if (targetUserId === actorUserId) {
        throw new ValidationError('Cannot revoke your own access')
      }

      return withTransaction(pool, async (client) => {
        const membership = await client.query(
          'SELECT * FROM user_businesses WHERE user_id = $1 AND business_id = $2 AND status = $3',
          [targetUserId, businessId, 'ACTIVE']
        )

        if (membership.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'User not found in this business')
        }

        await client.query(
          `UPDATE user_businesses
           SET status = 'REVOKED', updated_at = now()
           WHERE user_id = $1 AND business_id = $2`,
          [targetUserId, businessId]
        )
      })
    },
  }
}
