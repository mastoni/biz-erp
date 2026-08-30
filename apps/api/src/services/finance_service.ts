import { Pool, PoolClient } from 'pg'
import { saleRepository } from '../repositories/sale_repository'
import { purchaseRepository } from '../repositories/purchase_repository'
import { inventoryRepository } from '../repositories/inventory_repository'
import { idempotencyRepository } from '../repositories/idempotency_repository'
import { accountRepository } from '../repositories/account_repository'
import { journalRepository } from '../repositories/journal_repository'
import { expenseRepository } from '../repositories/expense_repository'
import { incomeRepository } from '../repositories/income_repository'
import { receivableRepository, ReceivableStatus, ReceivableDto } from '../repositories/receivable_repository'
import { customerPaymentRepository, CustomerPaymentDto } from '../repositories/customer_payment_repository'
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

    async postSale(saleId: string, businessId: string): Promise<{ journalId: string; sourceId: string; receivableId?: string | null }> {
      return withTransaction(pool, async (client) => {
        const sale = await saleRepository.findById(client, businessId, saleId)
        if (!sale) {
          throw new ApiError(404, 'NOT_FOUND', 'Sale not found')
        }

        const existingSaleJournal = await journalRepository.getJournalBySource(client, businessId, 'SALE', saleId)
        const existingReceivable = await receivableRepository.findBySale(client, businessId, saleId)

        if (sale.total_minor === sale.paid_minor) {
          if (existingSaleJournal) {
            if (existingSaleJournal.status === 'posted') {
              return { journalId: existingSaleJournal.id, sourceId: saleId, receivableId: null }
            }
            throw new ApiError(409, 'SOURCE_CONFLICT', 'Journal already exists for this sale')
          }

          const idemKey = `sale_journal_${saleId}`
          const existingIdem = await idempotencyRepository.findActive(client, businessId, idemKey)
          if (existingIdem) {
            const stored = existingIdem.response_body as { journal_id: string }
            return { journalId: stored.journal_id, sourceId: saleId, receivableId: null }
          }

          const paymentMethod = sale.payment_method || 'cash'

          let paymentAccountType: 'cash' | 'bank'
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
            debit_minor: sale.total_minor,
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

          return { journalId, sourceId, receivableId: null }
        }

        // Credit sale path: paid_minor < total_minor
        if (existingSaleJournal) {
          if (existingSaleJournal.status === 'posted' && existingReceivable && existingReceivable.status !== 'REVERSED') {
            return { journalId: existingSaleJournal.id, sourceId: saleId, receivableId: existingReceivable.id }
          }
          throw new ApiError(409, 'SOURCE_CONFLICT', 'Credit sale journals already exist in inconsistent state')
        }

        if (!sale.customer_id) {
          throw new ApiError(400, 'CUSTOMER_REQUIRED_FOR_CREDIT', 'Credit sales require a customer_id')
        }

        const idemKey = `sale_journal_${saleId}`
        const existingIdem = await idempotencyRepository.findActive(client, businessId, idemKey)
        if (existingIdem) {
          const stored = existingIdem.response_body as { journal_id: string; receivable_id?: string }
          return { journalId: stored.journal_id, sourceId: saleId, receivableId: stored.receivable_id ?? null }
        }

        const paymentMethod = sale.payment_method || 'cash'

        let paymentAccountType: 'cash' | 'bank'
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

        const receivableAccount = await accountRepository.findByType(client, businessId, 'receivable')
        if (!receivableAccount) {
          throw new ApiError(500, 'CONFIG_ERROR', 'Receivable account not configured')
        }

        const saleDate = typeof sale.server_created_at === 'string'
          ? sale.server_created_at.slice(0, 10)
          : new Date(sale.server_created_at).toISOString().slice(0, 10)

        const receivableAmount = sale.total_minor - sale.paid_minor

        if (receivableAmount <= 0) {
          throw new ApiError(500, 'STATE_CONFLICT', 'Receivable amount must be positive')
        }

        // SALE journal: Dr Cash/Bank(paid) / Cr Revenue(paid)
        const saleJournalId = randomUUID()
        await journalRepository.createDraftJournal(client, businessId, {
          id: saleJournalId,
          date: saleDate,
          source_type: 'SALE',
          source_id: saleId,
          reference: sale.receipt_number,
          description: `Sale ${sale.receipt_number}`,
          branch_id: sale.branch_id
        })

        if (sale.paid_minor > 0) {
          await journalRepository.addJournalLine(client, {
            id: randomUUID(),
            journal_entry_id: saleJournalId,
            account_id: paymentAccount.id,
            debit_minor: sale.paid_minor,
            credit_minor: 0,
            description: 'Cash inflow from sale'
          })

          await journalRepository.addJournalLine(client, {
            id: randomUUID(),
            journal_entry_id: saleJournalId,
            account_id: revenueAccount.id,
            debit_minor: 0,
            credit_minor: sale.paid_minor,
            description: 'Revenue from sale (payment portion)'
          })
        } else {
          // Fully credit sale: no cash received, SALE journal just for identity
          await journalRepository.addJournalLine(client, {
            id: randomUUID(),
            journal_entry_id: saleJournalId,
            account_id: revenueAccount.id,
            debit_minor: 0,
            credit_minor: 0,
            description: 'Placeholder for credit sale (balanced by RECEIVABLE journal)'
          })
        }

        await journalRepository.postJournal(client, saleJournalId)

        // Create receivable
        const receivableId = randomUUID()
        const receivable = await receivableRepository.create(client, {
          id: receivableId,
          business_id: businessId,
          sale_id: saleId,
          customer_id: sale.customer_id,
          branch_id: sale.branch_id,
          amount_minor: receivableAmount,
          paid_minor: 0,
          outstanding_minor: receivableAmount,
          date: saleDate,
          reference: sale.receipt_number,
          description: `Receivable for sale ${sale.receipt_number}`,
          status: 'OPEN',
        })

        // RECEIVABLE journal: Dr AR / Cr Revenue
        const receivableJournalId = randomUUID()
        await journalRepository.createDraftJournal(client, businessId, {
          id: receivableJournalId,
          date: saleDate,
          source_type: 'RECEIVABLE',
          source_id: receivableId,
          reference: sale.receipt_number,
          description: `Receivable for sale ${sale.receipt_number}`,
          branch_id: sale.branch_id
        })

        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: receivableJournalId,
          account_id: receivableAccount.id,
          debit_minor: receivableAmount,
          credit_minor: 0,
          description: 'Accounts receivable from credit sale'
        })

        await journalRepository.addJournalLine(client, {
          id: randomUUID(),
          journal_entry_id: receivableJournalId,
          account_id: revenueAccount.id,
          debit_minor: 0,
          credit_minor: receivableAmount,
          description: 'Revenue from credit sale'
        })

        await journalRepository.postJournal(client, receivableJournalId)

        await idempotencyRepository.insert(client, businessId, idemKey, '', 201, {
          journal_id: saleJournalId,
          receivable_id: receivableId
        })

        return { journalId: saleJournalId, sourceId: saleId, receivableId: receivable.id }
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

  async postPurchaseInvoice(purchaseId: string, businessId: string): Promise<{ journalId: string; sourceId: string }> {
    return withTransaction(pool, async (client) => {
      const purchase = await purchaseRepository.findById(client, businessId, purchaseId)
      if (!purchase) {
        throw new ApiError(404, 'NOT_FOUND', 'Purchase not found')
      }

      if (purchase.status !== 'received' && purchase.status !== 'partial') {
        throw new ApiError(400, 'INVALID_STATE', `Purchase status must be received or partial, got: ${purchase.status}`)
      }

      const existing = await journalRepository.getJournalBySource(client, businessId, 'PAYABLE', purchaseId)
      if (existing) {
        if (existing.status === 'posted') {
          return { journalId: existing.id, sourceId: purchaseId }
        }
        throw new ApiError(409, 'SOURCE_CONFLICT', 'PAYABLE journal for this purchase exists but is not posted')
      }

      const idemKey = `purchase_invoice_${purchaseId}`
      const existingIdem = await idempotencyRepository.findActive(client, businessId, idemKey)
      if (existingIdem) {
        const stored = existingIdem.response_body as { journal_id: string }
        return { journalId: stored.journal_id, sourceId: purchaseId }
      }

      const inventoryAccount = await accountRepository.findByType(client, businessId, 'inventory')
      if (!inventoryAccount) {
        throw new ApiError(500, 'CONFIG_ERROR', 'Inventory account not configured')
      }

      const payableAccount = await accountRepository.findByType(client, businessId, 'payable')
      if (!payableAccount) {
        throw new ApiError(500, 'CONFIG_ERROR', 'Payable account not configured')
      }

      const journalId = randomUUID()

      const invoiceDate = typeof purchase.updated_at === 'string'
        ? purchase.updated_at.slice(0, 10)
        : new Date(purchase.updated_at).toISOString().slice(0, 10)

      await journalRepository.createDraftJournal(client, businessId, {
        id: journalId,
        date: invoiceDate,
        source_type: 'PAYABLE',
        source_id: purchaseId,
        reference: purchase.code,
        description: `Accounts payable for purchase ${purchase.code}`,
        branch_id: purchase.branch_id
      })

      await journalRepository.addJournalLine(client, {
        id: randomUUID(),
        journal_entry_id: journalId,
        account_id: inventoryAccount.id,
        debit_minor: purchase.total_minor,
        credit_minor: 0,
        description: 'Inventory from purchase'
      })

      await journalRepository.addJournalLine(client, {
        id: randomUUID(),
        journal_entry_id: journalId,
        account_id: payableAccount.id,
        debit_minor: 0,
        credit_minor: purchase.total_minor,
        description: 'Accounts payable liability'
      })

      await journalRepository.postJournal(client, journalId)

      await idempotencyRepository.insert(client, businessId, idemKey, '', 201, { journal_id: journalId })

      return { journalId, sourceId: purchaseId }
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

  async postReceivable(receivableId: string, businessId: string): Promise<{ journalId: string; sourceId: string }> {
    return withTransaction(pool, async (client) => {
      const receivable = await receivableRepository.findById(client, businessId, receivableId)
      if (!receivable) {
        throw new ApiError(404, 'NOT_FOUND', 'Receivable not found')
      }

      if (receivable.status === 'REVERSED') {
        throw new ApiError(409, 'INVALID_STATE', 'Cannot post a reversed receivable')
      }

      const existing = await journalRepository.getJournalBySource(client, businessId, 'RECEIVABLE', receivableId)
      if (existing) {
        if (existing.status === 'posted') {
          return { journalId: existing.id, sourceId: receivableId }
        }
        throw new ApiError(409, 'SOURCE_CONFLICT', 'Journal already exists for this receivable')
      }

      const receivableAccount = await accountRepository.findByType(client, businessId, 'receivable')
      if (!receivableAccount) {
        throw new ApiError(500, 'CONFIG_ERROR', 'Receivable account not configured')
      }

      const revenueAccount = await accountRepository.findByType(client, businessId, 'revenue')
      if (!revenueAccount) {
        throw new ApiError(500, 'CONFIG_ERROR', 'Revenue account not configured')
      }

      if (receivable.outstanding_minor <= 0) {
        throw new ApiError(409, 'INVALID_STATE', 'Receivable has no outstanding amount')
      }

      const journalId = randomUUID()

      await journalRepository.createDraftJournal(client, businessId, {
        id: journalId,
        date: receivable.date,
        source_type: 'RECEIVABLE',
        source_id: receivableId,
        reference: receivable.reference ?? null,
        description: receivable.description,
        branch_id: receivable.branch_id
      })

      await journalRepository.addJournalLine(client, {
        id: randomUUID(),
        journal_entry_id: journalId,
        account_id: receivableAccount.id,
        debit_minor: receivable.outstanding_minor,
        credit_minor: 0,
        description: 'Accounts receivable from credit sale'
      })

      await journalRepository.addJournalLine(client, {
        id: randomUUID(),
        journal_entry_id: journalId,
        account_id: revenueAccount.id,
        debit_minor: 0,
        credit_minor: receivable.outstanding_minor,
        description: 'Revenue from credit sale'
      })

      await journalRepository.postJournal(client, journalId)

      return { journalId, sourceId: receivableId }
    })
  },

  async collectCustomerPayment(
    receivableId: string,
    businessId: string,
    amountMinor: number,
    method: 'cash' | 'bank_transfer' | 'debit' | 'credit',
    customerId: string | null,
    reference: string | null,
    date?: string
  ): Promise<{ paymentId: string; journalId: string; receivableId: string; newStatus: string }> {
    return withTransaction(pool, async (client) => {
      if (amountMinor <= 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Payment amount must be positive')
      }

      // Lock receivable for update
      const receivable = await receivableRepository.findById(client, businessId, receivableId)
      if (!receivable) {
        throw new ApiError(404, 'NOT_FOUND', 'Receivable not found')
      }

      if (receivable.status === 'REVERSED') {
        throw new ApiError(400, 'INVALID_STATE', 'Cannot collect payment on a reversed receivable')
      }

      if (customerId !== receivable.customer_id) {
        throw new ApiError(409, 'SOURCE_CONFLICT', 'Customer mismatch: payment customer does not match receivable customer')
      }

      if (amountMinor > receivable.outstanding_minor) {
        throw new ApiError(400, 'OVERPAYMENT', 'Payment amount exceeds outstanding balance')
      }

      let paymentAccountType: 'cash' | 'bank'
      switch (method) {
        case 'cash':
          paymentAccountType = 'cash'
          break
        case 'bank_transfer':
        case 'debit':
        case 'credit':
          paymentAccountType = 'bank'
          break
        default:
          throw new ApiError(400, 'UNSUPPORTED_METHOD', `Unsupported payment method: ${method}`)
      }

      const paymentAccount = await accountRepository.findByType(client, businessId, paymentAccountType)
      if (!paymentAccount) {
        throw new ApiError(500, 'CONFIG_ERROR', `Payment account of type ${paymentAccountType} not configured`)
      }

      const receivableAccount = await accountRepository.findByType(client, businessId, 'receivable')
      if (!receivableAccount) {
        throw new ApiError(500, 'CONFIG_ERROR', 'Receivable account not configured')
      }

      // Idempotency: check for existing payment with same idempotency_key
      const idemKey = reference ?? `payment_${receivableId}_${amountMinor}`
      const existingPayment = await customerPaymentRepository.findByIdempotencyKey(client, businessId, idemKey)
      if (existingPayment) {
        const existingJournal = await journalRepository.getJournalBySource(client, businessId, 'CUSTOMER_PAYMENT', existingPayment.id)
        return {
          paymentId: existingPayment.id,
          journalId: existingJournal ? existingJournal.id : '',
          receivableId: existingPayment.receivable_id,
          newStatus: receivable.status,
        }
      }

      const paymentId = randomUUID()
      const paymentDate = date || receivable.date

      // Create immutable payment row
      await customerPaymentRepository.create(client, {
        id: paymentId,
        business_id: businessId,
        receivable_id: receivableId,
        customer_id: receivable.customer_id,
        branch_id: receivable.branch_id,
        amount_minor: amountMinor,
        method,
        reference,
        idempotency_key: idemKey,
      })

      // CUSTOMER_PAYMENT journal: Dr Cash/Bank / Cr AR
      const journalId = randomUUID()
      await journalRepository.createDraftJournal(client, businessId, {
        id: journalId,
        date: paymentDate,
        source_type: 'CUSTOMER_PAYMENT',
        source_id: paymentId,
        reference,
        description: `Customer payment on receivable ${receivableId}`,
        branch_id: receivable.branch_id
      })

      await journalRepository.addJournalLine(client, {
        id: randomUUID(),
        journal_entry_id: journalId,
        account_id: paymentAccount.id,
        debit_minor: amountMinor,
        credit_minor: 0,
        description: 'Cash inflow from customer payment'
      })

      await journalRepository.addJournalLine(client, {
        id: randomUUID(),
        journal_entry_id: journalId,
        account_id: receivableAccount.id,
        debit_minor: 0,
        credit_minor: amountMinor,
        description: 'Receivable collection'
      })

      await journalRepository.postJournal(client, journalId)

      // Update receivable settlement
      const newPaid = receivable.paid_minor + amountMinor
      const newOutstanding = receivable.outstanding_minor - amountMinor
      let newStatus: 'OPEN' | 'PARTIAL' | 'PAID' | 'REVERSED'

      if (newOutstanding === 0) {
        newStatus = 'PAID'
      } else if (newPaid > 0) {
        newStatus = 'PARTIAL'
      } else {
        newStatus = 'OPEN'
      }

      const updated = await receivableRepository.updateSettlement(
        client,
        businessId,
        receivableId,
        receivable.server_version,
        newPaid,
        newOutstanding,
        newStatus
      )
      if (!updated) {
        throw new ConflictError('VERSION_CONFLICT', 'Receivable version conflict during payment collection')
      }

       return { paymentId, journalId, receivableId, newStatus }
     })
   },

    async reverseCustomerPayment(paymentId: string, businessId: string): Promise<{ reversalId: string }> {
      return withTransaction(pool, async (client) => {
        const payment = await customerPaymentRepository.findById(client, businessId, paymentId)
        if (!payment) {
          throw new ApiError(404, 'NOT_FOUND', 'Payment not found')
        }

        const paymentJournal = await journalRepository.getJournalBySource(client, businessId, 'CUSTOMER_PAYMENT', paymentId)
        if (!paymentJournal) {
          throw new ApiError(404, 'NOT_FOUND', 'Payment journal not found')
        }

        if (paymentJournal.status === 'reversed') {
          throw new ApiError(400, 'ALREADY_REVERSED', 'Payment journal has already been reversed')
        }

        const receivable = await receivableRepository.lockById(client, businessId, payment.receivable_id)
        if (!receivable) {
          throw new ApiError(404, 'NOT_FOUND', 'Receivable not found')
        }

        if (receivable.status === 'REVERSED') {
          throw new ApiError(400, 'INVALID_STATE', 'Receivable already reversed')
        }

        const journal = await journalRepository.getJournalByIdWithLock(client, businessId, paymentJournal.id)

        const reversal = await journalRepository.createReversal(client, paymentJournal.id)

        const newPaid = receivable.paid_minor - payment.amount_minor
        const newOutstanding = receivable.outstanding_minor + payment.amount_minor
        let newStatus: ReceivableStatus
        if (newPaid === 0) {
          newStatus = 'OPEN'
        } else {
          newStatus = 'PARTIAL'
        }

        const updated = await receivableRepository.updateSettlement(
          client,
          businessId,
          payment.receivable_id,
          receivable.server_version,
          newPaid,
          newOutstanding,
          newStatus
        )
        if (!updated) {
          throw new ConflictError('VERSION_CONFLICT', 'Receivable version conflict during payment reversal')
        }

        return { reversalId: reversal.reversal_id }
      })
    },

    async reversePurchasePayment(paymentId: string, businessId: string): Promise<{ reversalId: string }> {
      return withTransaction(pool, async (client) => {
        const payment = await purchaseRepository.findPaymentById(client, businessId, paymentId)
        if (!payment) {
          throw new ApiError(404, 'NOT_FOUND', 'Purchase payment not found')
        }

        const purchase = await purchaseRepository.findByIdForUpdate(client, businessId, payment.purchase_id)
        if (!purchase) {
          throw new ApiError(404, 'NOT_FOUND', 'Purchase not found for payment')
        }

        const paymentJournal = await journalRepository.getJournalBySource(client, businessId, 'PURCHASE_PAYMENT', paymentId)
        if (!paymentJournal) {
          throw new ApiError(404, 'NOT_FOUND', 'PURCHASE_PAYMENT journal not found')
        }

        if (paymentJournal.status === 'reversed') {
          throw new ApiError(400, 'ALREADY_REVERSED', 'Payment journal has already been reversed')
        }

        const reversal = await journalRepository.createReversal(client, paymentJournal.id)

        const newPaidMinor = purchase.paid_minor - payment.amount_minor
        const newOutstandingMinor = purchase.outstanding_minor + payment.amount_minor

        if (newPaidMinor < 0) {
          throw new ApiError(400, 'INVALID_STATE', 'Reversal would make paid_minor negative')
        }
        if (newOutstandingMinor > purchase.total_minor) {
          throw new ApiError(400, 'INVALID_STATE', 'Reversal would make outstanding exceed total')
        }

        const updated = await purchaseRepository.updatePaymentProgress(
          client,
          businessId,
          payment.purchase_id,
          purchase.server_version,
          {
            paid_minor: newPaidMinor,
            outstanding_minor: newOutstandingMinor,
          }
        )
        if (!updated) {
          throw new ConflictError('VERSION_CONFLICT', 'Purchase version conflict during payment reversal')
        }

        return { reversalId: reversal.reversal_id }
      })
    },

    async reverseCreditSale(saleId: string, businessId: string): Promise<{ reversalIds: string[] }> {
      return withTransaction(pool, async (client) => {
        const sale = await saleRepository.findById(client, businessId, saleId)
        if (!sale) {
          throw new ApiError(404, 'NOT_FOUND', 'Sale not found')
        }

        const receivable = await receivableRepository.findBySale(client, businessId, saleId)
        if (!receivable) {
          throw new ApiError(404, 'NOT_FOUND', 'Receivable not found for this sale')
        }

        const lockedReceivable = await receivableRepository.lockById(client, businessId, receivable.id)
        if (!lockedReceivable) {
          throw new ApiError(404, 'NOT_FOUND', 'Receivable not found')
        }

        if (lockedReceivable.status === 'REVERSED') {
          throw new ApiError(400, 'ALREADY_REVERSED', 'Receivable already reversed')
        }

        const hasActivePayments = await journalRepository.hasUnreversedPaymentJournals(client, businessId, receivable.id)
        if (hasActivePayments) {
          throw new ApiError(409, 'STATE_CONFLICT', 'Cannot reverse credit sale while active customer payments remain')
        }

        const saleJournal = await journalRepository.getJournalBySource(client, businessId, 'SALE', saleId)
        if (!saleJournal) {
          throw new ApiError(404, 'NOT_FOUND', 'SALE journal not found')
        }

        if (saleJournal.status === 'reversed') {
          throw new ApiError(400, 'ALREADY_REVERSED', 'SALE journal already reversed')
        }

        const receivableJournal = await journalRepository.getJournalBySource(client, businessId, 'RECEIVABLE', receivable.id)
        if (!receivableJournal) {
          throw new ApiError(404, 'NOT_FOUND', 'RECEIVABLE journal not found')
        }

        if (receivableJournal.status === 'reversed') {
          throw new ApiError(400, 'ALREADY_REVERSED', 'RECEIVABLE journal already reversed')
        }

        const saleReversal = await journalRepository.createReversal(client, saleJournal.id)

        const receivableReversal = await journalRepository.createReversal(client, receivableJournal.id)

        await receivableRepository.updateStatus(
          client,
          businessId,
          receivable.id,
          lockedReceivable.server_version,
          'REVERSED'
        )

        return { reversalIds: [saleReversal.reversal_id, receivableReversal.reversal_id] }
      })
    },

    async listReceivables(
      businessId: string,
      params: {
        branchId?: string | null
        customerId?: string | null
        status?: ReceivableStatus
        dateFrom?: string
        dateTo?: string
        limit?: number
        offset?: number
      } = {}
    ): Promise<{ rows: ReceivableDto[]; total: number }> {
      return withTransaction(pool, async (client) => {
        return receivableRepository.list(client, businessId, {
          branchId: params.branchId ?? undefined,
          customerId: params.customerId ?? undefined,
          status: params.status,
          date_from: params.dateFrom,
          date_to: params.dateTo,
          limit: params.limit,
          offset: params.offset,
        })
      })
    },

    async getReceivable(receivableId: string, businessId: string): Promise<ReceivableDto | null> {
      return withTransaction(pool, async (client) => {
        return receivableRepository.findById(client, businessId, receivableId)
      })
    },

    async getReceivableBySale(saleId: string, businessId: string): Promise<ReceivableDto | null> {
      return withTransaction(pool, async (client) => {
        return receivableRepository.findBySale(client, businessId, saleId)
      })
    },

    async listCustomerPayments(
      receivableId: string,
      businessId: string,
      limit: number = 50,
      offset: number = 0
    ): Promise<{ rows: CustomerPaymentDto[]; total: number }> {
      return withTransaction(pool, async (client) => {
        return customerPaymentRepository.listByReceivable(client, businessId, receivableId, limit, offset)
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

    async getCashflow(businessId: string, branchId: string | null = null, fromDate: string | null = null, toDate: string | null = null) {
      return withTransaction(pool, async (client) => {
        const entries = await accountRepository.getCashflow(client, businessId, branchId, fromDate, toDate)
        const summary = await accountRepository.getFinanceSummary(client, businessId)

        return { entries, summary }
      })
    },

    async postCashPurchase(
      client: PoolClient,
      purchasePaymentId: string,
      businessId: string,
      amountMinor: number,
      branchId?: string | null,
      reference?: string | null,
      description?: string | null
    ): Promise<{ journalId: string; sourceId: string }> {
      const existing = await journalRepository.getJournalBySource(client, businessId, 'PURCHASE', purchasePaymentId)
      if (existing) {
        if (existing.status === 'posted') {
          return { journalId: existing.id, sourceId: purchasePaymentId }
        }
        throw new ApiError(409, 'SOURCE_CONFLICT', 'Journal already exists for this cash purchase')
      }

      const idemKey = `cash_purchase_journal_${purchasePaymentId}`
      const existingIdem = await idempotencyRepository.findActive(client, businessId, idemKey)
      if (existingIdem) {
        const stored = existingIdem.response_body as { journal_id: string }
        return { journalId: stored.journal_id, sourceId: purchasePaymentId }
      }

      const inventoryAccount = await accountRepository.findByType(client, businessId, 'inventory')
      if (!inventoryAccount) {
        throw new ApiError(500, 'CONFIG_ERROR', 'Inventory account not configured')
      }

      const paymentAccount = await accountRepository.findByType(client, businessId, 'cash')
      if (!paymentAccount) {
        throw new ApiError(500, 'CONFIG_ERROR', 'Cash account not configured')
      }

      const journalId = randomUUID()

      await journalRepository.createDraftJournal(client, businessId, {
        id: journalId,
        date: new Date().toISOString().slice(0, 10),
        source_type: 'PURCHASE',
        source_id: purchasePaymentId,
        reference: reference ?? null,
        description: description ?? `Cash purchase payment ${purchasePaymentId}`,
        branch_id: branchId ?? null
      })

      await journalRepository.addJournalLine(client, {
        id: randomUUID(),
        journal_entry_id: journalId,
        account_id: inventoryAccount.id,
        debit_minor: amountMinor,
        credit_minor: 0,
        description: 'Inventory from cash purchase'
      })

      await journalRepository.addJournalLine(client, {
        id: randomUUID(),
        journal_entry_id: journalId,
        account_id: paymentAccount.id,
        debit_minor: 0,
        credit_minor: amountMinor,
        description: 'Cash outflow for purchase'
      })

      await journalRepository.postJournal(client, journalId)

      await idempotencyRepository.insert(client, businessId, idemKey, '', 201, { journal_id: journalId })

      return { journalId, sourceId: purchasePaymentId }
    },

    async getAccountBalances(businessId: string) {
      return withTransaction(pool, async (client) => {
        return accountRepository.getAccountBalances(client, businessId)
      })
    }
  }
}