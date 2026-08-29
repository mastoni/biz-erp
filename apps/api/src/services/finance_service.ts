import { Pool } from 'pg'
import { saleRepository } from '../repositories/sale_repository'
import { purchaseRepository } from '../repositories/purchase_repository'
import { inventoryRepository } from '../repositories/inventory_repository'
import { idempotencyRepository } from '../repositories/idempotency_repository'
import { accountRepository } from '../repositories/account_repository'
import { journalRepository } from '../repositories/journal_repository'
import { expenseRepository } from '../repositories/expense_repository'
import { incomeRepository } from '../repositories/income_repository'
import { withTransaction } from '../db/transaction'
import { ApiError } from '../errors/api_error'
import { ConflictError } from '../errors/conflict_error'
import { randomUUID } from 'crypto'

export function createFinanceService(pool: Pool) {
  return {
    async listAccounts(businessId: string) {
      return withTransaction(pool, async (client) => {
        return accountRepository.listAccounts(client, businessId)
      })
    },

    async listJournals(businessId: string, params: {
      limit?: number
      offset?: number
      branchId?: string | null
      status?: 'draft' | 'posted' | 'reversed'
    } = {}) {
      return withTransaction(pool, async (client) => {
        return journalRepository.listJournals(client, businessId, {
          limit: params.limit,
          offset: params.offset,
          branchId: params.branchId,
          status: params.status
        })
      })
    },

    async getJournal(journalId: string, businessId: string) {
      return withTransaction(pool, async (client) => {
        return journalRepository.getJournalById(client, businessId, journalId)
      })
    },

    async getSummary(businessId: string) {
      return withTransaction(pool, async (client) => {
        return accountRepository.getFinanceSummary(client, businessId)
      })
    },

    async postSale(saleId: string, businessId: string): Promise<{ journalId: string; sourceId: string }> {
      return withTransaction(pool, async (client) => {
        const sale = await saleRepository.findById(client, businessId, saleId)
        if (!sale) {
          throw new ApiError(404, 'NOT_FOUND', 'Sale not found')
        }

        if (sale.total_minor !== sale.paid_minor) {
          throw new ApiError(400, 'SALE_NOT_FULLY_PAID', 'Only fully-paid sales can be posted to finance')
        }

        const existing = await journalRepository.getJournalBySource(client, businessId, 'SALE', saleId)
        if (existing) {
          if (existing.status === 'posted') {
            return { journalId: existing.id, sourceId: saleId }
          }
          throw new ApiError(409, 'SOURCE_CONFLICT', 'Journal already exists for this sale')
        }

        const idemKey = `sale_journal_${saleId}`
        const existingIdem = await idempotencyRepository.findActive(client, businessId, idemKey)
        if (existingIdem) {
          const stored = existingIdem.response_body as { journal_id: string }
          return { journalId: stored.journal_id, sourceId: saleId }
        }

        const paymentMethod = sale.payment_method || 'cash'

        let paymentAccountType: 'cash' | 'bank' | 'mobile'
        switch (paymentMethod) {
          case 'cash':
            paymentAccountType = 'cash'
            break
          case 'bank_transfer':
          case 'debit':
          case 'credit':
            paymentAccountType = 'bank'
            break
          default:
            throw new ApiError(400, 'UNSUPPORTED_METHOD', `Unsupported payment method: ${paymentMethod}`)
        }

        const paymentAccount = await accountRepository.findByType(client, businessId, paymentAccountType)
        if (!paymentAccount) {
          throw new ApiError(500, 'CONFIG_ERROR', `Payment account of type ${paymentAccountType} not configured`)
        }

        const revenueAccount = await accountRepository.findByType(client, businessId, 'revenue')
        if (!revenueAccount) {
          throw new ApiError(500, 'CONFIG_ERROR', 'Revenue account not configured')
        }

        const journalId = randomUUID()
        const sourceId = saleId

      const saleDate = typeof sale.server_created_at === 'string'
        ? sale.server_created_at.slice(0, 10)
        : new Date(sale.server_created_at).toISOString().slice(0, 10)

      await journalRepository.createDraftJournal(client, businessId, {
        id: journalId,
        date: saleDate,
        source_type: 'SALE',
        source_id: sourceId,
        reference: sale.receipt_number,
        description: `Sale ${sale.receipt_number}`,
        branch_id: sale.branch_id
      })

        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: paymentAccount.id,
          debit_minor: sale.paid_minor,
          credit_minor: 0,
          description: 'Cash inflow from sale'
        })

        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: journalId,
          account_id: revenueAccount.id,
          debit_minor: 0,
          credit_minor: sale.total_minor,
          description: 'Revenue from sale'
        })

        await journalRepository.postJournal(client, journalId)

        await idempotencyRepository.insert(client, businessId, idemKey, '', 201, { journal_id: journalId })

        return { journalId, sourceId }
      })
    },

    async postPurchasePayment(paymentId: string, businessId: string): Promise<{ journalId: string; sourceId: string }> {
      return withTransaction(pool, async (client) => {
        const payment = await purchaseRepository.findPaymentById(client, businessId, paymentId)
        if (!payment) {
          throw new ApiError(404, 'NOT_FOUND', 'Purchase payment not found')
        }

        const purchase = await purchaseRepository.findById(client, businessId, payment.purchase_id)
        if (!purchase) {
          throw new ApiError(404, 'NOT_FOUND', 'Purchase not found for payment')
        }

        const existing = await journalRepository.getJournalBySource(client, businessId, 'PURCHASE_PAYMENT', paymentId)
        if (existing) {
          if (existing.status === 'posted') {
          return { journalId: existing.id, sourceId: paymentId }
        }
        throw new ApiError(409, 'SOURCE_CONFLICT', 'Journal already exists for this purchase payment')
      }

      const idemKey = `payment_journal_${paymentId}`
      const existingIdem = await idempotencyRepository.findActive(client, businessId, idemKey)
      if (existingIdem) {
        const stored = existingIdem.response_body as { journal_id: string }
        return { journalId: stored.journal_id, sourceId: paymentId }
      }

      const payableAccount = await accountRepository.findByType(client, businessId, 'payable')
      if (!payableAccount) {
        throw new ApiError(500, 'CONFIG_ERROR', 'Payable account not configured')
      }

      let paymentAccountType: 'cash' | 'bank' | 'mobile'
      switch (payment.method) {
        case 'cash':
          paymentAccountType = 'cash'
          break
        case 'bank_transfer':
        case 'debit':
        case 'credit':
          paymentAccountType = 'bank'
          break
        default:
          throw new ApiError(400, 'UNSUPPORTED_METHOD', `Unsupported payment method: ${payment.method}`)
      }

      const paymentAccount = await accountRepository.findByType(client, businessId, paymentAccountType)
      if (!paymentAccount) {
        throw new ApiError(500, 'CONFIG_ERROR', `Payment account of type ${paymentAccountType} not configured`)
      }

      const journalId = randomUUID()
      const sourceId = paymentId

      const paymentDate = typeof payment.created_at === 'string'
        ? payment.created_at.slice(0, 10)
        : new Date(payment.created_at).toISOString().slice(0, 10)

      await journalRepository.createDraftJournal(client, businessId, {
        id: journalId,
        date: paymentDate,
        source_type: 'PURCHASE_PAYMENT',
        source_id: sourceId,
        reference: payment.reference,
        description: `Payment ${payment.reference || paymentId}`,
        branch_id: purchase.branch_id
      })

      await journalRepository.addJournalLine(client, {
        id: randomUUID(),
        journal_entry_id: journalId,
        account_id: payableAccount.id,
        debit_minor: payment.amount_minor,
        credit_minor: 0,
        description: 'Accounts payable increase'
      })

      await journalRepository.addJournalLine(client, {
        id: randomUUID(),
        journal_entry_id: journalId,
        account_id: paymentAccount.id,
        debit_minor: 0,
        credit_minor: payment.amount_minor,
        description: 'Cash outflow for payment'
      })

      await journalRepository.postJournal(client, journalId)

      await idempotencyRepository.insert(client, businessId, idemKey, '', 201, { journal_id: journalId })

      return { journalId, sourceId }
    })
  },

  async postExpense(expenseId: string, businessId: string): Promise<{ journalId: string; sourceId: string }> {
    return withTransaction(pool, async (client) => {
      const expense = await expenseRepository.findById(client, businessId, expenseId)
      if (!expense) {
        throw new ApiError(404, 'NOT_FOUND', 'Expense not found')
      }

      const existing = await journalRepository.getJournalBySource(client, businessId, 'EXPENSE', expenseId)
      if (existing) {
        if (existing.status === 'posted') {
          return { journalId: existing.id, sourceId: expenseId }
        }
        throw new ApiError(409, 'SOURCE_CONFLICT', 'Journal already exists for this expense')
      }

      if (expense.status !== 'draft') {
        throw new ApiError(409, 'SOURCE_CONFLICT', 'Only draft expenses can be posted')
      }

      const expenseAccount = await accountRepository.findByType(client, businessId, 'expense')
      if (!expenseAccount) {
        throw new ApiError(500, 'CONFIG_ERROR', 'Expense account not configured')
      }

      let creditAccountType: 'cash' | 'bank'
      switch (expense.method) {
        case 'cash':
          creditAccountType = 'cash'
          break
        case 'bank_transfer':
        case 'debit':
        case 'credit':
          creditAccountType = 'bank'
          break
        default:
          throw new ApiError(400, 'UNSUPPORTED_METHOD', `Unsupported payment method: ${expense.method}`)
      }

      const creditAccount = await accountRepository.findByType(client, businessId, creditAccountType)
      if (!creditAccount) {
        throw new ApiError(500, 'CONFIG_ERROR', `Payment account of type ${creditAccountType} not configured`)
      }

      const journalId = randomUUID()

      await journalRepository.createDraftJournal(client, businessId, {
        id: journalId,
        date: expense.date,
        source_type: 'EXPENSE',
        source_id: expenseId,
        reference: expense.reference ?? null,
        description: expense.description,
        branch_id: expense.branch_id
      })

      await journalRepository.addJournalLine(client, {
        id: randomUUID(),
        journal_entry_id: journalId,
        account_id: expenseAccount.id,
        debit_minor: expense.amount_minor,
        credit_minor: 0,
        description: 'Expense debit'
      })

      await journalRepository.addJournalLine(client, {
        id: randomUUID(),
        journal_entry_id: journalId,
        account_id: creditAccount.id,
        debit_minor: 0,
        credit_minor: expense.amount_minor,
        description: 'Expense credit'
      })

      await journalRepository.postJournal(client, journalId)

      const idemKey = `expense_journal_${expenseId}`
      await idempotencyRepository.insert(client, businessId, idemKey, '', 201, { journal_id: journalId })

      const updated = await expenseRepository.updateDraft(client, businessId, expenseId, expense.server_version, {
        status: 'posted'
      })
      if (!updated) {
        throw new ConflictError('VERSION_CONFLICT', 'Expense version conflict after posting')
      }

      return { journalId, sourceId: expenseId }
    })
  },

  async postIncome(incomeId: string, businessId: string): Promise<{ journalId: string; sourceId: string }> {
    return withTransaction(pool, async (client) => {
      const income = await incomeRepository.findById(client, businessId, incomeId)
      if (!income) {
        throw new ApiError(404, 'NOT_FOUND', 'Income not found')
      }

      const existing = await journalRepository.getJournalBySource(client, businessId, 'INCOME', incomeId)
      if (existing) {
        if (existing.status === 'posted') {
          return { journalId: existing.id, sourceId: incomeId }
        }
        throw new ApiError(409, 'SOURCE_CONFLICT', 'Journal already exists for this income')
      }

      if (income.status !== 'draft') {
        throw new ApiError(409, 'SOURCE_CONFLICT', 'Only draft incomes can be posted')
      }

      const incomeAccount = await accountRepository.findByType(client, businessId, 'income')
      if (!incomeAccount) {
        throw new ApiError(500, 'CONFIG_ERROR', 'Income account not configured')
      }

      let debitAccountType: 'cash' | 'bank'
      switch (income.method) {
        case 'cash':
          debitAccountType = 'cash'
          break
        case 'bank_transfer':
        case 'debit':
        case 'credit':
          debitAccountType = 'bank'
          break
        default:
          throw new ApiError(400, 'UNSUPPORTED_METHOD', `Unsupported payment method: ${income.method}`)
      }

      const debitAccount = await accountRepository.findByType(client, businessId, debitAccountType)
      if (!debitAccount) {
        throw new ApiError(500, 'CONFIG_ERROR', `Payment account of type ${debitAccountType} not configured`)
      }

      const journalId = randomUUID()

      await journalRepository.createDraftJournal(client, businessId, {
        id: journalId,
        date: income.date,
        source_type: 'INCOME',
        source_id: incomeId,
        reference: income.reference ?? null,
        description: income.description,
        branch_id: income.branch_id
      })

      await journalRepository.addJournalLine(client, {
        id: randomUUID(),
        journal_entry_id: journalId,
        account_id: debitAccount.id,
        debit_minor: income.amount_minor,
        credit_minor: 0,
        description: 'Income inflow'
      })

      await journalRepository.addJournalLine(client, {
        id: randomUUID(),
        journal_entry_id: journalId,
        account_id: incomeAccount.id,
        debit_minor: 0,
        credit_minor: income.amount_minor,
        description: 'Income credit'
      })

      await journalRepository.postJournal(client, journalId)

      const idemKey = `income_journal_${incomeId}`
      await idempotencyRepository.insert(client, businessId, idemKey, '', 201, { journal_id: journalId })

      const updated = await incomeRepository.updateDraft(client, businessId, incomeId, income.server_version, {
        status: 'posted'
      })
      if (!updated) {
        throw new ConflictError('VERSION_CONFLICT', 'Income version conflict after posting')
      }

      return { journalId, sourceId: incomeId }
    })
  },

  async createReversal(journalId: string, businessId: string): Promise<{ reversalId: string }> {
      return withTransaction(pool, async (client) => {
        const journal = await journalRepository.getJournalById(client, businessId, journalId)
        if (!journal) {
          throw new ApiError(404, 'NOT_FOUND', 'Journal not found')
        }

        if (journal.status !== 'posted') {
          throw new ApiError(400, 'INVALID_STATE', 'Only posted journals can be reversed')
        }

        if (journal.reversed_by) {
          throw new ApiError(400, 'ALREADY_REVERSED', 'Journal has already been reversed')
        }

        const result = await journalRepository.createReversal(client, journalId)
        return { reversalId: result.reversal_id }
      })
    },

    async getAccountBalance(accountId: string, businessId: string): Promise<{ balance: number; debit: number; credit: number }> {
      return withTransaction(pool, async (client) => {
        const account = await accountRepository.findById(client, businessId, accountId)
        if (!account) {
          throw new ApiError(404, 'NOT_FOUND', 'Account not found')
        }

        const balance = await accountRepository.getAccountBalance(client, businessId, accountId)
        if (!balance) {
          return { balance: 0, debit: 0, credit: 0 }
        }

        return {
          balance: balance.balance,
          debit: balance.debit_total,
          credit: balance.credit_total
        }
      })
    },

    async getCashflow(businessId: string, branchId: string | null = null) {
      return withTransaction(pool, async (client) => {
        const entries = await accountRepository.getCashflow(client, businessId, branchId)
        const summary = await accountRepository.getFinanceSummary(client, businessId)

        return { entries, summary }
      })
    },

    async getAccountBalances(businessId: string) {
      return withTransaction(pool, async (client) => {
        return accountRepository.getAccountBalances(client, businessId)
      })
    }
  }
}