import { PoolClient } from 'pg'
import {
  DeviceServiceDto,
  DeviceServiceDetailDto,
  DeviceServiceQueryFilter,
  DeviceServiceType,
  DeviceServiceStatus
} from '../dto/device_service_dto'

const DEVICE_SERVICE_COLUMNS = `
  id,
  business_id,
  device_id,
  customer_id,
  service_type,
  status,
  technician_name,
  scheduled_at,
  completed_at,
  replacement_device_id,
  findings,
  action_taken,
  notes,
  metadata,
  created_at,
  updated_at
`

export const deviceServiceRepository = {
  async findById(client: PoolClient, businessId: string, serviceId: string): Promise<DeviceServiceDto | null> {
    const sql = `
      SELECT ${DEVICE_SERVICE_COLUMNS}
      FROM device_services
      WHERE id = $1 AND business_id = $2
    `
    const res = await client.query(sql, [serviceId, businessId])
    return (res.rows[0] as DeviceServiceDto | undefined) ?? null
  },

  async findByIdForUpdate(client: PoolClient, businessId: string, serviceId: string): Promise<DeviceServiceDto | null> {
    const sql = `
      SELECT ${DEVICE_SERVICE_COLUMNS}
      FROM device_services
      WHERE id = $1 AND business_id = $2
      FOR UPDATE
    `
    const res = await client.query(sql, [serviceId, businessId])
    return (res.rows[0] as DeviceServiceDto | undefined) ?? null
  },

  async list(
    client: PoolClient,
    businessId: string,
    filters: DeviceServiceQueryFilter
  ): Promise<{ rows: DeviceServiceDto[]; total: number }> {
    const conditions: string[] = ['business_id = $1']
    const params: unknown[] = [businessId]
    let paramIndex = 2

    if (filters.device_id) {
      conditions.push(`device_id = $${paramIndex++}`)
      params.push(filters.device_id)
    }

    if (filters.customer_id) {
      conditions.push(`customer_id = $${paramIndex++}`)
      params.push(filters.customer_id)
    }

    if (filters.service_type) {
      conditions.push(`service_type = $${paramIndex++}`)
      params.push(filters.service_type)
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`)
      params.push(filters.status)
    }

    if (filters.technician_name && filters.technician_name.trim().length > 0) {
      conditions.push(`technician_name ILIKE $${paramIndex++}`)
      params.push(`%${filters.technician_name.trim()}%`)
    }

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM device_services
      WHERE ${conditions.join(' AND ')}
    `
    const countRes = await client.query(countSql, params)
    const total = countRes.rows[0].total as number

    const dataSql = `
      SELECT ${DEVICE_SERVICE_COLUMNS}
      FROM device_services
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `
    const dataRes = await client.query(dataSql, [...params, filters.limit, filters.offset])

    return {
      rows: dataRes.rows as DeviceServiceDto[],
      total
    }
  },

  async listByDeviceId(client: PoolClient, businessId: string, deviceId: string, limit = 50): Promise<DeviceServiceDto[]> {
    const sql = `
      SELECT ${DEVICE_SERVICE_COLUMNS}
      FROM device_services
      WHERE business_id = $1 AND device_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `
    const res = await client.query(sql, [businessId, deviceId, limit])
    return res.rows as DeviceServiceDto[]
  },

  async getDetail(client: PoolClient, businessId: string, serviceId: string): Promise<DeviceServiceDetailDto | null> {
    const sql = `
      SELECT
        s.id,
        s.business_id,
        s.device_id,
        s.customer_id,
        s.service_type,
        s.status,
        s.technician_name,
        s.scheduled_at,
        s.completed_at,
        s.replacement_device_id,
        s.findings,
        s.action_taken,
        s.notes,
        s.metadata,
        s.created_at,
        s.updated_at,
        d.serial_number AS device_serial,
        d.device_type AS device_type,
        p.name AS device_model,
        c.name AS customer_name,
        c.phone AS customer_phone,
        rd.serial_number AS replacement_device_serial
      FROM device_services s
      JOIN devices d ON d.id = s.device_id AND d.business_id = s.business_id
      LEFT JOIN products p ON p.id = d.product_id AND p.business_id = d.business_id
      LEFT JOIN customers c ON c.id = s.customer_id AND c.business_id = s.business_id
      LEFT JOIN devices rd ON rd.id = s.replacement_device_id AND rd.business_id = s.business_id
      WHERE s.id = $1 AND s.business_id = $2
    `
    const res = await client.query(sql, [serviceId, businessId])
    if (res.rows.length === 0) return null
    return res.rows[0] as DeviceServiceDetailDto
  },

  async create(
    client: PoolClient,
    data: {
      id?: string
      business_id: string
      device_id: string
      customer_id?: string | null
      service_type: DeviceServiceType
      status: DeviceServiceStatus
      technician_name?: string | null
      scheduled_at?: string | null
      completed_at?: string | null
      replacement_device_id?: string | null
      findings?: string | null
      action_taken?: string | null
      notes?: string | null
      metadata?: Record<string, unknown>
    }
  ): Promise<DeviceServiceDto> {
    const sql = `
      INSERT INTO device_services (
        id, business_id, device_id, customer_id, service_type, status,
        technician_name, scheduled_at, completed_at, replacement_device_id,
        findings, action_taken, notes, metadata,
        created_at, updated_at
      ) VALUES (
        COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, COALESCE($14, '{}'::jsonb),
        now(), now()
      )
      RETURNING ${DEVICE_SERVICE_COLUMNS}
    `
    const res = await client.query(sql, [
      data.id ?? null,
      data.business_id,
      data.device_id,
      data.customer_id ?? null,
      data.service_type,
      data.status,
      data.technician_name ?? null,
      data.scheduled_at ?? null,
      data.completed_at ?? null,
      data.replacement_device_id ?? null,
      data.findings ?? null,
      data.action_taken ?? null,
      data.notes ?? null,
      data.metadata ? JSON.stringify(data.metadata) : null
    ])
    return res.rows[0] as DeviceServiceDto
  },

  async update(
    client: PoolClient,
    businessId: string,
    serviceId: string,
    patch: {
      status?: DeviceServiceStatus
      technician_name?: string | null
      scheduled_at?: string | null
      completed_at?: string | null
      replacement_device_id?: string | null
      findings?: string | null
      action_taken?: string | null
      notes?: string | null
      metadata?: Record<string, unknown>
    }
  ): Promise<DeviceServiceDto | null> {
    const setClauses: string[] = []
    const values: unknown[] = [serviceId, businessId]
    let paramIndex = 3

    if (patch.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`)
      values.push(patch.status)
    }

    if (patch.technician_name !== undefined) {
      setClauses.push(`technician_name = $${paramIndex++}`)
      values.push(patch.technician_name)
    }

    if (patch.scheduled_at !== undefined) {
      setClauses.push(`scheduled_at = $${paramIndex++}`)
      values.push(patch.scheduled_at)
    }

    if (patch.completed_at !== undefined) {
      setClauses.push(`completed_at = $${paramIndex++}`)
      values.push(patch.completed_at)
    }

    if (patch.replacement_device_id !== undefined) {
      setClauses.push(`replacement_device_id = $${paramIndex++}`)
      values.push(patch.replacement_device_id)
    }

    if (patch.findings !== undefined) {
      setClauses.push(`findings = $${paramIndex++}`)
      values.push(patch.findings)
    }

    if (patch.action_taken !== undefined) {
      setClauses.push(`action_taken = $${paramIndex++}`)
      values.push(patch.action_taken)
    }

    if (patch.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`)
      values.push(patch.notes)
    }

    if (patch.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`)
      values.push(JSON.stringify(patch.metadata))
    }

    if (setClauses.length === 0) {
      return this.findById(client, businessId, serviceId)
    }

    setClauses.push('updated_at = now()')

    const sql = `
      UPDATE device_services
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND business_id = $2
      RETURNING ${DEVICE_SERVICE_COLUMNS}
    `
    const res = await client.query(sql, values)
    return (res.rows[0] as DeviceServiceDto | undefined) ?? null
  }
}
