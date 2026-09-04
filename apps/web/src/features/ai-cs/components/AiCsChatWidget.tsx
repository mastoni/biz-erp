'use client';

import React, { useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Headphones,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Bot,
  User,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useAiCsChat } from '../use-ai-cs-chat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const QUICK_SUGGESTIONS = [
  'Bagaimana cara pembayaran?',
  'Cek status langganan saya',
  'Troubleshooting koneksi internet',
];

export function AiCsChatWidget() {
  const { business, user, status } = useAuth();
  const chat = useAiCsChat({
    businessId: business?.id,
    userId: user?.id,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (chat.isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chat.messages, chat.sending, chat.isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (chat.isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [chat.isOpen]);

  // Only available for authenticated tenant sessions
  if (status !== 'authenticated' || !business || !user) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Expanded Chat Drawer / Card */}
      {chat.isOpen && (
        <div
          role="dialog"
          aria-label="SKMNetwork AI Customer Service"
          className="mb-3 flex h-[540px] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl transition-all sm:w-[400px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#1a2620] bg-[#0c2018] px-4 py-3 text-[#f0efe7]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#17593e] text-[#d3921f]">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold leading-tight">
                  SKMNetwork AI CS
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] text-[#f0efe7]/70">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      chat.conversation?.status === 'ESCALATED'
                        ? 'bg-[#d3921f]'
                        : 'bg-emerald-400 animate-pulse'
                    }`}
                  />
                  <span>
                    {chat.conversation?.status === 'ESCALATED'
                      ? 'Dieskalasi ke CS'
                      : 'AI Assistant'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={chat.startNewConversation}
                disabled={chat.loading || chat.sending}
                className="h-8 w-8 text-[#f0efe7]/70 hover:bg-[#f0efe7]/10 hover:text-[#f0efe7]"
                aria-label="Mulai Percakapan Baru"
                title="Percakapan Baru"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => chat.setIsOpen(false)}
                className="h-8 w-8 text-[#f0efe7]/70 hover:bg-[#f0efe7]/10 hover:text-[#f0efe7]"
                aria-label="Tutup Chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Escalation Control Bar */}
          <div className="flex items-center justify-between border-b border-line bg-surface-soft px-4 py-2 text-xs">
            <span className="text-fog">Butuh bantuan manusia?</span>
            <Button
              variant="outline"
              size="sm"
              onClick={chat.escalate}
              disabled={
                chat.escalating ||
                chat.loading ||
                chat.conversation?.status === 'ESCALATED'
              }
              className="h-7 gap-1.5 border-line bg-surface text-xs font-medium text-ink hover:bg-pine-soft hover:text-pine"
              aria-label="Bicara dengan Customer Service"
            >
              <Headphones className="h-3.5 w-3.5 text-pine" />
              <span>
                {chat.conversation?.status === 'ESCALATED'
                  ? 'Sudah Dieskalasi'
                  : chat.escalating
                  ? 'Meneruskan...'
                  : 'Bicara dengan CS'}
              </span>
            </Button>
          </div>

          {/* Escalation Active Banner */}
          {chat.conversation?.status === 'ESCALATED' && (
            <div className="flex items-start gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-xs text-amber-900">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Percakapan telah diteruskan ke tim CS.
                </p>
                {chat.escalatedTicket && (
                  <p className="text-[11px] text-amber-800/80 mt-0.5">
                    Tiket #{chat.escalatedTicket.id.slice(0, 8)} telah dibuat.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Message List Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fbfaf5]">
            {chat.loading && (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-fog">
                  <Loader2 className="h-6 w-6 animate-spin text-pine" />
                  <p className="text-xs">Menghubungkan ke layanan AI...</p>
                </div>
              </div>
            )}

            {!chat.loading && chat.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pine-soft text-pine">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-ink">
                    Halo, {business.name || user.email}!
                  </h4>
                  <p className="text-xs text-fog max-w-[260px] mt-1">
                    Saya asisten AI SKMNetwork. Tanyakan informasi tagihan, paket, atau kendala teknis.
                  </p>
                </div>

                {/* Quick Prompts */}
                <div className="w-full space-y-1.5 pt-2">
                  <p className="text-[11px] font-semibold text-fog uppercase tracking-wider text-left px-1">
                    Pertanyaan Populer:
                  </p>
                  {QUICK_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => chat.sendMessage(suggestion)}
                      disabled={chat.sending}
                      className="w-full text-left rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink transition-colors hover:border-pine hover:bg-pine-soft/40 hover:text-pine"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Render Messages */}
            {chat.messages.map((msg) => {
              const isUser = msg.sender === 'USER';
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${
                    isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {!isUser && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#17593e] text-[#f0efe7] text-[10px]">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-[#17593e] text-[#f0efe7] rounded-br-xs'
                        : 'bg-surface border border-line text-ink rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <span
                      className={`block text-[9px] mt-1 text-right ${
                        isUser ? 'text-[#f0efe7]/60' : 'text-fog'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {isUser && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-paper border border-line text-ink text-[10px]">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* In-Flight Sending Indicator */}
            {chat.sending && (
              <div className="flex items-end gap-2 justify-start">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#17593e] text-[#f0efe7]">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl rounded-bl-xs bg-surface border border-line px-3.5 py-2.5 shadow-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-pine animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-pine animate-bounce [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-pine animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {chat.error && (
              <div className="rounded-lg border border-brick/30 bg-brick/5 p-3 text-xs text-brick">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">{chat.error}</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={chat.retryLastMessage}
                      className="h-auto p-0 text-xs font-semibold text-brick underline mt-1"
                    >
                      Coba lagi
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              chat.sendMessage();
            }}
            className="border-t border-line bg-surface p-3"
          >
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={chat.inputMessage}
                onChange={(e) => chat.setInputMessage(e.target.value)}
                placeholder="Ketik pertanyaan Anda..."
                disabled={chat.loading || chat.sending}
                className="h-10 text-xs rounded-xl border-line bg-paper/50 focus-visible:ring-pine"
                aria-label="Pesan pertanyaan"
              />
              <Button
                type="submit"
                size="icon"
                disabled={
                  chat.loading ||
                  chat.sending ||
                  !chat.inputMessage.trim()
                }
                className="h-10 w-10 shrink-0 rounded-xl bg-[#17593e] text-[#f0efe7] hover:bg-[#10402c]"
                aria-label="Kirim pesan"
              >
                {chat.sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Action Launcher Button */}
      {!chat.isOpen && (
        <Button
          onClick={() => chat.setIsOpen(true)}
          className="group flex h-14 items-center gap-2.5 rounded-full bg-[#17593e] px-5 py-3 text-[#f0efe7] shadow-lg transition-all hover:bg-[#10402c] hover:scale-105 hover:shadow-xl"
          aria-label="Buka Chat AI Customer Service"
        >
          <div className="relative">
            <Bot className="h-6 w-6 text-[#d3921f]" />
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#17593e]" />
          </div>
          <span className="font-display text-sm font-semibold tracking-wide">
            Tanya AI CS
          </span>
        </Button>
      )}
    </div>
  );
}
