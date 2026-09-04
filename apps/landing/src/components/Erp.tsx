import { erpModules, erpAccess, ERP_URL, ERP_IMAGE } from '../data'
import { useInView } from '../hooks'
import { IconErp, IconLayers, IconStore, IconTarget, IconExpand, IconMonitor, IconArrowRight } from '../icons'
import { Reveal, Eyebrow } from './Ui'
import ShowcasePlans from './ShowcasePlans'

const modIcons: Record<string, React.ReactNode> = {
  erp: <IconErp size={19} />,
  layers: <IconLayers size={19} />,
  store: <IconStore size={19} />,
  target: <IconTarget size={19} />,
  expand: <IconExpand size={19} />,
  monitor: <IconMonitor size={19} />
}

export default function Erp() {
  const { ref, inView } = useInView<HTMLDivElement>(0.2)

  return (
    <section id="erp" className="bg-ledger relative border-b-2 border-ink/10 py-20 sm:py-28" aria-labelledby="erp-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
          {/* kiri: narasi produk */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-32">
              <Reveal>
                <Eyebrow>Produk unggulan · SKMNetwork ERP</Eyebrow>
              </Reveal>
              <Reveal delay={90}>
                <h2 id="erp-title" className="font-display mt-5 text-3xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
                  SKMNetwork ERP — <span className="text-marigold-2">Menyatukan</span> Operasional Bisnis.
                </h2>
              </Reveal>
              <Reveal delay={170}>
                <p className="mt-5 text-base leading-relaxed text-ink/60 sm:text-lg">Kelola penjualan, produk, inventory, dan operasional bisnis dalam satu sistem yang terintegrasi — dibuat untuk membantu UMKM.</p>
              </Reveal>

              <Reveal delay={250}>
                <div className="relative mt-8 max-w-sm">
                  <img
                    src={ERP_IMAGE}
                    alt="Pengelola usaha menggunakan sistem digital SKMNetwork melalui tablet"
                    width={1200}
                    height={1000}
                    loading="lazy"
                    className="w-full rounded-2xl border-2 border-ink/12 shadow-[0_25px_50px_-25px_rgba(11,31,51,0.5)]"
                  />
                  <span className="floaty absolute -right-3 -top-4 rounded-xl border-2 border-ink/10 bg-marigold px-4 py-2 font-display text-sm font-extrabold text-ink shadow-lg">satu sistem, banyak unit usaha</span>
                </div>
              </Reveal>

              <Reveal delay={330}>
                <div className="mt-8 flex flex-wrap gap-4">
                  <a
                    href={ERP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-arrow inline-flex items-center gap-2.5 rounded-xl bg-ink px-6 py-3.5 text-[15px] font-extrabold text-paper transition hover:-translate-y-0.5 hover:bg-ink-2"
                  >
                    Pelajari SKMNetwork ERP
                    <IconArrowRight size={16} />
                  </a>
                  <a href="#kontak" className="inline-flex items-center gap-2.5 rounded-xl border-2 border-ink/20 px-6 py-[12px] text-[15px] font-bold text-ink transition hover:border-ink/50 hover:bg-card">
                    Saya Pelanggan SKMNetwork
                  </a>
                  <a
                    href={ERP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 rounded-xl border-2 border-marigold/40 px-6 py-[12px] text-[15px] font-bold text-marigold-2 transition hover:border-marigold hover:bg-marigold/10"
                  >
                    Berlangganan ERP
                  </a>
                </div>
                <p className="mt-3.5 font-mono text-[11px] font-semibold text-ink/40">Akses melalui situs resmi skmnetwork.com</p>
              </Reveal>
            </div>
          </div>

          {/* kanan: jendela produk + modul */}
          <div className="lg:col-span-7">
            <Reveal>
              <div className="overflow-hidden rounded-2xl border-2 border-ink/15 bg-ink shadow-[0_35px_70px_-30px_rgba(11,31,51,0.6)]">
                {/* bar jendela */}
                <div className="flex items-center justify-between border-b border-paper/10 px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-brick/80" />
                    <span className="h-3 w-3 rounded-full bg-marigold/80" />
                    <span className="h-3 w-3 rounded-full bg-leaf/80" />
                  </div>
                  <p className="font-mono text-[11px] font-bold tracking-widest text-paper/50">skmnetwork-erp · modul inti</p>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-leaf text-leaf ping-dot" />
                </div>

                {/* baris modul */}
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  {erpModules.map((m, i) => (
                    <Reveal key={m.title} delay={i * 80}>
                      <div className="group flex items-start gap-3.5 rounded-xl border border-paper/10 bg-paper/[0.04] p-4 transition hover:border-marigold/50 hover:bg-paper/[0.07]">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-marigold/15 text-marigold transition group-hover:bg-marigold group-hover:text-ink">{modIcons[m.icon]}</span>
                        <span>
                          <span className="font-display block text-[15px] font-bold text-paper">{m.title}</span>
                          <span className="mt-1 block text-[13px] leading-snug text-paper/55">{m.desc}</span>
                        </span>
                      </div>
                    </Reveal>
                  ))}
                </div>

                {/* strip laporan */}
                <div ref={ref} className="border-t border-paper/10 px-5 py-4">
                  <div className="flex items-end justify-between gap-6">
                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-paper/40">Laporan & monitoring</p>
                      <p className="font-display mt-1 text-lg font-bold text-paper">
                        Aktivitas operasional, <span className="text-marigold">terangkum rapi.</span>
                      </p>
                    </div>
                    <div className="hidden items-end gap-1.5 sm:flex" aria-hidden>
                      {[34, 52, 40, 66, 48, 78, 60, 90].map((h, i) => (
                        <span key={i} className={`bar-grow w-4 rounded-t ${inView ? 'bar-in' : ''} ${i >= 6 ? 'bg-marigold' : 'bg-paper/25'}`} style={{ height: `${h * 0.55}px`, '--bar-delay': `${i * 90}ms` } as React.CSSProperties} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
        {/* Dynamic ERP Plans & Bundles Showcase Container */}
        <div id="paket-promo" className="scroll-mt-24">
          <ShowcasePlans
            section="ERP_PLANS"
            eyebrowText="Paket Layanan · SKMNetwork ERP"
            title="Pilihan Paket ERP untuk Kebutuhan Bisnis Anda"
            description="Pilih paket langganan software ERP yang sesuai dengan skala operasional dan pertumbuhan unit usaha Anda."
            fallbackNode={
              <div className="mt-16 border-t-2 border-ink/10 pt-14">
                <Reveal>
                  <Eyebrow>Dua cara mengakses</Eyebrow>
                </Reveal>
                <Reveal delay={90}>
                  <h2 className="font-display mt-4 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                    SKMNetwork ERP untuk Pelanggan Internet maupun UMKM Mandiri
                  </h2>
                </Reveal>
                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  {erpAccess.map((m, i) => (
                    <Reveal key={m.tag} delay={i * 100}>
                      <div className="h-full rounded-2xl border-2 border-ink/10 bg-card p-6 sm:p-7">
                        <span className="inline-flex rounded-full border border-marigold/30 bg-marigold/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-marigold-2">
                          {m.tag}
                        </span>
                        <h3 className="font-display mt-4 text-xl font-bold text-ink">{m.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-ink/60">{m.desc}</p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            }
          />

          {/* Dynamic Bundles Showcase */}
          <ShowcasePlans
            section="BUNDLES"
            eyebrowText="Solusi Bundel · Terintegrasi"
            title="Paket Solusi Lengkap (ERP + Internet + Hardware)"
            description="Dapatkan efisiensi maksimal dengan integrasi menyeluruh sistem kasir, konektivitas, dan pengawasan bisnis."
          />
        </div>
      </div>
    </section>
  )
}
