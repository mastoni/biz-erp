import { Pool } from 'pg'
import {
  TopUpIntentDto,
  CreateTopUpIntentInput,
  SettleTopUpIntentInput,
  SettleTopUpIntentResult,
  TopUpIntentQueryFilter,
  TopUpIntentStatus
} from '../dto/wallet_dto'
import { createTopUpIntentRepository } from '../repositories/top_up_intent_repository'
import { createWalletRepository } from '../repositories/wallet_repository'
import { createAuditService } from './audit_service'
import { ApiError } from '../errors/api_error'

export function createTopUpIntentService(
  pool: Pool,
  auditService?: ReturnType<typeof createAuditService>
) {
  const topUpRepo = createTopUpIntentRepository(pool)
  const walletRepo = createWalletRepository(pool)

  function generateIntentNumber(): string {
    const timestamp = Date.now().toString()
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')
    return `TOP-${timestamp.slice(-8)}-${random}`
  }

  return {
    async createIntent(input: CreateTopUpIntentInput): Promise<TopUpIntentDto> {
      // 1. Validate wallet exists and belongs to account customer
      const wallet = await walletRepo.getAccountById(input.wallet_id)
      if (!wallet) {
        throw new ApiError(404, 'WALLET_NOT_FOUND', 'Wallet account not found')
      }

      if (wallet.account_customer_id !== input.account_customer_id) {
        throw new ApiError(
          403,
          'OWNERSHIP_MISMATCH',
          'Wallet does not belong to the specified account customer'
        )
      }

      if (wallet.status !== 'ACTIVE') {
        throw new ApiError(
          400,
          'WALLET_NOT_ACTIVE',
          `Cannot create top-up intent for wallet in ${wallet.status} status`
        )
      }

      const currency = input.currency ?? wallet.currency
      if (currency !== wallet.currency) {
        throw new ApiError(
          400,
          'CURRENCY_MISMATCH',
          `Top-up currency ${currency} does not match wallet currency ${wallet.currency}`
        )
      }

      if (input.amount <= 0) {
        throw new ApiError(400, 'INVALID_AMOUNT', 'Top-up amount must be strictly greater than zero')
      }

      const feeAmount = input.fee_amount ?? 0
      if (feeAmount < 0) {
        throw new ApiError(400, 'INVALID_FEE', 'Fee amount cannot be negative')
      }

      const totalPayable = input.amount + feeAmount
      const intentNumber = generateIntentNumber()
      const expiresInHours = input.expires_in_hours ?? 24
      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()

      const intent = await topUpRepo.createIntent({
        intentNumber,
        walletId: input.wallet_id,
        accountCustomerId: input.account_customer_id,
        amount: input.amount,
        feeAmount,
        totalPayable,
        currency,
        paymentMethod: input.payment_method ?? null,
        expiresAt,
        metadata: input.metadata
      })

      if (auditService) {
        await auditService.recordAudit({
          actor_id: input.actor_id ?? null,
          actor_scope: input.actor_scope === 'customer' ? 'tenant' : (input.actor_scope ?? 'system'),
          action: 'WALLET_TOPUP_INTENT_CREATED',
          service_code: 'DIGITAL_WALLET',
          target_type: 'top_up_intent',
          target_id: intent.id,
          after_state: {
            intent_number: intent.intent_number,
            wallet_id: intent.wallet_id,
            amount: intent.amount,
            total_payable: intent.total_payable,
            status: intent.status
          },
          metadata: {
            intent_number: intent.intent_number,
            wallet_id: intent.wallet_id
          }
        }).catch(() => {})
      }

      return intent
    },

    async getIntentById(id: string): Promise<TopUpIntentDto> {
      const intent = await topUpRepo.getIntentById(id)
      if (!intent) {
        throw new ApiError(404, 'INTENT_NOT_FOUND', 'Top-up intent not found')
      }
      return intent
    },

    async getIntentByNumber(intentNumber: string): Promise<TopUpIntentDto> {
      const intent = await topUpRepo.getIntentByNumber(intentNumber)
      if (!intent) {
        throw new ApiError(404, 'INTENT_NOT_FOUND', `Top-up intent ${intentNumber} not found`)
      }
      return intent
    },

    async listIntents(filter: TopUpIntentQueryFilter): Promise<{ items: TopUpIntentDto[]; total: number }> {
      return topUpRepo.listIntents(filter)
    },

    /**
     * Authoritatively settles a top-up intent and atomically credits the wallet.
     * Enforces idempotency: multiple calls with same intent/payment event will not double credit.
     */
    async settleIntent(input: SettleTopUpIntentInput): Promise<SettleTopUpIntentResult> {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // 1. Lock top-up intent row
        const intentRes = await client.query(
          `SELECT * FROM top_up_intents WHERE intent_number = $1 FOR UPDATE`,
          [input.intent_number]
        )

        if (intentRes.rows.length === 0) {
          await client.query('ROLLBACK')
          throw new ApiError(404, 'INTENT_NOT_FOUND', `Top-up intent ${input.intent_number} not found`)
        }

        const intentRow = intentRes.rows[0]
        const currentStatus = intentRow.status as TopUpIntentStatus

        // 2. Check for idempotent replay
        if (currentStatus === 'SUCCEEDED') {
          // Re-fetch existing ledger and wallet state
          const walletRes = await client.query(`SELECT * FROM wallet_accounts WHERE id = $1`, [intentRow.wallet_id])
          const ledgerRes = await client.query(
            `SELECT * FROM wallet_ledgers WHERE reference_type = 'TOP_UP_INTENT' AND reference_id = $1`,
            [input.intent_number]
          )

          await client.query('COMMIT')

          return {
            intent: await this.getIntentByNumber(input.intent_number),
            wallet_mutation: {
              account: {
                id: walletRes.rows[0].id,
                account_customer_id: walletRes.rows[0].account_customer_id,
                business_id: walletRes.rows[0].business_id ?? null,
                wallet_number: walletRes.rows[0].wallet_number,
                currency: walletRes.rows[0].currency,
                status: walletRes.rows[0].status,
                balance: Number(walletRes.rows[0].balance),
                pending_credit: Number(walletRes.rows[0].pending_credit),
                pending_debit: Number(walletRes.rows[0].pending_debit),
                server_version: Number(walletRes.rows[0].server_version),
                metadata: walletRes.rows[0].metadata ?? {},
                created_at: typeof walletRes.rows[0].created_at === 'string' ? walletRes.rows[0].created_at : walletRes.rows[0].created_at.toISOString(),
                updated_at: typeof walletRes.rows[0].updated_at === 'string' ? walletRes.rows[0].updated_at : walletRes.rows[0].updated_at.toISOString()
              },
              ledger: ledgerRes.rows[0]
                ? {
                    id: ledgerRes.rows[0].id,
                    wallet_id: ledgerRes.rows[0].wallet_id,
                    transaction_type: ledgerRes.rows[0].transaction_type,
                    entry_type: ledgerRes.rows[0].entry_type,
                    amount: Number(ledgerRes.rows[0].amount),
                    balance_before: Number(ledgerRes.rows[0].balance_before),
                    balance_after: Number(ledgerRes.rows[0].balance_after),
                    currency: ledgerRes.rows[0].currency,
                    reference_type: ledgerRes.rows[0].reference_type,
                    reference_id: ledgerRes.rows[0].reference_id,
                    idempotency_key: ledgerRes.rows[0].idempotency_key,
                    actor_id: ledgerRes.rows[0].actor_id ?? null,
                    actor_scope: ledgerRes.rows[0].actor_scope,
                    description: ledgerRes.rows[0].description,
                    metadata: ledgerRes.rows[0].metadata ?? {},
                    created_at: typeof ledgerRes.rows[0].created_at === 'string' ? ledgerRes.rows[0].created_at : ledgerRes.rows[0].created_at.toISOString()
                  }
                : (null as any),
              already_processed: true
            },
            already_processed: true
          }
        }

        if (currentStatus !== 'PENDING' && currentStatus !== 'PROCESSING') {
          await client.query('ROLLBACK')
          throw new ApiError(
            400,
            'INVALID_INTENT_STATUS',
            `Cannot settle top-up intent in status ${currentStatus}`
          )
        }

        // 3. Validate amounts & currency consistency
        const intentAmount = Number(intentRow.amount)
        if (input.paid_amount !== undefined && input.paid_amount < intentAmount) {
          await client.query('ROLLBACK')
          throw new ApiError(
            400,
            'AMOUNT_MISMATCH',
            `Paid amount (${input.paid_amount}) is less than expected intent amount (${intentAmount})`
          )
        }

        if (input.currency && input.currency !== intentRow.currency) {
          await client.query('ROLLBACK')
          throw new ApiError(
            400,
            'CURRENCY_MISMATCH',
            `Paid currency (${input.currency}) does not match intent currency (${intentRow.currency})`
          )
        }

        // 4. Atomically credit the wallet
        const idempotencyKey = `TOPUP-SETTLE-${input.intent_number}`
        const mutationResult = await walletRepo.executeMutation({
          wallet_id: intentRow.wallet_id,
          transaction_type: 'TOP_UP',
          entry_type: 'CREDIT',
          amount: intentAmount,
          currency: intentRow.currency,
          reference_type: 'TOP_UP_INTENT',
          reference_id: input.intent_number,
          idempotency_key: idempotencyKey,
          actor_id: input.actor_id ?? null,
          actor_scope: input.actor_scope ?? 'system',
          description: `Top-up settlement for intent ${input.intent_number}`,
          metadata: {
            payment_reference: input.payment_reference,
            gateway_transaction_id: input.gateway_transaction_id ?? null
          }
        })

        // 5. Update top-up intent state to SUCCEEDED
        const updatedIntentRes = await client.query(
          `UPDATE top_up_intents
           SET status = 'SUCCEEDED',
               settled_at = now(),
               payment_reference = $1,
               gateway_transaction_id = $2,
               payment_method = COALESCE($3, payment_method),
               updated_at = now()
           WHERE id = $4
           RETURNING *`,
          [
            input.payment_reference,
            input.gateway_transaction_id ?? null,
            input.payment_method ?? null,
            intentRow.id
          ]
        )

        await client.query('COMMIT')

        const updatedIntent = await this.getIntentByNumber(input.intent_number)

        if (auditService) {
          await auditService.recordAudit({
            actor_id: input.actor_id ?? null,
            actor_scope: input.actor_scope === 'customer' ? 'tenant' : (input.actor_scope ?? 'system'),
            action: 'WALLET_TOPUP_SUCCEEDED',
            service_code: 'DIGITAL_WALLET',
            target_type: 'top_up_intent',
            target_id: intentRow.id,
            before_state: { status: currentStatus },
            after_state: { status: 'SUCCEEDED', settled_at: updatedIntent.settled_at },
            metadata: {
              intent_number: input.intent_number,
              wallet_id: intentRow.wallet_id,
              amount: intentAmount,
              payment_reference: input.payment_reference
            }
          }).catch(() => {})
        }

        return {
          intent: updatedIntent,
          wallet_mutation: mutationResult,
          already_processed: false
        }
      } catch (err) {
        try {
          await client.query('ROLLBACK')
        } catch (_) {}
        throw err
      } finally {
        client.release()
      }
    },

    async failIntent(
      intentNumber: string,
      reason?: string,
      actor?: { actor_id?: string | null; actor_scope?: 'platform' | 'tenant' | 'system' }
    ): Promise<TopUpIntentDto> {
      const intent = await this.getIntentByNumber(intentNumber)
      if (intent.status === 'SUCCEEDED') {
        throw new ApiError(400, 'INVALID_INTENT_STATUS', 'Cannot fail an already settled intent')
      }

      const updated = await topUpRepo.updateStatus(intent.id, 'FAILED')
      if (!updated) {
        throw new ApiError(404, 'INTENT_NOT_FOUND', 'Intent not found')
      }

      if (auditService) {
        await auditService.recordAudit({
          actor_id: actor?.actor_id ?? null,
          actor_scope: actor?.actor_scope ?? 'system',
          action: 'WALLET_TOPUP_FAILED',
          service_code: 'DIGITAL_WALLET',
          target_type: 'top_up_intent',
          target_id: intent.id,
          before_state: { status: intent.status },
          after_state: { status: 'FAILED' },
          metadata: { intent_number: intentNumber, reason }
        }).catch(() => {})
      }

      return updated
    },

    async expireIntent(
      intentNumber: string,
      actor?: { actor_id?: string | null; actor_scope?: 'platform' | 'tenant' | 'system' }
    ): Promise<TopUpIntentDto> {
      const intent = await this.getIntentByNumber(intentNumber)
      if (intent.status === 'SUCCEEDED') {
        throw new ApiError(400, 'INVALID_INTENT_STATUS', 'Cannot expire an already settled intent')
      }

      const updated = await topUpRepo.updateStatus(intent.id, 'EXPIRED')
      if (!updated) {
        throw new ApiError(404, 'INTENT_NOT_FOUND', 'Intent not found')
      }

      if (auditService) {
        await auditService.recordAudit({
          actor_id: actor?.actor_id ?? null,
          actor_scope: actor?.actor_scope ?? 'system',
          action: 'WALLET_TOPUP_EXPIRED',
          service_code: 'DIGITAL_WALLET',
          target_type: 'top_up_intent',
          target_id: intent.id,
          before_state: { status: intent.status },
          after_state: { status: 'EXPIRED' },
          metadata: { intent_number: intentNumber }
        }).catch(() => {})
      }

      return updated
    },

    async cancelIntent(
      intentNumber: string,
      actor?: { actor_id?: string | null; actor_scope?: 'platform' | 'tenant' | 'customer' | 'system' }
    ): Promise<TopUpIntentDto> {
      const intent = await this.getIntentByNumber(intentNumber)
      if (intent.status !== 'PENDING') {
        throw new ApiError(
          400,
          'INVALID_INTENT_STATUS',
          `Cannot cancel top-up intent in status ${intent.status}`
        )
      }

      const updated = await topUpRepo.updateStatus(intent.id, 'CANCELLED')
      if (!updated) {
        throw new ApiError(404, 'INTENT_NOT_FOUND', 'Intent not found')
      }

      if (auditService) {
        await auditService.recordAudit({
          actor_id: actor?.actor_id ?? null,
          actor_scope: actor?.actor_scope === 'customer' ? 'tenant' : (actor?.actor_scope ?? 'system'),
          action: 'WALLET_TOPUP_CANCELLED',
          service_code: 'DIGITAL_WALLET',
          target_type: 'top_up_intent',
          target_id: intent.id,
          before_state: { status: intent.status },
          after_state: { status: 'CANCELLED' },
          metadata: { intent_number: intentNumber }
        }).catch(() => {})
      }

      return updated
    }
  }
}
