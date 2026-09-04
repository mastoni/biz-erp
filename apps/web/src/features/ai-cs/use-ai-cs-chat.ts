'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AiConversation,
  AiMessage,
  SupportTicket,
} from './types';
import * as aiApi from './api';

export interface UseAiCsChatProps {
  businessId?: string | null;
  userId?: string | null;
}

export interface UseAiCsChatReturn {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  conversation: AiConversation | null;
  messages: AiMessage[];
  loading: boolean;
  sending: boolean;
  escalating: boolean;
  error: string | null;
  escalatedTicket: SupportTicket | null;
  inputMessage: string;
  setInputMessage: (val: string) => void;
  sendMessage: (customText?: string) => Promise<void>;
  escalate: () => Promise<void>;
  startNewConversation: () => Promise<void>;
  retryLastMessage: () => Promise<void>;
}

export function useAiCsChat({ businessId, userId }: UseAiCsChatProps): UseAiCsChatReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<AiConversation | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [escalatedTicket, setEscalatedTicket] = useState<SupportTicket | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const lastSentTextRef = useRef<string | null>(null);

  // Tenant + user scoped storage key prevents cross-tenant conversation leakage
  const storageKey =
    businessId && userId ? `skm_ai_cs_active_conv_${businessId}_${userId}` : null;

  // Initialize or restore conversation when widget is opened
  const initConversation = useCallback(async () => {
    if (!businessId || !userId) return;

    setLoading(true);
    setError(null);

    let savedId: string | null = null;
    if (storageKey && typeof window !== 'undefined') {
      try {
        savedId = localStorage.getItem(storageKey);
      } catch {
        // Ignore localStorage access errors
      }
    }

    try {
      if (savedId) {
        try {
          const conv = await aiApi.getConversationById(savedId);
          setConversation(conv);
          setMessages(conv.messages || []);
          setLoading(false);
          return;
        } catch {
          // If saved conversation not found or expired, clear and create new
          if (storageKey && typeof window !== 'undefined') {
            localStorage.removeItem(storageKey);
          }
        }
      }

      // Create new conversation if none exists or restoration failed
      const newConv = await aiApi.createConversation();
      setConversation(newConv);
      setMessages(newConv.messages || []);
      if (storageKey && typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, newConv.id);
        } catch {
          // Ignore localStorage errors
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Gagal memulai percakapan AI.');
    } finally {
      setLoading(false);
    }
  }, [businessId, userId, storageKey]);

  // Load conversation on first open or when tenant/user changes
  useEffect(() => {
    if (isOpen && !conversation && !loading) {
      initConversation();
    }
  }, [isOpen, conversation, loading, initConversation]);

  // Reset conversation if tenant/user context switches
  useEffect(() => {
    setConversation(null);
    setMessages([]);
    setError(null);
    setEscalatedTicket(null);
  }, [businessId, userId]);

  const handleSendMessage = useCallback(
    async (customText?: string) => {
      const textToSend = (customText ?? inputMessage).trim();
      if (!textToSend || sending || !conversation) return;

      setInputMessage('');
      setSending(true);
      setError(null);
      lastSentTextRef.current = textToSend;

      // Optimistic user message for immediate UI feedback
      const tempUserMsg: AiMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: conversation.id,
        sender: 'USER',
        intent: null,
        content: textToSend,
        tool_calls: null,
        tool_results: null,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempUserMsg]);

      try {
        const response = await aiApi.sendMessage(conversation.id, { content: textToSend });
        
        // Append genuine assistant response returned from API
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempUserMsg.id),
          {
            ...tempUserMsg,
            id: `user-${Date.now()}`, // stabilize temp ID
          },
          response.message,
        ]);

        if (response.escalated) {
          setConversation((prev) => (prev ? { ...prev, status: 'ESCALATED' } : null));
          if (response.ticket) {
            setEscalatedTicket(response.ticket);
          }
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Gagal mengirim pesan.');
      } finally {
        setSending(false);
      }
    },
    [conversation, inputMessage, sending]
  );

  const handleEscalate = useCallback(async () => {
    if (!conversation || escalating || conversation.status === 'ESCALATED') return;

    setEscalating(true);
    setError(null);

    try {
      const res = await aiApi.escalateConversation(conversation.id, {
        subject: 'Bantuan Customer Service',
        description: 'Permintaan bantuan manual dari sesi percakapan AI CS.',
      });

      setConversation((prev) => (prev ? { ...prev, status: 'ESCALATED' } : null));
      setEscalatedTicket(res.ticket);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Gagal meneruskan ke CS.');
    } finally {
      setEscalating(false);
    }
  }, [conversation, escalating]);

  const handleStartNewConversation = useCallback(async () => {
    if (!businessId || !userId) return;

    setLoading(true);
    setError(null);
    setEscalatedTicket(null);

    try {
      const newConv = await aiApi.createConversation();
      setConversation(newConv);
      setMessages([]);
      if (storageKey && typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, newConv.id);
        } catch {
          // Ignore localStorage errors
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Gagal membuat percakapan baru.');
    } finally {
      setLoading(false);
    }
  }, [businessId, userId, storageKey]);

  const handleRetryLastMessage = useCallback(async () => {
    if (lastSentTextRef.current) {
      await handleSendMessage(lastSentTextRef.current);
    }
  }, [handleSendMessage]);

  return {
    isOpen,
    setIsOpen,
    conversation,
    messages,
    loading,
    sending,
    escalating,
    error,
    escalatedTicket,
    inputMessage,
    setInputMessage,
    sendMessage: handleSendMessage,
    escalate: handleEscalate,
    startNewConversation: handleStartNewConversation,
    retryLastMessage: handleRetryLastMessage,
  };
}
