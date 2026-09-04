import { Pool } from 'pg'
import { createPlatformService } from './platform_service'
import { createAuditService } from './audit_service'
import { logger } from '../utils/logger'

export interface BillingAutomationResult {
  skipped: boolean
  reason?: string
  subscriptions_scanned: number
  invoices_generated: number
  invoices_skipped: number
  invoices_marked_overdue: number
  subscriptions_suspended: number
  failures: Array<{
    entity_id?: string
    entity_type: 'subscription' | 'platform_invoice'
    operation: 'RECURRING_INVOICE' | 'MARK_OVERDUE' | 'SUSPEND_SUBSCRIPTION'
    error: string
  }>
}

export interface RunBillingAutomationOptions {
  now?: Date
  actorUserId?: string
}

export function createBillingAutomationService(pool: Pool) {
  const platformService = createPlatformService(pool)
  const auditService = createAuditService(pool)

  return {
    async runBillingAutomation(options?: RunBillingAutomationOptions): Promise<BillingAutomationResult> {
      const now = options?.now ? new Date(options.now) : new Date()
      const actorUserId = options?.actorUserId || null

      const result: BillingAutomationResult = {
        skipped: false,
        subscriptions_scanned: 0,
        invoices_generated: 0,
        invoices_skipped: 0,
        invoices_marked_overdue: 0,
        subscriptions_suspended: 0,
        failures: [],
      }

      // Acquire advisory lock using a dedicated client to ensure multi-worker safety
      const lockClient = await pool.connect()
      let lockAcquired = false

      try {
        const lockRes = await lockClient.query(
          `SELECT pg_try_advisory_lock(hashtext('platform_billing_automation')) AS acquired`
        )
        lockAcquired = !!lockRes.rows[0]?.acquired

        if (!lockAcquired) {
          logger.warn('Billing automation execution skipped: lock already held by another worker')
          return {
            ...result,
            skipped: true,
            reason: 'AUTOMATION_ALREADY_RUNNING',
          }
        }

        // =====================================================================
        // STEP 1: RECURRING INVOICE AUTOMATION
        // Find ACTIVE subscriptions where ends_at <= now + 7 days
        // =====================================================================
        const renewalThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        const subRes = await lockClient.query(
          `SELECT s.id, s.business_id, s.plan_code, s.billing_cycle, s.starts_at, s.ends_at, s.status,
                  p.name as plan_name
           FROM subscriptions s
           JOIN plans p ON s.plan_code = p.code
           WHERE s.status = 'ACTIVE'
             AND s.ends_at IS NOT NULL
             AND s.ends_at <= $1
           ORDER BY s.ends_at ASC`,
          [renewalThreshold.toISOString()]
        )

        result.subscriptions_scanned = subRes.rows.length

        for (const sub of subRes.rows) {
          try {
            const periodStart = new Date(sub.ends_at)
            let months = 1
            if (sub.billing_cycle === 'QUARTERLY') months = 3
            else if (sub.billing_cycle === 'ANNUAL') months = 12

            const periodEnd = new Date(periodStart)
            periodEnd.setMonth(periodEnd.getMonth() + months)

            // Check if invoice already exists for this exact period
            const existingCheck = await lockClient.query(
              `SELECT id FROM platform_invoices
               WHERE subscription_id = $1
                 AND billing_period_start = $2
                 AND billing_period_end = $3`,
              [sub.id, periodStart.toISOString(), periodEnd.toISOString()]
            )

            if (existingCheck.rows.length > 0) {
              result.invoices_skipped++
              continue
            }

            // Generate invoice using canonical platformService method
            const invoice = await platformService.generatePlatformInvoice(
              sub.id,
              periodStart.toISOString(),
              actorUserId || undefined
            )

            result.invoices_generated++

            // Audit record for automated invoice generation
            await auditService.recordAudit({
              actor_id: actorUserId,
              actor_scope: actorUserId ? 'platform' : 'system',
              action: 'PLATFORM_INVOICE_AUTO_GENERATED',
              target_type: 'platform_invoices',
              target_id: invoice.id as string,
              after_state: {
                invoice_number: invoice.invoice_number,
                subscription_id: sub.id,
                business_id: sub.business_id,
                total_amount: invoice.total_amount,
                billing_period_start: periodStart.toISOString(),
                billing_period_end: periodEnd.toISOString(),
              },
              status: 'SUCCESS',
            })
          } catch (err: any) {
            logger.error({ err, subscription_id: sub.id }, 'Failed to generate recurring platform invoice')
            result.failures.push({
              entity_id: sub.id,
              entity_type: 'subscription',
              operation: 'RECURRING_INVOICE',
              error: err.message || 'Unknown error',
            })
          }
        }

        // =====================================================================
        // STEP 2: OVERDUE / DUNNING AUTOMATION
        // Find ISSUED platform invoices where due_date < now
        // =====================================================================
        const overdueRes = await lockClient.query(
          `SELECT id, invoice_number, subscription_id, business_id, total_amount, due_date, status
           FROM platform_invoices
           WHERE status = 'ISSUED'
             AND due_date < $1
           ORDER BY due_date ASC`,
          [now.toISOString()]
        )

        for (const inv of overdueRes.rows) {
          try {
            const updateRes = await lockClient.query(
              `UPDATE platform_invoices
               SET status = 'OVERDUE', updated_at = now()
               WHERE id = $1 AND status = 'ISSUED'
               RETURNING *`,
              [inv.id]
            )

            if (updateRes.rows.length > 0) {
              result.invoices_marked_overdue++

              await auditService.recordAudit({
                actor_id: actorUserId,
                actor_scope: actorUserId ? 'platform' : 'system',
                action: 'PLATFORM_INVOICE_MARKED_OVERDUE',
                target_type: 'platform_invoices',
                target_id: inv.id,
                before_state: { status: 'ISSUED', due_date: inv.due_date },
                after_state: { status: 'OVERDUE', updated_at: new Date().toISOString() },
                status: 'SUCCESS',
              })
            }
          } catch (err: any) {
            logger.error({ err, invoice_id: inv.id }, 'Failed to mark platform invoice as overdue')
            result.failures.push({
              entity_id: inv.id,
              entity_type: 'platform_invoice',
              operation: 'MARK_OVERDUE',
              error: err.message || 'Unknown error',
            })
          }
        }

        // =====================================================================
        // STEP 3: AUTOMATIC SUBSCRIPTION SUSPENSION
        // Find ACTIVE subscriptions where ends_at <= now AND has an unpaid OVERDUE invoice
        // =====================================================================
        const suspensionRes = await lockClient.query(
          `SELECT s.id, s.business_id, s.plan_code, s.status, s.ends_at
           FROM subscriptions s
           WHERE s.status = 'ACTIVE'
             AND s.ends_at IS NOT NULL
             AND s.ends_at <= $1
             AND EXISTS (
               SELECT 1 FROM platform_invoices inv
               WHERE inv.subscription_id = s.id
                 AND inv.status = 'OVERDUE'
             )
           ORDER BY s.ends_at ASC`,
          [now.toISOString()]
        )

        for (const sub of suspensionRes.rows) {
          try {
            const updateSubRes = await lockClient.query(
              `UPDATE subscriptions
               SET status = 'SUSPENDED', updated_at = now()
               WHERE id = $1 AND status = 'ACTIVE'
               RETURNING *`,
              [sub.id]
            )

            if (updateSubRes.rows.length > 0) {
              result.subscriptions_suspended++

              await auditService.recordAudit({
                actor_id: actorUserId,
                actor_scope: actorUserId ? 'platform' : 'system',
                action: 'PLATFORM_SUBSCRIPTION_SUSPENDED',
                target_type: 'subscriptions',
                target_id: sub.id,
                before_state: { status: 'ACTIVE', ends_at: sub.ends_at },
                after_state: { status: 'SUSPENDED', updated_at: new Date().toISOString() },
                status: 'SUCCESS',
              })
            }
          } catch (err: any) {
            logger.error({ err, subscription_id: sub.id }, 'Failed to suspend subscription')
            result.failures.push({
              entity_id: sub.id,
              entity_type: 'subscription',
              operation: 'SUSPEND_SUBSCRIPTION',
              error: err.message || 'Unknown error',
            })
          }
        }

        return result
      } finally {
        if (lockAcquired) {
          try {
            await lockClient.query(
              `SELECT pg_advisory_unlock(hashtext('platform_billing_automation'))`
            )
          } catch (unlockErr) {
            logger.error({ err: unlockErr }, 'Failed to release billing automation advisory lock')
          }
        }
        lockClient.release()
      }
    },
  }
}
