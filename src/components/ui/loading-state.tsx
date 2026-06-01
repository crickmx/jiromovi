import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton' | 'dots';
  className?: string;
  text?: string;
  lines?: number;
  compact?: boolean;
}

export function LoadingState({
  variant = 'spinner',
  className,
  text,
  lines = 4,
  compact = false,
}: LoadingStateProps) {
  const padding = compact ? 'py-10' : 'py-16';

  if (variant === 'skeleton') {
    return (
      <div className={cn("space-y-4 animate-fade-in", className)}>
        <Skeleton className="h-7 w-44" />
        <div className="space-y-3">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-4"
              style={{ width: `${85 - i * 10}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className={cn("flex flex-col items-center justify-center", padding, className)}>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
        </div>
        {text && (
          <p className="mt-3 text-sm text-neutral-500 dark:text-white/50">{text}</p>
        )}
      </div>
    );
  }

  // Default: spinner
  return (
    <div className={cn("flex flex-col items-center justify-center", padding, className)}>
      <div className="h-8 w-8 rounded-full border-2 border-neutral-200 dark:border-white/10 border-t-accent animate-spin" />
      {text && (
        <p className="mt-4 text-sm text-neutral-500 dark:text-white/50">{text}</p>
      )}
    </div>
  );
}

// ── Table Skeleton ─────────────────────────────────────────────────────────────

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, columns = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn("space-y-0 animate-fade-in", className)}>
      {/* Header row */}
      <div className="flex gap-4 px-4 py-3 border-b border-neutral-100 dark:border-white/8 bg-neutral-50 dark:bg-white/3 rounded-t-xl">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-4 px-4 py-4 border-b border-neutral-100 dark:border-white/5 last:border-0"
          style={{ opacity: 1 - rowIdx * 0.08 }}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Card Skeleton ──────────────────────────────────────────────────────────────

interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export function CardSkeleton({ count = 3, className }: CardSkeletonProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/60 dark:border-white/8 p-5 space-y-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
