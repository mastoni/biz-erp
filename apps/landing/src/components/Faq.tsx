import { useState } from "react";
import { faqs, CONTACT_URL } from "../data";
import { IconGlobe, IconArrowRight } from "../icons";
import { Reveal, SectionHead } from "./Ui";

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="border-b-2 border-ink/10 bg-card/60 py-20 sm:py-28" aria-labelledby="faq-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHead
              eyebrow="Tanya jawab"
              title={<span id="faq-title">Hal yang Sering <span className="text-sky-2">Ditanyakan</span></span>}
              copy="Jawaban singkat untuk pertanyaan yang paling sering masuk seputar layanan dan produk SKMNetwork."
            />
            <Reveal delay={220}>
              <div className="mt-8 rounded-2xl border-2 border-ink/10 bg-paper p-6">
                <p className="font-display text-lg font-bold text-ink">Butuh jawaban spesifik?</p>
                <p className="mt-1.5 text-sm text-ink/60">
                  Ceritakan kebutuhan Anda lewat halaman kontak resmi — tim kami bantu arahkan ke solusi yang tepat.
                </p>
                <div className="mt-5 flex flex-col gap-3">
                  <a
                    href={CONTACT_URL}
                    className="btn-arrow flex items-center justify-between rounded-xl bg-ink px-5 py-3.5 text-sm font-extrabold text-paper transition hover:-translate-y-0.5 hover:bg-ink-2"
                  >
                    <span className="flex items-center gap-2.5">
                      <IconGlobe size={17} className="text-marigold" /> Menuju Bagian Kontak
                    </span>
                    <IconArrowRight size={15} />
                  </a>
                  <p className="px-1 font-mono text-[11px] font-semibold text-ink/45">www.skmnetwork.com</p>
                </div>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-7">
            <div className="divide-y-2 divide-ink/8 rounded-2xl border-2 border-ink/10 bg-card">
              {faqs.map((f, i) => {
                const isOpen = open === i;
                return (
                  <Reveal key={f.q} delay={i * 60}>
                    <div className="px-6 sm:px-7">
                      <h3>
                        <button
                          onClick={() => setOpen(isOpen ? -1 : i)}
                          aria-expanded={isOpen}
                          aria-controls={`faq-panel-${i}`}
                          className="flex w-full items-center justify-between gap-4 py-5 text-left"
                        >
                          <span className={`font-display text-base font-bold transition-colors sm:text-lg ${isOpen ? "text-brick" : "text-ink"}`}>
                            {f.q}
                          </span>
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                              isOpen ? "rotate-45 border-brick bg-brick text-paper" : "border-ink/15 text-ink/50"
                            }`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                          </span>
                        </button>
                      </h3>
                      <div id={`faq-panel-${i}`} className={`acc-body ${isOpen ? "acc-open" : ""}`}>
                        <div>
                          <p className="max-w-2xl pb-6 text-sm leading-relaxed text-ink/65 sm:text-[15px]">{f.a}</p>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
