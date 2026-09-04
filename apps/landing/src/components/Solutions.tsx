import { solutions } from "../data";
import {
  IconWifi,
  IconNetwork,
  IconCctv,
  IconCode,
  IconChip,
  IconHeadset,
  IconCheck,
  IconArrowUp,
  IconServer,
} from "../icons";
import { Reveal, SectionHead } from "./Ui";

const iconMap: Record<string, React.ReactNode> = {
  wifi: <IconWifi size={22} />,
  network: <IconNetwork size={22} />,
  cctv: <IconCctv size={22} />,
  code: <IconCode size={22} />,
  chip: <IconChip size={22} />,
  headset: <IconHeadset size={22} />,
};

function Visual({ type, dark = false }: { type: string; dark?: boolean }) {
  const ink = dark ? "text-paper" : "text-ink";
  const sub = dark ? "text-paper/55" : "text-ink/50";
  const line = dark ? "border-paper/15" : "border-ink/10";

  if (type === "signal")
    return (
      <div className="mt-6 flex flex-1 flex-col justify-end">
        <div className="relative flex items-end justify-center gap-2 rounded-lg border-2 border-dashed px-5 pb-5 pt-8" style={{ borderColor: "rgba(11,31,51,0.18)" }}>
          {[38, 55, 72, 88, 100].map((h, i) => (
            <span key={i} className="w-5 rounded-t-md bg-marigold/80" style={{ height: `${h * 0.9}px` }} />
          ))}
          <span className="absolute left-4 top-3 font-mono text-[10px] font-bold uppercase tracking-widest text-ink/40">
            kualitas sinyal
          </span>
          <span className="absolute right-4 top-3 inline-flex items-center gap-1.5 rounded-full border border-leaf/30 bg-leaf/10 px-2 py-0.5 font-mono text-[10px] font-bold text-leaf">
            <span className="relative h-1.5 w-1.5 rounded-full bg-leaf text-leaf ping-dot" /> stabil
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[
            ["Rumah", <IconWifi key="a" size={15} />],
            ["Usaha", <IconNetwork key="b" size={15} />],
            ["Kantor", <IconServer key="c" size={15} />],
          ].map(([t, ic]) => (
            <span key={t as string} className={`flex items-center justify-center gap-2 rounded-lg border-2 px-2 py-2.5 text-xs font-extrabold ${line} ${ink}`}>
              <span className="text-marigold-2">{ic}</span> {t}
            </span>
          ))}
        </div>
      </div>
    );

  if (type === "node")
    return (
      <div className="mt-5">
        <svg viewBox="0 0 200 60" className="w-full" aria-hidden>
          <path d="M20 45 70 18l60 20 50-22" stroke="var(--color-ink)" strokeOpacity="0.3" strokeWidth="1.6" strokeDasharray="3 5" fill="none" />
          {[
            [20, 45, "var(--color-marigold)"],
            [70, 18, "var(--color-sky-2)"],
            [130, 38, "var(--color-leaf)"],
            [180, 16, "var(--color-brick)"],
          ].map(([x, y, c], i) => (
            <circle key={i} cx={x as number} cy={y as number} r="6.5" fill={c as string} />
          ))}
        </svg>
        <p className={`mt-2 font-mono text-[10px] ${sub}`}>topologi tertata · perangkat terdokumentasi</p>
      </div>
    );

  if (type === "cam")
    return (
      <div className={`relative mt-5 overflow-hidden rounded-lg border-2 ${line}`}>
        <div className="bg-ledger-dark flex h-24 items-center justify-center bg-ink">
          <IconCctv size={30} className="text-paper/30" />
          <span className="absolute left-2.5 top-2 h-3 w-3 border-l-2 border-t-2 border-marigold" aria-hidden />
          <span className="absolute right-2.5 top-2 h-3 w-3 border-r-2 border-t-2 border-marigold" aria-hidden />
          <span className="absolute bottom-2 left-2.5 h-3 w-3 border-b-2 border-l-2 border-marigold" aria-hidden />
          <span className="absolute bottom-2 right-2.5 h-3 w-3 border-b-2 border-r-2 border-marigold" aria-hidden />
          <span className="rec-blink absolute right-3 top-2.5 flex items-center gap-1.5 font-mono text-[9px] font-bold text-brick">
            <span className="h-1.5 w-1.5 rounded-full bg-brick" /> REC
          </span>
        </div>
        <p className={`px-3 py-2 font-mono text-[10px] ${sub}`}>pantauan langsung dari mana saja</p>
      </div>
    );

  if (type === "code")
    return (
      <div className={`mt-5 rounded-lg border-2 p-3.5 font-mono text-[11px] ${line}`}>
        <p className={sub}>
          <span className="text-sky-2">sistem</span>.<span className="text-leaf">jual</span>(produk, qty)
        </p>
        <p className={`mt-1 ${sub}`}>
          <span className="text-sky-2">stok</span>.update → <span className={`font-bold ${ink}`}>otomatis</span>
        </p>
        <p className={`mt-1 ${sub}`}>
          <span className="text-sky-2">laporan</span>.render → <span className={`font-bold ${ink}`}>real-time</span>
        </p>
      </div>
    );

  if (type === "chip")
    return (
      <div className="mt-5 flex flex-wrap gap-2">
        {["Analisis", "Desain", "Implementasi", "Iterasi"].map((s, i) => (
          <span key={s} className={`rounded-full border-2 px-3 py-1 font-mono text-[10px] font-bold ${i === 2 ? "border-ink bg-ink text-marigold" : "border-ink/15 text-ink/60"}`}>
            {s}
          </span>
        ))}
      </div>
    );

  /* support */
  return (
    <div className="mt-5 space-y-2">
      {[
        ["Perawatan berkala", "terjadwal"],
        ["Bantuan teknis", "responsif"],
        ["Pengecekan sistem", "menyeluruh"],
      ].map(([a, b]) => (
        <div key={a} className="flex items-center justify-between rounded-lg border border-paper/12 bg-paper/5 px-3.5 py-2">
          <span className="flex items-center gap-2 font-mono text-[11px] font-bold text-paper/80">
            <IconCheck size={13} className="text-marigold" /> {a}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper/40">{b}</span>
        </div>
      ))}
    </div>
  );
}

