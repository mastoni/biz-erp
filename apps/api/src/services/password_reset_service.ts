import crypto from 'crypto'
import { Pool } from 'pg'
import { withTransaction } from '../db/transaction'
import { UserRepository } from '../repositories/user_repository'
import { refreshSessionRepository } from '../repositories/refresh_session_repository'
import { passwordResetRepository } from '../repositories/password_reset_repository'
import { hashPassword, verifyPassword } from './password_service'
import { EmailService } from './email_service'
import { createAuditService } from './audit_service'
import { ApiError } from '../errors/api_error'

export interface ChangePasswordRequest {
  userId: string
  currentPassword: string
  newPassword: string
  confirmation: string
  currentSessionId?: string
  actorScope?: 'tenant' | 'platform'
  actorEmail?: string
  ipAddress?: string
  userAgent?: string
}

export interface RequestPasswordResetRequest {
  email: string
  clientIp?: string
  userAgent?: string
  webBaseUrl?: string
}

export interface ResetPasswordRequest {
  token: string
  newPassword: string
  confirmation: string
  clientIp?: string
  userAgent?: string
}

export function createPasswordResetService(
  pool: Pool,
  userRepo: UserRepository,
  emailService: EmailService
) {
  const auditService = createAuditService(pool)

  const hashToken = (token: string) => {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  return {
    async changePassword(req: ChangePasswordRequest): Promise<{ message: string }> {
      if (!req.currentPassword || !req.newPassword || !req.confirmation) {
        throw new ApiError(400, 'BAD_REQUEST', 'Kata sandi lama, kata sandi baru, dan konfirmasi wajib diisi')
      }

      if (req.newPassword !== req.confirmation) {
        throw new ApiError(400, 'PASSWORD_MISMATCH', 'Konfirmasi kata sandi baru tidak cocok')
      }

      if (req.newPassword.length < 8) {
        throw new ApiError(400, 'WEAK_PASSWORD', 'Kata sandi baru minimal 8 karakter')
      }

      const user = await userRepo.findByIdWithPassword(pool, req.userId)
      if (!user) {
        throw new ApiError(404, 'NOT_FOUND', 'Pengguna tidak ditemukan')
      }

      const isValid = await verifyPassword(req.currentPassword, user.password_hash)
      if (!isValid) {
        throw new ApiError(400, 'INVALID_CURRENT_PASSWORD', 'Kata sandi lama tidak sesuai')
      }

      const newPasswordHash = await hashPassword(req.newPassword)

      await withTransaction(pool, async (client) => {
        await userRepo.updatePasswordHash(client, req.userId, newPasswordHash)
        if (req.currentSessionId) {
          await refreshSessionRepository.revokeAllForUserExcept(client, req.userId, req.currentSessionId)
        } else {
          await refreshSessionRepository.revokeAllForUser(client, req.userId)
        }
      })

      try {
        await auditService.recordAudit({
          actor_id: req.userId,
          actor_email: req.actorEmail || user.email,
          actor_scope: req.actorScope || 'tenant',
          action: 'USER_PASSWORD_CHANGED',
          target_type: 'USER',
          target_id: req.userId,
          ip_address: req.ipAddress,
          user_agent: req.userAgent,
          status: 'SUCCESS',
          metadata: { timestamp: new Date().toISOString() }
        })
      } catch {
        // Audit failures should not block password update
      }

      return { message: 'Kata sandi berhasil diubah' }
    },

    async requestPasswordReset(req: RequestPasswordResetRequest): Promise<{ message: string }> {
      const genericMessage = 'Jika email terdaftar, instruksi pemulihan kata sandi telah dikirim.'

      if (!req.email || typeof req.email !== 'string') {
        return { message: genericMessage }
      }

      const normalizedEmail = req.email.trim().toLowerCase()
      const user = await userRepo.findByEmail(normalizedEmail)

      if (!user || user.status !== 'ACTIVE') {
        // Anti-enumeration: return standard success message
        return { message: genericMessage }
      }

      const rawToken = crypto.randomBytes(32).toString('hex')
      const tokenHash = hashToken(rawToken)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

      await withTransaction(pool, async (client) => {
        await passwordResetRepository.invalidateAllPendingForUser(client, user.id)
        await passwordResetRepository.create(client, {
          userId: user.id,
          tokenHash,
          expiresAt,
          ipAddress: req.clientIp,
          userAgent: req.userAgent
        })
      })

      const webBase = req.webBaseUrl || process.env.WEB_BASE_URL || 'https://erp.skmnetwork.com'
      const resetUrl = `${webBase}/reset-password?token=${rawToken}`

      await emailService.sendPasswordResetEmail({
        to: user.email,
        resetToken: rawToken,
        resetUrl
      })

      try {
        await auditService.recordAudit({
          actor_id: user.id,
          actor_email: user.email,
          actor_scope: 'system',
          action: 'PASSWORD_RESET_REQUESTED',
          target_type: 'USER',
          target_id: user.id,
          ip_address: req.clientIp,
          user_agent: req.userAgent,
          status: 'SUCCESS',
          metadata: { expires_at: expiresAt.toISOString() }
        })
      } catch {
        // Non-blocking audit
      }

      return { message: genericMessage }
    },

    async resetPassword(req: ResetPasswordRequest): Promise<{ message: string }> {
      if (!req.token || typeof req.token !== 'string') {
        throw new ApiError(400, 'INVALID_TOKEN', 'Token pemulihan kata sandi tidak valid atau tidak ditemukan')
      }

      if (!req.newPassword || !req.confirmation) {
        throw new ApiError(400, 'BAD_REQUEST', 'Kata sandi baru dan konfirmasi wajib diisi')
      }

      if (req.newPassword !== req.confirmation) {
        throw new ApiError(400, 'PASSWORD_MISMATCH', 'Konfirmasi kata sandi baru tidak cocok')
      }

      if (req.newPassword.length < 8) {
        throw new ApiError(400, 'WEAK_PASSWORD', 'Kata sandi baru minimal 8 karakter')
      }

      const tokenHash = hashToken(req.token)

      let targetUserId = ''

      await withTransaction(pool, async (client) => {
        const resetRecord = await passwordResetRepository.findByTokenHashForUpdate(client, tokenHash)

        if (!resetRecord) {
          throw new ApiError(400, 'INVALID_TOKEN', 'Tautan pemulihan tidak valid')
        }

        if (resetRecord.used_at) {
          throw new ApiError(400, 'TOKEN_ALREADY_USED', 'Tautan pemulihan sudah pernah digunakan')
        }

        if (resetRecord.expires_at.getTime() < Date.now()) {
          throw new ApiError(400, 'TOKEN_EXPIRED', 'Tautan pemulihan telah kadaluarsa')
        }

        targetUserId = resetRecord.user_id
        const newPasswordHash = await hashPassword(req.newPassword)

        await userRepo.updatePasswordHash(client, resetRecord.user_id, newPasswordHash)
        await passwordResetRepository.markUsed(client, resetRecord.id)
        await refreshSessionRepository.revokeAllForUser(client, resetRecord.user_id)
      })

      try {
        await auditService.recordAudit({
          actor_id: targetUserId,
          actor_scope: 'system',
          action: 'PASSWORD_RESET_COMPLETED',
          target_type: 'USER',
          target_id: targetUserId,
          ip_address: req.clientIp,
          user_agent: req.userAgent,
          status: 'SUCCESS',
          metadata: { timestamp: new Date().toISOString() }
        })
      } catch {
        // Non-blocking audit
      }

      return { message: 'Kata sandi berhasil diatur ulang. Silakan masuk kembali dengan kata sandi baru.' }
    }
  }
}
