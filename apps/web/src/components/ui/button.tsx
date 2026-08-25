import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-pine text-primary-foreground hover:bg-pine-dark shadow-[0_2px_0_rgba(12,32,24,0.35)] active:scale-[0.98]",
        pine: "bg-pine text-primary-foreground hover:bg-pine-dark shadow-[0_2px_0_rgba(12,32,24,0.35)] active:scale-[0.98]",
        honey: "bg-honey text-pine-deep hover:brightness-105 shadow-[0_2px_0_rgba(120,80,10,0.35)] active:scale-[0.98]",
        clay: "bg-clay text-white hover:brightness-105 shadow-[0_2px_0_rgba(120,30,20,0.35)] active:scale-[0.98]",
        outline:
          "border-line bg-surface text-ink hover:border-pine/50 hover:bg-pine-soft/60 aria-expanded:bg-pine-soft active:scale-[0.98]",
        secondary:
          "bg-pine-soft text-pine hover:bg-pine-soft/80 aria-expanded:bg-pine-soft aria-expanded:text-pine",
        ghost:
          "hover:bg-pine-soft/50 hover:text-pine aria-expanded:bg-pine-soft/50 aria-expanded:text-pine",
        destructive:
          "bg-clay/10 text-clay hover:bg-clay/20 focus-visible:border-clay/40 focus-visible:ring-clay/20",
        link: "text-pine underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
