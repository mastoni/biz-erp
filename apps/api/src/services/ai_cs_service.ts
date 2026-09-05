import { Pool } from 'pg'
import { withTransaction } from '../db/transaction'
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
  SupportTicketSource,
  AiToolResult,
  PlatformAiCsSettingsDto,
  UpdatePlatformAiCsSettingsInput,
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
  const knowledgeService = createAiKnowledgeService(pool)
  const toolRegistry = createAiToolRegistry()
  const auditService = createAuditService(pool)

  async function getPlatformSettingsInternal(): Promise<{
    id: string
    is_enabled: boolean
    provider: string
    model: string
    fallback_behavior: string
    human_escalation_enabled: boolean
    created_at: string
    updated_at: string
  }> {
    try {
      const res = await pool.query(`SELECT * FROM platform_ai_cs_settings WHERE id = 'default' LIMIT 1`)
      if (res.rows.length > 0) {
        const row = res.rows[0]
        return {
          id: row.id,
          is_enabled: Boolean(row.is_enabled),
          provider: row.provider || 'DETERMINISTIC',
          model: row.model || 'rule-engine-v1',
          fallback_behavior: row.fallback_behavior || 'GENERAL_FAQ',
          human_escalation_enabled: Boolean(row.human_escalation_enabled),
          created_at: row.created_at,
          updated_at: row.updated_at,
        }
      }
    } catch {
      // If table not migrated yet or query fails in test mocks, fall back to safe defaults
    }
    return {
      id: 'default',
      is_enabled: true,
      provider: 'DETERMINISTIC',
      model: 'rule-engine-v1',
      fallback_behavior: 'GENERAL_FAQ',
      human_escalation_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

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
      source: (row.source as SupportTicketSource) || (row.conversation_id ? 'AI_CS' : 'MANUAL'),
      assigned_to: (row.assigned_to as string) ?? null,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at as string),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at as string),
    }
  }

  return {
    /**
     * Get platform-wide AI CS settings
     */
    async getPlatformSettings(): Promise<PlatformAiCsSettingsDto> {
      const settings = await getPlatformSettingsInternal()
      let operationalHealth: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' = 'HEALTHY'
      try {
        await pool.query('SELECT 1')
      } catch {
        operationalHealth = 'UNAVAILABLE'
      }
      if (!settings.is_enabled) {
        operationalHealth = 'DEGRADED'
      }

      return {
        ...settings,
        operational_health: operationalHealth,
      }
    },

    /**
     * Update platform-wide AI CS settings (Superadmin only)
     */
    async updatePlatformSettings(
      input: UpdatePlatformAiCsSettingsInput,
      actorUserId: string,
      requestId?: string
    ): Promise<PlatformAiCsSettingsDto> {
      const before = await getPlatformSettingsInternal()

      if (input.is_enabled !== undefined && typeof input.is_enabled !== 'boolean') {
        throw new ValidationError('is_enabled must be a boolean')
      }
      if (input.human_escalation_enabled !== undefined && typeof input.human_escalation_enabled !== 'boolean') {
        throw new ValidationError('human_escalation_enabled must be a boolean')
      }

      const newIsEnabled = input.is_enabled !== undefined ? input.is_enabled : before.is_enabled
      const newHumanEscalation = input.human_escalation_enabled !== undefined ? input.human_escalation_enabled : before.human_escalation_enabled

      const diff: Record<string, { before: unknown; after: unknown }> = {}
      if (input.is_enabled !== undefined && input.is_enabled !== before.is_enabled) {
        diff.is_enabled = { before: before.is_enabled, after: input.is_enabled }
      }
      if (input.human_escalation_enabled !== undefined && input.human_escalation_enabled !== before.human_escalation_enabled) {
        diff.human_escalation_enabled = { before: before.human_escalation_enabled, after: input.human_escalation_enabled }
      }

      const res = await pool.query(
        `UPDATE platform_ai_cs_settings
         SET is_enabled = $1, human_escalation_enabled = $2, updated_at = NOW()
         WHERE id = 'default'
         RETURNING *`,
        [newIsEnabled, newHumanEscalation]
      )

      const updatedRow = res.rows[0] || {
        id: 'default',
        is_enabled: newIsEnabled,
        provider: before.provider,
        model: before.model,
        fallback_behavior: before.fallback_behavior,
        human_escalation_enabled: newHumanEscalation,
        created_at: before.created_at,
        updated_at: new Date().toISOString(),
      }

      await auditService.recordAudit({
        actor_id: actorUserId,
        actor_scope: 'platform',
        actor_role: 'SUPER_ADMIN',
        action: 'AI_CS_SETTINGS_UPDATED',
        target_type: 'platform_ai_cs_settings',
        target_id: 'default',
        before_state: {
          is_enabled: before.is_enabled,
          human_escalation_enabled: before.human_escalation_enabled,
        },
        after_state: {
          is_enabled: updatedRow.is_enabled,
          human_escalation_enabled: updatedRow.human_escalation_enabled,
        },
        diff: Object.keys(diff).length > 0 ? diff : null,
        request_id: requestId ?? null,
        status: 'SUCCESS',
      })

      let operationalHealth: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' = 'HEALTHY'
      if (!updatedRow.is_enabled) {
        operationalHealth = 'DEGRADED'
      }

      return {
        id: updatedRow.id,
        is_enabled: Boolean(updatedRow.is_enabled),
        provider: updatedRow.provider || 'DETERMINISTIC',
        model: updatedRow.model || 'rule-engine-v1',
        fallback_behavior: updatedRow.fallback_behavior || 'GENERAL_FAQ',
        human_escalation_enabled: Boolean(updatedRow.human_escalation_enabled),
        operational_health: operationalHealth,
        created_at: updatedRow.created_at,
        updated_at: updatedRow.updated_at,
      }
    },

    /**
     * Create a new AI CS Conversation
     */
    async createConversation(businessId: string, userId: string, input: CreateConversationInput): Promise<AiConversationDto> {
      const settings = await getPlatformSettingsInternal()
      if (!settings.is_enabled) {
        throw new ApiError(403, 'AI_CS_DISABLED', 'AI Customer Service is currently disabled by platform administrator')
      }

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
      const settings = await getPlatformSettingsInternal()
      if (!settings.is_enabled) {
        throw new ApiError(403, 'AI_CS_DISABLED', 'AI Customer Service is currently disabled by platform administrator')
      }

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
      const kbMatches = await knowledgeService.searchKnowledge(input.content, entitledServices)
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

      // 5. If LLM requested tool calls, execute with entitlement and escalation checks
      if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
        for (const toolCall of llmResponse.toolCalls) {
          if (toolCall.name === 'create_support_ticket' && !settings.human_escalation_enabled) {
            toolResults.push({
              tool_call_id: toolCall.id,
              name: toolCall.name,
              success: false,
              error: 'Human escalation is currently disabled by platform administrator',
            })
            continue
          }

          const result = await toolRegistry.executeTool(toolCall.name, toolCall.arguments, {
            pool,
            businessId,
            userId,
            entitledServices,
            conversationId,
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

      const isEscalated = (llmResponse.intent === 'HUMAN_ESCALATION' || createdTicket !== null) && settings.human_escalation_enabled

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
      const settings = await getPlatformSettingsInternal()
      if (!settings.is_enabled) {
        throw new ApiError(403, 'AI_CS_DISABLED', 'AI Customer Service is currently disabled by platform administrator')
      }
      if (!settings.human_escalation_enabled) {
        throw new ApiError(403, 'AI_ESCALATION_DISABLED', 'Human escalation is currently disabled by platform administrator')
      }

      if (!isUuid(conversationId)) {
        throw new ValidationError('conversationId must be a valid UUID')
      }

      return await withTransaction(pool, async (client) => {
        const convRes = await client.query(
          `SELECT * FROM ai_conversations WHERE id = $1 AND business_id = $2 FOR UPDATE`,
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

        // Idempotency: check if an active ticket already exists for this conversation
        const existingTicketRes = await client.query(
          `SELECT * FROM support_tickets
           WHERE conversation_id = $1 AND business_id = $2 AND status IN ('OPEN', 'IN_PROGRESS')
           ORDER BY created_at DESC
           LIMIT 1`,
          [conversationId, businessId]
        )

        if (existingTicketRes.rows.length > 0) {
          await client.query(
            `UPDATE ai_conversations SET status = 'ESCALATED', updated_at = NOW() WHERE id = $1`,
            [conversationId]
          )
          return mapTicketRow(existingTicketRes.rows[0])
        }

        const ticketRes = await client.query(
          `INSERT INTO support_tickets (business_id, conversation_id, service_code, subject, description, priority, status, source)
           VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', 'AI_CS')
           RETURNING *`,
          [businessId, conversationId, serviceCode, subject, description, priority]
        )

        await client.query(
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
            source: 'AI_CS',
          },
        })

        return ticket
      })
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

    /**
     * Knowledge Base operations (Superadmin Control Plane)
     */
    listKnowledgeArticles: knowledgeService.listArticles.bind(knowledgeService),
    getKnowledgeArticleById: knowledgeService.getArticleById.bind(knowledgeService),
    createKnowledgeArticle: knowledgeService.createArticle.bind(knowledgeService),
    updateKnowledgeArticle: knowledgeService.updateArticle.bind(knowledgeService),
    deleteKnowledgeArticle: knowledgeService.deleteArticle.bind(knowledgeService),
  }
}


