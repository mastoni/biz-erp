import { Pool } from 'pg'
import { withTransaction } from '../db/transaction'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'
import { createWalletService } from './wallet_service'
import { createAuditService } from './audit_service'
import { journalRepository } from '../repositories/journal_repository'
import { walletReconciliationRepository } from '../repositories/wallet_reconciliation_repository'
import {
  SettlementDiscrepancy,
  WalletReconciliationSummary,
  WalletReconciliationFilter,
  WalletRefundRequest,
  WalletRefundResult
} from '../dto/wallet_reconciliation_dto'

export function createWalletReconciliationService(
  pool: Pool,
  walletServiceOverride?: ReturnType<typeof createWalletService>,
  auditServiceOverride?: ReturnType<typeof createAuditService>
) {
  const auditService = auditServiceOverride ?? createAuditService(pool)
  const walletService = walletServiceOverride ?? createWalletService(pool, auditService)

  return {
    /**
     * Executes read-only multi-entity reconciliation across customer invoices,
     * POS sales, and digital wallet ledgers.
     */
    async reconcileSettlements(
      businessId: string,
      filter: WalletReconciliationFilter = {},
      actorContext?: {
        actorId?: string | null
        actorEmail?: string | null
        actorScope?: 'platform' | 'tenant' | 'system'
        actorRole?: string | null
      }
    ): Promise<WalletReconciliationSummary> {
      if (!isUuid(businessId)) {
        throw new ValidationError('businessId must be a valid UUID')
      }

      return withTransaction(pool, async (client) => {
        const discrepancies: SettlementDiscrepancy[] = []
        let totalInvoicesScanned = 0
        let totalSalesScanned = 0
        let totalReconciledSettlements = 0
        let totalReconciledVolumeMinor = 0
        const nowIso = new Date().toISOString()

        // 1. Reconcile Customer Invoice Settlements (unless domain is strictly POS_SALE)
        if (!filter.domain || filter.domain === 'CUSTOMER_INVOICE') {
          const invoiceRows = await walletReconciliationRepository.getInvoiceSettlementData(
            client,
            businessId,
            filter.fromDate,
            filter.toDate
          )

          totalInvoicesScanned = invoiceRows.length

          for (const row of invoiceRows) {
            const isInvoicePaid = row.invoice_status === 'PAID'
            const hasPayment = row.payment_id !== null
            const hasLedger = row.wallet_ledger_id !== null
            const invoiceTotal = Number(row.invoice_total_minor || 0)
            const ledgerAmount = row.ledger_amount ? Number(row.ledger_amount) : 0

            // Case A: Missing invoice match for an invoice payment ledger debit
            if (!row.invoice_id && hasLedger) {
              discrepancies.push({
                discrepancy_type: 'WALLET_PAYMENT_UNSETTLED',
                domain: 'CUSTOMER_INVOICE',
                reference_id: row.wallet_ledger_id!,
                reference_number: row.invoice_number,
                business_id: businessId,
                wallet_id: row.ledger_wallet_id,
                wallet_ledger_id: row.wallet_ledger_id,
                expected_amount_minor: 0,
                actual_amount_minor: ledgerAmount,
                difference_minor: ledgerAmount,
                details: `Wallet ledger debit exists for invoice payment but invoice record is missing`,
                detected_at: nowIso
              })
              continue
            }

            // Case B: Paid invoice without matching wallet ledger debit
            if ((isInvoicePaid || hasPayment) && !hasLedger) {
              discrepancies.push({
                discrepancy_type: 'INVOICE_LEDGER_ORPHAN',
                domain: 'CUSTOMER_INVOICE',
                reference_id: row.invoice_id,
                reference_number: row.invoice_number,
                business_id: businessId,
                wallet_id: null,
                wallet_ledger_id: null,
                expected_amount_minor: invoiceTotal,
                actual_amount_minor: 0,
                difference_minor: invoiceTotal,
                details: `Invoice ${row.invoice_number} is marked PAID/Payment recorded but has no wallet ledger debit entry`,
                detected_at: nowIso
              })
              continue
            }

            // Case C: Ledger debit exists but invoice is NOT marked PAID
            if (hasLedger && !isInvoicePaid) {
              discrepancies.push({
                discrepancy_type: 'WALLET_PAYMENT_UNSETTLED',
                domain: 'CUSTOMER_INVOICE',
                reference_id: row.invoice_id,
                reference_number: row.invoice_number,
                business_id: businessId,
                wallet_id: row.ledger_wallet_id,
                wallet_ledger_id: row.wallet_ledger_id,
                expected_amount_minor: invoiceTotal,
                actual_amount_minor: ledgerAmount,
                difference_minor: Math.abs(invoiceTotal - ledgerAmount),
                details: `Wallet was debited for invoice ${row.invoice_number} but invoice status is ${row.invoice_status}`,
                detected_at: nowIso
              })
              continue
            }

            // Case D: Amount mismatch between invoice and wallet ledger debit
            if (isInvoicePaid && hasLedger && invoiceTotal !== ledgerAmount) {
              discrepancies.push({
                discrepancy_type: 'AMOUNT_MISMATCH',
                domain: 'CUSTOMER_INVOICE',
                reference_id: row.invoice_id,
                reference_number: row.invoice_number,
                business_id: businessId,
                wallet_id: row.ledger_wallet_id,
                wallet_ledger_id: row.wallet_ledger_id,
                expected_amount_minor: invoiceTotal,
                actual_amount_minor: ledgerAmount,
                difference_minor: Math.abs(invoiceTotal - ledgerAmount),
                details: `Amount mismatch for invoice ${row.invoice_number}: invoice total ${invoiceTotal} vs ledger debit ${ledgerAmount}`,
                detected_at: nowIso
              })
              continue
            }

            // Clean reconciled invoice settlement
            if (isInvoicePaid && hasLedger && invoiceTotal === ledgerAmount) {
              totalReconciledSettlements++
              totalReconciledVolumeMinor += invoiceTotal
            }
          }
        }

        // 2. Reconcile POS Sale Settlements (unless domain is strictly CUSTOMER_INVOICE)
        if (!filter.domain || filter.domain === 'POS_SALE') {
          const saleRows = await walletReconciliationRepository.getSaleSettlementData(
            client,
            businessId,
            filter.fromDate,
            filter.toDate
          )

          totalSalesScanned = saleRows.length

          for (const row of saleRows) {
            const hasWalletPayment = row.payment_method === 'wallet' || row.sale_wallet_id !== null
            const hasLedger = row.wallet_ledger_id !== null
            const salePaidMinor = Number(row.sale_paid_minor || row.sale_total_minor || 0)
            const ledgerAmount = row.ledger_amount ? Number(row.ledger_amount) : 0

            // Case A: Missing sale record for a POS_PAYMENT ledger debit
            if (!row.sale_id && hasLedger) {
              discrepancies.push({
                discrepancy_type: 'WALLET_PAYMENT_UNSETTLED',
                domain: 'POS_SALE',
                reference_id: row.wallet_ledger_id!,
                reference_number: row.receipt_number,
                business_id: businessId,
                wallet_id: row.ledger_wallet_id,
                wallet_ledger_id: row.wallet_ledger_id,
                expected_amount_minor: 0,
                actual_amount_minor: ledgerAmount,
                difference_minor: ledgerAmount,
                details: `Wallet ledger debit exists for POS payment but sale record is missing`,
                detected_at: nowIso
              })
              continue
            }

            // Case B: POS sale paid via wallet without matching wallet ledger debit
            if (hasWalletPayment && !hasLedger) {
              discrepancies.push({
                discrepancy_type: 'INVOICE_LEDGER_ORPHAN',
                domain: 'POS_SALE',
                reference_id: row.sale_id,
                reference_number: row.receipt_number,
                business_id: businessId,
                wallet_id: row.sale_wallet_id,
                wallet_ledger_id: null,
                expected_amount_minor: salePaidMinor,
                actual_amount_minor: 0,
                difference_minor: salePaidMinor,
                details: `POS Sale ${row.receipt_number} recorded wallet payment but has no wallet ledger debit entry`,
                detected_at: nowIso
              })
              continue
            }

            // Case C: Amount mismatch between POS sale and wallet ledger debit
            if (hasWalletPayment && hasLedger && salePaidMinor !== ledgerAmount) {
              discrepancies.push({
                discrepancy_type: 'AMOUNT_MISMATCH',
                domain: 'POS_SALE',
                reference_id: row.sale_id,
                reference_number: row.receipt_number,
                business_id: businessId,
                wallet_id: row.ledger_wallet_id,
                wallet_ledger_id: row.wallet_ledger_id,
                expected_amount_minor: salePaidMinor,
                actual_amount_minor: ledgerAmount,
                difference_minor: Math.abs(salePaidMinor - ledgerAmount),
                details: `Amount mismatch for POS Sale ${row.receipt_number}: paid minor ${salePaidMinor} vs ledger debit ${ledgerAmount}`,
                detected_at: nowIso
              })
              continue
            }

            // Clean reconciled POS sale settlement
            if (hasWalletPayment && hasLedger && salePaidMinor === ledgerAmount) {
              totalReconciledSettlements++
              totalReconciledVolumeMinor += salePaidMinor
            }
          }
        }

        const breakdown = {
          invoice_ledger_orphans: discrepancies.filter((d) => d.discrepancy_type === 'INVOICE_LEDGER_ORPHAN').length,
          wallet_payment_unsettled: discrepancies.filter((d) => d.discrepancy_type === 'WALLET_PAYMENT_UNSETTLED').length,
          amount_mismatches: discrepancies.filter((d) => d.discrepancy_type === 'AMOUNT_MISMATCH').length
        }

        const summary: WalletReconciliationSummary = {
          business_id: businessId,
          period_start: filter.fromDate ?? null,
          period_end: filter.toDate ?? null,
          total_settlements_scanned: totalInvoicesScanned + totalSalesScanned,
          total_invoices_scanned: totalInvoicesScanned,
          total_sales_scanned: totalSalesScanned,
          total_reconciled_settlements: totalReconciledSettlements,
          total_discrepancies: discrepancies.length,
          discrepancy_breakdown: breakdown,
          total_reconciled_volume_minor: totalReconciledVolumeMinor,
          discrepancies,
          status: discrepancies.length === 0 ? 'RECONCILED' : 'DISCREPANCIES_FOUND',
          reconciled_at: nowIso
        }

        // 3. Emit authoritative audit log
        await auditService.recordAudit({
          actor_id: actorContext?.actorId ?? null,
          actor_email: actorContext?.actorEmail ?? null,
          actor_scope: actorContext?.actorScope ?? 'tenant',
          actor_role: actorContext?.actorRole ?? 'OWNER',
          action: 'WALLET_SETTLEMENT_RECONCILED',
          service_code: 'DIGITAL_WALLET',
          target_type: 'WALLET_RECONCILIATION',
          target_id: businessId,
          status: 'SUCCESS',
          metadata: {
            business_id: businessId,
            total_settlements_scanned: summary.total_settlements_scanned,
            total_reconciled_settlements: summary.total_reconciled_settlements,
            total_discrepancies: summary.total_discrepancies,
            discrepancy_breakdown: breakdown,
            status: summary.status
          }
        })

        return summary
      })
    },

    /**
     * Atomically executes compensating wallet refund and GL reversal for a wallet-settled customer invoice.
     */
    async refundInvoiceSettlement(
      businessId: string,
      invoiceId: string,
      input: WalletRefundRequest,
      actorContext?: {
        actorId?: string | null
        actorEmail?: string | null
        actorScope?: 'platform' | 'tenant' | 'system'
        actorRole?: string | null
      }
    ): Promise<WalletRefundResult> {
      if (!isUuid(businessId)) throw new ValidationError('businessId must be a valid UUID')
      if (!isUuid(invoiceId)) throw new ValidationError('invoiceId must be a valid UUID')
      if (!input.reason || typeof input.reason !== 'string' || input.reason.trim().length === 0) {
        throw new ValidationError('reason is required')
      }
      if (!input.idempotency_key || typeof input.idempotency_key !== 'string' || input.idempotency_key.trim().length === 0) {
        throw new ValidationError('idempotency_key is required')
      }

      return withTransaction(pool, async (client) => {
        // 1. Check idempotency for existing refund
        const existingRefundLedger = await client.query(
          `SELECT wl.id, wl.wallet_id, wl.amount, wl.created_at, wa.business_id
           FROM wallet_ledgers wl
           JOIN wallet_accounts wa ON wa.id = wl.wallet_id
           WHERE wl.idempotency_key = $1`,
          [input.idempotency_key.trim()]
        )

        if (existingRefundLedger.rows.length > 0) {
          const row = existingRefundLedger.rows[0]
          return {
            success: true,
            refund_type: 'CUSTOMER_INVOICE',
            reference_id: invoiceId,
            business_id: businessId,
            wallet_id: row.wallet_id,
            refund_ledger_id: row.id,
            reversal_journal_id: null,
            amount_minor: Number(row.amount),
            already_refunded: true,
            refunded_at: row.created_at
          }
        }

        // 2. Lock customer_invoices row
        const invRes = await client.query(
          `SELECT id, invoice_number, business_id, receivable_id, total_minor, status, payment_reference, currency
           FROM customer_invoices
           WHERE id = $1 AND business_id = $2
           FOR UPDATE`,
          [invoiceId, businessId]
        )

        if (invRes.rows.length === 0) {
          throw new ApiError(404, 'INVOICE_NOT_FOUND', 'Customer invoice not found for this tenant')
        }

        const invoice = invRes.rows[0]

        if (invoice.status === 'CANCELLED') {
          throw new ApiError(409, 'ALREADY_CANCELLED_OR_REFUNDED', 'Invoice is already cancelled or refunded')
        }

        if (invoice.status !== 'PAID') {
          throw new ApiError(400, 'INVALID_STATE', `Cannot refund invoice with status ${invoice.status}; must be PAID`)
        }

        // 3. Find customer_payment row
        const payRes = await client.query(
          `SELECT id, amount_minor, method, reference
           FROM customer_payments
           WHERE receivable_id = $1 AND business_id = $2 AND method = 'wallet'`,
          [invoice.receivable_id, businessId]
        )

        if (payRes.rows.length === 0) {
          throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'No wallet payment record found for this invoice')
        }

        const payment = payRes.rows[0]

        // 4. Find original wallet ledger debit row
        const ledgerRes = await client.query(
          `SELECT id, wallet_id, amount, currency
           FROM wallet_ledgers
           WHERE ((reference_type = 'CUSTOMER_INVOICE' AND reference_id = $1)
               OR id::text = $2
               OR id::text = $3)
             AND entry_type = 'DEBIT'
           ORDER BY created_at DESC
           LIMIT 1`,
          [invoice.id, invoice.payment_reference, payment.reference]
        )

        if (ledgerRes.rows.length === 0) {
          throw new ApiError(404, 'LEDGER_ENTRY_NOT_FOUND', 'Original wallet debit ledger entry not found')
        }

        const origLedger = ledgerRes.rows[0]
        const refundAmount = Number(origLedger.amount)

        // 5. Compensating credit to digital wallet
        const creditResult = await walletService.credit(
          {
            wallet_id: origLedger.wallet_id,
            amount: refundAmount,
            currency: origLedger.currency,
            transaction_type: 'REFUND',
            reference_type: 'CUSTOMER_INVOICE',
            reference_id: invoice.id,
            idempotency_key: input.idempotency_key.trim(),
            actor_id: actorContext?.actorId ?? null,
            actor_scope: (actorContext?.actorScope as any) ?? 'tenant',
            description: `Compensating refund for customer invoice ${invoice.invoice_number}: ${input.reason.trim()}`,
            metadata: {
              original_ledger_id: origLedger.id,
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
              reason: input.reason.trim()
            }
          },
          client
        )

        // 6. Reverse the payment GL journal entry
        let reversalJournalId: string | null = null
        const journalRes = await client.query(
          `SELECT id FROM journal_entries
           WHERE business_id = $1 AND source_type = 'CUSTOMER_PAYMENT' AND source_id = $2 AND status = 'posted'`,
          [businessId, payment.id]
        )

        if (journalRes.rows.length > 0) {
          const revResult = await journalRepository.createReversal(client, journalRes.rows[0].id)
          reversalJournalId = revResult.reversal_id
        }

        // 7. Update receivable status (reinstate outstanding)
        await client.query(
          `UPDATE receivables
           SET paid_minor = GREATEST(0, paid_minor - $1),
               outstanding_minor = outstanding_minor + $1,
               status = CASE WHEN (paid_minor - $1) <= 0 THEN 'OPEN' ELSE 'PARTIAL' END,
               updated_at = now()
           WHERE id = $2 AND business_id = $3`,
          [refundAmount, invoice.receivable_id, businessId]
        )

        // 8. Update customer_invoices status to CANCELLED
        await client.query(
          `UPDATE customer_invoices
           SET status = 'CANCELLED',
               notes = COALESCE(notes || ' | ', '') || 'Refunded via Wallet: ' || $1,
               updated_at = now()
           WHERE id = $2 AND business_id = $3`,
          [input.reason.trim(), invoice.id, businessId]
        )

        // 9. Emit authoritative audit log
        await auditService.recordAudit({
          actor_id: actorContext?.actorId ?? null,
          actor_email: actorContext?.actorEmail ?? null,
          actor_scope: actorContext?.actorScope ?? 'tenant',
          actor_role: actorContext?.actorRole ?? 'OWNER',
          action: 'CUSTOMER_INVOICE_WALLET_REFUNDED',
          service_code: 'DIGITAL_WALLET',
          target_type: 'CUSTOMER_INVOICE',
          target_id: invoice.id,
          status: 'SUCCESS',
          metadata: {
            business_id: businessId,
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            wallet_id: origLedger.wallet_id,
            refund_ledger_id: creditResult.ledger.id,
            reversal_journal_id: reversalJournalId,
            amount_minor: refundAmount,
            reason: input.reason.trim()
          }
        })

        return {
          success: true,
          refund_type: 'CUSTOMER_INVOICE',
          reference_id: invoice.id,
          business_id: businessId,
          wallet_id: origLedger.wallet_id,
          refund_ledger_id: creditResult.ledger.id,
          reversal_journal_id: reversalJournalId,
          amount_minor: refundAmount,
          refunded_at: new Date().toISOString()
        }
      })
    },

    /**
     * Atomically executes compensating wallet refund and GL reversal for a wallet-settled POS sale.
     */
    async refundSaleSettlement(
      businessId: string,
      saleId: string,
      input: WalletRefundRequest,
      actorContext?: {
        actorId?: string | null
        actorEmail?: string | null
        actorScope?: 'platform' | 'tenant' | 'system'
        actorRole?: string | null
      }
    ): Promise<WalletRefundResult> {
      if (!isUuid(businessId)) throw new ValidationError('businessId must be a valid UUID')
      if (!isUuid(saleId)) throw new ValidationError('saleId must be a valid UUID')
      if (!input.reason || typeof input.reason !== 'string' || input.reason.trim().length === 0) {
        throw new ValidationError('reason is required')
      }
      if (!input.idempotency_key || typeof input.idempotency_key !== 'string' || input.idempotency_key.trim().length === 0) {
        throw new ValidationError('idempotency_key is required')
      }

      return withTransaction(pool, async (client) => {
        // 1. Check idempotency for existing refund
        const existingRefundLedger = await client.query(
          `SELECT wl.id, wl.wallet_id, wl.amount, wl.created_at, wa.business_id
           FROM wallet_ledgers wl
           JOIN wallet_accounts wa ON wa.id = wl.wallet_id
           WHERE wl.idempotency_key = $1`,
          [input.idempotency_key.trim()]
        )

        if (existingRefundLedger.rows.length > 0) {
          const row = existingRefundLedger.rows[0]
          return {
            success: true,
            refund_type: 'POS_SALE',
            reference_id: saleId,
            business_id: businessId,
            wallet_id: row.wallet_id,
            refund_ledger_id: row.id,
            reversal_journal_id: null,
            amount_minor: Number(row.amount),
            already_refunded: true,
            refunded_at: row.created_at
          }
        }

        // 2. Lock sales row
        const saleRes = await client.query(
          `SELECT id, receipt_number, business_id, total_minor, paid_minor, payment_method, wallet_id
           FROM sales
           WHERE id = $1 AND business_id = $2
           FOR UPDATE`,
          [saleId, businessId]
        )

        if (saleRes.rows.length === 0) {
          throw new ApiError(404, 'SALE_NOT_FOUND', 'POS sale not found for this tenant')
        }

        const sale = saleRes.rows[0]

        if (sale.payment_method !== 'wallet' && !sale.wallet_id) {
          throw new ApiError(400, 'INVALID_PAYMENT_METHOD', 'Sale was not settled via digital wallet')
        }

        // 3. Find original wallet debit ledger
        const ledgerRes = await client.query(
          `SELECT id, wallet_id, amount, currency
           FROM wallet_ledgers
           WHERE ((reference_type = 'POS_SALE' AND reference_id = $1)
               OR (transaction_type = 'POS_PAYMENT' AND metadata->>'sale_id' = $1))
             AND entry_type = 'DEBIT'
           ORDER BY created_at DESC
           LIMIT 1`,
          [sale.id]
        )

        if (ledgerRes.rows.length === 0) {
          throw new ApiError(404, 'LEDGER_ENTRY_NOT_FOUND', 'Original POS wallet debit ledger entry not found')
        }

        const origLedger = ledgerRes.rows[0]
        const refundAmount = Number(origLedger.amount)
        const targetWalletId = sale.wallet_id || origLedger.wallet_id

        // 4. Compensating credit to digital wallet
        const creditResult = await walletService.credit(
          {
            wallet_id: targetWalletId,
            amount: refundAmount,
            currency: origLedger.currency,
            transaction_type: 'REFUND',
            reference_type: 'POS_SALE',
            reference_id: sale.id,
            idempotency_key: input.idempotency_key.trim(),
            actor_id: actorContext?.actorId ?? null,
            actor_scope: (actorContext?.actorScope as any) ?? 'tenant',
            description: `Compensating refund for POS sale ${sale.receipt_number}: ${input.reason.trim()}`,
            metadata: {
              original_ledger_id: origLedger.id,
              sale_id: sale.id,
              receipt_number: sale.receipt_number,
              reason: input.reason.trim()
            }
          },
          client
        )

        // 5. Reverse the sale GL journal entry
        let reversalJournalId: string | null = null
        const journalRes = await client.query(
          `SELECT id FROM journal_entries
           WHERE business_id = $1 AND source_type = 'SALE' AND source_id = $2 AND status = 'posted'`,
          [businessId, sale.id]
        )

        if (journalRes.rows.length > 0) {
          const revResult = await journalRepository.createReversal(client, journalRes.rows[0].id)
          reversalJournalId = revResult.reversal_id
        }

        // 6. Emit authoritative audit log
        await auditService.recordAudit({
          actor_id: actorContext?.actorId ?? null,
          actor_email: actorContext?.actorEmail ?? null,
          actor_scope: actorContext?.actorScope ?? 'tenant',
          actor_role: actorContext?.actorRole ?? 'OWNER',
          action: 'POS_SALE_WALLET_REFUNDED',
          service_code: 'DIGITAL_WALLET',
          target_type: 'SALE',
          target_id: sale.id,
          status: 'SUCCESS',
          metadata: {
            business_id: businessId,
            sale_id: sale.id,
            receipt_number: sale.receipt_number,
            wallet_id: targetWalletId,
            refund_ledger_id: creditResult.ledger.id,
            reversal_journal_id: reversalJournalId,
            amount_minor: refundAmount,
            reason: input.reason.trim()
          }
        })

        return {
          success: true,
          refund_type: 'POS_SALE',
          reference_id: sale.id,
          business_id: businessId,
          wallet_id: targetWalletId,
          refund_ledger_id: creditResult.ledger.id,
          reversal_journal_id: reversalJournalId,
          amount_minor: refundAmount,
          refunded_at: new Date().toISOString()
        }
      })
    }
  }
}
