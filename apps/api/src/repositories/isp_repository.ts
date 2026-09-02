import { Pool, PoolClient } from 'pg'
import {
  CreateIspGatewayRequest,
  UpdateIspGatewayRequest,
  IspGatewayDto,
  CreateIspSubscriberRequest,
  UpdateIspSubscriberRequest,
  IspSubscriberDto,
  IspSubscriberStatus,
} from '../dto/isp_dto'

function mapGatewayRow(row: Record<string, unknown>): IspGatewayDto {
  return {
    id: row.id as string,
    business_id: row.business_id as string,
    name: row.name as string,
    gateway_type: row.gateway_type as any,
    host: row.host as string,
    port: Number(row.port),
    use_tls: Boolean(row.use_tls),
    auth_username: (row.auth_username as string) ?? null,
    auth_secret_masked: row.auth_secret_encrypted ? '********' : null,
    status: row.status as any,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

function mapSubscriberRow(row: Record<string, unknown>): IspSubscriberDto {
  return {
    id: row.id as string,
    business_id: row.business_id as string,
    customer_id: row.customer_id as string,
    subscription_id: (row.subscription_id as string) ?? null,
    plan_code: row.plan_code as string,
    network_gateway_id: row.network_gateway_id as string,
    acs_gateway_id: (row.acs_gateway_id as string) ?? null,
    mesh_gateway_id: (row.mesh_gateway_id as string) ?? null,
    pppoe_username: row.pppoe_username as string,
    pppoe_password_masked: row.pppoe_password_encrypted ? '********' : null,
    ip_address: (row.ip_address as string) ?? null,
    ont_serial_number: (row.ont_serial_number as string) ?? null,
    ont_vlan: row.ont_vlan !== null && row.ont_vlan !== undefined ? Number(row.ont_vlan) : null,
    status: row.status as IspSubscriberStatus,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export function createIspRepository(pool: Pool) {
  return {
    // -------------------------------------------------------------------------
    // Gateways
    // -------------------------------------------------------------------------
    async createGateway(
      businessId: string,
      req: CreateIspGatewayRequest,
      client?: PoolClient
    ): Promise<IspGatewayDto> {
      const db = client || pool
      const query = `
        INSERT INTO isp_gateways (
          business_id, name, gateway_type, host, port, use_tls, auth_username, auth_secret_encrypted, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `
      const res = await db.query(query, [
        businessId,
        req.name,
        req.gateway_type,
        req.host,
        req.port,
        req.use_tls ?? true,
        req.auth_username ?? null,
        req.auth_secret ?? null,
        JSON.stringify(req.metadata ?? {}),
      ])
      return mapGatewayRow(res.rows[0])
    },

    async getGatewayById(
      id: string,
      businessId: string,
      client?: PoolClient
    ): Promise<IspGatewayDto | null> {
      const db = client || pool
      const query = 'SELECT * FROM isp_gateways WHERE id = $1 AND business_id = $2'
      const res = await db.query(query, [id, businessId])
      if (res.rows.length === 0) return null
      return mapGatewayRow(res.rows[0])
    },

    async listGateways(
      businessId: string,
      client?: PoolClient
    ): Promise<IspGatewayDto[]> {
      const db = client || pool
      const query = 'SELECT * FROM isp_gateways WHERE business_id = $1 ORDER BY created_at DESC'
      const res = await db.query(query, [businessId])
      return res.rows.map(mapGatewayRow)
    },

    async updateGateway(
      id: string,
      businessId: string,
      req: UpdateIspGatewayRequest,
      client?: PoolClient
    ): Promise<IspGatewayDto | null> {
      const db = client || pool
      const updates: string[] = ['updated_at = NOW()']
      const values: unknown[] = [id, businessId]
      let idx = 3

      if (req.name !== undefined) {
        updates.push(`name = $${idx++}`)
        values.push(req.name)
      }
      if (req.host !== undefined) {
        updates.push(`host = $${idx++}`)
        values.push(req.host)
      }
      if (req.port !== undefined) {
        updates.push(`port = $${idx++}`)
        values.push(req.port)
      }
      if (req.use_tls !== undefined) {
        updates.push(`use_tls = $${idx++}`)
        values.push(req.use_tls)
      }
      if (req.auth_username !== undefined) {
        updates.push(`auth_username = $${idx++}`)
        values.push(req.auth_username)
      }
      if (req.auth_secret !== undefined) {
        updates.push(`auth_secret_encrypted = $${idx++}`)
        values.push(req.auth_secret)
      }
      if (req.status !== undefined) {
        updates.push(`status = $${idx++}`)
        values.push(req.status)
      }
      if (req.metadata !== undefined) {
        updates.push(`metadata = $${idx++}`)
        values.push(JSON.stringify(req.metadata))
      }

      const query = `
        UPDATE isp_gateways
        SET ${updates.join(', ')}
        WHERE id = $1 AND business_id = $2
        RETURNING *
      `
      const res = await db.query(query, values)
      if (res.rows.length === 0) return null
      return mapGatewayRow(res.rows[0])
    },

    async deleteGateway(
      id: string,
      businessId: string,
      client?: PoolClient
    ): Promise<boolean> {
      const db = client || pool
      const query = 'DELETE FROM isp_gateways WHERE id = $1 AND business_id = $2'
      const res = await db.query(query, [id, businessId])
      return (res.rowCount ?? 0) > 0
    },

    // -------------------------------------------------------------------------
    // Subscribers
    // -------------------------------------------------------------------------
    async createSubscriber(
      businessId: string,
      req: CreateIspSubscriberRequest,
      client?: PoolClient
    ): Promise<IspSubscriberDto> {
      const db = client || pool
      const query = `
        INSERT INTO isp_subscribers (
          business_id, customer_id, subscription_id, plan_code,
          network_gateway_id, acs_gateway_id, mesh_gateway_id,
          pppoe_username, pppoe_password_encrypted, ip_address, ont_serial_number, ont_vlan, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `
      const res = await db.query(query, [
        businessId,
        req.customer_id,
        req.subscription_id ?? null,
        req.plan_code,
        req.network_gateway_id,
        req.acs_gateway_id ?? null,
        req.mesh_gateway_id ?? null,
        req.pppoe_username,
        req.pppoe_password || 'secret123',
        req.ip_address ?? null,
        req.ont_serial_number ?? null,
        req.ont_vlan ?? null,
        JSON.stringify(req.metadata ?? {}),
      ])
      return mapSubscriberRow(res.rows[0])
    },

    async getSubscriberById(
      id: string,
      businessId: string,
      client?: PoolClient
    ): Promise<IspSubscriberDto | null> {
      const db = client || pool
      const query = 'SELECT * FROM isp_subscribers WHERE id = $1 AND business_id = $2'
      const res = await db.query(query, [id, businessId])
      if (res.rows.length === 0) return null
      return mapSubscriberRow(res.rows[0])
    },

    async getSubscriberByOntSerial(
      businessId: string,
      ontSerial: string,
      client?: PoolClient
    ): Promise<IspSubscriberDto | null> {
      const db = client || pool
      const query = 'SELECT * FROM isp_subscribers WHERE business_id = $1 AND ont_serial_number = $2'
      const res = await db.query(query, [businessId, ontSerial])
      if (res.rows.length === 0) return null
      return mapSubscriberRow(res.rows[0])
    },

    async listSubscribers(
      businessId: string,
      queryFilter?: { customer_id?: string; status?: string },
      client?: PoolClient
    ): Promise<IspSubscriberDto[]> {
      const db = client || pool
      const where: string[] = ['business_id = $1']
      const params: unknown[] = [businessId]
      let idx = 2

      if (queryFilter?.customer_id) {
        where.push(`customer_id = $${idx++}`)
        params.push(queryFilter.customer_id)
      }
      if (queryFilter?.status) {
        where.push(`status = $${idx++}`)
        params.push(queryFilter.status.toUpperCase())
      }

      const query = `
        SELECT * FROM isp_subscribers
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC
      `
      const res = await db.query(query, params)
      return res.rows.map(mapSubscriberRow)
    },

    async updateSubscriber(
      id: string,
      businessId: string,
      req: UpdateIspSubscriberRequest,
      client?: PoolClient
    ): Promise<IspSubscriberDto | null> {
      const db = client || pool
      const updates: string[] = ['updated_at = NOW()']
      const values: unknown[] = [id, businessId]
      let idx = 3

      if (req.plan_code !== undefined) {
        updates.push(`plan_code = $${idx++}`)
        values.push(req.plan_code)
      }
      if (req.network_gateway_id !== undefined) {
        updates.push(`network_gateway_id = $${idx++}`)
        values.push(req.network_gateway_id)
      }
      if (req.acs_gateway_id !== undefined) {
        updates.push(`acs_gateway_id = $${idx++}`)
        values.push(req.acs_gateway_id)
      }
      if (req.mesh_gateway_id !== undefined) {
        updates.push(`mesh_gateway_id = $${idx++}`)
        values.push(req.mesh_gateway_id)
      }
      if (req.pppoe_password !== undefined) {
        updates.push(`pppoe_password_encrypted = $${idx++}`)
        values.push(req.pppoe_password)
      }
      if (req.ip_address !== undefined) {
        updates.push(`ip_address = $${idx++}`)
        values.push(req.ip_address)
      }
      if (req.ont_serial_number !== undefined) {
        updates.push(`ont_serial_number = $${idx++}`)
        values.push(req.ont_serial_number)
      }
      if (req.ont_vlan !== undefined) {
        updates.push(`ont_vlan = $${idx++}`)
        values.push(req.ont_vlan)
      }
      if (req.metadata !== undefined) {
        updates.push(`metadata = $${idx++}`)
        values.push(JSON.stringify(req.metadata))
      }

      const query = `
        UPDATE isp_subscribers
        SET ${updates.join(', ')}
        WHERE id = $1 AND business_id = $2
        RETURNING *
      `
      const res = await db.query(query, values)
      if (res.rows.length === 0) return null
      return mapSubscriberRow(res.rows[0])
    },

    async updateSubscriberStatus(
      id: string,
      businessId: string,
      status: IspSubscriberStatus,
      client?: PoolClient
    ): Promise<IspSubscriberDto | null> {
      const db = client || pool
      const query = `
        UPDATE isp_subscribers
        SET status = $1, updated_at = NOW()
        WHERE id = $2 AND business_id = $3
        RETURNING *
      `
      const res = await db.query(query, [status, id, businessId])
      if (res.rows.length === 0) return null
      return mapSubscriberRow(res.rows[0])
    },
  }
}
