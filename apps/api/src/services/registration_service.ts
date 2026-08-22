import { Pool, PoolClient } from 'pg'
import { randomUUID } from 'crypto'
import { hashPassword } from './password_service'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { RegistrationRequest, RegistrationResponse } from '../dto/registration_dto'

export function createRegistrationService(pool: Pool) {
  return {
    async register(request: RegistrationRequest): Promise<RegistrationResponse> {
      const email = request.email.trim().toLowerCase()
      const password = request.password
      const businessName = request.business_name.trim()

      if (!email || !password || !businessName) {
        throw new ValidationError('Email, password, and business_name are required')
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        throw new ValidationError('Invalid email format')
      }

      if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters')
      }

      return pool.connect().then(async (client: PoolClient) => {
        try {
          await client.query('BEGIN')

          const existingUser = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
          )

          if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK')
            throw new ValidationError('Email is already registered', { email: 'Email is already registered' })
          }

          const userId = randomUUID()
          const businessId = randomUUID()
          const passwordHash = await hashPassword(password)

          await client.query(
            `INSERT INTO users (id, email, password_hash, status, created_at, updated_at)
             VALUES ($1, $2, $3, 'ACTIVE', now(), now())`,
            [userId, email, passwordHash]
          )

          await client.query(
            `INSERT INTO businesses (id, name, created_at)
             VALUES ($1, $2, now())`,
            [businessId, businessName]
          )

          await client.query(
            `INSERT INTO user_businesses (user_id, business_id, role, status, created_at, updated_at)
             VALUES ($1, $2, 'OWNER', 'ACTIVE', now(), now())`,
            [userId, businessId]
          )

          await client.query('COMMIT')

          return {
            user_id: userId,
            business_id: businessId,
            message: 'Registration successful. Please log in.'
          }
        } catch (err) {
          await client.query('ROLLBACK')
          throw err
        } finally {
          client.release()
        }
      })
    }
  }
}
