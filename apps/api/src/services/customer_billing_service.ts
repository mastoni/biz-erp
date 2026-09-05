import { Pool, PoolClient } from 'pg'
import { randomUUID } from 'crypto'
import { ApiError } from '../errors/api_error'
import { ConflictError } from '../errors/conflict_error'
import { withTransaction } from '../db/transaction'
import { isUuid } from '../utils/uuid'
import {
  CreateCustomerSubscriptionRequest,
  UpdateCustomerSubscriptionRequest,
  SubscriptionActionRequest,
  GenerateInvoiceRequest,
  CustomerSubscriptionQuery,
  CustomerSubscriptionDto,
  CustomerSubscriptionDetailDto,
  CustomerSubscriptionBillingCycle,
  isFinancialSubscriptionUpdate
} from '../dto/customer_subscription_dto'
import {
  RecordInvoicePaymentRequest,
  CancelInvoiceRequest,
  CustomerInvoiceQuery,
  CustomerInvoiceDto,
  CustomerInvoiceDetailDto
} from '../dto/customer_invoice_dto'
import { customerSubscriptionRepository } from '../repositories/customer_subscription_repository'
import { customerInvoiceRepository } from '../repositories/customer_invoice_repository'
import { tenantInvoiceCounterRepository } from '../repositories/tenant_invoice_counter_repository'
import { customerRepository } from '../repositories/customer_repository'
import { accountRepository } from '../repositories/account_repository'
import { journalRepository } from '../repositories/journal_repository'

export interface ActorContext {
  userId?: string
  email?: string
  role?: string
}

/**
 * Calculates billing period and next billing date based on anniversary billing and anchor_day.
 */
export function calculateNextAnniversaryBillingPeriod(
  currentBillingDateStr: string,
  anchorDay: number,
  cycle: CustomerSubscriptionBillingCycle
): {
  periodStart: string
  periodEnd: string
  nextBillingDate: string
  dueDate: string
} {
  const parts = currentBillingDateStr.split('-').map(Number)
  const currentYear = parts[0]
  const currentMonth = parts[1] // 1-indexed (1..12)
  const currentDay = parts[2]

  let monthsToAdd = 1
  switch (cycle) {
    case 'MONTHLY':
      monthsToAdd = 1
      break
    case 'QUARTERLY':
      monthsToAdd = 3
      break
    case 'SEMI_ANNUAL':
      monthsToAdd = 6
      break
    case 'ANNUAL':
      monthsToAdd = 12
      break
  }

  // Calculate target year and month
  const totalMonths = (currentMonth - 1) + monthsToAdd
  const targetYear = currentYear + Math.floor(totalMonths / 12)
  const targetMonth = (totalMonths % 12) + 1 // 1-indexed

  // Number of days in target month
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
  const clampedDay = Math.min(anchorDay, daysInTargetMonth)

  const pad = (n: number) => String(n).padStart(2, '0')

  const nextBillingDate = `${targetYear}-${pad(targetMonth)}-${pad(clampedDay)}`

  // Billing period start is the current billing date
  const periodStart = currentBillingDateStr

  // Billing period end is 1 day before the next billing date
  const nextDateObj = new Date(Date.UTC(targetYear, targetMonth - 1, clampedDay))
  nextDateObj.setUTCDate(nextDateObj.getUTCDate() - 1)
  const periodEnd = `${nextDateObj.getUTCFullYear()}-${pad(nextDateObj.getUTCMonth() + 1)}-${pad(nextDateObj.getUTCDate())}`

  // Default due date: 7 days after period start
  const startDateObj = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay))
  startDateObj.setUTCDate(startDateObj.getUTCDate() + 7)
  const dueDate = `${startDateObj.getUTCFullYear()}-${pad(startDateObj.getUTCMonth() + 1)}-${pad(startDateObj.getUTCDate())}`

  return {
    periodStart,
    periodEnd,
    nextBillingDate,
    dueDate
  }
}

