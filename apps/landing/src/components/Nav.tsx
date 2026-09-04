import { useEffect, useState } from "react";
import { LogoMark, Wordmark } from "../icons";
import { navLinks, ERP_URL, PORTAL_URL } from "../data";

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

          <div className="hidden items-center gap-7 lg:flex">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="nav-link text-sm font-semibold text-ink/80 transition hover:text-ink">
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`${ERP_URL}/login`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden font-mono text-[10px] font-bold uppercase tracking-widest text-ink/45 transition hover:text-ink xl:block"
            >
              Masuk ERP
            </a>
            <a
              href={PORTAL_URL}
              className="hidden items-center gap-2 rounded-lg border-2 border-ink/15 px-3.5 py-2 text-sm font-bold text-ink transition hover:border-ink/40 sm:inline-flex"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="8" r="3.4" />
                <path d="M5 20c1.3-3.4 3.9-5 7-5s5.7 1.6 7 5" />
              </svg>
              Portal Pelanggan
            </a>
            <a
              href="#kontak"
              className="btn-arrow hidden items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-paper transition hover:bg-ink-2 sm:inline-flex"
            >
              Hubungi Kami
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 12h15M13.5 5.5 20 12l-6.5 6.5" />
              </svg>
            </a>
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-ink/15 bg-card text-ink lg:hidden"
              aria-label={open ? "Tutup menu" : "Buka menu"}
              aria-expanded={open}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                {open ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M4 7h16M4 12h16M4 17h10" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Menu mobile */}
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
                  className="rounded-lg px-3 py-2.5 text-sm font-semibold text-ink/80 transition hover:bg-ink/5 hover:text-ink"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-2">
                <a
                  href={`${ERP_URL}/login`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border-2 border-ink/15 px-3 py-2.5 text-center text-sm font-bold text-ink"
                >
                  Masuk ERP
                </a>
                <a
                  href={PORTAL_URL}
                  onClick={() => setOpen(false)}
                  className="rounded-lg border-2 border-ink/15 px-3 py-2.5 text-center text-sm font-bold text-ink"
                >
                  Portal Pelanggan
                </a>
                <a href="#kontak" onClick={() => setOpen(false)} className="rounded-lg bg-ink px-3 py-3 text-center text-sm font-bold text-paper">
                  Hubungi Kami
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* progress baca halaman */}
        <div className="h-[3px] w-full bg-ink/5" aria-hidden>
          <div className="h-full bg-marigold transition-[width] duration-150 ease-out" style={{ width: `${prog * 100}%` }} />
        </div>
      </nav>
    </header>
  );
}
