/**
 * AI Customer Service API Client.
 *
 * Uses the existing authenticated axios instance from `@/lib/api`.
 * All endpoints map directly to existing backend routes under `/v1/ai-cs/*`.
 */
import { api } from '@/lib/api';
import {
  AiConversation,
  AiChatResponse,
  CreateConversationInput,
  SendMessageInput,
  EscalateConversationInput,
  SupportTicket,
} from './types';

export async function createConversation(
  input: CreateConversationInput = {}
): Promise<AiConversation> {
  const res = await api.post<{ message: string; conversation: AiConversation }>(
    '/v1/ai-cs/conversations',
    input
  );
  return res.data.conversation;
}

export async function listConversations(): Promise<AiConversation[]> {
  const res = await api.get<{ conversations: AiConversation[] }>(
    '/v1/ai-cs/conversations'
  );
  return res.data.conversations;
}

export async function getConversationById(id: string): Promise<AiConversation> {
  const res = await api.get<{ conversation: AiConversation }>(
    `/v1/ai-cs/conversations/${id}`
  );
  return res.data.conversation;
}

export async function sendMessage(
  conversationId: string,
  input: SendMessageInput
): Promise<AiChatResponse> {
  const res = await api.post<AiChatResponse>(
    `/v1/ai-cs/conversations/${conversationId}/messages`,
    input
  );
  return res.data;
}

export async function escalateConversation(
  conversationId: string,
  input: EscalateConversationInput = {}
): Promise<{ message: string; ticket: SupportTicket }> {
  const res = await api.post<{ message: string; ticket: SupportTicket }>(
    `/v1/ai-cs/conversations/${conversationId}/escalate`,
    input
  );
  return res.data;
}
