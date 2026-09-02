export interface PlatformAuditLogDto {
  id: string
  actor_id: string | null
  actor_email: string | null
  actor_scope: 'platform' | 'tenant' | 'system'
  actor_role: string | null
  action: string
  service_code: string | null
  target_type: string
  target_id: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  diff: Record<string, unknown> | null
  request_id: string | null
  ip_address: string | null
  user_agent: string | null
  status: 'SUCCESS' | 'FAILURE'
  error_message: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface CreatePlatformAuditLogInput {
  actor_id?: string | null
  actor_email?: string | null
  actor_scope: 'platform' | 'tenant' | 'system'
  actor_role?: string | null
  action: string
  service_code?: string | null
  target_type: string
  target_id?: string | null
  before_state?: Record<string, unknown> | null
  after_state?: Record<string, unknown> | null
  diff?: Record<string, unknown> | null
  request_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
  status?: 'SUCCESS' | 'FAILURE'
  error_message?: string | null
  metadata?: Record<string, unknown>
}

export interface EcosystemHealthDto {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  environment: string
  uptime_seconds: number
  timestamp: string
  database: {
    status: 'connected' | 'disconnected'
    latency_ms: number
    pool: {
      total: number
      idle: number
      waiting: number
    }
  }
  memory: {
    heap_used_mb: number
    heap_total_mb: number
    rss_mb: number
  }
}

export interface EcosystemMetricsDto {
  timestamp: string
  services: {
    total: number
    by_status: Record<string, number>
    by_type: Record<string, number>
  }
  tenants: {
    total: number
    by_status: Record<string, number>
  }
  provisioning: {
    total_jobs: number
    by_status: Record<string, number>
    failure_rate_percentage: number
    recent_failed_jobs_count: number
  }
}
