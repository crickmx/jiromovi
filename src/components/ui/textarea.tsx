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
          "border border-strong dark:border-white/15 hover:border-neutral-300 dark:hover:border-white/25",
          "bg-white dark:bg-white/6",
          "px-4 py-2.5 text-sm",
          "text-neutral-900 dark:text-white",
          "placeholder:text-neutral-500 dark:placeholder:text-white/55 leading-relaxed",
          "ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 focus-visible:border-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "read-only:bg-neutral-50 dark:read-only:bg-white/3",
          "transition-[border-color,box-shadow] duration-fast resize-y",
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
