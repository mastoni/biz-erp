import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const S = ({ size = 24, children, ...rest }: IconProps & { children: ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

/* ---------- Brand ---------- */
export const LogoMark = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="14" fill="var(--color-ink)" />
    <rect x="2" y="2" width="60" height="60" rx="12" fill="none" stroke="rgba(243,242,234,0.14)" strokeWidth="1.5" />
    <path d="M20 44 32 21l12 23" stroke="var(--color-paper)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
    <path d="M42 20c3 1.4 5.2 3.6 6.4 6.4" stroke="var(--color-marigold)" strokeWidth="3" strokeLinecap="round" fill="none" />
    <circle cx="20" cy="44" r="5.2" fill="var(--color-marigold)" />
    <circle cx="32" cy="21" r="5.2" fill="var(--color-paper)" />
    <circle cx="44" cy="44" r="5.2" fill="var(--color-marigold)" />
  </svg>
);

export const Wordmark = ({ dark = false }: { dark?: boolean }) => (
  <span className="leading-none">
    <span className={`font-display block text-[21px] font-extrabold tracking-tight ${dark ? "text-paper" : "text-ink"}`}>
      SKM<span className="text-marigold-2">Network</span>
    </span>
    <span className={`font-mono block text-[8px] font-bold uppercase tracking-[0.42em] ${dark ? "text-paper/45" : "text-ink/40"}`}>
      tech · network
    </span>
  </span>
);

/* ---------- Ikon layanan ---------- */
export const IconWifi = (p: IconProps) => (
  <S {...p}>
    <path d="M2.5 9.3a15 15 0 0 1 19 0" />
    <path d="M5.4 12.8a10.6 10.6 0 0 1 13.2 0" />
    <path d="M8.4 16.2a6.2 6.2 0 0 1 7.2 0" />
    <circle cx="12" cy="19.6" r="1.4" fill="currentColor" stroke="none" />
  </S>
);

export const IconNetwork = (p: IconProps) => (
  <S {...p}>
    <circle cx="5.5" cy="6" r="2.3" />
    <circle cx="18.5" cy="6" r="2.3" />
    <circle cx="12" cy="18" r="2.6" />
    <path d="M7.8 6h8.4M6.6 8.1l4.2 7.6M17.4 8.1l-4.2 7.6" />
  </S>
);

export const IconCctv = (p: IconProps) => (
  <S {...p}>
    <path d="M2.6 7.6 15.3 4.4a1.2 1.2 0 0 1 1.45.86l.9 3.5a1.2 1.2 0 0 1-.87 1.45L4.1 13.4a1.2 1.2 0 0 1-1.46-.87l-.9-3.48a1.2 1.2 0 0 1 .86-1.45Z" />
    <path d="M9.5 14.6v3.2h5.3M4.5 20.2h10.3" />
    <circle cx="14.6" cy="8.4" r="1.1" fill="currentColor" stroke="none" />
    <path d="M19.4 6.2l2-.5M20 9.4l2.4.6" />
  </S>
);

export const IconCode = (p: IconProps) => (
  <S {...p}>
    <path d="m8.5 6-5.5 6 5.5 6M15.5 6l5.5 6-5.5 6" />
    <path d="M13.4 4.5 10.6 19.5" opacity="0.55" />
  </S>
);

export const IconCloud = (p: IconProps) => (
  <S {...p}>
    <path d="M7 18.5a4.6 4.6 0 1 1 .8-9.1 5.6 5.6 0 0 1 10.8 1.7 3.8 3.8 0 0 1-.6 7.4Z" />
    <path d="M9.5 14.5l2 2 3.5-3.5" />
  </S>
);

export const IconBusiness = (p: IconProps) => (
  <S {...p}>
    <rect x="3" y="7.5" width="18" height="12.5" rx="2" />
    <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 12.5h18" />
    <path d="M10.5 12.5v1.6h3v-1.6" />
  </S>
);

export const IconErp = (p: IconProps) => (
  <S {...p}>
    <path d="M12 3 20 7v10l-8 4-8-4V7Z" />
    <path d="M12 12 20 7M12 12 4 7M12 12v9.4" opacity="0.7" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </S>
);

export const IconServer = (p: IconProps) => (
  <S {...p}>
    <rect x="3" y="4" width="18" height="7" rx="1.6" />
    <rect x="3" y="13" width="18" height="7" rx="1.6" />
    <circle cx="7" cy="7.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="7" cy="16.5" r="1" fill="currentColor" stroke="none" />
    <path d="M11.5 7.5H17M11.5 16.5H17" />
  </S>
);

export const IconShield = (p: IconProps) => (
  <S {...p}>
    <path d="M12 3 19 5.8v5.5c0 4.6-3 7.7-7 9.7-4-2-7-5.1-7-9.7V5.8Z" />
    <path d="m9 11.8 2.2 2.2 4.3-4.3" />
  </S>
);

export const IconGear = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3.4" />
    <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8" />
  </S>
);

export const IconHeadset = (p: IconProps) => (
  <S {...p}>
    <path d="M4 14.5a8 8 0 0 1 16 0" />
    <rect x="3" y="14" width="3.6" height="6" rx="1.6" />
    <rect x="17.4" y="14" width="3.6" height="6" rx="1.6" />
    <path d="M19.2 20v.8a2.4 2.4 0 0 1-2.4 2.4h-3.3" />
  </S>
);

