import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base: consistent height, radius, font, transitions across all variants
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-foreground shadow-sm hover:bg-accent-hover hover:shadow-md hover:-translate-y-px active:translate-y-0 active:scale-[0.98]",
        destructive:
          "bg-red-500 text-white shadow-sm hover:bg-red-600 hover:shadow-md hover:-translate-y-px active:translate-y-0 active:scale-[0.98] dark:bg-red-600 dark:hover:bg-red-700",
        outline:
          "border border-neutral-200/80 dark:border-white/15 bg-white dark:bg-white/5 text-neutral-700 dark:text-white/80 hover:bg-neutral-50 dark:hover:bg-white/8 hover:border-neutral-300 dark:hover:border-white/20 active:scale-[0.98]",
        secondary:
          "bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/80 hover:bg-neutral-200 dark:hover:bg-white/15 active:scale-[0.98]",
        ghost:
          "text-neutral-600 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/8 hover:text-neutral-900 dark:hover:text-white active:scale-[0.98]",
        link:
          "text-accent underline-offset-4 hover:underline hover:text-accent-hover p-0 h-auto",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm:      "h-8 rounded-xl px-3 text-xs",
        lg:      "h-11 rounded-xl px-6 text-base",
        icon:    "h-10 w-10 rounded-xl",
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
