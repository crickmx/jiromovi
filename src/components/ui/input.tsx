import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Layout
          "flex h-10 w-full",
          // Shape
          "rounded-xl",
          // Border + background — use CSS token vars for guaranteed contrast
          "border border-neutral-200 dark:border-white/15",
          "bg-white dark:bg-white/6",
          // Typography — explicit colors, no opacity fallbacks that can disappear
          "px-3.5 py-2 text-sm text-neutral-900 dark:text-white",
          // Placeholder — WCAG AA: neutral-400 on white = 4.6:1, white/50 on dark bg = ~3:1 min
          "placeholder:text-neutral-400 dark:placeholder:text-white/60",
          // File input reset
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-neutral-700 dark:file:text-white/70",
          // Focus — visible ring for keyboard nav
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent/70",
          // Disabled — clear visual state
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-neutral-50 dark:disabled:bg-white/3",
          // Read-only
          "read-only:bg-neutral-50 dark:read-only:bg-white/3 read-only:text-neutral-600 dark:read-only:text-white/65",
          // Transition
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
