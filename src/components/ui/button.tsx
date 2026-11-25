import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Lenguaje «Tarjeta con zócalo»: botones rectangulares, sin sombra, con
// transiciones de color (no de posición). Foco visible de 2px con offset.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none font-display text-sm font-semibold tracking-[-0.005em] transition-[background-color,border-color,color] duration-fast ease-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 select-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary uses dynamic office accent — text-accent-foreground is auto white/black for contrast
        default:
          "bg-accent text-accent-foreground hover:bg-accent-hover",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700",
        outline:
          "border border-strong bg-transparent text-accent-ink dark:text-white/85 hover:bg-surface-muted hover:border-accent/35 dark:hover:bg-white/10 dark:hover:border-white/25",
        secondary:
          "bg-accent-soft text-accent-ink dark:bg-white/12 dark:text-white/90 hover:bg-accent/15 dark:hover:bg-white/18",
        ghost:
          "text-neutral-700 dark:text-white/75 hover:bg-neutral-100 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-white",
        link:
          "text-accent-ink underline-offset-4 hover:underline p-0 h-auto",
        success:
          "bg-emerald-600 text-white hover:bg-emerald-700",
        warning:
          "bg-amber-500 text-white hover:bg-amber-600",
      },
      size: {
        default:   "h-10 px-4 py-2",
        sm:        "h-9 px-3.5 text-[13px]",
        lg:        "h-12 px-6 text-[15px]",
        icon:      "h-10 w-10",
        "icon-sm": "h-8 w-8",
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
