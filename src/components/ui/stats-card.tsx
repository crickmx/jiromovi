import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}

const iconColorMap: Record<string, string> = {
  primary: 'text-accent bg-accent/10 dark:bg-accent/20',
  success: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15',
  warning: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15',
  danger:  'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15',
  neutral: 'text-neutral-600 dark:text-white/70 bg-neutral-100 dark:bg-white/10',
  info:    'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15',
};

const trendColorMap: Record<string, string> = {
  primary: 'text-accent',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger:  'text-red-600 dark:text-red-400',
  neutral: 'text-neutral-600 dark:text-white/60',
  info:    'text-blue-600 dark:text-blue-400',
};

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  color = 'primary',
  onClick,
  children,
  className,
  compact = false,
}: StatsCardProps) {
  const TrendIcon = trend?.direction === 'up'
    ? TrendingUp
    : trend?.direction === 'down'
      ? TrendingDown
      : Minus;

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-neutral-800/60 rounded-2xl',
        'border border-neutral-200/70 dark:border-white/10',
        'shadow-card',
        'transition-all duration-200 ease-smooth',
        compact ? 'p-4' : 'p-4 sm:p-5',
        onClick && [
          'cursor-pointer',
          'hover:shadow-card-hover',
          'hover:border-neutral-300 dark:hover:border-white/18',
          'hover:-translate-y-0.5',
          'active:translate-y-0 active:scale-[0.99]',
        ],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title: WCAG AA — neutral-600 on white = 5.7:1, white/60 on dark bg ≈ 4.5:1 */}
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-white/60 mb-2 truncate">
            {title}
          </p>

          {/* Value: always high contrast */}
          <p className={cn(
            "font-bold tracking-tight text-neutral-900 dark:text-white leading-none mb-2",
            compact ? "text-2xl" : "text-2xl sm:text-3xl"
          )}>
            {value}
          </p>

          {(description || trend) && (
            <div className="flex items-center gap-2 flex-wrap">
              {trend && (
                <span className={cn('flex items-center gap-0.5 text-xs font-semibold', trendColorMap[color])}>
                  <TrendIcon className="w-3 h-3" />
                  {trend.direction === 'up' ? '+' : trend.direction === 'down' ? '-' : ''}
                  {Math.abs(trend.value)}% {trend.label}
                </span>
              )}
              {description && (
                // WCAG AA: neutral-500 on white = 4.5:1, white/55 on dark ≈ 4:1
                <span className="text-xs text-neutral-500 dark:text-white/55">
                  {description}
                </span>
              )}
            </div>
          )}
        </div>

        {Icon && (
          <div className={cn('flex-shrink-0 p-2.5 rounded-xl', iconColorMap[color])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {children && (
        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-white/8">
          {children}
        </div>
      )}
    </div>
  );
}
