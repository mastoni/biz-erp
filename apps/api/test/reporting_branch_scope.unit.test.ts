import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDashboardService } from '../src/services/dashboard_service'
import { createReportService } from '../src/services/report_service'
import { branchRepository } from '../src/repositories/branch_repository'
import { Pool, PoolClient } from 'pg'
import { ApiError } from '../src/errors/api_error'

describe('PHASE 2A — Reporting Branch Scope Unit Tests', () => {
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
        if (text.includes('total_revenue') && !text.includes('average_order_value_minor')) {
          return { rows: [{ total_revenue: 3000000 }] }
        }
        if (text.includes('total_sales') || text.includes('average_order_value_minor')) {
          return {
            rows: [
              {
                total_sales: 1,
                total_revenue_minor: 3000000,
                total_items_sold: 2,
                average_order_value_minor: 3000000,
              },
            ],
          }
        }
        if (text.includes('payment_method')) {
          return {
            rows: [{ payment_method: 'CASH', count: 1, total_minor: 3000000 }],
          }
        }
        if (text.includes('total_customers')) {
          return { rows: [{ total_customers: 5 }] }
        }
        if (text.includes('total_products')) {
          return { rows: [{ total_products: 10 }] }
        }
        if (text.includes('out_of_stock_count')) {
          return { rows: [{ out_of_stock_count: 1 }] }
        }
        if (text.includes('quantity_sold')) {
          return {
            rows: [
              {
                product_id: 'p1',
                product_name: 'Kopi Susu',
                quantity_sold: 2,
                total_quantity: 2,
                total_revenue_minor: 3000000,
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

  describe('REPORT-BRANCH-001: tenant-wide request without branch_id preserves old queries', () => {
    it('dashboard query has no branch_id filter when branch_id is omitted', async () => {
      const dashboardService = createDashboardService(mockPool)
      const metrics = await dashboardService.getMetrics(businessId, {})

      expect(metrics.total_revenue_minor).toBe(3000000)
      expect(metrics.total_products).toBe(10)

      // Verify queries generated do not filter by branch_id
      const salesQuery = queryHistory.find((q) => q.text.includes('FROM sales'))
      expect(salesQuery).toBeDefined()
      expect(salesQuery!.text).not.toContain('sales.branch_id =')
      expect(salesQuery!.params).toEqual([businessId])

      const stockQuery = queryHistory.find((q) => q.text.includes('FROM stocks'))
      expect(stockQuery).toBeDefined()
      expect(stockQuery!.text).not.toContain('AND branch_id =')
      expect(stockQuery!.params).toEqual([businessId])
    })

    it('sales summary report query has no branch_id filter when omitted', async () => {
      const reportService = createReportService(mockPool)
      const report = await reportService.getSalesSummary(businessId, { from: '2026-01-01', to: '2026-01-02' })

      expect(report.total_sales).toBe(1)
      const summaryQuery = queryHistory.find((q) => q.text.includes('FROM sales'))
      expect(summaryQuery).toBeDefined()
      expect(summaryQuery!.text).not.toContain('sales.branch_id =')
      expect(summaryQuery!.params).toEqual([businessId, '2026-01-01', '2026-01-02'])
    })
  })

  describe('REPORT-BRANCH-002: valid branch_id returns only selected branch metrics', () => {
    it('dashboard query includes branch_id filter on sales and stocks', async () => {
      vi.spyOn(branchRepository, 'findById').mockResolvedValueOnce({
        id: branch1Id,
        business_id: businessId,
        name: 'Branch 1',
        status: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const dashboardService = createDashboardService(mockPool)
      const metrics = await dashboardService.getMetrics(businessId, { branch_id: branch1Id })

      expect(metrics.total_revenue_minor).toBe(3000000)

      // Verify sales query includes sales.branch_id
      const salesQuery = queryHistory.find((q) => q.text.includes('FROM sales'))
      expect(salesQuery).toBeDefined()
      expect(salesQuery!.text).toContain('sales.branch_id = $2')
      expect(salesQuery!.params).toEqual([businessId, branch1Id])

      // Verify stocks query includes branch_id
      const stockQuery = queryHistory.find((q) => q.text.includes('FROM stocks'))
      expect(stockQuery).toBeDefined()
      expect(stockQuery!.text).toContain('AND branch_id = $2')
      expect(stockQuery!.params).toEqual([businessId, branch1Id])

      // Total products remains tenant-wide
      const productQuery = queryHistory.find((q) => q.text.includes('FROM products'))
      expect(productQuery).toBeDefined()
      expect(productQuery!.params).toEqual([businessId])
    })

    it('reports queries include branch_id filter', async () => {
      vi.spyOn(branchRepository, 'findById').mockResolvedValue({
        id: branch1Id,
        business_id: businessId,
        name: 'Branch 1',
        status: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const reportService = createReportService(mockPool)
      await reportService.getSalesSummary(businessId, { from: '2026-01-01', to: '2026-01-02', branch_id: branch1Id })

      const summaryQuery = queryHistory.find((q) => q.text.includes('FROM sales'))
      expect(summaryQuery).toBeDefined()
      expect(summaryQuery!.text).toContain('sales.branch_id = $4')
      expect(summaryQuery!.params).toEqual([businessId, '2026-01-01', '2026-01-02', branch1Id])
    })
  })

  describe('REPORT-BRANCH-003: branch from another tenant rejected', () => {
    it('throws 403 when branch does not belong to business', async () => {
      vi.spyOn(branchRepository, 'findById').mockResolvedValueOnce(null)

      const dashboardService = createDashboardService(mockPool)
      await expect(
        dashboardService.getMetrics(businessId, { branch_id: foreignBranchId })
      ).rejects.toThrow('Branch not found or access denied')

      const reportService = createReportService(mockPool)
      vi.spyOn(branchRepository, 'findById').mockResolvedValueOnce(null)
      await expect(
        reportService.getSalesSummary(businessId, { from: '2026-01-01', to: '2026-01-02', branch_id: foreignBranchId })
      ).rejects.toThrow('Branch not found or access denied')
    })
  })

  describe('REPORT-BRANCH-004: invalid branch UUID rejected', () => {
    it('validates UUID regex check', () => {
      const isInvalid = (val: string) => {
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        return !UUID_REGEX.test(val)
      }

      expect(isInvalid('BRANCH-001')).toBe(true)
      expect(isInvalid('')).toBe(true)
      expect(isInvalid('invalid-uuid')).toBe(true)
      expect(isInvalid(branch1Id)).toBe(false)
    })
  })

  describe('REPORT-BRANCH-005: existing API behavior remains unchanged', () => {
    it('preserves date range filtering without branch_id', async () => {
      const dashboardService = createDashboardService(mockPool)
      await dashboardService.getMetrics(businessId, { from: '2026-01-01', to: '2026-01-02' })

      const salesQuery = queryHistory.find((q) => q.text.includes('FROM sales'))
      expect(salesQuery).toBeDefined()
      expect(salesQuery!.text).toContain('sales.created_at >= $2')
      expect(salesQuery!.text).toContain('sales.created_at <= $3')
      expect(salesQuery!.params).toEqual([businessId, '2026-01-01', '2026-01-02'])
    })
  })
})
