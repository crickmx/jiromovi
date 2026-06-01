import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-accent/10 text-accent dark:bg-accent/20 dark:text-accent-foreground",
        secondary:
          "border-transparent bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/70",
        destructive:
          "border-transparent bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400",
        outline:
          "text-neutral-600 border-neutral-200 dark:text-white/70 dark:border-white/15",
        success:
          "border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
        warning:
          "border-transparent bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
        info:
          "border-transparent bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
        purple:
          "border-transparent bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
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
