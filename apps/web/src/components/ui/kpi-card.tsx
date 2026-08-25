import * as React from "react"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"

export interface KPICardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
  tone?: "pine" | "honey" | "clay" | "ocean" | "neutral";
}

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  icon,
  tone = "neutral",
  className,
  ...props
}: KPICardProps) {
  const toneStyles = {
    pine: {
      text: "text-pine",
      iconBg: "bg-pine-soft text-pine border border-pine/15",
      badgeBg: "bg-pine-soft text-pine",
    },
    honey: {
      text: "text-honey",
      iconBg: "bg-honey-soft text-honey border border-honey/20",
      badgeBg: "bg-honey-soft text-honey",
    },
    clay: {
      text: "text-clay",
      iconBg: "bg-clay-soft text-clay border border-clay/20",
      badgeBg: "bg-clay-soft text-clay",
    },
    ocean: {
      text: "text-ocean",
      iconBg: "bg-ocean-soft text-ocean border border-ocean/20",
      badgeBg: "bg-ocean-soft text-ocean",
    },
    neutral: {
      text: "text-ink",
      iconBg: "bg-surface-soft text-fog border border-line",
      badgeBg: "bg-surface-soft text-fog",
    },
  }[tone];

  return (
    <div
      className={cn(
        "card card-hover p-4 sm:p-5 flex flex-col justify-between border border-line bg-card shadow-[0_1px_3px_rgba(26,29,26,0.04)] select-none",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-fog truncate">
          {title}
        </span>
        {icon && (
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs", toneStyles.iconBg)}>
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2.5">
        <p className={cn("num text-2xl sm:text-[28px] font-extrabold tracking-tight leading-none", toneStyles.text)}>
          {value}
        </p>
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-fog font-medium">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold",
                trend.isPositive ? "bg-pine-soft text-pine" : "bg-clay-soft text-clay"
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="mr-0.5 h-3 w-3" />
              ) : (
                <TrendingDown className="mr-0.5 h-3 w-3" />
              )}
              {trend.value}
            </span>
          )}
          {subtitle && <span className="truncate">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
