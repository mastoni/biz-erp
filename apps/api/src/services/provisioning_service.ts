import { Pool } from 'pg'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { ConflictError } from '../errors/conflict_error'
import {
  ProvisioningJobDto,
  ProvisioningAuditLogDto,
  ProvisioningAction,
  ProvisioningStatus,
  validateCreateProvisioningJob,
} from '../dto/provisioning_dto'
import { withTransaction } from '../db/transaction'
import { isUuid } from '../utils/uuid'

export interface ProvisioningExecutionResult {
  success: boolean
  result?: Record<string, unknown>
  error?: string
}

export interface ProvisioningDriver {
  execute(job: ProvisioningJobDto): Promise<ProvisioningExecutionResult>
}

// ---------------------------------------------------------------------------
// Default Built-in Service Drivers
// ---------------------------------------------------------------------------

export const defaultDrivers: Record<string, ProvisioningDriver> = {
  ERP: {
    async execute(job: ProvisioningJobDto): Promise<ProvisioningExecutionResult> {
      return {
        success: true,
        result: {
          service: 'ERP',
          action: job.action,
          tenant_db_status: job.action === 'SUSPEND' ? 'SUSPENDED' : 'INITIALIZED',
          allocated_storage_mb: 5000,
          timestamp: new Date().toISOString(),
        },
      }
    },
  },
  ISP_MANAGEMENT: {
    async execute(job: ProvisioningJobDto): Promise<ProvisioningExecutionResult> {
      return {
        success: true,
        result: {
          service: 'ISP_MANAGEMENT',
          action: job.action,
          radius_policy: job.action === 'SUSPEND' ? 'DISABLED' : 'ENABLED',
          acs_sync: 'SYNCHRONIZED',
          speed_tier: (job.payload.speed_tier as string) ?? 'STANDARD',
          timestamp: new Date().toISOString(),
        },
      }
    },
  },
  CCTV_MANAGEMENT: {
    async execute(job: ProvisioningJobDto): Promise<ProvisioningExecutionResult> {
      return {
        success: true,
        result: {
          service: 'CCTV_MANAGEMENT',
          action: job.action,
          streaming_gateway: job.action === 'SUSPEND' ? 'OFFLINE' : 'ONLINE',
          retention_days: 30,
          timestamp: new Date().toISOString(),
        },
      }
    },
  },
  WA_GATEWAY: {
    async execute(job: ProvisioningJobDto): Promise<ProvisioningExecutionResult> {
      return {
        success: true,
        result: {
          service: 'WA_GATEWAY',
          action: job.action,
          channel_state: job.action === 'SUSPEND' ? 'DISCONNECTED' : 'CONNECTED',
          timestamp: new Date().toISOString(),
        },
      }
    },
  },
  AUTOPOST: {
    async execute(job: ProvisioningJobDto): Promise<ProvisioningExecutionResult> {
      return {
        success: true,
        result: {
          service: 'AUTOPOST',
          action: job.action,
          scheduler_state: job.action === 'SUSPEND' ? 'PAUSED' : 'ACTIVE',
          timestamp: new Date().toISOString(),
        },
      }
    },
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertTenant(businessId: string, tenantId: string): void {
  if (tenantId.toLowerCase() !== businessId.toLowerCase()) {
    throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch')
  }
}

function mapRowToJobDto(row: Record<string, unknown>): ProvisioningJobDto {
  return {
    id: row.id as string,
    business_id: row.business_id as string,
    subscription_id: (row.subscription_id as string) ?? null,
    service_code: row.service_code as string,
    action: row.action as ProvisioningAction,
    status: row.status as ProvisioningStatus,
    payload: (row.payload as Record<string, unknown>) ?? {},
    result: (row.result as Record<string, unknown>) ?? {},
    error_message: (row.error_message as string) ?? null,
    idempotency_key: (row.idempotency_key as string) ?? null,
    attempts: Number(row.attempts),
    max_attempts: Number(row.max_attempts),
    scheduled_at: row.scheduled_at as string,
    started_at: (row.started_at as string) ?? null,
    completed_at: (row.completed_at as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

function mapRowToAuditDto(row: Record<string, unknown>): ProvisioningAuditLogDto {
  return {
    id: row.id as string,
    job_id: row.job_id as string,
    business_id: row.business_id as string,
    service_code: row.service_code as string,
    action: row.action as string,
    status: row.status as string,
    actor_id: (row.actor_id as string) ?? null,
    actor_scope: (row.actor_scope as string) ?? 'tenant',
    details: (row.details as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
  }
}

// ---------------------------------------------------------------------------
// Service Factory
// ---------------------------------------------------------------------------

export function createProvisioningService(
  pool: Pool,
  customDrivers?: Record<string, ProvisioningDriver>
) {
  const drivers: Record<string, ProvisioningDriver> = {
    ...defaultDrivers,
    ...(customDrivers ?? {}),
  }

  return {
    /**
     * Create a new provisioning job (Idempotent).
     */
    async createJob(
      input: unknown,
      tenantId: string,
      actorContext?: { actorId?: string; actorScope?: string }
    ): Promise<ProvisioningJobDto> {
      const request = validateCreateProvisioningJob(input)
      assertTenant(request.business_id, tenantId)

      return withTransaction(pool, async (client) => {
        // Check if service exists
        const serviceRes = await client.query(
          'SELECT code, lifecycle_status FROM services WHERE code = $1',
          [request.service_code]
        )
        if (serviceRes.rows.length === 0) {
          throw new ValidationError(`Unknown service_code: ${request.service_code}`)
        }

        // Check if subscription exists and belongs to business
        if (request.subscription_id) {
          const subRes = await client.query(
            'SELECT s.id, s.business_id, p.service_code FROM subscriptions s JOIN plans p ON s.plan_code = p.code WHERE s.id = $1 AND s.business_id = $2',
            [request.subscription_id, tenantId]
          )
          if (subRes.rows.length === 0) {
            throw new ValidationError(`Subscription ${request.subscription_id} not found for this tenant`)
          }
        }

        // Idempotency check
        if (request.idempotency_key) {
          const existing = await client.query(
            'SELECT * FROM provisioning_jobs WHERE business_id = $1 AND idempotency_key = $2',
            [tenantId, request.idempotency_key]
          )
          if (existing.rows.length > 0) {
            return mapRowToJobDto(existing.rows[0])
          }
        }

        // Insert new job
        const insertQuery = `
          INSERT INTO provisioning_jobs (
            business_id, subscription_id, service_code, action, status, payload, idempotency_key
          ) VALUES ($1, $2, $3, $4, 'PENDING', $5, $6)
          RETURNING *
        `
        const jobRes = await client.query(insertQuery, [
          tenantId,
          request.subscription_id,
          request.service_code,
          request.action,
          JSON.stringify(request.payload),
          request.idempotency_key,
        ])

        const job = mapRowToJobDto(jobRes.rows[0])

        // Log audit
        await client.query(
          `INSERT INTO provisioning_audit_logs (
            job_id, business_id, service_code, action, status, actor_id, actor_scope, details
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            job.id,
            job.business_id,
            job.service_code,
            job.action,
            'PENDING',
            actorContext?.actorId ?? null,
            actorContext?.actorScope ?? 'tenant',
            JSON.stringify({ event: 'JOB_CREATED', payload: job.payload }),
          ]
        )

        return job
      })
    },

    /**
     * Process a provisioning job synchronously or via worker.
     */
    async processJob(
      jobId: string,
      tenantId?: string,
      actorContext?: { actorId?: string; actorScope?: string }
    ): Promise<ProvisioningJobDto> {
      if (!isUuid(jobId)) {
        throw new ValidationError('jobId must be a valid UUID')
      }

      // Step 1: Transition to PROCESSING
      let job = await withTransaction(pool, async (client) => {
        let selectQuery = 'SELECT * FROM provisioning_jobs WHERE id = $1'
        const params: unknown[] = [jobId]
        if (tenantId) {
          selectQuery += ' AND business_id = $2'
          params.push(tenantId)
        }

        const res = await client.query(selectQuery, params)
        if (res.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Provisioning job not found')
        }

        const current = mapRowToJobDto(res.rows[0])
        if (current.status === 'COMPLETED') {
          return current
        }

        const updateRes = await client.query(
          `UPDATE provisioning_jobs 
           SET status = 'PROCESSING', started_at = NOW(), attempts = attempts + 1, updated_at = NOW() 
           WHERE id = $1 
           RETURNING *`,
          [jobId]
        )

        return mapRowToJobDto(updateRes.rows[0])
      })

      if (job.status === 'COMPLETED') {
        return job
      }

      // Step 2: Execute driver
      const driver = drivers[job.service_code]
      let execResult: ProvisioningExecutionResult
      if (!driver) {
        execResult = {
          success: false,
          error: `No provisioning driver registered for service: ${job.service_code}`,
        }
      } else {
        try {
          execResult = await driver.execute(job)
        } catch (err: any) {
          execResult = {
            success: false,
            error: err?.message || 'Unknown driver execution error',
          }
        }
      }

      // Step 3: Record result
      job = await withTransaction(pool, async (client) => {
        const finalStatus: ProvisioningStatus = execResult.success ? 'COMPLETED' : 'FAILED'
        const updateQuery = `
          UPDATE provisioning_jobs
          SET status = $1,
              result = $2,
              error_message = $3,
              completed_at = CASE WHEN $1 = 'COMPLETED' THEN NOW() ELSE NULL END,
              updated_at = NOW()
          WHERE id = $4
          RETURNING *
        `
        const updateRes = await client.query(updateQuery, [
          finalStatus,
          JSON.stringify(execResult.result ?? {}),
          execResult.error ?? null,
          jobId,
        ])

        const updatedJob = mapRowToJobDto(updateRes.rows[0])

        // Audit log
        await client.query(
          `INSERT INTO provisioning_audit_logs (
            job_id, business_id, service_code, action, status, actor_id, actor_scope, details
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            updatedJob.id,
            updatedJob.business_id,
            updatedJob.service_code,
            updatedJob.action,
            finalStatus,
            actorContext?.actorId ?? null,
            actorContext?.actorScope ?? 'tenant',
            JSON.stringify({
              event: finalStatus === 'COMPLETED' ? 'JOB_COMPLETED' : 'JOB_FAILED',
              result: updatedJob.result,
              error: updatedJob.error_message,
            }),
          ]
        )

        return updatedJob
      })

      return job
    },

    /**
     * Retry a failed provisioning job.
     */
    async retryJob(
      jobId: string,
      tenantId: string,
      actorContext?: { actorId?: string; actorScope?: string }
    ): Promise<ProvisioningJobDto> {
      if (!isUuid(jobId)) {
        throw new ValidationError('jobId must be a valid UUID')
      }

      const existing = await this.getJobById(jobId, tenantId)
      if (existing.status === 'COMPLETED') {
        throw new ConflictError('CONFLICT_ERROR', 'Cannot retry a completed provisioning job')
      }

      if (existing.attempts >= existing.max_attempts) {
        throw new ConflictError(
          'CONFLICT_ERROR',
          `Maximum retry attempts reached (${existing.max_attempts})`
        )
      }

      return this.processJob(jobId, tenantId, actorContext)
    },

    /**
     * Retrieve a single provisioning job by ID.
     */
    async getJobById(jobId: string, tenantId?: string): Promise<ProvisioningJobDto> {
      if (!isUuid(jobId)) {
        throw new ValidationError('jobId must be a valid UUID')
      }

      let query = 'SELECT * FROM provisioning_jobs WHERE id = $1'
      const params: unknown[] = [jobId]
      if (tenantId) {
        query += ' AND business_id = $2'
        params.push(tenantId)
      }

      const res = await pool.query(query, params)
      if (res.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Provisioning job not found')
      }

      return mapRowToJobDto(res.rows[0])
    },

    /**
     * List provisioning jobs for a tenant or platform wide.
     */
    async listJobs(
      query: Record<string, unknown>,
      tenantId?: string
    ): Promise<{
      items: ProvisioningJobDto[]
      total: number
      limit: number
      offset: number
      has_more: boolean
    }> {
      const limit = Math.min(parseInt(String(query.limit ?? '50')), 500)
      const offset = Math.max(parseInt(String(query.offset ?? '0')), 0)

      let whereClauses: string[] = []
      const params: unknown[] = []
      let paramIdx = 1

      if (tenantId) {
        whereClauses.push(`business_id = $${paramIdx++}`)
        params.push(tenantId)
      } else if (typeof query.business_id === 'string' && isUuid(query.business_id)) {
        whereClauses.push(`business_id = $${paramIdx++}`)
        params.push(query.business_id)
      }

      if (query.service_code && typeof query.service_code === 'string') {
        whereClauses.push(`service_code = $${paramIdx++}`)
        params.push(query.service_code.toUpperCase())
      }

      if (query.status && typeof query.status === 'string') {
        whereClauses.push(`status = $${paramIdx++}`)
        params.push(query.status.toUpperCase())
      }

      if (query.action && typeof query.action === 'string') {
        whereClauses.push(`action = $${paramIdx++}`)
        params.push(query.action.toUpperCase())
      }

      const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

      const countRes = await pool.query(
        `SELECT COUNT(*) FROM provisioning_jobs ${whereStr}`,
        params
      )
      const total = parseInt(countRes.rows[0].count, 10)

      const selectParams = [...params, limit, offset]
      const selectQuery = `
        SELECT * FROM provisioning_jobs
        ${whereStr}
        ORDER BY created_at DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx++}
      `
      const resultRes = await pool.query(selectQuery, selectParams)
      const items = resultRes.rows.map(mapRowToJobDto)

      return {
        items,
        total,
        limit,
        offset,
        has_more: offset + items.length < total,
      }
    },

    /**
     * Retrieve audit logs for a job.
     */
    async getAuditLogs(jobId: string, tenantId?: string): Promise<ProvisioningAuditLogDto[]> {
      if (!isUuid(jobId)) {
        throw new ValidationError('jobId must be a valid UUID')
      }

      // First ensure access to the job
      await this.getJobById(jobId, tenantId)

      const query = `
        SELECT * FROM provisioning_audit_logs
        WHERE job_id = $1
        ORDER BY created_at ASC
      `
      const res = await pool.query(query, [jobId])
      return res.rows.map(mapRowToAuditDto)
    },
  }
}
