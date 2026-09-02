import { AiToolCall } from '../dto/ai_cs_dto'

export interface LlmMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  name?: string
  tool_calls?: AiToolCall[]
  tool_call_id?: string
}

export interface LlmToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface LlmCompletionRequest {
  systemPrompt?: string
  messages: LlmMessage[]
  tools?: LlmToolDefinition[]
}

export interface LlmCompletionResponse {
  content: string
  intent: string
  toolCalls?: AiToolCall[]
}

export interface LlmProvider {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>
}

export class DeterministicLlmProvider implements LlmProvider {
  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const lastUserMsg = [...request.messages].reverse().find((m) => m.role === 'user')?.content.toLowerCase() || ''
    const lastToolMsg = [...request.messages].reverse().find((m) => m.role === 'tool')

    // If we just got a tool response, synthesize human-friendly summary
    if (lastToolMsg) {
      let parsedResult: Record<string, unknown> = {}
      try {
        parsedResult = JSON.parse(lastToolMsg.content)
      } catch {
        parsedResult = { raw: lastToolMsg.content }
      }

      if (lastToolMsg.name === 'get_provisioning_diagnostic') {
        return {
          intent: 'ISP_TROUBLESHOOTING',
          content: `Hasil diagnosa koneksi ISP: Status layanan aktif, bandwidth terkonfigurasi normal. Hasil teknis: ${JSON.stringify(parsedResult)}`,
        }
      }

      if (lastToolMsg.name === 'check_subscription_status') {
        return {
          intent: 'BILLING_INQUIRY',
          content: `Informasi langganan Anda telah diperiksa: ${JSON.stringify(parsedResult)}`,
        }
      }

      if (lastToolMsg.name === 'get_billing_invoice_summary') {
        return {
          intent: 'ERP_OPERATIONS',
          content: `Ringkasan operasional ERP dan tagihan: ${JSON.stringify(parsedResult)}`,
        }
      }

      if (lastToolMsg.name === 'create_support_ticket') {
        return {
          intent: 'HUMAN_ESCALATION',
          content: `Permintaan bantuan telah diteruskan ke tim support. Tiket support: ${JSON.stringify(parsedResult)}`,
        }
      }

      return {
        intent: 'GENERAL_ASSISTANCE',
        content: `Hasil eksekusi layanan: ${JSON.stringify(parsedResult)}`,
      }
    }

    // Intent Detection & Tool Invocation Dispatch
    if (lastUserMsg.includes('manusia') || lastUserMsg.includes('agent') || lastUserMsg.includes('bicara staff') || lastUserMsg.includes('escalate') || lastUserMsg.includes('bantuan tim')) {
      return {
        intent: 'HUMAN_ESCALATION',
        content: 'Saya akan menghubungkan Anda dengan tim support kami sekarang.',
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: 'create_support_ticket',
            arguments: {
              subject: 'Permintaan Bantuan Human Support',
              description: lastUserMsg,
              priority: 'HIGH',
            },
          },
        ],
      }
    }

    if (lastUserMsg.includes('wifi') || lastUserMsg.includes('internet') || lastUserMsg.includes('mati') || lastUserMsg.includes('isp') || lastUserMsg.includes('router') || lastUserMsg.includes('ont')) {
      return {
        intent: 'ISP_TROUBLESHOOTING',
        content: 'Saya sedang memeriksa status dan diagnosa jaringan ISP Anda...',
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: 'get_provisioning_diagnostic',
            arguments: {
              service_code: 'ISP_MANAGEMENT',
            },
          },
        ],
      }
    }

    if (lastUserMsg.includes('tagihan') || lastUserMsg.includes('langganan') || lastUserMsg.includes('paket') || lastUserMsg.includes('subscription')) {
      return {
        intent: 'BILLING_INQUIRY',
        content: 'Saya sedang mengambil data status langganan aktif Anda...',
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: 'check_subscription_status',
            arguments: {
              service_code: 'ISP_MANAGEMENT',
            },
          },
        ],
      }
    }

    if (lastUserMsg.includes('laporan') || lastUserMsg.includes('penjualan') || lastUserMsg.includes('erp') || lastUserMsg.includes('stok') || lastUserMsg.includes('pos')) {
      return {
        intent: 'ERP_OPERATIONS',
        content: 'Saya sedang memeriksa modul ERP dan laporan operasional...',
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: 'get_billing_invoice_summary',
            arguments: {
              service_code: 'ERP',
            },
          },
        ],
      }
    }

    if (lastUserMsg.includes('cctv') || lastUserMsg.includes('kamera') || lastUserMsg.includes('rekaman')) {
      return {
        intent: 'CCTV_DIAGNOSTICS',
        content: 'Untuk layanan CCTV, pastikan perangkat NVR/kamera terhubung ke gateway streaming SKMNetwork.',
      }
    }

    // Default FAQ Intent
    return {
      intent: 'GENERAL_FAQ',
      content: 'Halo! Saya AI Customer Support SKMNetwork. Saya dapat membantu Anda dengan informasi layanan ERP, ISP Management, CCTV, tagihan, dan troubleshooting teknis.',
    }
  }
}
