import { Pool, PoolClient } from 'pg'
import {
  WalletAccountDto,
  WalletLedgerDto,
  WalletAccountStatus,
  WalletMutationInput,
  WalletMutationResult,
  WalletQueryFilter,
  WalletLedgerQueryFilter
} from '../dto/wallet_dto'
import { ApiError } from '../errors/api_error'

function mapRowToAccountDto(row: Record<string, unknown>): WalletAccountDto {
  return {
    id: row.id as string,
    account_customer_id: row.account_customer_id as string,
    business_id: (row.business_id as string) ?? null,
    wallet_number: row.wallet_number as string,
    currency: row.currency as string,
    status: row.status as WalletAccountStatus,
    balance: Number(row.balance),
    pending_credit: Number(row.pending_credit),
    pending_debit: Number(row.pending_debit),
    server_version: Number(row.server_version),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: typeof row.created_at === 'string' ? row.created_at : (row.created_at as Date).toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : (row.updated_at as Date).toISOString()
  }
}

function mapRowToLedgerDto(row: Record<string, unknown>): WalletLedgerDto {
  return {
    id: row.id as string,
    wallet_id: row.wallet_id as string,
    transaction_type: row.transaction_type as WalletMutationInput['transaction_type'],
    entry_type: row.entry_type as WalletMutationInput['entry_type'],
    amount: Number(row.amount),
    balance_before: Number(row.balance_before),
    balance_after: Number(row.balance_after),
    currency: row.currency as string,
    reference_type: row.reference_type as string,
    reference_id: row.reference_id as string,
    idempotency_key: row.idempotency_key as string,
    actor_id: (row.actor_id as string) ?? null,
    actor_scope: row.actor_scope as WalletMutationInput['actor_scope'],
    description: row.description as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: typeof row.created_at === 'string' ? row.created_at : (row.created_at as Date).toISOString()
  }
}

