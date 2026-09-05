import { Pool, PoolClient } from 'pg'
import { randomUUID } from 'crypto'
import { ApiError } from '../errors/api_error'
import { ConflictError } from '../errors/conflict_error'
import { withTransaction } from '../db/transaction'
import {
  CreateDeviceRequest,
  BulkCreateDeviceRequest,
  UpdateDeviceRequest,
  AssignDeviceRequest,
  UnassignDeviceRequest,
  DeviceQueryFilter,
  DeviceDto,
  DeviceDetailDto,
  DeviceListResponse,
  DeviceStatus
} from '../dto/device_dto'
import { deviceRepository } from '../repositories/device_repository'
import { branchRepository } from '../repositories/branch_repository'
import { productRepository } from '../repositories/product_repository'
import { customerRepository } from '../repositories/customer_repository'
import { inventoryRepository } from '../repositories/inventory_repository'

export const ALLOWED_DEVICE_TRANSITIONS: Record<DeviceStatus, DeviceStatus[]> = {
  IN_STOCK: ['RESERVED', 'INSTALLED', 'DEFECTIVE', 'DECOMMISSIONED'],
  RESERVED: ['INSTALLED', 'IN_STOCK', 'DEFECTIVE'],
  INSTALLED: ['IN_STOCK', 'DEFECTIVE', 'RETURNED'],
  DEFECTIVE: ['IN_REPAIR', 'RETURNED', 'DECOMMISSIONED', 'IN_STOCK'],
  IN_REPAIR: ['IN_STOCK', 'DEFECTIVE', 'DECOMMISSIONED'],
  RETURNED: ['IN_STOCK', 'DECOMMISSIONED'],
  DECOMMISSIONED: [] // Terminal state
}

