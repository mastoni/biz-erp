import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

export type GatewayType = 'MIKROTIK' | 'GENIEACS' | 'OPENWISP' | 'RADIUS'
export type GatewayStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
export type IspSubscriberStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED'

export const VALID_GATEWAY_TYPES: ReadonlyArray<GatewayType> = [
  'MIKROTIK',
  'GENIEACS',
  'OPENWISP',
  'RADIUS',
]

export const VALID_GATEWAY_STATUSES: ReadonlyArray<GatewayStatus> = [
  'ACTIVE',
  'INACTIVE',
  'MAINTENANCE',
]

export const VALID_SUBSCRIBER_STATUSES: ReadonlyArray<IspSubscriberStatus> = [
  'PENDING_ACTIVATION',
  'ACTIVE',
  'SUSPENDED',
  'TERMINATED',
]

// ---------------------------------------------------------------------------
// Gateway DTOs
// ---------------------------------------------------------------------------

export interface CreateIspGatewayRequest {
  name: string
  gateway_type: GatewayType
  host: string
  port: number
  use_tls?: boolean
  auth_username?: string | null
  auth_secret?: string | null
  metadata?: Record<string, unknown>
}

export interface UpdateIspGatewayRequest {
  name?: string
  host?: string
  port?: number
  use_tls?: boolean
  auth_username?: string | null
  auth_secret?: string | null
  status?: GatewayStatus
  metadata?: Record<string, unknown>
}

export interface IspGatewayDto {
  id: string
  business_id: string
  name: string
  gateway_type: GatewayType
  host: string
  port: number
  use_tls: boolean
  auth_username: string | null
  auth_secret_masked: string | null
  status: GatewayStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Subscriber DTOs
// ---------------------------------------------------------------------------

export interface CreateIspSubscriberRequest {
  customer_id: string
  subscription_id?: string | null
  plan_code: string
  network_gateway_id: string
  acs_gateway_id?: string | null
  mesh_gateway_id?: string | null
  pppoe_username: string
  pppoe_password?: string | null
  ip_address?: string | null
  ont_serial_number?: string | null
  ont_vlan?: number | null
  metadata?: Record<string, unknown>
}

export interface UpdateIspSubscriberRequest {
  plan_code?: string
  network_gateway_id?: string
  acs_gateway_id?: string | null
  mesh_gateway_id?: string | null
  pppoe_password?: string | null
  ip_address?: string | null
  ont_serial_number?: string | null
  ont_vlan?: number | null
  metadata?: Record<string, unknown>
}

export interface IspSubscriberDto {
  id: string
  business_id: string
  customer_id: string
  subscription_id: string | null
  plan_code: string
  network_gateway_id: string
  acs_gateway_id: string | null
  mesh_gateway_id: string | null
  pppoe_username: string
  pppoe_password_masked: string | null
  ip_address: string | null
  ont_serial_number: string | null
  ont_vlan: number | null
  status: IspSubscriberStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function validateCreateIspGateway(body: unknown): CreateIspGatewayRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be an object')
  }

  const b = body as Record<string, unknown>

  if (typeof b.name !== 'string' || b.name.trim().length === 0) {
    throw new ValidationError('name is required and must be a non-empty string')
  }

  const gatewayType = String(b.gateway_type || '').toUpperCase() as GatewayType
  if (!VALID_GATEWAY_TYPES.includes(gatewayType)) {
    throw new ValidationError(`gateway_type must be one of: ${VALID_GATEWAY_TYPES.join(', ')}`)
  }

  if (typeof b.host !== 'string' || b.host.trim().length === 0) {
    throw new ValidationError('host is required and must be a non-empty string')
  }

  const port = Number(b.port)
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new ValidationError('port must be a valid TCP port number between 1 and 65535')
  }

  return {
    name: b.name.trim(),
    gateway_type: gatewayType,
    host: b.host.trim(),
    port,
    use_tls: b.use_tls === undefined ? true : Boolean(b.use_tls),
    auth_username: typeof b.auth_username === 'string' ? b.auth_username.trim() : null,
    auth_secret: typeof b.auth_secret === 'string' ? b.auth_secret : null,
    metadata: typeof b.metadata === 'object' && b.metadata !== null && !Array.isArray(b.metadata)
      ? (b.metadata as Record<string, unknown>)
      : {},
  }
}

export function validateUpdateIspGateway(body: unknown): UpdateIspGatewayRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be an object')
  }

  const b = body as Record<string, unknown>
  const result: UpdateIspGatewayRequest = {}

  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || b.name.trim().length === 0) {
      throw new ValidationError('name must be a non-empty string')
    }
    result.name = b.name.trim()
  }

  if (b.host !== undefined) {
    if (typeof b.host !== 'string' || b.host.trim().length === 0) {
      throw new ValidationError('host must be a non-empty string')
    }
    result.host = b.host.trim()
  }

  if (b.port !== undefined) {
    const port = Number(b.port)
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new ValidationError('port must be a valid TCP port number between 1 and 65535')
    }
    result.port = port
  }

  if (b.use_tls !== undefined) {
    result.use_tls = Boolean(b.use_tls)
  }

  if (b.auth_username !== undefined) {
    result.auth_username = typeof b.auth_username === 'string' ? b.auth_username.trim() : null
  }

  if (b.auth_secret !== undefined) {
    result.auth_secret = typeof b.auth_secret === 'string' ? b.auth_secret : null
  }

  if (b.status !== undefined) {
    const status = String(b.status).toUpperCase() as GatewayStatus
    if (!VALID_GATEWAY_STATUSES.includes(status)) {
      throw new ValidationError(`status must be one of: ${VALID_GATEWAY_STATUSES.join(', ')}`)
    }
    result.status = status
  }

  if (b.metadata !== undefined) {
    if (typeof b.metadata !== 'object' || b.metadata === null || Array.isArray(b.metadata)) {
      throw new ValidationError('metadata must be a JSON object')
    }
    result.metadata = b.metadata as Record<string, unknown>
  }

  return result
}