export const IconChip = (p: IconProps) => (
  <S {...p}>
    <rect x="7" y="7" width="10" height="10" rx="1.6" />
    <rect x="10.4" y="10.4" width="3.2" height="3.2" />
    <path d="M9.5 7V4M14.5 7V4M9.5 20v-3M14.5 20v-3M7 9.5H4M7 14.5H4M20 9.5h-3M20 14.5h-3" />
  </S>
);

export const IconHome = (p: IconProps) => (
  <S {...p}>
    <path d="m4 11 8-7.2L20 11" />
    <path d="M6.2 9.8V20h11.6V9.8" />
    <path d="M10.2 20v-5.4h3.6V20" />
  </S>
);

export const IconStore = (p: IconProps) => (
  <S {...p}>
    <path d="M4.5 8.5 5.8 4h12.4l1.3 4.5" />
    <path d="M4 8.5h16M5 8.5V20h14V8.5" />
    <path d="M9.2 20v-6h5.6v6" />
  </S>
);

export const IconOffice = (p: IconProps) => (
  <S {...p}>
    <rect x="5" y="3.2" width="14" height="17.6" rx="1.2" />
    <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
    <path d="M11 20.8v-3h2v3M3 20.8h18" />
  </S>
);

export const IconGlobe = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M3.4 12h17.2" />
    <path d="M12 3.4c2.9 3.5 2.9 13.7 0 17.2M12 3.4c-2.9 3.5-2.9 13.7 0 17.2" />
  </S>
);

export const IconMonitor = (p: IconProps) => (
  <S {...p}>
    <rect x="3" y="4.5" width="18" height="12.4" rx="1.6" />
    <path d="M12 16.9V20M8 20h8" />
    <path d="m6 10.6 2.4 0 1.4-2.4 1.9 4 1.5-2.6H18" />
  </S>
);

export const IconLayers = (p: IconProps) => (
  <S {...p}>
    <path d="M12 3 21 8l-9 5-9-5Z" />
    <path d="m4.5 12.5 7.5 4.2 7.5-4.2" opacity="0.7" />
    <path d="m4.5 16.5 7.5 4.2 7.5-4.2" opacity="0.4" />
  </S>
);

export const IconTarget = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <circle cx="12" cy="12" r="4.6" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </S>
);

export const IconExpand = (p: IconProps) => (
  <S {...p}>
    <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    <path d="M4 4l5.5 5.5M20 4l-5.5 5.5M4 20l5.5-5.5M20 20l-5.5-5.5" opacity="0.5" />
  </S>
);

export const IconLink = (p: IconProps) => (
  <S {...p}>
    <path d="M10.2 13.8a4.2 4.2 0 0 0 6 .4l2.6-2.6a4.2 4.2 0 1 0-6-6L11.6 6.8" />
    <path d="M13.8 10.2a4.2 4.2 0 0 0-6-.4l-2.6 2.6a4.2 4.2 0 1 0 6 6l1.2-1.2" />
  </S>
);

export const IconCheck = (p: IconProps) => (
  <S {...p} strokeWidth={2.6}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </S>
);

export const IconArrowUp = (p: IconProps) => (
  <S {...p} strokeWidth={2.1}>
    <path d="M7 17 17 7M9.5 7H17v7.5" />
  </S>
);

export const IconArrowRight = (p: IconProps) => (
  <S {...p} strokeWidth={2.2}>
    <path d="M4 12h15M13.5 5.5 20 12l-6.5 6.5" />
  </S>
);

export const IconArrowDown = (p: IconProps) => (
  <S {...p} strokeWidth={2.2}>
    <path d="M12 4v15M5.5 13.5 12 20l6.5-6.5" />
  </S>
);

export const IconCamera = (p: IconProps) => (
  <S {...p}>
    <path d="M4 7.5h3l1.6-2.3h6.8L17 7.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.4" />
  </S>
);

/* gelembung chat + kilat — otomatisasi WhatsApp */
export const IconWaBot = (p: IconProps) => (
  <S {...p}>
    <path d="M12 3.5c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-.9 0-1.8-.1-2.6-.3L5 19.5l1-3.2c-1.5-1.3-2.5-3-2.5-4.8 0-3.9 3.8-7 8.5-7Z" />
    <path d="M13 7.5 10.8 11h2.4L11 14.5" strokeWidth={1.9} />
  </S>
);

/* megafon — auto-posting & broadcast media sosial */
export const IconMegaphone = (p: IconProps) => (
  <S {...p}>
    <path d="M3.5 10v4a1 1 0 0 0 1 1H7l8.5 4.2c.6.3 1.5-.1 1.5-.9V5.7c0-.8-.9-1.2-1.5-.9L7 9H4.5a1 1 0 0 0-1 1Z" />
    <path d="M7 15.2V18a1.5 1.5 0 0 0 3 .3M20 10.2a2.6 2.6 0 0 1 0 3.6" strokeWidth={1.9} />
  </S>
);

/* chat bubble — visitor live chat */
export const IconChat = (p: IconProps) => (
  <S {...p}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </S>
);

/* close X icon */
export const IconX = (p: IconProps) => (
  <S {...p} strokeWidth={2.2}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </S>
);

/* send arrow */
export const IconSend = (p: IconProps) => (
  <S {...p} strokeWidth={2.2}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" opacity="0.2" />
  </S>
);
