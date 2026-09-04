import type { ReactNode } from "react";
import { useInView } from "../hooks";

/* ---------- Reveal on scroll ---------- */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal ${inView ? "reveal-in" : ""} ${className}`}
      style={{ "--rv-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/* ---------- Eyebrow label ---------- */
export function Eyebrow({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" | "marigold" }) {
  const color =
    tone === "dark" ? "text-marigold border-marigold/40 bg-marigold/10" : "text-ink-2 border-ink/15 bg-ink/5";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] ${color}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

/* ---------- Section heading block ---------- */
export function SectionHead({
  eyebrow,
  title,
  copy,
  tone = "light",
}: {
  eyebrow: string;
  title: ReactNode;
  copy?: string;
  tone?: "light" | "dark";
}) {
  return (
    <div className="max-w-2xl">
      <Reveal>
        <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
      </Reveal>
      <Reveal delay={90}>
        <h2
          className={`font-display mt-5 text-3xl font-extrabold leading-[1.06] tracking-tight sm:text-4xl lg:text-[2.75rem] ${
            tone === "dark" ? "text-paper" : "text-ink"
          }`}
        >
          {title}
        </h2>
      </Reveal>
      {copy && (
        <Reveal delay={170}>
          <p className={`mt-4 text-base leading-relaxed sm:text-lg ${tone === "dark" ? "text-paper/65" : "text-ink/60"}`}>
            {copy}
          </p>
        </Reveal>
      )}
    </div>
  );
}
