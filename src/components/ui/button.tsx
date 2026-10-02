import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base: consistent height, radius, font, transitions across all variants
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-display text-sm font-semibold tracking-[-0.005em] transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0e0e10] disabled:pointer-events-none disabled:opacity-50 select-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary uses dynamic office accent — text-accent-foreground is auto white/black for contrast
        default:
          "bg-accent text-accent-foreground shadow-accent hover:bg-accent-hover hover:-translate-y-px active:translate-y-0 active:scale-[0.98]",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md hover:-translate-y-px active:translate-y-0 active:scale-[0.98] dark:bg-red-600 dark:hover:bg-red-700",
        outline:
          "border border-strong bg-white dark:bg-white/6 text-neutral-800 dark:text-white/85 shadow-e1 hover:bg-surface-muted hover:border-accent/35 dark:hover:bg-white/10 dark:hover:border-white/25 active:scale-[0.98]",
        secondary:
          "bg-accent-soft text-accent-ink dark:bg-white/12 dark:text-white/90 hover:bg-accent/15 dark:hover:bg-white/18 active:scale-[0.98]",
        ghost:
          "text-neutral-700 dark:text-white/75 hover:bg-neutral-100 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-white active:scale-[0.98]",
        link:
          "text-accent-ink underline-offset-4 hover:underline p-0 h-auto",
        success:
          "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow-md hover:-translate-y-px active:scale-[0.98]",
        warning:
          "bg-amber-500 text-white shadow-sm hover:bg-amber-600 hover:shadow-md hover:-translate-y-px active:scale-[0.98]",
      },
      size: {
        default:   "h-10 px-4 py-2",
        sm:        "h-9 rounded-xl px-3.5 text-[13px]",
        lg:        "h-12 rounded-2xl px-6 text-[15px]",
        icon:      "h-10 w-10 rounded-xl",
        "icon-sm": "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
