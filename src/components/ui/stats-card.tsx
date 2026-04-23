import { ReactNode } from 'react';
import { Video as LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down';
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
}

const iconColorMap = {
  primary: 'text-accent dark:text-accent bg-accent/8 dark:bg-accent/15',
  success: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15',
  warning: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15',
  danger: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15',
  neutral: 'text-neutral-600 dark:text-white/60 bg-neutral-100 dark:bg-white/8',
};

const trendColorMap = {
  primary: 'text-accent',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  neutral: 'text-neutral-600 dark:text-white/60',
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
  className
}: StatsCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 p-4 sm:p-5 shadow-card',
        'transition-all duration-200 ease-smooth',
        onClick && 'cursor-pointer hover:shadow-card-hover hover:border-neutral-300 dark:hover:border-white/15 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-neutral-500 dark:text-white/50 mb-1.5 truncate">
            {title}
          </p>

          <p className="text-2xl sm:text-[28px] font-bold tracking-tight text-neutral-900 dark:text-white leading-none mb-1.5">
            {value}
          </p>

          {(description || trend) && (
            <div className="flex items-center gap-2 flex-wrap">
              {trend && (
                <span className={cn(
                  'text-xs font-semibold',
                  trendColorMap[color]
                )}>
                  {trend.direction === 'up' ? '+' : '-'}{trend.value}% {trend.label}
                </span>
              )}
              {description && (
                <span className="text-xs text-neutral-500 dark:text-white/40">
                  {description}
                </span>
              )}
            </div>
          )}
        </div>

        {Icon && (
          <div className={cn(
            'flex-shrink-0 p-2.5 rounded-xl',
            iconColorMap[color]
          )}>
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
