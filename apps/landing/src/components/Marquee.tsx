import { servicesMarquee } from "../data";

const Diamond = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden className="text-ink">
    <path d="M5 0l5 5-5 5L0 5z" />
  </svg>
);

export default function Marquee() {
  const list = [...servicesMarquee, ...servicesMarquee];
  return (
    <section aria-label="Layanan SKMNetwork" className="marquee overflow-hidden border-b-2 border-ink/10 bg-marigold py-4">
      <div className="marquee-track flex w-max items-center gap-8 pr-8" style={{ "--mq-dur": "34s" } as React.CSSProperties}>
        {list.map((s, i) => (
          <span key={i} className="flex items-center gap-8 whitespace-nowrap">
            <span className="font-display text-lg font-bold tracking-wide text-ink">{s}</span>
            <Diamond />
          </span>
        ))}
      </div>
    </section>
  );
}
