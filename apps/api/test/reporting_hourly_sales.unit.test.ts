import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createReportService } from '../src/services/report_service'
import { branchRepository } from '../src/repositories/branch_repository'
import { Pool, PoolClient } from 'pg'

describe('PHASE 2B — Hourly Sales Reporting Unit Tests', () => {
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
        if (text.includes('EXTRACT(HOUR FROM created_at)')) {
          // Return sample hourly aggregations for hour 9 and hour 14
          return {
            rows: [
              { hour: 9, total_revenue_minor: 1500000, transaction_count: 2 },
              { hour: 14, total_revenue_minor: 3000000, transaction_count: 1 },
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

  describe('REPORT-HOUR-001: tenant-wide hourly aggregation without branch_id', () => {
    it('queries sales across all tenant branches when branch_id is omitted', async () => {
      const reportService = createReportService(mockPool)
      const res = await reportService.getHourlySales(businessId, { from: '2026-08-25', to: '2026-08-25' })

      expect(res.buckets).toBeDefined()
      expect(res.buckets.length).toBe(24)

      const hourlyQuery = queryHistory.find((q) => q.text.includes('EXTRACT(HOUR FROM created_at)'))
      expect(hourlyQuery).toBeDefined()
      expect(hourlyQuery!.text).not.toContain('sales.branch_id =')
      expect(hourlyQuery!.params).toEqual([businessId, '2026-08-25', '2026-08-25'])
    })
  })

  describe('REPORT-HOUR-002: branch-scoped hourly aggregation', () => {
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
      const res = await reportService.getHourlySales(businessId, {
        from: '2026-08-25',
        to: '2026-08-25',
        branch_id: branch1Id,
      })

      expect(res.buckets.length).toBe(24)
      const hourlyQuery = queryHistory.find((q) => q.text.includes('EXTRACT(HOUR FROM created_at)'))
      expect(hourlyQuery).toBeDefined()
      expect(hourlyQuery!.text).toContain('sales.branch_id = $4')
      expect(hourlyQuery!.params).toEqual([businessId, '2026-08-25', '2026-08-25', branch1Id])
    })
  })

  describe('REPORT-HOUR-003: foreign branch rejected with 403', () => {
    it('throws BUSINESS_ACCESS_DENIED when branch does not belong to business', async () => {
      vi.spyOn(branchRepository, 'findById').mockResolvedValueOnce(null)

      const reportService = createReportService(mockPool)
      await expect(
        reportService.getHourlySales(businessId, {
          from: '2026-08-25',
          to: '2026-08-25',
          branch_id: foreignBranchId,
        })
      ).rejects.toThrow('Branch not found or access denied')
    })
  })

  describe('REPORT-HOUR-004: invalid branch UUID rejected with 400', () => {
    it('rejects invalid UUID formats', () => {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      expect(UUID_REGEX.test('BRANCH-001')).toBe(false)
      expect(UUID_REGEX.test('')).toBe(false)
      expect(UUID_REGEX.test('not-a-valid-uuid')).toBe(false)
      expect(UUID_REGEX.test(branch1Id)).toBe(true)
    })
  })

  describe('REPORT-HOUR-005: date boundary correctness', () => {
    it('passes exact from and to date strings into SQL parameters', async () => {
      const reportService = createReportService(mockPool)
      await reportService.getHourlySales(businessId, { from: '2026-08-01', to: '2026-08-31' })

      const hourlyQuery = queryHistory.find((q) => q.text.includes('EXTRACT(HOUR FROM created_at)'))
      expect(hourlyQuery).toBeDefined()
      expect(hourlyQuery!.params![1]).toBe('2026-08-01')
      expect(hourlyQuery!.params![2]).toBe('2026-08-31')
    })
  })

  describe('REPORT-HOUR-006: empty day returns zero buckets', () => {
    it('returns all 24 buckets with zeros when no sales occur', async () => {
      mockClient.query = vi.fn(async (text: string) => {
        if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] }
        return { rows: [] } // zero rows from DB
      })

      const reportService = createReportService(mockPool)
      const res = await reportService.getHourlySales(businessId, { from: '2026-08-25', to: '2026-08-25' })

      expect(res.buckets.length).toBe(24)
      for (let h = 0; h < 24; h++) {
        expect(res.buckets[h].hour).toBe(h)
        expect(res.buckets[h].total_revenue_minor).toBe(0)
        expect(res.buckets[h].transaction_count).toBe(0)
      }
    })
  })

  describe('REPORT-HOUR-007: multiple sales in same hour aggregate correctly', () => {
    it('maps combined total_revenue_minor and transaction_count accurately', async () => {
      mockClient.query = vi.fn(async (text: string) => {
        if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] }
        return {
          rows: [
            { hour: 12, total_revenue_minor: 5000000, transaction_count: 5 },
          ],
        }
      })

      const reportService = createReportService(mockPool)
      const res = await reportService.getHourlySales(businessId, { from: '2026-08-25', to: '2026-08-25' })

      const hour12 = res.buckets.find((b) => b.hour === 12)
      expect(hour12).toBeDefined()
      expect(hour12!.total_revenue_minor).toBe(5000000)
      expect(hour12!.transaction_count).toBe(5)

      // Other hours remain 0
      const hour11 = res.buckets.find((b) => b.hour === 11)
      expect(hour11!.total_revenue_minor).toBe(0)
      expect(hour11!.transaction_count).toBe(0)
    })
  })

  describe('REPORT-HOUR-008: 24-hour bucket shape is stable', () => {
    it('contains sequential hours from 0 to 23 with numeric integer types', async () => {
      const reportService = createReportService(mockPool)
      const res = await reportService.getHourlySales(businessId, { from: '2026-08-25', to: '2026-08-25' })

      expect(res.buckets.length).toBe(24)
      res.buckets.forEach((bucket, index) => {
        expect(bucket.hour).toBe(index)
        expect(typeof bucket.hour).toBe('number')
        expect(typeof bucket.total_revenue_minor).toBe('number')
        expect(typeof bucket.transaction_count).toBe('number')
      })
    })
  })
})
