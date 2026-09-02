import { Pool } from 'pg'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'
import {
  PlatformAuditLogDto,
  CreatePlatformAuditLogInput,
  EcosystemHealthDto,
  EcosystemMetricsDto,
} from '../dto/audit_dto'

function mapRowToAuditDto(row: Record<string, unknown>): PlatformAuditLogDto {
  return {
    id: row.id as string,
    actor_id: (row.actor_id as string) ?? null,
    actor_email: (row.actor_email as string) ?? null,
    actor_scope: row.actor_scope as 'platform' | 'tenant' | 'system',
    actor_role: (row.actor_role as string) ?? null,
    action: row.action as string,
    service_code: (row.service_code as string) ?? null,
    target_type: row.target_type as string,
    target_id: (row.target_id as string) ?? null,
    before_state: (row.before_state as Record<string, unknown>) ?? null,
    after_state: (row.after_state as Record<string, unknown>) ?? null,
    diff: (row.diff as Record<string, unknown>) ?? null,
    request_id: (row.request_id as string) ?? null,
    ip_address: (row.ip_address as string) ?? null,
    user_agent: (row.user_agent as string) ?? null,
    status: row.status as 'SUCCESS' | 'FAILURE',
    error_message: (row.error_message as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
  }
}

export function createAuditService(pool: Pool) {
  return {
    /**
     * Record an audit log entry.
     */
    async recordAudit(input: CreatePlatformAuditLogInput): Promise<PlatformAuditLogDto> {
      const query = `
        INSERT INTO platform_audit_logs (
          actor_id, actor_email, actor_scope, actor_role, action, service_code,
          target_type, target_id, before_state, after_state, diff,
          request_id, ip_address, user_agent, status, error_message, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17
        )
        RETURNING *
      `
      const values = [
        input.actor_id ?? null,
        input.actor_email ?? null,
        input.actor_scope,
        input.actor_role ?? null,
        input.action,
        input.service_code ?? null,
        input.target_type,
        input.target_id ?? null,
        input.before_state ? JSON.stringify(input.before_state) : null,
        input.after_state ? JSON.stringify(input.after_state) : null,
        input.diff ? JSON.stringify(input.diff) : null,
        input.request_id ?? null,
        input.ip_address ?? null,
        input.user_agent ?? null,
        input.status ?? 'SUCCESS',
        input.error_message ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]

      const res = await pool.query(query, values)
      return mapRowToAuditDto(res.rows[0])
    },

    /**
     * List audit logs with multi-dimensional filtering and pagination.
     */
    async listAuditLogs(query: Record<string, unknown>): Promise<{
      items: PlatformAuditLogDto[]
      total: number
      limit: number
      offset: number
      has_more: boolean
    }> {
      const limit = Math.min(parseInt(String(query.limit ?? '50')), 500)
      const offset = Math.max(parseInt(String(query.offset ?? '0')), 0)

      const whereClauses: string[] = []
      const params: unknown[] = []
      let paramIdx = 1

      if (query.actor_id && typeof query.actor_id === 'string') {
        whereClauses.push(`actor_id = $${paramIdx++}`)
        params.push(query.actor_id)
      }

      if (query.actor_scope && typeof query.actor_scope === 'string') {
        whereClauses.push(`actor_scope = $${paramIdx++}`)
        params.push(query.actor_scope)
      }

      if (query.action && typeof query.action === 'string') {
        whereClauses.push(`action = $${paramIdx++}`)
        params.push(query.action)
      }

      if (query.service_code && typeof query.service_code === 'string') {
        whereClauses.push(`service_code = $${paramIdx++}`)
        params.push(query.service_code.toUpperCase())
      }

      if (query.target_type && typeof query.target_type === 'string') {
        whereClauses.push(`target_type = $${paramIdx++}`)
        params.push(query.target_type)
      }

      if (query.target_id && typeof query.target_id === 'string') {
        whereClauses.push(`target_id = $${paramIdx++}`)
        params.push(query.target_id)
      }

      if (query.request_id && typeof query.request_id === 'string') {
        whereClauses.push(`request_id = $${paramIdx++}`)
        params.push(query.request_id)
      }

      if (query.status && typeof query.status === 'string') {
        whereClauses.push(`status = $${paramIdx++}`)
        params.push(query.status.toUpperCase())
      }

      if (query.from_date && typeof query.from_date === 'string') {
        whereClauses.push(`created_at >= $${paramIdx++}`)
        params.push(query.from_date)
      }

      if (query.to_date && typeof query.to_date === 'string') {
        whereClauses.push(`created_at <= $${paramIdx++}`)
        params.push(query.to_date)
      }

      const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

      const countRes = await pool.query(
        `SELECT COUNT(*) FROM platform_audit_logs ${whereStr}`,
        params
      )
      const total = parseInt(countRes.rows[0].count, 10)

      const selectParams = [...params, limit, offset]
      const selectQuery = `
        SELECT * FROM platform_audit_logs
        ${whereStr}
        ORDER BY created_at DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx++}
      `
      const resultRes = await pool.query(selectQuery, selectParams)
      const items = resultRes.rows.map(mapRowToAuditDto)

      return {
        items,
        total,
        limit,
        offset,
        has_more: offset + items.length < total,
      }
    },

    /**
     * Get a specific audit log by ID.
     */
    async getAuditLogById(id: string): Promise<PlatformAuditLogDto> {
      if (!isUuid(id)) {
        throw new ValidationError('id must be a valid UUID')
      }

      const res = await pool.query(
        'SELECT * FROM platform_audit_logs WHERE id = $1',
        [id]
      )

      if (res.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Audit log not found')
      }

      return mapRowToAuditDto(res.rows[0])
    },

    /**
     * Retrieve ecosystem health status and infrastructure metrics.
     */
    async getEcosystemHealth(): Promise<EcosystemHealthDto> {
      const start = Date.now()
      let dbConnected = true
      try {
        await pool.query('SELECT 1')
      } catch {
        dbConnected = false
      }
      const latencyMs = Date.now() - start

      const mem = process.memoryUsage()

      return {
        status: dbConnected ? (latencyMs < 500 ? 'healthy' : 'degraded') : 'unhealthy',
        version: '0.1.0',
        environment: process.env.NODE_ENV || 'development',
        uptime_seconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        database: {
          status: dbConnected ? 'connected' : 'disconnected',
          latency_ms: latencyMs,
          pool: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          },
        },
        memory: {
          heap_used_mb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
          heap_total_mb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
          rss_mb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        },
      }
    },

    /**
     * Retrieve ecosystem business, service, and provisioning failure metrics.
     */
    async getEcosystemMetrics(): Promise<EcosystemMetricsDto> {
      // 1. Services aggregation
      const servicesRes = await pool.query(
        `SELECT lifecycle_status, service_type, COUNT(*) as count 
         FROM services 
         GROUP BY lifecycle_status, service_type`
      )
      const serviceByStatus: Record<string, number> = {}
      const serviceByType: Record<string, number> = {}
      let totalServices = 0

      for (const row of servicesRes.rows) {
        const c = parseInt(row.count, 10)
        totalServices += c
        serviceByStatus[row.lifecycle_status] = (serviceByStatus[row.lifecycle_status] || 0) + c
        serviceByType[row.service_type] = (serviceByType[row.service_type] || 0) + c
      }

      // 2. Tenants aggregation
      const businessesRes = await pool.query(
        `SELECT status, COUNT(*) as count 
         FROM businesses 
         GROUP BY status`
      )
      const tenantByStatus: Record<string, number> = {}
      let totalTenants = 0
      for (const row of businessesRes.rows) {
        const c = parseInt(row.count, 10)
        totalTenants += c
        tenantByStatus[row.status] = (tenantByStatus[row.status] || 0) + c
      }

      // 3. Provisioning jobs aggregation
      const provRes = await pool.query(
        `SELECT status, COUNT(*) as count 
         FROM provisioning_jobs 
         GROUP BY status`
      )
      const provByStatus: Record<string, number> = {}
      let totalJobs = 0
      let failedJobs = 0
      for (const row of provRes.rows) {
        const c = parseInt(row.count, 10)
        totalJobs += c
        provByStatus[row.status] = c
        if (row.status === 'FAILED') {
          failedJobs += c
        }
      }

      const failureRate = totalJobs > 0 ? Math.round((failedJobs / totalJobs) * 10000) / 100 : 0

      return {
        timestamp: new Date().toISOString(),
        services: {
          total: totalServices,
          by_status: serviceByStatus,
          by_type: serviceByType,
        },
        tenants: {
          total: totalTenants,
          by_status: tenantByStatus,
        },
        provisioning: {
          total_jobs: totalJobs,
          by_status: provByStatus,
          failure_rate_percentage: failureRate,
          recent_failed_jobs_count: failedJobs,
        },
      }
    },
  }
}
