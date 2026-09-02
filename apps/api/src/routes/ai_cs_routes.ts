import { Router } from 'express'
import { Pool } from 'pg'
import { createJwtService } from '../services/jwt_service'
import {
  requireSyncAuth,
  SyncAuthenticatedRequest,
  requireRole,
} from '../middleware/auth'
import { createAiCsService } from '../services/ai_cs_service'
import { asyncHandler } from '../utils/async_handler'

export function createAiCsRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const syncAuth = requireSyncAuth(jwtService)
  const aiCsService = createAiCsService(pool)

  router.use(syncAuth as any)

  // -------------------------------------------------------------------------
  // 1. POST /v1/ai-cs/conversations
  // -------------------------------------------------------------------------
  router.post(
    '/conversations',
    requireRole('OWNER', 'CASHIER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const tenantId = req.tenantId!
      const userId = req.user!.userId
      const conversation = await aiCsService.createConversation(tenantId, userId, req.body || {})
      res.status(201).json({
        message: 'AI CS conversation created',
        conversation,
      })
    })
  )

  // -------------------------------------------------------------------------
  // 2. GET /v1/ai-cs/conversations
  // -------------------------------------------------------------------------
  router.get(
    '/conversations',
    requireRole('OWNER', 'CASHIER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const tenantId = req.tenantId!
      const conversations = await aiCsService.listConversations(tenantId)
      res.status(200).json({ conversations })
    })
  )

  // -------------------------------------------------------------------------
  // 3. GET /v1/ai-cs/conversations/:id
  // -------------------------------------------------------------------------
  router.get(
    '/conversations/:id',
    requireRole('OWNER', 'CASHIER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const tenantId = req.tenantId!
      const conversation = await aiCsService.getConversationById(req.params.id, tenantId)
      res.status(200).json({ conversation })
    })
  )

  // -------------------------------------------------------------------------
  // 4. POST /v1/ai-cs/conversations/:id/messages
  // -------------------------------------------------------------------------
  router.post(
    '/conversations/:id/messages',
    requireRole('OWNER', 'CASHIER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const tenantId = req.tenantId!
      const userId = req.user!.userId
      const requestId = res.locals?.requestId || (req.headers['x-request-id'] as string) || undefined

      const result = await aiCsService.sendMessage(req.params.id, tenantId, userId, req.body || {}, requestId)
      res.status(200).json(result)
    })
  )

  // -------------------------------------------------------------------------
  // 5. POST /v1/ai-cs/conversations/:id/escalate
  // -------------------------------------------------------------------------
  router.post(
    '/conversations/:id/escalate',
    requireRole('OWNER', 'CASHIER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const tenantId = req.tenantId!
      const userId = req.user!.userId
      const requestId = res.locals?.requestId || (req.headers['x-request-id'] as string) || undefined

      const ticket = await aiCsService.escalateConversation(req.params.id, tenantId, userId, req.body || {}, requestId)
      res.status(200).json({
        message: 'Conversation escalated to human support ticket',
        ticket,
      })
    })
  )

  // -------------------------------------------------------------------------
  // 6. GET /v1/ai-cs/tickets
  // -------------------------------------------------------------------------
  router.get(
    '/tickets',
    requireRole('OWNER', 'CASHIER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const tenantId = req.tenantId!
      const tickets = await aiCsService.listTickets(tenantId)
      res.status(200).json({ tickets })
    })
  )

  // -------------------------------------------------------------------------
  // 7. GET /v1/ai-cs/tickets/:id
  // -------------------------------------------------------------------------
  router.get(
    '/tickets/:id',
    requireRole('OWNER', 'CASHIER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const tenantId = req.tenantId!
      const ticket = await aiCsService.getTicketById(req.params.id, tenantId)
      res.status(200).json({ ticket })
    })
  )

  return router
}
