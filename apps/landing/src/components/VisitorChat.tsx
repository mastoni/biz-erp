import { useState, useRef, useEffect } from "react";
import { IconChat, IconX, IconSend, IconArrowRight, IconGlobe, IconHeadset } from "../icons";
import { ERP_URL, CONTACT_URL } from "../data";

interface ChatMessage {
  id: string;
  sender: "bot" | "visitor";
  text: string;
  action?: {
    label: string;
    href: string;
    isExternal?: boolean;
  };
}

interface QuickOption {
  key: string;
  label: string;
  response: string;
  action?: {
    label: string;
    href: string;
    isExternal?: boolean;
  };
}

const QUICK_OPTIONS: QuickOption[] = [
  {
    key: "internet",
    label: "🌐 Paket Internet",
    response:
      "SKMNetwork menyediakan internet broadband dan dedicated berkecepatan 20 Mbps, 50 Mbps, hingga 100 Mbps dengan router fiber dan instalasi siap pakai.",
    action: {
      label: "Lihat Paket Internet",
      href: "#internet",
    },
  },
  {
    key: "erp",
    label: "💼 ERP & POS",
    response:
      "SKMNetwork ERP menyatukan kasir cepat offline/online, manajemen stok gudang, multi-cabang, dan laporan laba rugi otomatis untuk UMKM.",
    action: {
      label: "Pelajari Fitur ERP",
      href: "#erp",
    },
  },
  {
    key: "cctv",
    label: "📹 CCTV & Keamanan",
    response:
      "Sistem keamanan CCTV Full HD indoor dan outdoor tahan cuaca, lengkap dengan paket 4 kamera + DVR 1TB dan instalasi profesional.",
    action: {
      label: "Lihat Paket CCTV",
      href: "#infrastruktur",
    },
  },
  {
    key: "promo",
    label: "🎁 Paket & Promo",
    response:
      "Tersedia paket solusi terintegrasi (Software ERP + Hardware Mesin Kasir + Internet WiFi) dengan penawaran hemat bulanan.",
    action: {
      label: "Lihat Paket & Bundel",
      href: "#paket-promo",
    },
  },
  {
    key: "daftar",
    label: "📝 Cara Berlangganan",
    response:
      "Anda dapat mendaftarkan usaha baru secara mandiri dalam 1 menit atau memilih paket bundel yang langsung aktif.",
    action: {
      label: "Daftar Akun Bisnis",
      href: `${ERP_URL}/register`,
      isExternal: true,
    },
  },
  {
    key: "kontak",
    label: "💬 Hubungi CS",
    response:
      "Tim konsultan kami siap membantu menganalisis kebutuhan jaringan, perangkat kasir, maupun software bisnis Anda.",
    action: {
      label: "Menuju Kontak Resmi",
      href: CONTACT_URL,
    },
  },
];

