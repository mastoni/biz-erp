import { INTERNET_URL } from "../data";
import { IconWifi, IconHome, IconStore, IconOffice, IconArrowRight, IconCheck } from "../icons";
import { Reveal, Eyebrow } from "./Ui";
import ShowcasePlans from "./ShowcasePlans";

export default function Internet() {
  return (
    <section id="internet" className="relative overflow-hidden border-b-2 border-ink/10 py-20 sm:py-28" aria-labelledby="internet-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* kiri: narasi */}
          <div className="lg:col-span-6">
            <Reveal>
              <Eyebrow>Layanan · bagian dari ekosistem</Eyebrow>
            </Reveal>
            <Reveal delay={90}>
              <h2 id="internet-title" className="font-display mt-5 text-3xl font-extrabold leading-[1.06] tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
                Internet & <span className="text-sky-2">Konektivitas</span>
              </h2>
            </Reveal>
            <Reveal delay={170}>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink/60 sm:text-lg">
                Koneksi internet yang mendukung kebutuhan rumah, usaha, dan aktivitas digital. Internet adalah fondasi
                ekosistem SKMNetwork — yang kemudian diperkuat jaringan, keamanan, dan sistem di atasnya.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <ul className="mt-7 space-y-3">
                {[
                  "Koneksi untuk rumah dan aktivitas harian",
                  "Koneksi usaha yang menopang transaksi & kasir",
                  "Konfigurasi jaringan yang tertata sejak awal",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-3 text-[15px] font-semibold text-ink/75">
                    <IconCheck size={18} className="mt-0.5 shrink-0 text-leaf" />
                    {b}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={320}>
              <a
                href={INTERNET_URL}
                className="btn-arrow mt-8 inline-flex items-center gap-2.5 rounded-xl bg-sky-2 px-6 py-3.5 text-[15px] font-extrabold text-paper transition hover:-translate-y-0.5 hover:bg-[#0f5a74]"
              >
                Lihat Layanan Internet
                <IconArrowRight size={16} />
              </a>
            </Reveal>
          </div>

          {/* kanan: visual gelombang */}
          <div className="lg:col-span-6">
            <Reveal delay={150}>
              <div className="relative mx-auto flex aspect-square max-w-[440px] items-center justify-center">
                {/* ripple rings */}
                {[100, 76, 52].map((size, i) => (
                  <span
                    key={size}
                    className="wifi-ripple absolute rounded-full border-2 border-sky-2/30"
                    style={{ width: `${size}%`, height: `${size}%`, "--wr-delay": `${i * 0.9}s` } as React.CSSProperties}
                    aria-hidden
                  />
                ))}

                {/* router pusat */}
                <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-ink bg-ink text-marigold shadow-[0_25px_50px_-20px_rgba(11,31,51,0.55)]">
                  <IconWifi size={38} />
                  <span className="absolute -bottom-3 rounded-full border border-ink/10 bg-card px-3 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-ink/55">
                    skmnetwork
                  </span>
                </div>

                {/* endpoint chips */}
                <span className="floaty absolute left-0 top-[12%] flex items-center gap-2 rounded-xl border-2 border-ink/10 bg-card px-3.5 py-2 text-xs font-extrabold text-ink shadow-md" style={{ "--fl-delay": "0s" } as React.CSSProperties}>
                  <IconHome size={15} className="text-sky-2" /> Rumah
                </span>
                <span className="floaty absolute right-[-2%] top-[30%] flex items-center gap-2 rounded-xl border-2 border-ink/10 bg-card px-3.5 py-2 text-xs font-extrabold text-ink shadow-md" style={{ "--fl-delay": "1.1s" } as React.CSSProperties}>
                  <IconStore size={15} className="text-brick" /> Usaha
                </span>
                <span className="floaty absolute bottom-[10%] left-[16%] flex items-center gap-2 rounded-xl border-2 border-ink/10 bg-card px-3.5 py-2 text-xs font-extrabold text-ink shadow-md" style={{ "--fl-delay": "2.2s" } as React.CSSProperties}>
                  <IconOffice size={15} className="text-leaf" /> Kantor
                </span>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Dynamic ISP Plans Showcase if available */}
        <ShowcasePlans
          section="ISP_PLANS"
          eyebrowText="Paket Internet Broadband"
          title="Pilihan Kecepatan Internet SKMNetwork"
          description="Konektivitas stabil berkecepatan tinggi dengan alokasi bandwidth optimal untuk kenyamanan rumah dan kelancaran bisnis."
        />
      </div>
    </section>
  );
}
