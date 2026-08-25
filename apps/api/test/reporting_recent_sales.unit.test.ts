import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createReportService } from '../src/services/report_service'
import { branchRepository } from '../src/repositories/branch_repository'
import { Pool, PoolClient } from 'pg'

describe('PHASE 2C — Recent Sales Reporting Unit Tests', () => {
  const businessId = '11111111-1111-4111-8111-111111111111'
  const branch1Id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
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
                payment_method: 'CASH',
                cashier_id: 'cashier-1',
                created_at: new Date('2026-08-25T12:00:00Z'),
                branch_id: null, // historical sale with null branch
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

  describe('REPORT-RECENT-001: tenant-wide recent sales without branch_id', () => {
    it('queries sales across tenant without branch_id filter when omitted', async () => {
      const reportService = createReportService(mockPool)
      const res = await reportService.getRecentSales(businessId, {})

      expect(res.sales).toBeDefined()
      expect(res.sales.length).toBe(2)

      const recentQuery = queryHistory.find((q) => q.text.includes('ORDER BY created_at DESC, id DESC'))
      expect(recentQuery).toBeDefined()
      expect(recentQuery!.text).not.toContain('sales.branch_id =')
      expect(recentQuery!.params).toEqual([businessId, 10])
    })
  })

  describe('REPORT-RECENT-002: branch-scoped recent sales', () => {
    it('includes sales.branch_id filter when valid branch_id is provided', async () => {
      vi.spyOn(branchRepository, 'findById').mockResolvedValueOnce({
        id: branch1Id,
        business_id: businessId,
        name: 'Branch 1',
        status: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const reportService = createReportService(mockPool)
      const res = await reportService.getRecentSales(businessId, { branch_id: branch1Id })

      expect(res.sales.length).toBe(2)
      const recentQuery = queryHistory.find((q) => q.text.includes('ORDER BY created_at DESC, id DESC'))
      expect(recentQuery).toBeDefined()
      expect(recentQuery!.text).toContain('sales.branch_id = $2')
      expect(recentQuery!.params).toEqual([businessId, branch1Id, 10])
    })
  })

  describe('REPORT-RECENT-003: foreign branch rejected with 403', () => {
    it('throws BUSINESS_ACCESS_DENIED when branch does not belong to business', async () => {
      vi.spyOn(branchRepository, 'findById').mockResolvedValueOnce(null)

      const reportService = createReportService(mockPool)
      await expect(
        reportService.getRecentSales(businessId, { branch_id: foreignBranchId })
      ).rejects.toThrow('Branch not found or access denied')
    })
  })

  describe('REPORT-RECENT-004: invalid UUID rejected with 400', () => {
    it('validates UUID format correctly', () => {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      expect(UUID_REGEX.test('BRANCH-001')).toBe(false)
      expect(UUID_REGEX.test('')).toBe(false)
      expect(UUID_REGEX.test('invalid')).toBe(false)
      expect(UUID_REGEX.test(branch1Id)).toBe(true)
    })
  })

  describe('REPORT-RECENT-005: default limit = 10', () => {
    it('uses 10 as default limit parameter', async () => {
      const reportService = createReportService(mockPool)
      await reportService.getRecentSales(businessId, {})

      const recentQuery = queryHistory.find((q) => q.text.includes('ORDER BY created_at DESC, id DESC'))
      expect(recentQuery!.params![1]).toBe(10)
    })
  })

  describe('REPORT-RECENT-006: maximum limit = 50', () => {
    it('caps limit at 50 even if higher limit is requested', async () => {
      const reportService = createReportService(mockPool)
      await reportService.getRecentSales(businessId, { limit: 100 })

      const recentQuery = queryHistory.find((q) => q.text.includes('ORDER BY created_at DESC, id DESC'))
      expect(recentQuery!.params![1]).toBe(50)
    })

    it('respects requested limit when within allowed range', async () => {
      const reportService = createReportService(mockPool)
      await reportService.getRecentSales(businessId, { limit: 25 })

      const recentQuery = queryHistory.find((q) => q.text.includes('ORDER BY created_at DESC, id DESC'))
      expect(recentQuery!.params![1]).toBe(25)
    })
  })

  describe('REPORT-RECENT-007: created_at DESC ordering', () => {
    it('orders by created_at DESC in SQL query', async () => {
      const reportService = createReportService(mockPool)
      await reportService.getRecentSales(businessId, {})

      const recentQuery = queryHistory.find((q) => q.text.includes('ORDER BY created_at DESC, id DESC'))
      expect(recentQuery).toBeDefined()
      expect(recentQuery!.text).toContain('ORDER BY created_at DESC, id DESC')
    })
  })

  describe('REPORT-RECENT-008: deterministic ordering when timestamps are equal', () => {
    it('includes secondary id DESC ordering in SQL', async () => {
      const reportService = createReportService(mockPool)
      await reportService.getRecentSales(businessId, {})

      const recentQuery = queryHistory.find((q) => q.text.includes('ORDER BY created_at DESC, id DESC'))
      expect(recentQuery!.text).toContain(', id DESC')
    })
  })

  describe('REPORT-RECENT-009: historical branch_id NULL is returned safely', () => {
    it('serializes null branch_id without errors', async () => {
      const reportService = createReportService(mockPool)
      const res = await reportService.getRecentSales(businessId, {})

      const historicalSale = res.sales.find((s) => s.id === 'sale-001')
      expect(historicalSale).toBeDefined()
      expect(historicalSale!.branch_id).toBeNull()
      expect(historicalSale!.total_minor).toBe(2500000)
    })
  })

  describe('REPORT-RECENT-010: empty result returns []', () => {
    it('returns empty sales array when no records exist', async () => {
      mockClient.query = vi.fn(async (text: string) => {
        if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] }
        return { rows: [] }
      })

      const reportService = createReportService(mockPool)
      const res = await reportService.getRecentSales(businessId, {})

      expect(res.sales).toEqual([])
    })
  })
})
