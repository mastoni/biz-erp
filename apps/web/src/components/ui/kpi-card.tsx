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
  const toneColor = {
    pine: "text-pine",
    honey: "text-honey",
    clay: "text-clay",
    ocean: "text-ocean",
    neutral: "text-ink",
  }[tone];

  return (
    <div
      className={cn(
        "card card-hover px-4 py-3.5 flex flex-col justify-between select-none",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-fog truncate">
          {title}
        </p>
        {icon && <div className="text-fog/70 shrink-0">{icon}</div>}
      </div>

      <div className="mt-2">
        <p className={cn("num text-2xl font-bold tracking-tight", toneColor)}>
          {value}
        </p>
      </div>

      {(subtitle || trend) && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-fog">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center font-semibold",
                trend.isPositive ? "text-pine" : "text-clay"
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="mr-0.5 h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="mr-0.5 h-3.5 w-3.5" />
              )}
              {trend.value}
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
