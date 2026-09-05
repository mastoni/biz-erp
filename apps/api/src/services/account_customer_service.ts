import { Pool } from 'pg'
import crypto from 'crypto'
import { ApiError } from '../errors/api_error'
import { ConflictError } from '../errors/conflict_error'
import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'
import { withTransaction } from '../db/transaction'
import { createAuditService } from './audit_service'
import {
  AccountCustomerDto,
  AccountCustomerDetailDto,
  AccountCustomerUserDto,
  AccountCustomerListResponse,
  CreateAccountCustomerRequest,
  UpdateAccountCustomerRequest,
  ChangeAccountCustomerStatusRequest,
  AddAccountCustomerUserRequest,
  UpdateAccountCustomerUserRequest,
  ReconcileBusinessRequest,
  ReconcileBusinessResponse,
  UnlinkBusinessResponse,
  validateCreateAccountCustomer,
  validateUpdateAccountCustomer,
  validateChangeAccountCustomerStatus,
  validateAddAccountCustomerUser,
  validateUpdateAccountCustomerUser,
  validateReconcileBusiness,
} from '../dto/account_customer_dto'

function mapRowToAccountCustomerDto(row: Record<string, unknown>): AccountCustomerDto {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    account_type: row.account_type as AccountCustomerDto['account_type'],
    tax_id: (row.tax_id as string) ?? null,
    billing_email: (row.billing_email as string) ?? null,
    billing_phone: (row.billing_phone as string) ?? null,
    status: row.status as AccountCustomerDto['status'],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: (row.created_at as Date)?.toISOString?.() ?? (row.created_at as string),
    updated_at: (row.updated_at as Date)?.toISOString?.() ?? (row.updated_at as string),
  }
}

function mapRowToAccountCustomerUserDto(row: Record<string, unknown>): AccountCustomerUserDto {
  return {
    id: row.id as string,
    account_customer_id: row.account_customer_id as string,
    user_id: row.user_id as string,
    email: (row.email as string) ?? undefined,
    role: row.role as AccountCustomerUserDto['role'],
    status: row.status as AccountCustomerUserDto['status'],
    created_at: (row.created_at as Date)?.toISOString?.() ?? (row.created_at as string),
    updated_at: (row.updated_at as Date)?.toISOString?.() ?? (row.updated_at as string),
  }
}

function generateAccountCustomerCode(): string {
  const now = new Date()
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `ACC-${yearMonth}-${rand}`
}

