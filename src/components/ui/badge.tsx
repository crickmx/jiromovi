import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-accent/10 text-accent dark:bg-accent/20 dark:text-accent-foreground",
        secondary:
          "border-transparent bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-white/70",
        destructive:
          "border-transparent bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400",
        outline: "text-neutral-600 border-neutral-200 dark:text-white/70 dark:border-white/15",
        success:
          "border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
        warning:
          "border-transparent bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
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
