import { Router, Request, Response, NextFunction } from 'express'
import { Pool } from 'pg'
import { createJwtService, AccessTokenClaims } from '../services/jwt_service'
import { createWalletService } from '../services/wallet_service'
import { createTopUpIntentService } from '../services/top_up_intent_service'
import { createAuditService } from '../services/audit_service'
import {
  WalletAccountDto,
  WalletQueryFilter,
  WalletLedgerQueryFilter,
  WalletActorScope
} from '../dto/wallet_dto'
import { isUuid } from '../utils/uuid'
import { asyncHandler } from '../utils/async_handler'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'

export interface WalletAuthenticatedRequest extends Request {
  claims?: AccessTokenClaims
}

export function createWalletRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
  const jwtIssuer = process.env.JWT_ISSUER || 'biz-erp-api'
  const jwtAudience = process.env.JWT_AUDIENCE || 'biz-erp-client'
  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)

  const auditService = createAuditService(pool)
  const walletService = createWalletService(pool, auditService)
  const topUpService = createTopUpIntentService(pool, auditService)

  // ---------------------------------------------------------------------------
  // Authentication Middleware
  // ---------------------------------------------------------------------------
  const authenticate = (req: WalletAuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization']
    if (!authHeader || typeof authHeader !== 'string') {
      next(new ApiError(401, 'UNAUTHORIZED', 'Missing Authorization header'))
      return
    }

    if (!authHeader.startsWith('Bearer ')) {
      next(new ApiError(401, 'INVALID_TOKEN', 'Unsupported auth scheme'))
      return
    }

    const token = authHeader.substring(7)
    try {
      const claims = jwtService.verifyAccessToken(token)
      req.claims = claims

      // Immediately reject STAFF and CASHIER from all wallet endpoints
      if (claims.scope === 'tenant' && (claims.role === 'STAFF' || claims.role === 'CASHIER')) {
        next(new ApiError(403, 'INSUFFICIENT_PERMISSIONS', 'Staff and Cashier roles are not authorized for digital wallet operations'))
        return
      }

      next()
    } catch (err: any) {
      if (err instanceof ApiError) {
        next(err)
      } else {
        next(new ApiError(401, 'INVALID_TOKEN', 'Access token is invalid or malformed'))
      }
    }
  }

  router.use(authenticate as any)

  // ---------------------------------------------------------------------------
  // Helper: Verify Wallet Ownership & Isolation
  // ---------------------------------------------------------------------------
  async function verifyWalletAccess(
    walletId: string,
    claims: AccessTokenClaims
  ): Promise<WalletAccountDto> {
    if (!isUuid(walletId)) {
      throw new ValidationError('Wallet ID must be a valid UUID')
    }

    const wallet = await walletService.getAccountById(walletId)

    // Platform Super Admin / Platform Admin has universal platform scope
    if (claims.scope === 'platform' && (claims.role === 'SUPER_ADMIN' || claims.role === 'PLATFORM_ADMIN')) {
      return wallet
    }

    // Tenant OWNER scope: must match business_id or tenant-linked account_customer
    if (claims.scope === 'tenant' && claims.role === 'OWNER') {
      if (wallet.business_id && wallet.business_id === claims.business_id) {
        return wallet
      }

      if (claims.business_id) {
        const linkRes = await pool.query(
          `SELECT 1 FROM businesses WHERE id = $1 AND account_customer_id = $2`,
          [claims.business_id, wallet.account_customer_id]
        )
        if (linkRes.rows.length > 0) {
          return wallet
        }
      }

      // Hide existence across tenant boundaries
      throw new ApiError(404, 'WALLET_NOT_FOUND', 'Wallet account not found')
    }

    // Customer scope: user must belong to account_customer
    if (claims.role === ('CUSTOMER' as any)) {
      const userRes = await pool.query(
        `SELECT 1 FROM account_customer_users
         WHERE account_customer_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
        [wallet.account_customer_id, claims.sub]
      )
      if (userRes.rows.length > 0 || (claims as any).account_customer_id === wallet.account_customer_id) {
        return wallet
      }
      throw new ApiError(404, 'WALLET_NOT_FOUND', 'Wallet account not found')
    }

    throw new ApiError(403, 'INSUFFICIENT_PERMISSIONS', 'Insufficient permissions to access this wallet')
  }

  // ===========================================================================
  // 1. GET /v1/wallets — List wallets permitted by caller scope
  // ===========================================================================
  router.get(
    '/',
    asyncHandler<WalletAuthenticatedRequest>(async (req, res) => {
      const claims = req.claims!
      const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200)
      const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0)
      const status = req.query.status as any
      const currency = typeof req.query.currency === 'string' ? req.query.currency.trim() : undefined

      // Platform Scope (SUPER_ADMIN)
      if (claims.scope === 'platform' && (claims.role === 'SUPER_ADMIN' || claims.role === 'PLATFORM_ADMIN')) {
        const filter: WalletQueryFilter = {
          account_customer_id: typeof req.query.account_customer_id === 'string' ? req.query.account_customer_id.trim() : undefined,
          business_id: typeof req.query.business_id === 'string' ? req.query.business_id.trim() : undefined,
          status,
          currency,
          limit,
          offset
        }
        const result = await walletService.listAccounts(filter)
        res.status(200).json({
          items: result.items,
          total: result.total,
          limit,
          offset,
          has_more: offset + result.items.length < result.total
        })
        return
      }

      // Tenant Scope (OWNER) — strictly bound to caller's businessId
      if (claims.scope === 'tenant' && claims.role === 'OWNER') {
        const filter: WalletQueryFilter = {
          business_id: claims.business_id,
          status,
          currency,
          limit,
          offset
        }
        const result = await walletService.listAccounts(filter)
        res.status(200).json({
          items: result.items,
          total: result.total,
          limit,
          offset,
          has_more: offset + result.items.length < result.total
        })
        return
      }

      // Customer Scope (CUSTOMER)
      if (claims.role === ('CUSTOMER' as any)) {
        const custRes = await pool.query(
          `SELECT account_customer_id FROM account_customer_users WHERE user_id = $1 AND status = 'ACTIVE'`,
          [claims.sub]
        )
        const customerIds = custRes.rows.map((r: any) => r.account_customer_id)
        if ((claims as any).account_customer_id) {
          customerIds.push((claims as any).account_customer_id)
        }

        if (customerIds.length === 0) {
          res.status(200).json({ items: [], total: 0, limit, offset, has_more: false })
          return
        }

        const filter: WalletQueryFilter = {
          account_customer_id: customerIds[0],
          status,
          currency,
          limit,
          offset
        }
        const result = await walletService.listAccounts(filter)
        res.status(200).json({
          items: result.items,
          total: result.total,
          limit,
          offset,
          has_more: offset + result.items.length < result.total
        })
        return
      }

      throw new ApiError(403, 'INSUFFICIENT_PERMISSIONS', 'Insufficient permissions')
    })
  )

  // ===========================================================================
  // 2. GET /v1/wallets/:id — Retrieve single wallet within caller scope
  // ===========================================================================
  router.get(
    '/:id',
    asyncHandler<WalletAuthenticatedRequest>(async (req, res) => {
      const claims = req.claims!
      const wallet = await verifyWalletAccess(req.params.id, claims)
      res.status(200).json(wallet)
    })
  )

  // ===========================================================================
  // 3. GET /v1/wallets/:id/ledger — Read-only ledger transactions
  // ===========================================================================
  router.get(
    '/:id/ledger',
    asyncHandler<WalletAuthenticatedRequest>(async (req, res) => {
      const claims = req.claims!
      const wallet = await verifyWalletAccess(req.params.id, claims)

      const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200)
      const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0)
      const transactionType = req.query.transaction_type as any
      const entryType = req.query.entry_type as any

      const filter: WalletLedgerQueryFilter = {
        wallet_id: wallet.id,
        transaction_type: transactionType,
        entry_type: entryType,
        limit,
        offset
      }

      const result = await walletService.listLedgers(filter)
      res.status(200).json({
        items: result.items,
        total: result.total,
        limit,
        offset,
        has_more: offset + result.items.length < result.total
      })
    })
  )

  // ===========================================================================
  // 4. POST /v1/wallets — Create new wallet account (SUPER_ADMIN only)
  // ===========================================================================
  router.post(
    '/',
    asyncHandler<WalletAuthenticatedRequest>(async (req, res) => {
      const claims = req.claims!

      if (claims.scope !== 'platform' || (claims.role !== 'SUPER_ADMIN' && claims.role !== 'PLATFORM_ADMIN')) {
        throw new ApiError(403, 'FORBIDDEN', 'Only platform super administrators can create wallet accounts')
      }

      const body = req.body ?? {}
      if (!body.account_customer_id || typeof body.account_customer_id !== 'string' || !isUuid(body.account_customer_id)) {
        throw new ValidationError('account_customer_id is required and must be a valid UUID')
      }

      if (body.business_id && (!isUuid(body.business_id) || typeof body.business_id !== 'string')) {
        throw new ValidationError('business_id must be a valid UUID')
      }

      const account = await walletService.createAccount({
        account_customer_id: body.account_customer_id.trim(),
        business_id: body.business_id ? body.business_id.trim() : null,
        currency: body.currency ? String(body.currency).trim().toUpperCase() : 'IDR',
        metadata: typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : undefined,
        actor_id: claims.sub,
        actor_scope: 'platform'
      })

      res.status(201).json(account)
    })
  )

  // ===========================================================================
  // 5. POST /v1/wallets/:id/topup-intents — Create Top-up Intent
  // ===========================================================================
  router.post(
    '/:id/topup-intents',
    asyncHandler<WalletAuthenticatedRequest>(async (req, res) => {
      const claims = req.claims!
      const wallet = await verifyWalletAccess(req.params.id, claims)

      const body = req.body ?? {}
      const amount = Number(body.amount)
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new ValidationError('amount must be a positive integer in minor units')
      }

      const feeAmount = body.fee_amount !== undefined ? Number(body.fee_amount) : 0
      if (!Number.isInteger(feeAmount) || feeAmount < 0) {
        throw new ValidationError('fee_amount must be a non-negative integer in minor units')
      }

      const actorScope: WalletActorScope = claims.scope === 'platform' ? 'platform' : (claims.role === ('CUSTOMER' as any) ? 'customer' : 'tenant')

      const intent = await topUpService.createIntent({
        wallet_id: wallet.id,
        account_customer_id: wallet.account_customer_id,
        amount,
        fee_amount: feeAmount,
        currency: body.currency ? String(body.currency).trim().toUpperCase() : wallet.currency,
        payment_method: body.payment_method ? String(body.payment_method).trim() : undefined,
        expires_in_hours: body.expires_in_hours ? Number(body.expires_in_hours) : undefined,
        metadata: typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : undefined,
        actor_id: claims.sub,
        actor_scope: actorScope
      })

      res.status(201).json(intent)
    })
  )

  // ===========================================================================
  // 6. POST /v1/wallets/:id/debit — Debit Wallet
  // ===========================================================================
  router.post(
    '/:id/debit',
    asyncHandler<WalletAuthenticatedRequest>(async (req, res) => {
      const claims = req.claims!
      const wallet = await verifyWalletAccess(req.params.id, claims)

      const body = req.body ?? {}
      const amount = Number(body.amount)
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new ValidationError('amount must be a positive integer in minor units')
      }

      if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
        throw new ValidationError('reason is required')
      }

      if (!body.idempotency_key || typeof body.idempotency_key !== 'string' || body.idempotency_key.trim().length === 0) {
        throw new ValidationError('idempotency_key is required')
      }

      const actorScope: WalletActorScope = claims.scope === 'platform' ? 'platform' : (claims.role === ('CUSTOMER' as any) ? 'customer' : 'tenant')
      const transactionType = body.transaction_type ? String(body.transaction_type).trim().toUpperCase() as any : 'DEBIT'
      const referenceId = body.reference_id ? String(body.reference_id).trim() : body.idempotency_key.trim()
      const referenceType = body.reference_type ? String(body.reference_type).trim() : 'PAYMENT'

      const result = await walletService.debit({
        wallet_id: wallet.id,
        amount,
        transaction_type: transactionType,
        currency: body.currency ? String(body.currency).trim().toUpperCase() : wallet.currency,
        reference_type: referenceType,
        reference_id: referenceId,
        idempotency_key: body.idempotency_key.trim(),
        actor_id: claims.sub,
        actor_scope: actorScope,
        description: body.reason.trim(),
        metadata: typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : undefined
      })

      res.status(200).json(result)
    })
  )

  // ===========================================================================
  // 7. POST /v1/wallets/:id/credit — Direct Credit (SUPER_ADMIN only)
  // ===========================================================================
  router.post(
    '/:id/credit',
    asyncHandler<WalletAuthenticatedRequest>(async (req, res) => {
      const claims = req.claims!

      if (claims.scope !== 'platform' || (claims.role !== 'SUPER_ADMIN' && claims.role !== 'PLATFORM_ADMIN')) {
        throw new ApiError(403, 'FORBIDDEN', 'Only platform super administrators can directly credit wallets')
      }

      if (!isUuid(req.params.id)) {
        throw new ValidationError('Wallet ID must be a valid UUID')
      }

      const wallet = await walletService.getAccountById(req.params.id)

      const body = req.body ?? {}
      const amount = Number(body.amount)
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new ValidationError('amount must be a positive integer in minor units')
      }

      if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
        throw new ValidationError('reason is required')
      }

      if (!body.idempotency_key || typeof body.idempotency_key !== 'string' || body.idempotency_key.trim().length === 0) {
        throw new ValidationError('idempotency_key is required')
      }

      const transactionType = body.transaction_type ? String(body.transaction_type).trim().toUpperCase() as any : 'CREDIT'
      const referenceId = body.reference_id ? String(body.reference_id).trim() : body.idempotency_key.trim()
      const referenceType = body.reference_type ? String(body.reference_type).trim() : 'DIRECT_CREDIT'

      const result = await walletService.credit({
        wallet_id: wallet.id,
        amount,
        transaction_type: transactionType,
        currency: body.currency ? String(body.currency).trim().toUpperCase() : wallet.currency,
        reference_type: referenceType,
        reference_id: referenceId,
        idempotency_key: body.idempotency_key.trim(),
        actor_id: claims.sub,
        actor_scope: 'platform',
        description: body.reason.trim(),
        metadata: typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : undefined
      })

      res.status(200).json(result)
    })
  )

  // ===========================================================================
  // 8. POST /v1/wallets/:id/freeze — Freeze Wallet (SUPER_ADMIN only)
  // ===========================================================================
  router.post(
    '/:id/freeze',
    asyncHandler<WalletAuthenticatedRequest>(async (req, res) => {
      const claims = req.claims!

      if (claims.scope !== 'platform' || (claims.role !== 'SUPER_ADMIN' && claims.role !== 'PLATFORM_ADMIN')) {
        throw new ApiError(403, 'FORBIDDEN', 'Only platform super administrators can freeze wallets')
      }

      if (!isUuid(req.params.id)) {
        throw new ValidationError('Wallet ID must be a valid UUID')
      }

      const body = req.body ?? {}
      if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
        throw new ValidationError('reason is required')
      }

      const updated = await walletService.freezeAccount(req.params.id, {
        actor_id: claims.sub,
        actor_scope: 'platform'
      })

      res.status(200).json(updated)
    })
  )

  // ===========================================================================
  // 9. POST /v1/wallets/:id/unfreeze — Unfreeze Wallet (SUPER_ADMIN only)
  // ===========================================================================
  router.post(
    '/:id/unfreeze',
    asyncHandler<WalletAuthenticatedRequest>(async (req, res) => {
      const claims = req.claims!

      if (claims.scope !== 'platform' || (claims.role !== 'SUPER_ADMIN' && claims.role !== 'PLATFORM_ADMIN')) {
        throw new ApiError(403, 'FORBIDDEN', 'Only platform super administrators can unfreeze wallets')
      }

      if (!isUuid(req.params.id)) {
        throw new ValidationError('Wallet ID must be a valid UUID')
      }

      const updated = await walletService.unfreezeAccount(req.params.id, {
        actor_id: claims.sub,
        actor_scope: 'platform'
      })

      res.status(200).json(updated)
    })
  )

  // ===========================================================================
  // 10. POST /v1/wallets/:id/reverse — Reverse Transaction (SUPER_ADMIN only)
  // ===========================================================================
  router.post(
    '/:id/reverse',
    asyncHandler<WalletAuthenticatedRequest>(async (req, res) => {
      const claims = req.claims!

      if (claims.scope !== 'platform' || (claims.role !== 'SUPER_ADMIN' && claims.role !== 'PLATFORM_ADMIN')) {
        throw new ApiError(403, 'FORBIDDEN', 'Only platform super administrators can reverse wallet transactions')
      }

      if (!isUuid(req.params.id)) {
        throw new ValidationError('Wallet ID must be a valid UUID')
      }

      const wallet = await walletService.getAccountById(req.params.id)

      const body = req.body ?? {}
      if (!body.ledger_entry_id || typeof body.ledger_entry_id !== 'string' || !isUuid(body.ledger_entry_id)) {
        throw new ValidationError('ledger_entry_id is required and must be a valid UUID')
      }

      if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
        throw new ValidationError('reason is required')
      }

      if (!body.idempotency_key || typeof body.idempotency_key !== 'string' || body.idempotency_key.trim().length === 0) {
        throw new ValidationError('idempotency_key is required')
      }

      // 1. Resolve original ledger entry
      const ledgerRes = await pool.query(
        `SELECT * FROM wallet_ledgers WHERE id = $1 AND wallet_id = $2`,
        [body.ledger_entry_id.trim(), wallet.id]
      )

      if (ledgerRes.rows.length === 0) {
        throw new ApiError(404, 'LEDGER_ENTRY_NOT_FOUND', 'Target ledger entry not found on this wallet')
      }

      const orig = ledgerRes.rows[0]
      const origEntryType = orig.entry_type
      const origAmount = Number(orig.amount)

      // 2. Perform compensating mutation
      let result
      if (origEntryType === 'DEBIT') {
        // Reverse a debit by crediting back
        result = await walletService.credit({
          wallet_id: wallet.id,
          amount: origAmount,
          transaction_type: 'REVERSAL',
          currency: orig.currency,
          reference_type: 'REVERSAL',
          reference_id: orig.id,
          idempotency_key: body.idempotency_key.trim(),
          actor_id: claims.sub,
          actor_scope: 'platform',
          description: `Reversal of debit ${orig.id}: ${body.reason.trim()}`,
          metadata: {
            original_ledger_id: orig.id,
            reason: body.reason.trim()
          }
        })
      } else {
        // Reverse a credit by debiting back
        result = await walletService.debit({
          wallet_id: wallet.id,
          amount: origAmount,
          transaction_type: 'REVERSAL',
          currency: orig.currency,
          reference_type: 'REVERSAL',
          reference_id: orig.id,
          idempotency_key: body.idempotency_key.trim(),
          actor_id: claims.sub,
          actor_scope: 'platform',
          description: `Reversal of credit ${orig.id}: ${body.reason.trim()}`,
          metadata: {
            original_ledger_id: orig.id,
            reason: body.reason.trim()
          }
        })
      }

      res.status(200).json(result)
    })
  )

  return router
}