export function validateCreateIspSubscriber(body: unknown): CreateIspSubscriberRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be an object')
  }

  const b = body as Record<string, unknown>

  if (typeof b.customer_id !== 'string' || !isUuid(b.customer_id)) {
    throw new ValidationError('customer_id is required and must be a valid UUID')
  }

  if (b.subscription_id !== undefined && b.subscription_id !== null) {
    if (typeof b.subscription_id !== 'string' || !isUuid(b.subscription_id)) {
      throw new ValidationError('subscription_id must be a valid UUID')
    }
  }

  if (typeof b.plan_code !== 'string' || b.plan_code.trim().length === 0) {
    throw new ValidationError('plan_code is required and must be a non-empty string')
  }

  if (typeof b.network_gateway_id !== 'string' || !isUuid(b.network_gateway_id)) {
    throw new ValidationError('network_gateway_id is required and must be a valid UUID')
  }

  if (b.acs_gateway_id !== undefined && b.acs_gateway_id !== null) {
    if (typeof b.acs_gateway_id !== 'string' || !isUuid(b.acs_gateway_id)) {
      throw new ValidationError('acs_gateway_id must be a valid UUID')
    }
  }

  if (b.mesh_gateway_id !== undefined && b.mesh_gateway_id !== null) {
    if (typeof b.mesh_gateway_id !== 'string' || !isUuid(b.mesh_gateway_id)) {
      throw new ValidationError('mesh_gateway_id must be a valid UUID')
    }
  }

  if (typeof b.pppoe_username !== 'string' || b.pppoe_username.trim().length === 0) {
    throw new ValidationError('pppoe_username is required and must be a non-empty string')
  }

  return {
    customer_id: b.customer_id,
    subscription_id: typeof b.subscription_id === 'string' ? b.subscription_id : null,
    plan_code: b.plan_code.trim(),
    network_gateway_id: b.network_gateway_id,
    acs_gateway_id: typeof b.acs_gateway_id === 'string' ? b.acs_gateway_id : null,
    mesh_gateway_id: typeof b.mesh_gateway_id === 'string' ? b.mesh_gateway_id : null,
    pppoe_username: b.pppoe_username.trim(),
    pppoe_password: typeof b.pppoe_password === 'string' ? b.pppoe_password : null,
    ip_address: typeof b.ip_address === 'string' ? b.ip_address.trim() : null,
    ont_serial_number: typeof b.ont_serial_number === 'string' ? b.ont_serial_number.trim() : null,
    ont_vlan: typeof b.ont_vlan === 'number' ? b.ont_vlan : (b.ont_vlan ? Number(b.ont_vlan) : null),
    metadata: typeof b.metadata === 'object' && b.metadata !== null && !Array.isArray(b.metadata)
      ? (b.metadata as Record<string, unknown>)
      : {},
  }
}

export function validateUpdateIspSubscriber(body: unknown): UpdateIspSubscriberRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be an object')
  }

  const b = body as Record<string, unknown>
  const result: UpdateIspSubscriberRequest = {}

  if (b.plan_code !== undefined) {
    if (typeof b.plan_code !== 'string' || b.plan_code.trim().length === 0) {
      throw new ValidationError('plan_code must be a non-empty string')
    }
    result.plan_code = b.plan_code.trim()
  }

  if (b.network_gateway_id !== undefined) {
    if (typeof b.network_gateway_id !== 'string' || !isUuid(b.network_gateway_id)) {
      throw new ValidationError('network_gateway_id must be a valid UUID')
    }
    result.network_gateway_id = b.network_gateway_id
  }

  if (b.acs_gateway_id !== undefined) {
    if (b.acs_gateway_id !== null && (typeof b.acs_gateway_id !== 'string' || !isUuid(b.acs_gateway_id))) {
      throw new ValidationError('acs_gateway_id must be a valid UUID or null')
    }
    result.acs_gateway_id = b.acs_gateway_id
  }

  if (b.mesh_gateway_id !== undefined) {
    if (b.mesh_gateway_id !== null && (typeof b.mesh_gateway_id !== 'string' || !isUuid(b.mesh_gateway_id))) {
      throw new ValidationError('mesh_gateway_id must be a valid UUID or null')
    }
    result.mesh_gateway_id = b.mesh_gateway_id
  }

  if (b.pppoe_password !== undefined) {
    result.pppoe_password = typeof b.pppoe_password === 'string' ? b.pppoe_password : null
  }

  if (b.ip_address !== undefined) {
    result.ip_address = typeof b.ip_address === 'string' ? b.ip_address.trim() : null
  }

  if (b.ont_serial_number !== undefined) {
    result.ont_serial_number = typeof b.ont_serial_number === 'string' ? b.ont_serial_number.trim() : null
  }

  if (b.ont_vlan !== undefined) {
    result.ont_vlan = typeof b.ont_vlan === 'number' ? b.ont_vlan : (b.ont_vlan ? Number(b.ont_vlan) : null)
  }

  if (b.metadata !== undefined) {
    if (typeof b.metadata !== 'object' || b.metadata === null || Array.isArray(b.metadata)) {
      throw new ValidationError('metadata must be a JSON object')
    }
    result.metadata = b.metadata as Record<string, unknown>
  }

  return result
}
