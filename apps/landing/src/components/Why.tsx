import { whyPoints } from "../data";
import { IconLink, IconHeadset, IconGear, IconExpand, IconTarget, IconArrowUp } from "../icons";
import { Reveal, Eyebrow } from "./Ui";

const whyIcons: Record<string, React.ReactNode> = {
  link: <IconLink size={20} />,
  headset: <IconHeadset size={20} />,
  gear: <IconGear size={20} />,
  expand: <IconExpand size={20} />,
  target: <IconTarget size={20} />,
};

export default function Why() {
  return (
    <section id="tentang" className="bg-ledger relative border-b-2 border-ink/10 bg-card/50 py-20 sm:py-28" aria-labelledby="tentang-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-32">
              <Reveal>
                <Eyebrow>Mengapa SKMNetwork</Eyebrow>
              </Reveal>
              <Reveal delay={90}>
                <h2 id="tentang-title" className="font-display mt-5 text-3xl font-extrabold leading-[1.06] tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
                  Teknologi yang Dibuat untuk <span className="text-marigold-2">Kebutuhan Nyata.</span>
                </h2>
              </Reveal>
              <Reveal delay={170}>
                <p className="mt-5 text-base leading-relaxed text-ink/60 sm:text-lg">
                  SKMNetwork berangkat dari masalah nyata di lapangan: teknologi yang terpasang tapi tidak terkelola.
                  Kami membangun ekosistem yang praktis, terintegrasi, dan terus didampingi — untuk rumah, usaha, dan bisnis.
                </p>
              </Reveal>
              <Reveal delay={250}>
                <a
                  href="#kontak"
                  className="btn-arrow mt-8 inline-flex items-center gap-2 font-mono text-sm font-extrabold uppercase tracking-widest text-ink-2 transition hover:text-ink"
                >
                  Bicara dengan kami <IconArrowUp size={15} />
                </a>
              </Reveal>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="divide-y-2 divide-ink/8 rounded-2xl border-2 border-ink/10 bg-card">
              {whyPoints.map((w, i) => (
                <Reveal key={w.no} delay={i * 70}>
                  <div className="group flex items-start gap-5 px-6 py-6 transition hover:bg-marigold/10 sm:items-center sm:px-8">
                    <span className="font-display w-12 shrink-0 text-2xl font-extrabold text-ink/15 transition group-hover:text-marigold-2 sm:text-3xl">
                      {w.no}
                    </span>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-ink/10 bg-paper text-ink transition group-hover:border-marigold group-hover:bg-marigold/20">
                      {whyIcons[w.icon]}
                    </span>
                    <span className="flex-1">
                      <span className="font-display block text-lg font-bold text-ink sm:text-xl">{w.title}</span>
                      <span className="mt-1 block max-w-xl text-sm leading-relaxed text-ink/60">{w.desc}</span>
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