export function createAccountCustomerService(pool: Pool) {
  const auditService = createAuditService(pool)

  return {
    /**
     * List Account Customers with search, filter, summary and pagination.
     */
    async list(query: Record<string, unknown>): Promise<AccountCustomerListResponse> {
      const limit = Math.min(parseInt(String(query.limit ?? '20'), 10) || 20, 200)
      const offset = Math.max(parseInt(String(query.offset ?? '0'), 10) || 0, 0)
      const q = typeof query.q === 'string' ? query.q.trim() : undefined
      const status = typeof query.status === 'string' ? query.status.trim() : undefined
      const accountType = typeof query.account_type === 'string' ? query.account_type.trim() : undefined

      const whereClauses: string[] = []
      const params: unknown[] = []
      let paramIdx = 1

      if (q) {
        whereClauses.push(`(code ILIKE $${paramIdx} OR name ILIKE $${paramIdx} OR billing_email ILIKE $${paramIdx})`)
        params.push(`%${q}%`)
        paramIdx++
      }

      if (status) {
        whereClauses.push(`status = $${paramIdx}`)
        params.push(status)
        paramIdx++
      }

      if (accountType) {
        whereClauses.push(`account_type = $${paramIdx}`)
        params.push(accountType)
        paramIdx++
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

      const dataQuery = `
        SELECT * FROM account_customers
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx++}
      `
      const dataParams = [...params, limit, offset]

      const countQuery = `SELECT COUNT(*)::int AS count FROM account_customers ${whereSql}`
      const summaryQuery = `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active_count,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_count,
          COUNT(*) FILTER (WHERE status = 'SUSPENDED')::int AS suspended_count,
          COUNT(*) FILTER (WHERE status = 'TERMINATED')::int AS terminated_count
        FROM account_customers
      `

      const [dataRes, countRes, summaryRes] = await Promise.all([
        pool.query(dataQuery, dataParams),
        pool.query(countQuery, params),
        pool.query(summaryQuery),
      ])

      const items = dataRes.rows.map(mapRowToAccountCustomerDto)
      const total = countRes.rows[0]?.count ?? 0
      const summary = summaryRes.rows[0] ?? {
        total: 0,
        active_count: 0,
        pending_count: 0,
        suspended_count: 0,
        terminated_count: 0,
      }

      return {
        items,
        total,
        limit,
        offset,
        has_more: offset + items.length < total,
        summary: {
          total: summary.total,
          active_count: summary.active_count,
          pending_count: summary.pending_count,
          suspended_count: summary.suspended_count,
          terminated_count: summary.terminated_count,
        },
      }
    },

    /**
     * Create a new Account Customer.
     */
    async create(
      input: unknown,
      actorUserId: string,
      requestId?: string
    ): Promise<AccountCustomerDto> {
      const data = validateCreateAccountCustomer(input)
      const code = data.code || generateAccountCustomerCode()

      return withTransaction(pool, async (client) => {
        // Check code uniqueness
        const existing = await client.query('SELECT id FROM account_customers WHERE code = $1', [code])
        if (existing.rows.length > 0) {
          throw new ConflictError('ACCOUNT_CUSTOMER_CODE_CONFLICT', `Account Customer with code ${code} already exists`)
        }

        const insertQuery = `
          INSERT INTO account_customers (
            code, name, account_type, tax_id, billing_email, billing_phone, status, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `
        const res = await client.query(insertQuery, [
          code,
          data.name,
          data.account_type,
          data.tax_id ?? null,
          data.billing_email ?? null,
          data.billing_phone ?? null,
          data.status ?? 'ACTIVE',
          JSON.stringify(data.metadata ?? {}),
        ])

        const created = mapRowToAccountCustomerDto(res.rows[0])

        await auditService.recordAudit({
          actor_id: actorUserId,
          actor_scope: 'platform',
          actor_role: 'SUPER_ADMIN',
          action: 'ACCOUNT_CUSTOMER_CREATED',
          target_type: 'ACCOUNT_CUSTOMER',
          target_id: created.id,
          before_state: null,
          after_state: created as unknown as Record<string, unknown>,
          diff: created as unknown as Record<string, unknown>,
          request_id: requestId,
          status: 'SUCCESS',
        })

        return created
      })
    },

    /**
     * Get Account Customer by ID with child statistics.
     */
    async getById(id: string): Promise<AccountCustomerDetailDto> {
      if (!isUuid(id)) {
        throw new ValidationError('id must be a valid UUID')
      }

      const res = await pool.query('SELECT * FROM account_customers WHERE id = $1', [id])
      if (res.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Account Customer not found')
      }

      const base = mapRowToAccountCustomerDto(res.rows[0])

      const [bizRes, subRes, userRes] = await Promise.all([
        pool.query('SELECT COUNT(*)::int AS count FROM businesses WHERE account_customer_id = $1', [id]),
        pool.query('SELECT COUNT(*)::int AS count FROM subscriptions WHERE account_customer_id = $1 AND status = \'ACTIVE\'', [id]),
        pool.query('SELECT COUNT(*)::int AS count FROM account_customer_users WHERE account_customer_id = $1', [id]),
      ])

      return {
        ...base,
        business_count: bizRes.rows[0]?.count ?? 0,
        active_subscription_count: subRes.rows[0]?.count ?? 0,
        user_count: userRes.rows[0]?.count ?? 0,
      }
    },

    /**
     * Update Account Customer profile and metadata.
     */
    async update(
      id: string,
      input: unknown,
      actorUserId: string,
      requestId?: string
    ): Promise<AccountCustomerDto> {
      if (!isUuid(id)) {
        throw new ValidationError('id must be a valid UUID')
      }
      const data = validateUpdateAccountCustomer(input)

      return withTransaction(pool, async (client) => {
        const existingRes = await client.query('SELECT * FROM account_customers WHERE id = $1', [id])
        if (existingRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Account Customer not found')
        }
        const before = mapRowToAccountCustomerDto(existingRes.rows[0])

        const updates: string[] = ['updated_at = now()']
        const params: unknown[] = [id]
        let paramIdx = 2

        if (data.name !== undefined) {
          updates.push(`name = $${paramIdx++}`)
          params.push(data.name)
        }
        if (data.account_type !== undefined) {
          updates.push(`account_type = $${paramIdx++}`)
          params.push(data.account_type)
        }
        if (data.tax_id !== undefined) {
          updates.push(`tax_id = $${paramIdx++}`)
          params.push(data.tax_id)
        }
        if (data.billing_email !== undefined) {
          updates.push(`billing_email = $${paramIdx++}`)
          params.push(data.billing_email)
        }
        if (data.billing_phone !== undefined) {
          updates.push(`billing_phone = $${paramIdx++}`)
          params.push(data.billing_phone)
        }
        if (data.metadata !== undefined) {
          updates.push(`metadata = $${paramIdx++}`)
          params.push(JSON.stringify(data.metadata))
        }

        const updateQuery = `
          UPDATE account_customers
          SET ${updates.join(', ')}
          WHERE id = $1
          RETURNING *
        `
        const updateRes = await client.query(updateQuery, params)
        const after = mapRowToAccountCustomerDto(updateRes.rows[0])

        await auditService.recordAudit({
          actor_id: actorUserId,
          actor_scope: 'platform',
          actor_role: 'SUPER_ADMIN',
          action: 'ACCOUNT_CUSTOMER_UPDATED',
          target_type: 'ACCOUNT_CUSTOMER',
          target_id: id,
          before_state: before as unknown as Record<string, unknown>,
          after_state: after as unknown as Record<string, unknown>,
          diff: data as unknown as Record<string, unknown>,
          request_id: requestId,
          status: 'SUCCESS',
        })

        return after
      })
    },

    /**
     * Change status of Account Customer.
     */
    async setStatus(
      id: string,
      input: unknown,
      actorUserId: string,
      requestId?: string
    ): Promise<AccountCustomerDto> {
      if (!isUuid(id)) {
        throw new ValidationError('id must be a valid UUID')
      }
      const data = validateChangeAccountCustomerStatus(input)

      return withTransaction(pool, async (client) => {
        const existingRes = await client.query('SELECT * FROM account_customers WHERE id = $1', [id])
        if (existingRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Account Customer not found')
        }
        const before = mapRowToAccountCustomerDto(existingRes.rows[0])

        const updateRes = await client.query(
          `UPDATE account_customers SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
          [data.status, id]
        )
        const after = mapRowToAccountCustomerDto(updateRes.rows[0])

        await auditService.recordAudit({
          actor_id: actorUserId,
          actor_scope: 'platform',
          actor_role: 'SUPER_ADMIN',
          action: 'ACCOUNT_CUSTOMER_STATUS_CHANGED',
          target_type: 'ACCOUNT_CUSTOMER',
          target_id: id,
          before_state: before as unknown as Record<string, unknown>,
          after_state: after as unknown as Record<string, unknown>,
          diff: { status: data.status, reason: data.reason },
          request_id: requestId,
          status: 'SUCCESS',
        })

        return after
      })
    },

    /**
     * List linked users for an Account Customer.
     */
    async listUsers(accountCustomerId: string): Promise<AccountCustomerUserDto[]> {
      if (!isUuid(accountCustomerId)) {
        throw new ValidationError('accountCustomerId must be a valid UUID')
      }

      const query = `
        SELECT acu.*, u.email
        FROM account_customer_users acu
        JOIN users u ON acu.user_id = u.id
        WHERE acu.account_customer_id = $1
        ORDER BY acu.created_at ASC
      `
      const res = await pool.query(query, [accountCustomerId])
      return res.rows.map(mapRowToAccountCustomerUserDto)
    },

    /**
     * Add a user to an Account Customer.
     */
    async addUser(
      accountCustomerId: string,
      input: unknown,
      actorUserId: string,
      requestId?: string
    ): Promise<AccountCustomerUserDto> {
      if (!isUuid(accountCustomerId)) {
        throw new ValidationError('accountCustomerId must be a valid UUID')
      }
      const data = validateAddAccountCustomerUser(input)

      return withTransaction(pool, async (client) => {
        // Verify Account Customer exists
        const acRes = await client.query('SELECT id FROM account_customers WHERE id = $1', [accountCustomerId])
        if (acRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Account Customer not found')
        }

        // Verify User exists
        const userRes = await client.query('SELECT id, email FROM users WHERE id = $1', [data.user_id])
        if (userRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'User not found')
        }

        // Check unique constraint
        const existing = await client.query(
          'SELECT id FROM account_customer_users WHERE account_customer_id = $1 AND user_id = $2',
          [accountCustomerId, data.user_id]
        )
        if (existing.rows.length > 0) {
          throw new ConflictError('ACCOUNT_CUSTOMER_USER_CONFLICT', 'User is already linked to this Account Customer')
        }

        const insertRes = await client.query(
          `INSERT INTO account_customer_users (account_customer_id, user_id, role, status)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [accountCustomerId, data.user_id, data.role, data.status]
        )

        const created = mapRowToAccountCustomerUserDto({
          ...insertRes.rows[0],
          email: userRes.rows[0].email,
        })

        await auditService.recordAudit({
          actor_id: actorUserId,
          actor_scope: 'platform',
          actor_role: 'SUPER_ADMIN',
          action: 'ACCOUNT_CUSTOMER_USER_ADDED',
          target_type: 'ACCOUNT_CUSTOMER_USER',
          target_id: created.id,
          before_state: null,
          after_state: created as unknown as Record<string, unknown>,
          diff: created as unknown as Record<string, unknown>,
          request_id: requestId,
          status: 'SUCCESS',
        })

        return created
      })
    },

    /**
     * Update user role or status under Account Customer.
     */
    async updateUser(
      accountCustomerId: string,
      userId: string,
      input: unknown,
      actorUserId: string,
      requestId?: string
    ): Promise<AccountCustomerUserDto> {
      if (!isUuid(accountCustomerId) || !isUuid(userId)) {
        throw new ValidationError('accountCustomerId and userId must be valid UUIDs')
      }
      const data = validateUpdateAccountCustomerUser(input)

      return withTransaction(pool, async (client) => {
        const existingRes = await client.query(
          `SELECT acu.*, u.email
           FROM account_customer_users acu
           JOIN users u ON acu.user_id = u.id
           WHERE acu.account_customer_id = $1 AND acu.user_id = $2`,
          [accountCustomerId, userId]
        )
        if (existingRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Account Customer User linkage not found')
        }
        const before = mapRowToAccountCustomerUserDto(existingRes.rows[0])

        const updates: string[] = ['updated_at = now()']
        const params: unknown[] = [accountCustomerId, userId]
        let paramIdx = 3

        if (data.role !== undefined) {
          updates.push(`role = $${paramIdx++}`)
          params.push(data.role)
        }
        if (data.status !== undefined) {
          updates.push(`status = $${paramIdx++}`)
          params.push(data.status)
        }

        const updateRes = await client.query(
          `UPDATE account_customer_users
           SET ${updates.join(', ')}
           WHERE account_customer_id = $1 AND user_id = $2
           RETURNING *`,
          params
        )

        const after = mapRowToAccountCustomerUserDto({
          ...updateRes.rows[0],
          email: before.email,
        })

        await auditService.recordAudit({
          actor_id: actorUserId,
          actor_scope: 'platform',
          actor_role: 'SUPER_ADMIN',
          action: 'ACCOUNT_CUSTOMER_USER_UPDATED',
          target_type: 'ACCOUNT_CUSTOMER_USER',
          target_id: after.id,
          before_state: before as unknown as Record<string, unknown>,
          after_state: after as unknown as Record<string, unknown>,
          diff: data as unknown as Record<string, unknown>,
          request_id: requestId,
          status: 'SUCCESS',
        })

        return after
      })
    },

    /**
     * Remove/revoke a user link from Account Customer.
     */
    async removeUser(
      accountCustomerId: string,
      userId: string,
      actorUserId: string,
      requestId?: string
    ): Promise<{ message: string }> {
      if (!isUuid(accountCustomerId) || !isUuid(userId)) {
        throw new ValidationError('accountCustomerId and userId must be valid UUIDs')
      }

      return withTransaction(pool, async (client) => {
        const existingRes = await client.query(
          'SELECT * FROM account_customer_users WHERE account_customer_id = $1 AND user_id = $2',
          [accountCustomerId, userId]
        )
        if (existingRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Account Customer User linkage not found')
        }
        const before = mapRowToAccountCustomerUserDto(existingRes.rows[0])

        await client.query(
          'DELETE FROM account_customer_users WHERE account_customer_id = $1 AND user_id = $2',
          [accountCustomerId, userId]
        )

        await auditService.recordAudit({
          actor_id: actorUserId,
          actor_scope: 'platform',
          actor_role: 'SUPER_ADMIN',
          action: 'ACCOUNT_CUSTOMER_USER_REMOVED',
          target_type: 'ACCOUNT_CUSTOMER_USER',
          target_id: before.id,
          before_state: before as unknown as Record<string, unknown>,
          after_state: null,
          diff: { removed: true },
          request_id: requestId,
          status: 'SUCCESS',
        })

        return { message: 'User removed from Account Customer successfully' }
      })
    },

    /**
     * List businesses owned by an Account Customer.
     */
    async listBusinesses(accountCustomerId: string): Promise<Array<Record<string, unknown>>> {
      if (!isUuid(accountCustomerId)) {
        throw new ValidationError('accountCustomerId must be a valid UUID')
      }

      const query = `
        SELECT b.id, b.name, b.status, b.owner_user_id, b.created_at, b.updated_at,
               u.email AS owner_email,
               COUNT(s.id)::int AS subscription_count
        FROM businesses b
        LEFT JOIN users u ON b.owner_user_id = u.id
        LEFT JOIN subscriptions s ON s.business_id = b.id AND s.status = 'ACTIVE'
        WHERE b.account_customer_id = $1
        GROUP BY b.id, u.email
        ORDER BY b.created_at DESC
      `
      const res = await pool.query(query, [accountCustomerId])
      return res.rows
    },

    /**
     * Reconcile / assign a business to an Account Customer with optimistic concurrency & reassignment protection.
     */
    async reconcileBusiness(
      accountCustomerId: string,
      input: unknown,
      actorUserId: string,
      requestId?: string
    ): Promise<ReconcileBusinessResponse> {
      if (!isUuid(accountCustomerId)) {
        throw new ValidationError('accountCustomerId must be a valid UUID')
      }
      const data = validateReconcileBusiness(input)

      return withTransaction(pool, async (client) => {
        // 1. Verify target Account Customer exists
        const acRes = await client.query('SELECT id, name FROM account_customers WHERE id = $1', [accountCustomerId])
        if (acRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Account Customer not found')
        }

        // 2. Fetch business
        const bizRes = await client.query('SELECT id, name, account_customer_id FROM businesses WHERE id = $1', [data.business_id])
        if (bizRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Business not found')
        }

        const business = bizRes.rows[0]
        const currentOwner = business.account_customer_id as string | null

        // 3. Check if already linked to the same owner (idempotent)
        if (currentOwner === accountCustomerId) {
          return {
            message: 'Business is already linked to this Account Customer',
            business_id: data.business_id,
            account_customer_id: accountCustomerId,
            previous_account_customer_id: currentOwner,
            subscriptions_synced_count: 0,
          }
        }

        // 4. Reassignment Protection
        if (currentOwner !== null && currentOwner !== accountCustomerId) {
          if (data.expected_current_account_customer_id !== currentOwner || !data.confirm_reassignment) {
            throw new ConflictError(
              'OWNERSHIP_REASSIGNMENT_REQUIRES_CONFIRMATION',
              `Business is currently linked to Account Customer ${currentOwner}. Explicit confirmation with expected_current_account_customer_id is required to reassign.`,
              {
                current_account_customer_id: currentOwner,
                expected_current_account_customer_id: data.expected_current_account_customer_id ?? null,
              }
            )
          }
        } else if (currentOwner === null) {
          if (data.expected_current_account_customer_id !== undefined && data.expected_current_account_customer_id !== null) {
            throw new ConflictError(
              'OWNERSHIP_REASSIGNMENT_MISMATCH',
              'Expected previous owner does not match current unlinked state',
              {
                current_account_customer_id: null,
                expected_current_account_customer_id: data.expected_current_account_customer_id,
              }
            )
          }
        }

        // 5. Update Business
        await client.query(
          'UPDATE businesses SET account_customer_id = $1, updated_at = now() WHERE id = $2',
          [accountCustomerId, data.business_id]
        )

        // 6. Update Subscriptions atomically
        const subRes = await client.query(
          'UPDATE subscriptions SET account_customer_id = $1, updated_at = now() WHERE business_id = $2 RETURNING id',
          [accountCustomerId, data.business_id]
        )

        const syncedCount = subRes.rowCount ?? 0

        // 7. Audit Log
        await auditService.recordAudit({
          actor_id: actorUserId,
          actor_scope: 'platform',
          actor_role: 'SUPER_ADMIN',
          action: 'BUSINESS_OWNERSHIP_RECONCILED',
          target_type: 'BUSINESS',
          target_id: data.business_id,
          before_state: { account_customer_id: currentOwner },
          after_state: { account_customer_id: accountCustomerId },
          diff: {
            previous_account_customer_id: currentOwner,
            target_account_customer_id: accountCustomerId,
            subscriptions_synced_count: syncedCount,
            reason: data.reason,
          },
          request_id: requestId,
          status: 'SUCCESS',
        })

        return {
          message: 'Business ownership reconciled successfully',
          business_id: data.business_id,
          account_customer_id: accountCustomerId,
          previous_account_customer_id: currentOwner,
          subscriptions_synced_count: syncedCount,
        }
      })
    },

    /**
     * Unlink a business from an Account Customer.
     */
    async unlinkBusiness(
      accountCustomerId: string,
      businessId: string,
      actorUserId: string,
      requestId?: string
    ): Promise<UnlinkBusinessResponse> {
      if (!isUuid(accountCustomerId) || !isUuid(businessId)) {
        throw new ValidationError('accountCustomerId and businessId must be valid UUIDs')
      }

      return withTransaction(pool, async (client) => {
        const bizRes = await client.query('SELECT id, name, account_customer_id FROM businesses WHERE id = $1', [businessId])
        if (bizRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Business not found')
        }

        const business = bizRes.rows[0]
        if (business.account_customer_id !== accountCustomerId) {
          throw new ApiError(400, 'INVALID_BUSINESS_OWNERSHIP', `Business does not belong to Account Customer ${accountCustomerId}`)
        }

        // Update Business
        await client.query('UPDATE businesses SET account_customer_id = NULL, updated_at = now() WHERE id = $1', [businessId])

        // Update Subscriptions atomically
        const subRes = await client.query(
          'UPDATE subscriptions SET account_customer_id = NULL, updated_at = now() WHERE business_id = $1 RETURNING id',
          [businessId]
        )

        const unlinkedCount = subRes.rowCount ?? 0

        await auditService.recordAudit({
          actor_id: actorUserId,
          actor_scope: 'platform',
          actor_role: 'SUPER_ADMIN',
          action: 'BUSINESS_OWNERSHIP_UNLINKED',
          target_type: 'BUSINESS',
          target_id: businessId,
          before_state: { account_customer_id: accountCustomerId },
          after_state: { account_customer_id: null },
          diff: {
            previous_account_customer_id: accountCustomerId,
            subscriptions_unlinked_count: unlinkedCount,
          },
          request_id: requestId,
          status: 'SUCCESS',
        })

        return {
          message: 'Business unlinked successfully',
          business_id: businessId,
          previous_account_customer_id: accountCustomerId,
          subscriptions_unlinked_count: unlinkedCount,
        }
      })
    },

    /**
     * List all subscriptions owned across businesses of this Account Customer.
     */
    async listSubscriptions(accountCustomerId: string): Promise<Array<Record<string, unknown>>> {
      if (!isUuid(accountCustomerId)) {
        throw new ValidationError('accountCustomerId must be a valid UUID')
      }

      const query = `
        SELECT s.*, b.name as business_name, p.name as plan_name, p.tier as plan_tier
        FROM subscriptions s
        JOIN businesses b ON s.business_id = b.id
        LEFT JOIN plans p ON s.plan_code = p.code
        WHERE s.account_customer_id = $1
        ORDER BY s.created_at DESC
      `
      const res = await pool.query(query, [accountCustomerId])
      return res.rows
    },
  }
}
