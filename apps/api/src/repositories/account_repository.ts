import { PoolClient } from 'pg'
import { AccountType, AccountBalanceDto, CashflowEntryDto, FinanceSummaryDto } from '../dto/finance_dto'

export const accountRepository = {
  async createDefaultAccounts(client: PoolClient, businessId: string): Promise<void> {
    const defaultAccounts: { type: AccountType; code: string; name: string }[] = [
      { type: 'cash', code: '100', name: 'Cash' },
      { type: 'bank', code: '101', name: 'Bank' },
      { type: 'mobile', code: '102', name: 'Mobile Payment' },
      { type: 'receivable', code: '110', name: 'Accounts Receivable' },
      { type: 'payable', code: '200', name: 'Accounts Payable' },
      { type: 'income', code: '400', name: 'Income' },
      { type: 'revenue', code: '500', name: 'Revenue' },
      { type: 'expense', code: '600', name: 'Expense' },
      { type: 'cogs', code: '601', name: 'Cost of Goods Sold' },
      { type: 'inventory', code: '150', name: 'Inventory' },
    ]

    for (const acc of defaultAccounts) {
      await client.query(
        `INSERT INTO accounts (id, business_id, code, name, type, currency, active, created_at, server_version)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'IDR', true, now(), 1)
         ON CONFLICT (business_id, code) DO NOTHING`,
        [businessId, acc.code, acc.name, acc.type]
      )
    }
  },

  async findById(client: PoolClient, businessId: string, accountId: string): Promise<{ id: string; business_id: string; code: string; name: string; type: string; currency: string; active: boolean } | null> {
    const result = await client.query(
      `SELECT id, business_id, code, name, type, currency, active
       FROM accounts
       WHERE id = $1 AND business_id = $2`,
      [accountId, businessId]
    )
    return result.rows[0] || null
  },

  async findByCode(client: PoolClient, businessId: string, code: string): Promise<{ id: string; type: string } | null> {
    const result = await client.query(
      `SELECT id, type FROM accounts WHERE business_id = $1 AND code = $2`,
      [businessId, code]
    )
    return result.rows[0] || null
  },

  async findByType(client: PoolClient, businessId: string, type: AccountType): Promise<{ id: string; code: string; name: string } | null> {
    const result = await client.query(
      `SELECT id, code, name FROM accounts WHERE business_id = $1 AND type = $2 AND active = true`,
      [businessId, type]
    )
    return result.rows[0] || null
  },

  async listAccounts(client: PoolClient, businessId: string, limit: number = 50, offset: number = 0): Promise<{ items: any[]; total: number }> {
    const countResult = await client.query(
      `SELECT COUNT(*) FROM accounts WHERE business_id = $1`,
      [businessId]
    )
    const total = parseInt(countResult.rows[0].count, 10)

    const result = await client.query(
      `SELECT id, code, name, type, currency, active, created_at
       FROM accounts
       WHERE business_id = $1
       ORDER BY code
       LIMIT $2 OFFSET $3`,
      [businessId, limit + 1, offset]
    )

    return {
      items: result.rows.slice(0, limit),
      total
    }
  },

  async getAccountBalance(client: PoolClient, businessId: string, accountId: string): Promise<AccountBalanceDto> {
    const result = await client.query(
      `SELECT
         a.id as account_id,
         a.code as account_code,
         a.name as account_name,
         a.type as account_type,
         COALESCE(SUM(posted_lines.debit_minor), 0) as debit_total,
         COALESCE(SUM(posted_lines.credit_minor), 0) as credit_total
       FROM accounts a
       LEFT JOIN (
         SELECT jl.account_id, jl.debit_minor, jl.credit_minor
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
       ) posted_lines ON posted_lines.account_id = a.id
       WHERE a.id = $1 AND a.business_id = $2
       GROUP BY a.id, a.code, a.name, a.type`,
      [accountId, businessId]
    )

    if (!result.rows[0]) {
      throw new Error('Account not found')
    }

    const row = result.rows[0]
    const debitTotal = Number(row.debit_total)
    const creditTotal = Number(row.credit_total)

    return {
      account_id: row.account_id,
      account_code: row.account_code,
      account_name: row.account_name,
      account_type: row.account_type,
      debit_total: debitTotal,
      credit_total: creditTotal,
      balance: debitTotal - creditTotal
    }
  },

  async getCashflow(
    client: PoolClient,
    businessId: string,
    branchId: string | null = null,
    fromDate: string | null = null,
    toDate: string | null = null
  ): Promise<CashflowEntryDto[]> {
    const branchCondition = branchId ? ` AND je.branch_id = $4` : ' AND $4::uuid IS NULL'

    const result = await client.query(
      `SELECT
         jl.id as journal_line_id,
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
       JOIN accounts a ON a.id = jl.account_id
       WHERE je.business_id = $1
         AND je.status = 'posted'
         AND a.type IN ('cash', 'bank', 'mobile')
         AND ($2::date IS NULL OR je.date >= $2)
         AND ($3::date IS NULL OR je.date <= $3)
         AND ($4::uuid IS NULL OR je.branch_id = $4)
       ORDER BY je.date, jl.id`,
      [businessId, fromDate, toDate, branchId]
    )

    return result.rows.map(row => ({
      journal_entry_id: row.journal_entry_id,
      date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
      account_id: row.account_id,
      account_code: row.account_code,
      account_name: row.account_name,
      account_type: row.account_type,
      debit_minor: Number(row.debit_minor),
      credit_minor: Number(row.credit_minor),
      net_flow: Number(row.net_flow),
      description: row.description
    }))
  },

  async getAccountBalances(client: PoolClient, businessId: string): Promise<AccountBalanceDto[]> {
    const result = await client.query(
      `SELECT
         a.id as account_id,
         a.code as account_code,
         a.name as account_name,
         a.type as account_type,
         COALESCE(SUM(CASE WHEN jl.debit_minor > 0 THEN jl.debit_minor ELSE 0 END), 0) as debit_total,
         COALESCE(SUM(CASE WHEN jl.credit_minor > 0 THEN jl.credit_minor ELSE 0 END), 0) as credit_total
       FROM accounts a
       LEFT JOIN journal_lines jl ON jl.account_id = a.id
       LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE a.business_id = $1 AND je.status = 'posted'
       GROUP BY a.id, a.code, a.name, a.type
       HAVING COALESCE(SUM(CASE WHEN jl.debit_minor > 0 THEN jl.debit_minor ELSE 0 END), 0) +
              COALESCE(SUM(CASE WHEN jl.credit_minor > 0 THEN jl.credit_minor ELSE 0 END), 0) > 0
       ORDER BY a.code`,
      [businessId]
    )

    return result.rows.map(row => ({
      account_id: row.account_id,
      account_code: row.account_code,
      account_name: row.account_name,
      account_type: row.account_type,
      debit_total: Number(row.debit_total),
      credit_total: Number(row.credit_total),
      balance: Number(row.debit_total) - Number(row.credit_total)
    }))
  },

  async getFinanceSummary(client: PoolClient, businessId: string): Promise<FinanceSummaryDto> {
    const result = await client.query(
      `SELECT
         COALESCE(SUM(CASE WHEN a.type IN ('cash', 'bank', 'mobile', 'receivable', 'inventory') THEN
           posted_lines.debit_minor - posted_lines.credit_minor ELSE 0 END), 0) as total_assets,
         COALESCE(SUM(CASE WHEN a.type = 'payable' THEN
           posted_lines.credit_minor - posted_lines.debit_minor ELSE 0 END), 0) as total_liabilities,
         COALESCE(SUM(CASE WHEN a.type IN ('revenue', 'income') THEN
           posted_lines.credit_minor - posted_lines.debit_minor ELSE 0 END), 0) as total_revenue,
         COALESCE(SUM(CASE WHEN a.type IN ('expense', 'cogs') THEN
           posted_lines.debit_minor - posted_lines.credit_minor ELSE 0 END), 0) as total_expense,
         COALESCE(SUM(CASE WHEN a.type IN ('cash', 'bank', 'mobile') THEN
           posted_lines.debit_minor ELSE 0 END), 0) as cash_inflow,
         COALESCE(SUM(CASE WHEN a.type IN ('cash', 'bank', 'mobile') THEN
           posted_lines.credit_minor ELSE 0 END), 0) as cash_outflow
       FROM accounts a
       LEFT JOIN (
         SELECT jl.account_id, jl.debit_minor, jl.credit_minor
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
       ) posted_lines ON posted_lines.account_id = a.id
       WHERE a.business_id = $1`,
      [businessId]
    )

    const row = result.rows[0]
    const totalAssets = Number(row.total_assets)
    const totalLiabilities = Number(row.total_liabilities)
    const totalRevenue = Number(row.total_revenue)
    const totalExpense = Number(row.total_expense)
    const cashInflow = Number(row.cash_inflow)
    const cashOutflow = Number(row.cash_outflow)

    return {
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      total_equity: totalRevenue - totalExpense,
      total_revenue: totalRevenue,
      total_expense: totalExpense,
      net_income: totalRevenue - totalExpense,
      cash_inflow: cashInflow,
      cash_outflow: cashOutflow,
      net_cash_flow: cashInflow - cashOutflow
    }
  },

  async updateAccount(client: PoolClient, businessId: string, accountId: string, params: {
    name?: string
    code?: string
    active?: boolean
    expected_server_version: number
  }): Promise<{ server_version: number } | null> {
    const setClauses: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    if (params.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`)
      queryParams.push(params.name)
      paramIndex++
    }

    if (params.code !== undefined) {
      setClauses.push(`code = $${paramIndex}`)
      queryParams.push(params.code)
      paramIndex++
    }

    if (params.active !== undefined) {
      setClauses.push(`active = $${paramIndex}`)
      queryParams.push(params.active)
      paramIndex++
    }

    if (setClauses.length === 0) {
      throw new Error('No fields to update')
    }

    setClauses.push(`server_version = server_version + 1`)
    setClauses.push(`updated_at = now()`)

    queryParams.push(accountId)
    queryParams.push(businessId)
    queryParams.push(params.expected_server_version)

    const result = await client.query(
      `UPDATE accounts
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND business_id = $${paramIndex + 1} AND server_version = $${paramIndex + 2}
       RETURNING server_version`,
      queryParams
    )

    if (!result.rows[0]) {
      return null
    }

    return { server_version: Number(result.rows[0].server_version) }
  }
}