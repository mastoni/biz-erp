import { Router } from 'express'
import { Pool } from 'pg'
import { createPaymentGatewayService } from '../services/payment_gateway_service'
import { asyncHandler } from '../utils/async_handler'

export function createPlatformWebhookRoutes(pool: Pool): Router {
  const router = Router()
  const paymentGatewayService = createPaymentGatewayService(pool)

  /**
   * POST /v1/platform/webhooks/midtrans
   * Public webhook endpoint for Midtrans payment notifications.
   * Authenticated via SHA512 signature verification.
   */
  router.post(
    '/midtrans',
    asyncHandler(async (req, res) => {
      const requestId = req.headers['x-request-id'] as string | undefined
      const result = await paymentGatewayService.processMidtransWebhook(req.body, requestId)
      res.status(200).json({
        received: true,
        status: result.status,
        message: result.message,
        invoice_id: result.invoice_id,
        payment_id: result.payment_id,
      })
    })
  )

  return router
}
