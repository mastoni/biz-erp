import { useEffect, useState } from "react";
import { useScramble } from "../hooks";
import { capabilities, heroNodes } from "../data";
import { fetchPublicShowcase } from "../lib/api";
import type { PublicShowcaseItem } from "../types";

const STATUS_MSGS = [
  { label: "semua node terhubung", dot: "bg-leaf text-leaf" },
  { label: "cctv · online", dot: "bg-leaf text-leaf" },
  { label: "erp · aktif", dot: "bg-marigold text-marigold" },
  { label: "jaringan · stabil", dot: "bg-leaf text-leaf" },
  { label: "backup · terjadwal", dot: "bg-sky-2 text-sky-2" },
];
import {
  LogoMark,
  IconWifi,
  IconNetwork,
  IconCctv,
  IconCode,
  IconCloud,
  IconBusiness,
  IconArrowRight,
} from "../icons";
import { Reveal } from "./Ui";

const nodeIcons: Record<string, React.ReactNode> = {
  wifi: <IconWifi size={16} />,
  network: <IconNetwork size={16} />,
  cctv: <IconCctv size={16} />,
  code: <IconCode size={16} />,
  cloud: <IconCloud size={16} />,
  business: <IconBusiness size={16} />,
};

const capIcons: Record<string, React.ReactNode> = {
  wifi: <IconWifi size={20} />,
  network: <IconNetwork size={20} />,
  cctv: <IconCctv size={20} />,
  code: <IconCode size={20} />,
};

/* Titik anchor garis koneksi (persen dari viewBox 100x100) */
const anchors: [number, number][] = [
  [50, 12],
  [82, 27],
  [84, 66],
  [62, 88],
  [16, 88],
  [6, 47],
];

function HeadlineWord({ w, i, accent = false }: { w: string; i: number; accent?: boolean }) {
  return (
    <span className="mask-line">
      <span
        style={{ "--w-delay": `${250 + i * 65}ms` } as React.CSSProperties}
        className={accent ? "text-brick" : undefined}
      >
        {w}
        {"\u00A0"}
      </span>
    </span>
  );
}

