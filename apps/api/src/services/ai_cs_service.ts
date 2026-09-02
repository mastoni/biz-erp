import { Pool } from 'pg'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'
import {
  AiConversationDto,
  AiMessageDto,
  AiChatResponseDto,
  CreateConversationInput,
  SendMessageInput,
  EscalateConversationInput,
  SupportTicketDto,
  AiToolResult,
} from '../dto/ai_cs_dto'
import { LlmProvider, DeterministicLlmProvider, LlmMessage } from './llm_provider'
import { createAiKnowledgeService } from './ai_knowledge_service'
import { createAiToolRegistry } from './ai_tool_registry'
import { createAuditService } from './audit_service'

export function createAiCsService(
  pool: Pool,
  customLlmProvider?: LlmProvider
) {
  const llmProvider = customLlmProvider || new DeterministicLlmProvider()
  const knowledgeService = createAiKnowledgeService()
  const toolRegistry = createAiToolRegistry()
  const auditService = createAuditService(pool)

  async function getTenantEntitlements(businessId: string): Promise<string[]> {
    const res = await pool.query(
      `SELECT DISTINCT p.service_code 
       FROM subscriptions s
       JOIN plans p ON s.plan_code = p.code
       WHERE s.business_id = $1 AND s.status = 'ACTIVE'`,
      [businessId]
    )
    return res.rows.map((r) => r.service_code).filter(Boolean)
  }

  function mapConversationRow(row: Record<string, unknown>, messages?: AiMessageDto[]): AiConversationDto {
    return {
      id: row.id as string,
      business_id: row.business_id as string,
      user_id: row.user_id as string,
      service_code: (row.service_code as string) ?? null,
      status: row.status as 'ACTIVE' | 'ESCALATED' | 'CLOSED',
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      messages,
    }
  }

  function mapMessageRow(row: Record<string, unknown>): AiMessageDto {
    return {
      id: row.id as string,
      conversation_id: row.conversation_id as string,
      sender: row.sender as 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL',
      intent: (row.intent as string) ?? null,
      content: row.content as string,
      tool_calls: (row.tool_calls as any) ?? null,
      tool_results: (row.tool_results as any) ?? null,
      created_at: row.created_at as string,
    }
  }

  function mapTicketRow(row: Record<string, unknown>): SupportTicketDto {
    return {
      id: row.id as string,
      business_id: row.business_id as string,
      conversation_id: (row.conversation_id as string) ?? null,
      service_code: (row.service_code as string) ?? null,
      subject: row.subject as string,
      description: row.description as string,
      priority: row.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
      status: row.status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
      assigned_to: (row.assigned_to as string) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }
  }

  return {
    /**
     * Create a new AI CS Conversation
     */
    async createConversation(businessId: string, userId: string, input: CreateConversationInput): Promise<AiConversationDto> {
      if (input.service_code) {
        const sRes = await pool.query('SELECT code FROM services WHERE code = $1', [input.service_code.toUpperCase()])
        if (sRes.rows.length === 0) {
          throw new ValidationError(`Unknown service_code: ${input.service_code}`)
        }
      }

      const res = await pool.query(
        `INSERT INTO ai_conversations (business_id, user_id, service_code, status, metadata)
         VALUES ($1, $2, $3, 'ACTIVE', $4)
         RETURNING *`,
        [businessId, userId, input.service_code?.toUpperCase() ?? null, JSON.stringify(input.metadata ?? {})]
      )

      const conversation = mapConversationRow(res.rows[0], [])

      // If initial message provided, save it
      if (input.initial_message) {
        await pool.query(
          `INSERT INTO ai_conversation_messages (conversation_id, sender, content)
           VALUES ($1, 'USER', $2)`,
          [conversation.id, input.initial_message]
        )
      }

      return conversation
    },

    /**
     * List conversations for tenant
     */
    async listConversations(businessId: string): Promise<AiConversationDto[]> {
      const res = await pool.query(
        `SELECT * FROM ai_conversations WHERE business_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [businessId]
      )
      return res.rows.map((r) => mapConversationRow(r))
    },

    /**
     * Get conversation with messages by ID
     */
    async getConversationById(id: string, businessId: string): Promise<AiConversationDto> {
      if (!isUuid(id)) {
        throw new ValidationError('id must be a valid UUID')
      }

      const convRes = await pool.query(
        `SELECT * FROM ai_conversations WHERE id = $1 AND business_id = $2`,
        [id, businessId]
      )

      if (convRes.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Conversation not found')
      }

      const msgRes = await pool.query(
        `SELECT * FROM ai_conversation_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
        [id]
      )

      return mapConversationRow(convRes.rows[0], msgRes.rows.map(mapMessageRow))
    },

    /**
     * Process message prompt in conversation
     */
    async sendMessage(
      conversationId: string,
      businessId: string,
      userId: string,
      input: SendMessageInput,
      requestId?: string
    ): Promise<AiChatResponseDto> {
      if (!isUuid(conversationId)) {
        throw new ValidationError('conversationId must be a valid UUID')
      }
      if (!input.content || typeof input.content !== 'string' || input.content.trim().length === 0) {
        throw new ValidationError('content must not be empty')
      }

      const convRes = await pool.query(
        `SELECT * FROM ai_conversations WHERE id = $1 AND business_id = $2`,
        [conversationId, businessId]
      )

      if (convRes.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Conversation not found')
      }

      const conversation = convRes.rows[0]
      const entitledServices = await getTenantEntitlements(businessId)

      // 1. Insert User Message
      await pool.query(
        `INSERT INTO ai_conversation_messages (conversation_id, sender, content)
         VALUES ($1, 'USER', $2)`,
        [conversationId, input.content]
      )

      // 2. Fetch past conversation messages
      const pastMsgsRes = await pool.query(
        `SELECT sender, content, tool_calls, tool_results FROM ai_conversation_messages 
         WHERE conversation_id = $1 
         ORDER BY created_at ASC`,
        [conversationId]
      )

      const llmMessages: LlmMessage[] = pastMsgsRes.rows.map((r) => ({
        role: r.sender.toLowerCase() as 'user' | 'assistant' | 'system' | 'tool',
        content: r.content,
        tool_calls: r.tool_calls ?? undefined,
      }))

      // 3. Search Relevant Knowledge
      const kbMatches = knowledgeService.searchKnowledge(input.content, entitledServices)
      let systemPrompt = `You are SKMNetwork AI Customer Service. You operate within strict tenant and service boundaries.`
      if (kbMatches.length > 0) {
        systemPrompt += ` Relevant knowledge:\n` + kbMatches.map((k) => `[${k.domain}] ${k.title}: ${k.content}`).join('\n')
      }

      // 4. Call LLM
      const tools = toolRegistry.getTools()
      const llmResponse = await llmProvider.complete({
        systemPrompt,
        messages: llmMessages,
        tools,
      })

      let finalContent = llmResponse.content
      const toolResults: AiToolResult[] = []
      let createdTicket: SupportTicketDto | null = null

      // 5. If LLM requested tool calls, execute with entitlement checks
      if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
        for (const toolCall of llmResponse.toolCalls) {
          const result = await toolRegistry.executeTool(toolCall.name, toolCall.arguments, {
            pool,
            businessId,
            userId,
            entitledServices,
          })

          toolResults.push({
            tool_call_id: toolCall.id,
            name: toolCall.name,
            success: result.success,
            result: result.data,
            error: result.error,
          })

          // Record SA-2.8 Audit Trail
          await auditService.recordAudit({
            actor_id: userId,
            actor_scope: 'tenant',
            action: 'AI_TOOL_EXECUTED',
            service_code: conversation.service_code || (toolCall.arguments.service_code as string) || null,
            target_type: 'ai_conversation',
            target_id: conversationId,
            request_id: requestId ?? null,
            status: result.success ? 'SUCCESS' : 'FAILURE',
            metadata: {
              tool_name: toolCall.name,
              tool_arguments: toolCall.arguments,
              tool_success: result.success,
            },
          })

          if (toolCall.name === 'create_support_ticket' && result.success && result.data) {
            createdTicket = mapTicketRow(result.data as Record<string, unknown>)
          }
        }

        // Send tool results back to LLM to produce final friendly text
        const toolFollowUp = await llmProvider.complete({
          systemPrompt,
          messages: [
            ...llmMessages,
            {
              role: 'assistant',
              content: llmResponse.content,
              tool_calls: llmResponse.toolCalls,
            },
            ...toolResults.map((tr) => ({
              role: 'tool' as const,
              name: tr.name,
              tool_call_id: tr.tool_call_id,
              content: JSON.stringify(tr.success ? tr.result : { error: tr.error }),
            })),
          ],
        })

        finalContent = toolFollowUp.content
      }

      const isEscalated = llmResponse.intent === 'HUMAN_ESCALATION' || createdTicket !== null

      if (isEscalated) {
        await pool.query(
          `UPDATE ai_conversations SET status = 'ESCALATED', updated_at = NOW() WHERE id = $1`,
          [conversationId]
        )
      }

      // 6. Save Assistant Response Message
      const msgRes = await pool.query(
        `INSERT INTO ai_conversation_messages (conversation_id, sender, intent, content, tool_calls, tool_results)
         VALUES ($1, 'ASSISTANT', $2, $3, $4, $5)
         RETURNING *`,
        [
          conversationId,
          llmResponse.intent,
          finalContent,
          llmResponse.toolCalls ? JSON.stringify(llmResponse.toolCalls) : null,
          toolResults.length > 0 ? JSON.stringify(toolResults) : null,
        ]
      )

      // Audit Intent Detection
      await auditService.recordAudit({
        actor_id: userId,
        actor_scope: 'tenant',
        action: 'AI_INTENT_DETECTED',
        service_code: conversation.service_code,
        target_type: 'ai_conversation',
        target_id: conversationId,
        request_id: requestId ?? null,
        metadata: {
          intent: llmResponse.intent,
          escalated: isEscalated,
        },
      })

      return {
        conversation_id: conversationId,
        message: mapMessageRow(msgRes.rows[0]),
        intent: llmResponse.intent,
        service_code: conversation.service_code,
        escalated: isEscalated,
        ticket: createdTicket,
      }
    },

    /**
     * Escalate conversation manually
     */
    async escalateConversation(
      conversationId: string,
      businessId: string,
      userId: string,
      input: EscalateConversationInput,
      requestId?: string
    ): Promise<SupportTicketDto> {
      if (!isUuid(conversationId)) {
        throw new ValidationError('conversationId must be a valid UUID')
      }

      const convRes = await pool.query(
        `SELECT * FROM ai_conversations WHERE id = $1 AND business_id = $2`,
        [conversationId, businessId]
      )

      if (convRes.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Conversation not found')
      }

      const conversation = convRes.rows[0]
      const subject = input.subject || 'Eskalasi Percakapan AI CS'
      const description = input.description || 'Permintaan eskalasi bantuan langsung dari tenant'
      const priority = input.priority || 'MEDIUM'
      const serviceCode = input.service_code || conversation.service_code || null

      const ticketRes = await pool.query(
        `INSERT INTO support_tickets (business_id, conversation_id, service_code, subject, description, priority, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')
         RETURNING *`,
        [businessId, conversationId, serviceCode, subject, description, priority]
      )

      await pool.query(
        `UPDATE ai_conversations SET status = 'ESCALATED', updated_at = NOW() WHERE id = $1`,
        [conversationId]
      )

      const ticket = mapTicketRow(ticketRes.rows[0])

      await auditService.recordAudit({
        actor_id: userId,
        actor_scope: 'tenant',
        action: 'AI_TICKET_ESCALATED',
        service_code: serviceCode,
        target_type: 'support_ticket',
        target_id: ticket.id,
        request_id: requestId ?? null,
        metadata: {
          conversation_id: conversationId,
          priority,
        },
      })

      return ticket
    },

    /**
     * List tickets for tenant
     */
    async listTickets(businessId: string): Promise<SupportTicketDto[]> {
      const res = await pool.query(
        `SELECT * FROM support_tickets WHERE business_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [businessId]
      )
      return res.rows.map(mapTicketRow)
    },

    /**
     * Get ticket by ID
     */
    async getTicketById(ticketId: string, businessId: string): Promise<SupportTicketDto> {
      if (!isUuid(ticketId)) {
        throw new ValidationError('ticketId must be a valid UUID')
      }

      const res = await pool.query(
        `SELECT * FROM support_tickets WHERE id = $1 AND business_id = $2`,
        [ticketId, businessId]
      )

      if (res.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Support ticket not found')
      }

      return mapTicketRow(res.rows[0])
    },
  }
}
