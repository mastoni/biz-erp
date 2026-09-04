import { devTracks } from "../data";
import { IconNetwork, IconErp, IconCctv, IconChip, IconHeadset, IconArrowRight } from "../icons";
import { Reveal, SectionHead } from "./Ui";

const trackIcons: Record<string, React.ReactNode> = {
  network: <IconNetwork size={20} />,
  erp: <IconErp size={20} />,
  cctv: <IconCctv size={20} />,
  chip: <IconChip size={20} />,
  headset: <IconHeadset size={20} />,
};

const chipCls: Record<string, string> = {
  sky: "border-sky-2/30 bg-sky-2/10 text-sky-2",
  marigold: "border-marigold/50 bg-marigold/15 text-marigold-2",
  leaf: "border-leaf/30 bg-leaf/10 text-leaf",
  brick: "border-brick/30 bg-brick/10 text-brick",
  ink: "border-ink bg-ink text-paper",
};

const avatarCls: Record<string, string> = {
  sky: "bg-sky-2",
  marigold: "bg-marigold",
  leaf: "bg-leaf",
  brick: "bg-brick",
  ink: "bg-ink",
};

export default function Development() {
  return (
    <section id="pengembangan" className="bg-ledger relative border-b-2 border-ink/10 bg-card/50 py-20 sm:py-28" aria-labelledby="dev-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead
          eyebrow="Roadmap produk"
          title={<span id="dev-title">Teknologi yang <span className="text-sky-2">Terus Dikembangkan</span></span>}
          copy="SKMNetwork bukan produk sekali jadi. Setiap lini teknologi dirawat dan dikembangkan mengikuti kebutuhan nyata pelanggan."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {devTracks.map((t, i) => (
            <Reveal key={t.title} delay={i * 90} className={i === 1 ? "lg:translate-y-5" : i === 3 ? "lg:-translate-y-2" : ""}>
              <article className={`postcard relative h-full rounded-xl border-2 border-ink/12 bg-card p-6 shadow-[0_14px_35px_-18px_rgba(11,31,51,0.35)] ${t.rotate}`}>
                <span className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rotate-[-4deg] rounded-sm bg-marigold/70 shadow-sm" aria-hidden />
                <div className="flex items-center justify-between">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-lg text-paper ${avatarCls[t.color]}`}>
                    {trackIcons[t.icon]}
                  </span>
                  <span className={`rounded-full border px-3 py-1 font-mono text-[9px] font-extrabold uppercase tracking-widest ${chipCls[t.color]}`}>
                    {t.status}
                  </span>
                </div>
                <h3 className="font-display mt-4 text-xl font-bold text-ink">{t.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink/60">{t.desc}</p>
                <ul className="mt-4 flex flex-wrap gap-2 border-t-2 border-dashed border-ink/10 pt-4">
                  {t.focus.map((f) => (
                    <li key={f} className="rounded-full bg-ink/5 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink/55">
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}

          {/* kartu ajakan */}
          <Reveal delay={460} className="lg:translate-y-8">
            <a href="#kontak" className="postcard flex h-full rotate-2 flex-col items-start justify-center rounded-xl border-2 border-dashed border-ink/25 bg-paper p-6">
              <p className="font-display text-2xl font-extrabold leading-tight text-ink">
                Ada kebutuhan yang belum <span className="bg-marigold px-1.5">tercover?</span>
              </p>
              <p className="mt-3 text-sm font-semibold text-ink/60">
                Ceritakan pada kami — banyak solusi SKMNetwork lahir langsung dari kebutuhan pelanggan.
              </p>
              <span className="btn-arrow mt-5 inline-flex items-center gap-2 font-mono text-sm font-extrabold uppercase tracking-widest text-brick">
                Hubungi SKMNetwork
                <IconArrowRight size={15} />
              </span>
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
