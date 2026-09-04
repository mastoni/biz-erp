import { Router } from 'express'
import { Pool } from 'pg'
import { createJwtService } from '../services/jwt_service'
import {
  createPlatformJwtAuthMiddleware,
  PlatformAuthenticatedRequest,
  requirePlatformRole
} from '../middleware/auth'
import { createPlatformService } from '../services/platform_service'
import { createPaymentGatewayService } from '../services/payment_gateway_service'
import { createBillingAutomationService } from '../services/billing_automation_service'
import { createAuditService } from '../services/audit_service'
import { asyncHandler } from '../utils/async_handler'

export function createPlatformRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const platformAuth = createPlatformJwtAuthMiddleware(jwtService)
  const platformService = createPlatformService(pool)
  const paymentGatewayService = createPaymentGatewayService(pool)
  const billingAutomationService = createBillingAutomationService(pool)
  const auditService = createAuditService(pool)

  // Every platform route is gated by the platform auth middleware. Tenant tokens
  // and legacy (no-scope) tokens are rejected with 403 WRONG_SCOPE before any
  // handler runs. The middleware never sets req.businessId on platform routes.
  router.use(platformAuth as any)

  // -------------------------------------------------------------------------
  // GET /v1/platform/context
  // -------------------------------------------------------------------------
  router.get(
    '/context',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const user = req.platformUser!
      res.status(200).json({ ...platformService.getContext(user.role, user.userId), businessId: null })
    })
  )

  // =========================================================================
  // 1. BUSINESSES LIFECYCLE (SA-1)
  // =========================================================================
  router.get(
    '/businesses',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listBusinesses(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  router.get(
    '/businesses/:id',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.getBusinessById(req.params.id)
      res.status(200).json(result)
    })
  )

  router.post(
    '/businesses/:id/approve',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const result = await platformService.approveBusiness(req.params.id, actorUserId)
      res.status(200).json({
        message: 'Business approved successfully',
        business: result
      })
    })
  )

  router.post(
    '/businesses/:id/reject',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const { reason } = req.body || {}
      const result = await platformService.rejectBusiness(req.params.id, actorUserId, reason)
      res.status(200).json({
        message: 'Business registration rejected',
        business: result
      })
    })
  )

  router.post(
    '/businesses/:id/suspend',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const { reason } = req.body || {}
      const result = await platformService.suspendBusiness(req.params.id, actorUserId, reason)
      res.status(200).json({
        message: 'Business account suspended',
        business: result
      })
    })
  )

  router.post(
    '/businesses/:id/reactivate',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const result = await platformService.reactivateBusiness(req.params.id, actorUserId)
      res.status(200).json({
        message: 'Business reactivated successfully',
        business: result
      })
    })
  )

  // =========================================================================
  // 2. MODULES
  // =========================================================================
  router.get(
    '/modules',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listModules(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  // =========================================================================
  // 3. PLANS & PRICING GOVERNANCE (SA-2)
  // =========================================================================
  router.get(
    '/plans',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listPlans(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  router.get(
    '/plans/:code',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.getPlanByCode(req.params.code)
      res.status(200).json(result)
    })
  )

  router.post(
    '/plans',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const result = await platformService.createPlan(req.body || {}, actorUserId)
      res.status(201).json({
        message: 'Plan created successfully',
        plan: result
      })
    })
  )

  router.put(
    '/plans/:code',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const result = await platformService.updatePlan(req.params.code, req.body || {}, actorUserId)
      res.status(200).json({
        message: 'Plan updated successfully',
        plan: result
      })
    })
  )

  router.patch(
    '/plans/:code/status',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const { status } = req.body || {}
      const result = await platformService.setPlanStatus(req.params.code, status, actorUserId)
      res.status(200).json({
        message: `Plan status updated to ${status}`,
        plan: result
      })
    })
  )

  router.put(
    '/plans/:code/modules',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const { modules } = req.body || {}
      const result = await platformService.setPlanModules(req.params.code, modules || [], actorUserId)
      res.status(200).json({
        message: 'Plan modules updated successfully',
        ...result
      })
    })
  )

  // =========================================================================
  // 4. BUNDLES GOVERNANCE (SA-2)
  // =========================================================================
  router.get(
    '/bundles',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listBundles(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  router.get(
    '/bundles/:code',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.getBundleByCode(req.params.code)
      res.status(200).json(result)
    })
  )

  router.post(
    '/bundles',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const result = await platformService.createBundle(req.body || {}, actorUserId)
      res.status(201).json({
        message: 'Bundle created successfully',
        bundle: result
      })
    })
  )

  router.put(
    '/bundles/:code',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const result = await platformService.updateBundle(req.params.code, req.body || {}, actorUserId)
      res.status(200).json({
        message: 'Bundle updated successfully',
        bundle: result
      })
    })
  )

  router.patch(
    '/bundles/:code/status',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const { status } = req.body || {}
      const result = await platformService.setBundleStatus(req.params.code, status, actorUserId)
      res.status(200).json({
        message: `Bundle status updated to ${status}`,
        bundle: result
      })
    })
  )

  router.put(
    '/bundles/:code/items',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const { items } = req.body || {}
      const result = await platformService.setBundleItems(req.params.code, items || [], actorUserId)
      res.status(200).json({
        message: 'Bundle items updated successfully',
        ...result
      })
    })
  )

  // =========================================================================
  // 4.5 CATALOG PRODUCTS GOVERNANCE (SA-2)
  // =========================================================================
  router.get(
    '/catalog-products',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listCatalogProducts(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  // =========================================================================
  // 5. SHOWCASE GOVERNANCE (SA-2)
  // =========================================================================
  router.get(
    '/showcase',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listShowcaseItems(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  router.get(
    '/showcase/:id',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.getShowcaseItemById(req.params.id)
      res.status(200).json(result)
    })
  )

  router.post(
    '/showcase',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const result = await platformService.createShowcaseItem(req.body || {}, actorUserId)
      res.status(201).json({
        message: 'Showcase item created successfully',
        item: result
      })
    })
  )

  router.put(
    '/showcase/:id',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const result = await platformService.updateShowcaseItem(req.params.id, req.body || {}, actorUserId)
      res.status(200).json({
        message: 'Showcase item updated successfully',
        item: result
      })
    })
  )

  router.patch(
    '/showcase/:id/publish',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const { is_published } = req.body || {}
      const result = await platformService.setShowcasePublish(req.params.id, Boolean(is_published), actorUserId)
      res.status(200).json({
        message: `Showcase item publish status updated to ${Boolean(is_published)}`,
        item: result
      })
    })
  )

  router.delete(
    '/showcase/:id',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      await platformService.deleteShowcaseItem(req.params.id, actorUserId)
      res.status(200).json({
        message: 'Showcase item deleted successfully'
      })
    })
  )

  // =========================================================================
  // 6. SERVICE REGISTRY (SA-2.5)
  // =========================================================================
  router.get(
    '/services',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listServices(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  router.post(
    '/services',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const result = await platformService.createService(req.body || {}, actorUserId)
      res.status(201).json({
        message: 'Service created successfully',
        service: result
      })
    })
  )

  router.get(
    '/services/:code',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.getServiceByCode(req.params.code)
      res.status(200).json(result)
    })
  )

  router.patch(
    '/services/:code',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const result = await platformService.updateService(req.params.code, req.body || {}, actorUserId)
      res.status(200).json({
        message: 'Service updated successfully',
        service: result
      })
    })
  )

  // =========================================================================
  // 7. SUBSCRIPTIONS & PLATFORM BILLING LIFECYCLE
  // =========================================================================
  router.get(
    '/subscriptions',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listSubscriptions(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  router.get(
    '/invoices',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listPlatformInvoices(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  router.post(
    '/invoices/generate',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const { subscription_id, custom_period_start } = req.body || {}
      const result = await platformService.generatePlatformInvoice(
        subscription_id,
        custom_period_start,
        actorUserId
      )
      res.status(201).json({
        message: 'Platform invoice generated successfully',
        invoice: result,
      })
    })
  )

  router.get(
    '/invoices/:id',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.getPlatformInvoiceById(req.params.id)
      res.status(200).json(result)
    })
  )

  router.post(
    '/invoices/:id/payments',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const result = await platformService.recordPlatformPayment(
        req.params.id,
        req.body || {},
        actorUserId
      )
      res.status(200).json({
        message: 'Payment recorded and subscription renewed/activated successfully',
        ...result,
      })
    })
  )

  router.post(
    '/invoices/:id/payment-token',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const requestId = req.headers['x-request-id'] as string | undefined
      const result = await paymentGatewayService.createInvoiceTransaction(
        req.params.id,
        actorUserId,
        requestId
      )
      res.status(200).json({
        message: 'Payment gateway transaction initiated successfully',
        transaction: result,
      })
    })
  )

  // =========================================================================
  // 7B. BILLING AUTOMATION (Phase 5C)
  // =========================================================================
  router.post(
    '/billing/automation/run',
    requirePlatformRole('SUPER_ADMIN') as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const { now } = req.body || {}
      const result = await billingAutomationService.runBillingAutomation({
        now: now ? new Date(now) : undefined,
        actorUserId,
      })
      res.status(200).json({
        message: 'Billing automation batch completed',
        ...result,
      })
    })
  )


  // =========================================================================
  // 8. AUDIT LOGS & OBSERVABILITY (SA-2.8)
  // =========================================================================
  router.get(
    '/audit-logs',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await auditService.listAuditLogs(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  router.get(
    '/audit-logs/:id',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await auditService.getAuditLogById(req.params.id)
      res.status(200).json(result)
    })
  )

  router.get(
    '/observability/health',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (_req, res) => {
      const result = await auditService.getEcosystemHealth()
      res.status(200).json(result)
    })
  )

  router.get(
    '/observability/metrics',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (_req, res) => {
      const result = await auditService.getEcosystemMetrics()
      res.status(200).json(result)
    })
  )

  // =========================================================================
  // 9. SUPPORT TICKETS (SA-3.0B Control Plane)
  // =========================================================================
  router.get(
    '/tickets',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listSupportTickets(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  router.get(
    '/tickets/:id',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.getSupportTicketById(req.params.id)
      res.status(200).json(result)
    })
  )

  router.patch(
    '/tickets/:id/status',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const actorUserId = req.platformUser!.userId
      const requestId = (res.locals?.requestId as string) || (req.headers['x-request-id'] as string) || undefined
      const result = await platformService.updateSupportTicketStatus(
        req.params.id,
        req.body || {},
        actorUserId,
        requestId
      )
      res.status(200).json({
        message: 'Support ticket status updated successfully',
        ticket: result,
      })
    })
  )

  return router
}
