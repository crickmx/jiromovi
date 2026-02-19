import * as React from "react"
import { LucideIcon } from "lucide-react"
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
        "flex flex-col items-center justify-center py-20 px-4 text-center",
        "animate-fade-in",
        className
      )}
    >
      {Icon && (
        <div className="mb-6 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-400/20 to-primary-600/20 dark:from-primary-500/10 dark:to-accent-dark/10 blur-2xl rounded-full" />
          <div className="relative rounded-2xl bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-white/5 dark:to-white/10 p-6 backdrop-blur-sm border border-neutral-200 dark:border-white/10">
            <Icon className="h-12 w-12 text-neutral-400 dark:text-white/40" strokeWidth={1.5} />
          </div>
        </div>
      )}
      <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-3">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-neutral-600 dark:text-white/60 max-w-md mb-8 leading-relaxed">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || "default"}
              className="shadow-sm hover:shadow-md transition-all"
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="ghost"
              className="text-neutral-600 dark:text-white/60"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
