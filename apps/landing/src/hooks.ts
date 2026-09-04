import { useEffect, useRef, useState } from "react";

/* Apakah user memilih reduced motion */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* Satu kali masuk viewport */
export function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* Efek scramble-decode untuk teks pendek (eyebrow) */
const GLYPHS = "AKUSMNRT0147#%/";
export function useScramble(text: string, start: boolean, speed = 26): string {
  const reduced = usePrefersReducedMotion();
  const [out, setOut] = useState(reduced ? text : "");
  useEffect(() => {
    if (!start) return;
    if (reduced) {
      setOut(text);
      return;
    }
    let frame = 0;
    const id = window.setInterval(() => {
      frame++;
      const settled = Math.floor(frame / 2);
      let s = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === " " || ch === "·" || ch === "•") s += ch;
        else if (i < settled) s += ch;
        else s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setOut(s);
      if (settled >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [start, text, speed, reduced]);
  return out;
}

/* Jam real-time (untuk panel monitoring) */
export function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString("id-ID", { hour12: false });
}
