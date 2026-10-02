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
          "border border-strong dark:border-white/15",
          "bg-white dark:bg-white/6 shadow-[inset_0_1px_1px_rgba(28,25,23,0.03)]",
          // Typography — explicit colors, no opacity fallbacks that can disappear
          "px-3.5 py-2 text-sm text-neutral-900 dark:text-white",
          // Placeholder — neutral-500 sobre blanco ≈ 4.8:1 (AA)
          "placeholder:text-neutral-500 dark:placeholder:text-white/60",
          // File input reset
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-neutral-700 dark:file:text-white/70",
          // Focus — visible ring for keyboard nav
          "hover:border-neutral-300 dark:hover:border-white/25",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 focus-visible:border-accent",
          "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-500/15",
          // Disabled — clear visual state
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-neutral-50 dark:disabled:bg-white/3",
          // Read-only
          "read-only:bg-neutral-50 dark:read-only:bg-white/3 read-only:text-neutral-600 dark:read-only:text-white/65",
          // Transition
          "transition-[border-color,box-shadow,background-color] duration-fast",
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
