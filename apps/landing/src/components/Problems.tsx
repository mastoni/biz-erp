import { problems } from "../data";
import { IconWifi, IconNetwork, IconMonitor, IconCode, IconArrowUp } from "../icons";
import { Reveal, Eyebrow } from "./Ui";

const iconMap: Record<string, React.ReactNode> = {
  wifi: <IconWifi size={20} />,
  network: <IconNetwork size={20} />,
  monitor: <IconMonitor size={20} />,
  code: <IconCode size={20} />,
};

export default function Problems() {
  return (
    <section id="masalah" className="bg-ledger relative border-b-2 border-ink/10 py-20 sm:py-28" aria-labelledby="masalah-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* kiri: sticky narasi */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-32">
              <Reveal>
                <Eyebrow>Masalah yang sering terjadi</Eyebrow>
              </Reveal>
              <Reveal delay={90}>
                <h2 id="masalah-title" className="font-display mt-5 text-3xl font-extrabold leading-[1.06] tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
                  Teknologi Seharusnya <span className="text-brick">Membantu,</span> Bukan Menambah Ribet.
                </h2>
              </Reveal>
              <Reveal delay={170}>
                <p className="mt-5 text-base leading-relaxed text-ink/60 sm:text-lg">
                  Banyak UMKM dan bisnis sudah memakai teknologi — tapi berjalan terpisah-pisah, sulit dipantau,
                  dan tidak saling mendukung. Di sinilah pendekatan ekosistem SKMNetwork bekerja.
                </p>
              </Reveal>
              <Reveal delay={250}>
                <a
                  href="#solusi"
                  className="btn-arrow mt-8 inline-flex items-center gap-2 font-mono text-sm font-extrabold uppercase tracking-widest text-ink-2 transition hover:text-ink"
                >
                  Lihat solusi kami <IconArrowUp size={15} />
                </a>
              </Reveal>
            </div>
          </div>

          {/* kanan: daftar masalah */}
          <div className="space-y-5 lg:col-span-7">
            {problems.map((p, i) => (
              <Reveal key={p.no} delay={i * 90}>
                <article className="card-lift group flex items-start gap-5 rounded-xl border-2 border-ink/10 bg-card p-6 hover:border-brick/40 sm:p-7">
                  <span className="font-display text-3xl font-extrabold text-ink/15 transition-colors group-hover:text-brick sm:text-4xl">
                    {p.no}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-display flex items-center gap-3 text-lg font-bold text-ink sm:text-xl">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brick/10 text-brick">
                          {iconMap[p.icon]}
                        </span>
                        {p.title}
                      </h3>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-ink/60 sm:text-[15px]">{p.desc}</p>
                    <p className="mt-4 inline-flex rounded-full border border-brick/25 bg-brick/8 px-3 py-1 font-mono text-[11px] font-bold text-brick">
                      ▲ {p.tag}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
