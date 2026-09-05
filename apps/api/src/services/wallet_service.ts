import { Pool } from 'pg'
import {
  WalletAccountDto,
  WalletLedgerDto,
  CreateWalletAccountInput,
  DebitWalletInput,
  CreditWalletInput,
  WalletMutationResult,
  WalletQueryFilter,
  WalletLedgerQueryFilter
} from '../dto/wallet_dto'
import { createWalletRepository } from '../repositories/wallet_repository'
import { createAuditService } from './audit_service'
import { ApiError } from '../errors/api_error'

export function createWalletService(
  pool: Pool,
  auditService?: ReturnType<typeof createAuditService>
) {
  const walletRepo = createWalletRepository(pool)

  function generateWalletNumber(): string {
    const timestamp = Date.now().toString()
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')
    return `WAL-${timestamp.slice(-8)}-${random}`
  }

  return {
    async createAccount(input: CreateWalletAccountInput): Promise<WalletAccountDto> {
      // 1. Verify account customer exists
      const customerRes = await pool.query(
        `SELECT id, status FROM account_customers WHERE id = $1`,
        [input.account_customer_id]
      )
      if (customerRes.rows.length === 0) {
        throw new ApiError(404, 'ACCOUNT_CUSTOMER_NOT_FOUND', 'Account customer not found')
      }

      // 2. Check if wallet already exists for this customer + currency
      const currency = input.currency ?? 'IDR'
      const existing = await walletRepo.getAccountByCustomerAndCurrency(
        input.account_customer_id,
        currency
      )
      if (existing) {
        throw new ApiError(
          409,
          'WALLET_ALREADY_EXISTS',
          `Wallet for customer ${input.account_customer_id} with currency ${currency} already exists`
        )
      }

      // 3. Create wallet
      const walletNumber = input.wallet_number ?? generateWalletNumber()
      const account = await walletRepo.createAccount({
        accountCustomerId: input.account_customer_id,
        businessId: input.business_id ?? null,
        walletNumber,
        currency,
        metadata: input.metadata
      })

      // 4. Audit logging
      if (auditService) {
        await auditService.recordAudit({
          actor_id: input.actor_id ?? null,
          actor_scope: input.actor_scope ?? 'system',
          action: 'WALLET_ACCOUNT_CREATED',
          service_code: 'DIGITAL_WALLET',
          target_type: 'wallet_account',
          target_id: account.id,
          after_state: {
            wallet_id: account.id,
            wallet_number: account.wallet_number,
            account_customer_id: account.account_customer_id,
            currency: account.currency,
            balance: account.balance
          },
          metadata: {
            wallet_number: account.wallet_number,
            currency: account.currency
          }
        }).catch(() => {})
      }

      return account
    },

    async getAccountById(id: string): Promise<WalletAccountDto> {
      const account = await walletRepo.getAccountById(id)
      if (!account) {
        throw new ApiError(404, 'WALLET_NOT_FOUND', 'Wallet account not found')
      }
      return account
    },

    async getAccountByCustomerAndCurrency(
      accountCustomerId: string,
      currency = 'IDR'
    ): Promise<WalletAccountDto | null> {
      return walletRepo.getAccountByCustomerAndCurrency(accountCustomerId, currency)
    },

    async listAccounts(filter: WalletQueryFilter): Promise<{ items: WalletAccountDto[]; total: number }> {
      return walletRepo.listAccounts(filter)
    },

    async freezeAccount(
      id: string,
      actor?: { actor_id?: string | null; actor_scope?: 'platform' | 'tenant' | 'system' }
    ): Promise<WalletAccountDto> {
      const existing = await walletRepo.getAccountById(id)
      if (!existing) {
        throw new ApiError(404, 'WALLET_NOT_FOUND', 'Wallet account not found')
      }
      if (existing.status === 'CLOSED') {
        throw new ApiError(400, 'WALLET_CLOSED', 'Cannot freeze a closed wallet')
      }

      const updated = await walletRepo.updateAccountStatus(id, 'FROZEN')
      if (!updated) {
        throw new ApiError(404, 'WALLET_NOT_FOUND', 'Wallet account not found')
      }

      if (auditService) {
        await auditService.recordAudit({
          actor_id: actor?.actor_id ?? null,
          actor_scope: actor?.actor_scope ?? 'platform',
          action: 'WALLET_FROZEN',
          service_code: 'DIGITAL_WALLET',
          target_type: 'wallet_account',
          target_id: id,
          before_state: { status: existing.status },
          after_state: { status: updated.status }
        }).catch(() => {})
      }

      return updated
    },

    async unfreezeAccount(
      id: string,
      actor?: { actor_id?: string | null; actor_scope?: 'platform' | 'tenant' | 'system' }
    ): Promise<WalletAccountDto> {
      const existing = await walletRepo.getAccountById(id)
      if (!existing) {
        throw new ApiError(404, 'WALLET_NOT_FOUND', 'Wallet account not found')
      }
      if (existing.status === 'CLOSED') {
        throw new ApiError(400, 'WALLET_CLOSED', 'Cannot unfreeze a closed wallet')
      }

      const updated = await walletRepo.updateAccountStatus(id, 'ACTIVE')
      if (!updated) {
        throw new ApiError(404, 'WALLET_NOT_FOUND', 'Wallet account not found')
      }

      if (auditService) {
        await auditService.recordAudit({
          actor_id: actor?.actor_id ?? null,
          actor_scope: actor?.actor_scope ?? 'platform',
          action: 'WALLET_UNFROZEN',
          service_code: 'DIGITAL_WALLET',
          target_type: 'wallet_account',
          target_id: id,
          before_state: { status: existing.status },
          after_state: { status: updated.status }
        }).catch(() => {})
      }

      return updated
    },

    async closeAccount(
      id: string,
      actor?: { actor_id?: string | null; actor_scope?: 'platform' | 'tenant' | 'system' }
    ): Promise<WalletAccountDto> {
      const existing = await walletRepo.getAccountById(id)
      if (!existing) {
        throw new ApiError(404, 'WALLET_NOT_FOUND', 'Wallet account not found')
      }
      if (existing.balance > 0) {
        throw new ApiError(
          400,
          'NON_ZERO_BALANCE',
          `Cannot close wallet with remaining balance (${existing.balance}). Must withdraw/settle funds first.`
        )
      }

      const updated = await walletRepo.updateAccountStatus(id, 'CLOSED')
      if (!updated) {
        throw new ApiError(404, 'WALLET_NOT_FOUND', 'Wallet account not found')
      }

      if (auditService) {
        await auditService.recordAudit({
          actor_id: actor?.actor_id ?? null,
          actor_scope: actor?.actor_scope ?? 'platform',
          action: 'WALLET_CLOSED',
          service_code: 'DIGITAL_WALLET',
          target_type: 'wallet_account',
          target_id: id,
          before_state: { status: existing.status },
          after_state: { status: updated.status }
        }).catch(() => {})
      }

      return updated
    },

    async debit(input: DebitWalletInput): Promise<WalletMutationResult> {
      const result = await walletRepo.executeMutation({
        wallet_id: input.wallet_id,
        transaction_type: input.transaction_type ?? 'DEBIT',
        entry_type: 'DEBIT',
        amount: input.amount,
        currency: input.currency,
        reference_type: input.reference_type,
        reference_id: input.reference_id,
        idempotency_key: input.idempotency_key,
        actor_id: input.actor_id,
        actor_scope: input.actor_scope,
        description: input.description,
        metadata: input.metadata
      })

      // Record audit only for new mutations
      if (auditService && !result.already_processed) {
        await auditService.recordAudit({
          actor_id: input.actor_id ?? null,
          actor_scope: input.actor_scope === 'customer' ? 'tenant' : input.actor_scope,
          action: 'WALLET_DEBITED',
          service_code: 'DIGITAL_WALLET',
          target_type: 'wallet_account',
          target_id: input.wallet_id,
          before_state: { balance: result.ledger.balance_before },
          after_state: { balance: result.ledger.balance_after },
          metadata: {
            ledger_id: result.ledger.id,
            amount: input.amount,
            reference_type: input.reference_type,
            reference_id: input.reference_id,
            idempotency_key: input.idempotency_key
          }
        }).catch(() => {})
      }

      return result
    },

    async credit(input: CreditWalletInput): Promise<WalletMutationResult> {
      const result = await walletRepo.executeMutation({
        wallet_id: input.wallet_id,
        transaction_type: input.transaction_type ?? 'CREDIT',
        entry_type: 'CREDIT',
        amount: input.amount,
        currency: input.currency,
        reference_type: input.reference_type,
        reference_id: input.reference_id,
        idempotency_key: input.idempotency_key,
        actor_id: input.actor_id,
        actor_scope: input.actor_scope,
        description: input.description,
        metadata: input.metadata
      })

      // Record audit only for new mutations
      if (auditService && !result.already_processed) {
        await auditService.recordAudit({
          actor_id: input.actor_id ?? null,
          actor_scope: input.actor_scope === 'customer' ? 'tenant' : input.actor_scope,
          action: 'WALLET_CREDITED',
          service_code: 'DIGITAL_WALLET',
          target_type: 'wallet_account',
          target_id: input.wallet_id,
          before_state: { balance: result.ledger.balance_before },
          after_state: { balance: result.ledger.balance_after },
          metadata: {
            ledger_id: result.ledger.id,
            amount: input.amount,
            reference_type: input.reference_type,
            reference_id: input.reference_id,
            idempotency_key: input.idempotency_key
          }
        }).catch(() => {})
      }

      return result
    },

    async listLedgers(filter: WalletLedgerQueryFilter): Promise<{ items: WalletLedgerDto[]; total: number }> {
      return walletRepo.listLedgers(filter)
    }
  }
}
