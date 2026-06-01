import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: "default" | "outline"
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
  compact?: boolean
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-4 text-center",
        compact ? "py-10" : "py-16 sm:py-20",
        "animate-fade-in",
        className
      )}
    >
      {Icon && (
        <div className={cn(
          "mb-4 p-3.5 rounded-2xl",
          "bg-neutral-100 dark:bg-white/6",
          "border border-neutral-200/60 dark:border-white/8"
        )}>
          <Icon className="h-7 w-7 text-neutral-400 dark:text-white/30" strokeWidth={1.5} />
        </div>
      )}

      <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1.5">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-neutral-500 dark:text-white/50 max-w-xs mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {action && (
            <Button onClick={action.onClick} variant={action.variant || "default"} size="sm">
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="ghost" size="sm">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
