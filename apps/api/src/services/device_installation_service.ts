import { Pool, PoolClient } from 'pg'
import { randomUUID } from 'crypto'
import { ApiError } from '../errors/api_error'
import { ConflictError } from '../errors/conflict_error'
import { ValidationError } from '../errors/validation_error'
import { withTransaction } from '../db/transaction'
import {
  CreateDeviceServiceRequest,
  UpdateDeviceServiceRequest,
  CompleteDeviceServiceRequest,
  DeviceServiceQueryFilter,
  DeviceServiceDto,
  DeviceServiceDetailDto,
  DeviceServiceListResponse,
  DeviceServiceStatus
} from '../dto/device_service_dto'
import { deviceServiceRepository } from '../repositories/device_service_repository'
import { deviceRepository } from '../repositories/device_repository'
import { customerRepository } from '../repositories/customer_repository'
import { inventoryRepository } from '../repositories/inventory_repository'

export const ALLOWED_SERVICE_STATUS_TRANSITIONS: Record<DeviceServiceStatus, DeviceServiceStatus[]> = {
  PENDING: ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED', 'SCHEDULED'],
  COMPLETED: [], // Terminal
  CANCELLED: []  // Terminal
}

export function createDeviceInstallationService(pool: Pool) {
  return {
    async createWorkOrder(
      businessId: string,
      request: CreateDeviceServiceRequest,
      actor: string
    ): Promise<DeviceServiceDto> {
      return withTransaction(pool, async (client) => {
        // 1. Verify target device ownership
        const device = await deviceRepository.findById(client, businessId, request.device_id)
        if (!device) {
          throw new ApiError(404, 'DEVICE_NOT_FOUND', 'Target device not found in this business')
        }

        // 2. Verify customer ownership if provided
        if (request.customer_id) {
          const customer = await customerRepository.findById(client, businessId, request.customer_id)
          if (!customer) {
            throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found in this business')
          }
        }

        // 3. Verify replacement device ownership and availability if provided
        if (request.replacement_device_id) {
          const replacementDevice = await deviceRepository.findById(client, businessId, request.replacement_device_id)
          if (!replacementDevice) {
            throw new ApiError(404, 'REPLACEMENT_DEVICE_NOT_FOUND', 'Replacement device not found in this business')
          }
          if (replacementDevice.status !== 'IN_STOCK' && replacementDevice.status !== 'RESERVED') {
            throw new ConflictError(
              'REPLACEMENT_DEVICE_UNAVAILABLE',
              `Replacement device "${replacementDevice.serial_number}" must be IN_STOCK or RESERVED (currently ${replacementDevice.status})`
            )
          }
        }

        // 4. Create work order
        return deviceServiceRepository.create(client, {
          business_id: businessId,
          device_id: request.device_id,
          customer_id: request.customer_id ?? device.customer_id,
          service_type: request.service_type,
          status: request.status ?? 'PENDING',
          technician_name: request.technician_name,
          scheduled_at: request.scheduled_at,
          replacement_device_id: request.replacement_device_id,
          findings: request.findings,
          action_taken: request.action_taken,
          notes: request.notes,
          metadata: request.metadata
        })
      })
    },

    async updateWorkOrder(
      businessId: string,
      serviceId: string,
      patch: UpdateDeviceServiceRequest
    ): Promise<DeviceServiceDto> {
      return withTransaction(pool, async (client) => {
        const existing = await deviceServiceRepository.findByIdForUpdate(client, businessId, serviceId)
        if (!existing) {
          throw new ApiError(404, 'NOT_FOUND', 'Service work order not found')
        }

        // Validate status transition if changing
        if (patch.status && patch.status !== existing.status) {
          const allowed = ALLOWED_SERVICE_STATUS_TRANSITIONS[existing.status]
          if (!allowed.includes(patch.status)) {
            throw new ConflictError(
              'INVALID_SERVICE_STATUS_TRANSITION',
              `Cannot transition work order from "${existing.status}" to "${patch.status}". Allowed: ${allowed.join(', ') || 'NONE'}`
            )
          }
        }

        // Validate replacement device if changing
        if (patch.replacement_device_id && patch.replacement_device_id !== existing.replacement_device_id) {
          const replacementDevice = await deviceRepository.findById(client, businessId, patch.replacement_device_id)
          if (!replacementDevice) {
            throw new ApiError(404, 'REPLACEMENT_DEVICE_NOT_FOUND', 'Replacement device not found in this business')
          }
        }

        const updated = await deviceServiceRepository.update(client, businessId, serviceId, patch)
        if (!updated) {
          throw new ApiError(404, 'NOT_FOUND', 'Service work order not found')
        }
        return updated
      })
    },

    async completeWorkOrder(
      businessId: string,
      serviceId: string,
      request: CompleteDeviceServiceRequest,
      actor: string
    ): Promise<DeviceServiceDto> {
      return withTransaction(pool, async (client) => {
        // 1. Lock work order
        const workOrder = await deviceServiceRepository.findByIdForUpdate(client, businessId, serviceId)
        if (!workOrder) {
          throw new ApiError(404, 'NOT_FOUND', 'Service work order not found')
        }

        if (workOrder.status === 'COMPLETED' || workOrder.status === 'CANCELLED') {
          throw new ConflictError('WORK_ORDER_ALREADY_CLOSED', `Work order is already ${workOrder.status}`)
        }

        // 2. Lock target device A
        const deviceA = await deviceRepository.findByIdForUpdate(client, businessId, workOrder.device_id)
        if (!deviceA) {
          throw new ApiError(404, 'DEVICE_NOT_FOUND', 'Target device not found')
        }

        let finalReplacementDeviceId = workOrder.replacement_device_id
        let actionSummary = request.action_taken ?? workOrder.action_taken

        // 3. Handle Atomic REPLACEMENT flow
        if (workOrder.service_type === 'REPLACEMENT') {
          const replacementId = request.replacement_device_id ?? workOrder.replacement_device_id
          if (!replacementId) {
            throw new ValidationError('replacement_device_id is required to complete a REPLACEMENT work order')
          }
          finalReplacementDeviceId = replacementId

          // Lock replacement Device B
          const deviceB = await deviceRepository.findByIdForUpdate(client, businessId, replacementId)
          if (!deviceB) {
            throw new ApiError(404, 'REPLACEMENT_DEVICE_NOT_FOUND', 'Replacement device not found in this business')
          }

          if (deviceB.id === deviceA.id) {
            throw new ValidationError('Replacement device cannot be the same as the defective device')
          }

          if (deviceB.status !== 'IN_STOCK' && deviceB.status !== 'RESERVED') {
            throw new ConflictError(
              'REPLACEMENT_DEVICE_UNAVAILABLE',
              `Replacement device "${deviceB.serial_number}" is not available (current status: ${deviceB.status})`
            )
          }

          // Inherit customer and installation location from Device A
          const customerId = deviceA.customer_id ?? workOrder.customer_id
          const installedAddress = deviceA.installed_address

          // Update Device A -> DEFECTIVE and unassigned
          await deviceRepository.update(client, businessId, deviceA.id, {
            status: 'DEFECTIVE',
            customer_id: null,
            installed_address: null,
            installed_at: null,
            notes: `Replaced by ${deviceB.serial_number} on ${new Date().toISOString()}`
          })

          // Update Device B -> INSTALLED at Customer
          await deviceRepository.update(client, businessId, deviceB.id, {
            status: 'INSTALLED',
            customer_id: customerId,
            installed_address: installedAddress,
            installed_at: new Date().toISOString(),
            notes: `Replacement for ${deviceA.serial_number} on ${new Date().toISOString()}`
          })

          // Decrement available stock for Device B's SKU
          if (deviceB.product_id) {
            const stock = await inventoryRepository.getStock(client, businessId, deviceB.branch_id, deviceB.product_id)
            if (stock && stock.quantity > 0) {
              await inventoryRepository.updateStockAtomic(client, stock.id, -1, stock.server_version)
              await inventoryRepository.createMovement(
                client,
                randomUUID(),
                businessId,
                deviceB.branch_id,
                deviceB.product_id,
                1,
                'STOCK_OUT',
                `DEVICE_RMA_SWAP:${deviceA.serial_number}->${deviceB.serial_number}`,
                actor
              )
            }
          }

          actionSummary = actionSummary ?? `Replaced device ${deviceA.serial_number} with ${deviceB.serial_number}`
        } else if (workOrder.service_type === 'INSTALLATION') {
          // If installation work order completes, ensure device is INSTALLED
          if (deviceA.status !== 'INSTALLED') {
            await deviceRepository.update(client, businessId, deviceA.id, {
              status: 'INSTALLED',
              customer_id: workOrder.customer_id ?? deviceA.customer_id,
              installed_at: new Date().toISOString()
            })
          }
        }

        // 4. Update work order to COMPLETED
        const completed = await deviceServiceRepository.update(client, businessId, serviceId, {
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          replacement_device_id: finalReplacementDeviceId,
          findings: request.findings ?? workOrder.findings,
          action_taken: actionSummary,
          notes: request.notes ?? workOrder.notes,
          metadata: request.metadata ?? workOrder.metadata
        })

        return completed!
      })
    },

    async getWorkOrder(businessId: string, serviceId: string): Promise<DeviceServiceDetailDto> {
      const client = await pool.connect()
      try {
        const detail = await deviceServiceRepository.getDetail(client, businessId, serviceId)
        if (!detail) {
          throw new ApiError(404, 'NOT_FOUND', 'Service work order not found')
        }
        return detail
      } finally {
        client.release()
      }
    },

    async listWorkOrders(businessId: string, filters: DeviceServiceQueryFilter): Promise<DeviceServiceListResponse> {
      const client = await pool.connect()
      try {
        const { rows, total } = await deviceServiceRepository.list(client, businessId, filters)
        return {
          items: rows,
          total,
          limit: filters.limit,
          offset: filters.offset,
          has_more: filters.offset + rows.length < total
        }
      } finally {
        client.release()
      }
    }
  }
}
