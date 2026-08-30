import { Pool } from 'pg'
import { withTransaction } from '../db/transaction'
import { financeReportingRepository } from '../repositories/finance_reporting_repository'
import {
  ProfitLossReportDto,
  BalanceSheetDto,
  GeneralLedgerReportDto,
  AccountBalanceReportDto,
} from '../dto/finance_reporting_dto'

export function createFinanceReportingService(pool: Pool) {
  return {
    async getProfitLoss(
      businessId: string,
      branchId: string | null = null,
      fromDate: string | null = null,
      toDate: string | null = null
    ): Promise<ProfitLossReportDto> {
      return withTransaction(pool, async (client) => {
        return financeReportingRepository.getProfitLoss(client, businessId, branchId, fromDate, toDate)
      })
    },

    async getBalanceSheet(
      businessId: string,
      asOf: string,
      branchId: string | null = null
    ): Promise<BalanceSheetDto> {
      return withTransaction(pool, async (client) => {
        return financeReportingRepository.getBalanceSheet(client, businessId, asOf, branchId)
      })
    },

    async getCashflowReport(
      businessId: string,
      branchId: string | null = null,
      fromDate: string | null = null,
      toDate: string | null = null
    ): Promise<{
      entries: Array<{
        journal_entry_id: string
        date: string
        account_id: string
        account_code: string
        account_name: string
        account_type: string
        debit_minor: number
        credit_minor: number
        net_flow: number
        description: string | null
      }>
      total_inflow: number
      total_outflow: number
      net_cash_flow: number
    }> {
      return withTransaction(pool, async (client) => {
        return financeReportingRepository.getCashflowExtended(client, businessId, branchId, fromDate, toDate)
      })
    },

    async getAccountBalancesReport(
      businessId: string,
      branchId: string | null = null,
      fromDate: string | null = null,
      toDate: string | null = null
    ): Promise<AccountBalanceReportDto[]> {
      return withTransaction(pool, async (client) => {
        return financeReportingRepository.getAccountBalancesExtended(client, businessId, branchId, fromDate, toDate)
      })
    },

    async getGeneralLedger(
      businessId: string,
      fromDate: string,
      toDate: string,
      branchId: string | null = null,
      accountId: string | null = null
    ): Promise<GeneralLedgerReportDto> {
      return withTransaction(pool, async (client) => {
        return financeReportingRepository.getGeneralLedger(client, businessId, fromDate, toDate, branchId, accountId)
      })
    },
  }
}