export function createDeviceService(pool: Pool) {
  return {
    async createDevice(businessId: string, request: CreateDeviceRequest, actor: string): Promise<DeviceDto> {
      return withTransaction(pool, async (client) => {
        // 1. Validate branch ownership
        const branch = await branchRepository.findById(client, businessId, request.branch_id)
        if (!branch || !branch.status) {
          throw new ApiError(404, 'BRANCH_NOT_FOUND', 'Branch not found or inactive')
        }

        // 2. Validate product ownership if provided
        if (request.product_id) {
          const product = await productRepository.findById(client, businessId, request.product_id)
          if (!product) {
            throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found in this business')
          }
        }

        // 3. Validate customer ownership if provided
        if (request.customer_id) {
          const customer = await customerRepository.findById(client, businessId, request.customer_id)
          if (!customer) {
            throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found in this business')
          }
        }

        // 4. Duplicate serial number check
        const existingSerial = await deviceRepository.findBySerial(client, businessId, request.serial_number)
        if (existingSerial) {
          throw new ConflictError('DUPLICATE_SERIAL_NUMBER', `Serial number "${request.serial_number}" already exists in this business`)
        }

        // 5. Duplicate MAC address check
        if (request.mac_address) {
          const existingMac = await deviceRepository.findByMac(client, businessId, request.mac_address)
          if (existingMac) {
            throw new ConflictError('DUPLICATE_MAC_ADDRESS', `MAC address "${request.mac_address}" already exists in this business`)
          }
        }

        // 6. Insert device
        const device = await deviceRepository.create(client, {
          business_id: businessId,
          branch_id: request.branch_id,
          product_id: request.product_id,
          serial_number: request.serial_number,
          mac_address: request.mac_address,
          device_type: request.device_type,
          ownership_type: request.ownership_type ?? 'TENANT_OWNED',
          status: request.status ?? 'IN_STOCK',
          customer_id: request.customer_id,
          installed_address: request.installed_address,
          installed_at: request.installed_at,
          warranty_months: request.warranty_months,
          warranty_expires_at: request.warranty_expires_at,
          notes: request.notes,
          metadata: request.metadata
        })

        // 7. Inventory synchronization if requested
        if (request.sync_inventory && device.status === 'IN_STOCK' && device.product_id) {
          let stock = await inventoryRepository.getStock(client, businessId, device.branch_id, device.product_id)
          if (!stock) {
            stock = await inventoryRepository.createStock(client, randomUUID(), businessId, device.branch_id, device.product_id, 0)
          }

          const updatedStock = await inventoryRepository.updateStockAtomic(client, stock.id, 1, stock.server_version)
          if (!updatedStock) {
            throw new ConflictError('STOCK_VERSION_CONFLICT', 'Concurrent modification of stock during device creation')
          }

          await inventoryRepository.createMovement(
            client,
            randomUUID(),
            businessId,
            device.branch_id,
            device.product_id,
            1,
            'STOCK_IN',
            `DEVICE_INGEST:${device.serial_number}`,
            actor
          )
        }

        return device
      })
    },

    async createBulkDevices(businessId: string, request: BulkCreateDeviceRequest, actor: string): Promise<DeviceDto[]> {
      return withTransaction(pool, async (client) => {
        // 1. Validate branch ownership
        const branch = await branchRepository.findById(client, businessId, request.branch_id)
        if (!branch || !branch.status) {
          throw new ApiError(404, 'BRANCH_NOT_FOUND', 'Branch not found or inactive')
        }

        // 2. Validate product ownership if provided
        if (request.product_id) {
          const product = await productRepository.findById(client, businessId, request.product_id)
          if (!product) {
            throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found in this business')
          }
        }

        // 3. Pre-check serials and MACs against database
        for (const item of request.items) {
          const existingSerial = await deviceRepository.findBySerial(client, businessId, item.serial_number)
          if (existingSerial) {
            throw new ConflictError('DUPLICATE_SERIAL_NUMBER', `Serial number "${item.serial_number}" already exists in this business`)
          }
          if (item.mac_address) {
            const existingMac = await deviceRepository.findByMac(client, businessId, item.mac_address)
            if (existingMac) {
              throw new ConflictError('DUPLICATE_MAC_ADDRESS', `MAC address "${item.mac_address}" already exists in this business`)
            }
          }
        }

        // 4. Create all devices
        const createdDevices = await deviceRepository.createBulk(
          client,
          businessId,
          request.branch_id,
          request.device_type,
          request.product_id,
          request.ownership_type ?? 'TENANT_OWNED',
          request.warranty_months,
          request.metadata,
          request.items
        )

        // 5. Bulk inventory synchronization if requested
        if (request.sync_inventory && request.product_id && createdDevices.length > 0) {
          let stock = await inventoryRepository.getStock(client, businessId, request.branch_id, request.product_id)
          if (!stock) {
            stock = await inventoryRepository.createStock(client, randomUUID(), businessId, request.branch_id, request.product_id, 0)
          }

          const updatedStock = await inventoryRepository.updateStockAtomic(
            client,
            stock.id,
            createdDevices.length,
            stock.server_version
          )
          if (!updatedStock) {
            throw new ConflictError('STOCK_VERSION_CONFLICT', 'Concurrent modification of stock during bulk device creation')
          }

          await inventoryRepository.createMovement(
            client,
            randomUUID(),
            businessId,
            request.branch_id,
            request.product_id,
            createdDevices.length,
            'STOCK_IN',
            `DEVICE_BULK_INGEST:${createdDevices.length}_units`,
            actor
          )
        }

        return createdDevices
      })
    },

    async getDevice(businessId: string, deviceId: string): Promise<DeviceDetailDto> {
      const client = await pool.connect()
      try {
        const device = await deviceRepository.getDetail(client, businessId, deviceId)
        if (!device) {
          throw new ApiError(404, 'NOT_FOUND', 'Device not found')
        }
        return device
      } finally {
        client.release()
      }
    },

    async listDevices(businessId: string, filters: DeviceQueryFilter): Promise<DeviceListResponse> {
      const client = await pool.connect()
      try {
        const { rows, total } = await deviceRepository.list(client, businessId, filters)
        const summary = await deviceRepository.getSummary(client, businessId)
        return {
          items: rows,
          total,
          limit: filters.limit,
          offset: filters.offset,
          has_more: filters.offset + rows.length < total,
          summary
        }
      } finally {
        client.release()
      }
    },

    async updateDevice(businessId: string, deviceId: string, patch: UpdateDeviceRequest): Promise<DeviceDto> {
      return withTransaction(pool, async (client) => {
        const existing = await deviceRepository.findByIdForUpdate(client, businessId, deviceId)
        if (!existing) {
          throw new ApiError(404, 'NOT_FOUND', 'Device not found')
        }

        if (patch.branch_id && patch.branch_id !== existing.branch_id) {
          const branch = await branchRepository.findById(client, businessId, patch.branch_id)
          if (!branch || !branch.status) {
            throw new ApiError(404, 'BRANCH_NOT_FOUND', 'Target branch not found or inactive')
          }
        }

        if (patch.product_id && patch.product_id !== existing.product_id) {
          const product = await productRepository.findById(client, businessId, patch.product_id)
          if (!product) {
            throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Target product not found')
          }
        }

        if (patch.mac_address && patch.mac_address !== existing.mac_address) {
          const duplicateMac = await deviceRepository.findByMac(client, businessId, patch.mac_address)
          if (duplicateMac && duplicateMac.id !== deviceId) {
            throw new ConflictError('DUPLICATE_MAC_ADDRESS', `MAC address "${patch.mac_address}" is already used by another device`)
          }
        }

        const updated = await deviceRepository.update(client, businessId, deviceId, patch)
        if (!updated) {
          throw new ApiError(404, 'NOT_FOUND', 'Device not found')
        }
        return updated
      })
    },

    async assignDevice(
      businessId: string,
      deviceId: string,
      request: AssignDeviceRequest,
      actor: string
    ): Promise<DeviceDto> {
      return withTransaction(pool, async (client) => {
        // 1. Lock device
        const device = await deviceRepository.findByIdForUpdate(client, businessId, deviceId)
        if (!device) {
          throw new ApiError(404, 'NOT_FOUND', 'Device not found')
        }

        // 2. Validate current status
        if (device.status !== 'IN_STOCK' && device.status !== 'RESERVED') {
          throw new ConflictError(
            'INVALID_STATE_TRANSITION',
            `Cannot assign device in status "${device.status}". Device must be IN_STOCK or RESERVED.`
          )
        }

        // 3. Validate customer ownership
        const customer = await customerRepository.findById(client, businessId, request.customer_id)
        if (!customer) {
          throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found in this business')
        }

        // 4. Decrement available branch stock if device was IN_STOCK and has product_id
        if (device.status === 'IN_STOCK' && device.product_id) {
          const stock = await inventoryRepository.getStock(client, businessId, device.branch_id, device.product_id)
          if (!stock || stock.quantity <= 0) {
            throw new ConflictError(
              'INSUFFICIENT_STOCK',
              `Insufficient stock at branch to allocate device "${device.serial_number}"`
            )
          }

          const updatedStock = await inventoryRepository.updateStockAtomic(client, stock.id, -1, stock.server_version)
          if (!updatedStock) {
            throw new ConflictError('STOCK_VERSION_CONFLICT', 'Concurrent modification of stock during device assignment')
          }

          await inventoryRepository.createMovement(
            client,
            randomUUID(),
            businessId,
            device.branch_id,
            device.product_id,
            1,
            'STOCK_OUT',
            `DEVICE_INSTALL:${device.serial_number}`,
            actor
          )
        }

        // 5. Update device state
        const updated = await deviceRepository.update(client, businessId, deviceId, {
          status: 'INSTALLED',
          customer_id: request.customer_id,
          installed_address: request.installed_address ?? null,
          installed_at: request.installed_at ?? new Date().toISOString(),
          notes: request.notes ?? device.notes
        })

        return updated!
      })
    },

    async unassignDevice(
      businessId: string,
      deviceId: string,
      request: UnassignDeviceRequest,
      actor: string
    ): Promise<DeviceDto> {
      return withTransaction(pool, async (client) => {
        // 1. Lock device
        const device = await deviceRepository.findByIdForUpdate(client, businessId, deviceId)
        if (!device) {
          throw new ApiError(404, 'NOT_FOUND', 'Device not found')
        }

        // 2. Validate current status is INSTALLED
        if (device.status !== 'INSTALLED') {
          throw new ConflictError(
            'INVALID_STATE_TRANSITION',
            `Cannot unassign device in status "${device.status}". Device must be INSTALLED.`
          )
        }

        const returnStatus = request.return_status ?? 'IN_STOCK'
        const allowed = ALLOWED_DEVICE_TRANSITIONS.INSTALLED
        if (!allowed.includes(returnStatus)) {
          throw new ConflictError(
            'INVALID_STATE_TRANSITION',
            `Invalid unassign destination status "${returnStatus}". Allowed: ${allowed.join(', ')}`
          )
        }

        // 3. If returning to active IN_STOCK, increment available branch stock
        if (returnStatus === 'IN_STOCK' && device.product_id) {
          let stock = await inventoryRepository.getStock(client, businessId, device.branch_id, device.product_id)
          if (!stock) {
            stock = await inventoryRepository.createStock(client, randomUUID(), businessId, device.branch_id, device.product_id, 0)
          }

          const updatedStock = await inventoryRepository.updateStockAtomic(client, stock.id, 1, stock.server_version)
          if (!updatedStock) {
            throw new ConflictError('STOCK_VERSION_CONFLICT', 'Concurrent modification of stock during device unassignment')
          }

          await inventoryRepository.createMovement(
            client,
            randomUUID(),
            businessId,
            device.branch_id,
            device.product_id,
            1,
            'STOCK_IN',
            `DEVICE_RETURN:${device.serial_number}`,
            actor
          )
        }

        // 4. Update device state
        const updated = await deviceRepository.update(client, businessId, deviceId, {
          status: returnStatus,
          customer_id: null,
          installed_address: null,
          installed_at: null,
          notes: request.notes ?? device.notes
        })

        return updated!
      })
    },

    async transitionDeviceStatus(
      businessId: string,
      deviceId: string,
      newStatus: DeviceStatus,
      notes?: string,
      actor = 'SYSTEM'
    ): Promise<DeviceDto> {
      return withTransaction(pool, async (client) => {
        const device = await deviceRepository.findByIdForUpdate(client, businessId, deviceId)
        if (!device) {
          throw new ApiError(404, 'NOT_FOUND', 'Device not found')
        }

        if (device.status === newStatus) {
          return device
        }

        const allowed = ALLOWED_DEVICE_TRANSITIONS[device.status]
        if (!allowed.includes(newStatus)) {
          throw new ConflictError(
            'INVALID_STATE_TRANSITION',
            `Cannot transition device from "${device.status}" to "${newStatus}". Allowed: ${allowed.join(', ') || 'NONE'}`
          )
        }

        // Inventory movements on status transitions
        if (device.product_id) {
          // Returning to active stock from defective/repair
          if (newStatus === 'IN_STOCK' && (device.status === 'DEFECTIVE' || device.status === 'IN_REPAIR' || device.status === 'RETURNED')) {
            let stock = await inventoryRepository.getStock(client, businessId, device.branch_id, device.product_id)
            if (!stock) {
              stock = await inventoryRepository.createStock(client, randomUUID(), businessId, device.branch_id, device.product_id, 0)
            }
            await inventoryRepository.updateStockAtomic(client, stock.id, 1, stock.server_version)
            await inventoryRepository.createMovement(
              client,
              randomUUID(),
              businessId,
              device.branch_id,
              device.product_id,
              1,
              'STOCK_IN',
              `DEVICE_RESTOCK:${device.serial_number}`,
              actor
            )
          }
          // Leaving active stock directly into defective or decommissioned
          else if (device.status === 'IN_STOCK' && (newStatus === 'DEFECTIVE' || newStatus === 'DECOMMISSIONED')) {
            const stock = await inventoryRepository.getStock(client, businessId, device.branch_id, device.product_id)
            if (stock && stock.quantity > 0) {
              await inventoryRepository.updateStockAtomic(client, stock.id, -1, stock.server_version)
              await inventoryRepository.createMovement(
                client,
                randomUUID(),
                businessId,
                device.branch_id,
                device.product_id,
                1,
                'STOCK_OUT',
                `DEVICE_DEFECTIVE_OUT:${device.serial_number}`,
                actor
              )
            }
          }
        }

        const updated = await deviceRepository.update(client, businessId, deviceId, {
          status: newStatus,
          notes: notes ?? device.notes
        })

        return updated!
      })
    }
  }
}
