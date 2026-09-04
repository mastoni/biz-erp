import { steps } from "../data";
import { IconTarget, IconLayers, IconHeadset, IconArrowRight } from "../icons";
import { Reveal, SectionHead } from "./Ui";

const stepIcons: Record<string, React.ReactNode> = {
  target: <IconTarget size={22} />,
  layers: <IconLayers size={22} />,
  headset: <IconHeadset size={22} />,
};

export default function HowItWorks() {
  return (
    <section id="cara-kerja" className="relative border-b-2 border-ink/10 py-20 sm:py-28" aria-labelledby="cara-kerja-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead
          eyebrow="Cara kerja"
          title={<span id="cara-kerja-title">Mulai dari Kebutuhan, <span className="text-leaf">Kami Bangun Solusinya.</span></span>}
          copy="Tidak ada solusi instan yang dipaksakan. Setiap proyek berjalan lewat tiga tahap yang jelas dan terukur."
        />

        <div className="relative mt-12">
          {/* garis penghubung */}
          <div className="absolute left-8 top-8 hidden h-0.5 w-[calc(100%-6rem)] border-t-2 border-dashed border-ink/20 lg:block" aria-hidden />

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.no} delay={i * 130}>
                <article className="relative">
                  <div className="flex items-center gap-4">
                    <span className="font-display relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-ink bg-paper text-ink shadow-[4px_4px_0_0_var(--color-marigold)]">
                      {stepIcons[s.icon]}
                    </span>
                    <span className="font-display text-5xl font-extrabold text-ink/10">{s.no}</span>
                  </div>
                  <h3 className="font-display mt-5 text-xl font-bold text-ink sm:text-2xl">{s.title}</h3>
                  <p className="mt-2.5 max-w-xs text-[15px] leading-relaxed text-ink/60">{s.desc}</p>
                  {i < 2 && (
                    <span className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-ink/35">
                      lanjut ke tahap {i + 2} <IconArrowRight size={13} />
                    </span>
                  )}
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
