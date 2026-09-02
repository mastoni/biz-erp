import { Pool } from 'pg'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import {
  CreateIspGatewayRequest,
  UpdateIspGatewayRequest,
  IspGatewayDto,
  CreateIspSubscriberRequest,
  UpdateIspSubscriberRequest,
  IspSubscriberDto,
  validateCreateIspGateway,
  validateUpdateIspGateway,
  validateCreateIspSubscriber,
  validateUpdateIspSubscriber,
} from '../dto/isp_dto'
import { ProvisioningAction } from '../dto/provisioning_dto'
import { createIspRepository } from '../repositories/isp_repository'
import { IspDriver } from '../drivers/isp/isp_driver_interface'
import { MockIspDriver } from '../drivers/isp/mock_isp_driver'
import { createProvisioningService } from './provisioning_service'
import { isUuid } from '../utils/uuid'

export function createIspService(
  pool: Pool,
  customDriver?: IspDriver
) {
  const repo = createIspRepository(pool)
  const driver: IspDriver = customDriver || new MockIspDriver()

  // Register ISP driver into the SA-2.7 provisioning engine
  const provisioningService = createProvisioningService(pool, {
    ISP_MANAGEMENT: {
      async execute(job) {
        const payload = job.payload as Record<string, unknown>
        const subscriberId = payload.subscriber_id as string
        const networkGatewayId = payload.network_gateway_id as string
        const acsGatewayId = payload.acs_gateway_id as string | undefined

        // Fetch subscriber and gateways
        const sub = await repo.getSubscriberById(subscriberId, job.business_id)
        if (!sub) {
          return {
            success: false,
            error: `Subscriber ${subscriberId} not found for business ${job.business_id}`,
          }
        }

        const netGw = await repo.getGatewayById(networkGatewayId, job.business_id)
        if (!netGw) {
          return {
            success: false,
            error: `Network gateway ${networkGatewayId} not found for business ${job.business_id}`,
          }
        }

        const acsGw = acsGatewayId ? await repo.getGatewayById(acsGatewayId, job.business_id) : null

        const execResult = await driver.executeProvisioning(job, sub, netGw, acsGw)
        return {
          success: execResult.success,
          result: execResult as unknown as Record<string, unknown>,
          error: execResult.error,
        }
      },
    },
  })

  return {
    getDriver(): IspDriver {
      return driver
    },

    getProvisioningService() {
      return provisioningService
    },

    // -------------------------------------------------------------------------
    // Gateway Management
    // -------------------------------------------------------------------------
    async createGateway(
      businessId: string,
      body: unknown,
      _actorContext?: { actorId?: string; actorScope?: string }
    ): Promise<IspGatewayDto> {
      if (!isUuid(businessId)) {
        throw new ValidationError('businessId must be a valid UUID')
      }
      const req = validateCreateIspGateway(body)
      return repo.createGateway(businessId, req)
    },

    async getGatewayById(id: string, businessId: string): Promise<IspGatewayDto> {
      if (!isUuid(id) || !isUuid(businessId)) {
        throw new ValidationError('id and businessId must be valid UUIDs')
      }
      const gw = await repo.getGatewayById(id, businessId)
      if (!gw) {
        throw new ApiError(404, 'NOT_FOUND', 'ISP Gateway not found')
      }
      return gw
    },

    async listGateways(businessId: string): Promise<IspGatewayDto[]> {
      if (!isUuid(businessId)) {
        throw new ValidationError('businessId must be a valid UUID')
      }
      return repo.listGateways(businessId)
    },

    async updateGateway(
      id: string,
      businessId: string,
      body: unknown
    ): Promise<IspGatewayDto> {
      if (!isUuid(id) || !isUuid(businessId)) {
        throw new ValidationError('id and businessId must be valid UUIDs')
      }
      const req = validateUpdateIspGateway(body)
      const updated = await repo.updateGateway(id, businessId, req)
      if (!updated) {
        throw new ApiError(404, 'NOT_FOUND', 'ISP Gateway not found')
      }
      return updated
    },

    async deleteGateway(id: string, businessId: string): Promise<{ success: boolean }> {
      if (!isUuid(id) || !isUuid(businessId)) {
        throw new ValidationError('id and businessId must be valid UUIDs')
      }
      const deleted = await repo.deleteGateway(id, businessId)
      if (!deleted) {
        throw new ApiError(404, 'NOT_FOUND', 'ISP Gateway not found')
      }
      return { success: true }
    },

    // -------------------------------------------------------------------------
    // Subscriber Management
    // -------------------------------------------------------------------------
    async createSubscriber(
      businessId: string,
      body: unknown,
      _actorContext?: { actorId?: string; actorScope?: string }
    ): Promise<IspSubscriberDto> {
      if (!isUuid(businessId)) {
        throw new ValidationError('businessId must be a valid UUID')
      }
      const req = validateCreateIspSubscriber(body)

      // Validate customer existence for tenant
      const customerRes = await pool.query(
        'SELECT id FROM customers WHERE id = $1 AND business_id = $2',
        [req.customer_id, businessId]
      )
      if (customerRes.rows.length === 0) {
        throw new ValidationError(`Customer ${req.customer_id} does not exist for this business`)
      }

      // Validate plan existence
      const planRes = await pool.query(
        'SELECT code, service_code FROM plans WHERE code = $1',
        [req.plan_code]
      )
      if (planRes.rows.length === 0) {
        throw new ValidationError(`Plan ${req.plan_code} not found`)
      }

      // Validate network gateway (must be MIKROTIK or RADIUS)
      const netGw = await repo.getGatewayById(req.network_gateway_id, businessId)
      if (!netGw) {
        throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', `Network gateway ${req.network_gateway_id} does not belong to this tenant`)
      }
      if (!['MIKROTIK', 'RADIUS'].includes(netGw.gateway_type)) {
        throw new ValidationError(`network_gateway_id must be of type MIKROTIK or RADIUS, got: ${netGw.gateway_type}`)
      }
      if (netGw.status !== 'ACTIVE') {
        throw new ValidationError(`network gateway ${netGw.id} is not ACTIVE (status: ${netGw.status})`)
      }

      // Validate ACS gateway (must be GENIEACS) if provided
      if (req.acs_gateway_id) {
        const acsGw = await repo.getGatewayById(req.acs_gateway_id, businessId)
        if (!acsGw) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', `ACS gateway ${req.acs_gateway_id} does not belong to this tenant`)
        }
        if (acsGw.gateway_type !== 'GENIEACS') {
          throw new ValidationError(`acs_gateway_id must be of type GENIEACS, got: ${acsGw.gateway_type}`)
        }
      }

      // Validate Mesh gateway (must be OPENWISP) if provided
      if (req.mesh_gateway_id) {
        const meshGw = await repo.getGatewayById(req.mesh_gateway_id, businessId)
        if (!meshGw) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', `Mesh gateway ${req.mesh_gateway_id} does not belong to this tenant`)
        }
        if (meshGw.gateway_type !== 'OPENWISP') {
          throw new ValidationError(`mesh_gateway_id must be of type OPENWISP, got: ${meshGw.gateway_type}`)
        }
      }

      try {
        return await repo.createSubscriber(businessId, req)
      } catch (err: any) {
        if (err.code === '23505') { // Unique constraint violation
          throw new ValidationError(`PPPoE username '${req.pppoe_username}' already exists on network gateway`)
        }
        if (err.code === '23503') { // Foreign key constraint violation
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Referenced gateway or entity does not belong to this tenant')
        }
        throw err
      }
    },

    async getSubscriberById(id: string, businessId: string): Promise<IspSubscriberDto> {
      if (!isUuid(id) || !isUuid(businessId)) {
        throw new ValidationError('id and businessId must be valid UUIDs')
      }
      const sub = await repo.getSubscriberById(id, businessId)
      if (!sub) {
        throw new ApiError(404, 'NOT_FOUND', 'ISP Subscriber not found')
      }
      return sub
    },

    async listSubscribers(
      businessId: string,
      queryFilter?: { customer_id?: string; status?: string }
    ): Promise<IspSubscriberDto[]> {
      if (!isUuid(businessId)) {
        throw new ValidationError('businessId must be a valid UUID')
      }
      return repo.listSubscribers(businessId, queryFilter)
    },

    async updateSubscriber(
      id: string,
      businessId: string,
      body: unknown
    ): Promise<IspSubscriberDto> {
      if (!isUuid(id) || !isUuid(businessId)) {
        throw new ValidationError('id and businessId must be valid UUIDs')
      }
      const req = validateUpdateIspSubscriber(body)

      if (req.network_gateway_id) {
        const netGw = await repo.getGatewayById(req.network_gateway_id, businessId)
        if (!netGw) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', `Network gateway does not belong to this tenant`)
        }
        if (!['MIKROTIK', 'RADIUS'].includes(netGw.gateway_type)) {
          throw new ValidationError(`network_gateway_id must be of type MIKROTIK or RADIUS`)
        }
      }

      if (req.acs_gateway_id) {
        const acsGw = await repo.getGatewayById(req.acs_gateway_id, businessId)
        if (!acsGw) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', `ACS gateway does not belong to this tenant`)
        }
        if (acsGw.gateway_type !== 'GENIEACS') {
          throw new ValidationError(`acs_gateway_id must be of type GENIEACS`)
        }
      }

      const updated = await repo.updateSubscriber(id, businessId, req)
      if (!updated) {
        throw new ApiError(404, 'NOT_FOUND', 'ISP Subscriber not found')
      }
      return updated
    },

    // -------------------------------------------------------------------------
    // Provisioning & Lifecycle Operations (SA-2.7 Integration)
    // -------------------------------------------------------------------------
    async executeProvisioningAction(
      subscriberId: string,
      businessId: string,
      action: ProvisioningAction,
      idempotencyKey?: string | null,
      actorContext?: { actorId?: string; actorScope?: string }
    ) {
      if (!isUuid(subscriberId) || !isUuid(businessId)) {
        throw new ValidationError('subscriberId and businessId must be valid UUIDs')
      }

      const subscriber = await this.getSubscriberById(subscriberId, businessId)

      // Create SA-2.7 provisioning job
      const job = await provisioningService.createJob(
        {
          business_id: businessId,
          service_code: 'ISP_MANAGEMENT',
          action,
          subscription_id: subscriber.subscription_id,
          idempotency_key: idempotencyKey ?? null,
          payload: {
            subscriber_id: subscriber.id,
            customer_id: subscriber.customer_id,
            plan_code: subscriber.plan_code,
            network_gateway_id: subscriber.network_gateway_id,
            acs_gateway_id: subscriber.acs_gateway_id,
            mesh_gateway_id: subscriber.mesh_gateway_id,
            pppoe_username: subscriber.pppoe_username,
            ont_serial_number: subscriber.ont_serial_number,
          },
        },
        businessId,
        actorContext
      )

      // Process job synchronously
      const processedJob = await provisioningService.processJob(
        job.id,
        businessId,
        actorContext
      )

      let updatedSubscriber = subscriber
      if (processedJob.status === 'COMPLETED') {
        let nextStatus = subscriber.status
        if (action === 'ACTIVATE' || action === 'RESTORE') {
          nextStatus = 'ACTIVE'
        } else if (action === 'SUSPEND') {
          nextStatus = 'SUSPENDED'
        } else if (action === 'DEACTIVATE') {
          nextStatus = 'TERMINATED'
        }

        if (nextStatus !== subscriber.status) {
          const res = await repo.updateSubscriberStatus(subscriber.id, businessId, nextStatus)
          if (res) updatedSubscriber = res
        }
      }

      return {
        job: processedJob,
        subscriber: updatedSubscriber,
      }
    },

    // -------------------------------------------------------------------------
    // Diagnostics & AI CS Tool Endpoints
    // -------------------------------------------------------------------------
    async getDeviceTelemetry(subscriberId: string, businessId: string) {
      const sub = await this.getSubscriberById(subscriberId, businessId)
      const acsGw = sub.acs_gateway_id ? await repo.getGatewayById(sub.acs_gateway_id, businessId) : null
      return driver.getDeviceTelemetry(sub, acsGw)
    },

    async rebootDevice(subscriberId: string, businessId: string) {
      const sub = await this.getSubscriberById(subscriberId, businessId)
      const acsGw = sub.acs_gateway_id ? await repo.getGatewayById(sub.acs_gateway_id, businessId) : null
      return driver.rebootDevice(sub, acsGw)
    },

    async diagnoseTroubleshooting(subscriberId: string, businessId: string) {
      const sub = await this.getSubscriberById(subscriberId, businessId)
      const netGw = await repo.getGatewayById(sub.network_gateway_id, businessId)
      if (!netGw) {
        throw new ApiError(404, 'NOT_FOUND', 'Network gateway not found')
      }
      return driver.diagnoseTroubleshooting(sub, netGw)
    },
  }
}
