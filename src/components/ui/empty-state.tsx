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
        <div className="relative mb-5" aria-hidden="true">
          {/* Halo orgánico de marca, bajo contraste */}
          <span
            className="absolute -inset-4 rounded-[46%_54%_58%_42%/52%_44%_56%_48%] bg-accent-soft dark:bg-accent/10"
          />
          <span className="relative grid place-items-center w-14 h-14 rounded-2xl bg-surface-card border border-soft shadow-e2">
            <Icon className="h-6 w-6 text-accent-ink" strokeWidth={1.75} />
          </span>
        </div>
      )}

      <h3 className="font-display text-title-sm font-semibold text-neutral-900 dark:text-white mb-1.5">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-neutral-600 dark:text-white/60 max-w-sm mb-6 leading-relaxed">
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