export default function Solutions() {
  return (
    <section id="solusi" className="relative border-b-2 border-ink/10 bg-card/50 py-20 sm:py-28" aria-labelledby="solusi-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead
            eyebrow="Ekosistem layanan SKMNetwork"
            title={<span id="solusi-title">Semua Kebutuhan Teknologi, <span className="text-sky-2">Satu Ekosistem.</span></span>}
            copy="Enam layanan yang dirancang saling terhubung — dari konektivitas hingga sistem bisnis, dengan dukungan yang berkelanjutan."
          />
          <Reveal delay={200}>
            <a href="#erp" className="btn-arrow hidden items-center gap-2 font-mono text-sm font-extrabold uppercase tracking-widest text-ink-2 transition hover:text-ink lg:inline-flex">
              Kenal SKMNetwork ERP <IconArrowUp size={15} />
            </a>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-12 lg:grid-rows-[repeat(3,auto)]">
          {solutions.map((m, i) => (
            <Reveal key={m.id} delay={i * 70} className={m.span}>
              <article
                className={`card-lift group flex h-full flex-col rounded-xl border-2 p-6 sm:p-7 ${
                  m.dark ? "border-ink bg-ink text-paper" : "border-ink/10 bg-card text-ink hover:border-ink/30"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 transition ${
                        m.dark
                          ? "border-marigold/40 bg-marigold/10 text-marigold"
                          : "border-ink/10 bg-paper text-ink group-hover:border-marigold group-hover:bg-marigold/15"
                      }`}
                    >
                      {iconMap[m.icon]}
                    </span>
                    <h3 className="font-display text-lg font-bold sm:text-xl">{m.title}</h3>
                  </div>
                  <IconArrowUp size={18} className={`mt-1 shrink-0 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 ${m.dark ? "text-marigold" : "text-ink/30 group-hover:text-ink"}`} />
                </div>

                <p className={`mt-3.5 text-sm leading-relaxed ${m.dark ? "text-paper/70" : "text-ink/65"}`}>{m.desc}</p>

                <Visual type={m.visual} dark={m.dark} />

                <ul className={`mt-5 space-y-1.5 border-t-2 pt-4 ${m.dark ? "border-paper/10" : "border-ink/8"}`}>
                  {m.points.map((pt) => (
                    <li key={pt} className={`flex items-center gap-2 text-[13px] font-semibold ${m.dark ? "text-paper/80" : "text-ink/70"}`}>
                      <IconCheck size={15} className={m.dark ? "text-marigold" : "text-leaf"} />
                      {pt}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