export default function VisitorChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "👋 Halo! Selamat datang di SKMNetwork.\nAda yang ingin Anda tanyakan seputar layanan kami?",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSelectOption = (opt: QuickOption) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "visitor",
      text: opt.label,
    };
    const botMsg: ChatMessage = {
      id: `bot-${Date.now() + 1}`,
      sender: "bot",
      text: opt.response,
      action: opt.action,
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputValue.trim();
    if (!query) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "visitor",
      text: query,
    };

    // Keyword matching for public information
    const lower = query.toLowerCase();
    let botResponse =
      "Terima kasih atas pesan Anda. Untuk respon instan atau konsultasi mendalam mengenai spesifikasi teknis dan penawaran khusus, silakan hubungi tim kami melalui formulir kontak resmi.";
    let botAction: { label: string; href: string; isExternal?: boolean } | undefined = {
      label: "Hubungi Tim SKMNetwork",
      href: CONTACT_URL,
    };

    if (lower.includes("internet") || lower.includes("wifi") || lower.includes("kecepatan") || lower.includes("mbps")) {
      botResponse =
        "SKMNetwork menyediakan paket internet mulai dari 20 Mbps (Basic), 50 Mbps (Family), hingga 100 Mbps (Business Dedicated).";
      botAction = { label: "Lihat Paket Internet", href: "#internet" };
    } else if (lower.includes("erp") || lower.includes("pos") || lower.includes("kasir") || lower.includes("toko")) {
      botResponse =
        "SKMNetwork ERP dirancang khusus untuk operasional toko dan UMKM, mendukung kasir offline, barcode scanner, nota cetak, dan multi-cabang.";
      botAction = { label: "Lihat SKMNetwork ERP", href: "#erp" };
    } else if (lower.includes("cctv") || lower.includes("kamera") || lower.includes("keamanan")) {
      botResponse =
        "Tersedia paket CCTV 4 Kamera Indoor/Outdoor lengkap dengan DVR 1TB, live streaming handphone, dan instalasi teknisi.";
      botAction = { label: "Lihat Solusi CCTV", href: "#infrastruktur" };
    } else if (lower.includes("promo") || lower.includes("bundel") || lower.includes("paket") || lower.includes("harga")) {
      botResponse =
        "Kami memiliki pilihan bundel hemat UMKM Starter, Toko Lengkap, hingga Grosir dengan harga spesial langganan.";
      botAction = { label: "Buka Katalog Promo", href: "#paket-promo" };
    } else if (lower.includes("daftar") || lower.includes("register") || lower.includes("buat akun")) {
      botResponse =
        "Pendaftaran akun bisnis dapat dilakukan langsung melalui portal ERP kami dengan uji coba gratis 14 hari.";
      botAction = { label: "Daftar Akun Baru", href: `${ERP_URL}/register`, isExternal: true };
    }

    const botMsg: ChatMessage = {
      id: `bot-${Date.now() + 1}`,
      sender: "bot",
      text: botResponse,
      action: botAction,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInputValue("");
  };

  return (
    <div className="fixed bottom-5 right-5 z-60">
      {/* 1. Chat Popup Window */}
      {isOpen && (
        <div className="mb-3 flex h-[480px] w-[90vw] max-w-[360px] flex-col overflow-hidden rounded-2xl border-2 border-ink/20 bg-paper shadow-[0_20px_50px_-15px_rgba(11,31,51,0.5)] animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-ink/10 bg-ink px-4 py-3 text-paper">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-marigold text-ink font-bold">
                <IconHeadset size={17} />
              </div>
              <div>
                <p className="font-display text-sm font-extrabold leading-tight">Asisten SKMNetwork</p>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-paper/70">
                  <span className="h-2 w-2 rounded-full bg-leaf animate-pulse" />
                  <span>Online · Layanan Publik</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-paper/70 transition hover:bg-paper/10 hover:text-paper"
              aria-label="Tutup chat asisten"
            >
              <IconX size={18} />
            </button>
          </div>

          {/* Messages Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-ledger">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === "visitor" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-xs ${
                    m.sender === "visitor"
                      ? "rounded-br-none bg-ink text-paper"
                      : "rounded-bl-none border border-ink/10 bg-card text-ink"
                  }`}
                >
                  <p className="whitespace-pre-line">{m.text}</p>
                  {m.action && (
                    <div className="mt-2.5 border-t border-ink/10 pt-2">
                      <a
                        href={m.action.href}
                        target={m.action.isExternal ? "_blank" : "_self"}
                        rel={m.action.isExternal ? "noopener noreferrer" : undefined}
                        onClick={() => !m.action?.isExternal && setIsOpen(false)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-marigold px-3 py-1.5 text-[11px] font-extrabold text-ink transition hover:bg-marigold-2 shadow-xs"
                      >
                        <span>{m.action.label}</span>
                        <IconArrowRight size={12} />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Quick Action Selection Chips */}
            <div className="pt-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink/40 mb-2">
                Pilih topik bantuan cepat:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleSelectOption(opt)}
                    className="rounded-full border border-ink/15 bg-card px-2.5 py-1 text-[11px] font-semibold text-ink/80 transition hover:border-marigold hover:bg-marigold/10 hover:text-ink active:scale-95"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSendMessage} className="border-t border-ink/10 bg-paper p-2.5">
            <div className="flex items-center gap-1.5 rounded-xl border border-ink/20 bg-card px-3 py-1.5 focus-within:border-ink focus-within:ring-1 focus-within:ring-ink/20 transition-all">
              <input
                type="text"
                placeholder="Ketik pertanyaan Anda di sini..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-ink/40"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-paper transition hover:bg-ink-2 disabled:opacity-30 disabled:hover:bg-ink cursor-pointer"
                aria-label="Kirim pesan"
              >
                <IconSend size={13} />
              </button>
            </div>
            <p className="mt-1 text-center font-mono text-[9px] text-ink/40">
              Asisten Informasi Publik · SKMNetwork
            </p>
          </form>
        </div>
      )}

      {/* 2. Floating Live Chat Toggle Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="group relative flex h-13 w-13 items-center justify-center rounded-2xl border-2 border-ink bg-marigold text-ink shadow-[4px_4px_0_0_var(--color-ink)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--color-ink)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-ink)] cursor-pointer"
        aria-label={isOpen ? "Tutup chat asisten" : "Buka chat asisten SKMNetwork"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <IconX size={24} className="transition-transform group-hover:rotate-90" />
        ) : (
          <>
            <IconChat size={24} />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-leaf" />
            </span>
          </>
        )}
      </button>
    </div>
  );
}
