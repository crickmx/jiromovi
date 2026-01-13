import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 ease-ios-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-br from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 hover:shadow-ios-md dark:from-primary-600 dark:to-primary-700 dark:hover:from-primary-700 dark:hover:to-primary-800 shadow-ios hover:-translate-y-0.5",
        destructive:
          "bg-gradient-to-br from-ios-red to-red-600 text-white hover:from-red-600 hover:to-red-700 hover:shadow-ios-md dark:from-red-600 dark:to-red-700 dark:hover:from-red-700 dark:hover:to-red-800 shadow-ios hover:-translate-y-0.5",
        outline:
          "border-2 border-primary-500 dark:border-primary-400 bg-transparent text-primary-500 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 hover:border-primary-600 dark:hover:border-primary-300",
        secondary:
          "bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-white hover:bg-neutral-200 dark:hover:bg-white/20 hover:-translate-y-0.5",
        ghost: "hover:bg-neutral-100 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-white text-neutral-700 dark:text-white/80",
        link: "text-primary-500 dark:text-primary-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5",
        lg: "h-12 rounded-xl px-8",
        icon: "h-11 w-11",
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
