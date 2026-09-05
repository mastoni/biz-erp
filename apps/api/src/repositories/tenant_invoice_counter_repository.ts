import { PoolClient } from 'pg'

export const tenantInvoiceCounterRepository = {
  /**
   * Allocates the next monotonic sequence number for a tenant in a given year/month.
   * Uses atomic row-level locking UPSERT.
   * If the enclosing transaction rolls back, this increment rolls back automatically.
   */
  async allocateNextSequence(
    client: PoolClient,
    businessId: string,
    yearMonth: string
  ): Promise<number> {
    const sql = `
      INSERT INTO tenant_invoice_counters (business_id, year_month, last_seq, created_at, updated_at)
      VALUES ($1, $2, 1, now(), now())
      ON CONFLICT (business_id, year_month)
      DO UPDATE SET last_seq = tenant_invoice_counters.last_seq + 1, updated_at = now()
      RETURNING last_seq;
    `
    const res = await client.query(sql, [businessId, yearMonth])
    return Number(res.rows[0].last_seq)
  },

  /**
   * Formats a tenant sequence number into canonical invoice number: INV-YYYYMM-XXXX
   */
  formatInvoiceNumber(yearMonth: string, seq: number): string {
    const padded = String(seq).padStart(4, '0')
    return `INV-${yearMonth}-${padded}`
  }
}
