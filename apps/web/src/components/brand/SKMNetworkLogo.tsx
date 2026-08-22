import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

export const LogoMark = ({ size = 40, className }: IconProps & { className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    aria-hidden="true"
    className={className}
  >
    <rect width="64" height="64" rx="14" fill="currentColor" />
    <rect x="2" y="2" width="60" height="60" rx="12" fill="none" stroke="rgba(243,242,234,0.14)" strokeWidth="1.5" />
    <path d="M20 44 32 21l12 23" stroke="#f3f2ea" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
    <path d="M42 20c3 1.4 5.2 3.6 6.4 6.4" stroke="#ffb224" strokeWidth="3" strokeLinecap="round" fill="none" />
    <circle cx="20" cy="44" r="5.2" fill="#ffb224" />
    <circle cx="32" cy="21" r="5.2" fill="#f3f2ea" />
    <circle cx="44" cy="44" r="5.2" fill="#ffb224" />
  </svg>
);

export const Wordmark = ({ dark = false, className }: { dark?: boolean; className?: string }) => (
  <span className={`leading-none ${className ?? ''}`}>
    <span className={`font-display block text-[21px] font-extrabold tracking-tight ${dark ? "text-paper" : "text-ink"}`}>
      SKM<span className="text-marigold-2">Net</span>
    </span>
    <span className={`font-mono block text-[8px] font-bold uppercase tracking-[0.42em] ${dark ? "text-paper/45" : "text-ink/40"}`}>
      tech · network
    </span>
  </span>
);

export const SKMNetworkLogo = ({ dark = false, size = 40, className }: { dark?: boolean; size?: number; className?: string }) => {
  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      <LogoMark size={size} />
      <Wordmark dark={dark} />
    </div>
  );
};
