import { PoolClient } from 'pg'
import {
  DeviceDto,
  DeviceDetailDto,
  DeviceSummaryDto,
  DeviceQueryFilter,
  DeviceType,
  DeviceOwnershipType,
  DeviceStatus
} from '../dto/device_dto'

const DEVICE_COLUMNS = `
  id,
  business_id,
  branch_id,
  product_id,
  serial_number,
  mac_address,
  device_type,
  ownership_type,
  status,
  customer_id,
  installed_address,
  installed_at,
  warranty_months,
  warranty_expires_at,
  notes,
  metadata,
  created_at,
  updated_at
`

export const deviceRepository = {
  async findById(client: PoolClient, businessId: string, deviceId: string): Promise<DeviceDto | null> {
    const sql = `
      SELECT ${DEVICE_COLUMNS}
      FROM devices
      WHERE id = $1 AND business_id = $2
    `
    const res = await client.query(sql, [deviceId, businessId])
    return (res.rows[0] as DeviceDto | undefined) ?? null
  },

  async findByIdForUpdate(client: PoolClient, businessId: string, deviceId: string): Promise<DeviceDto | null> {
    const sql = `
      SELECT ${DEVICE_COLUMNS}
      FROM devices
      WHERE id = $1 AND business_id = $2
      FOR UPDATE
    `
    const res = await client.query(sql, [deviceId, businessId])
    return (res.rows[0] as DeviceDto | undefined) ?? null
  },

  async findBySerial(client: PoolClient, businessId: string, serialNumber: string): Promise<DeviceDto | null> {
    const sql = `
      SELECT ${DEVICE_COLUMNS}
      FROM devices
      WHERE business_id = $1 AND serial_number = $2
    `
    const res = await client.query(sql, [businessId, serialNumber])
    return (res.rows[0] as DeviceDto | undefined) ?? null
  },

  async findByMac(client: PoolClient, businessId: string, macAddress: string): Promise<DeviceDto | null> {
    const sql = `
      SELECT ${DEVICE_COLUMNS}
      FROM devices
      WHERE business_id = $1 AND mac_address = $2
    `
    const res = await client.query(sql, [businessId, macAddress])
    return (res.rows[0] as DeviceDto | undefined) ?? null
  },

  async list(
    client: PoolClient,
    businessId: string,
    filters: DeviceQueryFilter
  ): Promise<{ rows: DeviceDto[]; total: number }> {
    const conditions: string[] = ['business_id = $1']
    const params: unknown[] = [businessId]
    let paramIndex = 2

    if (filters.branch_id) {
      conditions.push(`branch_id = $${paramIndex++}`)
      params.push(filters.branch_id)
    }

    if (filters.customer_id) {
      conditions.push(`customer_id = $${paramIndex++}`)
      params.push(filters.customer_id)
    }

    if (filters.product_id) {
      conditions.push(`product_id = $${paramIndex++}`)
      params.push(filters.product_id)
    }

    if (filters.device_type) {
      conditions.push(`device_type = $${paramIndex++}`)
      params.push(filters.device_type)
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`)
      params.push(filters.status)
    }

    if (filters.ownership_type) {
      conditions.push(`ownership_type = $${paramIndex++}`)
      params.push(filters.ownership_type)
    }

    if (filters.search && filters.search.trim().length > 0) {
      const term = `%${filters.search.trim()}%`
      conditions.push(`(serial_number ILIKE $${paramIndex} OR mac_address ILIKE $${paramIndex + 1} OR notes ILIKE $${paramIndex + 2})`)
      params.push(term, term, term)
      paramIndex += 3
    }

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM devices
      WHERE ${conditions.join(' AND ')}
    `
    const countRes = await client.query(countSql, params)
    const total = countRes.rows[0].total as number

    const dataSql = `
      SELECT ${DEVICE_COLUMNS}
      FROM devices
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `
    const dataRes = await client.query(dataSql, [...params, filters.limit, filters.offset])

    return {
      rows: dataRes.rows as DeviceDto[],
      total
    }
  },

  async getSummary(client: PoolClient, businessId: string): Promise<DeviceSummaryDto> {
    const sql = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'IN_STOCK')::int AS in_stock_count,
        COUNT(*) FILTER (WHERE status = 'INSTALLED')::int AS installed_count,
        COUNT(*) FILTER (WHERE status = 'RESERVED')::int AS reserved_count,
        COUNT(*) FILTER (WHERE status = 'IN_REPAIR')::int AS in_repair_count,
        COUNT(*) FILTER (WHERE status = 'DEFECTIVE')::int AS defective_count,
        COUNT(*) FILTER (WHERE status = 'RETURNED')::int AS returned_count,
        COUNT(*) FILTER (WHERE status = 'DECOMMISSIONED')::int AS decommissioned_count
      FROM devices
      WHERE business_id = $1
    `
    const res = await client.query(sql, [businessId])
    const row = res.rows[0]
    return {
      total: Number(row.total) || 0,
      in_stock_count: Number(row.in_stock_count) || 0,
      installed_count: Number(row.installed_count) || 0,
      reserved_count: Number(row.reserved_count) || 0,
      in_repair_count: Number(row.in_repair_count) || 0,
      defective_count: Number(row.defective_count) || 0,
      returned_count: Number(row.returned_count) || 0,
      decommissioned_count: Number(row.decommissioned_count) || 0
    }
  },

  async getDetail(client: PoolClient, businessId: string, deviceId: string): Promise<DeviceDetailDto | null> {
    const sql = `
      SELECT
        d.id,
        d.business_id,
        d.branch_id,
        d.product_id,
        d.serial_number,
        d.mac_address,
        d.device_type,
        d.ownership_type,
        d.status,
        d.customer_id,
        d.installed_address,
        d.installed_at,
        d.warranty_months,
        d.warranty_expires_at,
        d.notes,
        d.metadata,
        d.created_at,
        d.updated_at,
        b.name AS branch_name,
        p.name AS product_name,
        p.sku AS product_sku,
        c.name AS customer_name,
        c.phone AS customer_phone,
        COUNT(s.id)::int AS service_count
      FROM devices d
      LEFT JOIN branches b ON b.id = d.branch_id AND b.business_id = d.business_id
      LEFT JOIN products p ON p.id = d.product_id AND p.business_id = d.business_id
      LEFT JOIN customers c ON c.id = d.customer_id AND c.business_id = d.business_id
      LEFT JOIN device_services s ON s.device_id = d.id AND s.business_id = d.business_id
      WHERE d.id = $1 AND d.business_id = $2
      GROUP BY d.id, b.name, p.name, p.sku, c.name, c.phone
    `
    const res = await client.query(sql, [deviceId, businessId])
    if (res.rows.length === 0) return null
    return res.rows[0] as DeviceDetailDto
  },

  async create(
    client: PoolClient,
    data: {
      id?: string
      business_id: string
      branch_id: string
      product_id?: string | null
      serial_number: string
      mac_address?: string | null
      device_type: DeviceType
      ownership_type: DeviceOwnershipType
      status: DeviceStatus
      customer_id?: string | null
      installed_address?: string | null
      installed_at?: string | null
      warranty_months?: number | null
      warranty_expires_at?: string | null
      notes?: string | null
      metadata?: Record<string, unknown>
    }
  ): Promise<DeviceDto> {
    const sql = `
      INSERT INTO devices (
        id, business_id, branch_id, product_id, serial_number, mac_address,
        device_type, ownership_type, status, customer_id, installed_address,
        installed_at, warranty_months, warranty_expires_at, notes, metadata,
        created_at, updated_at
      ) VALUES (
        COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, COALESCE($16, '{}'::jsonb),
        now(), now()
      )
      RETURNING ${DEVICE_COLUMNS}
    `
    const res = await client.query(sql, [
      data.id ?? null,
      data.business_id,
      data.branch_id,
      data.product_id ?? null,
      data.serial_number,
      data.mac_address ?? null,
      data.device_type,
      data.ownership_type,
      data.status,
      data.customer_id ?? null,
      data.installed_address ?? null,
      data.installed_at ?? null,
      data.warranty_months ?? 12,
      data.warranty_expires_at ?? null,
      data.notes ?? null,
      data.metadata ? JSON.stringify(data.metadata) : null
    ])
    return res.rows[0] as DeviceDto
  },

  async createBulk(
    client: PoolClient,
    businessId: string,
    branchId: string,
    deviceType: DeviceType,
    productId: string | null | undefined,
    ownershipType: DeviceOwnershipType,
    warrantyMonths: number | null | undefined,
    metadata: Record<string, unknown> | undefined,
    items: Array<{ serial_number: string; mac_address?: string | null; notes?: string | null }>
  ): Promise<DeviceDto[]> {
    const created: DeviceDto[] = []
    for (const item of items) {
      const dev = await this.create(client, {
        business_id: businessId,
        branch_id: branchId,
        product_id: productId ?? null,
        serial_number: item.serial_number,
        mac_address: item.mac_address ?? null,
        device_type: deviceType,
        ownership_type: ownershipType,
        status: 'IN_STOCK',
        warranty_months: warrantyMonths ?? 12,
        notes: item.notes ?? null,
        metadata: metadata ?? {}
      })
      created.push(dev)
    }
    return created
  },

  async update(
    client: PoolClient,
    businessId: string,
    deviceId: string,
    patch: {
      branch_id?: string
      product_id?: string | null
      device_type?: DeviceType
      ownership_type?: DeviceOwnershipType
      status?: DeviceStatus
      mac_address?: string | null
      customer_id?: string | null
      installed_address?: string | null
      installed_at?: string | null
      warranty_months?: number | null
      warranty_expires_at?: string | null
      notes?: string | null
      metadata?: Record<string, unknown>
    }
  ): Promise<DeviceDto | null> {
    const setClauses: string[] = []
    const values: unknown[] = [deviceId, businessId]
    let paramIndex = 3

    if (patch.branch_id !== undefined) {
      setClauses.push(`branch_id = $${paramIndex++}`)
      values.push(patch.branch_id)
    }

    if (patch.product_id !== undefined) {
      setClauses.push(`product_id = $${paramIndex++}`)
      values.push(patch.product_id)
    }

    if (patch.device_type !== undefined) {
      setClauses.push(`device_type = $${paramIndex++}`)
      values.push(patch.device_type)
    }

    if (patch.ownership_type !== undefined) {
      setClauses.push(`ownership_type = $${paramIndex++}`)
      values.push(patch.ownership_type)
    }

    if (patch.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`)
      values.push(patch.status)
    }

    if (patch.mac_address !== undefined) {
      setClauses.push(`mac_address = $${paramIndex++}`)
      values.push(patch.mac_address)
    }

    if (patch.customer_id !== undefined) {
      setClauses.push(`customer_id = $${paramIndex++}`)
      values.push(patch.customer_id)
    }

    if (patch.installed_address !== undefined) {
      setClauses.push(`installed_address = $${paramIndex++}`)
      values.push(patch.installed_address)
    }

    if (patch.installed_at !== undefined) {
      setClauses.push(`installed_at = $${paramIndex++}`)
      values.push(patch.installed_at)
    }

    if (patch.warranty_months !== undefined) {
      setClauses.push(`warranty_months = $${paramIndex++}`)
      values.push(patch.warranty_months)
    }

    if (patch.warranty_expires_at !== undefined) {
      setClauses.push(`warranty_expires_at = $${paramIndex++}`)
      values.push(patch.warranty_expires_at)
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
      return this.findById(client, businessId, deviceId)
    }

    setClauses.push('updated_at = now()')

    const sql = `
      UPDATE devices
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND business_id = $2
      RETURNING ${DEVICE_COLUMNS}
    `
    const res = await client.query(sql, values)
    return (res.rows[0] as DeviceDto | undefined) ?? null
  }
}
