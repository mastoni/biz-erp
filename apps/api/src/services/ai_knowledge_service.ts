import { Pool } from 'pg'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'
import {
  KnowledgeArticleDto,
  CreateKnowledgeArticleInput,
  UpdateKnowledgeArticleInput,
} from '../dto/ai_cs_dto'
import { createAuditService } from './audit_service'

export interface KnowledgeArticle extends KnowledgeArticleDto {
  domain: string
  isPublic: boolean
}

const STATIC_FALLBACK_ARTICLES = [
  {
    id: 'kb-plat-01',
    code: 'KB-PLAT-01',
    category: 'PLATFORM',
    title: 'Tentang Ekosistem SKMNetwork',
    content: 'SKMNetwork adalah platform multi-service terintegrasi yang menyediakan ERP, ISP Management, CCTV Management, WhatsApp Gateway, dan Digital Marketing AutoPost.',
    keywords: ['skmnetwork', 'ekosistem', 'platform', 'layanan'],
    is_public: true,
    is_active: true,
    priority_order: 10,
    created_by: null,
    updated_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'kb-bill-01',
    code: 'KB-BILL-01',
    category: 'BILLING',
    title: 'Siklus dan Pembayaran Tagihan',
    content: 'Tagihan langganan dibuat setiap awal periode penagihan. Pembayaran dapat dilakukan via virtual account atau transfer bank otomatis.',
    keywords: ['tagihan', 'pembayaran', 'invoice', 'bayar', 'billing'],
    is_public: true,
    is_active: true,
    priority_order: 20,
    created_by: null,
    updated_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'kb-isp-01',
    code: 'KB-ISP-01',
    category: 'ISP_MANAGEMENT',
    title: 'Troubleshooting Router dan Internet ISP',
    content: 'Jika koneksi internet mati: 1. Periksa lampu indikator PON/LOS pada router ONT. 2. Restart router selama 30 detik. 3. Jika lampu LOS merah, hubungi tim teknis via AI CS.',
    keywords: ['wifi', 'internet', 'mati', 'los', 'pon', 'ont', 'router'],
    is_public: false,
    is_active: true,
    priority_order: 30,
    created_by: null,
    updated_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'kb-erp-01',
    code: 'KB-ERP-01',
    category: 'ERP',
    title: 'Pencatatan dan Laporan Penjualan ERP',
    content: 'Laporan penjualan harian dapat diakses melalui menu Penjualan > Laporan. Transaksi kasir POS secara otomatis tersinkronisasi ke jurnal keuangan.',
    keywords: ['laporan', 'penjualan', 'pos', 'kasir', 'stok', 'erp'],
    is_public: false,
    is_active: true,
    priority_order: 40,
    created_by: null,
    updated_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'kb-cctv-01',
    code: 'KB-CCTV-01',
    category: 'CCTV_MANAGEMENT',
    title: 'Konfigurasi Streaming CCTV & Retensi Video',
    content: 'Kamera CCTV terhubung melalui gateway streaming terenkripsi. Retensi rekaman default adalah 30 hari sesuai paket langganan.',
    keywords: ['cctv', 'kamera', 'rekaman', 'streaming', 'nvr'],
    is_public: false,
    is_active: true,
    priority_order: 50,
    created_by: null,
    updated_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'kb-trbl-01',
    code: 'KB-TRBL-01',
    category: 'TROUBLESHOOTING',
    title: 'Panduan Eskalasi Kendala Teknis',
    content: 'Untuk kendala kritis yang tidak terselesaikan melalui panduan otomatis, Anda dapat meminta eskalasi langsung ke tiket bantuan operator manusia.',
    keywords: ['eskalasi', 'bantuan', 'manusia', 'tiket', 'operator', 'support'],
    is_public: true,
    is_active: true,
    priority_order: 60,
    created_by: null,
    updated_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

function mapRowToArticle(row: Record<string, unknown>): KnowledgeArticle {
  let keywords: string[] = []
  if (Array.isArray(row.keywords)) {
    keywords = row.keywords.map(String)
  } else if (typeof row.keywords === 'string') {
    try {
      const parsed = JSON.parse(row.keywords)
      if (Array.isArray(parsed)) keywords = parsed.map(String)
    } catch {
      keywords = []
    }
  }

  const isPublic = Boolean(row.is_public)
  const category = String(row.category || 'PLATFORM').toUpperCase()

  return {
    id: String(row.id),
    code: row.code ? String(row.code) : null,
    category,
    domain: category,
    title: String(row.title || ''),
    content: String(row.content || ''),
    keywords,
    is_public: isPublic,
    isPublic,
    is_active: Boolean(row.is_active),
    priority_order: Number(row.priority_order || 0),
    created_by: row.created_by ? String(row.created_by) : null,
    updated_by: row.updated_by ? String(row.updated_by) : null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }
}

export function createAiKnowledgeService(pool?: Pool) {
  const auditService = pool ? createAuditService(pool) : null

  return {
    /**
     * Search knowledge articles matching query keywords within allowed domains.
     * Database-backed with deterministic active priority ordering.
     */
    async searchKnowledge(
      query: string,
      allowedDomains: string[] = ['PLATFORM', 'BILLING', 'TROUBLESHOOTING']
    ): Promise<KnowledgeArticle[]> {
      let articles: KnowledgeArticle[] = []

      if (pool) {
        try {
          const res = await pool.query(
            `SELECT * FROM ai_knowledge_base 
             WHERE is_active = TRUE 
             ORDER BY priority_order ASC, created_at ASC`
          )
          articles = res.rows.map(mapRowToArticle)
        } catch {
          // Table not ready or in-memory test fallback
          articles = STATIC_FALLBACK_ARTICLES.map((a) => ({
            ...a,
            domain: a.category,
            isPublic: a.is_public,
          }))
        }
      } else {
        articles = STATIC_FALLBACK_ARTICLES.map((a) => ({
          ...a,
          domain: a.category,
          isPublic: a.is_public,
        }))
      }

      const q = query.toLowerCase()
      return articles.filter((art) => {
        if (!art.is_public && !allowedDomains.includes(art.category)) {
          return false
        }
        return (
          art.title.toLowerCase().includes(q) ||
          art.content.toLowerCase().includes(q) ||
          art.keywords.some((kw) => q.includes(kw.toLowerCase()))
        )
      })
    },

    /**
     * List knowledge articles for Superadmin Control Plane.
     */
    async listArticles(query?: {
      search?: string
      category?: string
      status?: string
      is_active?: boolean | string
      limit?: number
      offset?: number
    }): Promise<{
      items: KnowledgeArticleDto[]
      total: number
      limit: number
      offset: number
      has_more: boolean
      summary: {
        total: number
        active_count: number
        inactive_count: number
      }
    }> {
      if (!pool) {
        throw new Error('Database pool required for listArticles')
      }

      const limit = Math.min(Math.max(Number(query?.limit || 20), 1), 100)
      const offset = Math.max(Number(query?.offset || 0), 0)

      const conditions: string[] = []
      const params: any[] = []
      let paramIdx = 1

      if (query?.category && query.category !== 'ALL') {
        conditions.push(`category = $${paramIdx}`)
        params.push(query.category.trim().toUpperCase())
        paramIdx++
      }

      if (query?.is_active !== undefined && query.is_active !== 'ALL') {
        const activeBool = query.is_active === true || query.is_active === 'true' || query.is_active === 'ACTIVE'
        conditions.push(`is_active = $${paramIdx}`)
        params.push(activeBool)
        paramIdx++
      } else if (query?.status && query.status !== 'ALL') {
        const activeBool = query.status === 'ACTIVE'
        conditions.push(`is_active = $${paramIdx}`)
        params.push(activeBool)
        paramIdx++
      }

      if (query?.search && query.search.trim().length > 0) {
        const pattern = `%${query.search.trim().toLowerCase()}%`
        conditions.push(`(
          LOWER(title) LIKE $${paramIdx} OR
          LOWER(content) LIKE $${paramIdx} OR
          LOWER(code) LIKE $${paramIdx} OR
          LOWER(category) LIKE $${paramIdx}
        )`)
        params.push(pattern)
        paramIdx++
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const countSql = `SELECT COUNT(*)::bigint AS count FROM ai_knowledge_base ${whereClause}`
      const countRes = await pool.query(countSql, params)
      const total = Number(countRes.rows[0]?.count ?? 0)

      const summarySql = `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active_count,
          COUNT(*) FILTER (WHERE is_active = FALSE)::int AS inactive_count
        FROM ai_knowledge_base
      `
      const summaryRes = await pool.query(summarySql)
      const summary = summaryRes.rows[0] || { total: 0, active_count: 0, inactive_count: 0 }

      const dataSql = `
        SELECT *
        FROM ai_knowledge_base
        ${whereClause}
        ORDER BY priority_order ASC, created_at DESC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `
      const dataRes = await pool.query(dataSql, [...params, limit, offset])

      return {
        items: dataRes.rows.map(mapRowToArticle),
        total,
        limit,
        offset,
        has_more: offset + limit < total,
        summary,
      }
    },

    /**
     * Get knowledge article by ID or Code.
     */
    async getArticleById(id: string): Promise<KnowledgeArticleDto> {
      if (!pool) {
        const found = STATIC_FALLBACK_ARTICLES.find((a) => a.id === id || a.code === id)
        if (!found) throw new ApiError(404, 'NOT_FOUND', 'Knowledge article not found')
        return found
      }

      let res
      if (isUuid(id)) {
        res = await pool.query('SELECT * FROM ai_knowledge_base WHERE id = $1', [id])
      } else {
        res = await pool.query('SELECT * FROM ai_knowledge_base WHERE code = $1 OR id::text = $1', [id])
      }

      if (res.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Knowledge article not found')
      }

      return mapRowToArticle(res.rows[0])
    },

    /**
     * Create new knowledge article (SUPER_ADMIN only).
     */
    async createArticle(
      input: CreateKnowledgeArticleInput,
      actorUserId: string,
      requestId?: string
    ): Promise<KnowledgeArticleDto> {
      if (!pool) throw new Error('Database pool required')

      const title = String(input.title || '').trim()
      const content = String(input.content || '').trim()
      const category = String(input.category || 'PLATFORM').trim().toUpperCase()

      if (!title) {
        throw new ValidationError('title is required and cannot be empty')
      }
      if (!content) {
        throw new ValidationError('content is required and cannot be empty')
      }
      if (!category) {
        throw new ValidationError('category is required and cannot be empty')
      }

      let keywords: string[] = []
      if (Array.isArray(input.keywords)) {
        keywords = input.keywords.map((k) => String(k).trim()).filter(Boolean)
      }

      const priorityOrder = input.priority_order !== undefined ? Math.max(0, Number(input.priority_order)) : 0
      const isPublic = input.is_public !== undefined ? Boolean(input.is_public) : true
      const isActive = input.is_active !== undefined ? Boolean(input.is_active) : true
      const code = input.code ? String(input.code).trim().toUpperCase() : null

      const res = await pool.query(
        `INSERT INTO ai_knowledge_base (
           code, category, title, content, keywords, is_public, is_active, priority_order, created_by, updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         RETURNING *`,
        [code, category, title, content, JSON.stringify(keywords), isPublic, isActive, priorityOrder, actorUserId]
      )

      const article = mapRowToArticle(res.rows[0])

      if (auditService) {
        await auditService.recordAudit({
          actor_id: actorUserId,
          actor_scope: 'platform',
          actor_role: 'SUPER_ADMIN',
          action: 'AI_CS_KB_CREATED',
          target_type: 'ai_knowledge_base',
          target_id: article.id,
          after_state: article as any,
          request_id: requestId ?? null,
          status: 'SUCCESS',
          metadata: {
            title: article.title,
            category: article.category,
            priority_order: article.priority_order,
          },
        })
      }

      return article
    },

    /**
     * Update knowledge article (SUPER_ADMIN only).
     */
    async updateArticle(
      id: string,
      input: UpdateKnowledgeArticleInput,
      actorUserId: string,
      requestId?: string
    ): Promise<KnowledgeArticleDto> {
      if (!pool) throw new Error('Database pool required')

      const current = await this.getArticleById(id)

      const title = input.title !== undefined ? String(input.title).trim() : current.title
      const content = input.content !== undefined ? String(input.content).trim() : current.content
      const category = input.category !== undefined ? String(input.category).trim().toUpperCase() : current.category
      const code = input.code !== undefined ? (input.code ? String(input.code).trim().toUpperCase() : null) : current.code

      if (title.length === 0) {
        throw new ValidationError('title cannot be empty')
      }
      if (content.length === 0) {
        throw new ValidationError('content cannot be empty')
      }
      if (category.length === 0) {
        throw new ValidationError('category cannot be empty')
      }

      let keywords = current.keywords
      if (input.keywords !== undefined && Array.isArray(input.keywords)) {
        keywords = input.keywords.map((k) => String(k).trim()).filter(Boolean)
      }

      const isPublic = input.is_public !== undefined ? Boolean(input.is_public) : current.is_public
      const isActive = input.is_active !== undefined ? Boolean(input.is_active) : current.is_active
      const priorityOrder = input.priority_order !== undefined ? Math.max(0, Number(input.priority_order)) : current.priority_order

      const diff: Record<string, { before: unknown; after: unknown }> = {}
      if (title !== current.title) diff.title = { before: current.title, after: title }
      if (content !== current.content) diff.content = { before: current.content, after: content }
      if (category !== current.category) diff.category = { before: current.category, after: category }
      if (isActive !== current.is_active) diff.is_active = { before: current.is_active, after: isActive }
      if (isPublic !== current.is_public) diff.is_public = { before: current.is_public, after: isPublic }
      if (priorityOrder !== current.priority_order) diff.priority_order = { before: current.priority_order, after: priorityOrder }

      const res = await pool.query(
        `UPDATE ai_knowledge_base
         SET code = $1, category = $2, title = $3, content = $4, keywords = $5,
             is_public = $6, is_active = $7, priority_order = $8, updated_by = $9, updated_at = NOW()
         WHERE id = $10
         RETURNING *`,
        [code, category, title, content, JSON.stringify(keywords), isPublic, isActive, priorityOrder, actorUserId, current.id]
      )

      const updated = mapRowToArticle(res.rows[0])

      let action = 'AI_CS_KB_UPDATED'
      if (diff.is_active) {
        action = isActive ? 'AI_CS_KB_ACTIVATED' : 'AI_CS_KB_DEACTIVATED'
      }

      if (auditService) {
        await auditService.recordAudit({
          actor_id: actorUserId,
          actor_scope: 'platform',
          actor_role: 'SUPER_ADMIN',
          action,
          target_type: 'ai_knowledge_base',
          target_id: updated.id,
          before_state: current as any,
          after_state: updated as any,
          diff: Object.keys(diff).length > 0 ? diff : null,
          request_id: requestId ?? null,
          status: 'SUCCESS',
        })
      }

      return updated
    },

    /**
     * Soft-deactivate knowledge article (SUPER_ADMIN only).
     */
    async deleteArticle(id: string, actorUserId: string, requestId?: string): Promise<void> {
      if (!pool) throw new Error('Database pool required')

      const current = await this.getArticleById(id)

      await pool.query(
        `UPDATE ai_knowledge_base
         SET is_active = FALSE, updated_by = $1, updated_at = NOW()
         WHERE id = $2`,
        [actorUserId, current.id]
      )

      if (auditService) {
        await auditService.recordAudit({
          actor_id: actorUserId,
          actor_scope: 'platform',
          actor_role: 'SUPER_ADMIN',
          action: 'AI_CS_KB_DEACTIVATED',
          target_type: 'ai_knowledge_base',
          target_id: current.id,
          before_state: current as any,
          after_state: { ...current, is_active: false } as any,
          diff: { is_active: { before: current.is_active, after: false } },
          request_id: requestId ?? null,
          status: 'SUCCESS',
        })
      }
    },
  }
}