async function recordAuditLog(
  client: PoolClient,
  action: string,
  targetType: string,
  targetId: string,
  beforeState: Record<string, unknown> | null,
  afterState: Record<string, unknown> | null,
  actorContext?: ActorContext
) {
  try {
    const actorId = actorContext?.userId && isUuid(actorContext.userId) ? actorContext.userId : null
    await client.query(
      `INSERT INTO platform_audit_logs (
        actor_id, actor_email, actor_scope, actor_role, action,
        target_type, target_id, before_state, after_state, status, metadata, created_at
      ) VALUES ($1, $2, 'tenant', $3, $4, $5, $6, $7, $8, 'SUCCESS', '{}', now())`,
      [
        actorId,
        actorContext?.email ?? null,
        actorContext?.role ?? null,
        action,
        targetType,
        targetId,
        beforeState ? JSON.stringify(beforeState) : null,
        afterState ? JSON.stringify(afterState) : null
      ]
    )
  } catch (_e) {
    // Non-blocking audit logger in case table structure differs
  }
}

export function createCustomerBillingService(pool: Pool) {
  return {
    /**
     * Creates a new customer recurring subscription agreement.
     */
    async createSubscription(
      businessId: string,
      request: CreateCustomerSubscriptionRequest,
      actorContext?: ActorContext
    ): Promise<CustomerSubscriptionDto> {
      return withTransaction(pool, async (client) => {
        // 1. Verify customer exists in the same tenant
        const customer = await customerRepository.findById(client, businessId, request.customer_id)
        if (!customer) {
          throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found in this business')
        }

        // 2. Determine anchor_day and next_billing_date
        const startsAtDate = request.starts_at ? new Date(request.starts_at) : new Date()
        const anchorDay = request.anchor_day ?? startsAtDate.getUTCDate()

        const pad = (n: number) => String(n).padStart(2, '0')
        const defaultStartDate = `${startsAtDate.getUTCFullYear()}-${pad(startsAtDate.getUTCMonth() + 1)}-${pad(startsAtDate.getUTCDate())}`
        const nextBillingDate = request.next_billing_date ?? defaultStartDate

        // 3. Create subscription row with snapshotted price
        const sub = await customerSubscriptionRepository.create(client, {
          business_id: businessId,
          customer_id: request.customer_id,
          plan_code: request.plan_code,
          product_id: request.product_id,
          name: request.name,
          unit_price_minor: request.unit_price_minor,
          discount_minor: request.discount_minor ?? 0,
          tax_minor: request.tax_minor ?? 0,
          total_minor: request.total_minor ?? (request.unit_price_minor - (request.discount_minor ?? 0) + (request.tax_minor ?? 0)),
          currency: request.currency ?? 'IDR',
          billing_cycle: request.billing_cycle,
          status: 'ACTIVE',
          starts_at: startsAtDate.toISOString(),
          ends_at: request.ends_at,
          next_billing_date: nextBillingDate,
          anchor_day: anchorDay,
          notes: request.notes,
          metadata: request.metadata
        })

        // 4. Record audit log
        await recordAuditLog(
          client,
          'CUSTOMER_SUBSCRIPTION_CREATED',
          'customer_subscription',
          sub.id,
          null,
          sub as any,
          actorContext
        )

        return sub
      })
    },

    /**
     * Retrieves a single subscription by ID.
     */
    async getSubscription(
      businessId: string,
      subscriptionId: string
    ): Promise<CustomerSubscriptionDto> {
      return withTransaction(pool, async (client) => {
        const sub = await customerSubscriptionRepository.findById(client, businessId, subscriptionId)
        if (!sub) {
          throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Customer subscription not found')
        }
        return sub
      })
    },

    /**
     * Lists subscriptions with query filtering and pagination.
     */
    async listSubscriptions(
      businessId: string,
      query: CustomerSubscriptionQuery = {}
    ): Promise<{ items: CustomerSubscriptionDto[]; total: number }> {
      return withTransaction(pool, async (client) => {
        return customerSubscriptionRepository.list(client, businessId, query)
      })
    },

    /**
     * Updates subscription attributes (operational fields for STAFF/OWNER, pricing for OWNER only).
     */
    async updateSubscription(
      businessId: string,
      subscriptionId: string,
      request: UpdateCustomerSubscriptionRequest,
      actorContext?: ActorContext
    ): Promise<CustomerSubscriptionDto> {
      return withTransaction(pool, async (client) => {
        const sub = await customerSubscriptionRepository.lockById(client, businessId, subscriptionId)
        if (!sub) {
          throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Customer subscription not found')
        }

        if (sub.status === 'CANCELLED') {
          throw new ApiError(400, 'INVALID_STATE', 'Cannot update a cancelled subscription')
        }

        // RBAC Enforcement: Only OWNER can update financial pricing fields
        const hasFinancial = isFinancialSubscriptionUpdate(request)
        if (hasFinancial && actorContext?.role && actorContext.role !== 'OWNER' && actorContext.role !== 'PLATFORM_ADMIN' && actorContext.role !== 'SUPER_ADMIN') {
          throw new ApiError(403, 'FORBIDDEN', 'Only OWNER may update financial pricing fields')
        }

        // Recompute total if financial fields changed
        let unit_price_minor = request.unit_price_minor ?? sub.unit_price_minor
        let discount_minor = request.discount_minor ?? sub.discount_minor
        let tax_minor = request.tax_minor ?? sub.tax_minor
        let total_minor = request.total_minor ?? (unit_price_minor - discount_minor + tax_minor)

        if (discount_minor > unit_price_minor) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'discount_minor cannot exceed unit_price_minor')
        }

        const updated = await customerSubscriptionRepository.update(client, businessId, subscriptionId, {
          name: request.name,
          notes: request.notes,
          metadata: request.metadata,
          ends_at: request.ends_at,
          unit_price_minor: request.unit_price_minor,
          discount_minor: request.discount_minor,
          tax_minor: request.tax_minor,
          total_minor: hasFinancial ? total_minor : undefined,
          billing_cycle: request.billing_cycle
        })

        if (!updated) {
          throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Customer subscription not found')
        }

        await recordAuditLog(
          client,
          'CUSTOMER_SUBSCRIPTION_UPDATED',
          'customer_subscription',
          subscriptionId,
          sub as any,
          updated as any,
          actorContext
        )

        return updated
      })
    },

    /**
     * Pauses an active customer subscription.
     */
    async pauseSubscription(
      businessId: string,
      subscriptionId: string,
      request: SubscriptionActionRequest = {},
      actorContext?: ActorContext
    ): Promise<CustomerSubscriptionDto> {
      return withTransaction(pool, async (client) => {
        const sub = await customerSubscriptionRepository.lockById(client, businessId, subscriptionId)
        if (!sub) {
          throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Customer subscription not found')
        }

        if (sub.status !== 'ACTIVE') {
          throw new ApiError(400, 'INVALID_STATE', `Cannot pause subscription in ${sub.status} status`)
        }

        const updated = await customerSubscriptionRepository.updateStatus(client, businessId, subscriptionId, 'PAUSED')
        if (!updated) {
          throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Customer subscription not found')
        }

        await recordAuditLog(
          client,
          'CUSTOMER_SUBSCRIPTION_PAUSED',
          'customer_subscription',
          subscriptionId,
          sub as any,
          updated as any,
          actorContext
        )

        return updated
      })
    },

    /**
     * Resumes a paused customer subscription.
     */
    async resumeSubscription(
      businessId: string,
      subscriptionId: string,
      request: SubscriptionActionRequest = {},
      actorContext?: ActorContext
    ): Promise<CustomerSubscriptionDto> {
      return withTransaction(pool, async (client) => {
        const sub = await customerSubscriptionRepository.lockById(client, businessId, subscriptionId)
        if (!sub) {
          throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Customer subscription not found')
        }

        if (sub.status !== 'PAUSED') {
          throw new ApiError(400, 'INVALID_STATE', `Cannot resume subscription in ${sub.status} status`)
        }

        const updated = await customerSubscriptionRepository.updateStatus(client, businessId, subscriptionId, 'ACTIVE')
        if (!updated) {
          throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Customer subscription not found')
        }

        await recordAuditLog(
          client,
          'CUSTOMER_SUBSCRIPTION_RESUMED',
          'customer_subscription',
          subscriptionId,
          sub as any,
          updated as any,
          actorContext
        )

        return updated
      })
    },

    /**
     * Cancels a customer subscription. Cancelled subscriptions can never be resumed or billed.
     */
    async cancelSubscription(
      businessId: string,
      subscriptionId: string,
      request: SubscriptionActionRequest = {},
      actorContext?: ActorContext
    ): Promise<CustomerSubscriptionDto> {
      return withTransaction(pool, async (client) => {
        const sub = await customerSubscriptionRepository.lockById(client, businessId, subscriptionId)
        if (!sub) {
          throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Customer subscription not found')
        }

        if (sub.status === 'CANCELLED') {
          throw new ApiError(400, 'INVALID_STATE', 'Subscription is already cancelled')
        }

        const updated = await customerSubscriptionRepository.updateStatus(
          client,
          businessId,
          subscriptionId,
          'CANCELLED',
          new Date().toISOString()
        )
        if (!updated) {
          throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Customer subscription not found')
        }

        await recordAuditLog(
          client,
          'CUSTOMER_SUBSCRIPTION_CANCELLED',
          'customer_subscription',
          subscriptionId,
          sub as any,
          updated as any,
          actorContext
        )

        return updated
      })
    },

    /**
     * Canonical method for generating a customer recurring invoice.
     * Executes atomically within a transaction:
     * 1. Lock subscription
     * 2. Verify ACTIVE status & contract validity
     * 3. Compute billing period
     * 4. Check duplicate period
     * 5. Allocate monotonic tenant invoice sequence
     * 6. Create Accounts Receivable record
     * 7. Create customer invoice record
     * 8. Post balanced Dr AR / Cr Revenue general ledger journal
     * 9. Advance subscription next_billing_date
     */
    async generateCustomerInvoice(
      businessId: string,
      subscriptionId: string,
      request?: GenerateInvoiceRequest,
      actorContext?: ActorContext
    ): Promise<CustomerInvoiceDto> {
      return withTransaction(pool, async (client) => {
        // 1. Lock subscription row
        const subscription = await customerSubscriptionRepository.lockById(client, businessId, subscriptionId)
        if (!subscription) {
          throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Customer subscription not found')
        }

        // 2. Validate ACTIVE status & contract end date
        if (subscription.status !== 'ACTIVE') {
          throw new ApiError(400, 'INVALID_STATE', `Cannot generate invoice for subscription in ${subscription.status} status`)
        }

        if (subscription.ends_at && new Date(subscription.ends_at) < new Date()) {
          throw new ApiError(400, 'INVALID_STATE', 'Subscription contract term has already ended')
        }

        // 3. Compute billing period & next billing date
        let periodStart: string
        let periodEnd: string
        let nextBillingDate: string
        let dueDate: string

        if (request?.billing_period_start && request?.billing_period_end) {
          periodStart = request.billing_period_start
          periodEnd = request.billing_period_end
          const calc = calculateNextAnniversaryBillingPeriod(
            periodStart,
            subscription.anchor_day,
            subscription.billing_cycle
          )
          nextBillingDate = calc.nextBillingDate
          dueDate = request.due_date ?? calc.dueDate
        } else {
          const calc = calculateNextAnniversaryBillingPeriod(
            subscription.next_billing_date,
            subscription.anchor_day,
            subscription.billing_cycle
          )
          periodStart = calc.periodStart
          periodEnd = calc.periodEnd
          nextBillingDate = calc.nextBillingDate
          dueDate = request?.due_date ?? calc.dueDate
        }

        // 4. Duplicate period check
        const existingInvoice = await customerInvoiceRepository.findBySubscriptionAndPeriod(
          client,
          businessId,
          subscription.id,
          periodStart,
          periodEnd
        )
        if (existingInvoice) {
          return existingInvoice
        }

        // 5. Allocate tenant-scoped monotonic sequence number
        const yearMonth = periodStart.slice(0, 7).replace('-', '') // e.g. '202609'
        const seq = await tenantInvoiceCounterRepository.allocateNextSequence(client, businessId, yearMonth)
        const invoiceNumber = tenantInvoiceCounterRepository.formatInvoiceNumber(yearMonth, seq)

        // 6. Ensure default accounts exist for tenant
        await accountRepository.createDefaultAccounts(client, businessId)

        const arAccount = await accountRepository.findByType(client, businessId, 'receivable')
        const revenueAccount = await accountRepository.findByType(client, businessId, 'revenue')

        if (!arAccount || !revenueAccount) {
          throw new ApiError(500, 'CONFIG_ERROR', 'Receivable or Revenue chart of accounts not configured')
        }

        // 7. Create Accounts Receivable entry
        const receivableId = randomUUID()
        await client.query(
          `INSERT INTO receivables (
            id, business_id, sale_id, customer_id, branch_id,
            amount_minor, paid_minor, outstanding_minor,
            date, reference, description, status, server_version, created_at, updated_at
          ) VALUES (
            $1, $2, NULL, $3, NULL,
            $4, 0, $4,
            $5, $6, $7, 'OPEN', 1, now(), now()
          )`,
          [
            receivableId,
            businessId,
            subscription.customer_id,
            subscription.total_minor,
            periodStart,
            invoiceNumber,
            `Customer Invoice ${invoiceNumber} - ${subscription.name}`
          ]
        )

        // 8. Create Customer Invoice record
        const invoice = await customerInvoiceRepository.create(client, {
          invoice_number: invoiceNumber,
          business_id: businessId,
          customer_subscription_id: subscription.id,
          customer_id: subscription.customer_id,
          receivable_id: receivableId,
          billing_period_start: periodStart,
          billing_period_end: periodEnd,
          subtotal_minor: subscription.unit_price_minor,
          discount_minor: subscription.discount_minor,
          tax_minor: subscription.tax_minor,
          total_minor: subscription.total_minor,
          currency: subscription.currency,
          status: 'ISSUED',
          issue_date: periodStart,
          due_date: dueDate,
          notes: request?.notes ?? subscription.notes
        })

        // 9. Post Balanced General Ledger Journal (Dr AR / Cr Revenue)
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, businessId, {
          id: journalId,
          date: periodStart,
          source_type: 'RECEIVABLE',
          source_id: receivableId,
          reference: invoiceNumber,
          description: `Customer Invoice ${invoiceNumber}`
        })

        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: arAccount.id,
          debit_minor: subscription.total_minor,
          credit_minor: 0,
          description: 'Accounts receivable from customer invoice'
        })

        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: revenueAccount.id,
          debit_minor: 0,
          credit_minor: subscription.total_minor,
          description: 'Revenue from customer recurring subscription'
        })

        await journalRepository.postJournal(client, journalId)

        // 10. Advance next_billing_date on subscription
        await customerSubscriptionRepository.advanceBillingDate(client, businessId, subscription.id, nextBillingDate)

        // 11. Record audit log
        await recordAuditLog(
          client,
          'CUSTOMER_INVOICE_GENERATED',
          'customer_invoice',
          invoice.id,
          null,
          invoice as any,
          actorContext
        )

        return invoice
      })
    },

    /**
     * Retrieves an invoice by ID.
     */
    async getInvoice(
      businessId: string,
      invoiceId: string
    ): Promise<CustomerInvoiceDetailDto> {
      return withTransaction(pool, async (client) => {
        const invoice = await customerInvoiceRepository.findById(client, businessId, invoiceId)
        if (!invoice) {
          throw new ApiError(404, 'INVOICE_NOT_FOUND', 'Customer invoice not found')
        }
        return invoice
      })
    },

    /**
     * Lists customer invoices with query filters and pagination.
     */
    async listInvoices(
      businessId: string,
      query: CustomerInvoiceQuery = {}
    ): Promise<{ items: CustomerInvoiceDto[]; total: number }> {
      return withTransaction(pool, async (client) => {
        return customerInvoiceRepository.list(client, businessId, query)
      })
    },

    /**
     * Records a payment against a customer invoice.
     * Executes payment collection and synchronizes invoice status within the SAME database transaction.
     */
    async recordInvoicePayment(
      businessId: string,
      invoiceId: string,
      request: RecordInvoicePaymentRequest,
      actorContext?: ActorContext
    ): Promise<CustomerInvoiceDto> {
      return withTransaction(pool, async (client) => {
        // 1. Lock invoice
        const invoice = await customerInvoiceRepository.lockById(client, businessId, invoiceId)
        if (!invoice) {
          throw new ApiError(404, 'INVOICE_NOT_FOUND', 'Customer invoice not found')
        }

        // 2. Validate invoice status
        if (invoice.status === 'CANCELLED') {
          throw new ApiError(409, 'INVALID_STATE', 'Cannot record payment against a cancelled invoice')
        }
        if (invoice.status === 'PAID') {
          throw new ApiError(409, 'ALREADY_PAID', 'Invoice is already fully paid')
        }

        // 3. Lock linked receivable
        const recRes = await client.query(
          'SELECT * FROM receivables WHERE id = $1 AND business_id = $2 FOR UPDATE',
          [invoice.receivable_id, businessId]
        )
        if (recRes.rows.length === 0) {
          throw new ApiError(404, 'RECEIVABLE_NOT_FOUND', 'Linked receivable not found')
        }
        const receivable = recRes.rows[0]

        if (receivable.status === 'REVERSED') {
          throw new ApiError(409, 'INVALID_STATE', 'Linked receivable is reversed')
        }

        const outstandingMinor = Number(receivable.outstanding_minor)
        if (request.amount_minor > outstandingMinor) {
          throw new ApiError(400, 'OVERPAYMENT', `Payment amount (${request.amount_minor}) exceeds outstanding balance (${outstandingMinor})`)
        }

        // 4. Check idempotency
        const existingPaymentRes = await client.query(
          'SELECT * FROM customer_payments WHERE business_id = $1 AND idempotency_key = $2',
          [businessId, request.idempotency_key]
        )
        if (existingPaymentRes.rows.length > 0) {
          // Idempotent retry: return current invoice
          const currentInv = await customerInvoiceRepository.findById(client, businessId, invoiceId)
          return currentInv!
        }

        // 5. Resolve payment cash/bank account and AR account
        const paymentAccountType = request.method === 'cash' ? 'cash' : 'bank'
        const paymentAccount = await accountRepository.findByType(client, businessId, paymentAccountType)
        const arAccount = await accountRepository.findByType(client, businessId, 'receivable')

        if (!paymentAccount || !arAccount) {
          throw new ApiError(500, 'CONFIG_ERROR', 'Payment or Receivable account not configured')
        }

        // 6. Create customer payment record
        const paymentId = randomUUID()
        const paymentDate = new Date().toISOString().slice(0, 10)
        const paymentRef = request.reference ?? invoice.invoice_number

        await client.query(
          `INSERT INTO customer_payments (
            id, business_id, receivable_id, customer_id, branch_id,
            amount_minor, method, reference, idempotency_key, created_at
          ) VALUES (
            $1, $2, $3, $4, NULL,
            $5, $6, $7, $8, now()
          )`,
          [
            paymentId,
            businessId,
            invoice.receivable_id,
            invoice.customer_id,
            request.amount_minor,
            request.method,
            paymentRef,
            request.idempotency_key
          ]
        )

        // 7. Post customer payment general ledger journal (Dr Cash/Bank / Cr AR)
        const journalId = randomUUID()
        await journalRepository.createDraftJournal(client, businessId, {
          id: journalId,
          date: paymentDate,
          source_type: 'CUSTOMER_PAYMENT',
          source_id: paymentId,
          reference: paymentRef,
          description: `Payment on invoice ${invoice.invoice_number}`
        })

        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: paymentAccount.id,
          debit_minor: request.amount_minor,
          credit_minor: 0,
          description: 'Cash inflow from customer invoice payment'
        })

        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: arAccount.id,
          debit_minor: 0,
          credit_minor: request.amount_minor,
          description: 'Accounts receivable collection'
        })

        await journalRepository.postJournal(client, journalId)

        // 8. Update receivable settlement
        const newPaid = Number(receivable.paid_minor) + request.amount_minor
        const newOutstanding = outstandingMinor - request.amount_minor
        const newRecStatus = newOutstanding === 0 ? 'PAID' : 'PARTIAL'

        await client.query(
          `UPDATE receivables
           SET paid_minor = $1, outstanding_minor = $2, status = $3,
               server_version = server_version + 1, updated_at = now()
           WHERE id = $4 AND business_id = $5`,
          [newPaid, newOutstanding, newRecStatus, invoice.receivable_id, businessId]
        )

        // 9. Synchronize invoice status
        let updatedInvoice: CustomerInvoiceDto | null
        if (newOutstanding === 0) {
          // Full payment: ISSUED or OVERDUE -> PAID
          updatedInvoice = await customerInvoiceRepository.updateStatus(
            client,
            businessId,
            invoice.id,
            'PAID',
            new Date().toISOString(),
            paymentRef
          )
          await recordAuditLog(
            client,
            'CUSTOMER_INVOICE_PAID',
            'customer_invoice',
            invoice.id,
            invoice as any,
            updatedInvoice as any,
            actorContext
          )
        } else {
          // Partial payment: status remains ISSUED or OVERDUE
          updatedInvoice = await customerInvoiceRepository.updateStatus(
            client,
            businessId,
            invoice.id,
            invoice.status,
            null,
            paymentRef
          )
        }

        return updatedInvoice!
      })
    },

    /**
     * Cancels an unpaid customer invoice (OWNER only).
     * Reverses receivable and posts balanced reversal journal entry (Dr Revenue / Cr AR).
     */
    async cancelInvoice(
      businessId: string,
      invoiceId: string,
      request: CancelInvoiceRequest = {},
      actorContext?: ActorContext
    ): Promise<CustomerInvoiceDto> {
      return withTransaction(pool, async (client) => {
        // 1. RBAC check: only OWNER or PLATFORM_ADMIN
        if (actorContext?.role && actorContext.role !== 'OWNER' && actorContext.role !== 'PLATFORM_ADMIN' && actorContext.role !== 'SUPER_ADMIN') {
          throw new ApiError(403, 'FORBIDDEN', 'Only OWNER may cancel a customer invoice')
        }

        // 2. Lock invoice
        const invoice = await customerInvoiceRepository.lockById(client, businessId, invoiceId)
        if (!invoice) {
          throw new ApiError(404, 'INVOICE_NOT_FOUND', 'Customer invoice not found')
        }

        if (invoice.status === 'CANCELLED') {
          throw new ApiError(400, 'INVALID_STATE', 'Invoice is already cancelled')
        }

        if (invoice.status === 'PAID') {
          throw new ApiError(409, 'PAYMENT_EXISTS', 'Cannot cancel a fully paid invoice')
        }

        // 3. Lock linked receivable
        const recRes = await client.query(
          'SELECT * FROM receivables WHERE id = $1 AND business_id = $2 FOR UPDATE',
          [invoice.receivable_id, businessId]
        )
        if (recRes.rows.length === 0) {
          throw new ApiError(404, 'RECEIVABLE_NOT_FOUND', 'Linked receivable not found')
        }
        const receivable = recRes.rows[0]

        // 4. Check if any payment was recorded
        if (Number(receivable.paid_minor) > 0) {
          throw new ApiError(
            409,
            'PAYMENT_EXISTS',
            'Cannot cancel an invoice with recorded payments; issue a credit note or payment reversal instead'
          )
        }

        // 5. Update invoice status to CANCELLED
        const updatedInvoice = await customerInvoiceRepository.updateStatus(
          client,
          businessId,
          invoice.id,
          'CANCELLED'
        )

        // 6. Reverse receivable
        await client.query(
          `UPDATE receivables
           SET status = 'REVERSED',
               server_version = server_version + 1, updated_at = now()
           WHERE id = $1 AND business_id = $2`,
          [invoice.receivable_id, businessId]
        )

        // 7. Post balanced reversal journal (Dr Revenue / Cr AR)
        const arAccount = await accountRepository.findByType(client, businessId, 'receivable')
        const revAccount = await accountRepository.findByType(client, businessId, 'revenue')

        if (arAccount && revAccount) {
          const journalId = randomUUID()
          await journalRepository.createDraftJournal(client, businessId, {
            id: journalId,
            date: new Date().toISOString().slice(0, 10),
            source_type: 'REVERSAL',
            source_id: invoice.receivable_id,
            reference: invoice.invoice_number,
            description: `Reversal of customer invoice ${invoice.invoice_number}${request.reason ? ` - ${request.reason}` : ''}`
          })

          await journalRepository.addJournalLine(client, {
            id: randomUUID(),
            journal_entry_id: journalId,
            account_id: revAccount.id,
            debit_minor: invoice.total_minor,
            credit_minor: 0,
            description: 'Revenue reversal for cancelled customer invoice'
          })

          await journalRepository.addJournalLine(client, {
            id: randomUUID(),
            journal_entry_id: journalId,
            account_id: arAccount.id,
            debit_minor: 0,
            credit_minor: invoice.total_minor,
            description: 'Accounts receivable reversal for cancelled customer invoice'
          })

          await journalRepository.postJournal(client, journalId)
        }

        // 8. Record audit log
        await recordAuditLog(
          client,
          'CUSTOMER_INVOICE_CANCELLED',
          'customer_invoice',
          invoice.id,
          invoice as any,
          updatedInvoice as any,
          actorContext
        )

        return updatedInvoice!
      })
    },

    /**
     * Marks all past-due ISSUED invoices as OVERDUE.
     */
    async markOverdueInvoices(
      businessId: string,
      asOfDate?: string
    ): Promise<number> {
      return withTransaction(pool, async (client) => {
        return customerInvoiceRepository.markOverdue(client, businessId, asOfDate)
      })
    },

    /**
     * Alias for markOverdueInvoices.
     */
    async processOverdueInvoices(
      businessId: string,
      asOfDate?: string
    ): Promise<number> {
      return withTransaction(pool, async (client) => {
        return customerInvoiceRepository.markOverdue(client, businessId, asOfDate)
      })
    }
  }
}
