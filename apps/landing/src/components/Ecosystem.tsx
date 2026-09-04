import { ecosystemLayers } from "../data";
import {
  IconWifi,
  IconNetwork,
  IconCctv,
  IconMonitor,
  IconCode,
  IconBusiness,
} from "../icons";
import { Reveal, SectionHead } from "./Ui";

const layerIcons: Record<string, React.ReactNode> = {
  wifi: <IconWifi size={20} />,
  network: <IconNetwork size={20} />,
  cctv: <IconCctv size={20} />,
  monitor: <IconMonitor size={20} />,
  code: <IconCode size={20} />,
  business: <IconBusiness size={20} />,
};

export default function Ecosystem() {
  return (
    <section
      id="teknologi"
      className="bg-ledger-dark relative overflow-hidden border-b-2 border-ink/10 bg-ink py-20 text-paper sm:py-28"
      aria-labelledby="teknologi-title"
    >
      <div className="pointer-events-none absolute -right-40 top-0 h-96 w-96 rounded-full bg-marigold/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-sky-2/15 blur-3xl" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
          {/* kiri sticky */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-32">
              <SectionHead
                tone="dark"
                eyebrow="Teknologi · cara kerjanya"
                title={<span id="teknologi-title">Dari Koneksi Sampai <span className="text-marigold">Sistem Bisnis.</span></span>}
                copy="Setiap lapisan saling menopang: koneksi yang baik menghidupi jaringan, jaringan membawa data perangkat, monitoring menjaganya tetap sehat, dan software mengubahnya menjadi operasional bisnis yang terkendali."
              />
              <Reveal delay={260}>
                <div className="mt-8 flex items-center gap-3 rounded-xl border border-paper/12 bg-paper/[0.04] p-4">
                  <span className="relative inline-flex h-3 w-3 shrink-0 rounded-full bg-leaf text-leaf ping-dot" />
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-paper/55">
                    6 lapisan · 1 ekosistem terkelola
                  </p>
                </div>
              </Reveal>
            </div>
          </div>

          {/* kanan: alur vertikal */}
          <div className="lg:col-span-7">
            <div className="relative">
              {/* garis tulang punggung */}
              <svg className="absolute bottom-6 left-[27px] top-6 hidden w-px sm:block" aria-hidden>
                <line x1="0.5" y1="0" x2="0.5" y2="100%" stroke="var(--color-paper)" strokeOpacity="0.3" strokeWidth="1.5" className="flow-line-slow" style={{ strokeDasharray: "3 8" }} />
              </svg>

              <ol className="space-y-4">
                {ecosystemLayers.map((l, i) => (
                  <Reveal key={l.title} delay={i * 90}>
                    <li className="relative flex items-start gap-5 sm:gap-7">
                      {/* node */}
                      <span className="relative z-10 mt-1 flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-xl border-2 border-paper/15 bg-ink-2 text-marigold shadow-[0_0_0_6px_rgba(11,31,51,1)]">
                        {layerIcons[l.icon]}
                      </span>

                      {/* kartu */}
                      <div className="group flex-1 rounded-xl border border-paper/12 bg-paper/[0.045] p-5 transition hover:border-marigold/50 hover:bg-paper/[0.08] sm:p-6">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-marigold">{l.tag}</p>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-paper/25 transition group-hover:text-marigold" aria-hidden>
                            <path d="M4 12h15M13.5 5.5 20 12l-6.5 6.5" />
                          </svg>
                        </div>
                        <h3 className="font-display mt-1.5 text-xl font-bold text-paper sm:text-2xl">{l.title}</h3>
                        <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-paper/60">{l.desc}</p>
                      </div>
                    </li>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
