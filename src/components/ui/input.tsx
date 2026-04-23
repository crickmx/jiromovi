import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-neutral-200 dark:border-white/15 bg-white dark:bg-white/5 px-3.5 py-2 text-sm text-neutral-900 dark:text-white",
          "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-neutral-400 dark:placeholder:text-white/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all duration-200",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
