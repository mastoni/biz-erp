import { randomUUID } from 'crypto'
import { Pool, PoolClient } from 'pg'
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

    async ensureTenantWallet(
      businessId: string,
      actorContext?: { actor_id?: string | null; actor_scope?: 'platform' | 'tenant' | 'system' }
    ): Promise<WalletAccountDto> {
      // 1. Verify business exists and is active
      const bizRes = await pool.query(
        `SELECT id, name, account_customer_id, status FROM businesses WHERE id = $1`,
        [businessId]
      )
      if (bizRes.rows.length === 0 || bizRes.rows[0].status !== 'ACTIVE') {
        throw new ApiError(400, 'INVALID_BUSINESS', 'Business not found or not active')
      }
      const biz = bizRes.rows[0]

      let accountCustomerId = biz.account_customer_id
      if (!accountCustomerId) {
        // Find existing account_customer by business code or name, or create one
        const acCode = `ACC-BIZ-${businessId.substring(0, 8)}`
        const acRes = await pool.query(
          `SELECT id FROM account_customers WHERE code = $1 LIMIT 1`,
          [acCode]
        )
        if (acRes.rows.length > 0) {
          accountCustomerId = acRes.rows[0].id
        } else {
          const newAcId = randomUUID()
          await pool.query(
            `INSERT INTO account_customers (id, code, name, account_type, status, created_at, updated_at)
             VALUES ($1, $2, $3, 'BUSINESS', 'ACTIVE', now(), now())`,
            [newAcId, acCode, biz.name || 'Tenant Account']
          )
          accountCustomerId = newAcId
        }

        await pool.query(
          `UPDATE businesses SET account_customer_id = $1, updated_at = now() WHERE id = $2`,
          [accountCustomerId, businessId]
        )
      }

      // 2. Check if wallet already exists for this business or account customer (IDR)
      const existing = await walletRepo.getAccountByCustomerAndCurrency(accountCustomerId, 'IDR')
      if (existing) {
        // Ensure business_id is linked if it was not already populated
        if (!existing.business_id) {
          await pool.query(
            `UPDATE wallet_accounts SET business_id = $1, updated_at = now() WHERE id = $2`,
            [businessId, existing.id]
          )
          existing.business_id = businessId
        }
        return existing
      }

      // 3. Create wallet atomically with race-safety handling
      try {
        const walletNumber = generateWalletNumber()
        const account = await walletRepo.createAccount({
          accountCustomerId,
          businessId,
          walletNumber,
          currency: 'IDR',
          metadata: {
            auto_initialized: true,
            initialized_at: new Date().toISOString()
          }
        })

        if (auditService) {
          await auditService.recordAudit({
            actor_id: actorContext?.actor_id ?? null,
            actor_scope: actorContext?.actor_scope ?? 'system',
            action: 'WALLET_ACCOUNT_CREATED',
            service_code: 'DIGITAL_WALLET',
            target_type: 'wallet_account',
            target_id: account.id,
            after_state: {
              wallet_id: account.id,
              wallet_number: account.wallet_number,
              account_customer_id: account.account_customer_id,
              business_id: account.business_id,
              currency: account.currency,
              balance: account.balance
            },
            metadata: {
              wallet_number: account.wallet_number,
              currency: account.currency,
              auto_initialized: true
            }
          }).catch(() => {})
        }

        return account
      } catch (err: any) {
        // Handle race condition on unique constraint uq_account_customer_currency
        if (err.code === '23505') {
          const recheck = await walletRepo.getAccountByCustomerAndCurrency(accountCustomerId, 'IDR')
          if (recheck) return recheck
        }
        throw err
      }
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

    async debit(input: DebitWalletInput, client?: PoolClient): Promise<WalletMutationResult> {
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
      }, client)

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

    async credit(input: CreditWalletInput, client?: PoolClient): Promise<WalletMutationResult> {
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
      }, client)

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
