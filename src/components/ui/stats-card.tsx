import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
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
  const colorStyles = {
    primary: {
      bg: 'bg-primary-50',
      icon: 'text-primary-600',
      value: 'text-neutral-900',
      trend: 'text-primary-600'
    },
    success: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      value: 'text-neutral-900',
      trend: 'text-green-600'
    },
    warning: {
      bg: 'bg-orange-50',
      icon: 'text-orange-600',
      value: 'text-neutral-900',
      trend: 'text-orange-600'
    },
    danger: {
      bg: 'bg-red-50',
      icon: 'text-red-600',
      value: 'text-neutral-900',
      trend: 'text-red-600'
    },
    neutral: {
      bg: 'bg-neutral-100',
      icon: 'text-neutral-600',
      value: 'text-neutral-900',
      trend: 'text-neutral-600'
    }
  };

  const styles = colorStyles[color];

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white/70 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-neutral-200/50 dark:border-white/10 shadow-ios p-4 sm:p-6',
        'transition-all duration-250 ease-ios-smooth',
        onClick && 'cursor-pointer hover:shadow-ios-lg hover:border-primary-300 dark:hover:border-primary-500/30 hover:-translate-y-0.5 active:scale-[0.98]',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Título */}
          <p className="text-sm font-medium text-neutral-600 dark:text-white/60 mb-1 truncate">
            {title}
          </p>

          {/* Valor principal */}
          <p className={cn(
            'text-2xl sm:text-3xl font-bold tracking-tight mb-1',
            'text-neutral-900 dark:text-white'
          )}>
            {value}
          </p>

          {/* Descripción o trend */}
          {(description || trend) && (
            <div className="flex items-center gap-2 flex-wrap">
              {trend && (
                <span className={cn(
                  'text-xs sm:text-sm font-medium',
                  styles.trend
                )}>
                  {trend.direction === 'up' ? '↑' : '↓'} {trend.value}% {trend.label}
                </span>
              )}
              {description && (
                <span className="text-xs sm:text-sm text-neutral-500">
                  {description}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Icono */}
        {Icon && (
          <div className={cn(
            'flex-shrink-0 p-3 rounded-xl bg-gradient-to-br',
            color === 'primary' && 'from-primary-50 to-primary-100 dark:from-primary-500/10 dark:to-primary-600/20',
            color === 'success' && 'from-green-50 to-green-100 dark:from-green-500/10 dark:to-green-600/20',
            color === 'warning' && 'from-orange-50 to-orange-100 dark:from-orange-500/10 dark:to-orange-600/20',
            color === 'danger' && 'from-red-50 to-red-100 dark:from-red-500/10 dark:to-red-600/20',
            color === 'neutral' && 'from-neutral-100 to-neutral-200 dark:from-white/5 dark:to-white/10'
          )}>
            <Icon className={cn(
              'w-6 h-6',
              color === 'primary' && 'text-primary-600 dark:text-primary-400',
              color === 'success' && 'text-green-600 dark:text-green-400',
              color === 'warning' && 'text-orange-600 dark:text-orange-400',
              color === 'danger' && 'text-red-600 dark:text-red-400',
              color === 'neutral' && 'text-neutral-600 dark:text-white/60'
            )} />
          </div>
        )}
      </div>

      {/* Contenido adicional */}
      {children && (
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-white/10">
          {children}
        </div>
      )}
    </div>
  );
}
