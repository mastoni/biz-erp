import { PoolClient } from 'pg'
import { JournalStatus, JournalSourceType, JournalEntryDto, JournalLineDto } from '../dto/finance_dto'

export interface JournalLine {
  id: string
  journal_entry_id: string
  account_id: string
  debit_minor: number
  credit_minor: number
  description: string | null
}

export const journalRepository = {
  async createDraftJournal(client: PoolClient, businessId: string, params: {
    id: string
    date: string
    source_type: JournalSourceType
    source_id: string
    reference?: string | null
    description: string
    branch_id?: string | null
  }): Promise<void> {
    await client.query(
      `INSERT INTO journal_entries (id, business_id, branch_id, date, source_type, source_id, reference, description, status, created_at, server_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', now(), 1)`,
      [params.id, businessId, params.branch_id ?? null, params.date, params.source_type, params.source_id, params.reference ?? null, params.description]
    )
  },

  async addJournalLine(client: PoolClient, line: JournalLine): Promise<void> {
    await client.query(
      `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_minor, credit_minor, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [line.id, line.journal_entry_id, line.account_id, line.debit_minor, line.credit_minor, line.description ?? null]
    )
  },

  async postJournal(client: PoolClient, journalId: string): Promise<void> {
    const countResult = await client.query(
      `SELECT COUNT(*) FROM journal_lines WHERE journal_entry_id = $1`,
      [journalId]
    )
    const lineCount = parseInt(countResult.rows[0].count, 10)

    if (lineCount === 0) {
      throw new Error('Cannot post journal with no lines')
    }

    const balanceResult = await client.query(
      `SELECT
         COALESCE(SUM(debit_minor), 0) as total_debit,
         COALESCE(SUM(credit_minor), 0) as total_credit
       FROM journal_lines WHERE journal_entry_id = $1`,
      [journalId]
    )

    const totalDebit = Number(balanceResult.rows[0].total_debit)
    const totalCredit = Number(balanceResult.rows[0].total_credit)

    if (totalDebit !== totalCredit) {
      throw new Error(`Journal must be balanced: debit=${totalDebit}, credit=${totalCredit}`)
    }

    await client.query(
      `UPDATE journal_entries SET status = 'posted', server_version = server_version + 1 WHERE id = $1`,
      [journalId]
    )
  },

  async getJournalById(client: PoolClient, businessId: string, journalId: string): Promise<JournalEntryDto | null> {
    const journalResult = await client.query(
      `SELECT
         id, business_id, branch_id, date, source_type, source_id, reference, description, status,
         reversed_by, reversed_at, reversal_of, created_at, server_version
       FROM journal_entries
       WHERE id = $1 AND business_id = $2`,
      [journalId, businessId]
    )

    if (!journalResult.rows[0]) return null

    const linesResult = await client.query(
      `SELECT id, journal_entry_id, account_id, debit_minor, credit_minor, description, created_at
       FROM journal_lines
       WHERE journal_entry_id = $1`,
      [journalId]
    )

    return {
      id: journalResult.rows[0].id,
      business_id: journalResult.rows[0].business_id,
      branch_id: journalResult.rows[0].branch_id,
      date: journalResult.rows[0].date instanceof Date ? journalResult.rows[0].date.toISOString().slice(0, 10) : String(journalResult.rows[0].date).slice(0, 10),
      source_type: journalResult.rows[0].source_type,
      source_id: journalResult.rows[0].source_id,
      reference: journalResult.rows[0].reference,
      description: journalResult.rows[0].description,
      status: journalResult.rows[0].status,
      reversed_by: journalResult.rows[0].reversed_by,
      reversed_at: journalResult.rows[0].reversed_at,
      reversal_of: journalResult.rows[0].reversal_of,
      created_at: journalResult.rows[0].created_at instanceof Date ? journalResult.rows[0].created_at.toISOString() : String(journalResult.rows[0].created_at),
      server_version: Number(journalResult.rows[0].server_version),
      lines: linesResult.rows.map((row: any) => ({
        id: row.id,
        journal_entry_id: row.journal_entry_id,
        account_id: row.account_id,
        debit_minor: Number(row.debit_minor),
        credit_minor: Number(row.credit_minor),
        description: row.description,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
      }))
    }
  },

  async getJournalBySource(client: PoolClient, businessId: string, sourceType: JournalSourceType, sourceId: string): Promise<{ id: string; status: JournalStatus } | null> {
    const result = await client.query(
      `SELECT id, status FROM journal_entries WHERE business_id = $1 AND source_type = $2 AND source_id = $3`,
      [businessId, sourceType, sourceId]
    )
    return result.rows[0] || null
  },

  async getJournalByIdWithLock(client: PoolClient, businessId: string, journalId: string): Promise<{ id: string; status: JournalStatus; reversed_by: string | null } | null> {
    const result = await client.query(
      `SELECT id, status, reversed_by FROM journal_entries WHERE id = $1 AND business_id = $2 FOR UPDATE`,
      [journalId, businessId]
    )
    return result.rows[0] || null
  },

  async hasUnreversedPaymentJournals(client: PoolClient, businessId: string, receivableId: string): Promise<boolean> {
    const result = await client.query(
      `SELECT 1 FROM journal_entries je
       JOIN customer_payments cp ON cp.id = je.source_id
       WHERE je.business_id = $1
         AND je.source_type = 'CUSTOMER_PAYMENT'
         AND cp.receivable_id = $2
         AND je.status = 'posted'
         AND je.reversed_by IS NULL
       LIMIT 1`,
      [businessId, receivableId]
    )
    return result.rows.length > 0
  },

  async listJournals(client: PoolClient, businessId: string, params: {
    limit?: number
    offset?: number
    branchId?: string | null
    status?: JournalStatus
    sourceType?: JournalSourceType
  } = {}): Promise<{ items: JournalEntryDto[]; total: number; has_more: boolean }> {
    let branchCondition = ''
    let statusCondition = ''
    let sourceTypeCondition = ''
    const queryParams: any[] = [businessId]
    let paramIndex = 2

    if (params.branchId) {
      branchCondition = ` AND je.branch_id = $${paramIndex}`
      queryParams.push(params.branchId)
      paramIndex++
    }

    if (params.status) {
      statusCondition = ` AND je.status = $${paramIndex}`
      queryParams.push(params.status)
      paramIndex++
    }

    if (params.sourceType) {
      sourceTypeCondition = ` AND je.source_type = $${paramIndex}`
      queryParams.push(params.sourceType)
      paramIndex++
    }

    const countSql = `SELECT COUNT(*) FROM journal_entries je WHERE je.business_id = $1 ${branchCondition} ${statusCondition} ${sourceTypeCondition}`

    const listSql = `SELECT je.id, je.business_id, je.branch_id, je.date, je.source_type, je.source_id, je.reference, je.description, je.status,
                           je.reversed_by, je.reversed_at, je.reversal_of, je.created_at, je.server_version
                    FROM journal_entries je
                    WHERE je.business_id = $1 ${branchCondition} ${statusCondition} ${sourceTypeCondition}
                    ORDER BY je.date DESC, je.created_at DESC
                    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`

    const countResult = await client.query(countSql, queryParams)
    const total = parseInt(countResult.rows[0].count, 10)

    queryParams.push(params.limit || 50, params.offset || 0)
    const result = await client.query(listSql, queryParams)

    const journals = await Promise.all(result.rows.map(async (row: any) => {
      const linesResult = await client.query(
        `SELECT id, journal_entry_id, account_id, debit_minor, credit_minor, description, created_at
         FROM journal_lines
         WHERE journal_entry_id = $1`,
        [row.id]
      )

      return {
        id: row.id,
        business_id: row.business_id,
        branch_id: row.branch_id,
        date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
        source_type: row.source_type,
        source_id: row.source_id,
        reference: row.reference,
        description: row.description,
        status: row.status,
        reversed_by: row.reversed_by,
        reversed_at: row.reversed_at,
        reversal_of: row.reversal_of,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        server_version: Number(row.server_version),
        lines: linesResult.rows.map((lr: any) => ({
          id: lr.id,
          journal_entry_id: lr.journal_entry_id,
          account_id: lr.account_id,
          debit_minor: Number(lr.debit_minor),
          credit_minor: Number(lr.credit_minor),
          description: lr.description,
          created_at: lr.created_at instanceof Date ? lr.created_at.toISOString() : String(lr.created_at)
        }))
      }
    }))

    return {
      items: journals,
      total,
      has_more: total > (params.offset || 0) + (params.limit || 50)
    }
  },

  async createReversal(client: PoolClient, originalId: string): Promise<{ reversal_id: string }> {
    await client.query(`SELECT create_reversal($1)`, [originalId])

    const result = await client.query(
      `SELECT id FROM journal_entries WHERE reversal_of = $1 AND source_type = 'REVERSAL' ORDER BY created_at DESC LIMIT 1`,
      [originalId]
    )

    return { reversal_id: result.rows[0].id }
  },

  async listJournalLines(client: PoolClient, businessId: string, journalId: string): Promise<JournalLineDto[]> {
    const result = await client.query(
      `SELECT jl.id, jl.journal_entry_id, jl.account_id, jl.debit_minor, jl.credit_minor, jl.description, jl.created_at
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE jl.journal_entry_id = $1 AND je.business_id = $2`,
      [journalId, businessId]
    )

    return result.rows.map((row: any) => ({
      id: row.id,
      journal_entry_id: row.journal_entry_id,
      account_id: row.account_id,
      debit_minor: Number(row.debit_minor),
      credit_minor: Number(row.credit_minor),
      description: row.description,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
    }))
  }
}