import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        // Default uses dynamic accent — ensure text/bg pass WCAG AA:
        // In light mode: solid accent bg with white text (foreground) ≥ 4.5:1
        default:
          "border-transparent bg-accent text-accent-foreground",
        // Muted variant for less prominent labels
        secondary:
          "border-transparent bg-neutral-100 text-neutral-700 dark:bg-white/12 dark:text-white/85",
        destructive:
          "border-transparent bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
        outline:
          "text-neutral-700 border-neutral-300 dark:text-white/80 dark:border-white/20",
        success:
          "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
        warning:
          "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
        info:
          "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
        // Subtle accent — tinted bg with accent-colored text
        subtle:
          "border-transparent bg-accent/10 text-accent dark:bg-accent/20 dark:text-white/90",
        purple:
          "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
