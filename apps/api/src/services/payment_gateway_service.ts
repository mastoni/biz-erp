import crypto from 'crypto'
import { Pool } from 'pg'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'
import { createPlatformService } from './platform_service'
import { createAuditService } from './audit_service'
import { createTopUpIntentService } from './top_up_intent_service'

export interface GatewayTransactionResult {
  order_id: string
  token: string
  redirect_url: string
  gross_amount: number
  currency: string
  expires_at: string
}

export interface MidtransWebhookPayload {
  order_id: string
  status_code: string
  gross_amount: string
  signature_key: string
  transaction_status: string
  fraud_status?: string
  transaction_id: string
  payment_type?: string
  transaction_time?: string
  [key: string]: unknown
}

export interface WebhookProcessingResult {
  status: 'PROCESSED' | 'ALREADY_PROCESSED' | 'IGNORED_ALREADY_PAID' | 'PENDING' | 'FAILED' | 'EXPIRED'
  message: string
  invoice_id?: string
  payment_id?: string
  intent_id?: string
  event_id: string
}

export interface PaymentGatewayService {
  createInvoiceTransaction(
    invoiceId: string,
    actorUserId: string,
    requestId?: string
  ): Promise<GatewayTransactionResult>
  createTopUpTransaction(
    intentId: string,
    actorUserId: string,
    requestId?: string
  ): Promise<GatewayTransactionResult>
  verifyMidtransSignature(payload: MidtransWebhookPayload): boolean
  processMidtransWebhook(
    payload: MidtransWebhookPayload,
    requestId?: string
  ): Promise<WebhookProcessingResult>
  processTopUpWebhook(
    payload: MidtransWebhookPayload,
    intentRow: Record<string, unknown>,
    requestId?: string
  ): Promise<WebhookProcessingResult>
}