export function createWalletRepository(pool: Pool) {
  return {
    async createAccount(
      data: {
        accountCustomerId: string
        businessId?: string | null
        walletNumber: string
        currency?: string
        metadata?: Record<string, unknown>
      },
      client?: PoolClient
    ): Promise<WalletAccountDto> {
      const db = client ?? pool
      const query = `
        INSERT INTO wallet_accounts (
          account_customer_id, business_id, wallet_number, currency, metadata
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `
      const values = [
        data.accountCustomerId,
        data.businessId ?? null,
        data.walletNumber,
        data.currency ?? 'IDR',
        JSON.stringify(data.metadata ?? {})
      ]

      const res = await db.query(query, values)
      return mapRowToAccountDto(res.rows[0])
    },

    async getAccountById(id: string, client?: PoolClient): Promise<WalletAccountDto | null> {
      const db = client ?? pool
      const query = `SELECT * FROM wallet_accounts WHERE id = $1`
      const res = await db.query(query, [id])
      if (res.rows.length === 0) return null
      return mapRowToAccountDto(res.rows[0])
    },

    async getAccountByCustomerAndCurrency(
      accountCustomerId: string,
      currency = 'IDR',
      client?: PoolClient
    ): Promise<WalletAccountDto | null> {
      const db = client ?? pool
      const query = `
        SELECT * FROM wallet_accounts
        WHERE account_customer_id = $1 AND currency = $2
      `
      const res = await db.query(query, [accountCustomerId, currency])
      if (res.rows.length === 0) return null
      return mapRowToAccountDto(res.rows[0])
    },

    async listAccounts(filter: WalletQueryFilter, client?: PoolClient): Promise<{ items: WalletAccountDto[]; total: number }> {
      const db = client ?? pool
      const conditions: string[] = []
      const values: unknown[] = []
      let idx = 1

      if (filter.account_customer_id) {
        conditions.push(`account_customer_id = $${idx++}`)
        values.push(filter.account_customer_id)
      }
      if (filter.business_id) {
        conditions.push(`business_id = $${idx++}`)
        values.push(filter.business_id)
      }
      if (filter.status) {
        conditions.push(`status = $${idx++}`)
        values.push(filter.status)
      }
      if (filter.currency) {
        conditions.push(`currency = $${idx++}`)
        values.push(filter.currency)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const countRes = await db.query(`SELECT COUNT(*) AS total FROM wallet_accounts ${whereClause}`, values)
      const total = Number(countRes.rows[0].total)

      const limit = filter.limit ?? 50
      const offset = filter.offset ?? 0
      values.push(limit, offset)

      const query = `
        SELECT * FROM wallet_accounts
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `
      const res = await db.query(query, values)
      return {
        items: res.rows.map(mapRowToAccountDto),
        total
      }
    },

    async updateAccountStatus(id: string, status: WalletAccountStatus, client?: PoolClient): Promise<WalletAccountDto | null> {
      const db = client ?? pool
      const query = `
        UPDATE wallet_accounts
        SET status = $1, server_version = server_version + 1, updated_at = now()
        WHERE id = $2
        RETURNING *
      `
      const res = await db.query(query, [status, id])
      if (res.rows.length === 0) return null
      return mapRowToAccountDto(res.rows[0])
    },

    /**
     * Executes an atomic debit or credit mutation against a wallet.
     * Uses row-level pessimistic locking (`FOR UPDATE`) to serialize balance mutations.
     * Enforces idempotency via `wallet_ledgers.idempotency_key`.
     */
    async executeMutation(input: WalletMutationInput): Promise<WalletMutationResult> {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // 1. Check idempotency key first
        const existingLedgerRes = await client.query(
          `SELECT * FROM wallet_ledgers WHERE idempotency_key = $1`,
          [input.idempotency_key]
        )

        if (existingLedgerRes.rows.length > 0) {
          const existingLedger = existingLedgerRes.rows[0]

          // Compare idempotency payload for exact match
          const matches =
            existingLedger.wallet_id === input.wallet_id &&
            BigInt(existingLedger.amount) === BigInt(input.amount) &&
            existingLedger.entry_type === input.entry_type &&
            existingLedger.transaction_type === input.transaction_type &&
            existingLedger.currency === (input.currency ?? 'IDR') &&
            existingLedger.reference_type === input.reference_type &&
            existingLedger.reference_id === input.reference_id

          if (!matches) {
            await client.query('ROLLBACK')
            throw new ApiError(
              409,
              'IDEMPOTENCY_PAYLOAD_MISMATCH',
              'Idempotency key has already been used with a different mutation payload'
            )
          }

          // Fetch current wallet account state
          const accountRes = await client.query(`SELECT * FROM wallet_accounts WHERE id = $1`, [input.wallet_id])
          await client.query('COMMIT')
          return {
            account: mapRowToAccountDto(accountRes.rows[0]),
            ledger: mapRowToLedgerDto(existingLedger),
            already_processed: true
          }
        }

        // 2. Lock target wallet row (Pessimistic concurrency lock)
        const accountRes = await client.query(
          `SELECT * FROM wallet_accounts WHERE id = $1 FOR UPDATE`,
          [input.wallet_id]
        )

        if (accountRes.rows.length === 0) {
          await client.query('ROLLBACK')
          throw new ApiError(404, 'WALLET_NOT_FOUND', 'Wallet account not found')
        }

        const accountRow = accountRes.rows[0]
        const status = accountRow.status as WalletAccountStatus
        const currency = accountRow.currency as string
        const currentBalance = BigInt(accountRow.balance)
        const mutationAmount = BigInt(input.amount)

        // 3. Validate lifecycle state
        if (status === 'CLOSED') {
          await client.query('ROLLBACK')
          throw new ApiError(400, 'WALLET_CLOSED', 'Wallet account is closed; operations are blocked')
        }

        if (status === 'PENDING') {
          await client.query('ROLLBACK')
          throw new ApiError(400, 'WALLET_NOT_ACTIVE', 'Wallet account is pending activation')
        }

        if (status === 'FROZEN' && input.entry_type === 'DEBIT') {
          await client.query('ROLLBACK')
          throw new ApiError(400, 'WALLET_FROZEN', 'Wallet account is frozen; debits are blocked')
        }

        if (status !== 'ACTIVE' && status !== 'FROZEN') {
          await client.query('ROLLBACK')
          throw new ApiError(400, 'WALLET_NOT_ACTIVE', `Wallet account is not active (current: ${status})`)
        }

        // 4. Validate currency
        if (input.currency && input.currency !== currency) {
          await client.query('ROLLBACK')
          throw new ApiError(
            400,
            'CURRENCY_MISMATCH',
            `Mutation currency ${input.currency} does not match wallet currency ${currency}`
          )
        }

        // 5. Validate amount > 0
        if (mutationAmount <= 0n) {
          await client.query('ROLLBACK')
          throw new ApiError(400, 'INVALID_AMOUNT', 'Mutation amount must be strictly greater than zero')
        }

        // 6. Validate balance for DEBIT
        if (input.entry_type === 'DEBIT' && currentBalance < mutationAmount) {
          await client.query('ROLLBACK')
          throw new ApiError(
            400,
            'INSUFFICIENT_FUNDS',
            `Insufficient wallet balance (${currentBalance}) for debit of ${mutationAmount}`
          )
        }

        // 7. Calculate new balance
        const balanceAfter =
          input.entry_type === 'CREDIT'
            ? currentBalance + mutationAmount
            : currentBalance - mutationAmount

        // 8. Update wallet balance and server version
        const updatedAccountRes = await client.query(
          `UPDATE wallet_accounts
           SET balance = $1, server_version = server_version + 1, updated_at = now()
           WHERE id = $2
           RETURNING *`,
          [balanceAfter.toString(), input.wallet_id]
        )

        // 9. Append immutable ledger row
        let ledgerRes
        try {
          ledgerRes = await client.query(
            `INSERT INTO wallet_ledgers (
               wallet_id, transaction_type, entry_type, amount, balance_before, balance_after,
               currency, reference_type, reference_id, idempotency_key, actor_id, actor_scope,
               description, metadata
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
             )
             RETURNING *`,
            [
              input.wallet_id,
              input.transaction_type,
              input.entry_type,
              mutationAmount.toString(),
              currentBalance.toString(),
              balanceAfter.toString(),
              currency,
              input.reference_type,
              input.reference_id,
              input.idempotency_key,
              input.actor_id ?? null,
              input.actor_scope,
              input.description,
              JSON.stringify(input.metadata ?? {})
            ]
          )
        } catch (insertErr: any) {
          if (insertErr.code === '23505' && (insertErr.constraint?.includes('idempotency') || insertErr.message?.includes('idempotency'))) {
            await client.query('ROLLBACK')
            const recheckLedger = await pool.query(
              `SELECT * FROM wallet_ledgers WHERE idempotency_key = $1`,
              [input.idempotency_key]
            )
            if (recheckLedger.rows.length > 0) {
              const existingLedger = recheckLedger.rows[0]
              const matches =
                existingLedger.wallet_id === input.wallet_id &&
                BigInt(existingLedger.amount) === BigInt(input.amount) &&
                existingLedger.entry_type === input.entry_type &&
                existingLedger.transaction_type === input.transaction_type &&
                existingLedger.currency === (input.currency ?? 'IDR') &&
                existingLedger.reference_type === input.reference_type &&
                existingLedger.reference_id === input.reference_id

              if (!matches) {
                throw new ApiError(
                  409,
                  'IDEMPOTENCY_PAYLOAD_MISMATCH',
                  'Idempotency key has already been used with a different mutation payload'
                )
              }

              const accountRes = await pool.query(`SELECT * FROM wallet_accounts WHERE id = $1`, [input.wallet_id])
              return {
                account: mapRowToAccountDto(accountRes.rows[0]),
                ledger: mapRowToLedgerDto(existingLedger),
                already_processed: true
              }
            }
          }
          throw insertErr
        }

        await client.query('COMMIT')

        return {
          account: mapRowToAccountDto(updatedAccountRes.rows[0]),
          ledger: mapRowToLedgerDto(ledgerRes.rows[0]),
          already_processed: false
        }
      } catch (err) {
        try {
          await client.query('ROLLBACK')
        } catch (_) {
          // Ignore rollback errors on already closed/failed client
        }
        throw err
      } finally {
        client.release()
      }
    },

    async listLedgers(filter: WalletLedgerQueryFilter, client?: PoolClient): Promise<{ items: WalletLedgerDto[]; total: number }> {
      const db = client ?? pool
      const conditions: string[] = ['wallet_id = $1']
      const values: unknown[] = [filter.wallet_id]
      let idx = 2

      if (filter.transaction_type) {
        conditions.push(`transaction_type = $${idx++}`)
        values.push(filter.transaction_type)
      }
      if (filter.entry_type) {
        conditions.push(`entry_type = $${idx++}`)
        values.push(filter.entry_type)
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`

      const countRes = await db.query(`SELECT COUNT(*) AS total FROM wallet_ledgers ${whereClause}`, values)
      const total = Number(countRes.rows[0].total)

      const limit = filter.limit ?? 50
      const offset = filter.offset ?? 0
      values.push(limit, offset)

      const query = `
        SELECT * FROM wallet_ledgers
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `
      const res = await db.query(query, values)
      return {
        items: res.rows.map(mapRowToLedgerDto),
        total
      }
    }
  }
}
