import * as React from "react"
import { cn } from "@/lib/utils"

export type StatusType = "active" | "synced" | "pending" | "syncing" | "failed" | "inactive" | "draft";

export interface StatusPillProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusType;
  label?: string;
}

const statusConfig: Record<StatusType, { bg: string; text: string; dot: string; defaultLabel: string }> = {
  active: {
    bg: "bg-pine-soft",
    text: "text-pine",
    dot: "bg-pine",
    defaultLabel: "Aktif",
  },
  synced: {
    bg: "bg-pine-soft",
    text: "text-pine",
    dot: "bg-pine",
    defaultLabel: "Tersinkron",
  },
  pending: {
    bg: "bg-honey-soft",
    text: "text-[#8a5f10]",
    dot: "bg-honey",
    defaultLabel: "Menunggu",
  },
  syncing: {
    bg: "bg-ocean-soft",
    text: "text-ocean",
    dot: "bg-ocean animate-pulse",
    defaultLabel: "Sinkronisasi",
  },
  failed: {
    bg: "bg-clay-soft",
    text: "text-clay",
    dot: "bg-clay",
    defaultLabel: "Gagal",
  },
  inactive: {
    bg: "bg-surface-soft",
    text: "text-fog",
    dot: "bg-fog",
    defaultLabel: "Nonaktif",
  },
  draft: {
    bg: "bg-surface-soft",
    text: "text-fog",
    dot: "bg-fog",
    defaultLabel: "Draf",
  },
};

export function StatusPill({ status, label, className, ...props }: StatusPillProps) {
  const cfg = statusConfig[status] || statusConfig.inactive;
  const displayLabel = label ?? cfg.defaultLabel;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide border border-line/60 select-none",
        cfg.bg,
        cfg.text,
        className
      )}
      {...props}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
      <span>{displayLabel}</span>
    </div>
  );
}
