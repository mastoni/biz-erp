import { useEffect, useState } from "react";
import { LogoMark, Wordmark, IconArrowRight } from "../icons";
import { navLinks, ERP_URL } from "../data";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [prog, setProg] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProg(max > 0 ? Math.min(1, h.scrollTop / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <nav
        className={`border-b transition-all duration-300 ${
          scrolled
            ? "border-ink/10 bg-paper/90 shadow-[0_8px_30px_-18px_rgba(11,31,51,0.4)] backdrop-blur-md"
            : "border-transparent bg-paper/60 backdrop-blur-sm"
        }`}
        aria-label="Navigasi utama"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#beranda" className="flex items-center gap-2.5" aria-label="SKMNetwork beranda">
            <LogoMark size={40} />
            <Wordmark />
          </a>

          {/* Desktop Navigation Links */}
          <div className="hidden items-center gap-6 xl:gap-7 lg:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="nav-link text-[13.5px] font-bold text-ink/80 transition hover:text-ink"
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* 1. Masuk ERP (Web App SKMNetwork ERP) */}
            <a
              href={`${ERP_URL}/login`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-marigold/40 bg-marigold/15 px-3.5 py-2 text-xs font-extrabold text-marigold-2 transition hover:border-marigold hover:bg-marigold/25"
            >
              <span>Masuk ERP</span>
              <span className="hidden sm:inline">↗</span>
            </a>

            {/* 2. Hubungi Kami CTA */}
            <a
              href="#kontak"
              className="btn-arrow hidden items-center gap-2 rounded-lg bg-ink px-4 py-2 text-xs font-extrabold text-paper transition hover:bg-ink-2 sm:inline-flex"
            >
              <span>Hubungi Kami</span>
              <IconArrowRight size={13} />
            </a>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink/15 bg-card text-ink lg:hidden"
              aria-label={open ? "Tutup menu" : "Buka menu"}
              aria-expanded={open}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                {open ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M4 7h16M4 12h16M4 17h10" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        <div
          className={`grid overflow-hidden border-ink/10 bg-paper transition-all duration-300 lg:hidden ${
            open ? "grid-rows-[1fr] border-t" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-1 px-4 py-3">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-bold text-ink/80 transition hover:bg-ink/5 hover:text-ink"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-ink/10 pt-3">
                <a
                  href={`${ERP_URL}/login`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-lg border-2 border-marigold/50 bg-marigold/10 px-3 py-2.5 text-center text-xs font-extrabold text-marigold-2"
                >
                  <span>Masuk ke SKMNetwork ERP</span>
                  <span>↗</span>
                </a>
                <a
                  href="#kontak"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-ink px-3 py-2.5 text-center text-xs font-extrabold text-paper"
                >
                  Hubungi Kami
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Progress Bar */}
        <div className="h-[3px] w-full bg-ink/5" aria-hidden>
          <div className="h-full bg-marigold transition-[width] duration-150 ease-out" style={{ width: `${prog * 100}%` }} />
        </div>
      </nav>
    </header>
  );
}
