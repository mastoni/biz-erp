import { customerTypes } from "../data";
import { IconHome, IconStore, IconBusiness, IconOffice, IconGlobe, IconServer, IconArrowUp } from "../icons";
import { Reveal, SectionHead } from "./Ui";

const typeIcons: Record<string, React.ReactNode> = {
  home: <IconHome size={24} />,
  store: <IconStore size={24} />,
  business: <IconBusiness size={24} />,
  office: <IconOffice size={24} />,
  globe: <IconGlobe size={24} />,
  server: <IconServer size={24} />,
};

export default function Customers() {
  return (
    <section id="layanan" className="bg-ledger relative border-b-2 border-ink/10 bg-card/50 py-20 sm:py-28" aria-labelledby="layanan-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead
          eyebrow="Untuk siapa"
          title={<span id="layanan-title">Solusi untuk <span className="text-brick">Berbagai Kebutuhan.</span></span>}
          copy="Dari rumah hingga penyedia layanan jaringan — setiap kebutuhan mendapat kombinasi solusi yang relevan, bukan paket yang dipukul rata."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {customerTypes.map((c, i) => (
            <Reveal key={c.title} delay={i * 70}>
              <article className="card-lift group flex h-full flex-col rounded-xl border-2 border-ink/10 bg-card p-6 hover:border-ink/30 sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-marigold transition group-hover:bg-marigold group-hover:text-ink">
                    {typeIcons[c.icon]}
                  </span>
                  <IconArrowUp size={17} className="text-ink/25 transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-ink" />
                </div>
                <h3 className="font-display mt-5 text-xl font-bold text-ink">{c.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/60">{c.desc}</p>
                <ul className="mt-5 flex flex-wrap gap-2 border-t-2 border-dashed border-ink/10 pt-4">
                  {c.items.map((it) => (
                    <li key={it} className="rounded-full border border-ink/12 bg-paper px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink/55 transition group-hover:border-marigold/60 group-hover:text-ink">
                      {it}
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
