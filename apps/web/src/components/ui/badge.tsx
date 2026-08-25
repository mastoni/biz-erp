import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors whitespace-nowrap select-none",
  {
    variants: {
      variant: {
        default: "bg-pine text-white hover:bg-pine-dark",
        pine: "bg-pine-soft text-pine border border-pine/20",
        honey: "bg-honey-soft text-[#8a5f10] border border-honey/25",
        clay: "bg-clay-soft text-clay border border-clay/25",
        ocean: "bg-ocean-soft text-ocean border border-ocean/25",
        neutral: "bg-surface-soft text-fog border border-line",
        outline: "border border-line text-ink bg-transparent",
      },
      size: {
        sm: "text-[10px] px-2 py-0.25",
        default: "text-xs px-2.5 py-0.5",
        lg: "text-sm px-3 py-1",
      },
    },
    defaultVariants: {
      variant: "pine",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, className }))} {...props}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "pine" && "bg-pine",
            variant === "honey" && "bg-honey",
            variant === "clay" && "bg-clay",
            variant === "ocean" && "bg-ocean",
            variant === "default" && "bg-white",
            variant === "neutral" && "bg-fog",
            (!variant || variant === "outline") && "bg-ink"
          )}
        />
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
