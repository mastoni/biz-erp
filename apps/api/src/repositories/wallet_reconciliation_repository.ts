import { PoolClient } from 'pg'

export interface InvoiceSettlementRow {
  invoice_id: string
  invoice_number: string
  business_id: string
  invoice_status: string
  invoice_total_minor: string
  paid_at: string | null
  payment_reference: string | null
  payment_id: string | null
  payment_amount_minor: string | null
  payment_method: string | null
  payment_created_at: string | null
  wallet_ledger_id: string | null
  ledger_wallet_id: string | null
  ledger_amount: string | null
  ledger_entry_type: string | null
  ledger_transaction_type: string | null
  ledger_created_at: string | null
}

export interface SaleSettlementRow {
  sale_id: string
  receipt_number: string
  business_id: string
  sale_total_minor: string
  sale_paid_minor: string
  payment_method: string | null
  sale_wallet_id: string | null
  sale_created_at: string
  wallet_ledger_id: string | null
  ledger_wallet_id: string | null
  ledger_amount: string | null
  ledger_entry_type: string | null
  ledger_transaction_type: string | null
  ledger_created_at: string | null
}

export const walletReconciliationRepository = {
  /**
   * Fetches customer invoices, payments, and linked wallet ledgers for settlement reconciliation.
   */
  async getInvoiceSettlementData(
    client: PoolClient,
    businessId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<InvoiceSettlementRow[]> {
    const params: unknown[] = [businessId]
    let dateFilter = ''

    if (fromDate && toDate) {
      params.push(fromDate, toDate)
      dateFilter = `AND (
        (ci.issue_date >= $2 AND ci.issue_date <= $3)
        OR (wl.created_at >= $2::timestamptz AND wl.created_at <= $3::timestamptz)
      )`
    } else if (fromDate) {
      params.push(fromDate)
      dateFilter = `AND (ci.issue_date >= $2 OR wl.created_at >= $2::timestamptz)`
    } else if (toDate) {
      params.push(toDate)
      dateFilter = `AND (ci.issue_date <= $2 OR wl.created_at <= $2::timestamptz)`
    }

    const query = `
      WITH invoice_universe AS (
        -- Invoices paid via wallet or wallet ledgers referencing invoices
        SELECT
          ci.id AS invoice_id,
          ci.invoice_number,
          ci.business_id,
          ci.status AS invoice_status,
          ci.total_minor AS invoice_total_minor,
          ci.paid_at,
          ci.payment_reference,
          cp.id AS payment_id,
          cp.amount_minor AS payment_amount_minor,
          cp.method AS payment_method,
          cp.created_at AS payment_created_at,
          wl.id AS wallet_ledger_id,
          wl.wallet_id AS ledger_wallet_id,
          wl.amount AS ledger_amount,
          wl.entry_type AS ledger_entry_type,
          wl.transaction_type AS ledger_transaction_type,
          wl.created_at AS ledger_created_at
        FROM customer_invoices ci
        LEFT JOIN customer_payments cp ON cp.receivable_id = ci.receivable_id AND cp.method = 'wallet'
        LEFT JOIN wallet_ledgers wl ON (
          wl.reference_type = 'CUSTOMER_INVOICE' AND wl.reference_id = ci.id::text AND wl.entry_type = 'DEBIT'
        ) OR (
          wl.id::text = ci.payment_reference
        ) OR (
          cp.reference IS NOT NULL AND wl.id::text = cp.reference
        )
        WHERE ci.business_id = $1
          AND (ci.status = 'PAID' OR cp.id IS NOT NULL OR wl.id IS NOT NULL OR ci.payment_reference IS NOT NULL)
          ${dateFilter}

        UNION

        -- Wallet ledgers pointing to customer invoices with no direct invoice record match
        SELECT
          NULL AS invoice_id,
          COALESCE(wl.metadata->>'invoice_number', 'UNKNOWN') AS invoice_number,
          $1::uuid AS business_id,
          'UNSETTLED' AS invoice_status,
          '0' AS invoice_total_minor,
          NULL AS paid_at,
          NULL AS payment_reference,
          NULL AS payment_id,
          NULL AS payment_amount_minor,
          NULL AS payment_method,
          NULL AS payment_created_at,
          wl.id AS wallet_ledger_id,
          wl.wallet_id AS ledger_wallet_id,
          wl.amount AS ledger_amount,
          wl.entry_type AS ledger_entry_type,
          wl.transaction_type AS ledger_transaction_type,
          wl.created_at AS ledger_created_at
        FROM wallet_ledgers wl
        LEFT JOIN customer_invoices ci ON ci.id::text = wl.reference_id
        JOIN wallet_accounts wa ON wa.id = wl.wallet_id
        WHERE (wa.business_id = $1 OR (wl.metadata->>'business_id') = $1::text)
          AND wl.transaction_type = 'INVOICE_PAYMENT'
          AND wl.entry_type = 'DEBIT'
          AND ci.id IS NULL
      )
      SELECT * FROM invoice_universe
    `

    const res = await client.query(query, params)
    return res.rows
  },

  /**
   * Fetches POS sales and linked wallet ledgers for settlement reconciliation.
   */
  async getSaleSettlementData(
    client: PoolClient,
    businessId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<SaleSettlementRow[]> {
    const params: unknown[] = [businessId]
    let dateFilter = ''

    if (fromDate && toDate) {
      params.push(fromDate, toDate)
      dateFilter = `AND (
        (s.created_at >= $2::timestamptz AND s.created_at <= $3::timestamptz)
        OR (wl.created_at >= $2::timestamptz AND wl.created_at <= $3::timestamptz)
      )`
    } else if (fromDate) {
      params.push(fromDate)
      dateFilter = `AND (s.created_at >= $2::timestamptz OR wl.created_at >= $2::timestamptz)`
    } else if (toDate) {
      params.push(toDate)
      dateFilter = `AND (s.created_at <= $2::timestamptz OR wl.created_at <= $2::timestamptz)`
    }

    const query = `
      WITH sale_universe AS (
        -- Sales with wallet payment method
        SELECT
          s.id AS sale_id,
          s.receipt_number,
          s.business_id,
          s.total_minor AS sale_total_minor,
          s.paid_minor AS sale_paid_minor,
          s.payment_method,
          s.wallet_id AS sale_wallet_id,
          s.created_at AS sale_created_at,
          wl.id AS wallet_ledger_id,
          wl.wallet_id AS ledger_wallet_id,
          wl.amount AS ledger_amount,
          wl.entry_type AS ledger_entry_type,
          wl.transaction_type AS ledger_transaction_type,
          wl.created_at AS ledger_created_at
        FROM sales s
        LEFT JOIN wallet_ledgers wl ON (
          wl.reference_type = 'POS_SALE' AND wl.reference_id = s.id::text AND wl.entry_type = 'DEBIT'
        ) OR (
          wl.transaction_type = 'POS_PAYMENT' AND wl.metadata->>'sale_id' = s.id::text AND wl.entry_type = 'DEBIT'
        )
        WHERE s.business_id = $1
          AND (s.payment_method = 'wallet' OR s.wallet_id IS NOT NULL OR wl.id IS NOT NULL)
          ${dateFilter}

        UNION

        -- Wallet ledgers with POS_PAYMENT referencing missing sales
        SELECT
          NULL AS sale_id,
          COALESCE(wl.metadata->>'receipt_number', 'UNKNOWN') AS receipt_number,
          $1::uuid AS business_id,
          '0' AS sale_total_minor,
          '0' AS sale_paid_minor,
          'wallet' AS payment_method,
          wl.wallet_id AS sale_wallet_id,
          wl.created_at AS sale_created_at,
          wl.id AS wallet_ledger_id,
          wl.wallet_id AS ledger_wallet_id,
          wl.amount AS ledger_amount,
          wl.entry_type AS ledger_entry_type,
          wl.transaction_type AS ledger_transaction_type,
          wl.created_at AS ledger_created_at
        FROM wallet_ledgers wl
        LEFT JOIN sales s ON s.id::text = wl.reference_id OR (wl.metadata->>'sale_id') = s.id::text
        JOIN wallet_accounts wa ON wa.id = wl.wallet_id
        WHERE (wa.business_id = $1 OR (wl.metadata->>'business_id') = $1::text)
          AND wl.transaction_type = 'POS_PAYMENT'
          AND wl.entry_type = 'DEBIT'
          AND s.id IS NULL
      )
      SELECT * FROM sale_universe
    `

    const res = await client.query(query, params)
    return res.rows
  }
}
