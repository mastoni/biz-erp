import { SITE, ERP_URL } from "../data";
import { LogoMark, Wordmark, IconGlobe, IconArrowUp } from "../icons";

const cols: { title: string; links: { label: string; href: string; ext?: boolean }[] }[] = [
  {
    title: "Solusi",
    links: [
      { label: "Internet & WiFi", href: "#internet" },
      { label: "Network", href: "#solusi" },
      { label: "CCTV", href: "#infrastruktur" },
      { label: "Software", href: "#solusi" },
      { label: "IT Solutions", href: "#solusi" },
    ],
  },
  {
    title: "Produk",
    links: [
      { label: "SKMNetwork ERP", href: "#erp" },
      { label: "Modul ERP", href: "#erp" },
      { label: "Masuk ERP", href: `${ERP_URL}/login`, ext: true },
    ],
  },
  {
    title: "Perusahaan",
    links: [
      { label: "Tentang", href: "#tentang" },
      { label: "Kontak", href: "#kontak" },
      { label: "Teknologi", href: "#teknologi" },
    ],
  },
  {
    title: "Dukungan",
    links: [
      { label: "Hubungi Kami", href: "#kontak" },
      { label: "Bantuan", href: "#faq" },
      { label: "FAQ", href: "#faq" },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-4 border-marigold bg-ink text-paper" aria-label="Footer SKMNetwork">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* brand */}
          <div className="lg:col-span-4">
            <a href="#beranda" className="flex items-center gap-2.5" aria-label="Kembali ke atas">
              <LogoMark size={42} />
              <Wordmark dark />
            </a>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-paper/60">
              Teknologi, jaringan, internet, dan solusi digital untuk kebutuhan rumah dan bisnis.
            </p>
            <a
              href={SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2.5 rounded-xl border-2 border-paper/15 px-4 py-2.5 font-mono text-xs font-bold text-paper/80 transition hover:border-marigold hover:text-marigold"
            >
              <IconGlobe size={15} className="text-marigold" />
              www.skmnetwork.com
            </a>
          </div>

          {/* kolom link */}
          {cols.map((c) => (
            <nav key={c.title} className="lg:col-span-2" aria-label={c.title}>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-marigold">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      {...(l.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="text-sm font-semibold text-paper/65 transition hover:text-marigold"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* bar bawah */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t-2 border-dashed border-paper/15 pt-7 sm:flex-row">
          <p className="font-mono text-[11px] font-semibold text-paper/40">
            © {year} SKMNetwork · Teknologi, Jaringan & Solusi Digital
          </p>
          <a
            href="#beranda"
            className="group inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-paper/40 transition hover:text-marigold"
          >
            Kembali ke atas
            <span className="transition-transform group-hover:-translate-y-1">
              <IconArrowUp size={13} />
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
