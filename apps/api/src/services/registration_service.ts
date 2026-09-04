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

          // Validate plan_code if supplied
          let planToBind: any = null
          if (request.plan_code) {
            const planRes = await client.query(
              `SELECT code, name, family, tier, billing_cycle, pricing, type, status, trial_days
               FROM plans WHERE code = $1`,
              [request.plan_code]
            )
            if (planRes.rows.length === 0 || planRes.rows[0].status !== 'ACTIVE') {
              throw new ValidationError('Invalid or inactive plan_code', {
                plan_code: `Plan '${request.plan_code}' is invalid or inactive`
              })
            }
            planToBind = planRes.rows[0]
          }

          // Validate bundle_code if supplied
          let bundleToBind: any = null
          if (request.bundle_code) {
            const bundleRes = await client.query(
              `SELECT code, name, pricing, status FROM bundles WHERE code = $1`,
              [request.bundle_code]
            )
            if (bundleRes.rows.length === 0 || bundleRes.rows[0].status !== 'ACTIVE') {
              throw new ValidationError('Invalid or inactive bundle_code', {
                bundle_code: `Bundle '${request.bundle_code}' is invalid or inactive`
              })
            }
            bundleToBind = bundleRes.rows[0]

            // If no standalone plan_code was specified, check if bundle contains an active plan
            if (!planToBind) {
              const bundlePlanRes = await client.query(
                `SELECT p.code, p.name, p.family, p.tier, p.billing_cycle, p.pricing, p.type, p.status, p.trial_days
                 FROM bundle_items bi
                 JOIN plans p ON p.code = bi.item_code
                 WHERE bi.bundle_code = $1 AND bi.item_type = 'PLAN' AND p.status = 'ACTIVE'
                 ORDER BY bi.id ASC
                 LIMIT 1`,
                [bundleToBind.code]
              )
              if (bundlePlanRes.rows.length > 0) {
                planToBind = bundlePlanRes.rows[0]
              }
            }
          }

          const existingUser = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
          )

          if (existingUser.rows.length > 0) {
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
            `INSERT INTO businesses (id, name, status, owner_user_id, created_at, updated_at)
             VALUES ($1, $2, 'PENDING_REVIEW', $3, now(), now())`,
            [businessId, businessName, userId]
          )

          await client.query(
            `INSERT INTO user_businesses (user_id, business_id, role, status, created_at, updated_at)
             VALUES ($1, $2, 'OWNER', 'ACTIVE', now(), now())`,
            [userId, businessId]
          )

          // If commercial intent exists (plan or bundle plan), create initial pending subscription
          if (planToBind) {
            const rawPricing = planToBind.pricing || {}
            const unitPrice = Math.max(0, Number(rawPricing.base_price || 0))
            const discount = Math.max(0, Number(rawPricing.discount || 0))
            const tax = Math.max(0, Number(rawPricing.tax || 0))
            const finalPrice = Math.max(0, Number(rawPricing.final_price ?? (unitPrice - discount + tax)))
            const currency = rawPricing.currency || 'IDR'
            const billingCycle = planToBind.billing_cycle || 'MONTHLY'
            const trialDays = Math.max(0, Number(planToBind.trial_days || 0))
            const source = planToBind.type === 'TRIAL' ? 'TRIAL' : 'DIRECT'

            const meta: Record<string, unknown> = {
              registered_via: 'LANDING_CONVERSION',
              plan_name: planToBind.name
            }
            if (bundleToBind) {
              meta.bundle_code = bundleToBind.code
              meta.bundle_name = bundleToBind.name
            }

            await client.query(
              `INSERT INTO subscriptions (
                business_id, plan_code, family_code, source, status,
                starts_at, ends_at, trial_ends_at,
                unit_price, discount, tax, final_price, currency, billing_cycle, metadata
              ) VALUES ($1, $2, $3, $4, 'PENDING', now(), null, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                businessId,
                planToBind.code,
                planToBind.family,
                source,
                trialDays > 0 ? new Date(Date.now() + trialDays * 86400000) : null,
                unitPrice,
                discount,
                tax,
                finalPrice,
                currency,
                billingCycle,
                JSON.stringify(meta)
              ]
            )
          }

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
