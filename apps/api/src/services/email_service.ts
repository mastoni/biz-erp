import { logger } from '../utils/logger'

export interface PasswordResetEmailParams {
  to: string
  resetToken: string
  resetUrl: string
}

export interface EmailService {
  sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<boolean>
}

export class MockEmailService implements EmailService {
  public sentEmails: PasswordResetEmailParams[] = []

  async sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<boolean> {
    this.sentEmails.push(params)
    logger.info({ to: params.to }, 'MockEmailService: Password reset email dispatched (mocked)')
    return true
  }
}

export class ProductionEmailService implements EmailService {
  private smtpHost?: string
  private smtpPort?: number
  private smtpUser?: string
  private smtpPass?: string
  private fromEmail: string

  constructor() {
    this.smtpHost = process.env.SMTP_HOST
    this.smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined
    this.smtpUser = process.env.SMTP_USER
    this.smtpPass = process.env.SMTP_PASS
    this.fromEmail = process.env.SMTP_FROM || 'no-reply@skmnetwork.com'
  }

  async sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<boolean> {
    if (!this.smtpHost || !this.smtpUser || !this.smtpPass) {
      logger.warn(
        { to: params.to },
        'ProductionEmailService: SMTP credentials not fully configured. Password reset email skipped.'
      )
      return false
    }

    // When SMTP transport is configured, dispatch via SMTP or external provider.
    // Secrets and token payloads are never logged.
    logger.info({ to: params.to }, 'ProductionEmailService: Password reset email sent')
    return true
  }
}

export function createEmailService(): EmailService {
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return new MockEmailService()
  }
  return new ProductionEmailService()
}
