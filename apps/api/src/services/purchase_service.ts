import { Pool, PoolClient } from 'pg'
import { randomUUID, createHash } from 'crypto'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { ConflictError } from '../errors/conflict_error'
import {
  PurchaseDto,
  PurchaseSummaryDto,
  PurchaseCreateRequest,
  PurchaseUpdateRequest,
  PurchaseSendRequest,
  PurchaseReceiveRequest,
  PurchasePaymentRequest,
  PurchaseCancelRequest,
  PurchaseStatus,
  validatePurchaseCreate,
  validatePurchaseUpdate,
  validatePurchaseSend,
  validatePurchaseReceive,
  validatePurchasePay,
  validatePurchaseCancel,
  generatePurchaseCode,
  calculateDueDate,
} from '../dto/purchase_dto'
import { purchaseRepository } from '../repositories/purchase_repository'
import { inventoryRepository } from '../repositories/inventory_repository'
import { idempotencyRepository } from '../repositories/idempotency_repository'
import { withTransaction } from '../db/transaction'
import { isUuid } from '../utils/uuid'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500

function assertTenant(businessId: string, tenantId: string): void {
  if (tenantId.toLowerCase() !== businessId.toLowerCase()) {
    throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch')
  }
}

function parseLimit(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_LIMIT
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    throw new ValidationError(`limit must be an integer between 1 and ${MAX_LIMIT}`)
  }
  return parsed
}

function parseOffset(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 0
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ValidationError('offset must be a non-negative integer')
  }
  return parsed
}

