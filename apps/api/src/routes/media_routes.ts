import { Router, RequestHandler, Response } from 'express'
import express from 'express'
import { Pool } from 'pg'
import { mediaService, MAX_FILE_SIZE_BYTES } from '../services/media_service'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { asyncHandler } from '../utils/async_handler'
import fs from 'fs'
import path from 'path'

function assertTenant(businessId: string, tenantId?: string): void {
  if (!tenantId || tenantId.toLowerCase() !== businessId.toLowerCase()) {
    throw new ApiError(403, 'FORBIDDEN', 'Access to another tenant media is forbidden')
  }
}

export function createMediaRoutes(_pool: Pool): Router {
  const router = Router()
  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)

  // 1. Serve static product media files (Tenant authenticated with strict tenant isolation)
  router.get(
    '/products/:businessId/:filename',
    requireSyncAuth(jwtService) as RequestHandler,
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const { businessId, filename } = req.params

      assertTenant(businessId, req.tenantId)

      const filePath = mediaService.getFilePath(businessId, filename)

      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Media file not found' } })
      }

      const ext = path.extname(filename).toLowerCase()
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
      }

      res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream')
      res.setHeader('Cache-Control', 'private, max-age=86400')
      return res.sendFile(filePath)
    })
  )

  // 2. Upload endpoint (JSON payload with base64 image or binary upload)
  router.post(
    '/upload',
    requireSyncAuth(jwtService) as RequestHandler,
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    express.json({ limit: '10mb' }),
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const body = req.body as Record<string, unknown>
      const businessId = (body?.business_id as string) || req.tenantId

      if (!businessId || typeof businessId !== 'string') {
        throw new ValidationError('business_id is required', { business_id: 'business_id must be a valid UUID' })
      }

      assertTenant(businessId, req.tenantId)

      const mimeType = body?.mime_type as string
      const base64Data = (body?.image_base64 as string) || (body?.data as string)

      if (!base64Data || typeof base64Data !== 'string') {
        throw new ValidationError('Image data is required', { image: 'image_base64 string is required' })
      }

      // Strip data:image/...;base64, prefix if present
      const cleanBase64 = base64Data.replace(/^data:image\/[a-z+]+;base64,/, '')
      const buffer = Buffer.from(cleanBase64, 'base64')

      if (buffer.length > MAX_FILE_SIZE_BYTES) {
        throw new ValidationError('File size exceeds limit', {
          size: `File size ${buffer.length} bytes exceeds maximum allowed limit of 5MB`,
        })
      }

      const result = await mediaService.saveProductImage(businessId, buffer, mimeType)
      res.status(201).json(result)
    })
  )

  // 3. Delete media file
  router.delete(
    '/products/:filename',
    requireSyncAuth(jwtService) as RequestHandler,
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const businessId = (req.query.business_id as string) || req.tenantId
      const { filename } = req.params

      if (!businessId) {
        throw new ValidationError('business_id is required', { business_id: 'business_id is required' })
      }

      assertTenant(businessId, req.tenantId)

      const deleted = await mediaService.deleteProductImage(businessId, filename)
      res.status(200).json({ success: true, deleted })
    })
  )

  return router
}