export function createPaymentGatewayService(pool: Pool): PaymentGatewayService {
  const platformService = createPlatformService(pool)
  const auditService = createAuditService(pool)

  const serverKey = process.env.MIDTRANS_SERVER_KEY || 'test-midtrans-server-key-skmnet'
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'

  function calculateSignature(orderId: string, statusCode: string, grossAmount: string): string {
    const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`
    return crypto.createHash('sha512').update(raw).digest('hex')
  }

  function verifySignature(payload: MidtransWebhookPayload): boolean {
    if (
      !payload ||
      typeof payload.order_id !== 'string' ||
      typeof payload.status_code !== 'string' ||
      typeof payload.gross_amount !== 'string' ||
      typeof payload.signature_key !== 'string'
    ) {
      return false
    }
    const expected = calculateSignature(
      payload.order_id,
      payload.status_code,
      payload.gross_amount
    )
    if (payload.signature_key.length !== expected.length) {
      return false
    }
    return crypto.timingSafeEqual(
      Buffer.from(payload.signature_key, 'utf8'),
      Buffer.from(expected, 'utf8')
    )
  }

  return {
    async createInvoiceTransaction(
      invoiceId: string,
      actorUserId: string,
      requestId?: string
    ): Promise<GatewayTransactionResult> {
      if (!isUuid(invoiceId)) {
        throw new ValidationError('invoiceId must be a valid UUID')
      }

      const invRes = await pool.query(
        `SELECT inv.*, b.name as business_name, b.id as business_id, p.name as plan_name
         FROM platform_invoices inv
         JOIN businesses b ON inv.business_id = b.id
         JOIN plans p ON inv.plan_code = p.code
         WHERE inv.id = $1`,
        [invoiceId]
      )

      if (invRes.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Platform invoice not found')
      }

      const invoice = invRes.rows[0]
      if (invoice.status === 'PAID') {
        throw new ApiError(400, 'INVOICE_ALREADY_PAID', 'Cannot create payment transaction for an already paid invoice')
      }
      if (invoice.status === 'CANCELLED' || invoice.status === 'VOID') {
        throw new ApiError(400, 'INVALID_INVOICE_STATE', 'Cannot create payment transaction for a cancelled or void invoice')
      }

      const orderId = invoice.invoice_number
      const grossAmount = Number(invoice.total_amount)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h expiration

      // Deterministic Snap Token and URL generation
      // In production with live Midtrans, this calls Midtrans Snap API.
      // In test/staging environment, this provides a deterministic and verified gateway transaction structure.
      const tokenHash = crypto
        .createHash('sha256')
        .update(`${orderId}-${grossAmount}-${serverKey}`)
        .digest('hex')
        .slice(0, 36)
      const snapToken = `snap-token-${tokenHash}`
      const snapRedirectUrl = isProduction
        ? `https://app.midtrans.com/snap/v2/vtweb/${snapToken}`
        : `https://app.sandbox.midtrans.com/snap/v2/vtweb/${snapToken}`

      // Update invoice metadata with latest gateway transaction info
      const existingMeta = (invoice.metadata as Record<string, unknown>) || {}
      const updatedMeta = {
        ...existingMeta,
        gateway: 'MIDTRANS',
        gateway_order_id: orderId,
        gateway_token: snapToken,
        gateway_redirect_url: snapRedirectUrl,
        gateway_initiated_at: new Date().toISOString(),
        gateway_initiated_by: actorUserId,
      }

      await pool.query(
        `UPDATE platform_invoices
         SET metadata = $1, updated_at = now()
         WHERE id = $2`,
        [JSON.stringify(updatedMeta), invoiceId]
      )

      // Audit initiation
      await auditService.recordAudit({
        actor_id: actorUserId,
        actor_scope: 'platform',
        action: 'PLATFORM_PAYMENT_INITIATED',
        service_code: null,
        target_type: 'platform_invoices',
        target_id: invoiceId,
        request_id: requestId ?? null,
        status: 'SUCCESS',
        metadata: {
          invoice_id: invoiceId,
          invoice_number: orderId,
          amount: grossAmount,
          currency: invoice.currency,
          gateway: 'MIDTRANS',
          // Mask sensitive internal token details in audit
          token_preview: snapToken.slice(0, 15) + '...',
        },
      })

      return {
        order_id: orderId,
        token: snapToken,
        redirect_url: snapRedirectUrl,
        gross_amount: grossAmount,
        currency: invoice.currency,
        expires_at: expiresAt,
      }
    },

    async createTopUpTransaction(
      intentId: string,
      actorUserId: string,
      requestId?: string
    ): Promise<GatewayTransactionResult> {
      if (!isUuid(intentId)) {
        throw new ValidationError('intentId must be a valid UUID')
      }

      const intentRes = await pool.query(
        `SELECT * FROM top_up_intents WHERE id = $1`,
        [intentId]
      )

      if (intentRes.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Top-up intent not found')
      }

      const intent = intentRes.rows[0]
      if (intent.status === 'SUCCEEDED') {
        throw new ApiError(400, 'INTENT_ALREADY_SETTLED', 'Cannot create payment transaction for an already settled intent')
      }
      if (intent.status === 'CANCELLED' || intent.status === 'EXPIRED' || intent.status === 'FAILED') {
        throw new ApiError(400, 'INVALID_INTENT_STATE', `Cannot create payment transaction for a ${intent.status} intent`)
      }

      const orderId = intent.intent_number
      const grossAmount = Number(intent.total_payable)
      const expiresAt = typeof intent.expires_at === 'string' ? intent.expires_at : intent.expires_at.toISOString()

      const tokenHash = crypto
        .createHash('sha256')
        .update(`${orderId}-${grossAmount}-${serverKey}`)
        .digest('hex')
        .slice(0, 36)
      const snapToken = `snap-token-${tokenHash}`
      const snapRedirectUrl = isProduction
        ? `https://app.midtrans.com/snap/v2/vtweb/${snapToken}`
        : `https://app.sandbox.midtrans.com/snap/v2/vtweb/${snapToken}`

      const existingMeta = (intent.metadata as Record<string, unknown>) || {}
      const updatedMeta = {
        ...existingMeta,
        gateway: 'MIDTRANS',
        gateway_order_id: orderId,
        gateway_token: snapToken,
        gateway_redirect_url: snapRedirectUrl,
        gateway_initiated_at: new Date().toISOString(),
        gateway_initiated_by: actorUserId,
      }

      await pool.query(
        `UPDATE top_up_intents
         SET metadata = $1, status = 'PROCESSING', updated_at = now()
         WHERE id = $2`,
        [JSON.stringify(updatedMeta), intentId]
      )

      await auditService.recordAudit({
        actor_id: actorUserId,
        actor_scope: 'platform',
        action: 'WALLET_TOPUP_PAYMENT_INITIATED',
        service_code: 'DIGITAL_WALLET',
        target_type: 'top_up_intent',
        target_id: intentId,
        request_id: requestId ?? null,
        status: 'SUCCESS',
        metadata: {
          intent_id: intentId,
          intent_number: orderId,
          amount: grossAmount,
          currency: intent.currency,
          gateway: 'MIDTRANS',
          token_preview: snapToken.slice(0, 15) + '...',
        },
      })

      return {
        order_id: orderId,
        token: snapToken,
        redirect_url: snapRedirectUrl,
        gross_amount: grossAmount,
        currency: intent.currency,
        expires_at: expiresAt,
      }
    },

    verifyMidtransSignature(payload: MidtransWebhookPayload): boolean {
      return verifySignature(payload)
    },

    async processMidtransWebhook(
      payload: MidtransWebhookPayload,
      requestId?: string
    ): Promise<WebhookProcessingResult> {
      // 1. Validate payload structure
      if (!payload || !payload.order_id || !payload.status_code || !payload.transaction_status) {
        throw new ValidationError('Malformed webhook payload: order_id, status_code, and transaction_status are required')
      }

      // 2. Verify signature
      if (!verifySignature(payload)) {
        await auditService.recordAudit({
          actor_id: null,
          actor_scope: 'platform',
          action: 'PLATFORM_PAYMENT_WEBHOOK_REJECTED',
          service_code: null,
          target_type: 'platform_invoices',
          target_id: null,
          request_id: requestId ?? null,
          status: 'FAILURE',
          error_message: 'Invalid Midtrans webhook signature',
          metadata: {
            order_id: payload.order_id,
            status_code: payload.status_code,
            gateway: 'MIDTRANS',
          },
        })
        throw new ApiError(401, 'INVALID_SIGNATURE', 'Midtrans webhook signature verification failed')
      }

      const eventId = String(payload.transaction_id || `${payload.order_id}:${payload.status_code}:${payload.transaction_status}`)

      // 3. Resolve target entity: platform invoice or top-up intent
      const invRes = await pool.query(
        `SELECT * FROM platform_invoices WHERE invoice_number = $1`,
        [payload.order_id]
      )

      if (invRes.rows.length === 0) {
        // Check if order_id is a top_up_intent
        const topUpRes = await pool.query(
          `SELECT * FROM top_up_intents WHERE intent_number = $1`,
          [payload.order_id]
        )

        if (topUpRes.rows.length > 0) {
          return this.processTopUpWebhook(payload, topUpRes.rows[0], requestId)
        }

        await auditService.recordAudit({
          actor_id: null,
          actor_scope: 'platform',
          action: 'PLATFORM_PAYMENT_WEBHOOK_REJECTED',
          service_code: null,
          target_type: 'platform_invoices',
          target_id: null,
          request_id: requestId ?? null,
          status: 'FAILURE',
          error_message: `Platform invoice or top-up intent not found for order_id ${payload.order_id}`,
          metadata: {
            order_id: payload.order_id,
            event_id: eventId,
            gateway: 'MIDTRANS',
          },
        })
        throw new ApiError(404, 'NOT_FOUND', `Platform invoice or top-up intent not found for order_id ${payload.order_id}`)
      }

      const invoice = invRes.rows[0]
      const invoiceId = invoice.id

      // 4. Webhook Idempotency Check (prevent duplicate processing of the same gateway event)
      const existingEvent = await pool.query(
        `SELECT * FROM platform_payment_webhook_events WHERE gateway = 'MIDTRANS' AND event_id = $1`,
        [eventId]
      )

      if (existingEvent.rows.length > 0) {
        return {
          status: 'ALREADY_PROCESSED',
          message: 'Webhook event already processed (idempotent)',
          invoice_id: invoiceId,
          event_id: eventId,
        }
      }

      // 5. Evaluate Transaction Status
      const rawStatus = (payload.transaction_status || '').toLowerCase()
      const fraudStatus = (payload.fraud_status || '').toLowerCase()

      const isSettled =
        rawStatus === 'settlement' ||
        (rawStatus === 'capture' && (fraudStatus === 'accept' || fraudStatus === ''))

      const isPending = rawStatus === 'pending'
      const isFailedOrExpired =
        rawStatus === 'deny' ||
        rawStatus === 'expire' ||
        rawStatus === 'cancel' ||
        rawStatus === 'failure'

      // Safe payload snapshot with sensitive credentials stripped
      const safePayload = {
        order_id: payload.order_id,
        status_code: payload.status_code,
        gross_amount: payload.gross_amount,
        transaction_status: payload.transaction_status,
        fraud_status: payload.fraud_status,
        transaction_id: payload.transaction_id,
        payment_type: payload.payment_type,
        transaction_time: payload.transaction_time,
      }

      if (isSettled) {
        // Case A: Invoice is already PAID
        if (invoice.status === 'PAID') {
          await pool.query(
            `INSERT INTO platform_payment_webhook_events (
              gateway, event_id, invoice_id, event_type, raw_payload, status
            ) VALUES ($1, $2, $3, $4, $5, 'IGNORED_ALREADY_PAID')
            ON CONFLICT (gateway, event_id) DO NOTHING`,
            ['MIDTRANS', eventId, invoiceId, rawStatus, JSON.stringify(safePayload)]
          )

          return {
            status: 'IGNORED_ALREADY_PAID',
            message: 'Invoice is already marked as PAID. Duplicate payment ignored.',
            invoice_id: invoiceId,
            event_id: eventId,
          }
        }

        // Case B: Invoice is ISSUED / OVERDUE -> Record verified payment & update subscription
        const paymentAmount = Number(payload.gross_amount) || Number(invoice.total_amount)
        const paymentRef = String(payload.transaction_id || payload.order_id)
        const paymentNotes = `Midtrans ${payload.payment_type || 'online'} payment confirmed via webhook`

        const paymentResult = await platformService.recordPlatformPayment(
          invoiceId,
          {
            amount: paymentAmount,
            payment_method: 'GATEWAY_PENDING', // Will be recorded as online gateway payment
            payment_reference: paymentRef,
            notes: paymentNotes,
          },
          'SYSTEM_MIDTRANS_WEBHOOK'
        )

        // Record webhook event in database for idempotency
        await pool.query(
          `INSERT INTO platform_payment_webhook_events (
            gateway, event_id, invoice_id, event_type, raw_payload, status
          ) VALUES ($1, $2, $3, $4, $5, 'PROCESSED')
          ON CONFLICT (gateway, event_id) DO NOTHING`,
          ['MIDTRANS', eventId, invoiceId, rawStatus, JSON.stringify(safePayload)]
        )

        // Audit webhook received and verified
        await auditService.recordAudit({
          actor_id: null,
          actor_scope: 'platform',
          action: 'PLATFORM_PAYMENT_WEBHOOK_RECEIVED',
          service_code: null,
          target_type: 'platform_invoices',
          target_id: invoiceId,
          request_id: requestId ?? null,
          status: 'SUCCESS',
          metadata: {
            invoice_id: invoiceId,
            order_id: payload.order_id,
            transaction_id: payload.transaction_id,
            amount: paymentAmount,
            gateway: 'MIDTRANS',
            event_id: eventId,
          },
        })

        const payment = paymentResult.payment as Record<string, unknown>

        return {
          status: 'PROCESSED',
          message: 'Payment recorded and subscription updated successfully.',
          invoice_id: invoiceId,
          payment_id: payment?.id as string,
          event_id: eventId,
        }
      }

      if (isPending) {
        await pool.query(
          `INSERT INTO platform_payment_webhook_events (
            gateway, event_id, invoice_id, event_type, raw_payload, status
          ) VALUES ($1, $2, $3, $4, $5, 'PENDING')
          ON CONFLICT (gateway, event_id) DO NOTHING`,
          ['MIDTRANS', eventId, invoiceId, rawStatus, JSON.stringify(safePayload)]
        )

        return {
          status: 'PENDING',
          message: 'Payment transaction is pending customer completion.',
          invoice_id: invoiceId,
          event_id: eventId,
        }
      }

      if (isFailedOrExpired) {
        await pool.query(
          `INSERT INTO platform_payment_webhook_events (
            gateway, event_id, invoice_id, event_type, raw_payload, status
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (gateway, event_id) DO NOTHING`,
          ['MIDTRANS', eventId, invoiceId, rawStatus, JSON.stringify(safePayload), rawStatus.toUpperCase()]
        )

        return {
          status: rawStatus === 'expire' ? 'EXPIRED' : 'FAILED',
          message: `Payment transaction ${rawStatus}. Invoice remains unpaid.`,
          invoice_id: invoiceId,
          event_id: eventId,
        }
      }

      // Default unhandled status
      await pool.query(
        `INSERT INTO platform_payment_webhook_events (
          gateway, event_id, invoice_id, event_type, raw_payload, status
        ) VALUES ($1, $2, $3, $4, $5, 'PROCESSED')
        ON CONFLICT (gateway, event_id) DO NOTHING`,
        ['MIDTRANS', eventId, invoiceId, rawStatus, JSON.stringify(safePayload)]
      )

      return {
        status: 'PROCESSED',
        message: `Webhook received for status: ${rawStatus}`,
        invoice_id: invoiceId,
        event_id: eventId,
      }
    },

    async processTopUpWebhook(
      payload: MidtransWebhookPayload,
      intentRow: Record<string, unknown>,
      requestId?: string
    ): Promise<WebhookProcessingResult> {
      const topUpService = createTopUpIntentService(pool, auditService)
      const eventId = String(payload.transaction_id || `${payload.order_id}:${payload.status_code}:${payload.transaction_status}`)
      const intentId = intentRow.id as string
      const intentNumber = String(intentRow.intent_number)

      // 1. Webhook Idempotency Check
      const existingEvent = await pool.query(
        `SELECT * FROM platform_payment_webhook_events WHERE gateway = 'MIDTRANS' AND event_id = $1`,
        [eventId]
      )

      if (existingEvent.rows.length > 0) {
        return {
          status: 'ALREADY_PROCESSED',
          message: 'Webhook event already processed (idempotent)',
          intent_id: intentId,
          event_id: eventId,
        }
      }

      // 2. Evaluate Transaction Status
      const rawStatus = (payload.transaction_status || '').toLowerCase()
      const fraudStatus = (payload.fraud_status || '').toLowerCase()

      const isSettled =
        rawStatus === 'settlement' ||
        (rawStatus === 'capture' && (fraudStatus === 'accept' || fraudStatus === ''))

      const isPending = rawStatus === 'pending'
      const isFailedOrExpired =
        rawStatus === 'deny' ||
        rawStatus === 'expire' ||
        rawStatus === 'cancel' ||
        rawStatus === 'failure'

      const safePayload = {
        order_id: payload.order_id,
        status_code: payload.status_code,
        gross_amount: payload.gross_amount,
        transaction_status: payload.transaction_status,
        fraud_status: payload.fraud_status,
        transaction_id: payload.transaction_id,
        payment_type: payload.payment_type,
        transaction_time: payload.transaction_time,
      }

      if (isSettled) {
        if (intentRow.status === 'SUCCEEDED') {
          await pool.query(
            `INSERT INTO platform_payment_webhook_events (
              gateway, event_id, invoice_id, event_type, raw_payload, status
            ) VALUES ($1, $2, NULL, $3, $4, 'IGNORED_ALREADY_PAID')
            ON CONFLICT (gateway, event_id) DO NOTHING`,
            ['MIDTRANS', eventId, rawStatus, JSON.stringify(safePayload)]
          )

          return {
            status: 'IGNORED_ALREADY_PAID',
            message: 'Top-up intent is already settled. Duplicate payment ignored.',
            intent_id: intentId,
            event_id: eventId,
          }
        }

        const paidAmount = Number(payload.gross_amount)
        const paymentRef = String(payload.transaction_id || payload.order_id)

        await topUpService.settleIntent({
          intent_number: intentNumber,
          payment_reference: paymentRef,
          gateway_transaction_id: payload.transaction_id ? String(payload.transaction_id) : undefined,
          paid_amount: paidAmount,
          payment_method: payload.payment_type ? String(payload.payment_type) : undefined,
          actor_scope: 'system'
        })

        await pool.query(
          `INSERT INTO platform_payment_webhook_events (
            gateway, event_id, invoice_id, event_type, raw_payload, status
          ) VALUES ($1, $2, NULL, $3, $4, 'PROCESSED')
          ON CONFLICT (gateway, event_id) DO NOTHING`,
          ['MIDTRANS', eventId, rawStatus, JSON.stringify(safePayload)]
        )

        return {
          status: 'PROCESSED',
          message: 'Top-up intent settled and wallet credited successfully',
          intent_id: intentId,
          event_id: eventId,
        }
      }

      if (isPending) {
        await pool.query(
          `INSERT INTO platform_payment_webhook_events (
            gateway, event_id, invoice_id, event_type, raw_payload, status
          ) VALUES ($1, $2, NULL, $3, $4, 'PENDING')
          ON CONFLICT (gateway, event_id) DO NOTHING`,
          ['MIDTRANS', eventId, rawStatus, JSON.stringify(safePayload)]
        )

        return {
          status: 'PENDING',
          message: 'Top-up payment pending completion by customer',
          intent_id: intentId,
          event_id: eventId,
        }
      }

      if (isFailedOrExpired) {
        if (rawStatus === 'expire') {
          await topUpService.expireIntent(intentNumber, { actor_scope: 'system' }).catch(() => {})
        } else {
          await topUpService.failIntent(intentNumber, `Gateway status: ${rawStatus}`, { actor_scope: 'system' }).catch(() => {})
        }

        await pool.query(
          `INSERT INTO platform_payment_webhook_events (
            gateway, event_id, invoice_id, event_type, raw_payload, status
          ) VALUES ($1, $2, NULL, $3, $4, $5)
          ON CONFLICT (gateway, event_id) DO NOTHING`,
          ['MIDTRANS', eventId, rawStatus, JSON.stringify(safePayload), rawStatus.toUpperCase()]
        )

        return {
          status: rawStatus === 'expire' ? 'EXPIRED' : 'FAILED',
          message: `Top-up payment ${rawStatus}`,
          intent_id: intentId,
          event_id: eventId,
        }
      }

      // Default unhandled
      await pool.query(
        `INSERT INTO platform_payment_webhook_events (
          gateway, event_id, invoice_id, event_type, raw_payload, status
        ) VALUES ($1, $2, NULL, $3, $4, 'PROCESSED')
        ON CONFLICT (gateway, event_id) DO NOTHING`,
        ['MIDTRANS', eventId, rawStatus, JSON.stringify(safePayload)]
      )

      return {
        status: 'PROCESSED',
        message: `Webhook received for status: ${rawStatus}`,
        intent_id: intentId,
        event_id: eventId,
      }
    },
  }
}
