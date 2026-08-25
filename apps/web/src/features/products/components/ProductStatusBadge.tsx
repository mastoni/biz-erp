import { cn } from '@/lib/utils';

interface ProductStatusBadgeProps {
  isActive: boolean;
  className?: string;
}

export function ProductStatusBadge({ isActive, className }: ProductStatusBadgeProps) {
  const status = isActive ? 'active' : 'inactive';

  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    active: {
      bg: 'bg-pine-soft',
      text: 'text-pine',
      dot: 'bg-pine',
      label: 'Aktif',
    },
    inactive: {
      bg: 'bg-surface-soft',
      text: 'text-fog',
      dot: 'bg-fog',
      label: 'Nonaktif',
    },
  };

  const cfg = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide border border-line/60 select-none',
        cfg.bg,
        cfg.text,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
      <span>{cfg.label}</span>
    </span>
  );
}
