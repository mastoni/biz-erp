import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSalesSyncService } from '../src/services/sales_sync_service'
import { createReportService } from '../src/services/report_service'
import { branchRepository } from '../src/repositories/branch_repository'
import { saleRepository } from '../src/repositories/sale_repository'
import { Pool, PoolClient } from 'pg'
import { ApiError } from '../src/errors/api_error'
import { isUuid } from '../src/utils/uuid'

describe('PHASE 5B — Sales Contract & Backend Foundation Unit Tests', () => {
  const businessId = '11111111-1111-4111-8111-111111111111'
  const branch1Id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const branch2Id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const foreignBranchId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

  let mockClient: any
  let mockPool: any
  let queryHistory: Array<{ text: string; params?: any[] }>

  beforeEach(() => {
    queryHistory = []
    mockClient = {
      query: vi.fn(async (text: string, params?: any[]) => {
        queryHistory.push({ text, params })
        if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
          return { rows: [] }
        }

        // Daily sales aggregation mock
        if (text.includes("TO_CHAR(created_at, 'YYYY-MM-DD') as date_str")) {
          return {
            rows: [
              { date_str: '2026-08-20', total_revenue_minor: 5800000, transaction_count: 5 },
              { date_str: '2026-08-22', total_revenue_minor: 6400000, transaction_count: 6 },
            ],
          }
        }

        // Sales summary mock
        if (text.includes('total_sales') || text.includes('average_order_value_minor')) {
          return {
            rows: [
              {
                total_sales: 11,
                total_revenue_minor: 12200000,
                total_items_sold: 25,
                average_order_value_minor: 1109090,
              },
            ],
          }
        }

        // Payment method breakdown mock
        if (text.includes('payment_method') && text.includes('GROUP BY payment_method')) {
          return {
            rows: [
              { payment_method: 'Tunai', count: 6, total_minor: 7000000 },
              { payment_method: 'QRIS', count: 5, total_minor: 5200000 },
            ],
          }
        }

        // Recent sales mock
        if (text.includes('FROM sales') && text.includes('ORDER BY created_at DESC, id DESC')) {
          return {
            rows: [
              {
                id: 'sale-002',
                receipt_number: 'REC-002',
                total_minor: 5000000,
                payment_method: 'QRIS',
                cashier_id: 'cashier-1',
                created_at: new Date('2026-08-25T14:00:00Z'),
                branch_id: branch1Id,
              },
              {
                id: 'sale-001',
                receipt_number: 'REC-001',
                total_minor: 2500000,
                payment_method: 'Tunai',
                cashier_id: 'cashier-2',
                created_at: new Date('2026-08-25T12:00:00Z'),
                branch_id: null,
              },
            ],
          }
        }

        // Sync sales pull query mock
        if (text.includes('FROM sales s') && text.includes('ORDER BY s.server_created_at ASC')) {
          return {
            rows: [
              {
                id: 'sale-001',
                branch_id: branch1Id,
                receipt_number: 'TRX-88231',
                subtotal_minor: 48000,
                discount_minor: 0,
                tax_minor: 0,
                total_minor: 48000,
                payment_method: 'Tunai',
                paid_minor: 50000,
                change_minor: 2000,
                cashier_id: 'Rani',
                customer_id: null,
                client_created_at: new Date('2026-08-26T10:00:00Z'),
                server_created_at: new Date('2026-08-26T10:00:01Z'),
                idempotency_key: 'idem-001',
              },
              {
                id: 'sale-002',
                branch_id: null,
                receipt_number: 'TRX-88230',
                subtotal_minor: 24000,
                discount_minor: 0,
                tax_minor: 0,
                total_minor: 24000,
                payment_method: 'QRIS',
                paid_minor: 24000,
                change_minor: 0,
                cashier_id: 'Dimas',
                customer_id: null,
                client_created_at: new Date('2026-08-26T09:30:00Z'),
                server_created_at: new Date('2026-08-26T09:30:02Z'),
                idempotency_key: 'idem-002',
              },
            ],
          }
        }

        // Sale items mock
        if (text.includes('FROM sale_items')) {
          return {
            rows: [
              {
                sale_id: 'sale-001',
                product_id: 'prod-001',
                product_name: 'Kopi Susu',
                quantity: 2,
                unit_price_minor: 24000,
              },
              {
                sale_id: 'sale-002',
                product_id: 'prod-002',
                product_name: 'Roti Bakar',
                quantity: 1,
                unit_price_minor: 24000,
              },
            ],
          }
        }

        return { rows: [] }
      }),
      release: vi.fn(),
    }

    mockPool = {
      connect: vi.fn(async () => mockClient as unknown as PoolClient),
    } as unknown as Pool
  })

  // SALES-CONTRACT-001: sync/sales branch filter
  describe('SALES-CONTRACT-001: sync/sales branch filter', () => {
    it('applies branch_id filter in SQL query when branch_id is supplied', async () => {
      vi.spyOn(branchRepository, 'findById').mockResolvedValueOnce({
        id: branch1Id,
        business_id: businessId,
        name: 'Branch 1',
        status: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const syncService = createSalesSyncService(mockPool)
      const res = await syncService.pullSales(businessId, 0, 100, branch1Id)

      expect(res.sales).toBeDefined()
      const query = queryHistory.find((q) => q.text.includes('FROM sales s') && q.text.includes('s.branch_id = $4'))
      expect(query).toBeDefined()
      expect(query!.params).toEqual([businessId, new Date(0), 101, branch1Id])
    })
  })

  // SALES-CONTRACT-002: foreign branch rejected
  describe('SALES-CONTRACT-002: foreign branch rejected', () => {
    it('throws 403 BUSINESS_ACCESS_DENIED when branch does not belong to tenant', async () => {
      vi.spyOn(branchRepository, 'findById').mockResolvedValueOnce(null)

      const syncService = createSalesSyncService(mockPool)
      await expect(
        syncService.pullSales(businessId, 0, 100, foreignBranchId)
      ).rejects.toThrow('Branch not found or access denied')
    })
  })

  // SALES-CONTRACT-003: invalid branch UUID rejected
  describe('SALES-CONTRACT-003: invalid branch UUID rejected', () => {
    it('validates UUID regex check', () => {
      expect(isUuid('BRANCH-001')).toBe(false)
      expect(isUuid('')).toBe(false)
      expect(isUuid('invalid-uuid')).toBe(false)
      expect(isUuid(branch1Id)).toBe(true)
    })
  })

  // SALES-CONTRACT-004: sync cursor unchanged
  describe('SALES-CONTRACT-004: sync cursor unchanged', () => {
    it('preserves since timestamp and limit cursor pagination semantics', async () => {
      const sinceMs = 1771923000000
      const limit = 50

      const syncService = createSalesSyncService(mockPool)
      const res = await syncService.pullSales(businessId, sinceMs, limit)

      expect(res.sales).toBeDefined()
      const query = queryHistory.find((q) => q.text.includes('FROM sales s'))
      expect(query).toBeDefined()
      expect(query!.text).not.toContain('s.branch_id =')
      expect(query!.params).toEqual([businessId, new Date(sinceMs), limit + 1])
    })
  })

  // SALES-CONTRACT-005: sales-daily tenant-wide
  describe('SALES-CONTRACT-005: sales-daily tenant-wide', () => {
    it('aggregates daily sales across entire tenant when branch_id is omitted', async () => {
      const reportService = createReportService(mockPool)
      const res = await reportService.getDailySales(businessId, { from: '2026-08-20', to: '2026-08-22' })

      expect(res.points).toBeDefined()
      const query = queryHistory.find((q) => q.text.includes("TO_CHAR(created_at, 'YYYY-MM-DD')"))
      expect(query).toBeDefined()
      expect(query!.text).not.toContain('sales.branch_id =')
      expect(query!.params).toEqual([businessId, '2026-08-20', '2026-08-22'])
    })
  })

  // SALES-CONTRACT-006: sales-daily branch scoped
  describe('SALES-CONTRACT-006: sales-daily branch scoped', () => {
    it('includes sales.branch_id filter in SQL when branch_id is provided', async () => {
      vi.spyOn(branchRepository, 'findById').mockResolvedValueOnce({
        id: branch1Id,
        business_id: businessId,
        name: 'Branch 1',
        status: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const reportService = createReportService(mockPool)
      const res = await reportService.getDailySales(businessId, {
        from: '2026-08-20',
        to: '2026-08-22',
        branch_id: branch1Id,
      })

      expect(res.points).toBeDefined()
      const query = queryHistory.find((q) => q.text.includes("TO_CHAR(created_at, 'YYYY-MM-DD')"))
      expect(query).toBeDefined()
      expect(query!.text).toContain('sales.branch_id = $4')
      expect(query!.params).toEqual([businessId, '2026-08-20', '2026-08-22', branch1Id])
    })
  })

  // SALES-CONTRACT-007: sales-daily zero-filled dates
  describe('SALES-CONTRACT-007: sales-daily zero-filled dates', () => {
    it('returns zero values for days without recorded transactions', async () => {
      const reportService = createReportService(mockPool)
      const res = await reportService.getDailySales(businessId, { from: '2026-08-20', to: '2026-08-22' })

      // DB mock returned 2026-08-20 and 2026-08-22, 2026-08-21 should be zero-filled
      expect(res.points.length).toBe(3)
      expect(res.points[0]).toEqual({ date: '2026-08-20', total_revenue_minor: 5800000, transaction_count: 5 })
      expect(res.points[1]).toEqual({ date: '2026-08-21', total_revenue_minor: 0, transaction_count: 0 })
      expect(res.points[2]).toEqual({ date: '2026-08-22', total_revenue_minor: 6400000, transaction_count: 6 })
    })
  })

  // SALES-CONTRACT-008: sales-daily deterministic ordering
  describe('SALES-CONTRACT-008: sales-daily deterministic ordering', () => {
    it('guarantees strictly ascending date order for all points', async () => {
      const reportService = createReportService(mockPool)
      const res = await reportService.getDailySales(businessId, { from: '2026-08-01', to: '2026-08-07' })

      expect(res.points.length).toBe(7)
      for (let i = 0; i < res.points.length; i++) {
        const expectedDate = '2026-08-0' + (i + 1)
        expect(res.points[i].date).toBe(expectedDate)
      }
    })
  })

  // SALES-CONTRACT-009: sales-summary branch scope preserved
  describe('SALES-CONTRACT-009: sales-summary branch scope preserved', () => {
    it('maintains existing sales-summary KPIs and payment methods aggregation with branch filter', async () => {
      vi.spyOn(branchRepository, 'findById').mockResolvedValueOnce({
        id: branch1Id,
        business_id: businessId,
        name: 'Branch 1',
        status: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const reportService = createReportService(mockPool)
      const summary = await reportService.getSalesSummary(businessId, {
        from: '2026-08-01',
        to: '2026-08-31',
        branch_id: branch1Id,
      })

      expect(summary.total_sales).toBe(11)
      expect(summary.total_revenue_minor).toBe(12200000)
      expect(summary.average_order_value_minor).toBe(1109090)
      expect(summary.payment_methods.length).toBe(2)
      expect(summary.payment_methods[0].payment_method).toBe('Tunai')

      const summaryQuery = queryHistory.find((q) => q.text.includes('FROM sales') && q.text.includes('sales.branch_id = $4'))
      expect(summaryQuery).toBeDefined()
    })
  })

  // SALES-CONTRACT-010: recent-sales branch scope preserved
  describe('SALES-CONTRACT-010: recent-sales branch scope preserved', () => {
    it('maintains existing recent-sales endpoint with branch filter', async () => {
      vi.spyOn(branchRepository, 'findById').mockResolvedValueOnce({
        id: branch1Id,
        business_id: businessId,
        name: 'Branch 1',
        status: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const reportService = createReportService(mockPool)
      const recent = await reportService.getRecentSales(businessId, { branch_id: branch1Id, limit: 10 })

      expect(recent.sales.length).toBe(2)
      const recentQuery = queryHistory.find((q) => q.text.includes('ORDER BY created_at DESC, id DESC'))
      expect(recentQuery).toBeDefined()
      expect(recentQuery!.text).toContain('sales.branch_id = $2')
      expect(recentQuery!.params).toEqual([businessId, branch1Id, 10])
    })
  })

  // SALES-CONTRACT-011: tenant isolation
  describe('SALES-CONTRACT-011: tenant isolation', () => {
    it('always scopes sales and report queries strictly to business_id = $1', async () => {
      const syncService = createSalesSyncService(mockPool)
      await syncService.pullSales(businessId, 0, 100)

      const salesQuery = queryHistory.find((q) => q.text.includes('FROM sales s'))
      expect(salesQuery).toBeDefined()
      expect(salesQuery!.text).toContain('WHERE s.business_id = $1')
      expect(salesQuery!.params![0]).toBe(businessId)

      const reportService = createReportService(mockPool)
      await reportService.getDailySales(businessId, { from: '2026-08-01', to: '2026-08-05' })

      const dailyQuery = queryHistory.find((q) => q.text.includes("TO_CHAR(created_at, 'YYYY-MM-DD')"))
      expect(dailyQuery).toBeDefined()
      expect(dailyQuery!.text).toContain('WHERE business_id = $1')
      expect(dailyQuery!.params![0]).toBe(businessId)
    })
  })

  // SALES-CONTRACT-012: historical null branch compatibility
  describe('SALES-CONTRACT-012: historical null branch compatibility', () => {
    it('correctly includes sales with null branch_id when branch filter is omitted', async () => {
      const syncService = createSalesSyncService(mockPool)
      const res = await syncService.pullSales(businessId, 0, 100)

      const nullBranchSale = res.sales.find((s) => s.id === 'sale-002')
      expect(nullBranchSale).toBeDefined()
      expect(nullBranchSale!.branch_id).toBeNull()
      expect(nullBranchSale!.receipt_number).toBe('TRX-88230')
      expect(nullBranchSale!.items.length).toBe(1)
      expect(nullBranchSale!.items[0].product_name_snapshot).toBe('Roti Bakar')
    })
  })
})
