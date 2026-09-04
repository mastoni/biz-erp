import { useClock } from "../hooks";
import { IconCctv, IconNetwork, IconMonitor, IconGear, IconCheck } from "../icons";
import { Reveal, SectionHead } from "./Ui";

const cams = [
  { id: "CAM 01", tone: "from-ink-3/60 to-ink" },
  { id: "CAM 02", tone: "from-sky-2/40 to-ink" },
  { id: "CAM 03", tone: "from-ink-2/80 to-ink" },
  { id: "CAM 04", tone: "from-leaf/25 to-ink" },
];

const pillars = [
  { icon: <IconCctv size={19} />, title: "CCTV", desc: "Instalasi & penempatan kamera yang tepat sasaran." },
  { icon: <IconNetwork size={19} />, title: "Network", desc: "Perangkat dan switch yang tertata dalam jaringan." },
  { icon: <IconMonitor size={19} />, title: "Monitoring", desc: "Pantauan terpusat yang bisa diakses kapan saja." },
  { icon: <IconGear size={19} />, title: "Maintenance", desc: "Perawatan agar sistem tetap sehat dan terjaga." },
];

export default function Cctv() {
  const clock = useClock();

  return (
    <section
      id="infrastruktur"
      className="bg-ledger-dark relative overflow-hidden border-b-2 border-ink/10 bg-ink py-20 text-paper sm:py-28"
      aria-labelledby="infra-title"
      style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(243,242,234,0.025) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(243,242,234,0.025) 0 1px, transparent 1px 40px)" }}
    >
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-leaf/10 blur-3xl" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-16">
          {/* kiri: monitoring wall */}
          <div className="order-2 lg:order-1 lg:col-span-6">
            <Reveal>
              <div className="overflow-hidden rounded-2xl border-2 border-paper/12 bg-ink-2/40 shadow-[0_35px_70px_-30px_rgba(0,0,0,0.7)]">
                {/* header panel */}
                <div className="flex items-center justify-between border-b border-paper/10 px-5 py-3">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-paper/50">
                    panel pemantauan
                  </p>
                  <p className="font-mono text-[11px] font-bold tabular-nums text-marigold">{clock} WIB</p>
                </div>

                {/* grid kamera */}
                <div className="grid grid-cols-2 gap-2.5 p-4">
                  {cams.map((c, i) => (
                    <div key={c.id} className={`relative aspect-[16/10] overflow-hidden rounded-lg border border-paper/10 bg-gradient-to-br ${c.tone}`}>
                      {/* siluet sederhana */}
                      <svg viewBox="0 0 120 75" className="absolute inset-0 h-full w-full opacity-25" aria-hidden>
                        <rect x="10" y="40" width="26" height="35" fill="var(--color-paper)" />
                        <rect x="46" y="25" width="34" height="50" fill="var(--color-paper)" />
                        <rect x="90" y="48" width="20" height="27" fill="var(--color-paper)" />
                      </svg>
                      {/* scanline */}
                      <span className="scanline absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-transparent via-paper/10 to-transparent" style={{ animationDelay: `${i * 1.3}s` }} aria-hidden />
                      {/* frame corners */}
                      <span className="absolute left-1.5 top-1.5 h-2.5 w-2.5 border-l-2 border-t-2 border-marigold/70" aria-hidden />
                      <span className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 border-b-2 border-r-2 border-marigold/70" aria-hidden />
                      <span className="absolute left-2.5 top-2 font-mono text-[9px] font-bold tracking-widest text-paper/80">{c.id}</span>
                      <span className="rec-blink absolute right-2.5 top-2 flex items-center gap-1 font-mono text-[8px] font-bold text-brick" style={{ animationDelay: `${i * 0.4}s` }}>
                        <span className="h-1.5 w-1.5 rounded-full bg-brick" /> REC
                      </span>
                    </div>
                  ))}
                </div>

                {/* panel switch */}
                <div className="mx-4 mb-4 rounded-lg border border-paper/10 bg-paper/[0.04] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-paper/45">switch · port status</p>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-leaf">uplink ok</p>
                  </div>
                  <div className="mt-2.5 flex gap-1.5">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <span
                        key={i}
                        className={`led h-2.5 flex-1 rounded-sm ${i < 9 ? "bg-leaf" : i < 11 ? "bg-marigold" : "bg-paper/15"}`}
                        style={{ "--led-delay": `${(i % 5) * 0.35}s` } as React.CSSProperties}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* kanan: narasi */}
          <div className="order-1 lg:order-2 lg:col-span-6">
            <SectionHead
              tone="dark"
              eyebrow="CCTV & jaringan"
              title={<span id="infra-title">Bangun Infrastruktur yang <span className="text-leaf">Bisa Dipantau.</span></span>}
              copy="Kamera, jaringan, dan perangkat tidak sekadar terpasang — semuanya terpantau dan terawat, sehingga gangguan tertangani sebelum berdampak."
            />

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {pillars.map((p, i) => (
                <Reveal key={p.title} delay={i * 80}>
                  <div className="group flex items-start gap-3.5 rounded-xl border border-paper/12 bg-paper/[0.04] p-4.5 transition hover:border-leaf/50 hover:bg-paper/[0.07]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-leaf/15 text-leaf transition group-hover:bg-leaf group-hover:text-paper">
                      {p.icon}
                    </span>
                    <span>
                      <span className="font-display block text-[15px] font-bold text-paper">{p.title}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-paper/55">{p.desc}</span>
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={340}>
              <p className="mt-6 flex items-center gap-2.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-paper/40">
                <IconCheck size={14} className="text-leaf" /> arsitektur dirancang aman & tidak diekspos ke publik
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