export function createPurchaseService(pool: Pool) {
  return {
    async list(
      query: unknown,
      tenantId: string
    ): Promise<{
      items: PurchaseDto[]
      total: number
      limit: number
      offset: number
      has_more: boolean
      summary: PurchaseSummaryDto
    }> {
      const q = query as Record<string, unknown>
      const businessId = typeof q.business_id === 'string' ? q.business_id.trim() : undefined

      if (!businessId || !isUuid(businessId)) {
        throw new ValidationError('business_id must be a valid UUID')
      }

      assertTenant(businessId, tenantId)

      let branchId: string | undefined
      if (typeof q.branch_id === 'string' && q.branch_id.trim()) {
        if (!isUuid(q.branch_id.trim())) {
          throw new ValidationError('branch_id must be a valid UUID')
        }
        branchId = q.branch_id.trim()
      }

      let supplierId: string | undefined
      if (typeof q.supplier_id === 'string' && q.supplier_id.trim()) {
        if (!isUuid(q.supplier_id.trim())) {
          throw new ValidationError('supplier_id must be a valid UUID')
        }
        supplierId = q.supplier_id.trim()
      }

      let status: PurchaseStatus | undefined
      if (typeof q.status === 'string' && q.status.trim()) {
        status = q.status.trim() as PurchaseStatus
      }

      const limit = parseLimit(q.limit)
      const offset = parseOffset(q.offset)

      return withTransaction(pool, async (client) => {
        const [{ rows, total }, summary] = await Promise.all([
          purchaseRepository.list(client, tenantId, {
            branchId,
            supplierId,
            status,
            limit,
            offset,
          }),
          purchaseRepository.getSummary(client, tenantId, { branchId, supplierId }),
        ])

        return {
          items: rows,
          total,
          limit,
          offset,
          has_more: offset + rows.length < total,
          summary,
        }
      })
    },

    async getSummary(businessId: string, tenantId: string): Promise<PurchaseSummaryDto> {
      if (!isUuid(businessId)) {
        throw new ValidationError('business_id must be a valid UUID')
      }
      assertTenant(businessId, tenantId)

      return withTransaction(pool, async (client) => {
        return purchaseRepository.getSummary(client, tenantId)
      })
    },

    async findById(purchaseId: string, tenantId: string): Promise<PurchaseDto> {
      if (!isUuid(purchaseId)) {
        throw new ValidationError('Purchase id must be a valid UUID')
      }

      return withTransaction(pool, async (client) => {
        const po = await purchaseRepository.findById(client, tenantId, purchaseId)
        if (!po) {
          throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found')
        }
        return po
      })
    },
    async create(
      body: unknown,
      idempotencyKey: string,
      requestHash: string,
      tenantId: string
    ): Promise<PurchaseDto> {
      const request = validatePurchaseCreate(body)
      assertTenant(request.business_id, tenantId)

      return withTransaction(pool, async (client) => {
        const existing = await idempotencyRepository.findActive(
          client,
          request.business_id,
          idempotencyKey
        )
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw new ConflictError(
              'IDEMPOTENCY_KEY_REUSE',
              'Idempotency key was already used with a different request hash',
              { idempotency_key: idempotencyKey }
            )
          }
          return existing.response_body as PurchaseDto
        }

        const duplicate = await purchaseRepository.findById(
          client,
          request.business_id,
          request.id
        )
        if (duplicate) {
          throw new ConflictError(
            'PURCHASE_ID_CONFLICT',
            'Purchase order with this id already exists',
            { existing_purchase_id: request.id }
          )
        }

        const branchResult = await client.query(
          'SELECT id, business_id FROM branches WHERE id = $1',
          [request.branch_id]
        )
        if (branchResult.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Branch not found')
        }
        if (branchResult.rows[0].business_id !== request.business_id) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Branch belongs to another business')
        }

        const supplierResult = await client.query(
          `SELECT id, business_id, code, name, term, status, deleted_at
           FROM suppliers
           WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
          [request.supplier_id, request.business_id]
        )
        if (supplierResult.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Supplier not found')
        }
        const supplier = supplierResult.rows[0]
        if (supplier.status !== 'aktif') {
          throw new ValidationError(`Supplier "${supplier.name}" is inactive`)
        }

        const lineItemsToInsert: {
          id: string
          purchase_id: string
          product_id: string
          product_name: string
          ordered_qty: number
          received_qty: number
          unit_cost_minor: number
          subtotal_minor: number
        }[] = []

        let calculatedTotalMinor = 0

        for (const item of request.items) {
          const productResult = await client.query(
            `SELECT id, business_id, name, cost_minor, is_active
             FROM products
             WHERE id = $1 AND business_id = $2`,
            [item.product_id, request.business_id]
          )
          if (productResult.rows.length === 0) {
            throw new ApiError(404, 'NOT_FOUND', `Product ${item.product_id} not found`)
          }
          const product = productResult.rows[0]
          if (!product.is_active) {
            throw new ValidationError(`Product "${product.name}" is inactive`)
          }
          if (product.cost_minor === null || product.cost_minor === undefined || Number(product.cost_minor) < 0) {
            throw new ValidationError(`Product "${product.name}" must have a valid cost price set`)
          }

          const unitCostMinor = Number(product.cost_minor)
          const subtotalMinor = item.ordered_qty * unitCostMinor
          calculatedTotalMinor += subtotalMinor

          lineItemsToInsert.push({
            id: item.id ?? randomUUID(),
            purchase_id: request.id,
            product_id: product.id,
            product_name: product.name,
            ordered_qty: item.ordered_qty,
            received_qty: 0,
            unit_cost_minor: unitCostMinor,
            subtotal_minor: subtotalMinor,
          })
        }

        const dateStr = request.date ?? new Date().toISOString().slice(0, 10)
        const dueDateStr = request.due_date ?? calculateDueDate(dateStr, supplier.term)
        const status = request.status === 'sent' ? 'sent' : 'draft'

        const outstandingMinor =
          supplier.term === 'Tunai' ? 0 : calculatedTotalMinor

        await purchaseRepository.lockCodeSequence(client, request.business_id)

        let createdPo: PurchaseDto | null = null
        let attempts = 0
        let seq = await purchaseRepository.getNextCodeSequence(
          client,
          request.business_id,
          supplier.code
        )

        while (attempts < 3) {
          attempts++
          const code = generatePurchaseCode(supplier.code, seq)

          const existingCode = await purchaseRepository.findByCode(
            client,
            request.business_id,
            code
          )
          if (existingCode) {
            seq++
            continue
          }

          try {
            createdPo = await purchaseRepository.insertPurchase(client, {
              id: request.id,
              business_id: request.business_id,
              branch_id: request.branch_id,
              supplier_id: request.supplier_id,
              code,
              date: dateStr,
              due_date: dueDateStr,
              supplier_term: supplier.term,
              status,
              total_minor: calculatedTotalMinor,
              paid_minor: 0,
              outstanding_minor: outstandingMinor,
              received_minor: 0,
              note: request.note ?? null,
            })
            break
          } catch (err: any) {
            if (err.code === '23505' && err.constraint?.includes('code')) {
              seq++
              continue
            }
            throw err
          }
        }

        if (!createdPo) {
          throw new ConflictError(
            'CODE_GENERATION_FAILED',
            'Failed to generate unique purchase order code after 3 attempts'
          )
        }

        const insertedItems = await purchaseRepository.insertPurchaseItems(
          client,
          lineItemsToInsert
        )
        createdPo.items = insertedItems
        createdPo.payments = []

        await idempotencyRepository.insert(
          client,
          request.business_id,
          idempotencyKey,
          requestHash,
          201,
          createdPo
        )

        return createdPo
      })
    },
    async updateDraft(
      purchaseId: string,
      body: unknown,
      tenantId: string
    ): Promise<PurchaseDto> {
      if (!isUuid(purchaseId)) {
        throw new ValidationError('Purchase id must be a valid UUID')
      }

      const request = validatePurchaseUpdate(body)
      assertTenant(request.business_id, tenantId)

      return withTransaction(pool, async (client) => {
        const po = await purchaseRepository.findByIdForUpdate(
          client,
          request.business_id,
          purchaseId
        )
        if (!po) {
          throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found')
        }

        if (po.status !== 'draft') {
          throw new ValidationError(
            `Cannot modify purchase order in '${po.status}' status. Only draft orders can be updated.`
          )
        }

        if (po.server_version !== request.expected_server_version) {
          throw new ConflictError(
            'PURCHASE_VERSION_CONFLICT',
            'Purchase order was modified by another device',
            {
              expected_server_version: request.expected_server_version,
              current_server_version: po.server_version,
            }
          )
        }

        if (request.branch_id && request.branch_id !== po.branch_id) {
          const branchResult = await client.query(
            'SELECT id, business_id FROM branches WHERE id = $1',
            [request.branch_id]
          )
          if (branchResult.rows.length === 0) {
            throw new ApiError(404, 'NOT_FOUND', 'Branch not found')
          }
          if (branchResult.rows[0].business_id !== request.business_id) {
            throw new ApiError(
              403,
              'BUSINESS_ACCESS_DENIED',
              'Branch belongs to another business'
            )
          }
        }

        const effectiveDate = request.date ?? po.date
        let effectiveSupplierTerm = po.supplier_term
        let supplierTermChanged = false

        if (request.supplier_id && request.supplier_id !== po.supplier_id) {
          const supplierResult = await client.query(
            `SELECT id, business_id, name, term, status
             FROM suppliers
             WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
            [request.supplier_id, request.business_id]
          )
          if (supplierResult.rows.length === 0) {
            throw new ApiError(404, 'NOT_FOUND', 'Supplier not found')
          }
          const s = supplierResult.rows[0]
          if (s.status !== 'aktif') {
            throw new ValidationError(`Supplier "${s.name}" is inactive`)
          }
          effectiveSupplierTerm = s.term
          supplierTermChanged = true
        }

        let calculatedDueDate: string | undefined = request.due_date
        if (request.due_date === undefined && (request.date !== undefined || request.supplier_id !== undefined)) {
          calculatedDueDate = calculateDueDate(effectiveDate, effectiveSupplierTerm)
        }

        let newTotalMinor = po.total_minor
        let newOutstandingMinor = po.outstanding_minor

        if (request.items) {
          const lineItemsToInsert: {
            id: string
            purchase_id: string
            product_id: string
            product_name: string
            ordered_qty: number
            received_qty: number
            unit_cost_minor: number
            subtotal_minor: number
          }[] = []

          let calculatedTotal = 0

          for (const item of request.items) {
            const productResult = await client.query(
              `SELECT id, business_id, name, cost_minor, is_active
               FROM products
               WHERE id = $1 AND business_id = $2`,
              [item.product_id, request.business_id]
            )
            if (productResult.rows.length === 0) {
              throw new ApiError(404, 'NOT_FOUND', `Product ${item.product_id} not found`)
            }
            const product = productResult.rows[0]
            if (!product.is_active) {
              throw new ValidationError(`Product "${product.name}" is inactive`)
            }
            if (product.cost_minor === null || Number(product.cost_minor) < 0) {
              throw new ValidationError(
                `Product "${product.name}" must have a valid cost price set`
              )
            }

            const unitCostMinor = Number(product.cost_minor)
            const subtotalMinor = item.ordered_qty * unitCostMinor
            calculatedTotal += subtotalMinor

            lineItemsToInsert.push({
              id: item.id ?? randomUUID(),
              purchase_id: purchaseId,
              product_id: product.id,
              product_name: product.name,
              ordered_qty: item.ordered_qty,
              received_qty: 0,
              unit_cost_minor: unitCostMinor,
              subtotal_minor: subtotalMinor,
            })
          }

          newTotalMinor = calculatedTotal
          newOutstandingMinor =
            effectiveSupplierTerm === 'Tunai' ? 0 : newTotalMinor

          await purchaseRepository.deleteItems(client, purchaseId)
          await purchaseRepository.insertPurchaseItems(client, lineItemsToInsert)
        } else if (supplierTermChanged) {
          newOutstandingMinor =
            effectiveSupplierTerm === 'Tunai' ? 0 : po.total_minor
        }

        const updated = await purchaseRepository.updateDraft(
          client,
          request.business_id,
          purchaseId,
          request.expected_server_version,
          {
            branch_id: request.branch_id,
            supplier_id: request.supplier_id,
            supplier_term: supplierTermChanged ? effectiveSupplierTerm : undefined,
            date: request.date,
            due_date: calculatedDueDate,
            total_minor: request.items ? newTotalMinor : undefined,
            outstanding_minor: request.items || supplierTermChanged ? newOutstandingMinor : undefined,
            note: request.note,
          }
        )

        if (!updated) {
          throw new ConflictError(
            'PURCHASE_VERSION_CONFLICT',
            'Concurrent modification detected'
          )
        }

        updated.items = await purchaseRepository.getItems(client, purchaseId)
        updated.payments = []
        return updated
      })
    },

    async send(
      purchaseId: string,
      body: unknown,
      idempotencyKey: string,
      requestHash: string,
      tenantId: string
    ): Promise<PurchaseDto> {
      if (!isUuid(purchaseId)) {
        throw new ValidationError('Purchase id must be a valid UUID')
      }

      const request = validatePurchaseSend(body)
      assertTenant(request.business_id, tenantId)

      return withTransaction(pool, async (client) => {
        const existing = await idempotencyRepository.findActive(
          client,
          request.business_id,
          idempotencyKey
        )
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw new ConflictError(
              'IDEMPOTENCY_KEY_REUSE',
              'Idempotency key was already used with a different request hash',
              { idempotency_key: idempotencyKey }
            )
          }
          return existing.response_body as PurchaseDto
        }

        const po = await purchaseRepository.findByIdForUpdate(
          client,
          request.business_id,
          purchaseId
        )
        if (!po) {
          throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found')
        }

        if (po.status !== 'draft') {
          throw new ValidationError(
            `Cannot send purchase order in '${po.status}' status. Only draft orders can be sent.`
          )
        }

        if (po.server_version !== request.expected_server_version) {
          throw new ConflictError(
            'PURCHASE_VERSION_CONFLICT',
            'Purchase order was modified by another device',
            {
              expected_server_version: request.expected_server_version,
              current_server_version: po.server_version,
            }
          )
        }

        const updated = await purchaseRepository.updateStatus(
          client,
          request.business_id,
          purchaseId,
          request.expected_server_version,
          'sent'
        )

        if (!updated) {
          throw new ConflictError(
            'PURCHASE_VERSION_CONFLICT',
            'Concurrent modification detected'
          )
        }

        updated.items = await purchaseRepository.getItems(client, purchaseId)
        updated.payments = await purchaseRepository.getPayments(
          client,
          request.business_id,
          purchaseId
        )

        await idempotencyRepository.insert(
          client,
          request.business_id,
          idempotencyKey,
          requestHash,
          200,
          updated
        )

        return updated
      })
    },
    async receive(
      purchaseId: string,
      body: unknown,
      idempotencyKey: string,
      requestHash: string,
      tenantId: string,
      actor: string
    ): Promise<PurchaseDto> {
      if (!isUuid(purchaseId)) {
        throw new ValidationError('Purchase id must be a valid UUID')
      }

      const request = validatePurchaseReceive(body)
      assertTenant(request.business_id, tenantId)

      return withTransaction(pool, async (client) => {
        const existing = await idempotencyRepository.findActive(
          client,
          request.business_id,
          idempotencyKey
        )
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw new ConflictError(
              'IDEMPOTENCY_KEY_REUSE',
              'Idempotency key was already used with a different request hash',
              { idempotency_key: idempotencyKey }
            )
          }
          return existing.response_body as PurchaseDto
        }

        const po = await purchaseRepository.findByIdForUpdate(
          client,
          request.business_id,
          purchaseId
        )
        if (!po) {
          throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found')
        }

        if (po.status !== 'sent' && po.status !== 'partial') {
          throw new ValidationError(
            `Cannot receive purchase order in '${po.status}' status. Only sent or partial orders can be received.`
          )
        }

        if (po.server_version !== request.expected_server_version) {
          throw new ConflictError(
            'PURCHASE_VERSION_CONFLICT',
            'Purchase order was modified by another device',
            {
              expected_server_version: request.expected_server_version,
              current_server_version: po.server_version,
            }
          )
        }

        const items = await purchaseRepository.getItems(client, purchaseId)
        const itemsMap = new Map<string, typeof items[0]>()
        for (const it of items) {
          itemsMap.set(it.id, it)
        }

        for (const line of request.items) {
          const item = itemsMap.get(line.item_id)
          if (!item) {
            throw new ValidationError(`Item ${line.item_id} not found on purchase order`)
          }
          if (item.received_qty + line.receive_qty > item.ordered_qty) {
            throw new ValidationError(
              `Receive quantity (${line.receive_qty}) exceeds remaining ordered quantity (${item.ordered_qty - item.received_qty}) for item "${item.product_name}"`
            )
          }
        }

        let receivedValueThis = 0

        for (const line of request.items) {
          const item = itemsMap.get(line.item_id)!

          if (item.product_id) {
            let stock = await inventoryRepository.getStock(
              client,
              request.business_id,
              po.branch_id,
              item.product_id
            )

            if (!stock) {
              stock = await inventoryRepository.createStock(
                client,
                randomUUID(),
                request.business_id,
                po.branch_id,
                item.product_id,
                0
              )
            }

            const updatedStock = await inventoryRepository.updateStockAtomic(
              client,
              stock.id,
              line.receive_qty,
              stock.server_version
            )

            if (!updatedStock) {
              throw new ConflictError(
                'STOCK_VERSION_CONFLICT',
                'Stock was modified concurrently during receiving'
              )
            }

            await inventoryRepository.createMovement(
              client,
              randomUUID(),
              request.business_id,
              po.branch_id,
              item.product_id,
              line.receive_qty,
              'STOCK_IN',
              po.code,
              actor
            )
          }

          await purchaseRepository.updateItemReceivedQty(
            client,
            line.item_id,
            purchaseId,
            line.receive_qty
          )

          receivedValueThis += line.receive_qty * item.unit_cost_minor
        }

        const updatedItems = await purchaseRepository.getItems(client, purchaseId)
        const totalReceivedMinor = updatedItems.reduce(
          (sum, it) => sum + it.received_qty * it.unit_cost_minor,
          0
        )

        const isFullyReceived = updatedItems.every(
          (it) => it.received_qty >= it.ordered_qty
        )
        const newStatus: PurchaseStatus = isFullyReceived ? 'received' : 'partial'

        let newPaidMinor = po.paid_minor
        let newOutstandingMinor = po.outstanding_minor

        if (po.supplier_term === 'Tunai') {
          const paymentRef = `RECEIVE_TUNAI:${po.id}:${createHash('md5')
            .update(idempotencyKey)
            .digest('hex')
            .slice(0, 8)}`

          await purchaseRepository.insertPayment(client, {
            id: randomUUID(),
            business_id: request.business_id,
            purchase_id: po.id,
            branch_id: po.branch_id,
            amount_minor: receivedValueThis,
            method: 'cash',
            reference: paymentRef,
            idempotency_key: idempotencyKey,
          })

          newPaidMinor = po.paid_minor + receivedValueThis
          newOutstandingMinor = Math.max(0, totalReceivedMinor - newPaidMinor)
        } else {
          newOutstandingMinor = Math.max(0, po.total_minor - newPaidMinor)
        }

        const updatedPo = await purchaseRepository.updateReceiveProgress(
          client,
          request.business_id,
          purchaseId,
          request.expected_server_version,
          {
            status: newStatus,
            received_minor: totalReceivedMinor,
            paid_minor: newPaidMinor,
            outstanding_minor: newOutstandingMinor,
          }
        )

        if (!updatedPo) {
          throw new ConflictError(
            'PURCHASE_VERSION_CONFLICT',
            'Concurrent modification detected during receive'
          )
        }

        updatedPo.items = updatedItems
        updatedPo.payments = await purchaseRepository.getPayments(
          client,
          request.business_id,
          purchaseId
        )

        await idempotencyRepository.insert(
          client,
          request.business_id,
          idempotencyKey,
          requestHash,
          200,
          updatedPo
        )

        return updatedPo
      })
    },
    async pay(
      purchaseId: string,
      body: unknown,
      idempotencyKey: string,
      requestHash: string,
      tenantId: string
    ): Promise<PurchaseDto> {
      if (!isUuid(purchaseId)) {
        throw new ValidationError('Purchase id must be a valid UUID')
      }

      const request = validatePurchasePay(body)
      assertTenant(request.business_id, tenantId)

      return withTransaction(pool, async (client) => {
        const existing = await idempotencyRepository.findActive(
          client,
          request.business_id,
          idempotencyKey
        )
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw new ConflictError(
              'IDEMPOTENCY_KEY_REUSE',
              'Idempotency key was already used with a different request hash',
              { idempotency_key: idempotencyKey }
            )
          }
          return existing.response_body as PurchaseDto
        }

        const po = await purchaseRepository.findByIdForUpdate(
          client,
          request.business_id,
          purchaseId
        )
        if (!po) {
          throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found')
        }

        if (po.status !== 'partial' && po.status !== 'received') {
          throw new ValidationError(
            `Cannot make payment on purchase order in '${po.status}' status. Only partial or received orders can be paid.`
          )
        }

        if (po.server_version !== request.expected_server_version) {
          throw new ConflictError(
            'PURCHASE_VERSION_CONFLICT',
            'Purchase order was modified by another device',
            {
              expected_server_version: request.expected_server_version,
              current_server_version: po.server_version,
            }
          )
        }

        if (po.supplier_term === 'Tunai') {
          const maxPayable = po.received_minor - po.paid_minor
          if (request.amount_minor > maxPayable) {
            throw new ValidationError(
              `Payment amount (${request.amount_minor}) exceeds maximum payable amount (${maxPayable}) for Tunai purchase order`
            )
          }
        } else {
          if (request.amount_minor > po.outstanding_minor) {
            throw new ValidationError(
              `Payment amount (${request.amount_minor}) exceeds outstanding balance (${po.outstanding_minor})`
            )
          }
        }

        await purchaseRepository.insertPayment(client, {
          id: randomUUID(),
          business_id: request.business_id,
          purchase_id: po.id,
          branch_id: po.branch_id,
          amount_minor: request.amount_minor,
          method: request.method,
          reference: request.reference ?? 'MANUAL_PAY',
          idempotency_key: idempotencyKey,
        })

        const newPaidMinor = po.paid_minor + request.amount_minor
        const newOutstandingMinor =
          po.supplier_term === 'Tunai'
            ? Math.max(0, po.received_minor - newPaidMinor)
            : Math.max(0, po.total_minor - newPaidMinor)

        const updatedPo = await purchaseRepository.updatePaymentProgress(
          client,
          request.business_id,
          purchaseId,
          request.expected_server_version,
          {
            paid_minor: newPaidMinor,
            outstanding_minor: newOutstandingMinor,
          }
        )

        if (!updatedPo) {
          throw new ConflictError(
            'PURCHASE_VERSION_CONFLICT',
            'Concurrent modification detected during payment'
          )
        }

        updatedPo.items = await purchaseRepository.getItems(client, purchaseId)
        updatedPo.payments = await purchaseRepository.getPayments(
          client,
          request.business_id,
          purchaseId
        )

        await idempotencyRepository.insert(
          client,
          request.business_id,
          idempotencyKey,
          requestHash,
          200,
          updatedPo
        )

        return updatedPo
      })
    },

    async cancel(
      purchaseId: string,
      body: unknown,
      idempotencyKey: string,
      requestHash: string,
      tenantId: string
    ): Promise<PurchaseDto> {
      if (!isUuid(purchaseId)) {
        throw new ValidationError('Purchase id must be a valid UUID')
      }

      const request = validatePurchaseCancel(body)
      assertTenant(request.business_id, tenantId)

      return withTransaction(pool, async (client) => {
        const existing = await idempotencyRepository.findActive(
          client,
          request.business_id,
          idempotencyKey
        )
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw new ConflictError(
              'IDEMPOTENCY_KEY_REUSE',
              'Idempotency key was already used with a different request hash',
              { idempotency_key: idempotencyKey }
            )
          }
          return existing.response_body as PurchaseDto
        }

        const po = await purchaseRepository.findByIdForUpdate(
          client,
          request.business_id,
          purchaseId
        )
        if (!po) {
          throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found')
        }

        if (po.status === 'received' || po.status === 'cancelled') {
          throw new ValidationError(
            `Cannot cancel purchase order in '${po.status}' status.`
          )
        }

        if (po.server_version !== request.expected_server_version) {
          throw new ConflictError(
            'PURCHASE_VERSION_CONFLICT',
            'Purchase order was modified by another device',
            {
              expected_server_version: request.expected_server_version,
              current_server_version: po.server_version,
            }
          )
        }

        const updated = await purchaseRepository.updateStatus(
          client,
          request.business_id,
          purchaseId,
          request.expected_server_version,
          'cancelled'
        )

        if (!updated) {
          throw new ConflictError(
            'PURCHASE_VERSION_CONFLICT',
            'Concurrent modification detected during cancellation'
          )
        }

        updated.items = await purchaseRepository.getItems(client, purchaseId)
        updated.payments = await purchaseRepository.getPayments(
          client,
          request.business_id,
          purchaseId
        )

        await idempotencyRepository.insert(
          client,
          request.business_id,
          idempotencyKey,
          requestHash,
          200,
          updated
        )

        return updated
      })
    },

    async deleteDraft(purchaseId: string, tenantId: string): Promise<void> {
      if (!isUuid(purchaseId)) {
        throw new ValidationError('Purchase id must be a valid UUID')
      }

      return withTransaction(pool, async (client) => {
        const po = await purchaseRepository.findById(client, tenantId, purchaseId)
        if (!po) {
          throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found')
        }

        if (po.status !== 'draft') {
          throw new ValidationError(
            `Only draft purchase orders can be deleted. Use cancel for '${po.status}' orders.`
          )
        }

        const deleted = await purchaseRepository.softDeleteDraft(
          client,
          tenantId,
          purchaseId
        )
        if (!deleted) {
          throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found')
        }
      })
    },
  }
}
