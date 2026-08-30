import { PoolClient } from 'pg'
import {
  ProfitLossReportDto,
  BalanceSheetDto,
  GeneralLedgerEntryDto,
  GeneralLedgerReportDto,
  AccountBalanceReportDto,
  ArAgingReportDto,
  ApAgingReportDto,
  ArReconciliationDto,
  ApReconciliationDto,
} from '../dto/finance_reporting_dto'

const DEBIT_NORMAL_TYPES = ['cash', 'bank', 'mobile', 'receivable', 'inventory', 'expense', 'cogs']

export const financeReportingRepository = {
  async getProfitLoss(
    client: PoolClient,
    businessId: string,
    branchId: string | null = null,
    fromDate: string | null = null,
    toDate: string | null = null
  ): Promise<ProfitLossReportDto> {
    const result = await client.query(
      `SELECT
         COALESCE(SUM(CASE WHEN a.type IN ('revenue','income') THEN jl.credit_minor - jl.debit_minor ELSE 0 END), 0) as revenue,
         COALESCE(SUM(CASE WHEN a.type = 'cogs' THEN jl.debit_minor - jl.credit_minor ELSE 0 END), 0) as cogs,
         COALESCE(SUM(CASE WHEN a.type = 'expense' THEN jl.debit_minor - jl.credit_minor ELSE 0 END), 0) as operating_expense,
         COALESCE(SUM(CASE WHEN a.type IN ('expense','cogs') THEN jl.debit_minor - jl.credit_minor ELSE 0 END), 0) as expense
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
          AND je.status IN ('posted', 'reversed')
          AND je.business_id = $1
          AND ($3::date IS NULL OR je.date >= $3)
          AND ($4::date IS NULL OR je.date <= $4)
          AND ($2::uuid IS NULL OR je.branch_id = $2)
       JOIN accounts a ON a.id = jl.account_id
       WHERE a.business_id = $1`,
       [businessId, branchId, fromDate, toDate]
     )

    const row = result.rows[0]
    const revenue = Number(row.revenue)
    const cogs = Number(row.cogs)
    const operatingExpense = Number(row.operating_expense)
    const expense = Number(row.expense)

    return {
      revenue_minor: revenue,
      cogs_minor: cogs,
      operating_expense_minor: operatingExpense,
      expense_minor: expense,
      net_income_minor: revenue - expense,
    }
  },

  async getBalanceSheet(
    client: PoolClient,
    businessId: string,
    asOf: string,
    branchId: string | null
  ): Promise<BalanceSheetDto> {
    const result = await client.query(
      `SELECT
         COALESCE(SUM(CASE WHEN a.type IN ('cash','bank','mobile','receivable','inventory')
           THEN jl.debit_minor - jl.credit_minor ELSE 0 END), 0) as total_assets,
         COALESCE(SUM(CASE WHEN a.type = 'payable'
           THEN jl.credit_minor - jl.debit_minor ELSE 0 END), 0) as total_liabilities,
         COALESCE(SUM(CASE WHEN a.type IN ('revenue','income')
           THEN jl.credit_minor - jl.debit_minor ELSE 0 END), 0) as total_revenue,
         COALESCE(SUM(CASE WHEN a.type IN ('expense','cogs')
           THEN jl.debit_minor - jl.credit_minor ELSE 0 END), 0) as total_expense
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
          AND je.status IN ('posted', 'reversed')
          AND je.business_id = $1
          AND je.date <= $2
          AND ($3::uuid IS NULL OR je.branch_id = $3)
       JOIN accounts a ON a.id = jl.account_id
       WHERE a.business_id = $1`,
      [businessId, asOf, branchId]
    )

    const row = result.rows[0]
    const totalAssets = Number(row.total_assets)
    const totalLiabilities = Number(row.total_liabilities)
    const totalRevenue = Number(row.total_revenue)
    const totalExpense = Number(row.total_expense)
    const totalEquity = totalRevenue - totalExpense

    return {
      total_assets_minor: totalAssets,
      total_liabilities_minor: totalLiabilities,
      total_equity_minor: totalEquity,
    }
  },

  async getCashflowExtended(
    client: PoolClient,
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
    const result = await client.query(
      `SELECT
         je.id as journal_entry_id,
         je.date,
         a.id as account_id,
         a.code as account_code,
         a.name as account_name,
         a.type as account_type,
         jl.debit_minor,
         jl.credit_minor,
         (jl.debit_minor - jl.credit_minor) as net_flow,
         je.description
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
          AND je.status IN ('posted', 'reversed')
          AND je.business_id = $1
          AND ($3::date IS NULL OR je.date >= $3)
          AND ($4::date IS NULL OR je.date <= $4)
          AND ($2::uuid IS NULL OR je.branch_id = $2)
        JOIN accounts a ON a.id = jl.account_id
        WHERE a.type IN ('cash', 'bank', 'mobile')
       ORDER BY je.date, jl.id`,
      [businessId, branchId, fromDate, toDate]
    )

    const entries = result.rows.map(row => ({
      journal_entry_id: row.journal_entry_id,
      date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
      account_id: row.account_id,
      account_code: row.account_code,
      account_name: row.account_name,
      account_type: row.account_type,
      debit_minor: Number(row.debit_minor),
      credit_minor: Number(row.credit_minor),
      net_flow: Number(row.net_flow),
      description: row.description,
    }))

    const totalInflow = entries.reduce((sum, e) => sum + e.debit_minor, 0)
    const totalOutflow = entries.reduce((sum, e) => sum + e.credit_minor, 0)

    return {
      entries,
      total_inflow: totalInflow,
      total_outflow: totalOutflow,
      net_cash_flow: totalInflow - totalOutflow,
    }
  },

  async getAccountBalancesExtended(
    client: PoolClient,
    businessId: string,
    branchId: string | null = null,
    fromDate: string | null = null,
    toDate: string | null = null
  ): Promise<AccountBalanceReportDto[]> {
    const result = await client.query(
      `SELECT
         a.id as account_id,
         a.code as account_code,
         a.name as account_name,
         a.type as account_type,
         COALESCE(posted.debit_total, 0) as debit_total,
         COALESCE(posted.credit_total, 0) as credit_total
       FROM accounts a
       LEFT JOIN (
         SELECT
           jl.account_id,
           SUM(CASE WHEN jl.debit_minor > 0 THEN jl.debit_minor ELSE 0 END) as debit_total,
           SUM(CASE WHEN jl.credit_minor > 0 THEN jl.credit_minor ELSE 0 END) as credit_total
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
            AND je.status IN ('posted', 'reversed')
            AND je.business_id = $1
            AND ($3::date IS NULL OR je.date >= $3)
            AND ($4::date IS NULL OR je.date <= $4)
            AND ($2::uuid IS NULL OR je.branch_id = $2)
          GROUP BY jl.account_id
       ) posted ON posted.account_id = a.id
       WHERE a.business_id = $1
       ORDER BY a.code`,
      [businessId, branchId, fromDate, toDate]
    )

    return result.rows.map(row => {
      const debitTotal = Number(row.debit_total)
      const creditTotal = Number(row.credit_total)
      return {
        account_id: row.account_id,
        account_code: row.account_code,
        account_name: row.account_name,
        account_type: row.account_type,
        debit_total: debitTotal,
        credit_total: creditTotal,
        balance: debitTotal - creditTotal,
      }
    })
  },

  async getGeneralLedger(
    client: PoolClient,
    businessId: string,
    fromDate: string,
    toDate: string,
    branchId: string | null,
    accountId: string | null
  ): Promise<GeneralLedgerReportDto> {
    const openingResult = await client.query(
      `SELECT
          a.id as account_id,
          a.type,
          COALESCE(SUM(CASE
            WHEN a.type IN ('cash','bank','mobile','receivable','inventory','expense','cogs')
              THEN COALESCE(jl.debit_minor, 0) - COALESCE(jl.credit_minor, 0)
            WHEN a.type IN ('payable','revenue','income')
              THEN COALESCE(jl.credit_minor, 0) - COALESCE(jl.debit_minor, 0)
            ELSE 0
          END), 0) as opening_balance
        FROM accounts a
        LEFT JOIN journal_lines jl ON jl.account_id = a.id
        JOIN journal_entries je ON je.id = jl.journal_entry_id
          AND je.status IN ('posted', 'reversed')
          AND je.business_id = $1
          AND je.date < $2
          AND ($3::uuid IS NULL OR je.branch_id = $3)
        WHERE a.business_id = $1
        GROUP BY a.id, a.type`,
      [businessId, fromDate, branchId]
    )

    const openingMap: Record<string, number> = {}
    for (const row of openingResult.rows) {
      openingMap[row.account_id] = Number(row.opening_balance)
    }

    let periodQuery = `
      SELECT
        a.id as account_id,
        a.code as account_code,
        a.name as account_name,
        a.type as account_type,
        je.id as journal_entry_id,
        je.date,
        je.source_type,
        je.description as journal_description,
        jl.id as journal_line_id,
        jl.debit_minor,
        jl.credit_minor,
        jl.description as line_description
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
        AND je.status IN ('posted', 'reversed')
        AND je.business_id = $1
        AND je.date >= $2
        AND je.date <= $3
        AND ($4::uuid IS NULL OR je.branch_id = $4)
    `
    const values: any[] = [businessId, fromDate, toDate, branchId]

    if (accountId) {
      periodQuery += ` AND jl.account_id = $5`
      values.push(accountId)
    }

    periodQuery += ` JOIN accounts a ON a.id = jl.account_id WHERE a.business_id = $1`
    periodQuery += ` ORDER BY a.code, je.date, je.id, jl.id`

    const periodResult = await client.query(periodQuery, values)

    const runningBalances: Record<string, number> = { ...openingMap }
    const entries: GeneralLedgerEntryDto[] = []

    for (const row of periodResult.rows) {
      const accountId = row.account_id
      const isDebitNormal = DEBIT_NORMAL_TYPES.includes(row.account_type)
      const currentOpening = openingMap[accountId] || 0
      const netMovement = isDebitNormal
        ? Number(row.debit_minor) - Number(row.credit_minor)
        : Number(row.credit_minor) - Number(row.debit_minor)

      runningBalances[accountId] = (runningBalances[accountId] || currentOpening) + netMovement

      entries.push({
        account_id: accountId,
        account_code: row.account_code,
        account_name: row.account_name,
        account_type: row.account_type,
        opening_balance: currentOpening,
        journal_entry_id: row.journal_entry_id,
        date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
        source_type: row.source_type,
        description: row.journal_description || row.line_description || '',
        debit_minor: Number(row.debit_minor),
        credit_minor: Number(row.credit_minor),
        running_balance: runningBalances[accountId],
      })
    }

    const periodMovements = entries.reduce((sum, e) => {
      const isDebitNormal = DEBIT_NORMAL_TYPES.includes(e.account_type as any)
      return sum + (isDebitNormal ? e.debit_minor - e.credit_minor : e.credit_minor - e.debit_minor)
    }, 0)

    const totalOpening = Object.values(openingMap).reduce((sum, v) => sum + v, 0)

    return {
      opening_balance: totalOpening,
      period_movements: periodMovements,
      closing_balance: totalOpening + periodMovements,
      entries,
    }
  },

  async getArAging(
    client: PoolClient,
    businessId: string,
    branchId: string | null
  ): Promise<ArAgingReportDto> {
    const result = await client.query(
      `SELECT
         r.id as receivable_id,
         r.customer_id,
         c.name as customer_name,
         r.branch_id,
         r.outstanding_minor,
         r.date as invoice_date,
          DATE_PART('day', CURRENT_DATE - r.date::date) as days_past_due
       FROM receivables r
       JOIN customers c ON c.id = r.customer_id
       JOIN journal_entries je ON je.source_type = 'RECEIVABLE'
         AND je.source_id = r.id
         AND je.business_id = $1
          AND je.status IN ('posted', 'reversed')
        WHERE r.business_id = $1
          AND r.status IN ('OPEN', 'PARTIAL')
         AND r.outstanding_minor > 0
         AND ($2::uuid IS NULL OR r.branch_id = $2)`,
      [businessId, branchId]
    )

    const buckets = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '91+': 0 }
    let totalOutstanding = 0
    const customers: Array<{
      customer_id: string
      customer_name: string
      outstanding_minor: number
      bucket: string
    }> = []

    for (const row of result.rows) {
      const outstanding = Number(row.outstanding_minor)
      const days = Number(row.days_past_due)
      totalOutstanding += outstanding

      let bucket: string
      if (days <= 0) bucket = 'current'
      else if (days <= 30) bucket = '1-30'
      else if (days <= 60) bucket = '31-60'
      else if (days <= 90) bucket = '61-90'
      else bucket = '91+'

      buckets[bucket as keyof typeof buckets] += outstanding

      customers.push({
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        outstanding_minor: outstanding,
        bucket,
      })
    }

    return {
      total_outstanding_minor: totalOutstanding,
      buckets: Object.entries(buckets).map(([bucket, amount_minor]) => ({ bucket, amount_minor })),
      customers,
    }
  },

  async getApAging(
    client: PoolClient,
    businessId: string,
    branchId: string | null
  ): Promise<ApAgingReportDto> {
    const result = await client.query(
      `SELECT
         p.id as purchase_id,
         p.supplier_id,
         s.name as supplier_name,
         p.branch_id,
         p.outstanding_minor,
         p.due_date,
          DATE_PART('day', CURRENT_DATE - p.due_date::date) as days_past_due
       FROM purchases p
       JOIN suppliers s ON s.id = p.supplier_id
       JOIN journal_entries je ON je.source_type = 'PAYABLE'
         AND je.source_id = p.id
         AND je.business_id = $1
          AND je.status IN ('posted', 'reversed')
        WHERE p.business_id = $1
          AND p.deleted_at IS NULL
         AND p.outstanding_minor > 0
         AND ($2::uuid IS NULL OR p.branch_id = $2)`,
      [businessId, branchId]
    )

    const buckets = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '91+': 0 }
    let totalOutstanding = 0
    const suppliers: Array<{
      supplier_id: string
      supplier_name: string
      outstanding_minor: number
      bucket: string
    }> = []

    for (const row of result.rows) {
      const outstanding = Number(row.outstanding_minor)
      const days = Number(row.days_past_due)
      totalOutstanding += outstanding

      let bucket: string
      if (days <= 0) bucket = 'current'
      else if (days <= 30) bucket = '1-30'
      else if (days <= 60) bucket = '31-60'
      else if (days <= 90) bucket = '61-90'
      else bucket = '91+'

      buckets[bucket as keyof typeof buckets] += outstanding

      suppliers.push({
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        outstanding_minor: outstanding,
        bucket,
      })
    }

    return {
      total_outstanding_minor: totalOutstanding,
      buckets: Object.entries(buckets).map(([bucket, amount_minor]) => ({ bucket, amount_minor })),
      suppliers,
    }
  },

  async getArReconciliation(
    client: PoolClient,
    businessId: string
  ): Promise<ArReconciliationDto> {
    const journalResult = await client.query(
      `SELECT
          COALESCE(SUM(CASE WHEN a.type = 'receivable' THEN jl.debit_minor - jl.credit_minor ELSE 0 END), 0) as total_receivable_outstanding,
          COALESCE(SUM(CASE WHEN a.type IN ('cash','bank','mobile') THEN jl.debit_minor - jl.credit_minor ELSE 0 END), 0) as total_cash_debit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_entry_id
          AND je.status IN ('posted', 'reversed')
          AND je.business_id = $1
          AND je.source_type IN ('RECEIVABLE', 'CUSTOMER_PAYMENT')
        JOIN accounts a ON a.id = jl.account_id`,
       [businessId]
     )

     const row = journalResult.rows[0]
     const totalReceivableOutstanding = Number(row.total_receivable_outstanding)
     const totalCashDebit = Number(row.total_cash_debit)

     return {
       customer_outstanding_minor: totalReceivableOutstanding,
       total_outstanding_minor: totalReceivableOutstanding,
       collection_total_minor: totalCashDebit,
     }
  },

  async getApReconciliation(
    client: PoolClient,
    businessId: string
  ): Promise<ApReconciliationDto> {
    const journalResult = await client.query(
      `SELECT
          COALESCE(SUM(CASE WHEN a.type = 'payable' THEN jl.credit_minor - jl.debit_minor ELSE 0 END), 0) as total_payable_outstanding,
          COALESCE(SUM(CASE WHEN a.type IN ('cash','bank','mobile') THEN jl.credit_minor - jl.debit_minor ELSE 0 END), 0) as total_cash_paid
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_entry_id
          AND je.status IN ('posted', 'reversed')
          AND je.business_id = $1
          AND je.source_type IN ('PAYABLE', 'PURCHASE_PAYMENT')
        JOIN accounts a ON a.id = jl.account_id`,
       [businessId]
    )

    const row = journalResult.rows[0]
    const totalPayableOutstanding = Number(row.total_payable_outstanding)
    const totalCashPaid = Number(row.total_cash_paid)

    return {
      supplier_outstanding_minor: totalPayableOutstanding,
      total_ap_minor: totalPayableOutstanding,
      payment_total_minor: totalCashPaid,
    }
  },
}
