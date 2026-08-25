import * as React from "react"
import { cn } from "@/lib/utils"
import { Inbox } from "lucide-react"

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-line bg-surface-soft/60",
        className
      )}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pine-soft text-pine mb-3">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="font-heading text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-fog max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
