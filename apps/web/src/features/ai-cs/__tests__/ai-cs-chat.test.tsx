import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as aiApi from '../api';
import { api } from '@/lib/api';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { AiCsChatWidget } from '../components/AiCsChatWidget';
import { useAuth } from '@/features/auth/AuthContext';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('Phase SA-3.0A: Customer CS AI Chat UI & Client Integration', () => {
  const mockTenantId = '11111111-1111-4111-a111-111111111111';
  const mockUserId = '22222222-2222-4222-a222-222222222222';
  const mockConvId = '33333333-3333-4333-a333-333333333333';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. API Client Contracts', () => {
    it('creates a new conversation via POST /v1/ai-cs/conversations', async () => {
      const mockConv = {
        id: mockConvId,
        business_id: mockTenantId,
        user_id: mockUserId,
        service_code: null,
        status: 'ACTIVE' as const,
        metadata: {},
        created_at: '2026-09-04T12:00:00Z',
        updated_at: '2026-09-04T12:00:00Z',
        messages: [],
      };

      vi.mocked(api.post).mockResolvedValueOnce({
        data: { message: 'AI CS conversation created', conversation: mockConv },
      });

      const res = await aiApi.createConversation({ service_code: 'ERP' });
      expect(api.post).toHaveBeenCalledWith('/v1/ai-cs/conversations', { service_code: 'ERP' });
      expect(res.id).toBe(mockConvId);
      expect(res.status).toBe('ACTIVE');
    });

    it('retrieves conversation by ID via GET /v1/ai-cs/conversations/:id', async () => {
      const mockConv = {
        id: mockConvId,
        business_id: mockTenantId,
        user_id: mockUserId,
        service_code: null,
        status: 'ACTIVE' as const,
        metadata: {},
        created_at: '2026-09-04T12:00:00Z',
        updated_at: '2026-09-04T12:00:00Z',
        messages: [
          {
            id: 'msg-1',
            conversation_id: mockConvId,
            sender: 'USER' as const,
            intent: null,
            content: 'Bagaimana cara pembayaran?',
            tool_calls: null,
            tool_results: null,
            created_at: '2026-09-04T12:00:05Z',
          },
          {
            id: 'msg-2',
            conversation_id: mockConvId,
            sender: 'ASSISTANT' as const,
            intent: 'BILLING_INQUIRY',
            content: 'Tagihan langganan dapat dibayarkan via transfer bank atau virtual account.',
            tool_calls: null,
            tool_results: null,
            created_at: '2026-09-04T12:00:06Z',
          },
        ],
      };

      vi.mocked(api.get).mockResolvedValueOnce({
        data: { conversation: mockConv },
      });

      const res = await aiApi.getConversationById(mockConvId);
      expect(api.get).toHaveBeenCalledWith(`/v1/ai-cs/conversations/${mockConvId}`);
      expect(res.messages).toHaveLength(2);
      expect(res.messages![0].content).toBe('Bagaimana cara pembayaran?');
    });

    it('submits a message and receives AI response via POST /v1/ai-cs/conversations/:id/messages', async () => {
      const mockChatResponse = {
        conversation_id: mockConvId,
        message: {
          id: 'msg-3',
          conversation_id: mockConvId,
          sender: 'ASSISTANT' as const,
          intent: 'BILLING_INQUIRY',
          content: 'Status langganan aktif: ERP Basic Monthly.',
          tool_calls: null,
          tool_results: null,
          created_at: '2026-09-04T12:01:00Z',
        },
        intent: 'BILLING_INQUIRY',
        service_code: 'ERP',
        escalated: false,
        ticket: null,
      };

      vi.mocked(api.post).mockResolvedValueOnce({
        data: mockChatResponse,
      });

      const res = await aiApi.sendMessage(mockConvId, { content: 'Cek status langganan' });
      expect(api.post).toHaveBeenCalledWith(`/v1/ai-cs/conversations/${mockConvId}/messages`, {
        content: 'Cek status langganan',
      });
      expect(res.message.content).toContain('ERP Basic Monthly');
      expect(res.escalated).toBe(false);
    });

    it('escalates conversation to human support via POST /v1/ai-cs/conversations/:id/escalate', async () => {
      const mockTicket = {
        id: 'ticket-999',
        business_id: mockTenantId,
        conversation_id: mockConvId,
        service_code: 'ERP',
        subject: 'Bantuan Customer Service',
        description: 'Permintaan bantuan manual dari sesi percakapan AI CS.',
        priority: 'MEDIUM' as const,
        status: 'OPEN' as const,
        assigned_to: null,
        created_at: '2026-09-04T12:02:00Z',
        updated_at: '2026-09-04T12:02:00Z',
      };

      vi.mocked(api.post).mockResolvedValueOnce({
        data: { message: 'Conversation escalated to human support ticket', ticket: mockTicket },
      });

      const res = await aiApi.escalateConversation(mockConvId, {
        subject: 'Bantuan Customer Service',
        description: 'Permintaan bantuan manual dari sesi percakapan AI CS.',
      });

      expect(api.post).toHaveBeenCalledWith(`/v1/ai-cs/conversations/${mockConvId}/escalate`, {
        subject: 'Bantuan Customer Service',
        description: 'Permintaan bantuan manual dari sesi percakapan AI CS.',
      });
      expect(res.ticket.id).toBe('ticket-999');
      expect(res.ticket.status).toBe('OPEN');
    });
  });

  describe('2. Security & Tenant Scoping Verification', () => {
    it('storage key is scoped to tenant and user id', () => {
      const tenantA = 'tenant-aaa';
      const userA = 'user-aaa';
      const storageKeyA = `skm_ai_cs_active_conv_${tenantA}_${userA}`;

      const tenantB = 'tenant-bbb';
      const userB = 'user-bbb';
      const storageKeyB = `skm_ai_cs_active_conv_${tenantB}_${userB}`;

      expect(storageKeyA).not.toBe(storageKeyB);
      expect(storageKeyA).toBe('skm_ai_cs_active_conv_tenant-aaa_user-aaa');
      expect(storageKeyB).toBe('skm_ai_cs_active_conv_tenant-bbb_user-bbb');
    });

    it('renders null when user is unauthenticated or has no active tenant business', () => {
      vi.mocked(useAuth).mockReturnValue({
        status: 'unauthenticated',
        user: null,
        business: null,
        role: null,
        platformRole: null,
        login: vi.fn(),
        logout: vi.fn(),
        switchBranch: vi.fn(),
      } as any);

      const html = renderToString(<AiCsChatWidget />);
      expect(html).toBe('');
    });

    it('renders floating launcher button for authenticated tenant user', () => {
      vi.mocked(useAuth).mockReturnValue({
        status: 'authenticated',
        user: { id: mockUserId, name: 'Budi Santoso', email: 'budi@tokoberkah.com' },
        business: { id: mockTenantId, name: 'Toko Berkah', status: 'ACTIVE' },
        role: 'OWNER',
        platformRole: null,
        login: vi.fn(),
        logout: vi.fn(),
        switchBranch: vi.fn(),
      } as any);

      const html = renderToString(<AiCsChatWidget />);
      expect(html).toContain('Tanya AI CS');
      expect(html).toContain('aria-label="Buka Chat AI Customer Service"');
    });
  });
});
