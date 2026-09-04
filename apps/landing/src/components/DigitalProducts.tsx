import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "../hooks";
import { IconWaBot, IconMegaphone, IconCheck, IconArrowRight, IconErp } from "../icons";
import { Reveal, SectionHead } from "./Ui";

/* ================= WA Gateway — mock chat auto-reply ================= */
const CHAT_STEPS = 4; // 0: pesan masuk, 1: mengetik, 2: balasan bot, 3: notifikasi, (4 = tahan, lalu ulang)

function WaMock() {
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState(reduced ? 3 : 0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setStep((v) => (v + 1) % (CHAT_STEPS + 1)), 1500);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-ink/15 bg-ink shadow-[0_30px_60px_-28px_rgba(11,31,51,0.6)]">
      <div className="flex items-center justify-between border-b border-paper/10 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-leaf/20 text-leaf">
            <IconWaBot size={17} />
          </span>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-paper/60">
            wa gateway · auto-reply
          </p>
        </div>
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-leaf text-leaf ping-dot" />
      </div>

      <div className="flex h-64 flex-col gap-2.5 overflow-hidden px-5 py-5">
        {/* pesan pelanggan */}
        {step >= 0 && (
          <div className="tick-in max-w-[80%] self-start rounded-xl rounded-tl-sm border border-paper/12 bg-paper/[0.07] px-4 py-2.5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-paper/40">pelanggan · 17.58</p>
            <p className="mt-1 text-sm font-semibold text-paper/90">Kak, stok Kopi Gayo 1kg masih ada?</p>
          </div>
        )}

        {/* indikator mengetik */}
        {step === 1 && (
          <div className="tick-in flex items-center gap-1.5 self-end rounded-xl rounded-tr-sm bg-marigold/90 px-4 py-3">
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="typing-dot h-1.5 w-1.5 rounded-full bg-ink"
                style={{ "--td-delay": `${d * 0.18}s` } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        {/* balasan otomatis */}
        {step >= 2 && (
          <div className="tick-in max-w-[85%] self-end rounded-xl rounded-tr-sm bg-marigold px-4 py-2.5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/55">bot · 17.58</p>
            <p className="mt-1 text-sm font-bold text-ink">Halo! Stok Kopi Gayo 1kg tersedia ✓ Mau sekalian pesan?</p>
          </div>
        )}

        {/* notifikasi sistem */}
        {step >= 3 && (
          <>
            <div className="tick-in flex items-center gap-2.5 self-center rounded-full border border-paper/15 bg-paper/[0.05] px-4 py-1.5">
              <IconErp size={13} className="text-marigold" />
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-paper/60">
                pesanan #INV-2041 dari ERP · notifikasi terkirim
              </p>
            </div>
            <div className="tick-in flex items-center gap-2.5 self-center rounded-full border border-marigold/30 bg-marigold/10 px-4 py-1.5">
              <IconMegaphone size={13} className="text-marigold" />
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-marigold">
                broadcast promo · terjadwal 18.00 WIB
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================= AutoPost — antrean posting ================= */
const QUEUE = [
  { time: "09.00", plat: "IG", title: "Promo weekend — kopi gayo", status: "Terposting", tone: "text-leaf border-leaf/40 bg-leaf/10" },
  { time: "13.00", plat: "FB", title: "Katalog produk baru", status: "Terjadwal", tone: "text-marigold border-marigold/40 bg-marigold/10" },
  { time: "18.00", plat: "TT", title: "Behind the scene roasting", status: "Antre", tone: "text-paper/60 border-paper/20 bg-paper/5" },
  { time: "20.00", plat: "WA", title: "Status: testimoni pelanggan", status: "Draf", tone: "text-paper/40 border-paper/15 bg-transparent" },
];
const DAYS = ["SEN", "SEL", "RAB", "KAM", "JUM", "SAB", "MIN"];

function AutoPostMock() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setActive((v) => (v + 1) % QUEUE.length), 2000);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-ink/15 bg-ink shadow-[0_30px_60px_-28px_rgba(11,31,51,0.6)]">
      <div className="flex items-center justify-between border-b border-paper/10 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brick/20 text-brick">
            <IconMegaphone size={17} />
          </span>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-paper/60">
            autopost · antrean posting
          </p>
        </div>
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-marigold text-marigold ping-dot" />
      </div>

      <div className="px-5 py-5">
        {/* strip hari */}
        <div className="flex gap-1.5">
          {DAYS.map((d, i) => (
            <span
              key={d}
              className={`flex-1 rounded-md border py-1.5 text-center font-mono text-[10px] font-bold tracking-widest transition-colors duration-500 ${
                i === active % DAYS.length
                  ? "border-marigold bg-marigold text-ink"
                  : "border-paper/12 text-paper/40"
              }`}
            >
              {d}
            </span>
          ))}
        </div>

        {/* baris antrean */}
        <div className="mt-4 space-y-2">
          {QUEUE.map((q, i) => (
            <div
              key={q.time}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors duration-500 ${
                i === active ? "slot-pulse border-marigold/50 bg-paper/[0.07]" : "border-paper/10 bg-paper/[0.03]"
              }`}
            >
              <span className="font-mono text-[11px] font-bold tabular-nums text-paper/55">{q.time}</span>
              <span className="rounded-md bg-paper/10 px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-wider text-paper/80">
                {q.plat}
              </span>
              <span className="flex-1 truncate text-[13px] font-semibold text-paper/85">{q.title}</span>
              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-widest ${q.tone}`}>
                {q.status}
              </span>
            </div>
          ))}
        </div>

        {/* progres antrean */}
        <div className="mt-4 flex items-center gap-3">
          <p className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-paper/45">antrean hari ini</p>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper/10">
            <div className="h-full w-1/2 rounded-full bg-marigold" />
          </div>
          <p className="shrink-0 font-mono text-[11px] font-bold text-marigold">2/4</p>
        </div>
      </div>
    </div>
  );
}

/* ================= Seksi ================= */
export default function DigitalProducts() {
  return (
    <section
      id="produk-digital"
      className="bg-ledger relative border-b-2 border-ink/10 py-20 sm:py-28"
      aria-labelledby="produk-digital-title"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead
          eyebrow="Produk digital · Ekosistem SKMNetwork"
          title={
            <span id="produk-digital-title">
              Dua Produk Digital yang <span className="text-brick">Bekerja untuk Anda 24/7</span>
            </span>
          }
          copy="Selain konektivitas dan SKMNetwork ERP, ekosistem SKMNetwork diperkuat produk otomatisasi: WhatsApp Gateway dan AutoPost. Keduanya dirancang agar data bisnis mengalir dari operasional ke pelanggan — tanpa dikerjakan manual satu per satu."
        />

        <div className="mt-14 space-y-16 sm:space-y-20">
          {/* ——— WA Gateway ——— */}
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <Reveal>
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ink bg-paper text-ink shadow-[4px_4px_0_0_var(--color-leaf)]">
                    <IconWaBot size={26} />
                  </span>
                  <div>
                    <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.22em] text-leaf">produk digital 01</p>
                    <h3 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">SKMNetwork WA Gateway</h3>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={100}>
                <p className="mt-5 text-[15px] leading-relaxed text-ink/65">
                  Otomatisasi WhatsApp untuk bisnis: pelanggan dijawab seketika, broadcast promo berjalan terjadwal,
                  dan notifikasi pesanan terkirim otomatis dari SKMNetwork ERP.
                </p>
              </Reveal>
              <Reveal delay={180}>
                <ul className="mt-6 space-y-3">
                  {[
                    "Auto-reply & sambutan pelanggan otomatis",
                    "Broadcast promo terjadwal ke banyak kontak",
                    "Notifikasi pesanan & invoice dari SKMNetwork ERP",
                    "Webhook & API untuk integrasi sistem",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-3 text-[15px] font-semibold text-ink/75">
                      <IconCheck size={18} className="mt-0.5 shrink-0 text-leaf" />
                      {f}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={260}>
                <a
                  href="#kontak"
                  className="btn-arrow mt-8 inline-flex items-center gap-2 font-mono text-sm font-extrabold uppercase tracking-widest text-ink-2 transition hover:text-ink"
                >
                  Tanyakan produk ini <IconArrowRight size={15} />
                </a>
              </Reveal>
            </div>
            <Reveal delay={150} className="lg:col-span-7">
              <WaMock />
            </Reveal>
          </div>

          {/* ——— AutoPost ——— */}
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
            <Reveal delay={150} className="lg:order-2 lg:col-span-7">
              <AutoPostMock />
            </Reveal>
            <div className="lg:order-1 lg:col-span-5">
              <Reveal>
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ink bg-paper text-ink shadow-[4px_4px_0_0_var(--color-brick)]">
                    <IconMegaphone size={26} />
                  </span>
                  <div>
                    <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.22em] text-brick">produk digital 02</p>
                    <h3 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">SKMNetwork AutoPost</h3>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={100}>
                <p className="mt-5 text-[15px] leading-relaxed text-ink/65">
                  Auto-posting media sosial: susun konten sekali, jadwalkan ke banyak platform, dan biarkan antrean
                  posting bekerja sendiri — termasuk promo yang diambil dari katalog SKMNetwork ERP.
                </p>
              </Reveal>
              <Reveal delay={180}>
                <ul className="mt-6 space-y-3">
                  {[
                    "Jadwal posting lintas platform: IG, FB, TikTok, Status WA",
                    "Kalender konten & antrean posting mingguan",
                    "Satu konten, banyak platform — caption per platform",
                    "Promo katalog produk langsung dari SKMNetwork ERP",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-3 text-[15px] font-semibold text-ink/75">
                      <IconCheck size={18} className="mt-0.5 shrink-0 text-brick" />
                      {f}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={260}>
                <a
                  href="#kontak"
                  className="btn-arrow mt-8 inline-flex items-center gap-2 font-mono text-sm font-extrabold uppercase tracking-widest text-ink-2 transition hover:text-ink"
                >
                  Tanyakan produk ini <IconArrowRight size={15} />
                </a>
              </Reveal>
            </div>
          </div>
        </div>

        {/* ——— alur ekosistem ——— */}
        <Reveal delay={120}>
          <div className="mt-16 rounded-2xl border-2 border-ink/10 bg-card p-6 sm:p-8">
            <p className="text-center font-mono text-[11px] font-extrabold uppercase tracking-[0.22em] text-ink/45">
              Mengalir dalam satu ekosistem
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-4 md:flex-row md:gap-6">
              {[
                { icon: <IconErp size={20} />, label: "SKMNetwork ERP", sub: "data produk & pesanan", tone: "border-marigold/50 bg-marigold/10 text-marigold-2" },
                { icon: <IconWaBot size={20} />, label: "WA Gateway", sub: "konfirmasi & notifikasi", tone: "border-leaf/40 bg-leaf/10 text-leaf" },
                { icon: <IconMegaphone size={20} />, label: "AutoPost", sub: "promo & katalog", tone: "border-brick/40 bg-brick/10 text-brick" },
              ].map((n, i) => (
                <div key={n.label} className="flex items-center gap-4 md:gap-6">
                  <div className={`flex flex-col items-center rounded-xl border-2 px-6 py-4 text-center ${n.tone}`}>
                    {n.icon}
                    <p className="font-display mt-2 text-base font-bold text-ink">{n.label}</p>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/45">{n.sub}</p>
                  </div>
                  {i < 2 && (
                    <IconArrowRight size={20} className="hidden shrink-0 rotate-0 text-ink/30 md:block" />
                  )}
                </div>
              ))}
            </div>
            <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-ink/55">
              Pesanan yang masuk di ERP otomatis dikonfirmasi lewat WA Gateway, lalu produk yang sama dipromosikan
              ke media sosial oleh AutoPost — operasional dan pemasaran berjalan dalam satu alur.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
