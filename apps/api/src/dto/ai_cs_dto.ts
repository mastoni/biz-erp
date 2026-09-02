export type AiMessageSender = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL'
export type AiConversationStatus = 'ACTIVE' | 'ESCALATED' | 'CLOSED'
export type SupportTicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

export interface AiToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface AiToolResult {
  tool_call_id: string
  name: string
  success: boolean
  result?: unknown
  error?: string
}

export interface AiMessageDto {
  id: string
  conversation_id: string
  sender: AiMessageSender
  intent: string | null
  content: string
  tool_calls: AiToolCall[] | null
  tool_results: AiToolResult[] | null
  created_at: string
}

export interface AiConversationDto {
  id: string
  business_id: string
  user_id: string
  service_code: string | null
  status: AiConversationStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  messages?: AiMessageDto[]
}

export interface CreateConversationInput {
  service_code?: string | null
  initial_message?: string
  metadata?: Record<string, unknown>
}

export interface SendMessageInput {
  content: string
}

export interface AiChatResponseDto {
  conversation_id: string
  message: AiMessageDto
  intent: string
  service_code: string | null
  escalated: boolean
  ticket?: SupportTicketDto | null
}

export interface EscalateConversationInput {
  subject?: string
  description?: string
  priority?: SupportTicketPriority
  service_code?: string | null
}

export interface SupportTicketDto {
  id: string
  business_id: string
  conversation_id: string | null
  service_code: string | null
  subject: string
  description: string
  priority: SupportTicketPriority
  status: SupportTicketStatus
  assigned_to: string | null
  created_at: string
  updated_at: string
}
