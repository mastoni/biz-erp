import { CONTACT_URL } from "../data";
import { IconArrowRight, IconErp } from "../icons";
import { Reveal, Eyebrow } from "./Ui";

export default function Cta() {
  return (
    <section
      id="kontak"
      className="bg-ledger-dark relative overflow-hidden bg-ink py-20 text-paper sm:py-28"
      aria-labelledby="kontak-title"
    >
      <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-marigold/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-28 -top-20 h-80 w-80 rounded-full bg-sky-2/15 blur-3xl" aria-hidden />

      {/* motif jaringan dekoratif */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none" aria-hidden>
        <path d="M-10 160 90 90l100 40 110-70 120 30" stroke="var(--color-paper)" strokeWidth="1" strokeDasharray="3 6" className="flow-line-slow" />
        <path d="M-10 60 120 120 240 50l170 60" stroke="var(--color-marigold)" strokeWidth="1" strokeDasharray="3 6" className="flow-line-slow" style={{ animationDelay: "1.2s" }} />
        {[
          [90, 90], [190, 130], [300, 60], [120, 120], [240, 50],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.5" fill="var(--color-marigold)" />
        ))}
      </svg>

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
        <Reveal>
          <Eyebrow tone="dark">Mari mulai dari kebutuhan Anda</Eyebrow>
        </Reveal>
        <Reveal delay={90}>
          <h2 id="kontak-title" className="font-display mt-6 text-4xl font-extrabold leading-[1.03] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Siap Membangun Solusi Teknologi yang <span className="text-marigold">Lebih Baik?</span>
          </h2>
        </Reveal>
        <Reveal delay={170}>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-paper/65 sm:text-lg">
            Ceritakan kebutuhan Anda. Kami bantu menentukan solusi yang paling sesuai —
            dari konektivitas, jaringan, keamanan, hingga sistem bisnis.
          </p>
        </Reveal>
        <Reveal delay={250}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <a
              href={CONTACT_URL}
              className="btn-arrow inline-flex items-center gap-2.5 rounded-xl bg-marigold px-7 py-4 text-base font-extrabold text-ink transition hover:-translate-y-0.5 hover:bg-marigold-2"
            >
              Hubungi SKMNetwork
              <IconArrowRight size={17} />
            </a>
            <a
              href="#erp"
              className="inline-flex items-center gap-2.5 rounded-xl border-2 border-paper/25 px-7 py-[14px] text-base font-bold text-paper transition hover:border-marigold hover:text-marigold"
            >
              <IconErp size={18} />
              Pelajari SKMNetwork ERP
            </a>
          </div>
        </Reveal>
        <Reveal delay={330}>
          <p className="mt-8 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-paper/35">
            www.skmnetwork.com · teknologi · jaringan · solusi digital
          </p>
        </Reveal>
      </div>
    </section>
  );
}
