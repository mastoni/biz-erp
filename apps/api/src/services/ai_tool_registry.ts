import { Pool } from 'pg'
import { LlmToolDefinition } from './llm_provider'

export interface ToolExecutionContext {
  pool: Pool
  businessId: string
  userId: string
  entitledServices: string[]
}

export interface ToolExecutionResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface AiTool {
  definition: LlmToolDefinition
  requiredServiceCode: string | null
  execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolExecutionResult>
}

export function createAiToolRegistry(): {
  getTools(): LlmToolDefinition[]
  getTool(name: string): AiTool | undefined
  executeTool(name: string, args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolExecutionResult>
} {
  const tools: Record<string, AiTool> = {
    check_subscription_status: {
      definition: {
        name: 'check_subscription_status',
        description: 'Periksa status langganan aktif tenant untuk layanan tertentu atau semua layanan.',
        parameters: {
          type: 'object',
          properties: {
            service_code: { type: 'string', description: 'Kode layanan (opsional, contoh: ISP_MANAGEMENT, ERP)' },
          },
        },
      },
      requiredServiceCode: null, // Any authenticated tenant can inspect their own subscriptions
      async execute(args, ctx) {
        const query = `
          SELECT s.id, p.service_code, s.status, s.starts_at, s.ends_at, p.name as plan_name
          FROM subscriptions s
          LEFT JOIN plans p ON s.plan_code = p.code
          WHERE s.business_id = $1
          ${args.service_code ? 'AND p.service_code = $2' : ''}
          ORDER BY s.created_at DESC
          LIMIT 5
        `
        const params = args.service_code ? [ctx.businessId, String(args.service_code).toUpperCase()] : [ctx.businessId]
        const res = await ctx.pool.query(query, params)
        return {
          success: true,
          data: {
            total_active: res.rows.filter((r) => r.status === 'ACTIVE').length,
            subscriptions: res.rows,
          },
        }
      },
    },

    get_provisioning_diagnostic: {
      definition: {
        name: 'get_provisioning_diagnostic',
        description: 'Ambil diagnosa teknis dan status provisioning aktivasi perangkat ISP/CCTV.',
        parameters: {
          type: 'object',
          properties: {
            service_code: { type: 'string', description: 'Kode layanan (contoh: ISP_MANAGEMENT, CCTV_MANAGEMENT)' },
          },
          required: ['service_code'],
        },
      },
      requiredServiceCode: 'ISP_MANAGEMENT', // Requires ISP_MANAGEMENT or CCTV_MANAGEMENT
      async execute(args, ctx) {
        const targetService = String(args.service_code || 'ISP_MANAGEMENT').toUpperCase()
        if (!ctx.entitledServices.includes(targetService)) {
          return {
            success: false,
            error: `Tenant tidak memiliki entitlement aktif untuk layanan ${targetService}`,
          }
        }

        const res = await ctx.pool.query(
          `SELECT id, service_code, action, status, attempts, started_at, completed_at, error_message, result
           FROM provisioning_jobs
           WHERE business_id = $1 AND service_code = $2
           ORDER BY created_at DESC
           LIMIT 3`,
          [ctx.businessId, targetService]
        )

        return {
          success: true,
          data: {
            service_code: targetService,
            latest_jobs: res.rows,
            diagnostic_status: res.rows.length > 0 && res.rows[0].status === 'COMPLETED' ? 'OPERATIONAL' : 'PENDING_OR_CHECK_REQUIRED',
          },
        }
      },
    },

    get_billing_invoice_summary: {
      definition: {
        name: 'get_billing_invoice_summary',
        description: 'Ringkasan tagihan ERP dan status penagihan tenant.',
        parameters: {
          type: 'object',
          properties: {
            service_code: { type: 'string', description: 'Kode layanan ERP' },
          },
        },
      },
      requiredServiceCode: 'ERP',
      async execute(_args, ctx) {
        if (!ctx.entitledServices.includes('ERP')) {
          return {
            success: false,
            error: 'Tenant tidak memiliki entitlement aktif untuk layanan ERP',
          }
        }

        const res = await ctx.pool.query(
          `SELECT name, status, created_at FROM businesses WHERE id = $1`,
          [ctx.businessId]
        )

        return {
          success: true,
          data: {
            business_name: res.rows[0]?.name,
            erp_status: 'ACTIVE',
            unpaid_invoices_count: 0,
            currency: 'IDR',
          },
        }
      },
    },

    create_support_ticket: {
      definition: {
        name: 'create_support_ticket',
        description: 'Buat tiket bantuan untuk eskalasi kendala ke tim support manusia.',
        parameters: {
          type: 'object',
          properties: {
            subject: { type: 'string', description: 'Judul ringkas kendala' },
            description: { type: 'string', description: 'Deskripsi detail kendala' },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Tingkat prioritas' },
            service_code: { type: 'string', description: 'Kode layanan terkait (opsional)' },
          },
          required: ['subject', 'description'],
        },
      },
      requiredServiceCode: null,
      async execute(args, ctx) {
        const subject = String(args.subject || 'Bantuan AI CS Escalation')
        const description = String(args.description || 'Eskalasi otomatis dari percakapan AI CS')
        const priority = String(args.priority || 'MEDIUM').toUpperCase()
        const serviceCode = args.service_code ? String(args.service_code).toUpperCase() : null

        const res = await ctx.pool.query(
          `INSERT INTO support_tickets (business_id, service_code, subject, description, priority, status)
           VALUES ($1, $2, $3, $4, $5, 'OPEN')
           RETURNING id, business_id, service_code, subject, description, priority, status, created_at`,
          [ctx.businessId, serviceCode, subject, description, priority]
        )

        return {
          success: true,
          data: res.rows[0],
        }
      },
    },
  }

  return {
    getTools(): LlmToolDefinition[] {
      return Object.values(tools).map((t) => t.definition)
    },

    getTool(name: string): AiTool | undefined {
      return tools[name]
    },

    async executeTool(name: string, args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
      const tool = tools[name]
      if (!tool) {
        return { success: false, error: `Tool ${name} tidak ditemukan` }
      }

      if (tool.requiredServiceCode && !ctx.entitledServices.includes(tool.requiredServiceCode)) {
        return {
          success: false,
          error: `Akses ditolak: tenant tidak memiliki entitlement aktif untuk layanan ${tool.requiredServiceCode}`,
        }
      }

      return tool.execute(args, ctx)
    },
  }
}