export default function Hero() {
  const eyebrow = useScramble("TEKNOLOGI • JARINGAN • SOLUSI DIGITAL", true);
  const [statusIdx, setStatusIdx] = useState(0);
  const [featuredItem, setFeaturedItem] = useState<PublicShowcaseItem | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setStatusIdx((i) => (i + 1) % STATUS_MSGS.length), 2600);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    fetchPublicShowcase("HERO_FEATURED")
      .then((res) => {
        if (active && res.items && res.items.length > 0) {
          setFeaturedItem(res.items[0]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const status = STATUS_MSGS[statusIdx];
  const h1 = "Teknologi yang Menghubungkan Bisnis dan Kehidupan Digital Anda.".split(" ");

  return (
    <section id="beranda" className="bg-ledger relative overflow-hidden pt-28 sm:pt-32" aria-labelledby="hero-title">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-marigold/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -left-40 top-1/2 h-80 w-80 rounded-full bg-sky-2/10 blur-3xl" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 pb-16 sm:pb-20 lg:grid-cols-12 lg:gap-8">
          {/* kiri: pesan */}
          <div className="lg:col-span-6 xl:col-span-6">
            <Reveal>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-card px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-2">
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-leaf text-leaf ping-dot" />
                  <span className="min-h-[1em]">{eyebrow}</span>
                </span>
                {featuredItem && (
                  <a
                    href={featuredItem.cta_url || "#erp"}
                    className="inline-flex items-center gap-1.5 rounded-full border border-marigold/40 bg-marigold/15 px-3 py-1 font-mono text-[10px] font-bold text-ink transition hover:bg-marigold/25"
                  >
                    <span className="rounded-full bg-marigold px-1.5 py-0.5 text-[8px] font-extrabold uppercase text-ink">
                      {featuredItem.marketing_badge || "FEATURED"}
                    </span>
                    <span>{featuredItem.display_name}</span>
                    <IconArrowRight size={11} />
                  </a>
                )}
              </div>
            </Reveal>

            <h1
              id="hero-title"
              className="font-display mt-6 text-[2.65rem] font-extrabold leading-[1.01] tracking-tight text-ink sm:text-6xl xl:text-[4.15rem]"
            >
              {h1.map((w, i) =>
                w === "Menghubungkan" ? (
                  <span key={i} className="relative inline-block">
                    <span className="mask-line">
                      <span style={{ "--w-delay": `${250 + i * 65}ms` } as React.CSSProperties}>{w}{"\u00A0"}</span>
                    </span>
                    <svg
                      className="stroke-draw absolute -bottom-1.5 left-0 w-full"
                      viewBox="0 0 300 14"
                      fill="none"
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      <path d="M4 10C80 3 220 3 296 8" stroke="var(--color-marigold)" strokeWidth="7" strokeLinecap="round" />
                    </svg>
                  </span>
                ) : (
                  <HeadlineWord key={i} w={w} i={i} />
                ),
              )}
            </h1>

            <Reveal delay={420}>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-ink/60 sm:text-lg">
                SKMNetwork menghadirkan <strong className="font-bold text-ink">internet, jaringan, CCTV, dan solusi digital</strong>{" "}
                — termasuk SKMNetwork ERP — untuk membantu UMKM dan bisnis tetap terhubung serta lebih mudah mengelola usahanya.
              </p>
            </Reveal>

            <Reveal delay={520}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#solusi"
                  className="btn-arrow inline-flex items-center gap-2.5 rounded-xl bg-ink px-7 py-4 text-base font-extrabold text-paper transition hover:-translate-y-0.5 hover:bg-ink-2"
                >
                  Jelajahi Solusi
                  <IconArrowRight size={17} />
                </a>
                <a
                  href="#kontak"
                  className="inline-flex items-center gap-2.5 rounded-xl border-2 border-ink/20 px-7 py-[14px] text-base font-bold text-ink transition hover:border-ink/50 hover:bg-card"
                >
                  Hubungi SKMNetwork
                </a>
              </div>
            </Reveal>

            <Reveal delay={620}>
              <p className="mt-7 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/40">
                Internet · Network · CCTV · Software · ERP · Support
              </p>
            </Reveal>
          </div>

          {/* kanan: ekosistem jaringan */}
          <div className="lg:col-span-6 xl:col-span-6">
            <div className="relative mx-auto aspect-[10/9] w-full max-w-[560px]">
              {/* radar rings */}
              <div className="absolute left-1/2 top-1/2 h-[74%] w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-ink/12 orbit-slow" aria-hidden />
              <div className="absolute left-1/2 top-1/2 h-[52%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/10" aria-hidden />

              {/* garis koneksi */}
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                fill="none"
                aria-hidden
              >
                {anchors.map(([x, y], i) => (
                  <line
                    key={i}
                    x1="50"
                    y1="50"
                    x2={x}
                    y2={y}
                    stroke="var(--color-ink)"
                    strokeOpacity="0.22"
                    strokeWidth="1.4"
                    vectorEffect="non-scaling-stroke"
                    className="flow-line"
                    style={{ animationDelay: `${i * 0.25}s` }}
                  />
                ))}
                {/* paket data yang mengalir antar node */}
                {anchors.slice(0, 3).map(([x, y], i) => (
                  <circle
                    key={`pkt-${i}`}
                    r="1.1"
                    fill={i === 1 ? "var(--color-leaf)" : "var(--color-marigold)"}
                    className="motion-reduce:hidden"
                  >
                    <animateMotion dur={`${2.6 + i * 0.8}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" path={`M50 50 L${x} ${y}`} />
                  </circle>
                ))}
              </svg>

              {/* hub pusat */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="relative flex flex-col items-center rounded-2xl border-2 border-ink/15 bg-card px-6 py-5 shadow-[0_20px_45px_-20px_rgba(11,31,51,0.45)]">
                  <span className="absolute -right-1.5 -top-1.5 inline-flex h-3.5 w-3.5 rounded-full bg-leaf text-leaf ping-dot" />
                  <LogoMark size={44} />
                  <p className="font-display mt-2 text-lg font-extrabold leading-none text-ink">
                    SKM<span className="text-marigold-2">Network</span>
                  </p>
                  <p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-ink/40">ekosistem</p>
                  <span
                    key={statusIdx}
                    className="tick-in absolute -bottom-11 inline-flex items-center gap-2 whitespace-nowrap rounded-full border-2 border-ink/10 bg-paper/95 px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink/70 shadow-sm"
                    role="status"
                    aria-live="polite"
                  >
                    <span className={`relative h-2 w-2 rounded-full ${status.dot} ping-dot`} />
                    {status.label}
                  </span>
                </div>
              </div>

              {/* node satelit */}
              {heroNodes.map((n, i) => (
                <div
                  key={n.label}
                  className={`absolute ${n.pos} floaty`}
                  style={{ "--fl-delay": `${i * 0.7}s` } as React.CSSProperties}
                >
                  <div className="flex items-center gap-2.5 rounded-xl border-2 border-ink/12 bg-card px-3.5 py-2.5 shadow-[0_10px_25px_-14px_rgba(11,31,51,0.5)] transition hover:border-marigold">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-marigold/20 text-ink">
                      {nodeIcons[n.icon]}
                    </span>
                    <span className="pr-1">
                      <span className="block text-xs font-extrabold leading-tight text-ink">{n.label}</span>
                      <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-ink/40">{n.sub}</span>
                    </span>
                  </div>
                </div>
              ))}

              {/* tag protokol */}
              <span className="floaty absolute left-[24%] top-[24%] hidden rounded-md border border-ink/10 bg-paper px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-ink/45 md:block" style={{ "--fl-delay": "1.2s" } as React.CSSProperties}>
                uplink
              </span>
              <span className="floaty absolute right-[12%] top-[46%] hidden rounded-md border border-ink/10 bg-paper px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-ink/45 md:block" style={{ "--fl-delay": "2.1s" } as React.CSSProperties}>
                rtsp
              </span>
              <span className="floaty absolute bottom-[22%] left-[30%] hidden rounded-md border border-ink/10 bg-paper px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-ink/45 md:block" style={{ "--fl-delay": "3s" } as React.CSSProperties}>
                api
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* trust strip: kapabilitas */}
      <div className="relative border-t-2 border-ink/10 bg-ink" aria-label="Kapabilitas SKMNetwork">
        <div className="mx-auto grid max-w-7xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((c, i) => (
            <Reveal
              key={c.title}
              delay={i * 90}
              className={`flex items-start gap-4 px-6 py-7 sm:px-8 ${i > 0 ? "border-t border-paper/10 sm:border-t-0" : ""} ${
                i % 2 === 1 ? "sm:border-l sm:border-paper/10" : ""
              } ${i > 0 ? "lg:border-l lg:border-paper/10" : ""} ${i >= 2 ? "sm:border-t sm:border-paper/10 lg:border-t-0" : ""}`}
            >
              <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-marigold/15 text-marigold">
                {capIcons[c.icon]}
              </span>
              <span>
                <span className="font-display block text-[15px] font-bold text-paper">{c.title}</span>
                <span className="mt-1 block text-[13px] leading-snug text-paper/55">{c.desc}</span>
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
