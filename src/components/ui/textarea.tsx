import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-xl",
          "border border-neutral-200 dark:border-white/15",
          "bg-white dark:bg-white/6",
          "px-4 py-2.5 text-sm",
          "text-neutral-900 dark:text-white",
          "placeholder:text-neutral-400 dark:placeholder:text-white/50",
          "ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent/70",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "read-only:bg-neutral-50 dark:read-only:bg-white/3",
          "transition-all duration-200 resize-y",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
