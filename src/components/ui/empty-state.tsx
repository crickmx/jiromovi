import * as React from "react"
import { Video as LucideIcon } from "lucide-react"
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
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 sm:py-20 px-4 text-center",
        "animate-fade-in",
        className
      )}
    >
      {Icon && (
        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-neutral-50 to-neutral-100/50 dark:from-white/5 dark:to-white/3 border border-neutral-100 dark:border-white/8">
          <Icon className="h-8 w-8 text-neutral-400 dark:text-white/30" strokeWidth={1.5} />
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
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || "default"}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="ghost"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
