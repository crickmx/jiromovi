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
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        "animate-fade-in",
        className
      )}
    >
      {Icon && (
        <div className="mb-5 p-4 rounded-2xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/8">
          <Icon className="h-10 w-10 text-neutral-400 dark:text-white/30" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-neutral-500 dark:text-white/50 max-w-sm mb-6 leading-relaxed">
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
